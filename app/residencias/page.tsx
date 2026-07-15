"use client";

import MobTabBar from "../MobTabBar";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "../useTheme";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { SERVICOS_VENDIDOS } from "../constants";
import {
  setupResidenciasAtivas, getAllResidenciasAtivas, createResidenciaAtiva,
  updateResidenciaAtiva, toggleResidenciaAtiva, getAllClientes, getAllColaboradores,
} from "../actions";

interface ResidenciaAtiva {
  id: number; nome: string; cliente_id: number | null; cliente_nome: string; local: string; servico: string; duracao_formato: string;
  custo_interno: number; valor_cliente: number; performer_padrao_id: number | null; performer_padrao_nome: string; notas: string; ativo: number;
}
interface Cliente { id: number; nome: string; alias?: string; }
interface Colaborador { id: number; nome: string; nome_artistico?: string; skills?: string; ativo: number; }
type Draft = {
  nome: string; cliente_id: string; cliente_nome: string; local: string; servico: string; duracao_formato: string;
  custo_interno: string; valor_cliente: string; performer_padrao_id: string; performer_padrao_nome: string; notas: string; ativo: number;
};

const C_Dark = { gold: "var(--theme-accent)", goldDim: "var(--theme-accent-muted)", surface: "var(--theme-surface)", pageBg: "var(--theme-bg)", border: "rgba(var(--theme-accent-rgb),0.12)", borderDim: "rgba(var(--theme-contrast-rgb),0.05)", textPrimary: "var(--theme-text)", textSec: "var(--theme-text-muted)", textMuted: "var(--theme-text-faint)", green: "var(--theme-success)" };
const C_Light = { gold: "#8B4513", goldDim: "#6F3A18", surface: "#FFFFFF", pageBg: "#FFFBF7", border: "rgba(17,24,39,0.18)", borderDim: "rgba(17,24,39,0.12)", textPrimary: "#111827", textSec: "rgba(17,24,39,0.82)", textMuted: "rgba(17,24,39,0.62)", green: "#2E7D32" };
const getColors = (lightTheme: boolean) => lightTheme ? C_Light : C_Dark;
const emptyNew: Draft = { nome: "", cliente_id: "", cliente_nome: "", local: "", servico: "DJ", duracao_formato: "", custo_interno: "", valor_cliente: "", performer_padrao_id: "", performer_padrao_nome: "", notas: "", ativo: 1 };
const toNum = (v: string) => parseFloat((v || "").replace(",", ".")) || 0;
function euro(v: number) { return v ? `${v.toLocaleString("pt-PT")}€` : "—"; }
function displayCol(c: Colaborador) { return c.nome_artistico || c.nome; }
function toDraft(v: ResidenciaAtiva): Draft {
  return {
    nome: v.nome || "", cliente_id: v.cliente_id ? String(v.cliente_id) : "", cliente_nome: v.cliente_nome || "", local: v.local || "", servico: v.servico || "DJ", duracao_formato: v.duracao_formato || "",
    custo_interno: v.custo_interno ? String(v.custo_interno) : "", valor_cliente: v.valor_cliente ? String(v.valor_cliente) : "", performer_padrao_id: v.performer_padrao_id ? String(v.performer_padrao_id) : "",
    performer_padrao_nome: v.performer_padrao_nome || "", notas: v.notas || "", ativo: v.ativo,
  };
}

export default function ResidenciasPage() {
  const router = useRouter();
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const C = getColors(lightTheme);
  const [userName, setUserName] = useState("");
  const [rows, setRows] = useState<ResidenciaAtiva[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [newRow, setNewRow] = useState<Draft>(emptyNew);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2400); };
  const load = useCallback(async () => {
    await setupResidenciasAtivas();
    const [rr, cr, colr] = await Promise.all([getAllResidenciasAtivas(), getAllClientes(), getAllColaboradores()]);
    if (rr.success) { const data = rr.data as ResidenciaAtiva[]; setRows(data); setDrafts(Object.fromEntries(data.map(v => [v.id, toDraft(v)]))); }
    if (cr.success) setClientes(cr.data as Cliente[]);
    if (colr.success) setColaboradores((colr.data as Colaborador[]).filter(c => c.ativo === 1));
    setLoading(false);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("lle_user");
    if (!u) { router.push("/"); return; }
    const parsed = JSON.parse(u);
    if (parsed.role !== "admin") { router.push("/agenda"); return; }
    setUserName(parsed.name);
    load();
  }, [load, router]);

  const inputStyle: React.CSSProperties = { width: "100%", background: lightTheme ? "rgba(0,0,0,0.03)" : "rgba(var(--theme-contrast-rgb),0.04)", border: `1px solid ${C.borderDim}`, color: C.textPrimary, fontFamily: "inherit", fontSize: "10px", padding: "0.52rem 0.6rem", outline: "none", boxSizing: "border-box", letterSpacing: "0.02em" };
  const btnStyle: React.CSSProperties = { background: "transparent", border: `1px solid ${C.border}`, color: C.gold, fontSize: "8px", letterSpacing: "0.18em", padding: "0.52rem 0.65rem", cursor: "pointer", textTransform: "uppercase", fontFamily: "inherit", fontWeight: 700 };
  const grid = "1fr 0.9fr 0.9fr 0.75fr 0.85fr 90px 90px 1fr 1fr 78px 86px";
  const updateDraft = (id: number, field: keyof Draft, value: string | number) => setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  const applyCliente = (d: Draft, clienteId: string) => {
    const c = clientes.find(x => String(x.id) === clienteId);
    return { ...d, cliente_id: clienteId, cliente_nome: c ? c.nome : d.cliente_nome };
  };
  const applyPerformer = (d: Draft, performerId: string) => {
    const c = colaboradores.find(x => String(x.id) === performerId);
    return { ...d, performer_padrao_id: performerId, performer_padrao_nome: c ? displayCol(c) : "" };
  };
  const payload = (d: Draft) => ({
    nome: d.nome.trim(), cliente_id: d.cliente_id ? Number(d.cliente_id) : null, cliente_nome: d.cliente_nome.trim(), local: d.local.trim(), servico: d.servico.trim() || "DJ", duracao_formato: d.duracao_formato.trim(),
    custo_interno: toNum(d.custo_interno), valor_cliente: toNum(d.valor_cliente), performer_padrao_id: d.performer_padrao_id ? Number(d.performer_padrao_id) : null, performer_padrao_nome: d.performer_padrao_nome.trim(), notas: d.notas, ativo: d.ativo,
  });
  const saveRow = async (id: number) => {
    const d = drafts[id]; if (!d?.nome.trim()) { showToast("Nome obrigatório"); return; }
    setSavingId(id); const res = await updateResidenciaAtiva(id, payload(d)); showToast(res.success ? "Residência atualizada" : "Erro ao atualizar"); await load(); setSavingId(null);
  };
  const createRow = async () => {
    if (!newRow.nome.trim()) { showToast("Nome obrigatório"); return; }
    const res = await createResidenciaAtiva(payload(newRow));
    if (res.success) { setNewRow(emptyNew); showToast("Residência criada"); await load(); } else showToast("Erro ao criar residência");
  };
  const toggleAtivo = async (row: ResidenciaAtiva) => { await toggleResidenciaAtiva(row.id, row.ativo === 1 ? 0 : 1); await load(); };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.pageBg, color: C.gold, fontFamily: "'Cormorant Garamond',serif", fontSize: "3rem", letterSpacing: "0.4em" }}>LLE</div>;

  return <>
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: C.pageBg, color: C.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <Nav userName={userName} active="residencias" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/"); }} />
      <main style={{ padding: "2rem 2.5rem", maxWidth: "1500px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", gap: "1rem" }}>
          <div><p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.textSec, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.4rem" }}>Residências Ativas</p><p style={{ fontSize: "11px", color: C.textMuted, letterSpacing: "0.06em" }}>Regras recorrentes por cliente/local. A Agenda pode usar isto para criar ocorrências sem confundir com eventos normais.</p></div>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
        </div>
        <datalist id="residencias-servicos-list">
          {SERVICOS_VENDIDOS.map(s => <option key={s} value={s} />)}
        </datalist>

        <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, position: "relative", overflowX: "auto" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: lightTheme ? "rgba(0,0,0,0.2)" : "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" }} />
          <div style={{ minWidth: 1320 }}>
            <div style={{ display: "grid", gridTemplateColumns: grid, gap: "8px", padding: "0.8rem 1rem", borderBottom: `1px solid ${C.border}` }}>{["Residência", "Cliente", "Local", "Serviço", "Duração", "Custo", "Cliente", "Performer Padrão", "Notas", "Estado", "Ações"].map(h => <span key={h} style={{ fontSize: "7px", letterSpacing: "0.2em", color: C.goldDim, textTransform: "uppercase", fontWeight: 700 }}>{h}</span>)}</div>
            {rows.map(row => { const d = drafts[row.id]; return <div key={row.id} style={{ display: "grid", gridTemplateColumns: grid, gap: "8px", alignItems: "center", padding: "0.6rem 1rem", borderBottom: `1px solid ${C.borderDim}`, opacity: row.ativo === 0 ? 0.45 : 1 }}>
              <input value={d?.nome || ""} onChange={e => updateDraft(row.id, "nome", e.target.value)} placeholder="ICON Fridays" style={inputStyle} />
              <select value={d?.cliente_id || ""} onChange={e => setDrafts(prev => ({ ...prev, [row.id]: applyCliente(prev[row.id], e.target.value) }))} style={inputStyle}><option value="">Manual</option>{clientes.map(c => <option key={c.id} value={c.id}>{(c as any).alias || c.nome}</option>)}</select>
              <input value={d?.local || ""} onChange={e => updateDraft(row.id, "local", e.target.value)} placeholder="ICON" style={inputStyle} />
              <input list="residencias-servicos-list" value={d?.servico || "DJ"} onChange={e => updateDraft(row.id, "servico", e.target.value)} placeholder="DJ" style={inputStyle} />
              <input value={d?.duracao_formato || ""} onChange={e => updateDraft(row.id, "duracao_formato", e.target.value)} placeholder="4h" style={inputStyle} />
              <input value={d?.custo_interno || ""} onChange={e => updateDraft(row.id, "custo_interno", e.target.value)} inputMode="decimal" placeholder="0" style={{ ...inputStyle, textAlign: "right" }} />
              <input value={d?.valor_cliente || ""} onChange={e => updateDraft(row.id, "valor_cliente", e.target.value)} inputMode="decimal" placeholder="0" style={{ ...inputStyle, textAlign: "right" }} />
              <select value={d?.performer_padrao_id || ""} onChange={e => setDrafts(prev => ({ ...prev, [row.id]: applyPerformer(prev[row.id], e.target.value) }))} style={inputStyle}><option value="">Variável</option>{colaboradores.map(c => <option key={c.id} value={c.id}>{displayCol(c)}</option>)}</select>
              <input value={d?.notas || ""} onChange={e => updateDraft(row.id, "notas", e.target.value)} placeholder="Regras..." style={inputStyle} />
              <button onClick={() => toggleAtivo(row)} style={{ ...btnStyle, color: row.ativo === 1 ? C.green : C.textMuted }}>{row.ativo === 1 ? "Ativo" : "Inativo"}</button>
              <button onClick={() => saveRow(row.id)} disabled={savingId === row.id} style={{ ...btnStyle, background: lightTheme ? "rgba(0,0,0,0.04)" : "rgba(var(--theme-accent-rgb),0.08)" }}>{savingId === row.id ? "..." : "Guardar"}</button>
            </div>; })}
            <div style={{ display: "grid", gridTemplateColumns: grid, gap: "8px", alignItems: "center", padding: "1rem", background: lightTheme ? "rgba(0,0,0,0.02)" : "rgba(var(--theme-accent-rgb),0.03)" }}>
              <input value={newRow.nome} onChange={e => setNewRow(r => ({ ...r, nome: e.target.value }))} placeholder="Nova residência..." style={inputStyle} />
              <select value={newRow.cliente_id} onChange={e => setNewRow(r => applyCliente(r, e.target.value))} style={inputStyle}><option value="">Manual</option>{clientes.map(c => <option key={c.id} value={c.id}>{(c as any).alias || c.nome}</option>)}</select>
              <input value={newRow.local} onChange={e => setNewRow(r => ({ ...r, local: e.target.value }))} placeholder="Local" style={inputStyle} />
              <input list="residencias-servicos-list" value={newRow.servico} onChange={e => setNewRow(r => ({ ...r, servico: e.target.value }))} placeholder="DJ" style={inputStyle} />
              <input value={newRow.duracao_formato} onChange={e => setNewRow(r => ({ ...r, duracao_formato: e.target.value }))} placeholder="4h" style={inputStyle} />
              <input value={newRow.custo_interno} onChange={e => setNewRow(r => ({ ...r, custo_interno: e.target.value }))} inputMode="decimal" placeholder="Custo" style={{ ...inputStyle, textAlign: "right" }} />
              <input value={newRow.valor_cliente} onChange={e => setNewRow(r => ({ ...r, valor_cliente: e.target.value }))} inputMode="decimal" placeholder="Cliente" style={{ ...inputStyle, textAlign: "right" }} />
              <select value={newRow.performer_padrao_id} onChange={e => setNewRow(r => applyPerformer(r, e.target.value))} style={inputStyle}><option value="">Variável</option>{colaboradores.map(c => <option key={c.id} value={c.id}>{displayCol(c)}</option>)}</select>
              <input value={newRow.notas} onChange={e => setNewRow(r => ({ ...r, notas: e.target.value }))} placeholder="Notas..." style={inputStyle} />
              <span style={{ fontSize: "8px", color: C.textMuted, letterSpacing: "0.2em", textTransform: "uppercase" }}>Novo</span>
              <button onClick={createRow} style={{ ...btnStyle, background: C.gold, color: lightTheme ? "#FFFFFF" : "var(--theme-bg)" }}>Criar</button>
            </div>
          </div>
        </div>
        <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}><Metric label="Residências ativas" value={String(rows.filter(r => r.ativo === 1).length)} C={C} /><Metric label="Clientes" value={String(new Set(rows.filter(r => r.ativo === 1).map(r => r.cliente_nome).filter(Boolean)).size)} C={C} /><Metric label="Custo médio" value={euro(avg(rows.filter(r => r.ativo === 1).map(r => r.custo_interno).filter(Boolean)))} C={C} /><Metric label="Valor médio" value={euro(avg(rows.filter(r => r.ativo === 1).map(r => r.valor_cliente).filter(Boolean)))} C={C} /></div>
      </main>
    </div>

    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: C.textPrimary, opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.1rem", borderBottom: `1px solid ${C.borderDim}`, background: C.pageBg, position: "sticky", top: 0, zIndex: 10 }}><span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.2rem", letterSpacing: "0.35em", color: C.gold, fontWeight: 300 }}>LLE</span><ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} style={{ fontSize: "10px", padding: "0.4rem 0.5rem" }} /></div>
      <div style={{ padding: "1rem", borderBottom: `1px solid ${C.borderDim}` }}><p style={{ fontSize: "9px", letterSpacing: "0.35em", color: C.textSec, textTransform: "uppercase", fontWeight: 700 }}>Residências Ativas</p><p style={{ fontSize: "11px", color: C.textMuted, marginTop: "0.4rem" }}>Regras recorrentes por cliente/local.</p></div>
      <div className="mob-list">{rows.map(row => <div key={row.id} style={{ padding: "1rem", borderBottom: `1px solid ${C.borderDim}`, opacity: row.ativo === 0 ? 0.45 : 1 }}><div style={{ fontSize: "14px", fontWeight: 700, color: C.textPrimary }}>{row.nome}</div><div style={{ fontSize: "11px", color: C.textSec, marginTop: "0.35rem" }}>{row.cliente_nome || "Sem cliente"} · {row.local || "Sem local"} · {row.servico}</div><div style={{ fontSize: "11px", color: C.textSec, marginTop: "0.35rem" }}>Custo: {euro(row.custo_interno)} · Cliente: {euro(row.valor_cliente)}</div>{row.performer_padrao_nome && <div style={{ fontSize: "10px", color: C.textMuted, marginTop: "0.35rem" }}>Performer: {row.performer_padrao_nome}</div>}</div>)}</div>
      <MobTabBar active="residencias" role="admin" lightTheme={lightTheme} />
    </div>
    <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: C.surface, border: `1px solid ${C.border}`, color: C.gold, fontSize: "10px", letterSpacing: "0.25em", padding: "1rem 1.5rem", zIndex: 2000, transform: toast ? "translateX(0)" : "translateX(200%)", transition: "transform 0.3s ease", textTransform: "uppercase", fontWeight: 600 }}>{toast}</div>
  </>;
}

function avg(values: number[]) { return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0; }
function Metric({ label, value, C }: { label: string; value: string; C: typeof C_Dark }) { return <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, padding: "1rem" }}><div style={{ fontSize: "7px", letterSpacing: "0.35em", color: C.textMuted, textTransform: "uppercase", marginBottom: "0.5rem" }}>{label}</div><div style={{ fontSize: "18px", fontWeight: 700, color: C.textPrimary }}>{value}</div></div>; }

function Nav({ userName, active, onLogout }: { userName: string; active: string; onLogout: () => void }) {
  const stored = typeof window !== "undefined" ? localStorage.getItem("lle_user") : null;
  const role = stored ? JSON.parse(stored).role : "admin";
  const allLinks = [{ href: "/dashboard", label: "Dashboard" }, { href: "/agenda", label: "Agenda" }, { href: "/leads", label: "Leads" }, { href: "/faturacao", label: "Faturação" }, { href: "/pagamentos", label: "Pagamentos" }, { href: "/colaboradores", label: "Colaboradores" }, { href: "/valores", label: "Valores" }, { href: "/residencias", label: "Residências" }, { href: "/clientes", label: "Clientes" }];
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
  return <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 2.5rem", borderBottom: "1px solid var(--theme-border)", position: "sticky", top: 0, zIndex: 100, background: "var(--theme-nav-bg)", backdropFilter: "blur(12px)" }}><div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}><span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.3rem", letterSpacing: "0.35em", color: "var(--theme-accent)", fontWeight: 300 }}>LLE</span><div style={{ display: "flex", gap: "0.25rem" }}>{links.map(l => <a key={l.href} href={l.href} style={{ fontSize: "9px", letterSpacing: "0.25em", padding: "0.5rem 0.65rem", textTransform: "uppercase", fontWeight: 500, color: active === l.href.slice(1) ? "var(--theme-accent)" : "var(--theme-text-muted)", textDecoration: "none", fontFamily: "'Montserrat','Helvetica Neue',sans-serif" }}>{l.label}</a>)}</div></div><div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}><span style={{ fontSize: "9px", letterSpacing: "0.3em", color: "var(--theme-text-faint)", textTransform: "uppercase" }}>{userName}</span><button onClick={onLogout} style={{ background: "transparent", border: "1px solid rgba(var(--theme-accent-rgb),0.12)", color: "var(--theme-text-faint)", fontSize: "8px", letterSpacing: "0.4em", padding: "0.5rem 1rem", cursor: "pointer", textTransform: "uppercase", fontFamily: "inherit", fontWeight: 600 }}>SAIR</button></div></nav>;
}
