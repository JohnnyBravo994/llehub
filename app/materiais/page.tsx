"use client";

import { useTheme } from "../useTheme";
import { ThemeSwitcher } from "../ThemeSwitcher";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getAllMateriais, createMaterial, updateMaterial, toggleMaterialAtivo,
  getMovimentosMateriais, registarSaidaMaterial, registarVoltaMaterial, deleteMovimentoMaterial,
  setupMateriais, getEventosParaMateriais,
} from "../actions";

interface Material {
  id: number; nome: string; categoria: string; imagem: string;
  quantidade_total: number; notas: string; ativo: number;
}

interface Movimento {
  id: number; material_id: number; material_nome: string; material_imagem: string;
  quantidade: number; quantidade_devolvida: number;
  origem: string; origem_detalhe: string; evento: string; evento_id: number | null; responsavel: string; notas: string;
  data_saida: string; data_volta: string | null;
}

interface EventoOpcao { id: number; title: string; date: string; }

const PESSOAL = "Pessoal";
const SEL_PESSOAL = "pessoal";

const C = {
  gold: "#C9A96E", goldDim: "#8a7350", surface: "#111009",
  border: "rgba(201,169,110,0.12)", borderDim: "rgba(255,255,255,0.05)",
  textPrimary: "#F5F0E8", textSec: "rgba(245,240,232,0.45)", textMuted: "rgba(245,240,232,0.22)",
  green: "#5DCAA5", amber: "#EF9F27", blue: "#85B7EB", red: "#E24B4A",
};

const C_Light = {
  gold: "#000000", goldDim: "#000000", surface: "#FFFFFF",
  border: "rgba(0,0,0,0.15)", borderDim: "rgba(0,0,0,0.12)",
  textPrimary: "#000000", textSec: "rgba(0,0,0,0.75)", textMuted: "rgba(0,0,0,0.55)",
  green: "#000000", amber: "#000000", blue: "#000000", red: "#000000",
};

const getColors = (lightTheme: boolean) => lightTheme ? C_Light : C;

const CATEGORIAS = ["Som", "Luz", "DJ / Cabine", "Microfones", "Estrutura", "Decoração", "Roupa", "Outro"];
const ORIGENS = ["Loja", "João", "Annia", "Outro"];

const emptyMaterialForm = { nome: "", categoria: "", imagem: "", quantidade_total: 1, notas: "" };
const emptySaidaForm = { material_id: 0, quantidade: 1, origem: "Loja", origem_detalhe: "", evento_sel: SEL_PESSOAL, evento: "", evento_id: null as number | null, notas: "" };

function fmtDateTime(s: string) {
  if (!s) return "—";
  const d = new Date(s.replace(" ", "T") + (s.includes("Z") ? "" : "Z"));
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" }) + " · " +
    d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function diasFora(dataSaida: string) {
  const d = new Date(dataSaida.replace(" ", "T") + (dataSaida.includes("Z") ? "" : "Z"));
  if (isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 480;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("sem contexto canvas")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => reject(new Error("erro ao carregar imagem"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("erro ao ler ficheiro"));
    reader.readAsDataURL(file);
  });
}

function origemLabel(m: Movimento) {
  return m.origem === "Outro" && m.origem_detalhe ? m.origem_detalhe : m.origem;
}

function fmtDateShort(s: string) {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

// Agrupa movimentos por evento (ligado à agenda), texto legado, ou "Pessoal"
function agruparPorEvento(movs: Movimento[], eventos: EventoOpcao[]) {
  const eventosMap = new Map(eventos.map(e => [e.id, e]));
  const groups = new Map<string, { key: string; label: string; date: string; isPessoal: boolean; items: Movimento[] }>();
  for (const mov of movs) {
    let key: string, label: string, date = "";
    if (mov.evento_id) {
      const ev = eventosMap.get(mov.evento_id);
      key = `ev-${mov.evento_id}`;
      label = ev?.title || mov.evento || `Evento #${mov.evento_id}`;
      date = ev?.date || "";
    } else if (mov.evento && mov.evento.trim() && mov.evento.trim() !== PESSOAL) {
      key = `legacy-${mov.evento.trim().toLowerCase()}`;
      label = mov.evento.trim();
    } else {
      key = "pessoal";
      label = PESSOAL;
    }
    if (!groups.has(key)) groups.set(key, { key, label, date, isPessoal: key === "pessoal", items: [] });
    groups.get(key)!.items.push(mov);
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (a.isPessoal !== b.isPessoal) return a.isPessoal ? 1 : -1;
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date !== b.date) return a.date ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export default function MateriaisPage() {
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("admin");
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [eventos, setEventos] = useState<EventoOpcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"fora" | "historico" | "catalogo">("fora");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  const [saidaModal, setSaidaModal] = useState(false);
  const [saidaForm, setSaidaForm] = useState(emptySaidaForm);

  const [materialModal, setMaterialModal] = useState<{ open: boolean; editing: Material | null }>({ open: false, editing: null });
  const [materialForm, setMaterialForm] = useState(emptyMaterialForm);
  const [imgUploading, setImgUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [voltaQty, setVoltaQty] = useState<Record<number, number>>({});

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const load = useCallback(async () => {
    await setupMateriais();
    const [mr, movr, evr] = await Promise.all([getAllMateriais(), getMovimentosMateriais(), getEventosParaMateriais()]);
    if (mr.success) setMateriais(mr.data as Material[]);
    if (movr.success) setMovimentos(movr.data as Movimento[]);
    if (evr.success) setEventos(evr.data as EventoOpcao[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("lle_user");
    if (!u) { router.push("/"); return; }
    const parsed = JSON.parse(u);
    if (parsed.role === "limited_novalues") { router.push("/agenda"); return; }
    setUserName(parsed.name);
    setUserRole(parsed.role || "admin");
    load();
  }, [load]);

  const materiaisAtivos = materiais.filter(m => m.ativo === 1);
  const movimentosAbertos = movimentos.filter(m => m.quantidade_devolvida < m.quantidade);
  const movimentosFechados = movimentos.filter(m => m.quantidade_devolvida >= m.quantidade);
  const foraAgrupados = agruparPorEvento(movimentosAbertos, eventos);
  const totalUnidades = materiaisAtivos.reduce((s, m) => s + m.quantidade_total, 0);
  const totalFora = movimentosAbertos.reduce((s, m) => s + (m.quantidade - m.quantidade_devolvida), 0);

  function pendenteAtualDoMaterial(materialId: number) {
    return movimentosAbertos
      .filter(m => m.material_id === materialId)
      .reduce((s, m) => s + (m.quantidade - m.quantidade_devolvida), 0);
  }

  // ── Saída ──────────────────────────────────────────────────────────────
  const openSaida = (materialId?: number) => {
    setSaidaForm({ ...emptySaidaForm, material_id: materialId || (materiaisAtivos[0]?.id ?? 0) });
    setSaidaModal(true);
  };
  const closeSaida = () => setSaidaModal(false);

  const handleRegistarSaida = async () => {
    const mat = materiais.find(m => m.id === saidaForm.material_id);
    if (!mat) { showToast("Escolhe um material"); return; }
    if (saidaForm.quantidade < 1) { showToast("Quantidade inválida"); return; }
    if (saidaForm.origem === "Outro" && !saidaForm.origem_detalhe.trim()) { showToast("Especifica para onde vai"); return; }
    const isPessoal = saidaForm.evento_sel === SEL_PESSOAL;
    const eventoSelecionado = isPessoal ? null : eventos.find(e => String(e.id) === saidaForm.evento_sel) || null;
    setSaving(true);
    await registarSaidaMaterial({
      material_id: mat.id, material_nome: mat.nome, material_imagem: mat.imagem,
      quantidade: saidaForm.quantidade, origem: saidaForm.origem, origem_detalhe: saidaForm.origem_detalhe,
      evento: isPessoal ? PESSOAL : (eventoSelecionado?.title || ""),
      evento_id: isPessoal ? null : (eventoSelecionado?.id ?? null),
      responsavel: userName, notas: saidaForm.notas,
    });
    showToast(`Saída registada: ${mat.nome}`);
    closeSaida();
    await load();
    setSaving(false);
  };

  // ── Volta ──────────────────────────────────────────────────────────────
  const handleVoltou = async (mov: Movimento, quantidade?: number) => {
    const pendente = mov.quantidade - mov.quantidade_devolvida;
    const qtd = quantidade ?? pendente;
    if (qtd <= 0) return;
    const novaDevolvida = Math.min(mov.quantidade, mov.quantidade_devolvida + qtd);
    await registarVoltaMaterial(mov.id, novaDevolvida, mov.quantidade);
    showToast(novaDevolvida >= mov.quantidade ? `${mov.material_nome} voltou` : `Devolução parcial registada`);
    await load();
  };

  const handleDeleteMovimento = async (id: number) => {
    if (!confirm("Apagar este registo de movimento?")) return;
    await deleteMovimentoMaterial(id);
    showToast("Movimento apagado");
    await load();
  };

  // ── Catálogo ───────────────────────────────────────────────────────────
  const openCreateMaterial = () => { setMaterialForm(emptyMaterialForm); setMaterialModal({ open: true, editing: null }); };
  const openEditMaterial = (m: Material) => {
    setMaterialForm({ nome: m.nome, categoria: m.categoria, imagem: m.imagem, quantidade_total: m.quantidade_total, notas: m.notas });
    setMaterialModal({ open: true, editing: m });
  };
  const closeMaterialModal = () => setMaterialModal({ open: false, editing: null });

  const handleImageUpload = async (file: File) => {
    setImgUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setMaterialForm(f => ({ ...f, imagem: dataUrl }));
    } catch {
      showToast("Erro ao processar imagem");
    }
    setImgUploading(false);
  };

  const handleSaveMaterial = async () => {
    if (!materialForm.nome.trim()) { showToast("Nome é obrigatório"); return; }
    setSaving(true);
    if (materialModal.editing) {
      await updateMaterial(materialModal.editing.id, materialForm);
      showToast("Material atualizado");
    } else {
      await createMaterial(materialForm);
      showToast("Material criado");
    }
    closeMaterialModal();
    await load();
    setSaving(false);
  };

  const handleToggleMaterialAtivo = async (m: Material) => {
    const novo = m.ativo === 1 ? 0 : 1;
    await toggleMaterialAtivo(m.id, novo);
    showToast(novo === 1 ? "Material reativado" : "Material arquivado");
    await load();
  };

  // ── Styles ─────────────────────────────────────────────────────────────
  const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" };
  const overlayBottomStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" };
  const modalStyle: React.CSSProperties = { background: "#131108", border: `1px solid ${Colors.border}`, padding: "2.5rem", width: "480px", maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", position: "relative" };
  const modalMobStyle: React.CSSProperties = { background: "#131108", borderTop: `1px solid ${Colors.border}`, width: "100%", maxHeight: "92dvh", overflowY: "auto", padding: "1.5rem 1.25rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))", borderRadius: "12px 12px 0 0", position: "relative" };
  const topLineStyle: React.CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "7px", letterSpacing: "0.4em", color: Colors.textMuted, textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" };
  const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)`, color: Colors.textPrimary, fontFamily: "'Montserrat',sans-serif", fontSize: "11px", padding: "0.75rem 1rem", letterSpacing: "0.05em", outline: "none", boxSizing: "border-box" };
  const btnPrimStyle: React.CSSProperties = { background: Colors.gold, border: "none", color: "#0C0B09", fontSize: "9px", letterSpacing: "0.4em", fontWeight: 700, padding: "0.75rem 1.75rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };
  const btnSecStyle: React.CSSProperties = { background: "transparent", border: `1px solid ${Colors.border}`, color: Colors.textSec, fontSize: "9px", letterSpacing: "0.4em", fontWeight: 600, padding: "0.75rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };

  // Get colors based on current theme
  const Colors = getColors(lightTheme);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: lightTheme ? "#FFFBF7" : "#0C0B09" }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "3rem", letterSpacing: "0.4em", color: Colors.gold, fontWeight: 300 }}>LLE</span>
      </div>
    );
  }

  const TabBtn = ({ id, label, count }: { id: "fora" | "historico" | "catalogo"; label: string; count?: number }) => (
    <button onClick={() => setTab(id)} style={{
      background: tab === id ? "rgba(201,169,110,0.1)" : "transparent",
      border: "none", borderBottom: tab === id ? `2px solid ${Colors.gold}` : "2px solid transparent",
      color: tab === id ? Colors.gold : Colors.textSec, fontSize: "9px", letterSpacing: "0.25em", fontWeight: 600,
      padding: "0.85rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase",
      display: "flex", alignItems: "center", gap: "6px",
    }}>
      {label}{typeof count === "number" && <span style={{ background: tab === id ? "rgba(201,169,110,0.2)" : "rgba(255,255,255,0.06)", color: tab === id ? Colors.gold : Colors.textMuted, fontSize: "9px", padding: "1px 6px", borderRadius: "8px" }}>{count}</span>}
    </button>
  );

  const MaterialThumb = ({ src, size = 44 }: { src: string; size?: number }) => (
    src
      ? <img src={src} alt="" style={{ width: size, height: size, objectFit: "cover", border: `1px solid ${Colors.border}`, flexShrink: 0   }} />
      : <div style={{ width: size, height: size, background: "rgba(255,255,255,0.04)", border: `1px solid ${Colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="none" stroke={Colors.textMuted} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
        </div>
  );

  return (
    <>
    {/* ═══ DESKTOP ═══ */}
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: lightTheme ? "#FFFBF7" : "#0C0B09", color: Colors.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <Nav userName={userName} active="materiais" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/");   }} />
      <main style={{ padding: "2rem 2.5rem", maxWidth: "1400px", margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: Colors.textSec, textTransform: "uppercase", fontWeight: 600 }}>Materiais</p>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
            <button onClick={openCreateMaterial} style={btnSecStyle}>+ Novo Material</button>
            <button onClick={() => openSaida()} style={btnPrimStyle}>+ Registar Saída</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {[
            { label: "Materiais ativos", value: materiaisAtivos.length },
            { label: "Unidades totais", value: totalUnidades },
            { label: "Unidades fora", value: totalFora, color: totalFora > 0 ? Colors.amber : undefined },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "16px", fontWeight: 700, color: s.color || Colors.textPrimary }}>{s.value}</span>
              <span style={{ fontSize: "8px", letterSpacing: "0.2em", color: Colors.textMuted, textTransform: "uppercase" }}>{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", borderBottom: `1px solid ${Colors.borderDim}`, marginBottom: "1.5rem" }}>
          <TabBtn id="fora" label="Fora" count={movimentosAbertos.length} />
          <TabBtn id="historico" label="Histórico" count={movimentosFechados.length} />
          <TabBtn id="catalogo" label="Catálogo" count={materiaisAtivos.length} />
        </div>

        {tab === "fora" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {foraAgrupados.map(group => (
              <div key={group.key} style={{ background: Colors.surface, border: `1px solid ${Colors.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1.1rem", borderBottom: `1px solid ${Colors.borderDim}`, background: "rgba(201,169,110,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "9px", letterSpacing: "0.2em", fontWeight: 700, color: group.isPessoal ? Colors.textSec : Colors.gold, textTransform: "uppercase" }}>
                      {group.isPessoal ? "👤 Pessoal" : `🎪 ${group.label}`}
                    </span>
                    {group.date && <span style={{ fontSize: "9px", color: Colors.textMuted, letterSpacing: "0.1em" }}>{fmtDateShort(group.date)}</span>}
                  </div>
                  <span style={{ fontSize: "9px", color: Colors.textMuted, background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "8px" }}>{group.items.length} {group.items.length === 1 ? "item" : "itens"}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: "0.6rem", padding: "0.85rem" }}>
                  {group.items.map(mov => {
                    const pendente = mov.quantidade - mov.quantidade_devolvida;
                    const dias = diasFora(mov.data_saida);
                    return (
                      <div key={mov.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${Colors.borderDim}`, padding: "0.85rem", display: "flex", gap: "0.75rem" }}>
                        <MaterialThumb src={mov.material_imagem} size={48} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                            <span style={{ fontSize: "12px", fontWeight: 600 }}>{mov.material_nome}</span>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: Colors.amber, whiteSpace: "nowrap" }}>×{pendente}</span>
                          </div>
                          <div style={{ fontSize: "10px", color: Colors.textSec, marginTop: "2px" }}>
                            Com <span style={{ color: Colors.gold }}>{origemLabel(mov)}</span> · {dias === 0 ? "hoje" : dias === 1 ? "há 1 dia" : `há ${dias} dias`}
                          </div>
                          <div style={{ fontSize: "9px", color: Colors.textMuted, marginTop: "2px" }}>Saída: {fmtDateTime(mov.data_saida)} · {mov.responsavel}</div>
                          <div style={{ display: "flex", gap: "6px", marginTop: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                            <button onClick={() => handleVoltou(mov)} style={{ background: "rgba(93,202,165,0.12)", border: "1px solid rgba(93,202,165,0.3)", color: Colors.green, fontSize: "9px", letterSpacing: "0.15em", padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, textTransform: "uppercase" }}>✓ Voltou{pendente > 1 ? " tudo" : ""}</button>
                            {pendente > 1 && (
                              <>
                                <input type="number" min={1} max={pendente} value={voltaQty[mov.id] ?? 1}
                                  onChange={e => setVoltaQty(v => ({ ...v, [mov.id]: Math.max(1, Math.min(pendente, Number(e.target.value) || 1)) }))}
                                  style={{ width: "44px", background: "rgba(255,255,255,0.05)", border: `1px solid ${Colors.border}`, color: Colors.textPrimary, fontSize: "10px", padding: "5px", textAlign: "center", outline: "none"   }} />
                                <button onClick={() => handleVoltou(mov, voltaQty[mov.id] ?? 1)} style={{ ...btnSecStyle, padding: "5px 10px", fontSize: "8px" }}>Parcial</button>
                              </>
                            )}
                            <button onClick={() => handleDeleteMovimento(mov.id)} title="Apagar registo" style={{ marginLeft: "auto", background: "transparent", border: "none", color: Colors.textMuted, cursor: "pointer", fontSize: "13px" }}>×</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {movimentosAbertos.length === 0 && <div style={{ textAlign: "center", padding: "3rem", fontSize: "11px", color: Colors.textMuted, letterSpacing: "0.2em" }}>Nada fora de momento — tudo na loja</div>}
          </div>
        )}

        {tab === "historico" && (
          <div style={{ background: Colors.surface, border: `1px solid ${Colors.borderDim}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Material", "Qtd", "Foi para", "Saiu em", "Voltou em", "Ações"].map((h, i) => (
                    <th key={h} style={{ fontSize: "7px", letterSpacing: "0.3em", color: Colors.goldDim, fontWeight: 600, textTransform: "uppercase", padding: "0.75rem 1rem", borderBottom: `1px solid ${Colors.border}`, textAlign: i === 5 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movimentosFechados.map(mov => (
                  <tr key={mov.id}>
                    <td style={{ fontSize: "11px", padding: "0.7rem 1rem", borderBottom: `1px solid ${Colors.borderDim}`, display: "flex", alignItems: "center", gap: "8px" }}>
                      <MaterialThumb src={mov.material_imagem} size={28} />{mov.material_nome}
                    </td>
                    <td style={{ fontSize: "11px", color: Colors.textSec, padding: "0.7rem 1rem", borderBottom: `1px solid ${Colors.borderDim}` }}>{mov.quantidade}</td>
                    <td style={{ fontSize: "11px", color: Colors.textSec, padding: "0.7rem 1rem", borderBottom: `1px solid ${Colors.borderDim}` }}>{origemLabel(mov)}</td>
                    <td style={{ fontSize: "10px", color: Colors.textMuted, padding: "0.7rem 1rem", borderBottom: `1px solid ${Colors.borderDim}`, whiteSpace: "nowrap" }}>{fmtDateTime(mov.data_saida)}</td>
                    <td style={{ fontSize: "10px", color: Colors.green, padding: "0.7rem 1rem", borderBottom: `1px solid ${Colors.borderDim}`, whiteSpace: "nowrap" }}>{mov.data_volta ? fmtDateTime(mov.data_volta) : "—"}</td>
                    <td style={{ padding: "0.7rem 1rem", borderBottom: `1px solid ${Colors.borderDim}`, textAlign: "right" }}>
                      <button onClick={() => handleDeleteMovimento(mov.id)} title="Apagar" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.06)", color: Colors.textMuted, padding: "4px 7px", cursor: "pointer" }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 4h10M6 4V2.5h4V4M4 4l.5 9.5A1 1 0 005.5 14.5h5A1 1 0 0011.5 13.5L12 4" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {movimentosFechados.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "3rem", fontSize: "11px", color: Colors.textMuted, letterSpacing: "0.2em" }}>Sem histórico ainda</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "catalogo" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "0.85rem" }}>
            {materiaisAtivos.map(m => {
              const fora = pendenteAtualDoMaterial(m.id);
              return (
                <div key={m.id} style={{ background: Colors.surface, border: `1px solid ${Colors.borderDim}`, overflow: "hidden" }}>
                  <div style={{ width: "100%", aspectRatio: "1.3/1", background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {m.imagem
                      ? <img src={m.imagem} alt={m.nome} style={{ width: "100%", height: "100%", objectFit: "cover"   }} />
                      : <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={Colors.textMuted} strokeWidth="1.4"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>}
                  </div>
                  <div style={{ padding: "0.85rem" }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "2px" }}>{m.nome}</div>
                    {m.categoria && <div style={{ fontSize: "9px", color: Colors.gold, letterSpacing: "0.1em", marginBottom: "4px" }}>{m.categoria}</div>}
                    <div style={{ fontSize: "10px", color: Colors.textSec }}>
                      Total: <b style={{ color: Colors.textPrimary }}>{m.quantidade_total}</b>
                      {fora > 0 && <span style={{ color: Colors.amber }}> · {fora} fora</span>}
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "0.6rem" }}>
                      <button onClick={() => openSaida(m.id)} style={{ ...btnSecStyle, flex: 1, padding: "6px 8px", fontSize: "8px" }}>Registar Saída</button>
                      <button onClick={() => openEditMaterial(m)} title="Editar" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.06)", color: Colors.textMuted, padding: "6px 8px", cursor: "pointer" }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 2l3 3-9 9H2v-3L11 2z" /></svg>
                      </button>
                      <button onClick={() => handleToggleMaterialAtivo(m)} title="Arquivar" style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.06)", color: Colors.red, padding: "6px 8px", cursor: "pointer" }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 4h10M6 4V2.5h4V4M4 4l.5 9.5A1 1 0 005.5 14.5h5A1 1 0 0011.5 13.5L12 4" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {materiaisAtivos.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "3rem", fontSize: "11px", color: Colors.textMuted, letterSpacing: "0.2em" }}>Sem material no catálogo — cria o primeiro</div>}
          </div>
        )}
      </main>
    </div>

    {/* ═══ MOBILE ═══ */}
    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: "#F5F0E8", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(12,11,9,0.97)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.2rem", letterSpacing: "0.35em", color: "#C9A96E", fontWeight: 300 }}>LLE</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} style={{ fontSize: "10px", padding: "0.4rem 0.5rem" }} />
          <span style={{ fontSize: "8px", letterSpacing: "0.35em", color: "rgba(245,240,232,0.2)", textTransform: "uppercase" }}>{userName}</span>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <TabBtn id="fora" label="Fora" count={movimentosAbertos.length} />
        <TabBtn id="historico" label="Histórico" count={movimentosFechados.length} />
        <TabBtn id="catalogo" label="Catálogo" count={materiaisAtivos.length} />
      </div>

      {tab === "fora" && (
        <div style={{ display: "flex", gap: "1.25rem", padding: "0.85rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          {[
            { label: "Ativos", value: materiaisAtivos.length },
            { label: "Total", value: totalUnidades },
            { label: "Fora", value: totalFora, color: totalFora > 0 ? "#EF9F27" : undefined },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: s.color || "#F5F0E8" }}>{s.value}</span>
              <span style={{ fontSize: "7px", letterSpacing: "0.15em", color: "rgba(245,240,232,0.3)", textTransform: "uppercase" }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mob-list">
        {tab === "fora" && foraAgrupados.map(group => (
          <div key={group.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.7rem 1.1rem", background: "rgba(201,169,110,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "9px", letterSpacing: "0.15em", fontWeight: 700, color: group.isPessoal ? "rgba(245,240,232,0.45)" : "#C9A96E", textTransform: "uppercase" }}>
                  {group.isPessoal ? "👤 Pessoal" : `🎪 ${group.label}`}
                </span>
                {group.date && <span style={{ fontSize: "9px", color: "rgba(245,240,232,0.25)" }}>{fmtDateShort(group.date)}</span>}
              </div>
              <span style={{ fontSize: "9px", color: "rgba(245,240,232,0.3)", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: "8px" }}>{group.items.length}</span>
            </div>
            {group.items.map(mov => {
              const pendente = mov.quantidade - mov.quantidade_devolvida;
              const dias = diasFora(mov.data_saida);
              return (
                <div key={mov.id} style={{ padding: "0.9rem 1.1rem", borderTop: "1px solid rgba(255,255,255,0.03)", display: "flex", gap: "0.75rem" }}>
                  <MaterialThumb src={mov.material_imagem} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>{mov.material_nome}</span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#EF9F27" }}>×{pendente}</span>
                    </div>
                    <div style={{ fontSize: "10px", color: "rgba(245,240,232,0.45)", marginTop: "2px" }}>
                      Com <span style={{ color: "#C9A96E" }}>{origemLabel(mov)}</span> · {dias === 0 ? "hoje" : `há ${dias}d`}
                    </div>
                    <button onClick={() => handleVoltou(mov)} style={{ marginTop: "0.5rem", background: "rgba(93,202,165,0.12)", border: "1px solid rgba(93,202,165,0.3)", color: "#5DCAA5", fontSize: "10px", letterSpacing: "0.1em", padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, textTransform: "uppercase" }}>✓ Voltou{pendente > 1 ? " tudo" : ""}</button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {tab === "fora" && movimentosAbertos.length === 0 && <div style={{ padding: "3rem 1.5rem", textAlign: "center", fontSize: "11px", color: "rgba(245,240,232,0.2)", letterSpacing: "0.2em" }}>Nada fora — tudo na loja</div>}

        {tab === "historico" && movimentosFechados.map(mov => (
          <div key={mov.id} style={{ padding: "0.9rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: "0.75rem" }}>
            <MaterialThumb src={mov.material_imagem} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 600 }}>{mov.material_nome} <span style={{ color: "rgba(245,240,232,0.4)", fontWeight: 400 }}>×{mov.quantidade}</span></div>
              <div style={{ fontSize: "10px", color: "rgba(245,240,232,0.45)" }}>Com {origemLabel(mov)}</div>
              <div style={{ fontSize: "9px", color: "rgba(245,240,232,0.25)" }}>{fmtDateTime(mov.data_saida)} → {mov.data_volta ? fmtDateTime(mov.data_volta) : "—"}</div>
            </div>
          </div>
        ))}
        {tab === "historico" && movimentosFechados.length === 0 && <div style={{ padding: "3rem 1.5rem", textAlign: "center", fontSize: "11px", color: "rgba(245,240,232,0.2)", letterSpacing: "0.2em" }}>Sem histórico</div>}

        {tab === "catalogo" && materiaisAtivos.map(m => {
          const fora = pendenteAtualDoMaterial(m.id);
          return (
            <div key={m.id} style={{ padding: "0.9rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <MaterialThumb src={m.imagem} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: 600 }}>{m.nome}</div>
                <div style={{ fontSize: "10px", color: "rgba(245,240,232,0.45)" }}>Total {m.quantidade_total}{fora > 0 && <span style={{ color: "#EF9F27" }}> · {fora} fora</span>}</div>
              </div>
              <button onClick={() => openSaida(m.id)} style={{ background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.25)", color: "#C9A96E", fontSize: "9px", padding: "6px 10px", cursor: "pointer", fontFamily: "inherit" }}>Saída</button>
              <button onClick={() => openEditMaterial(m)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(245,240,232,0.5)", fontSize: "10px", padding: "6px 8px", cursor: "pointer" }}>✏️</button>
            </div>
          );
        })}
        {tab === "catalogo" && materiaisAtivos.length === 0 && <div style={{ padding: "3rem 1.5rem", textAlign: "center", fontSize: "11px", color: "rgba(245,240,232,0.2)", letterSpacing: "0.2em" }}>Sem material — cria o primeiro</div>}
      </div>

      {/* FABs mobile */}
      <div style={{ position: "fixed", bottom: "calc(74px + env(safe-area-inset-bottom))", right: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem", zIndex: 50 }}>
        {tab === "catalogo" && (
          <button onClick={openCreateMaterial} style={{ background: "#131108", border: "1px solid rgba(201,169,110,0.3)", color: "#C9A96E", width: "44px", height: "44px", borderRadius: "50%", fontSize: "20px", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>+</button>
        )}
        <button onClick={() => openSaida()} style={{ background: "#C9A96E", border: "none", color: "#0C0B09", width: "50px", height: "50px", borderRadius: "50%", fontSize: "22px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>↗</button>
      </div>

      <MobTabBar active="materiais" role={userRole} />
    </div>

    {/* ── Modal: Nova Saída ── */}
    {saidaModal && (
      <>
        <div className="mob-page-desktop" onClick={e => e.target === e.currentTarget && closeSaida()} style={overlayStyle}>
          <div style={modalStyle}><div style={topLineStyle} />
            <SaidaModalContent {...{ materiais: materiaisAtivos, eventos, saidaForm, setSaidaForm, saving, closeSaida, handleRegistarSaida, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C, MaterialThumb   }} />
          </div>
        </div>
        <div className="mob-shell" onClick={e => e.target === e.currentTarget && closeSaida()} style={overlayBottomStyle}>
          <div style={modalMobStyle}><div style={topLineStyle} />
            <SaidaModalContent {...{ materiais: materiaisAtivos, eventos, saidaForm, setSaidaForm, saving, closeSaida, handleRegistarSaida, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C, MaterialThumb   }} />
          </div>
        </div>
      </>
    )}

    {/* ── Modal: Novo/Editar Material ── */}
    {materialModal.open && (
      <>
        <div className="mob-page-desktop" onClick={e => e.target === e.currentTarget && closeMaterialModal()} style={overlayStyle}>
          <div style={modalStyle}><div style={topLineStyle} />
            <MaterialModalContent {...{ materialForm, setMaterialForm, materialModal, saving, imgUploading, closeMaterialModal, handleSaveMaterial, handleImageUpload, fileInputRef, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C   }} />
          </div>
        </div>
        <div className="mob-shell" onClick={e => e.target === e.currentTarget && closeMaterialModal()} style={overlayBottomStyle}>
          <div style={modalMobStyle}><div style={topLineStyle} />
            <MaterialModalContent {...{ materialForm, setMaterialForm, materialModal, saving, imgUploading, closeMaterialModal, handleSaveMaterial, handleImageUpload, fileInputRef, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C   }} />
          </div>
        </div>
      </>
    )}

    <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: "#1a1408", border: `1px solid ${Colors.border}`, color: Colors.gold, fontSize: "10px", letterSpacing: "0.25em", padding: "1rem 1.5rem", zIndex: 2000, transform: toast ? "translateX(0)" : "translateX(200%)", transition: "transform 0.3s ease", textTransform: "uppercase", fontWeight: 600 }}>
      {toast}
    </div>
    </>
  );
}

function SaidaModalContent({ materiais, eventos, saidaForm, setSaidaForm, saving, closeSaida, handleRegistarSaida, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C, MaterialThumb }: any) {
  const selected = materiais.find((m: Material) => m.id === saidaForm.material_id);
  return (
    <>
      <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: Colors.goldDim, textTransform: "uppercase", fontWeight: 600, marginBottom: "1.5rem" }}>Registar Saída</p>

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Material *</label>
        <select style={{ ...inputStyle, cursor: "pointer" }} value={saidaForm.material_id} onChange={(e: any) => setSaidaForm((f: any) => ({ ...f, material_id: Number(e.target.value) }))}>
          <option value={0}>Selecionar material...</option>
          {materiais.map((m: Material) => <option key={m.id} value={m.id}>{m.nome}{m.categoria ? ` · ${m.categoria}` : ""}</option>)}
        </select>
      </div>

      {selected && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem", padding: "0.6rem", background: "rgba(255,255,255,0.02)", border: `1px solid ${Colors.borderDim}` }}>
          <MaterialThumb src={selected.imagem} size={36} />
          <span style={{ fontSize: "10px", color: Colors.textSec }}>Total no catálogo: <b style={{ color: Colors.textPrimary }}>{selected.quantidade_total}</b></span>
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Quantidade *</label>
        <input type="number" min={1} style={inputStyle} value={saidaForm.quantidade} onChange={(e: any) => setSaidaForm((f: any) => ({ ...f, quantidade: Math.max(1, Number(e.target.value) || 1) }))} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>De onde é / Para onde vai *</label>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {ORIGENS.map((o: string) => (
            <button key={o} onClick={() => setSaidaForm((f: any) => ({ ...f, origem: o }))} style={{
              background: saidaForm.origem === o ? "rgba(201,169,110,0.18)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${saidaForm.origem === o ? "rgba(201,169,110,0.4)" : "rgba(255,255,255,0.1)"}`,
              color: saidaForm.origem === o ? Colors.gold : Colors.textMuted,
              fontSize: "10px", padding: "8px 14px", cursor: "pointer", fontFamily: "inherit",
            }}>{o}</button>
          ))}
        </div>
        {saidaForm.origem === "Outro" && (
          <input style={{ ...inputStyle, marginTop: "0.5rem" }} placeholder="Especificar..." value={saidaForm.origem_detalhe} onChange={(e: any) => setSaidaForm((f: any) => ({ ...f, origem_detalhe: e.target.value }))} />
        )}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Para evento ou pessoal?</label>
        <select style={{ ...inputStyle, cursor: "pointer" }} value={saidaForm.evento_sel} onChange={(e: any) => setSaidaForm((f: any) => ({ ...f, evento_sel: e.target.value }))}>
          <option value="pessoal">👤 Pessoal (sem evento)</option>
          {eventos.map((ev: EventoOpcao) => (
            <option key={ev.id} value={String(ev.id)}>{ev.date ? `${fmtDateShort(ev.date)} · ` : ""}{ev.title}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <label style={labelStyle}>Notas</label>
        <textarea style={{ ...inputStyle, height: "60px", resize: "vertical" as any }} value={saidaForm.notas} onChange={(e: any) => setSaidaForm((f: any) => ({ ...f, notas: e.target.value }))} />
      </div>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button onClick={closeSaida} style={{ ...btnSecStyle, flex: 1 }}>Cancelar</button>
        <button onClick={handleRegistarSaida} disabled={saving || !saidaForm.material_id} style={{ ...btnPrimStyle, flex: 2, opacity: !saidaForm.material_id ? 0.5 : 1 }}>{saving ? "A registar..." : "Registar Saída"}</button>
      </div>
    </>
  );
}

function MaterialModalContent({ materialForm, setMaterialForm, materialModal, saving, imgUploading, closeMaterialModal, handleSaveMaterial, handleImageUpload, fileInputRef, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C }: any) {
  return (
    <>
      <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: Colors.goldDim, textTransform: "uppercase", fontWeight: 600, marginBottom: "1.5rem" }}>
        {materialModal.editing ? "Editar Material" : "Novo Material"}
      </p>

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Foto</label>
        <div onClick={() => fileInputRef.current?.click()} style={{
          width: "100%", height: "140px", background: "rgba(255,255,255,0.03)", border: `1px dashed ${Colors.border}`,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden",
        }}>
          {imgUploading
            ? <span style={{ fontSize: "10px", color: Colors.textMuted, letterSpacing: "0.2em" }}>A processar...</span>
            : materialForm.imagem
              ? <img src={materialForm.imagem} alt="" style={{ width: "100%", height: "100%", objectFit: "cover"   }} />
              : <div style={{ textAlign: "center" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={Colors.textMuted} strokeWidth="1.4" style={{ marginBottom: "6px" }}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                  <div style={{ fontSize: "9px", color: Colors.textMuted, letterSpacing: "0.15em" }}>Toca para adicionar foto</div>
                </div>}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
          onChange={(e: any) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f);   }} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Nome *</label>
        <input style={inputStyle} value={materialForm.nome} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Coluna JBL, Microfone SM58..." />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <label style={labelStyle}>Categoria</label>
          <select style={{ ...inputStyle, cursor: "pointer" }} value={materialForm.categoria} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, categoria: e.target.value }))}>
            <option value="">Sem categoria</option>
            {CATEGORIAS.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Quantidade total</label>
          <input type="number" min={1} style={inputStyle} value={materialForm.quantidade_total} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, quantidade_total: Math.max(1, Number(e.target.value) || 1) }))} />
        </div>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <label style={labelStyle}>Notas</label>
        <textarea style={{ ...inputStyle, height: "60px", resize: "vertical" as any }} value={materialForm.notas} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, notas: e.target.value }))} />
      </div>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button onClick={closeMaterialModal} style={{ ...btnSecStyle, flex: 1 }}>Cancelar</button>
        <button onClick={handleSaveMaterial} disabled={saving} style={{ ...btnPrimStyle, flex: 2 }}>{saving ? "A guardar..." : materialModal.editing ? "Guardar" : "Criar"}</button>
      </div>
    </>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

function Nav({ userName, active, onLogout }: { userName: string; active: string; onLogout: () => void }) {
  const stored = typeof window !== "undefined" ? localStorage.getItem("lle_user") : null;
  const role = stored ? JSON.parse(stored).role : "admin";
  const allLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/agenda", label: "Agenda" },
    { href: "/leads", label: "Leads" },
    { href: "/faturacao", label: "Faturação" },
    { href: "/pagamentos", label: "Pagamentos" },
    { href: "/colaboradores", label: "Colaboradores" },
    { href: "/clientes", label: "Clientes" },
    { href: "/materiais", label: "Materiais" },
  ];
  const adminOnlyHrefs = ["/dashboard", "/faturacao", "/pagamentos", "/colaboradores", "/clientes"];
  const novaluesBlockedHrefs = ["/materiais"];
  const links = allLinks.filter(l => {
    if (adminOnlyHrefs.includes(l.href) && role !== "admin") return false;
    if (novaluesBlockedHrefs.includes(l.href) && role === "limited_novalues") return false;
    return true;
  });
  return (
    <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 2.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", position: "sticky", top: 0, zIndex: 100, background: "rgba(12,11,9,0.95)", backdropFilter: "blur(12px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.3rem", letterSpacing: "0.35em", color: "#C9A96E", fontWeight: 300 }}>LLE</span>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {links.map(l => (
            <a key={l.href} href={l.href} style={{ fontSize: "9px", letterSpacing: "0.3em", padding: "0.5rem 1rem", textTransform: "uppercase", fontWeight: 500, color: active === l.href.slice(1) ? "#C9A96E" : "rgba(245,240,232,0.45)", textDecoration: "none", fontFamily: "'Montserrat','Helvetica Neue',sans-serif" }}>{l.label}</a>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontSize: "9px", letterSpacing: "0.3em", color: "rgba(245,240,232,0.22)", textTransform: "uppercase" }}>{userName}</span>
        <button onClick={onLogout} style={{ background: "transparent", border: "1px solid rgba(201,169,110,0.12)", color: "rgba(245,240,232,0.22)", fontSize: "8px", letterSpacing: "0.4em", padding: "0.5rem 1rem", cursor: "pointer", textTransform: "uppercase", fontFamily: "inherit", fontWeight: 600 }}>SAIR</button>
      </div>
    </nav>
  );
}

// ── Mobile Tab Bar — 4 fixos + "Mais" drawer ───────────────────────────────
function MobTabBar({ active, role }: { active: string; role: string }) {
  const [maisOpen, setMaisOpen] = useState(false);

  const mainTabs = [
    { href: "/agenda", label: "Agenda", id: "agenda", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    )},
    { href: "/leads", label: "Leads", id: "leads", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    )},
    { href: "/materiais", label: "Materiais", id: "materiais", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a4 4 0 018 0v2"/>
      </svg>
    )},
    { href: "/colaboradores", label: "Equipa", id: "colaboradores", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="9" cy="7" r="3"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><circle cx="18" cy="8" r="2.5"/><path d="M17 20c0-2 1.3-3.5 3-3.5"/>
      </svg>
    )},
  ];

  const maisTabs = role === "admin" ? [
    { href: "/clientes", label: "Clientes", id: "clientes", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="9" cy="7" r="3"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/>
        <line x1="16" y1="11" x2="22" y2="11"/><line x1="19" y1="8" x2="19" y2="14"/>
      </svg>
    )},
    { href: "/faturacao", label: "Faturação", id: "faturacao", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
      </svg>
    )},
    { href: "/pagamentos", label: "Pagamentos", id: "pagamentos", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="6" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="7" cy="15" r="1" fill="currentColor"/>
      </svg>
    )},
    { href: "/dashboard", label: "Dashboard", id: "dashboard", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    )},
  ] : [];

  const activeInMais = maisTabs.some(t => t.id === active);

  return (
    <>
      {maisOpen && (
        <div onClick={() => setMaisOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 199, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)"   }} />
      )}

      <div style={{
        position: "fixed", bottom: "calc(60px + env(safe-area-inset-bottom))", left: 0, right: 0,
        zIndex: 200, transform: maisOpen ? "translateY(0)" : "translateY(110%)",
        transition: "transform 0.25s cubic-bezier(0.32,0.72,0,1)",
        background: "#131108", borderTop: "1px solid rgba(201,169,110,0.15)",
        borderRadius: "16px 16px 0 0", padding: "0.75rem 0.5rem",
        paddingBottom: "0.5rem",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
      }}>
        <div style={{ width: "36px", height: "3px", background: "rgba(201,169,110,0.25)", borderRadius: "2px", margin: "0 auto 0.75rem"   }} />
        <p style={{ fontSize: "7px", letterSpacing: "0.4em", color: "rgba(201,169,110,0.4)", textTransform: "uppercase", textAlign: "center", marginBottom: "0.5rem", fontFamily: "'Montserrat',sans-serif" }}>Mais páginas</p>
        <div style={{ display: "flex", justifyContent: "space-around", padding: "0 0.5rem" }}>
          {maisTabs.map(t => (
            <a key={t.href} href={t.href} onClick={() => setMaisOpen(false)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                textDecoration: "none", padding: "0.6rem 1rem", minWidth: "72px",
                color: active === t.id ? "#C9A96E" : "rgba(245,240,232,0.4)",
                background: active === t.id ? "rgba(201,169,110,0.08)" : "transparent",
                borderRadius: "10px",
              }}>
              <span style={{ width: "22px", height: "22px", display: "block" }}>{t.icon}</span>
              <span style={{ fontSize: "9px", letterSpacing: "0.1em", fontFamily: "'Montserrat',sans-serif", fontWeight: active === t.id ? 600 : 400 }}>{t.label}</span>
            </a>
          ))}
        </div>
      </div>

      <nav className="mob-tabbar">
        {mainTabs.map(l => (
          <a key={l.href} href={l.href} className={`mob-tab${active === l.id ? " active" : ""}`}>
            <span className="mob-tab-icon">{l.icon}</span>
            <span className="mob-tab-label">{l.label}</span>
          </a>
        ))}
        {role === "admin" && (
          <button
            onClick={() => setMaisOpen(v => !v)}
            className={`mob-tab${activeInMais ? " active" : ""}`}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <span className="mob-tab-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                {maisOpen
                  ? <path d="M18 15l-6-6-6 6"/>
                  : <><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/></>
                }
              </svg>
            </span>
            <span className="mob-tab-label">{maisOpen ? "Fechar" : "Mais"}</span>
          </button>
        )}
      </nav>
    </>
  );
}
