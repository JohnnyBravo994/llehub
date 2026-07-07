"use client";

import { useTheme } from "../useTheme";
import { ThemeSwitcher } from "../ThemeSwitcher";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getAllColaboradores, createColaborador, updateColaborador,
  toggleColaboradorAtivo, setupColaboradores, getArtistasPorAssociar,
  associarArtistaNomeAColaborador, criarColaboradorEAssociarArtista,
} from "../actions";

interface Colaborador {
  id: number; nome: string; nome_artistico?: string; nome_pessoal?: string;
  contacto: string; email: string; iban: string; skills: string; notas: string; ativo: number;
}

interface ArtistaPorAssociar {
  nome: string; tipos: string; total: number; primeira_data: string; ultima_data: string; fee_medio: number;
}

const C = {
  gold: "#C9A96E", goldDim: "#8a7350", surface: "#111009", pageBg: "#0C0B09",
  border: "rgba(201,169,110,0.12)", borderDim: "rgba(255,255,255,0.05)",
  textPrimary: "#F5F0E8", textSec: "rgba(245,240,232,0.45)", textMuted: "rgba(245,240,232,0.22)",
  green: "#5DCAA5", amber: "#EF9F27", blue: "#85B7EB", red: "#E24B4A",
};

const C_Light = {
  gold: "#000000", goldDim: "#000000", surface: "#FFFFFF", pageBg: "#FFFBF7",
  border: "rgba(0,0,0,0.15)", borderDim: "rgba(0,0,0,0.12)",
  textPrimary: "#000000", textSec: "rgba(0,0,0,0.75)", textMuted: "rgba(0,0,0,0.55)",
  green: "#000000", amber: "#000000", blue: "#000000", red: "#000000", purple: "#000000",
};

const getColors = (lightTheme: boolean) => lightTheme ? C_Light : C;


const ALL_SKILLS = [
  "Cantor/a", "DJ", "Saxofonista", "Violinista", "Pianista", "Guitarrista",
  "Baterista", "Percussionista", "Bailarino/a", "Ator/Host", "Animador/a",
  "Produtor/Coordenador", "Técnico de Som", "Técnico de Luz",
  "Makeup & Hair", "Assistente de Guarda-Roupa", "Coreógrafo/a",
  "Fotógrafo/Videógrafo", "Outro",
];

const emptyForm = {
  nome: "", nome_pessoal: "", contacto: "", email: "", iban: "", skills: [] as string[], notas: "", ativo: 1,
};

function skillsToString(skills: string[]): string {
  return skills.join(", ");
}
function stringToSkills(s: string): string[] {
  if (!s) return [];
  return s.split(",").map(x => x.trim()).filter(Boolean);
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
    });
    setModal({ open: true, editing: c });
  };

  const closeModal = () => setModal({ open: false, editing: null });

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
    await toggleColaboradorAtivo(c.id, novo);
    showToast(novo === 1 ? "Marcado como Ativo" : "Marcado como Inativo");
    load();
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

  const toggleSkill = (skill: string) => {
    setForm(f => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter(s => s !== skill)
        : [...f.skills, skill],
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
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)",
  };
  const overlayBottomStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000,
    display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)",
  };
  const modalStyle: React.CSSProperties = {
    background: "#131108", border: `1px solid ${C.border}`,
    padding: "2.5rem", width: "540px", maxWidth: "95vw", maxHeight: "90vh",
    overflowY: "auto", position: "relative",
  };
  const modalMobStyle: React.CSSProperties = {
    background: "#131108", borderTop: `1px solid ${C.border}`,
    width: "100%", maxHeight: "92dvh", overflowY: "auto",
    padding: "1.5rem 1.25rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
    borderRadius: "12px 12px 0 0", position: "relative",
  };
  const topLineStyle: React.CSSProperties = {
    position: "absolute", top: 0, left: 0, right: 0, height: "1px",
    background: "linear-gradient(90deg, transparent, #C9A96E, transparent)",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "7px", letterSpacing: "0.4em",
    color: C.textMuted, textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)`,
    color: C.textPrimary, fontFamily: "'Montserrat',sans-serif", fontSize: "11px",
    padding: "0.75rem 1rem", letterSpacing: "0.05em", outline: "none", boxSizing: "border-box",
  };
  const btnPrimStyle: React.CSSProperties = {
    background: C.gold, border: "none", color: "#0C0B09",
    fontSize: "9px", letterSpacing: "0.4em", fontWeight: 700,
    padding: "0.75rem 1.75rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase",
  };
  const btnSecStyle: React.CSSProperties = {
    background: "transparent", border: `1px solid ${C.border}`, color: C.textSec,
    fontSize: "9px", letterSpacing: "0.4em", fontWeight: 600,
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
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: C.pageBg, color: C.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <Nav userName={userName} active="colaboradores" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/");  }} />
      <main style={{ padding: "2rem 2.5rem", maxWidth: "1400px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.textSec, textTransform: "uppercase", fontWeight: 600 }}>Colaboradores</p>
            <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
          <button onClick={openCreate} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.gold, fontSize: "9px", letterSpacing: "0.3em", padding: "0.6rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <svg width="10" height="10" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
            Novo Colaborador
          </button>
        </div>

        {artistasPorAssociar.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, position: "relative", marginBottom: "1rem", padding: "1rem" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: lightTheme ? "rgba(0,0,0,0.2)" : "linear-gradient(90deg, transparent, #C9A96E, transparent)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", marginBottom: "0.9rem" }}>
              <div>
                <p style={{ fontSize: "8px", letterSpacing: "0.35em", color: C.goldDim, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.35rem" }}>Nomes por associar</p>
                <p style={{ fontSize: "11px", color: C.textMuted, letterSpacing: "0.04em" }}>Registos antigos da Agenda/Leads continuam intactos. Aqui só ligas o texto antigo ao colaborador certo.</p>
              </div>
              <span style={{ fontSize: "18px", fontWeight: 700, color: C.textPrimary }}>{artistasPorAssociar.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 90px 1.2fr 95px 120px", gap: "8px", alignItems: "center" }}>
              {artistasPorAssociar.slice(0, 12).map(item => (
                <div key={item.nome} style={{ display: "contents" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: C.textPrimary }}>{item.nome}</div>
                  <div style={{ fontSize: "10px", color: C.textSec }}>{item.tipos || "Sem função"}</div>
                  <div style={{ fontSize: "10px", color: C.textMuted }}>{item.total} reg.</div>
                  <select
                    value={linkDrafts[item.nome] || ""}
                    onChange={e => setLinkDrafts(prev => ({ ...prev, [item.nome]: e.target.value }))}
                    style={{ ...inputStyle, padding: "0.48rem 0.6rem" }}
                  >
                    <option value="">Associar a...</option>
                    {colaboradores.filter(c => c.ativo === 1).map(c => <option key={c.id} value={c.id}>{c.nome_artistico || c.nome}</option>)}
                  </select>
                  <button onClick={() => handleAssociarNome(item.nome)} style={{ ...btnSecStyle, padding: "0.55rem 0.65rem", fontSize: "8px" }}>Associar</button>
                  <button onClick={() => handleCriarEAssociar(item)} style={{ ...btnPrimStyle, padding: "0.55rem 0.65rem", fontSize: "8px" }}>Criar + ligar</button>
                </div>
              ))}
            </div>
            {artistasPorAssociar.length > 12 && <div style={{ marginTop: "0.75rem", fontSize: "9px", color: C.textMuted }}>A mostrar 12 de {artistasPorAssociar.length}. Vai associando para aparecerem os restantes.</div>}
          </div>
        )}

        {/* Filters */}
        <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, position: "relative", marginBottom: "0" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" }} />
          <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.borderDim}` }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por nome..."
              style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: "none", borderRight: `1px solid ${C.borderDim}`, color: C.textPrimary, fontFamily: "inherit", fontSize: "11px", padding: "0.9rem 1.5rem", letterSpacing: "0.05em", outline: "none" }}
            />
            <select
              value={filterSkill} onChange={e => setFilterSkill(e.target.value)}
              style={{ background: filterSkill ? "rgba(201,169,110,0.08)" : "rgba(255,255,255,0.02)", border: "none", borderRight: `1px solid ${C.borderDim}`, color: filterSkill ? C.gold : C.textMuted, fontFamily: "inherit", fontSize: "8px", letterSpacing: "0.25em", padding: "0.9rem 1.25rem", outline: "none", cursor: "pointer", appearance: "none" as any, minWidth: "150px", textTransform: "uppercase" }}
            >
              <option value="">Função / Skill</option>
              {ALL_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={() => setShowInactive(v => !v)}
              style={{ background: showInactive ? "rgba(201,169,110,0.08)" : "rgba(255,255,255,0.02)", border: "none", color: showInactive ? C.gold : C.textMuted, fontFamily: "inherit", fontSize: "8px", letterSpacing: "0.25em", padding: "0.9rem 1.25rem", cursor: "pointer", whiteSpace: "nowrap", textTransform: "uppercase" }}
            >
              {showInactive ? "✓ " : ""}Inativos
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Nome Artístico", "Nome Pessoal", "Contacto", "Email", "IBAN", "Funções / Skills", "Estado", "Ações"].map((h, i) => (
                    <th key={h} style={{ fontSize: "7px", letterSpacing: "0.4em", color: C.goldDim, fontWeight: 600, textTransform: "uppercase", padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.border}`, textAlign: i >= 6 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ opacity: c.ativo === 0 ? 0.45 : 1 }}>
                    <td style={tdS()}><span style={{ fontWeight: 600, fontSize: "11px" }}>{c.nome_artistico || c.nome}</span></td>
                    <td style={tdS({ muted: true })}>{c.nome_pessoal || "—"}</td>
                    <td style={tdS({ muted: true })}>{c.contacto || "—"}</td>
                    <td style={tdS({ muted: true })}>{c.email || "—"}</td>
                    <td style={tdS({ muted: true, nowrap: true })}>
                      {c.iban
                        ? <span style={{ fontFamily: "monospace", fontSize: "10px", color: C.textSec }}>{c.iban}</span>
                        : <span style={{ color: C.textMuted }}>—</span>}
                    </td>
                    <td style={{ ...tdS({}), maxWidth: "220px" }}>
                      {stringToSkills(c.skills).length > 0
                        ? <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                            {stringToSkills(c.skills).map(s => (
                              <span key={s} style={{ fontSize: "8px", background: "rgba(201,169,110,0.1)", color: C.gold, padding: "2px 6px", letterSpacing: "0.1em" }}>{s}</span>
                            ))}
                          </div>
                        : <span style={{ color: C.textMuted, fontSize: "10px" }}>—</span>}
                    </td>
                    <td style={{ ...tdS({}), textAlign: "right" }}>
                      <span style={{ fontSize: "8px", letterSpacing: "0.2em", color: c.ativo === 1 ? C.green : C.textMuted, fontWeight: 600, textTransform: "uppercase" }}>
                        {c.ativo === 1 ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <button onClick={() => openEdit(c)} title="Editar" style={iconBtnStyle}><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 2l3 3-9 9H2v-3L11 2z" /></svg></button>
                        <button onClick={() => handleToggleAtivo(c)} title={c.ativo === 1 ? "Marcar Inativo" : "Marcar Ativo"} style={{ ...iconBtnStyle, color: c.ativo === 1 ? C.textMuted : C.green }}>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                            {c.ativo === 1 ? <path d="M12 4L6 10 4 8" /> : <circle cx="8" cy="8" r="6" />}
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "3rem", fontSize: "11px", color: C.textMuted, letterSpacing: "0.2em" }}>Sem colaboradores encontrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Count */}
        <div style={{ marginTop: "0.75rem", fontSize: "8px", letterSpacing: "0.3em", color: C.textMuted, textTransform: "uppercase" }}>
          {filtered.length} {filtered.length === 1 ? "colaborador" : "colaboradores"}
          {!showInactive && colaboradores.filter(c => c.ativo === 0).length > 0 && (
            <span style={{ marginLeft: "1rem" }}>· {colaboradores.filter(c => c.ativo === 0).length} inativos ocultos</span>
          )}
        </div>
      </main>
    </div>

    {/* ═══ MOBILE ═══ */}
    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: "#F5F0E8", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(12,11,9,0.97)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.2rem", letterSpacing: "0.35em", color: "#C9A96E", fontWeight: 300 }}>LLE</span>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} style={{ fontSize: "10px", padding: "0.4rem 0.5rem" }} />
          <span style={{ fontSize: "8px", letterSpacing: "0.35em", color: "rgba(245,240,232,0.2)", textTransform: "uppercase" }}>{userName}</span>
        </div>
      </div>

      {/* Search bar mobile */}
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: "0.5rem" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Pesquisar colaborador..."
          style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F0E8", fontFamily: "inherit", fontSize: "12px", padding: "0.6rem 0.9rem", outline: "none" }}
        />
        <button onClick={openCreate} style={{ background: "rgba(201,169,110,0.12)", border: "1px solid rgba(201,169,110,0.2)", color: "#C9A96E", fontSize: "16px", padding: "0.6rem 0.9rem", cursor: "pointer" }}>+</button>
      </div>

      {/* Skill filter mobile */}
      <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <select
          value={filterSkill} onChange={e => setFilterSkill(e.target.value)}
          style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: filterSkill ? "#C9A96E" : "rgba(245,240,232,0.4)", fontFamily: "inherit", fontSize: "11px", padding: "0.5rem 0.75rem", outline: "none" }}
        >
          <option value="">Todas as funções</option>
          {ALL_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {artistasPorAssociar.length > 0 && (
        <div style={{ padding: "0.9rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.25em", color: "#C9A96E", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.5rem" }}>Por associar</div>
          {artistasPorAssociar.slice(0, 4).map(item => (
            <div key={item.nome} style={{ padding: "0.55rem 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#F5F0E8" }}>{item.nome}</div>
              <div style={{ fontSize: "10px", color: "rgba(245,240,232,0.45)", marginTop: "2px" }}>{item.tipos || "Sem função"} · {item.total} reg.</div>
              <button onClick={() => handleCriarEAssociar(item)} style={{ marginTop: "0.45rem", background: "rgba(201,169,110,0.12)", border: "1px solid rgba(201,169,110,0.2)", color: "#C9A96E", fontSize: "9px", padding: "0.45rem 0.65rem", cursor: "pointer" }}>Criar + ligar</button>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      <div className="mob-list">
        {filtered.map(c => (
          <div key={c.id} style={{ padding: "1rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: c.ativo === 0 ? 0.5 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#F5F0E8", marginBottom: "3px" }}>{c.nome_artistico || c.nome}</div>
                {c.nome_pessoal && <div style={{ fontSize: "10px", color: "rgba(245,240,232,0.55)", marginBottom: "2px" }}>{c.nome_pessoal}</div>}
                {c.contacto && <div style={{ fontSize: "10px", color: "rgba(245,240,232,0.45)" }}>{c.contacto}</div>}
                {stringToSkills(c.skills).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "4px" }}>
                    {stringToSkills(c.skills).slice(0, 3).map(s => (
                      <span key={s} style={{ fontSize: "7px", background: "rgba(201,169,110,0.1)", color: "#C9A96E", padding: "2px 5px", letterSpacing: "0.1em" }}>{s}</span>
                    ))}
                    {stringToSkills(c.skills).length > 3 && <span style={{ fontSize: "7px", color: "rgba(245,240,232,0.3)" }}>+{stringToSkills(c.skills).length - 3}</span>}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", marginLeft: "0.5rem" }}>
                <span style={{ fontSize: "8px", color: c.ativo === 1 ? "#5DCAA5" : "rgba(245,240,232,0.25)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                  {c.ativo === 1 ? "Ativo" : "Inativo"}
                </span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button onClick={() => openEdit(c)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(245,240,232,0.5)", fontSize: "10px", padding: "4px 8px", cursor: "pointer" }}>✏️</button>
                  <button onClick={() => handleToggleAtivo(c)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: c.ativo === 1 ? "rgba(245,240,232,0.3)" : "#5DCAA5", fontSize: "10px", padding: "4px 8px", cursor: "pointer" }}>
                    {c.ativo === 1 ? "⏸" : "▶"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: "3rem 1.5rem", textAlign: "center", fontSize: "11px", color: "rgba(245,240,232,0.2)", letterSpacing: "0.2em" }}>Sem colaboradores</div>}
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
            <ColabModalContent form={form} setForm={setForm} modal={modal} saving={saving} closeModal={closeModal} handleSave={handleSave} toggleSkill={toggleSkill} labelStyle={labelStyle} inputStyle={inputStyle} btnPrimStyle={btnPrimStyle} btnSecStyle={btnSecStyle} C={C} ALL_SKILLS={ALL_SKILLS} />
          </div>
        </div>
        {/* Mobile bottom sheet */}
        <div className="mob-shell" onClick={e => e.target === e.currentTarget && closeModal()} style={overlayBottomStyle}>
          <div style={modalMobStyle}>
            <div style={topLineStyle} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.goldDim, textTransform: "uppercase", fontWeight: 600 }}>
                {modal.editing ? "Editar Colaborador" : "Novo Colaborador"}
              </p>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: C.textMuted, fontSize: "20px", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Nome Artístico *</label>
              <input style={inputStyle} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Gio, DJ João, Annia..." />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Nome Pessoal / Fiscal</label>
              <input style={inputStyle} value={form.nome_pessoal} onChange={e => setForm(f => ({ ...f, nome_pessoal: e.target.value }))} placeholder="Nome civil/fiscal..." />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Contacto / Telefone</label>
              <input style={inputStyle} value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} placeholder="+351..." />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@..." />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>IBAN (opcional)</label>
              <input style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: "0.08em" }} value={form.iban} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} placeholder="PT50..." />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Funções / Skills</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "0.35rem" }}>
                {ALL_SKILLS.map(s => (
                  <button key={s} onClick={() => toggleSkill(s)} style={{
                    background: form.skills.includes(s) ? "rgba(201,169,110,0.18)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${form.skills.includes(s) ? "rgba(201,169,110,0.4)" : "rgba(255,255,255,0.1)"}`,
                    color: form.skills.includes(s) ? C.gold : C.textMuted,
                    fontSize: "11px", padding: "8px 12px", cursor: "pointer", fontFamily: "inherit",
                    minHeight: "36px",
                  }}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Notas</label>
              <textarea style={{ ...inputStyle, height: "70px", resize: "vertical" }} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Notas internas..." />
            </div>
            <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Estado</label>
              <button onClick={() => setForm(f => ({ ...f, ativo: f.ativo === 1 ? 0 : 1 }))} style={{
                background: form.ativo === 1 ? "rgba(93,202,165,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${form.ativo === 1 ? "rgba(93,202,165,0.3)" : "rgba(255,255,255,0.08)"}`,
                color: form.ativo === 1 ? C.green : C.textMuted, fontSize: "10px", letterSpacing: "0.15em",
                padding: "8px 16px", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600,
              }}>{form.ativo === 1 ? "● Ativo" : "○ Inativo"}</button>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={closeModal} style={{ ...btnSecStyle, flex: 1 }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ ...btnPrimStyle, flex: 2 }}>{saving ? "A guardar..." : modal.editing ? "Guardar" : "Criar"}</button>
            </div>
          </div>
        </div>
      </>
    )}

    {/* Toast */}
    <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: "#1a1408", border: `1px solid ${C.border}`, color: C.gold, fontSize: "10px", letterSpacing: "0.25em", padding: "1rem 1.5rem", zIndex: 2000, transform: toast ? "translateX(0)" : "translateX(200%)", transition: "transform 0.3s ease", textTransform: "uppercase", fontWeight: 600 }}>
      {toast}
    </div>
    </>
  );
}

function ColabModalContent({ form, setForm, modal, saving, closeModal, handleSave, toggleSkill, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C, ALL_SKILLS }: any) {
  return (
    <>
      <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.goldDim, textTransform: "uppercase", fontWeight: 600, marginBottom: "1.5rem" }}>
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
              background: form.skills.includes(s) ? "rgba(201,169,110,0.18)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${form.skills.includes(s) ? "rgba(201,169,110,0.4)" : "rgba(255,255,255,0.08)"}`,
              color: form.skills.includes(s) ? C.gold : C.textMuted,
              fontSize: "8px", letterSpacing: "0.15em", padding: "4px 8px",
              cursor: "pointer", fontFamily: "inherit", textTransform: "none" as any,
            }}>{s}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Notas</label>
        <textarea style={{ ...inputStyle, height: "70px", resize: "vertical" as any }} value={form.notas} onChange={(e: any) => setForm((f: any) => ({ ...f, notas: e.target.value }))} placeholder="Notas internas..." />
      </div>
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Estado</label>
        <button onClick={() => setForm((f: any) => ({ ...f, ativo: f.ativo === 1 ? 0 : 1 }))} style={{
          background: form.ativo === 1 ? "rgba(93,202,165,0.12)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${form.ativo === 1 ? "rgba(93,202,165,0.3)" : "rgba(255,255,255,0.08)"}`,
          color: form.ativo === 1 ? C.green : C.textMuted,
          fontSize: "8px", letterSpacing: "0.2em", padding: "5px 12px",
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

function tdS({ muted, nowrap }: { muted?: boolean; nowrap?: boolean } = {}): React.CSSProperties {
  return {
    fontSize: "11px", color: muted ? "rgba(245,240,232,0.45)" : "#F5F0E8",
    padding: "0.75rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.04)",
    whiteSpace: nowrap ? "nowrap" : undefined,
  };
}

const iconBtnStyle: React.CSSProperties = {
  background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
  color: "rgba(245,240,232,0.35)", padding: "5px 7px", cursor: "pointer",
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
    { href: "/valores", label: "Valores" }, { href: "/residencias", label: "Residências" },
    { href: "/clientes", label: "Clientes" },
  ];
  const restrictedHrefs = ["/dashboard", "/faturacao", "/pagamentos", "/colaboradores", "/valores", "/residencias", "/clientes"];
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
function MobTabBar({ active, role, lightTheme }: { active: string; role: string; lightTheme: boolean }) {
  const [maisOpen, setMaisOpen] = useState(false);
  const drawerBg = lightTheme ? "#FFFFFF" : "#131108";
  const drawerBorder = lightTheme ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(201,169,110,0.15)";
  const drawerShadow = lightTheme ? "0 -8px 32px rgba(0,0,0,0.15)" : "0 -8px 32px rgba(0,0,0,0.6)";
  const drawerMuted = lightTheme ? "rgba(0,0,0,0.65)" : "rgba(245,240,232,0.4)";
  const drawerActiveBg = lightTheme ? "rgba(0,0,0,0.06)" : "rgba(201,169,110,0.08)";
  const drawerGold = lightTheme ? "#000000" : "#C9A96E";
  const drawerHandle = lightTheme ? "rgba(0,0,0,0.25)" : "rgba(201,169,110,0.25)";
  const drawerTitle = lightTheme ? "rgba(0,0,0,0.5)" : "rgba(201,169,110,0.4)";

  // Os 4 tabs fixos — sempre visíveis
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
    { href: "/faturacao", label: "Faturação", id: "faturacao", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
      </svg>
    )},
    { href: "/colaboradores", label: "Equipa", id: "colaboradores", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="9" cy="7" r="3"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><circle cx="18" cy="8" r="2.5"/><path d="M17 20c0-2 1.3-3.5 3-3.5"/>
      </svg>
    )},
  ];

  // Páginas no drawer "Mais" (admin only)
  const valoresTab = { href: "/valores", label: "Valores", id: "valores", icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-3 3 2 5-7"/>
    </svg>
  )};
  const materiaisTab = { href: "/materiais", label: "Materiais", id: "materiais", icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a4 4 0 018 0v2"/>
    </svg>
  )};
  const maisTabs = role === "admin" ? [
    { href: "/clientes", label: "Clientes", id: "clientes", icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="9" cy="7" r="3"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/>
        <line x1="16" y1="11" x2="22" y2="11"/><line x1="19" y1="8" x2="19" y2="14"/>
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
    valoresTab,
    { href: "/residencias", label: "Residências", id: "residencias", icon: valoresTab.icon },
    materiaisTab,
  ] : role === "finance" ? [{ href: "/clientes", label: "Clientes", id: "clientes", icon: materiaisTab.icon }, { href: "/pagamentos", label: "Pagamentos", id: "pagamentos", icon: materiaisTab.icon }] : role !== "limited_novalues" ? [materiaisTab] : [];

  const activeInMais = maisTabs.some(t => t.id === active);

  return (
    <>
      {/* Overlay para fechar drawer */}
      {maisOpen && (
        <div
          onClick={() => setMaisOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 199, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
        />
      )}

      {/* Drawer "Mais" — sobe por cima da tab bar */}
      <div style={{
        position: "fixed", bottom: "calc(60px + env(safe-area-inset-bottom))", left: 0, right: 0,
        zIndex: 200, transform: maisOpen ? "translateY(0)" : "translateY(110%)",
        transition: "transform 0.25s cubic-bezier(0.32,0.72,0,1)",
        background: drawerBg, borderTop: drawerBorder,
        borderRadius: "16px 16px 0 0", padding: "0.75rem 0.5rem",
        paddingBottom: "0.5rem",
        boxShadow: drawerShadow,
      }}>
        {/* Handle */}
        <div style={{ width: "36px", height: "3px", background: drawerHandle, borderRadius: "2px", margin: "0 auto 0.75rem"  }} />
        <p style={{ fontSize: "7px", letterSpacing: "0.4em", color: drawerTitle, textTransform: "uppercase", textAlign: "center", marginBottom: "0.5rem", fontFamily: "'Montserrat',sans-serif" }}>Mais páginas</p>
        <div style={{ display: "flex", justifyContent: "space-around", padding: "0 0.5rem" }}>
          {maisTabs.map(t => (
            <a key={t.href} href={t.href} onClick={() => setMaisOpen(false)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                textDecoration: "none", padding: "0.6rem 1rem", minWidth: "72px",
                color: active === t.id ? drawerGold : drawerMuted,
                background: active === t.id ? drawerActiveBg : "transparent",
                borderRadius: "10px",
              }}>
              <span style={{ width: "22px", height: "22px", display: "block" }}>{t.icon}</span>
              <span style={{ fontSize: "9px", letterSpacing: "0.1em", fontFamily: "'Montserrat',sans-serif", fontWeight: active === t.id ? 600 : 400 }}>{t.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Tab bar principal */}
      <nav className="mob-tabbar">
        {mainTabs.map(l => (
          <a key={l.href} href={l.href} className={`mob-tab${active === l.id ? " active" : ""}`}>
            <span className="mob-tab-icon">{l.icon}</span>
            <span className="mob-tab-label">{l.label}</span>
          </a>
        ))}
        {/* Botão "Mais" — só para admin */}
        {maisTabs.length > 0 && (
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
