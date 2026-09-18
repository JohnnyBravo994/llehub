"use client";

import MobTabBar from "../MobTabBar";
import DesktopNav from "../DesktopNav";

import { useTheme } from "../useTheme";
import { ThemeSwitcher } from "../ThemeSwitcher";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getAllColaboradores, createColaborador, updateColaborador,
  toggleColaboradorAtivo, setupColaboradores, getArtistasPorAssociar,
  associarArtistaNomeAColaborador, criarColaboradorEAssociarArtista, ignorarArtistaPorAssociar,
  deleteColaborador, mergeColaboradores,
} from "../actions";
import { COLABORADOR_SKILLS, normalizeColaboradorSkills } from "../constants";

interface SkillProfile {
  valor: number; // legado
  custo_interno: number; // alias legado de custo_evento
  custo_evento: number;
  valor_sud: number;
  valor_evento_residencia: number;
  valor_parceria: number;
  valor_cliente_final: number;
  rating: number;
}

type PriceKey = "custo_evento" | "valor_sud" | "valor_evento_residencia" | "valor_parceria" | "valor_cliente_final";
type ArtistSort = "rating" | "abc" | PriceKey;

const PRICE_FIELDS: { key: PriceKey; label: string; short: string; kind: "cost" | "billing" }[] = [
  { key: "custo_evento", label: "Custo Evento", short: "Custo Evento", kind: "cost" },
  { key: "valor_sud", label: "Faturação SUD", short: "Fat. SUD", kind: "billing" },
  { key: "valor_evento_residencia", label: "Faturação Evento Residência", short: "Fat. Evento Resid.", kind: "billing" },
  { key: "valor_parceria", label: "Faturação Parceria", short: "Fat. Parceria", kind: "billing" },
  { key: "valor_cliente_final", label: "Faturação Cliente Final", short: "Fat. Cliente Final", kind: "billing" },
];

const emptySkillProfileForm = () => ({
  custo_evento: "", valor_sud: "",
  valor_evento_residencia: "", valor_parceria: "", valor_cliente_final: "", rating: 0,
});

const emptySkillProfile: SkillProfile = {
  valor: 0, custo_interno: 0, custo_evento: 0,
  valor_sud: 0, valor_evento_residencia: 0,
  valor_parceria: 0, valor_cliente_final: 0, rating: 0,
};

function formatEuro(value: number) {
  const n = Number(value || 0);
  return n > 0 ? `${n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €` : "—";
}

interface Colaborador {
  id: number; nome: string; nome_artistico?: string; nome_pessoal?: string;
  contacto: string; email: string; iban: string; skills: string; notas: string; ativo: number;
  restricoes_alimentares: string; tamanho_cima: string; tamanho_baixo: string; calcado: string;
  skill_profiles: Record<string, SkillProfile>;
}

interface ArtistaPorAssociar {
  nome: string; tipos: string; total: number; primeira_data: string; ultima_data: string; fee_medio: number;
}

const C = {
  gold: "var(--theme-accent)", goldDim: "var(--theme-accent-muted)", surface: "var(--theme-surface)", pageBg: "var(--theme-bg)",
  border: "rgba(var(--theme-accent-rgb),0.12)", borderDim: "rgba(var(--theme-contrast-rgb),0.05)",
  textPrimary: "var(--theme-text)", textSec: "var(--theme-text-muted)", textMuted: "var(--theme-text-faint)",
  green: "var(--theme-success)", amber: "var(--theme-warning)", blue: "var(--theme-info)", red: "var(--theme-danger)",
};

const C_Light = {
  gold: "#8B4513", goldDim: "#6F3A18", surface: "#FFFFFF", pageBg: "#FFFBF7",
  border: "rgba(0,0,0,0.15)", borderDim: "rgba(0,0,0,0.12)",
  textPrimary: "#111827", textSec: "rgba(17,24,39,0.82)", textMuted: "rgba(17,24,39,0.62)",
  green: "#2E7D32", amber: "#A65300", blue: "#1565C0", red: "#C62828", purple: "#6A1B9A",
};

const getColors = (lightTheme: boolean) => lightTheme ? C_Light : C;


const ALL_SKILLS = [...COLABORADOR_SKILLS].sort((a, b) => a.localeCompare(b, "pt-PT", { sensitivity: "base" }));

const emptyForm = {
  nome: "", nome_pessoal: "", contacto: "", email: "", iban: "", skills: [] as string[], notas: "", ativo: 1,
  restricoes_alimentares: "", tamanho_cima: "", tamanho_baixo: "", calcado: "",
  skill_profiles: {} as Record<string, ReturnType<typeof emptySkillProfileForm>>,
};

function skillsToString(skills: string[]): string {
  return skills.join(", ");
}
function stringToSkills(s: string): string[] {
  if (!s) return [];
  return normalizeColaboradorSkills(s.split(",").map(x => x.trim()).filter(Boolean));
}

export default function ColaboradoresPage() {
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const C = getColors(lightTheme);
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [artistasPorAssociar, setArtistasPorAssociar] = useState<ArtistaPorAssociar[]>([]);
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSkill, setFilterSkill] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; editing: Colaborador | null }>({ open: false, editing: null });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [profileColab, setProfileColab] = useState<Colaborador | null>(null);
  const [sortBy, setSortBy] = useState<ArtistSort>("rating");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [merging, setMerging] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const load = useCallback(async () => {
    await setupColaboradores();
    const r = await getAllColaboradores();
    if (r.success) setColaboradores(r.data as Colaborador[]);
    const pending = await getArtistasPorAssociar();
    if (pending.success) setArtistasPorAssociar(pending.data as ArtistaPorAssociar[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("lle_user");
    if (!u) { router.push("/"); return; }
    const parsed = JSON.parse(u);
    if (parsed.role !== "admin") { router.push("/agenda"); return; }
    setUserName(parsed.name);
    load();
  }, [load]);

  const openCreate = () => {
    setForm(emptyForm);
    setModal({ open: true, editing: null });
  };

  const openEdit = (c: Colaborador) => {
    setForm({
      nome: c.nome_artistico || c.nome, nome_pessoal: c.nome_pessoal || "",
      contacto: c.contacto, email: c.email, iban: c.iban,
      skills: stringToSkills(c.skills), notas: c.notas, ativo: c.ativo,
      restricoes_alimentares: c.restricoes_alimentares || "", tamanho_cima: c.tamanho_cima || "",
      tamanho_baixo: c.tamanho_baixo || "", calcado: c.calcado || "",
      skill_profiles: Object.fromEntries(stringToSkills(c.skills).map(skill => {
        const p = c.skill_profiles?.[skill] || emptySkillProfile;
        return [skill, {
          custo_evento: p.custo_evento ? String(p.custo_evento) : (p.custo_interno ? String(p.custo_interno) : ""),
          valor_sud: p.valor_sud ? String(p.valor_sud) : "",
          valor_evento_residencia: p.valor_evento_residencia ? String(p.valor_evento_residencia) : "",
          valor_parceria: p.valor_parceria ? String(p.valor_parceria) : "",
          valor_cliente_final: p.valor_cliente_final ? String(p.valor_cliente_final) : "",
          rating: p.rating || 0,
        }];
      })),
    });
    setModal({ open: true, editing: c });
  };

  const closeModal = () => setModal({ open: false, editing: null });
  const openProfile = (c: Colaborador) => setProfileColab(c);
  const closeProfile = () => setProfileColab(null);
  const editFromProfile = (c: Colaborador) => { setProfileColab(null); openEdit(c); };

  const handleSave = async () => {
    if (!form.nome.trim()) { showToast("Nome é obrigatório"); return; }
    setSaving(true);
    const payload = { ...form, nome_artistico: form.nome.trim(), skills: skillsToString(form.skills) };
    if (modal.editing) {
      await updateColaborador(modal.editing.id, payload);
      showToast("Colaborador actualizado");
    } else {
      await createColaborador(payload);
      showToast("Colaborador criado");
    }
    closeModal();
    load();
    setSaving(false);
  };

  const handleToggleAtivo = async (c: Colaborador) => {
    const novo = c.ativo === 1 ? 0 : 1;
    const nome = c.nome_artistico || c.nome;
    if (novo === 0) {
      const ok = window.confirm(`Desativar ${nome}?\n\nNão apaga o colaborador nem o histórico. Podes reativá-lo em "Mostrar inativos".`);
      if (!ok) return;
    }
    await toggleColaboradorAtivo(c.id, novo);
    showToast(novo === 1 ? `${nome} reativado` : `${nome} desativado — não foi apagado`);
    load();
  };


  const handleDeleteColaborador = async (c: Colaborador) => {
    const nome = c.nome_artistico || c.nome;
    const ok = window.confirm(`Retirar definitivamente ${nome} da base de colaboradores?\n\nSó é permitido se não tiver histórico associado. Se for um duplicado, usa "Ligar colaboradores" para preservar Agenda e Residências.`);
    if (!ok) return;
    const res = await deleteColaborador(c.id);
    if (res.success) {
      setProfileColab(null);
      showToast(`${nome} retirado`);
      await load();
      return;
    }
    if ((res as any).blocked) {
      window.alert((res as any).message || "Este colaborador tem histórico associado e não pode ser eliminado diretamente.");
    } else {
      showToast((res as any).message || "Erro ao retirar colaborador");
    }
  };

  const openMerge = (source?: Colaborador) => {
    setMergeSourceId(source ? String(source.id) : "");
    setMergeTargetId("");
    setMergeOpen(true);
  };

  const handleMergeColaboradores = async () => {
    const sourceId = Number(mergeSourceId || 0);
    const targetId = Number(mergeTargetId || 0);
    if (!sourceId || !targetId || sourceId === targetId) { showToast("Escolhe dois colaboradores diferentes"); return; }
    const source = colaboradores.find(c => c.id === sourceId);
    const target = colaboradores.find(c => c.id === targetId);
    if (!source || !target) { showToast("Colaborador não encontrado"); return; }
    const ok = window.confirm(`Ligar/fundir colaboradores?\n\nFICA: ${target.nome_artistico || target.nome}\nÉ FUNDIDO E RETIRADO: ${source.nome_artistico || source.nome}\n\nAgenda, Leads/Histórico e Residências associados ao duplicado passam para o colaborador que fica. Os dados do que fica têm prioridade; campos vazios são preenchidos pelo duplicado.`);
    if (!ok) return;
    setMerging(true);
    const res = await mergeColaboradores(sourceId, targetId);
    setMerging(false);
    if (res.success) {
      setMergeOpen(false);
      setProfileColab(null);
      setMergeSourceId("");
      setMergeTargetId("");
      showToast(`Colaboradores ligados · ${(res as any).movedEvents || 0} registos históricos movidos`);
      await load();
    } else {
      showToast((res as any).message || "Erro ao ligar colaboradores");
    }
  };


  const handleAssociarNome = async (nome: string) => {
    const colaboradorId = Number(linkDrafts[nome] || 0);
    if (!colaboradorId) { showToast("Escolhe um colaborador"); return; }
    const res = await associarArtistaNomeAColaborador(nome, colaboradorId);
    showToast(res.success ? `${res.updated || 0} registos associados` : "Erro ao associar");
    await load();
  };

  const handleCriarEAssociar = async (item: ArtistaPorAssociar) => {
    const skill = (item.tipos || "").split(",")[0]?.trim() || "";
    const res = await criarColaboradorEAssociarArtista(item.nome, skill);
    showToast(res.success ? `Colaborador criado e ${res.updated || 0} registos associados` : "Erro ao criar/associar");
    await load();
  };

  const handleIgnorarPorAssociar = async (nome: string) => {
    const res = await ignorarArtistaPorAssociar(nome);
    showToast(res.success ? "Nome ocultado da lista" : "Erro ao ocultar nome");
    await load();
  };

  const toggleSkill = (skill: string) => {
    setForm(f => {
      const exists = f.skills.includes(skill);
      const profiles = { ...f.skill_profiles };
      if (exists) delete profiles[skill];
      else profiles[skill] = profiles[skill] || emptySkillProfileForm();
      return {
        ...f,
        skills: exists ? f.skills.filter(s => s !== skill) : [...f.skills, skill],
        skill_profiles: profiles,
      };
    });
  };

  const setSkillProfile = (skill: string, patch: Partial<ReturnType<typeof emptySkillProfileForm>>) => {
    setForm(f => ({
      ...f,
      skill_profiles: {
        ...f.skill_profiles,
        [skill]: { ...(f.skill_profiles[skill] || emptySkillProfileForm()), ...patch },
      },
    }));
  };

  const filtered = colaboradores.filter(c => {
    if (!showInactive && c.ativo === 0) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${c.nome} ${c.nome_artistico || ""} ${c.nome_pessoal || ""} ${c.email || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filterSkill && !stringToSkills(c.skills).includes(filterSkill)) return false;
    return true;
  });

  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)",
  };
  const overlayBottomStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1000,
    display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)",
  };
  const modalStyle: React.CSSProperties = {
    background: "var(--theme-surface)", border: `1px solid ${C.border}`,
    padding: "2.5rem", width: "600px", maxWidth: "96vw", maxHeight: "92vh",
    overflowY: "auto", position: "relative",
  };
  const modalMobStyle: React.CSSProperties = {
    background: "var(--theme-surface)", borderTop: `1px solid ${C.border}`,
    width: "100%", maxHeight: "92dvh", overflowY: "auto",
    padding: "1.5rem 1.25rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
    borderRadius: "12px 12px 0 0", position: "relative",
  };
  const topLineStyle: React.CSSProperties = {
    position: "absolute", top: 0, left: 0, right: 0, height: "1px",
    background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "9px", letterSpacing: "0.4em",
    color: C.textMuted, textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--theme-input-bg)", border: `1px solid var(--theme-input-border)`,
    color: C.textPrimary, fontFamily: "'Montserrat',sans-serif", fontSize: "13px",
    padding: "0.75rem 1rem", letterSpacing: "0.05em", outline: "none", boxSizing: "border-box",
  };
  const btnPrimStyle: React.CSSProperties = {
    background: C.gold, border: "none", color: "var(--theme-accent-contrast)",
    fontSize: "11px", letterSpacing: "0.4em", fontWeight: 700,
    padding: "0.75rem 1.75rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase",
  };
  const btnSecStyle: React.CSSProperties = {
    background: "transparent", border: `1px solid ${C.border}`, color: C.textSec,
    fontSize: "11px", letterSpacing: "0.4em", fontWeight: 600,
    padding: "0.75rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase",
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.pageBg }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "3rem", letterSpacing: "0.4em", color: C.gold, fontWeight: 300 }}>LLE</span>
      </div>
    );
  }

  return (
    <>
    {/* ═══ DESKTOP ═══ */}
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: C.pageBg, color: C.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease", overflowX: "hidden" }}>
      <DesktopNav userName={userName} active="colaboradores" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/"); }} />
      <main style={{ padding: "2.75rem 3.25rem", maxWidth: "1500px", width: "100%", boxSizing: "border-box", margin: "0 auto", overflowX: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", gap: "1rem" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.4em", color: C.textSec, textTransform: "uppercase", fontWeight: 600 }}>Colaboradores</p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
            <button onClick={() => openMerge()} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSec, fontSize: "10px", letterSpacing: "0.18em", padding: "0.65rem 1rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600 }}>Ligar colaboradores</button>
            <button onClick={openCreate} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.gold, fontSize: "11px", letterSpacing: "0.3em", padding: "0.65rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <svg width="10" height="10" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
              Novo Colaborador
            </button>
          </div>
        </div>

        {artistasPorAssociar.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, position: "relative", marginBottom: "1rem", padding: "1rem" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: lightTheme ? "rgba(0,0,0,0.2)" : "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", marginBottom: "0.9rem" }}>
              <div>
                <p style={{ fontSize: "10px", letterSpacing: "0.35em", color: C.goldDim, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.35rem" }}>Nomes por associar</p>
                <p style={{ fontSize: "13px", color: C.textMuted, letterSpacing: "0.04em" }}>Registos antigos da Agenda/Leads continuam intactos. Aqui só ligas o texto antigo ao colaborador certo.</p>
              </div>
              <span style={{ fontSize: "18px", fontWeight: 700, color: C.textPrimary }}>{artistasPorAssociar.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 90px 1.2fr 95px 120px 90px", gap: "8px", alignItems: "center" }}>
              {artistasPorAssociar.slice(0, 12).map(item => (
                <div key={item.nome} style={{ display: "contents" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: C.textPrimary }}>{item.nome}</div>
                  <div style={{ fontSize: "12px", color: C.textSec }}>{item.tipos || "Sem função"}</div>
                  <div style={{ fontSize: "12px", color: C.textMuted }}>{item.total} reg.</div>
                  <select
                    value={linkDrafts[item.nome] || ""}
                    onChange={e => setLinkDrafts(prev => ({ ...prev, [item.nome]: e.target.value }))}
                    style={{ ...inputStyle, padding: "0.48rem 0.6rem" }}
                  >
                    <option value="">Associar a...</option>
                    {colaboradores.filter(c => c.ativo === 1).map(c => <option key={c.id} value={c.id}>{c.nome_artistico || c.nome}{c.nome_pessoal ? ` — ${c.nome_pessoal}` : ""}</option>)}
                  </select>
                  <button onClick={() => handleAssociarNome(item.nome)} style={{ ...btnSecStyle, padding: "0.55rem 0.65rem", fontSize: "10px" }}>Associar</button>
                  <button onClick={() => handleCriarEAssociar(item)} style={{ ...btnPrimStyle, padding: "0.55rem 0.65rem", fontSize: "10px" }}>Criar + ligar</button>
                  <button onClick={() => handleIgnorarPorAssociar(item.nome)} title="Ocultar da lista sem apagar registos" style={{ ...btnSecStyle, padding: "0.55rem 0.65rem", fontSize: "10px", letterSpacing: "0.18em" }}>Dismiss</button>
                </div>
              ))}
            </div>
            {artistasPorAssociar.length > 12 && <div style={{ marginTop: "0.75rem", fontSize: "11px", color: C.textMuted }}>A mostrar 12 de {artistasPorAssociar.length}. Vai associando para aparecerem os restantes.</div>}
          </div>
        )}

        {/* Filters */}
        <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, position: "relative", marginBottom: "0", overflow: "hidden", minWidth: 0 }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" }} />
          <div style={{ display: "flex", gap: 0, flexWrap: "wrap", borderBottom: `1px solid ${C.borderDim}` }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por nome..."
              style={{ flex: 1, background: "var(--theme-subtle-bg)", border: "none", borderRight: `1px solid ${C.borderDim}`, color: C.textPrimary, fontFamily: "inherit", fontSize: "13px", padding: "0.9rem 1.5rem", letterSpacing: "0.05em", outline: "none" }}
            />
            <select
              value={filterSkill} onChange={e => setFilterSkill(e.target.value)}
              style={{ background: filterSkill ? "var(--theme-dropdown-selected)" : "var(--theme-input-bg)", border: "none", borderRight: `1px solid ${C.borderDim}`, color: filterSkill ? C.gold : C.textMuted, fontFamily: "inherit", fontSize: "10px", letterSpacing: "0.25em", padding: "0.9rem 1.25rem", outline: "none", cursor: "pointer", appearance: "none" as any, minWidth: "150px", flex: "0 1 190px", textTransform: "uppercase" }}
            >
              <option value="">Função / Skill</option>
              {ALL_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={ratingFilter} onChange={e => setRatingFilter(Number(e.target.value) || 0)}
              style={{ background: ratingFilter ? "var(--theme-dropdown-selected)" : "var(--theme-input-bg)", border: "none", borderRight: `1px solid ${C.borderDim}`, color: ratingFilter ? C.gold : C.textMuted, fontFamily: "inherit", fontSize: "10px", letterSpacing: "0.18em", padding: "0.9rem 1rem", outline: "none", cursor: "pointer", minWidth: "120px", flex: "0 1 160px", textTransform: "uppercase" }}
            >
              <option value={0}>Estrelas</option>
              <option value={5}>5 estrelas</option>
              <option value={4}>4+ estrelas</option>
              <option value={3}>3+ estrelas</option>
              <option value={2}>2+ estrelas</option>
              <option value={1}>1+ estrela</option>
            </select>
            <select
              value={sortBy} onChange={e => setSortBy(e.target.value as ArtistSort)}
              style={{ background: "var(--theme-input-bg)", border: "none", borderRight: `1px solid ${C.borderDim}`, color: C.textSec, fontFamily: "inherit", fontSize: "10px", letterSpacing: "0.16em", padding: "0.9rem 1rem", outline: "none", cursor: "pointer", minWidth: "150px", flex: "0 1 190px", textTransform: "uppercase" }}
            >
              <option value="rating">Ordenar: estrelas</option>
              <option value="abc">Ordenar: A → Z</option>
              {PRICE_FIELDS.map(f => <option key={f.key} value={f.key}>Ordenar: {f.short}</option>)}
            </select>
            <button
              onClick={() => setShowInactive(v => !v)}
              style={{ background: showInactive ? "rgba(var(--theme-accent-rgb),0.08)" : "rgba(var(--theme-contrast-rgb),0.02)", border: "none", color: showInactive ? C.gold : C.textMuted, fontFamily: "inherit", fontSize: "10px", letterSpacing: "0.25em", padding: "0.9rem 1.25rem", cursor: "pointer", whiteSpace: "nowrap", flex: "0 1 auto", textTransform: "uppercase" }}
            >
              {showInactive ? "✓ " : ""}Mostrar inativos
            </button>
          </div>

          {/* Colaboradores agrupados por função / skill */}
          <SkillDrawers
            colaboradores={filtered}
            filterSkill={filterSkill}
            sortBy={sortBy}
            ratingFilter={ratingFilter}
            onEdit={openEdit}
            onOpenProfile={openProfile}
            onToggleAtivo={handleToggleAtivo}
            C={C}
            compact={false}
          />
        </div>

        {/* Count */}
        <div style={{ marginTop: "0.75rem", fontSize: "10px", letterSpacing: "0.3em", color: C.textMuted, textTransform: "uppercase" }}>
          {filtered.length} {filtered.length === 1 ? "colaborador" : "colaboradores"}
          {!showInactive && colaboradores.filter(c => c.ativo === 0).length > 0 && (
            <span style={{ marginLeft: "1rem" }}>· {colaboradores.filter(c => c.ativo === 0).length} inativos ocultos</span>
          )}
        </div>
      </main>
    </div>

    {/* ═══ MOBILE ═══ */}
    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: "var(--theme-text)", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--theme-border)", background: "var(--theme-nav-bg)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.2rem", letterSpacing: "0.35em", color: "var(--theme-accent)", fontWeight: 300 }}>LLE</span>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} style={{ fontSize: "12px", padding: "0.4rem 0.5rem" }} />
          <span style={{ fontSize: "10px", letterSpacing: "0.35em", color: "var(--theme-text-faint)", textTransform: "uppercase" }}>{userName}</span>
        </div>
      </div>

      {/* Search bar mobile */}
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--theme-border)", display: "flex", gap: "0.5rem" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar colaborador..."
          style={{ flex: 1, background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text)", fontFamily: "inherit", fontSize: "14px", padding: "0.6rem 0.9rem", outline: "none" }}
        />
        <button onClick={() => openMerge()} title="Ligar colaboradores" style={{ background: "transparent", border: "1px solid var(--theme-input-border)", color: "var(--theme-text-muted)", fontSize: "10px", padding: "0.6rem 0.7rem", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ligar</button>
        <button onClick={openCreate} style={{ background: "rgba(var(--theme-accent-rgb),0.12)", border: "1px solid rgba(var(--theme-accent-rgb),0.2)", color: "var(--theme-accent)", fontSize: "16px", padding: "0.6rem 0.9rem", cursor: "pointer" }}>+</button>
      </div>

      {/* Skill filter mobile */}
      <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid var(--theme-border)", display: "grid", gap: "0.45rem" }}>
        <select
          value={filterSkill} onChange={e => setFilterSkill(e.target.value)}
          style={{ width: "100%", background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: filterSkill ? "var(--theme-accent)" : "var(--theme-text-muted)", fontFamily: "inherit", fontSize: "13px", padding: "0.5rem 0.75rem", outline: "none" }}
        >
          <option value="">Todas as funções</option>
          {ALL_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.45rem" }}>
          <select value={ratingFilter} onChange={e => setRatingFilter(Number(e.target.value) || 0)} style={{ width: "100%", background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: ratingFilter ? "var(--theme-accent)" : "var(--theme-text-muted)", fontFamily: "inherit", fontSize: "12px", padding: "0.5rem 0.65rem", outline: "none" }}>
            <option value={0}>Todas as estrelas</option><option value={5}>5 estrelas</option><option value={4}>4+</option><option value={3}>3+</option><option value={2}>2+</option><option value={1}>1+</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as ArtistSort)} style={{ width: "100%", background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text-secondary)", fontFamily: "inherit", fontSize: "12px", padding: "0.5rem 0.65rem", outline: "none" }}>
            <option value="rating">Estrelas</option><option value="abc">A → Z</option>{PRICE_FIELDS.map(f => <option key={f.key} value={f.key}>{f.short}</option>)}
          </select>
        </div>
        <button onClick={() => setShowInactive(v => !v)} style={{ width: "100%", background: showInactive ? "rgba(var(--theme-accent-rgb),0.08)" : "transparent", border: "1px solid var(--theme-input-border)", color: showInactive ? "var(--theme-accent)" : "var(--theme-text-muted)", fontFamily: "inherit", fontSize: "11px", letterSpacing: "0.16em", padding: "0.5rem 0.7rem", cursor: "pointer", textTransform: "uppercase" }}>
          {showInactive ? "✓ Ocultar inativos" : "Mostrar inativos"}
        </button>
      </div>

      {artistasPorAssociar.length > 0 && (
        <div style={{ padding: "0.9rem 1rem", borderBottom: "1px solid var(--theme-border)" }}>
          <div style={{ fontSize: "11px", letterSpacing: "0.25em", color: "var(--theme-accent)", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.5rem" }}>Por associar</div>
          {artistasPorAssociar.slice(0, 4).map(item => (
            <div key={item.nome} style={{ padding: "0.7rem 0", borderTop: "1px solid rgba(var(--theme-contrast-rgb),0.04)" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--theme-text)" }}>{item.nome}</div>
              <div style={{ fontSize: "12px", color: "var(--theme-text-muted)", marginTop: "2px", marginBottom: "0.5rem" }}>{item.tipos || "Sem função"} · {item.total} reg.</div>
              <select
                value={linkDrafts[item.nome] || ""}
                onChange={e => setLinkDrafts(prev => ({ ...prev, [item.nome]: e.target.value }))}
                style={{ width: "100%", background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text)", fontFamily: "inherit", fontSize: "13px", padding: "0.5rem 0.65rem", outline: "none", marginBottom: "0.45rem" }}
              >
                <option value="">Ligar a colaborador existente...</option>
                {colaboradores.filter(c => c.ativo === 1).map(c => <option key={c.id} value={c.id}>{c.nome_artistico || c.nome}{c.nome_pessoal ? ` — ${c.nome_pessoal}` : ""}</option>)}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                <button onClick={() => handleAssociarNome(item.nome)} style={{ background: "var(--theme-input-bg)", border: "1px solid rgba(var(--theme-accent-rgb),0.2)", color: "var(--theme-accent)", fontSize: "11px", padding: "0.45rem 0.55rem", cursor: "pointer" }}>Ligar</button>
                <button onClick={() => handleCriarEAssociar(item)} style={{ background: "rgba(var(--theme-accent-rgb),0.12)", border: "1px solid rgba(var(--theme-accent-rgb),0.2)", color: "var(--theme-accent)", fontSize: "11px", padding: "0.45rem 0.55rem", cursor: "pointer" }}>Criar + ligar</button>
                <button onClick={() => handleIgnorarPorAssociar(item.nome)} style={{ gridColumn: "1 / -1", background: "transparent", border: "1px solid var(--theme-input-border)", color: "var(--theme-text-muted)", fontSize: "11px", padding: "0.45rem 0.55rem", cursor: "pointer" }}>Dismiss / ocultar sem apagar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gavetas por função / skill */}
      <div style={{ padding: "0.7rem 0.75rem 1rem" }}>
        <SkillDrawers
          colaboradores={filtered}
          filterSkill={filterSkill}
          sortBy={sortBy}
          ratingFilter={ratingFilter}
          onEdit={openEdit}
          onOpenProfile={openProfile}
          onToggleAtivo={handleToggleAtivo}
          C={C}
          compact
        />
      </div>

      <MobTabBar active="colaboradores" role="admin" lightTheme={lightTheme} />
    </div>

    {/* Modal */}
    {modal.open && (
      <>
        {/* Desktop */}
        <div className="mob-page-desktop" onClick={e => e.target === e.currentTarget && closeModal()} style={overlayStyle}>
          <div style={modalStyle}>
            <div style={topLineStyle} />
            <ColabModalContent form={form} setForm={setForm} modal={modal} saving={saving} closeModal={closeModal} handleSave={handleSave} toggleSkill={toggleSkill} setSkillProfile={setSkillProfile} labelStyle={labelStyle} inputStyle={inputStyle} btnPrimStyle={btnPrimStyle} btnSecStyle={btnSecStyle} C={C} ALL_SKILLS={ALL_SKILLS} />
          </div>
        </div>
        {/* Mobile bottom sheet */}
        <div className="mob-shell" onClick={e => e.target === e.currentTarget && closeModal()} style={overlayBottomStyle}>
          <div style={modalMobStyle}>
            <div style={topLineStyle} />
            <ColabModalContent form={form} setForm={setForm} modal={modal} saving={saving} closeModal={closeModal} handleSave={handleSave} toggleSkill={toggleSkill} setSkillProfile={setSkillProfile} labelStyle={labelStyle} inputStyle={inputStyle} btnPrimStyle={btnPrimStyle} btnSecStyle={btnSecStyle} C={C} ALL_SKILLS={ALL_SKILLS} mobile />
          </div>
        </div>
      </>
    )}


    {mergeOpen && (
      <div onClick={e => e.target === e.currentTarget && !merging && setMergeOpen(false)} style={{ ...overlayStyle, zIndex: 1250 }}>
        <div style={{ ...modalStyle, width: "min(560px, 94vw)", maxHeight: "88vh", overflowY: "auto" }}>
          <div style={topLineStyle} />
          <div style={{ fontSize: "10px", letterSpacing: "0.32em", color: C.gold, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.55rem" }}>Ligar colaboradores</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "2rem", color: C.textPrimary, marginBottom: "0.7rem" }}>Fundir duplicados sem perder histórico</div>
          <p style={{ color: C.textMuted, fontSize: "12px", lineHeight: 1.6, marginBottom: "1.35rem" }}>Escolhe primeiro o registo duplicado que deve desaparecer e depois o colaborador que deve ficar. Agenda e Residências são reassociadas automaticamente. Os dados já preenchidos no colaborador que fica têm prioridade.</p>
          <div style={{ display: "grid", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Duplicado a fundir / retirar</label>
              <select value={mergeSourceId} onChange={e => { setMergeSourceId(e.target.value); if (e.target.value === mergeTargetId) setMergeTargetId(""); }} style={inputStyle}>
                <option value="">Escolher colaborador...</option>
                {colaboradores.map(c => <option key={`source-${c.id}`} value={c.id}>{c.nome_artistico || c.nome}{c.nome_pessoal ? ` — ${c.nome_pessoal}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Colaborador que fica</label>
              <select value={mergeTargetId} onChange={e => setMergeTargetId(e.target.value)} style={inputStyle}>
                <option value="">Escolher colaborador...</option>
                {colaboradores.filter(c => String(c.id) !== mergeSourceId).map(c => <option key={`target-${c.id}`} value={c.id}>{c.nome_artistico || c.nome}{c.nome_pessoal ? ` — ${c.nome_pessoal}` : ""}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: "1.4rem", padding: "0.85rem 1rem", border: `1px solid ${C.borderDim}`, color: C.textMuted, fontSize: "11px", lineHeight: 1.55 }}><strong style={{ color: C.textSec }}>Importante:</strong> isto é diferente de desativar. O duplicado é retirado depois de os vínculos e dados úteis serem passados para o colaborador que fica.</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.7rem", marginTop: "1.3rem" }}>
            <button onClick={() => !merging && setMergeOpen(false)} disabled={merging} style={btnSecStyle}>Cancelar</button>
            <button onClick={handleMergeColaboradores} disabled={merging || !mergeSourceId || !mergeTargetId} style={{ ...btnPrimStyle, opacity: merging || !mergeSourceId || !mergeTargetId ? 0.55 : 1 }}>{merging ? "A ligar..." : "Ligar colaboradores"}</button>
          </div>
        </div>
      </div>
    )}

    {profileColab && (
      <>
        <div className="mob-page-desktop" onClick={e => e.target === e.currentTarget && closeProfile()} style={{ position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1100, display: "flex", justifyContent: "flex-end", backdropFilter: "blur(3px)" }}>
          <div style={{ width: "min(640px, 94vw)", height: "100%", overflowY: "auto", background: C.surface, borderLeft: `1px solid ${C.border}`, boxShadow: "-24px 0 70px rgba(0,0,0,.28)", padding: "2rem", boxSizing: "border-box" }}>
            <ProfileDrawerContent c={profileColab} onClose={closeProfile} onEdit={() => editFromProfile(profileColab)} onDelete={() => handleDeleteColaborador(profileColab)} onMerge={() => openMerge(profileColab)} C={C} compact={false} />
          </div>
        </div>
        <div className="mob-shell" onClick={e => e.target === e.currentTarget && closeProfile()} style={{ position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1100, display: "flex", alignItems: "flex-end", backdropFilter: "blur(3px)" }}>
          <div style={{ width: "100%", maxHeight: "90dvh", overflowY: "auto", background: C.surface, borderTop: `1px solid ${C.border}`, borderRadius: "14px 14px 0 0", padding: "1.25rem", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))", boxSizing: "border-box" }}>
            <ProfileDrawerContent c={profileColab} onClose={closeProfile} onEdit={() => editFromProfile(profileColab)} onDelete={() => handleDeleteColaborador(profileColab)} onMerge={() => openMerge(profileColab)} C={C} compact />
          </div>
        </div>
      </>
    )}

    {/* Toast */}
    <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: "var(--theme-toast-bg)", border: `1px solid ${C.border}`, color: C.gold, fontSize: "12px", letterSpacing: "0.25em", padding: "1rem 1.5rem", zIndex: 2000, transform: toast ? "translateX(0)" : "translateX(200%)", transition: "transform 0.3s ease", textTransform: "uppercase", fontWeight: 600 }}>
      {toast}
    </div>
    </>
  );
}

function ColabModalContent({ form, setForm, modal, saving, closeModal, handleSave, toggleSkill, setSkillProfile, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C, ALL_SKILLS, mobile }: any) {
  return (
    <>
      <p style={{ fontSize: "11px", letterSpacing: "0.4em", color: C.goldDim, textTransform: "uppercase", fontWeight: 600, marginBottom: "1.5rem" }}>
        {modal.editing ? "Editar Colaborador" : "Novo Colaborador"}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <label style={labelStyle}>Nome Artístico *</label>
          <input style={inputStyle} value={form.nome} onChange={(e: any) => setForm((f: any) => ({ ...f, nome: e.target.value }))} placeholder="Gio, DJ João, Annia..." />
        </div>
        <div>
          <label style={labelStyle}>Nome Pessoal / Fiscal</label>
          <input style={inputStyle} value={form.nome_pessoal} onChange={(e: any) => setForm((f: any) => ({ ...f, nome_pessoal: e.target.value }))} placeholder="Nome civil/fiscal..." />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <label style={labelStyle}>Contacto / Telefone</label>
          <input style={inputStyle} value={form.contacto} onChange={(e: any) => setForm((f: any) => ({ ...f, contacto: e.target.value }))} placeholder="+351..." />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input style={inputStyle} value={form.email} onChange={(e: any) => setForm((f: any) => ({ ...f, email: e.target.value }))} placeholder="email@..." />
        </div>
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>IBAN (opcional)</label>
        <input style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: "0.08em" }} value={form.iban} onChange={(e: any) => setForm((f: any) => ({ ...f, iban: e.target.value }))} placeholder="PT50..." />
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Funções / Skills</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "0.25rem" }}>
          {ALL_SKILLS.map((s: string) => (
            <button key={s} onClick={() => toggleSkill(s)} style={{
              background: form.skills.includes(s) ? "rgba(var(--theme-accent-rgb),0.18)" : "rgba(var(--theme-contrast-rgb),0.03)",
              border: `1px solid ${form.skills.includes(s) ? "rgba(var(--theme-accent-rgb),0.4)" : "rgba(var(--theme-contrast-rgb),0.08)"}`,
              color: form.skills.includes(s) ? C.gold : C.textMuted,
              fontSize: mobile ? "10px" : "8px", letterSpacing: "0.08em", padding: mobile ? "7px 10px" : "4px 8px",
              cursor: "pointer", fontFamily: "inherit", textTransform: "none" as any,
            }}>{s}</button>
          ))}
        </div>
      </div>

      {form.skills.length > 0 && (
        <div style={{ marginBottom: "1.1rem", border: `1px solid ${C.border}`, background: "rgba(var(--theme-contrast-rgb),0.015)" }}>
          <div style={{ padding: "0.65rem 0.8rem", borderBottom: `1px solid ${C.borderDim}` }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>Valores e classificação por skill</span>
          </div>
          {form.skills.map((skill: string) => {
            const profile = form.skill_profiles[skill] || emptySkillProfileForm();
            return (
              <div key={skill} style={{ padding: "0.8rem", borderBottom: `1px solid ${C.borderDim}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
                  <div style={{ fontSize: "12px", color: C.textPrimary, fontWeight: 700 }}>{skillDisplayName(skill)}</div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: "8px", marginBottom: "0.2rem" }}>Classificação nesta skill</label>
                    <StarRating value={profile.rating || 0} onChange={(rating: number) => setSkillProfile(skill, { rating })} C={C} />
                  </div>
                </div>
                <div style={{ marginBottom: "0.55rem", fontSize: "9px", color: C.textMuted, lineHeight: 1.45 }}>
                  <b style={{ color: C.textSec }}>Custo LLE:</b> Custo Evento · <b style={{ color: C.textSec }}>Faturação ao cliente:</b> SUD, Evento Residência, Parceria e Cliente Final. <b style={{ color: C.textSec }}>Residências:</b> custo e faturação são definidos exclusivamente na página Residências.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3,minmax(0,1fr))", gap: "0.55rem" }}>
                  {PRICE_FIELDS.map(field => (
                    <div key={field.key}>
                      <label style={{ ...labelStyle, fontSize: "8px", marginBottom: "0.25rem", letterSpacing: "0.18em" }}>{field.label}</label>
                      <input
                        type="number" min="0" step="0.01"
                        style={{ ...inputStyle, padding: "0.5rem 0.65rem" }}
                        value={profile[field.key]}
                        onChange={(e: any) => setSkillProfile(skill, { [field.key]: e.target.value } as any)}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <label style={labelStyle}>Restrições alimentares</label>
          <input style={inputStyle} value={form.restricoes_alimentares} onChange={(e: any) => setForm((f: any) => ({ ...f, restricoes_alimentares: e.target.value }))} placeholder="Sem restrições, vegetariano, alergia..." />
        </div>
        <div>
          <label style={labelStyle}>Calçado</label>
          <input style={inputStyle} value={form.calcado} onChange={(e: any) => setForm((f: any) => ({ ...f, calcado: e.target.value }))} placeholder="Ex: 39" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <label style={labelStyle}>Tamanho parte de cima</label>
          <input style={inputStyle} value={form.tamanho_cima} onChange={(e: any) => setForm((f: any) => ({ ...f, tamanho_cima: e.target.value }))} placeholder="Ex: S / 36 / medidas" />
        </div>
        <div>
          <label style={labelStyle}>Tamanho parte de baixo</label>
          <input style={inputStyle} value={form.tamanho_baixo} onChange={(e: any) => setForm((f: any) => ({ ...f, tamanho_baixo: e.target.value }))} placeholder="Ex: M / 38 / medidas" />
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Notas internas</label>
        <textarea style={{ ...inputStyle, height: "70px", resize: "vertical" as any }} value={form.notas} onChange={(e: any) => setForm((f: any) => ({ ...f, notas: e.target.value }))} placeholder="Notas internas..." />
      </div>
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Estado</label>
        <button onClick={() => setForm((f: any) => ({ ...f, ativo: f.ativo === 1 ? 0 : 1 }))} style={{
          background: form.ativo === 1 ? "rgba(93,202,165,0.12)" : "rgba(var(--theme-contrast-rgb),0.04)",
          border: `1px solid ${form.ativo === 1 ? "rgba(93,202,165,0.3)" : "rgba(var(--theme-contrast-rgb),0.08)"}`,
          color: form.ativo === 1 ? C.green : C.textMuted,
          fontSize: "10px", letterSpacing: "0.2em", padding: "5px 12px",
          cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" as any, fontWeight: 600,
        }}>{form.ativo === 1 ? "● Ativo" : "○ Inativo"}</button>
      </div>
      <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
        <button onClick={closeModal} style={btnSecStyle}>Cancelar</button>
        <button onClick={handleSave} disabled={saving} style={btnPrimStyle}>{saving ? "A guardar..." : modal.editing ? "Guardar" : "Criar"}</button>
      </div>
    </>
  );
}


function skillDisplayName(skill: string): string {
  if (skill === "Bailarino(a)") return "Bailarino / Bailarina";
  if (skill === "Animador / Host") return "Animador / Animadora / Host";
  if (skill === "Cantor(a)") return "Cantor / Cantora";
  if (skill === "Mágico(a)") return "Mágico / Mágica";
  if (skill === "Acrobata Aéreo(a)") return "Acrobata Aéreo / Aérea";
  return skill;
}

function StarRating({ value, onChange, C, readOnly = false, size = 18 }: { value: number; onChange?: (rating: number) => void; C: any; readOnly?: boolean; size?: number }) {
  const safe = Math.max(0, Math.min(5, Number(value || 0)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px" }} aria-label={`${safe} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(n === safe ? 0 : n)}
          title={readOnly ? `${safe}/5` : `${n} estrela${n === 1 ? "" : "s"}`}
          style={{
            appearance: "none", border: 0, background: "transparent", padding: "0 1px", margin: 0,
            cursor: readOnly ? "default" : "pointer", color: n <= safe ? C.gold : "rgba(var(--theme-contrast-rgb),0.16)",
            fontSize: `${size}px`, lineHeight: 1, fontFamily: "Arial,sans-serif",
          }}
        >★</button>
      ))}
      {safe === 0 && readOnly && <span style={{ fontSize: "10px", color: C.textMuted, marginLeft: "5px" }}>sem avaliação</span>}
    </div>
  );
}

function ProfileDrawerContent({ c, onClose, onEdit, onDelete, onMerge, C, compact }: { c: Colaborador; onClose: () => void; onEdit: () => void; onDelete: () => void; onMerge: () => void; C: any; compact?: boolean }) {
  const skills = stringToSkills(c.skills);
  const field = (label: string, value?: string) => (
    <div style={{ padding: compact ? "0.7rem 0" : "0.8rem 0", borderBottom: `1px solid ${C.borderDim}`, minWidth: 0 }}>
      <div style={{ fontSize: "9px", letterSpacing: "0.22em", textTransform: "uppercase", color: C.textMuted, marginBottom: "0.35rem" }}>{label}</div>
      <div style={{ fontSize: compact ? "11px" : "12px", color: value ? C.textPrimary : C.textMuted, overflowWrap: "anywhere" }}>{value || "—"}</div>
    </div>
  );

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", paddingBottom: "1rem", borderBottom: `1px solid ${C.borderDim}` }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.32em", color: C.gold, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.45rem" }}>Perfil do colaborador</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: compact ? "2rem" : "2.5rem", lineHeight: 1, color: C.textPrimary, overflowWrap: "anywhere" }}>{c.nome_artistico || c.nome}</div>
          {c.nome_pessoal && c.nome_pessoal !== (c.nome_artistico || c.nome) && <div style={{ marginTop: "0.45rem", color: C.textMuted, fontSize: "12px" }}>{c.nome_pessoal}</div>}
          <div style={{ marginTop: "0.7rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: c.ativo === 1 ? C.green : C.textMuted }}>{c.ativo === 1 ? "● Ativo" : "○ Inativo"}</span>
            <span style={{ fontSize: "10px", color: C.textMuted }}>{skills.length} {skills.length === 1 ? "função" : "funções"}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ ...iconBtnStyle, fontSize: "16px", flexShrink: 0 }} title="Fechar">×</button>
      </div>

      <div style={{ marginTop: "1.2rem" }}>
        <div style={{ fontSize: "10px", letterSpacing: "0.28em", color: C.goldDim, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.55rem" }}>Funções / Skills</div>
        {skills.length === 0 ? <div style={{ color: C.textMuted, fontSize: "12px" }}>Sem funções definidas.</div> : (
          <div style={{ display: "grid", gap: "0.45rem" }}>
            {skills.map(skill => {
              const profile = c.skill_profiles?.[skill] || emptySkillProfile;
              return (
                <div key={skill} style={{ padding: "0.8rem", border: `1px solid ${C.borderDim}`, background: "rgba(var(--theme-contrast-rgb),0.014)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.8rem", alignItems: "center", marginBottom: "0.7rem" }}>
                    <div style={{ fontSize: "12px", color: C.textPrimary, fontWeight: 700, overflowWrap: "anywhere" }}>{skillDisplayName(skill)}</div>
                    <StarRating value={profile.rating} C={C} readOnly size={13} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr" : "repeat(3,minmax(0,1fr))", gap: "0.45rem" }}>
                    {PRICE_FIELDS.map(field => (
                      <div key={field.key} style={{ padding: "0.55rem 0.6rem", border: `1px solid ${C.borderDim}`, minWidth: 0 }}>
                        <div style={{ fontSize: "8px", letterSpacing: "0.13em", textTransform: "uppercase", color: C.textMuted, marginBottom: "0.25rem" }}>{field.short}</div>
                        <div style={{ fontSize: "12px", color: Number(profile[field.key] || 0) > 0 ? C.gold : C.textMuted, fontWeight: 700 }}>{formatEuro(Number(profile[field.key] || 0))}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: "1.3rem", display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", columnGap: "1.2rem" }}>
        {field("Contacto", c.contacto)}
        {field("Email", c.email)}
        {field("IBAN", c.iban)}
        {field("Restrições alimentares", c.restricoes_alimentares)}
        {field("Parte de cima", c.tamanho_cima)}
        {field("Parte de baixo", c.tamanho_baixo)}
        {field("Calçado", c.calcado)}
        {field("Nome pessoal / fiscal", c.nome_pessoal)}
      </div>

      <div style={{ marginTop: "1.25rem" }}>
        <div style={{ fontSize: "9px", letterSpacing: "0.22em", textTransform: "uppercase", color: C.textMuted, marginBottom: "0.45rem" }}>Notas internas</div>
        <div style={{ minHeight: "70px", padding: "0.8rem", border: `1px solid ${C.borderDim}`, background: "rgba(var(--theme-contrast-rgb),0.012)", color: c.notas ? C.textSec : C.textMuted, fontSize: "13px", lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.notas || "Sem notas."}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.65rem", marginTop: "1.4rem", paddingBottom: "0.5rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
          <button onClick={onMerge} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSec, fontSize: "10px", letterSpacing: "0.12em", padding: "0.65rem 0.8rem", cursor: "pointer", textTransform: "uppercase" }}>Ligar a outro</button>
          <button onClick={onDelete} style={{ background: "transparent", border: "1px solid rgba(226,75,74,0.25)", color: C.red, fontSize: "10px", letterSpacing: "0.12em", padding: "0.65rem 0.8rem", cursor: "pointer", textTransform: "uppercase" }}>Retirar</button>
        </div>
        <div style={{ display: "flex", gap: "0.55rem" }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSec, fontSize: "10px", letterSpacing: "0.22em", padding: "0.65rem 0.9rem", cursor: "pointer", textTransform: "uppercase" }}>Fechar</button>
          <button onClick={onEdit} style={{ background: C.gold, border: 0, color: "var(--theme-accent-contrast)", fontSize: "10px", letterSpacing: "0.22em", padding: "0.65rem 1rem", cursor: "pointer", textTransform: "uppercase", fontWeight: 700 }}>Editar perfil</button>
        </div>
      </div>
    </div>
  );
}

function SkillDrawers({ colaboradores, filterSkill, sortBy, ratingFilter, onEdit, onOpenProfile, onToggleAtivo, C, compact }: {
  colaboradores: Colaborador[];
  filterSkill: string;
  sortBy: ArtistSort;
  ratingFilter: number;
  onEdit: (c: Colaborador) => void;
  onOpenProfile: (c: Colaborador) => void;
  onToggleAtivo: (c: Colaborador) => void;
  C: any;
  compact?: boolean;
}) {
  const namedSkills = (filterSkill
    ? [filterSkill]
    : ALL_SKILLS.filter(skill => colaboradores.some(c => stringToSkills(c.skills).includes(skill))))
    .sort((a, b) => skillDisplayName(a).localeCompare(skillDisplayName(b), "pt-PT", { sensitivity: "base" }));
  const semFuncao = !filterSkill ? colaboradores.filter(c => stringToSkills(c.skills).length === 0) : [];

  const sortPeople = (skill: string, people: Colaborador[]) => {
    const withRating = skill === "Sem função definida"
      ? people
      : people.filter(c => Number((c.skill_profiles?.[skill] || emptySkillProfile).rating || 0) >= ratingFilter);
    return [...withRating].sort((a, b) => {
      const an = (a.nome_artistico || a.nome || "").trim();
      const bn = (b.nome_artistico || b.nome || "").trim();
      if (skill === "Sem função definida" || sortBy === "abc") return an.localeCompare(bn, "pt-PT", { sensitivity: "base" });
      const ap = a.skill_profiles?.[skill] || emptySkillProfile;
      const bp = b.skill_profiles?.[skill] || emptySkillProfile;
      if (sortBy === "rating") {
        const d = Number(bp.rating || 0) - Number(ap.rating || 0);
        return d || an.localeCompare(bn, "pt-PT", { sensitivity: "base" });
      }
      const d = Number(bp[sortBy] || 0) - Number(ap[sortBy] || 0);
      return d || (Number(bp.rating || 0) - Number(ap.rating || 0)) || an.localeCompare(bn, "pt-PT", { sensitivity: "base" });
    });
  };

  const rawGroups = [
    ...namedSkills.map(skill => ({ skill, people: colaboradores.filter(c => stringToSkills(c.skills).includes(skill)) })),
    ...(semFuncao.length ? [{ skill: "Sem função definida", people: semFuncao }] : []),
  ];
  const groups = rawGroups
    .map(g => ({ ...g, visiblePeople: sortPeople(g.skill, g.people) }))
    .filter(g => g.visiblePeople.length > 0);

  if (groups.length === 0) {
    return <div style={{ padding: "3rem 1.5rem", textAlign: "center", fontSize: "13px", color: C.textMuted, letterSpacing: "0.2em" }}>Sem colaboradores encontrados</div>;
  }

  const metaBox = (label: string, value?: string) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: "8px", letterSpacing: "0.14em", textTransform: "uppercase", color: C.textMuted, marginBottom: "3px" }}>{label}</div>
      <div style={{ fontSize: compact ? "9px" : "10px", color: value ? C.textSec : C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={value || ""}>{value || "—"}</div>
    </div>
  );

  const actionStyle = (kind: "normal" | "danger" | "success" = "normal"): React.CSSProperties => ({
    background: kind === "success" ? "rgba(93,202,165,0.08)" : "transparent",
    border: `1px solid ${kind === "danger" ? "rgba(220,90,90,0.24)" : kind === "success" ? "rgba(93,202,165,0.24)" : C.border}`,
    color: kind === "danger" ? C.red : kind === "success" ? C.green : C.textSec,
    fontSize: "9px", letterSpacing: "0.14em", padding: compact ? "0.45rem 0.55rem" : "0.45rem 0.7rem",
    cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", whiteSpace: "nowrap",
  });

  return (
    <div style={{ display: "grid", gap: compact ? "0.55rem" : "0.7rem", padding: compact ? 0 : "0.8rem", minWidth: 0 }}>
      {groups.map(group => {
        const hasPricing = group.skill !== "Sem função definida";
        const activePeople = group.people.filter(c => c.ativo === 1);
        const reference = Object.fromEntries(PRICE_FIELDS.map(field => [
          field.key,
          hasPricing ? Math.max(0, ...activePeople.map(c => Number((c.skill_profiles?.[group.skill] || emptySkillProfile)[field.key] || 0))) : 0,
        ])) as Record<PriceKey, number>;

        return (
          <details key={group.skill} open={Boolean(filterSkill)} style={{ border: `1px solid ${C.borderDim}`, background: "rgba(var(--theme-contrast-rgb),0.012)", minWidth: 0 }}>
            <summary style={{ listStyle: "none", cursor: "pointer", padding: compact ? "0.85rem 0.9rem" : "0.95rem 1.1rem", display: "grid", gridTemplateColumns: compact ? "1fr auto" : "minmax(170px,230px) minmax(0,1fr) auto", gap: compact ? "0.7rem" : "1rem", alignItems: "center", userSelect: "none", minWidth: 0 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", minWidth: 0 }}>
                  <span style={{ color: C.gold, fontSize: compact ? "11px" : "12px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{skillDisplayName(group.skill)}</span>
                  <span style={{ fontSize: "10px", color: C.textMuted, letterSpacing: "0.15em" }}>{group.visiblePeople.length}</span>
                </div>
                {hasPricing && <div style={{ marginTop: "3px", fontSize: "8px", letterSpacing: "0.11em", color: C.textMuted, textTransform: "uppercase" }}>Referência = valor mais alto entre ativos</div>}
              </div>
              {hasPricing && !compact && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: "0.35rem", minWidth: 0 }}>
                  {PRICE_FIELDS.map(field => (
                    <div key={field.key} style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "8px", letterSpacing: "0.06em", textTransform: "uppercase", color: field.kind === "cost" ? C.amber : C.textMuted, marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{field.short}</div>
                      <div style={{ fontSize: "11px", color: reference[field.key] > 0 ? C.gold : C.textMuted, fontWeight: 700, whiteSpace: "nowrap" }}>{formatEuro(reference[field.key])}</div>
                    </div>
                  ))}
                </div>
              )}
              <span style={{ color: C.textMuted, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Abrir ▾</span>
              {hasPricing && compact && (
                <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem", paddingTop: "0.35rem" }}>
                  {PRICE_FIELDS.map(field => (
                    <div key={field.key} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", fontSize: "10px" }}>
                      <span style={{ color: field.kind === "cost" ? C.amber : C.textMuted }}>{field.short}</span>
                      <strong style={{ color: reference[field.key] > 0 ? C.gold : C.textMuted }}>{formatEuro(reference[field.key])}</strong>
                    </div>
                  ))}
                </div>
              )}
            </summary>

            <div style={{ borderTop: `1px solid ${C.borderDim}` }}>
              {group.visiblePeople.map(c => {
                const profile = hasPricing ? (c.skill_profiles?.[group.skill] || emptySkillProfile) : emptySkillProfile;
                return (
                  <div key={`${group.skill}-${c.id}`} style={{ padding: compact ? "0.9rem" : "1rem 1.1rem", borderBottom: `1px solid ${C.borderDim}`, opacity: c.ativo === 0 ? 0.55 : 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", minWidth: 0 }}>
                      <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                        <button type="button" onClick={() => onOpenProfile(c)} style={{ display: "block", maxWidth: "100%", background: "transparent", border: 0, padding: 0, margin: 0, color: C.textPrimary, fontFamily: "inherit", fontSize: compact ? "12px" : "11px", fontWeight: 700, cursor: "pointer", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title="Abrir perfil">
                          {c.nome_artistico || c.nome}
                        </button>
                        <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {[c.contacto, c.email].filter(Boolean).join(" · ") || "Sem contacto registado"}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {hasPricing && <StarRating value={profile.rating} C={C} readOnly size={compact ? 12 : 14} />}
                        <button onClick={() => onOpenProfile(c)} style={actionStyle()}>Ver perfil</button>
                        <button onClick={() => onEdit(c)} style={actionStyle()}>Editar</button>
                        <button onClick={() => onToggleAtivo(c)} style={actionStyle(c.ativo === 1 ? "danger" : "success")}>{c.ativo === 1 ? "Desativar" : "Reativar"}</button>
                      </div>
                    </div>

                    {hasPricing && (
                      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr" : "repeat(7,minmax(0,1fr))", gap: "0.4rem", marginTop: "0.8rem", minWidth: 0 }}>
                        {PRICE_FIELDS.map(field => (
                          <div key={field.key} style={{ padding: compact ? "0.5rem" : "0.55rem 0.6rem", border: `1px solid ${C.borderDim}`, minWidth: 0 }}>
                            <div style={{ fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: field.kind === "cost" ? C.amber : C.textMuted, marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{field.short}</div>
                            <div style={{ fontSize: compact ? "9px" : "10px", color: Number(profile[field.key] || 0) > 0 ? C.gold : C.textMuted, fontWeight: 700, whiteSpace: "nowrap" }}>{formatEuro(Number(profile[field.key] || 0))}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr" : "minmax(190px,2fr) repeat(3,minmax(90px,1fr))", gap: "0.65rem", marginTop: "0.7rem", paddingTop: "0.65rem", borderTop: `1px solid ${C.borderDim}`, minWidth: 0 }}>
                      {metaBox("IBAN", c.iban)}
                      {metaBox("Parte de cima", c.tamanho_cima)}
                      {metaBox("Parte de baixo", c.tamanho_baixo)}
                      {metaBox("Calçado", c.calcado)}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function tdS({ muted, nowrap }: { muted?: boolean; nowrap?: boolean } = {}): React.CSSProperties {
  return {
    fontSize: "13px", color: muted ? "var(--theme-text-muted)" : "var(--theme-text)",
    padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--theme-border)",
    whiteSpace: nowrap ? "nowrap" : undefined,
  };
}

const iconBtnStyle: React.CSSProperties = {
  background: "transparent", border: "1px solid rgba(var(--theme-contrast-rgb),0.06)",
  color: "var(--theme-text-subtle)", padding: "5px 7px", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};

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
    { href: "/valores", label: "Valores" }, { href: "/packs", label: "Packs" }, { href: "/residencias", label: "Residências" },
    { href: "/clientes", label: "Clientes" },
  ];
  const restrictedHrefs = ["/dashboard", "/faturacao", "/pagamentos", "/colaboradores", "/valores", "/packs", "/residencias", "/clientes"];
  const financeHrefs = ["/agenda", "/leads", "/faturacao", "/pagamentos", "/clientes"];
  const financeLinks = [
    ...allLinks.filter(l => financeHrefs.includes(l.href)),
    ...(allLinks.some(l => l.href === "/clientes") ? [] : [{ href: "/clientes", label: "Clientes" }]),
  ].filter((l, i, arr) => arr.findIndex(x => x.href === l.href) === i);
  const baseLinks = role === "admin" ? allLinks : role === "finance" ? financeLinks : allLinks.filter(l => !restrictedHrefs.includes(l.href));
  const links = [
    ...baseLinks,
    ...((role !== "limited_novalues" && role !== "finance") ? [{ href: "/materiais", label: "Materiais" }] : []),
  ];
  return (
    <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", padding: "1.25rem 2.5rem", borderBottom: "1px solid var(--theme-border)", position: "sticky", top: 0, zIndex: 100, background: "var(--theme-nav-bg)", backdropFilter: "blur(12px)", maxWidth: "100vw", boxSizing: "border-box", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", minWidth: 0, flex: 1 }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.3rem", letterSpacing: "0.35em", color: "var(--theme-accent)", fontWeight: 300 }}>LLE</span>
        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", minWidth: 0 }}>
          {links.map(l => (
            <a key={l.href} href={l.href} style={{ fontSize: "11px", letterSpacing: "0.3em", padding: "0.5rem 1rem", textTransform: "uppercase", fontWeight: 500, color: active === l.href.slice(1) ? "var(--theme-accent)" : "var(--theme-text-muted)", textDecoration: "none", fontFamily: "'Montserrat','Helvetica Neue',sans-serif" }}>{l.label}</a>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexShrink: 0 }}>
        <span style={{ fontSize: "11px", letterSpacing: "0.3em", color: "var(--theme-text-faint)", textTransform: "uppercase" }}>{userName}</span>
        <button onClick={onLogout} style={{ background: "transparent", border: "1px solid rgba(var(--theme-accent-rgb),0.12)", color: "var(--theme-text-faint)", fontSize: "10px", letterSpacing: "0.4em", padding: "0.5rem 1rem", cursor: "pointer", textTransform: "uppercase", fontFamily: "inherit", fontWeight: 600 }}>SAIR</button>
      </div>
    </nav>
  );
}

