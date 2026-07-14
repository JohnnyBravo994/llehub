"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "../useTheme";
import { ThemeSwitcher } from "../ThemeSwitcher";
import {
  setupValoresMaster, getAllValoresMaster, createValorMaster,
  updateValorMaster, toggleValorMasterAtivo, getServicosPorCriarNaMaster,
  criarValorMasterAPartirServico,
} from "../actions";
import { SERVICOS_VENDIDOS } from "../constants";

interface ValorMaster {
  id: number;
  servico: string;
  duracao_formato: string;
  contexto: string;
  cliente_nome: string;
  custo_interno: number;
  valor_parceiro: number;
  valor_cliente_final: number;
  notas: string;
  ativo: number;
}

interface ServicoPorCriarNaMaster {
  servico: string; total: number; primeira_data: string; ultima_data: string; fee_medio: number;
}

type Draft = {
  servico: string; duracao_formato: string; contexto: string; cliente_nome: string;
  custo_interno: string; valor_parceiro: string; valor_cliente_final: string; notas: string; ativo: number;
};

const C_Dark = {
  gold: "var(--theme-accent)", goldDim: "var(--theme-accent-muted)", surface: "var(--theme-surface)", pageBg: "var(--theme-bg)",
  border: "rgba(var(--theme-accent-rgb),0.12)", borderDim: "rgba(var(--theme-contrast-rgb),0.05)",
  textPrimary: "var(--theme-text)", textSec: "var(--theme-text-muted)", textMuted: "var(--theme-text-faint)",
  green: "var(--theme-success)",
};
const C_Light = {
  gold: "#8B4513", goldDim: "#6F3A18", surface: "#FFFFFF", pageBg: "#FFFBF7",
  border: "rgba(0,0,0,0.15)", borderDim: "rgba(0,0,0,0.12)",
  textPrimary: "#111827", textSec: "rgba(17,24,39,0.82)", textMuted: "rgba(17,24,39,0.62)",
  green: "#2E7D32",
};
const CONTEXTOS = ["Normal", "Parceiro", "Cliente Final", "Residência", "Priceless Band", "Equipamento avulso", "Pack AV", "Operacional", "SUD", "SANA", "Hyatt", "Conta Especial"];
const emptyNew: Draft = { servico: "", duracao_formato: "", contexto: "Normal", cliente_nome: "", custo_interno: "", valor_parceiro: "", valor_cliente_final: "", notas: "", ativo: 1 };
const getColors = (lightTheme: boolean) => lightTheme ? C_Light : C_Dark;
const toNum = (v: string) => parseFloat((v || "").replace(",", ".")) || 0;
function euro(v: number) { return v ? `${v.toLocaleString("pt-PT")}€` : "—"; }
function toDraft(v: ValorMaster): Draft {
  return {
    servico: v.servico || "", duracao_formato: v.duracao_formato || "", contexto: v.contexto || "Normal", cliente_nome: v.cliente_nome || "",
    custo_interno: v.custo_interno ? String(v.custo_interno) : "", valor_parceiro: v.valor_parceiro ? String(v.valor_parceiro) : "",
    valor_cliente_final: v.valor_cliente_final ? String(v.valor_cliente_final) : "", notas: v.notas || "", ativo: v.ativo,
  };
}

export default function ValoresPage() {
  const router = useRouter();
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const C = getColors(lightTheme);
  const [userName, setUserName] = useState("");
  const [rows, setRows] = useState<ValorMaster[]>([]);
  const [servicosPorCriar, setServicosPorCriar] = useState<ServicoPorCriarNaMaster[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [newRow, setNewRow] = useState<Draft>(emptyNew);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2400); };
  const load = useCallback(async () => {
    await setupValoresMaster();
    const r = await getAllValoresMaster();
    if (r.success) {
      const data = r.data as ValorMaster[];
      setRows(data);
      setDrafts(Object.fromEntries(data.map(v => [v.id, toDraft(v)])));
    }
    const pending = await getServicosPorCriarNaMaster();
    if (pending.success) setServicosPorCriar(pending.data as ServicoPorCriarNaMaster[]);
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

  const inputStyle: React.CSSProperties = {
    width: "100%", background: lightTheme ? "rgba(0,0,0,0.03)" : "rgba(var(--theme-contrast-rgb),0.04)",
    border: `1px solid ${C.borderDim}`, color: C.textPrimary, fontFamily: "inherit", fontSize: "10px",
    padding: "0.52rem 0.6rem", outline: "none", boxSizing: "border-box", letterSpacing: "0.02em",
  };
  const btnStyle: React.CSSProperties = {
    background: "transparent", border: `1px solid ${C.border}`, color: C.gold,
    fontSize: "8px", letterSpacing: "0.18em", padding: "0.52rem 0.65rem", cursor: "pointer",
    textTransform: "uppercase", fontFamily: "inherit", fontWeight: 700,
  };
  const grid = "1fr 0.85fr 0.8fr 0.85fr 100px 100px 110px 1fr 78px 86px";
  const updateDraft = (id: number, field: keyof Draft, value: string | number) => setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  const payload = (d: Draft) => ({
    servico: d.servico.trim(), duracao_formato: d.duracao_formato.trim(), contexto: d.contexto.trim() || "Normal", cliente_nome: d.cliente_nome.trim(),
    custo_interno: toNum(d.custo_interno), valor_parceiro: toNum(d.valor_parceiro), valor_cliente_final: toNum(d.valor_cliente_final), notas: d.notas, ativo: d.ativo,
  });
  const saveRow = async (id: number) => {
    const d = drafts[id];
    if (!d?.servico.trim()) { showToast("Serviço obrigatório"); return; }
    setSavingId(id);
    const res = await updateValorMaster(id, payload(d));
    showToast(res.success ? "Valor atualizado" : "Erro ao atualizar");
    await load(); setSavingId(null);
  };
  const createRow = async () => {
    if (!newRow.servico.trim()) { showToast("Serviço obrigatório"); return; }
    const res = await createValorMaster(payload(newRow));
    if (res.success) { setNewRow(emptyNew); showToast("Valor criado"); await load(); }
    else showToast("Erro ao criar valor");
  };
  const toggleAtivo = async (row: ValorMaster) => { await toggleValorMasterAtivo(row.id, row.ativo === 1 ? 0 : 1); await load(); };

  const criarServicoPendente = async (row: ServicoPorCriarNaMaster) => {
    const res = await criarValorMasterAPartirServico(row.servico, row.fee_medio || 0);
    showToast(res.success ? "Serviço criado na Master" : "Erro ao criar serviço");
    await load();
  };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.pageBg, color: C.gold, fontFamily: "'Cormorant Garamond',serif", fontSize: "3rem", letterSpacing: "0.4em" }}>LLE</div>;

  return <>
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: C.pageBg, color: C.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <Nav userName={userName} active="valores" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/"); }} />
      <main style={{ padding: "2rem 2.5rem", maxWidth: "1500px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", gap: "1rem" }}>
          <div>
            <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.textSec, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.4rem" }}>Master de Valores</p>
            <p style={{ fontSize: "11px", color: C.textMuted, letterSpacing: "0.06em" }}>Tabela geral para eventos/propostas. Residências recorrentes ficam na página Residências.</p>
          </div>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
        </div>

        {servicosPorCriar.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, position: "relative", marginBottom: "1rem", padding: "1rem" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: lightTheme ? "rgba(0,0,0,0.2)" : "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", marginBottom: "0.9rem" }}>
              <div>
                <p style={{ fontSize: "8px", letterSpacing: "0.35em", color: C.goldDim, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.35rem" }}>Serviços por criar na Master</p>
                <p style={{ fontSize: "11px", color: C.textMuted, letterSpacing: "0.04em" }}>Serviços já usados em Agenda/Leads mas ainda sem linha na Master. Criar aqui não altera eventos antigos.</p>
              </div>
              <span style={{ fontSize: "18px", fontWeight: 700, color: C.textPrimary }}>{servicosPorCriar.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 90px 110px 1fr 120px", gap: "8px", alignItems: "center" }}>
              {servicosPorCriar.slice(0, 12).map(row => (
                <div key={row.servico} style={{ display: "contents" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: C.textPrimary }}>{row.servico}</div>
                  <div style={{ fontSize: "10px", color: C.textMuted }}>{row.total} usos</div>
                  <div style={{ fontSize: "10px", color: C.textSec }}>fee médio {euro(row.fee_medio)}</div>
                  <div style={{ fontSize: "10px", color: C.textMuted }}>{row.primeira_data || "—"} → {row.ultima_data || "—"}</div>
                  <button onClick={() => criarServicoPendente(row)} style={{ ...btnStyle, background: lightTheme ? "rgba(0,0,0,0.04)" : "rgba(var(--theme-accent-rgb),0.08)" }}>Criar na Master</button>
                </div>
              ))}
            </div>
            {servicosPorCriar.length > 12 && <div style={{ marginTop: "0.75rem", fontSize: "9px", color: C.textMuted }}>A mostrar 12 de {servicosPorCriar.length}. Vai criando para aparecerem os restantes.</div>}
          </div>
        )}

        <datalist id="servicos-vendidos-list">
          {SERVICOS_VENDIDOS.map(s => <option key={s} value={s} />)}
        </datalist>

        <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, position: "relative", overflowX: "auto" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: lightTheme ? "rgba(0,0,0,0.2)" : "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" }} />
          <div style={{ minWidth: 1220 }}>
            <div style={{ display: "grid", gridTemplateColumns: grid, gap: "8px", padding: "0.8rem 1rem", borderBottom: `1px solid ${C.border}` }}>
              {["Serviço", "Formato", "Contexto", "Cliente/Local", "Custo Interno", "Parceiro", "Cliente Final", "Notas", "Estado", "Ações"].map(h => <span key={h} style={{ fontSize: "7px", letterSpacing: "0.22em", color: C.goldDim, textTransform: "uppercase", fontWeight: 700 }}>{h}</span>)}
            </div>
            {rows.map(row => {
              const d = drafts[row.id];
              return <div key={row.id} style={{ display: "grid", gridTemplateColumns: grid, gap: "8px", alignItems: "center", padding: "0.6rem 1rem", borderBottom: `1px solid ${C.borderDim}`, opacity: row.ativo === 0 ? 0.45 : 1 }}>
                <input list="servicos-vendidos-list" value={d?.servico || ""} onChange={e => updateDraft(row.id, "servico", e.target.value)} placeholder="DJ s/ AV" style={inputStyle} />
                <input value={d?.duracao_formato || ""} onChange={e => updateDraft(row.id, "duracao_formato", e.target.value)} placeholder="até 4h" style={inputStyle} />
                <select value={d?.contexto || "Normal"} onChange={e => updateDraft(row.id, "contexto", e.target.value)} style={inputStyle}>{CONTEXTOS.map(c => <option key={c} value={c}>{c}</option>)}</select>
                <input value={d?.cliente_nome || ""} onChange={e => updateDraft(row.id, "cliente_nome", e.target.value)} placeholder="Opcional" style={inputStyle} />
                <input value={d?.custo_interno || ""} onChange={e => updateDraft(row.id, "custo_interno", e.target.value)} inputMode="decimal" placeholder="0" style={{ ...inputStyle, textAlign: "right" }} />
                <input value={d?.valor_parceiro || ""} onChange={e => updateDraft(row.id, "valor_parceiro", e.target.value)} inputMode="decimal" placeholder="0" style={{ ...inputStyle, textAlign: "right" }} />
                <input value={d?.valor_cliente_final || ""} onChange={e => updateDraft(row.id, "valor_cliente_final", e.target.value)} inputMode="decimal" placeholder="0" style={{ ...inputStyle, textAlign: "right" }} />
                <input value={d?.notas || ""} onChange={e => updateDraft(row.id, "notas", e.target.value)} placeholder="Exceções..." style={inputStyle} />
                <button onClick={() => toggleAtivo(row)} style={{ ...btnStyle, color: row.ativo === 1 ? C.green : C.textMuted }}>{row.ativo === 1 ? "Ativo" : "Inativo"}</button>
                <button onClick={() => saveRow(row.id)} disabled={savingId === row.id} style={{ ...btnStyle, background: lightTheme ? "rgba(0,0,0,0.04)" : "rgba(var(--theme-accent-rgb),0.08)" }}>{savingId === row.id ? "..." : "Guardar"}</button>
              </div>;
            })}
            <div style={{ display: "grid", gridTemplateColumns: grid, gap: "8px", alignItems: "center", padding: "1rem", background: lightTheme ? "rgba(0,0,0,0.02)" : "rgba(var(--theme-accent-rgb),0.03)" }}>
              <input list="servicos-vendidos-list" value={newRow.servico} onChange={e => setNewRow(r => ({ ...r, servico: e.target.value }))} placeholder="Novo serviço..." style={inputStyle} />
              <input value={newRow.duracao_formato} onChange={e => setNewRow(r => ({ ...r, duracao_formato: e.target.value }))} placeholder="até 4h" style={inputStyle} />
              <select value={newRow.contexto} onChange={e => setNewRow(r => ({ ...r, contexto: e.target.value }))} style={inputStyle}>{CONTEXTOS.map(c => <option key={c} value={c}>{c}</option>)}</select>
              <input value={newRow.cliente_nome} onChange={e => setNewRow(r => ({ ...r, cliente_nome: e.target.value }))} placeholder="Cliente/local" style={inputStyle} />
              <input value={newRow.custo_interno} onChange={e => setNewRow(r => ({ ...r, custo_interno: e.target.value }))} inputMode="decimal" placeholder="Custo" style={{ ...inputStyle, textAlign: "right" }} />
              <input value={newRow.valor_parceiro} onChange={e => setNewRow(r => ({ ...r, valor_parceiro: e.target.value }))} inputMode="decimal" placeholder="Parceiro" style={{ ...inputStyle, textAlign: "right" }} />
              <input value={newRow.valor_cliente_final} onChange={e => setNewRow(r => ({ ...r, valor_cliente_final: e.target.value }))} inputMode="decimal" placeholder="Cliente" style={{ ...inputStyle, textAlign: "right" }} />
              <input value={newRow.notas} onChange={e => setNewRow(r => ({ ...r, notas: e.target.value }))} placeholder="Notas..." style={inputStyle} />
              <span style={{ fontSize: "8px", color: C.textMuted, letterSpacing: "0.2em", textTransform: "uppercase" }}>Novo</span>
              <button onClick={createRow} style={{ ...btnStyle, background: C.gold, color: lightTheme ? "#FFFFFF" : "var(--theme-bg)" }}>Criar</button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
          <Metric label="Linhas ativas" value={String(rows.filter(r => r.ativo === 1).length)} C={C} />
          <Metric label="Serviços" value={String(new Set(rows.filter(r => r.ativo === 1).map(r => r.servico)).size)} C={C} />
          <Metric label="Custo médio" value={euro(avg(rows.filter(r => r.ativo === 1).map(r => r.custo_interno).filter(Boolean)))} C={C} />
          <Metric label="Cliente médio" value={euro(avg(rows.filter(r => r.ativo === 1).map(r => r.valor_cliente_final).filter(Boolean)))} C={C} />
        </div>
      </main>
    </div>

    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: C.textPrimary, opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.1rem", borderBottom: `1px solid ${C.borderDim}`, background: C.pageBg, position: "sticky", top: 0, zIndex: 10 }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.2rem", letterSpacing: "0.35em", color: C.gold, fontWeight: 300 }}>LLE</span>
        <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} style={{ fontSize: "10px", padding: "0.4rem 0.5rem" }} />
      </div>
      <div style={{ padding: "1rem", borderBottom: `1px solid ${C.borderDim}` }}>
        <p style={{ fontSize: "9px", letterSpacing: "0.35em", color: C.textSec, textTransform: "uppercase", fontWeight: 700 }}>Master de Valores</p>
        <p style={{ fontSize: "11px", color: C.textMuted, marginTop: "0.4rem" }}>Eventos normais, parceiros e cliente final. Residências ficam à parte.</p>
      </div>
      {servicosPorCriar.length > 0 && (
        <div style={{ padding: "0.9rem 1rem", borderBottom: `1px solid ${C.borderDim}` }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.25em", color: C.gold, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.5rem" }}>Serviços por criar</div>
          {servicosPorCriar.slice(0, 4).map(row => (
            <div key={row.servico} style={{ padding: "0.55rem 0", borderTop: `1px solid ${C.borderDim}` }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: C.textPrimary }}>{row.servico}</div>
              <div style={{ fontSize: "10px", color: C.textSec, marginTop: "2px" }}>{row.total} usos · fee médio {euro(row.fee_medio)}</div>
              <button onClick={() => criarServicoPendente(row)} style={{ marginTop: "0.45rem", background: lightTheme ? "rgba(0,0,0,0.04)" : "rgba(var(--theme-accent-rgb),0.12)", border: `1px solid ${C.border}`, color: C.gold, fontSize: "9px", padding: "0.45rem 0.65rem", cursor: "pointer" }}>Criar na Master</button>
            </div>
          ))}
        </div>
      )}

      <div className="mob-list">
        {rows.map(row => <div key={row.id} style={{ padding: "1rem", borderBottom: `1px solid ${C.borderDim}`, opacity: row.ativo === 0 ? 0.45 : 1 }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: C.textPrimary }}>{row.servico}</div>
          <div style={{ fontSize: "11px", color: C.textSec, marginTop: "0.35rem" }}>{row.duracao_formato || "Sem formato"} · {row.contexto}{row.cliente_nome ? ` · ${row.cliente_nome}` : ""}</div>
          <div style={{ fontSize: "11px", color: C.textSec, marginTop: "0.35rem" }}>Custo: {euro(row.custo_interno)} · Parceiro: {euro(row.valor_parceiro)} · Cliente: {euro(row.valor_cliente_final)}</div>
          {row.notas && <div style={{ fontSize: "10px", color: C.textMuted, marginTop: "0.35rem" }}>{row.notas}</div>}
        </div>)}
      </div>
      <MobTabBar active="valores" role="admin" lightTheme={lightTheme} />
    </div>
    <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: C.surface, border: `1px solid ${C.border}`, color: C.gold, fontSize: "10px", letterSpacing: "0.25em", padding: "1rem 1.5rem", zIndex: 2000, transform: toast ? "translateX(0)" : "translateX(200%)", transition: "transform 0.3s ease", textTransform: "uppercase", fontWeight: 600 }}>{toast}</div>
  </>;
}

function avg(values: number[]) { return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0; }
function Metric({ label, value, C }: { label: string; value: string; C: typeof C_Dark }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, padding: "1rem" }}><div style={{ fontSize: "7px", letterSpacing: "0.35em", color: C.textMuted, textTransform: "uppercase", marginBottom: "0.5rem" }}>{label}</div><div style={{ fontSize: "18px", fontWeight: 700, color: C.textPrimary }}>{value}</div></div>;
}

function Nav({ userName, active, onLogout }: { userName: string; active: string; onLogout: () => void }) {
  const stored = typeof window !== "undefined" ? localStorage.getItem("lle_user") : null;
  const role = stored ? JSON.parse(stored).role : "admin";
  const allLinks = [
    { href: "/dashboard", label: "Dashboard" }, { href: "/agenda", label: "Agenda" }, { href: "/leads", label: "Leads" },
    { href: "/faturacao", label: "Faturação" }, { href: "/pagamentos", label: "Pagamentos" }, { href: "/colaboradores", label: "Colaboradores" },
    { href: "/valores", label: "Valores" }, { href: "/residencias", label: "Residências" }, { href: "/clientes", label: "Clientes" },
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
  return <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 2.5rem", borderBottom: "1px solid var(--theme-border)", position: "sticky", top: 0, zIndex: 100, background: "var(--theme-nav-bg)", backdropFilter: "blur(12px)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}><span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.3rem", letterSpacing: "0.35em", color: "var(--theme-accent)", fontWeight: 300 }}>LLE</span><div style={{ display: "flex", gap: "0.25rem" }}>{links.map(l => <a key={l.href} href={l.href} style={{ fontSize: "9px", letterSpacing: "0.25em", padding: "0.5rem 0.65rem", textTransform: "uppercase", fontWeight: 500, color: active === l.href.slice(1) ? "var(--theme-accent)" : "var(--theme-text-muted)", textDecoration: "none", fontFamily: "'Montserrat','Helvetica Neue',sans-serif" }}>{l.label}</a>)}</div></div>
    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}><span style={{ fontSize: "9px", letterSpacing: "0.3em", color: "var(--theme-text-faint)", textTransform: "uppercase" }}>{userName}</span><button onClick={onLogout} style={{ background: "transparent", border: "1px solid rgba(var(--theme-accent-rgb),0.12)", color: "var(--theme-text-faint)", fontSize: "8px", letterSpacing: "0.4em", padding: "0.5rem 1rem", cursor: "pointer", textTransform: "uppercase", fontFamily: "inherit", fontWeight: 600 }}>SAIR</button></div>
  </nav>;
}

function MobTabBar({ active, role, lightTheme }: { active: string; role: string; lightTheme: boolean }) {
  const [maisOpen, setMaisOpen] = useState(false);
  const drawerBg = lightTheme ? "#FFFFFF" : "var(--theme-surface)";
  const drawerBorder = lightTheme ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(var(--theme-accent-rgb),0.15)";
  const drawerMuted = lightTheme ? "rgba(0,0,0,0.65)" : "var(--theme-text-muted)";
  const drawerGold = lightTheme ? "#000000" : "var(--theme-accent)";
  const drawerActiveBg = lightTheme ? "rgba(0,0,0,0.06)" : "rgba(var(--theme-accent-rgb),0.08)";
  const mainTabs = [{ href: "/agenda", label: "Agenda", id: "agenda" }, { href: "/leads", label: "Leads", id: "leads" }, { href: "/faturacao", label: "Faturação", id: "faturacao" }, { href: "/colaboradores", label: "Equipa", id: "colaboradores" }];
  const maisTabs = role === "admin" ? [
    { href: "/clientes", label: "Clientes", id: "clientes" }, { href: "/pagamentos", label: "Pagamentos", id: "pagamentos" }, { href: "/dashboard", label: "Dashboard", id: "dashboard" },
    { href: "/valores", label: "Valores", id: "valores" }, { href: "/residencias", label: "Residências", id: "residencias" }, { href: "/materiais", label: "Materiais", id: "materiais" },
  ] : role === "finance" ? [{ href: "/clientes", label: "Clientes", id: "clientes" }, { href: "/pagamentos", label: "Pagamentos", id: "pagamentos" }] : role !== "limited_novalues" ? [{ href: "/materiais", label: "Materiais", id: "materiais" }] : [];
  const activeInMais = maisTabs.some(t => t.id === active);
  return <>{maisOpen && <div onClick={() => setMaisOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 199, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }} />}<div style={{ position: "fixed", bottom: "calc(60px + env(safe-area-inset-bottom))", left: 0, right: 0, zIndex: 200, transform: maisOpen ? "translateY(0)" : "translateY(110%)", transition: "transform 0.25s cubic-bezier(0.32,0.72,0,1)", background: drawerBg, borderTop: drawerBorder, borderRadius: "16px 16px 0 0", padding: "0.75rem 0.5rem", boxShadow: lightTheme ? "0 -8px 32px rgba(0,0,0,0.15)" : "0 -8px 32px rgba(0,0,0,0.6)" }}><div style={{ display: "flex", justifyContent: "space-around", padding: "0 0.5rem", flexWrap: "wrap" }}>{maisTabs.map(t => <a key={t.href} href={t.href} onClick={() => setMaisOpen(false)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", textDecoration: "none", padding: "0.6rem 0.7rem", minWidth: "64px", color: active === t.id ? drawerGold : drawerMuted, background: active === t.id ? drawerActiveBg : "transparent", borderRadius: "10px", fontSize: "9px" }}>{t.label}</a>)}</div></div><nav className="mob-tabbar">{mainTabs.map(l => <a key={l.href} href={l.href} className={`mob-tab${active === l.id ? " active" : ""}`}><span className="mob-tab-icon">●</span><span className="mob-tab-label">{l.label}</span></a>)}{maisTabs.length > 0 && <button onClick={() => setMaisOpen(v => !v)} className={`mob-tab${activeInMais ? " active" : ""}`} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}><span className="mob-tab-icon">•••</span><span className="mob-tab-label">{maisOpen ? "Fechar" : "Mais"}</span></button>}</nav></>;
}
