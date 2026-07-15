"use client";

import MobTabBar from "../MobTabBar";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "../useTheme";
import { ThemeSwitcher } from "../ThemeSwitcher";
import {
  getValoresMasterTable, createValorMaster,
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
  valor_sud: number;
  valor_cliente_final: number;
  notas: string;
  ativo: number;
}

interface ServicoPorCriarNaMaster {
  servico: string; total: number; primeira_data: string; ultima_data: string; fee_medio: number;
}

type Draft = {
  servico: string; duracao_formato: string; contexto: string; cliente_nome: string;
  custo_interno: string; valor_parceiro: string; valor_sud: string; valor_cliente_final: string; notas: string; ativo: number;
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
const emptyNew: Draft = { servico: "", duracao_formato: "", contexto: "Normal", cliente_nome: "", custo_interno: "", valor_parceiro: "", valor_sud: "", valor_cliente_final: "", notas: "", ativo: 1 };
const getColors = (lightTheme: boolean) => lightTheme ? C_Light : C_Dark;
const toNum = (v: string) => parseFloat((v || "").replace(",", ".")) || 0;
function euro(v: number) { return v ? `${v.toLocaleString("pt-PT")}€` : "—"; }
function toDraft(v: ValorMaster): Draft {
  return {
    servico: v.servico || "", duracao_formato: v.duracao_formato || "", contexto: v.contexto || "Normal", cliente_nome: v.cliente_nome || "",
    custo_interno: v.custo_interno ? String(v.custo_interno) : "", valor_parceiro: v.valor_parceiro ? String(v.valor_parceiro) : "",
    valor_sud: v.valor_sud ? String(v.valor_sud) : "", valor_cliente_final: v.valor_cliente_final ? String(v.valor_cliente_final) : "", notas: v.notas || "", ativo: v.ativo,
  };
}

export default function ValoresPage() {
  const router = useRouter();
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const C = getColors(lightTheme);
  const [userName, setUserName] = useState("");
  const [rows, setRows] = useState<ValorMaster[]>([]);
  const [servicosPorCriar, setServicosPorCriar] = useState<ServicoPorCriarNaMaster[]>([]);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [newRow, setNewRow] = useState<Draft>(emptyNew);
  const [loading, setLoading] = useState(true);
  const [mobileView, setMobileView] = useState<boolean | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [mobileEditingId, setMobileEditingId] = useState<number | null>(null);
  const [mobileNewOpen, setMobileNewOpen] = useState(false);
  const [mobileShowInactive, setMobileShowInactive] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2400); };
  const load = useCallback(async () => {
    const r = await getValoresMasterTable();
    if (r.success) {
      const data = r.data as ValorMaster[];
      setRows(data);
      setDrafts(Object.fromEntries(data.map(v => [v.id, toDraft(v)])));
    }
    setLoading(false);
  }, []);

  const loadPendingServices = async () => {
    if (pendingLoaded) {
      setPendingLoaded(false);
      return;
    }
    setPendingLoading(true);
    const pending = await getServicosPorCriarNaMaster();
    if (pending.success) setServicosPorCriar(pending.data as ServicoPorCriarNaMaster[]);
    setPendingLoaded(true);
    setPendingLoading(false);
  };

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setMobileView(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
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
  const grid = "1.25fr 0.9fr 100px 100px 100px 110px 1.2fr 78px 86px";
  const updateDraft = (id: number, field: keyof Draft, value: string | number) => setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  const payload = (d: Draft) => ({
    servico: d.servico.trim(), duracao_formato: d.duracao_formato.trim(), contexto: d.contexto.trim() || "Normal", cliente_nome: d.cliente_nome.trim(),
    custo_interno: toNum(d.custo_interno), valor_parceiro: toNum(d.valor_parceiro), valor_sud: toNum(d.valor_sud), valor_cliente_final: toNum(d.valor_cliente_final), notas: d.notas, ativo: d.ativo,
  });
  const saveRow = async (id: number) => {
    const d = drafts[id];
    if (!d?.servico.trim()) { showToast("Serviço obrigatório"); return false; }
    setSavingId(id);
    const res = await updateValorMaster(id, payload(d));
    showToast(res.success ? "Valor atualizado" : "Erro ao atualizar");
    await load();
    setSavingId(null);
    return res.success;
  };
  const createRow = async () => {
    if (!newRow.servico.trim()) { showToast("Serviço obrigatório"); return false; }
    setCreating(true);
    const res = await createValorMaster(payload(newRow));
    if (res.success) {
      setNewRow(emptyNew);
      showToast("Valor criado");
      await load();
    } else {
      showToast("Erro ao criar valor");
    }
    setCreating(false);
    return res.success;
  };
  const toggleAtivo = async (row: ValorMaster) => {
    const res = await toggleValorMasterAtivo(row.id, row.ativo === 1 ? 0 : 1);
    showToast(res.success ? (row.ativo === 1 ? "Valor apagado" : "Valor restaurado") : "Erro ao alterar valor");
    await load();
  };
  const apagarMobile = async (row: ValorMaster) => {
    if (row.ativo === 0) { await toggleAtivo(row); return; }
    const confirmed = window.confirm("Apagar este valor? Ficará inativo e poderá ser restaurado em ‘Mostrar inativos’.");
    if (!confirmed) return;
    await toggleAtivo(row);
    if (mobileEditingId === row.id) setMobileEditingId(null);
  };

  const criarServicoPendente = async (row: ServicoPorCriarNaMaster) => {
    const res = await criarValorMasterAPartirServico(row.servico, row.fee_medio || 0);
    showToast(res.success ? "Serviço criado na Master" : "Erro ao criar serviço");
    await load();
  };

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-PT");
  const filteredRows = normalizedSearch
    ? rows.filter(row => `${row.servico} ${row.duracao_formato} ${row.notas}`.toLocaleLowerCase("pt-PT").includes(normalizedSearch))
    : rows;

  if (loading || mobileView === null) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.pageBg, color: C.gold, fontFamily: "'Cormorant Garamond',serif", fontSize: "3rem", letterSpacing: "0.4em" }}>LLE</div>;

  return <>
    {mobileView === false && (
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: C.pageBg, color: C.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <Nav userName={userName} active="valores" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/"); }} />
      <main style={{ padding: "2rem 2.5rem", maxWidth: "1500px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", gap: "1rem" }}>
          <div>
            <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.textSec, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.4rem" }}>Master de Valores</p>
            <p style={{ fontSize: "11px", color: C.textMuted, letterSpacing: "0.06em" }}>Apenas serviços e artistas. Materiais e residências são geridos nos respetivos módulos; o contexto é escolhido na Agenda ou nas Leads.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar serviço..." style={{ ...inputStyle, width: 230, fontSize: "11px" }} />
            <button onClick={loadPendingServices} disabled={pendingLoading} style={btnStyle}>{pendingLoading ? "A analisar..." : pendingLoaded ? "Ocultar análise" : "Analisar serviços"}</button>
            <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
          </div>
        </div>

        {pendingLoaded && servicosPorCriar.length > 0 && (
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
          <div style={{ minWidth: 1120 }}>
            <div style={{ display: "grid", gridTemplateColumns: grid, gap: "8px", padding: "0.8rem 1rem", borderBottom: `1px solid ${C.border}` }}>
              {["Serviço", "Formato", "Custo Interno", "Parceiro", "SUD", "Cliente Final", "Notas", "Estado", "Ações"].map(h => <span key={h} style={{ fontSize: "7px", letterSpacing: "0.22em", color: C.goldDim, textTransform: "uppercase", fontWeight: 700 }}>{h}</span>)}
            </div>
            {filteredRows.map(row => {
              const d = drafts[row.id];
              return <div key={row.id} style={{ display: "grid", gridTemplateColumns: grid, gap: "8px", alignItems: "center", padding: "0.6rem 1rem", borderBottom: `1px solid ${C.borderDim}`, opacity: row.ativo === 0 ? 0.45 : 1 }}>
                <input list="servicos-vendidos-list" value={d?.servico || ""} onChange={e => updateDraft(row.id, "servico", e.target.value)} placeholder="DJ s/ AV" style={inputStyle} />
                <input value={d?.duracao_formato || ""} onChange={e => updateDraft(row.id, "duracao_formato", e.target.value)} placeholder="até 4h" style={inputStyle} />
                <input value={d?.custo_interno || ""} onChange={e => updateDraft(row.id, "custo_interno", e.target.value)} inputMode="decimal" placeholder="0" style={{ ...inputStyle, textAlign: "right" }} />
                <input value={d?.valor_parceiro || ""} onChange={e => updateDraft(row.id, "valor_parceiro", e.target.value)} inputMode="decimal" placeholder="0" style={{ ...inputStyle, textAlign: "right" }} />
                <input value={d?.valor_sud || ""} onChange={e => updateDraft(row.id, "valor_sud", e.target.value)} inputMode="decimal" placeholder="0" style={{ ...inputStyle, textAlign: "right" }} />
                <input value={d?.valor_cliente_final || ""} onChange={e => updateDraft(row.id, "valor_cliente_final", e.target.value)} inputMode="decimal" placeholder="0" style={{ ...inputStyle, textAlign: "right" }} />
                <input value={d?.notas || ""} onChange={e => updateDraft(row.id, "notas", e.target.value)} placeholder="Exceções..." style={inputStyle} />
                <button onClick={() => toggleAtivo(row)} style={{ ...btnStyle, color: row.ativo === 1 ? C.green : C.textMuted }}>{row.ativo === 1 ? "Ativo" : "Inativo"}</button>
                <button onClick={() => saveRow(row.id)} disabled={savingId === row.id} style={{ ...btnStyle, background: lightTheme ? "rgba(0,0,0,0.04)" : "rgba(var(--theme-accent-rgb),0.08)" }}>{savingId === row.id ? "..." : "Guardar"}</button>
              </div>;
            })}
            <div style={{ display: "grid", gridTemplateColumns: grid, gap: "8px", alignItems: "center", padding: "1rem", background: lightTheme ? "rgba(0,0,0,0.02)" : "rgba(var(--theme-accent-rgb),0.03)" }}>
              <input list="servicos-vendidos-list" value={newRow.servico} onChange={e => setNewRow(r => ({ ...r, servico: e.target.value }))} placeholder="Novo serviço..." style={inputStyle} />
              <input value={newRow.duracao_formato} onChange={e => setNewRow(r => ({ ...r, duracao_formato: e.target.value }))} placeholder="até 4h" style={inputStyle} />
              <input value={newRow.custo_interno} onChange={e => setNewRow(r => ({ ...r, custo_interno: e.target.value }))} inputMode="decimal" placeholder="Custo" style={{ ...inputStyle, textAlign: "right" }} />
              <input value={newRow.valor_parceiro} onChange={e => setNewRow(r => ({ ...r, valor_parceiro: e.target.value }))} inputMode="decimal" placeholder="Parceiro" style={{ ...inputStyle, textAlign: "right" }} />
              <input value={newRow.valor_sud} onChange={e => setNewRow(r => ({ ...r, valor_sud: e.target.value }))} inputMode="decimal" placeholder="SUD" style={{ ...inputStyle, textAlign: "right" }} />
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
    )}

    {mobileView === true && (
    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: C.textPrimary, opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.1rem", borderBottom: `1px solid ${C.borderDim}`, background: C.pageBg, position: "sticky", top: 0, zIndex: 10 }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.2rem", letterSpacing: "0.35em", color: C.gold, fontWeight: 300 }}>LLE</span>
        <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} style={{ fontSize: "10px", padding: "0.4rem 0.5rem" }} />
      </div>

      <div style={{ padding: "1rem", borderBottom: `1px solid ${C.borderDim}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.8rem" }}>
          <div>
            <p style={{ fontSize: "9px", letterSpacing: "0.35em", color: C.textSec, textTransform: "uppercase", fontWeight: 700 }}>Master de Valores</p>
            <p style={{ fontSize: "11px", color: C.textMuted, marginTop: "0.4rem", lineHeight: 1.45 }}>Apenas serviços e artistas: custo interno, parceiro, SUD e cliente final. Materiais e residências ficam nos respetivos módulos.</p>
          </div>
          <button
            type="button"
            onClick={() => { setMobileNewOpen(value => !value); setMobileEditingId(null); }}
            style={{ ...btnStyle, flexShrink: 0, background: C.gold, color: lightTheme ? "#FFFFFF" : "var(--theme-bg)", padding: "0.65rem 0.75rem" }}
          >
            {mobileNewOpen ? "Fechar" : "+ Adicionar"}
          </button>
        </div>

        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar serviço..." style={{ ...inputStyle, marginTop: "0.8rem", fontSize: "12px" }} />
        <button type="button" onClick={loadPendingServices} disabled={pendingLoading} style={{ ...btnStyle, width: "100%", marginTop: "0.55rem" }}>
          {pendingLoading ? "A analisar serviços usados..." : pendingLoaded ? "Ocultar serviços por criar" : "Ver serviços por criar"}
        </button>

        {mobileNewOpen && (
          <div style={{ marginTop: "0.9rem", padding: "0.9rem", background: C.surface, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: "9px", letterSpacing: "0.22em", color: C.gold, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.75rem" }}>Novo valor</div>
            <MobileValorFields draft={newRow} onChange={(field, value) => setNewRow(row => ({ ...row, [field]: value }))} inputStyle={inputStyle} C={C} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem", marginTop: "0.75rem" }}>
              <button type="button" onClick={() => { setNewRow(emptyNew); setMobileNewOpen(false); }} style={btnStyle}>Cancelar</button>
              <button
                type="button"
                disabled={creating}
                onClick={async () => { if (await createRow()) setMobileNewOpen(false); }}
                style={{ ...btnStyle, background: C.gold, color: lightTheme ? "#FFFFFF" : "var(--theme-bg)", opacity: creating ? 0.6 : 1 }}
              >
                {creating ? "A criar..." : "Criar valor"}
              </button>
            </div>
          </div>
        )}
      </div>

      {pendingLoaded && servicosPorCriar.length > 0 && (
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", borderBottom: `1px solid ${C.borderDim}`, background: lightTheme ? "rgba(0,0,0,0.02)" : "rgba(var(--theme-accent-rgb),0.025)" }}>
        <span style={{ fontSize: "10px", color: C.textMuted }}>{rows.filter(row => row.ativo === 1).length} valores ativos</span>
        <button type="button" onClick={() => setMobileShowInactive(value => !value)} style={{ ...btnStyle, padding: "0.45rem 0.55rem" }}>
          {mobileShowInactive ? "Ocultar inativos" : `Mostrar inativos (${rows.filter(row => row.ativo === 0).length})`}
        </button>
      </div>

      <div className="mob-list mob-values-list">
        {filteredRows.filter(row => mobileShowInactive || row.ativo === 1).map(row => {
          const editing = mobileEditingId === row.id;
          const d = drafts[row.id] || toDraft(row);
          return (
            <div key={row.id} style={{ padding: "1rem", borderBottom: `1px solid ${C.borderDim}`, background: editing ? (lightTheme ? "rgba(139,69,19,0.035)" : "rgba(var(--theme-accent-rgb),0.035)") : "transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.7rem" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: C.textPrimary, overflowWrap: "anywhere" }}>{row.servico}</div>
                  <div style={{ fontSize: "11px", color: C.textSec, marginTop: "0.35rem", lineHeight: 1.45 }}>{row.duracao_formato || "Sem formato"}</div>
                </div>
                <span style={{ flexShrink: 0, fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", padding: "0.3rem 0.45rem", border: `1px solid ${row.ativo === 1 ? C.border : C.borderDim}`, color: row.ativo === 1 ? C.green : C.textMuted }}>
                  {row.ativo === 1 ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: C.textSec, marginTop: "0.45rem", lineHeight: 1.55 }}>Custo: {euro(row.custo_interno)} · Parceiro: {euro(row.valor_parceiro)} · SUD: {euro(row.valor_sud)} · Cliente final: {euro(row.valor_cliente_final)}</div>
              {row.notas && <div style={{ fontSize: "10px", color: C.textMuted, marginTop: "0.35rem", lineHeight: 1.5 }}>{row.notas}</div>}

              {!editing && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem", marginTop: "0.8rem" }}>
                  <button type="button" onClick={() => { setMobileEditingId(row.id); setMobileNewOpen(false); }} style={{ ...btnStyle, background: lightTheme ? "rgba(0,0,0,0.04)" : "rgba(var(--theme-accent-rgb),0.08)" }}>Editar</button>
                  <button
                    type="button"
                    onClick={() => apagarMobile(row)}
                    style={{ ...btnStyle, color: row.ativo === 1 ? (lightTheme ? "#B42318" : "#FF8A80") : C.green, borderColor: row.ativo === 1 ? "rgba(220,80,80,0.35)" : C.border }}
                  >
                    {row.ativo === 1 ? "Apagar" : "Restaurar"}
                  </button>
                </div>
              )}

              {editing && (
                <div style={{ marginTop: "0.9rem", paddingTop: "0.9rem", borderTop: `1px solid ${C.border}` }}>
                  <MobileValorFields draft={d} onChange={(field, value) => updateDraft(row.id, field, value)} inputStyle={inputStyle} C={C} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem", marginTop: "0.75rem" }}>
                    <button type="button" onClick={() => { setDrafts(prev => ({ ...prev, [row.id]: toDraft(row) })); setMobileEditingId(null); }} style={btnStyle}>Cancelar</button>
                    <button
                      type="button"
                      disabled={savingId === row.id}
                      onClick={async () => { if (await saveRow(row.id)) setMobileEditingId(null); }}
                      style={{ ...btnStyle, background: C.gold, color: lightTheme ? "#FFFFFF" : "var(--theme-bg)", opacity: savingId === row.id ? 0.6 : 1 }}
                    >
                      {savingId === row.id ? "A guardar..." : "Guardar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <MobTabBar active="valores" role="admin" lightTheme={lightTheme} />
    </div>
    )}
    <div className="values-toast" style={{ position: "fixed", bottom: "2rem", right: "2rem", background: C.surface, border: `1px solid ${C.border}`, color: C.gold, fontSize: "10px", letterSpacing: "0.25em", padding: "1rem 1.5rem", zIndex: 2000, transform: toast ? "translateX(0)" : "translateX(200%)", transition: "transform 0.3s ease", textTransform: "uppercase", fontWeight: 600 }}>{toast}</div>
  </>;
}


function MobileValorFields({
  draft,
  onChange,
  inputStyle,
  C,
}: {
  draft: Draft;
  onChange: (field: keyof Draft, value: string) => void;
  inputStyle: React.CSSProperties;
  C: typeof C_Dark;
}) {
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "8px", letterSpacing: "0.16em", color: C.textMuted, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.28rem" };
  const fieldStyle: React.CSSProperties = { minWidth: 0 };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
      <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}><span style={labelStyle}>Serviço</span><input list="servicos-vendidos-list" value={draft.servico} onChange={event => onChange("servico", event.target.value)} placeholder="Nome do serviço" style={{ ...inputStyle, fontSize: "12px" }} /></label>
      <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}><span style={labelStyle}>Formato</span><input value={draft.duracao_formato} onChange={event => onChange("duracao_formato", event.target.value)} placeholder="até 4h" style={{ ...inputStyle, fontSize: "12px" }} /></label>
      <label style={fieldStyle}><span style={labelStyle}>Custo interno</span><input value={draft.custo_interno} onChange={event => onChange("custo_interno", event.target.value)} inputMode="decimal" placeholder="0" style={{ ...inputStyle, fontSize: "12px" }} /></label>
      <label style={fieldStyle}><span style={labelStyle}>Parceiro</span><input value={draft.valor_parceiro} onChange={event => onChange("valor_parceiro", event.target.value)} inputMode="decimal" placeholder="0" style={{ ...inputStyle, fontSize: "12px" }} /></label>
      <label style={fieldStyle}><span style={labelStyle}>SUD</span><input value={draft.valor_sud} onChange={event => onChange("valor_sud", event.target.value)} inputMode="decimal" placeholder="0" style={{ ...inputStyle, fontSize: "12px" }} /></label>
      <label style={fieldStyle}><span style={labelStyle}>Cliente final</span><input value={draft.valor_cliente_final} onChange={event => onChange("valor_cliente_final", event.target.value)} inputMode="decimal" placeholder="0" style={{ ...inputStyle, fontSize: "12px" }} /></label>
      <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}><span style={labelStyle}>Notas</span><textarea value={draft.notas} onChange={event => onChange("notas", event.target.value)} placeholder="Exceções ou observações" rows={3} style={{ ...inputStyle, fontSize: "12px", resize: "vertical" }} /></label>
    </div>
  );
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

