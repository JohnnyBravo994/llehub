"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DesktopNav from "../DesktopNav";
import MobTabBar from "../MobTabBar";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { useTheme } from "../useTheme";
import { getAnnualReportData, saveReportMonthlyCosts } from "../actions";

type Mes = {
  mes: number; eventos: number; faturado: number; faturadoAnterior: number; faturadoMesAnterior: number;
  dentro: number; fora: number; custoDentro: number; custoFora: number;
  custo: number; gastosFixos: number | null; vencimentos: number | null;
};
type Linha = {
  id: number; origem: string; data: string; descricao: string; cliente: string;
  estado: string; categoria: string; modalidade: string; dentro: number; fora: number;
  faturado: number; custo: number; lucro: number; custo_dentro: number; custo_fora: number;
};
const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fmt = (v: number) => Number(v || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const formatDate = (v: string) => v ? v.split("-").reverse().join("/") : "—";
function classificar(v: string) {
  if (/casament|wedding/i.test(v)) return "Casamentos";
  if (/resid[eê]nci/i.test(v)) return "Residências";
  return "Eventos";
}

export default function MonthlyReportPage() {
  const router = useRouter();
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const [role, setRole] = useState("admin");
  const [userName, setUserName] = useState("");
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [mesSelecionado, setMesSelecionado] = useState(() => new Date().getMonth() + 1);
  const [meses, setMeses] = useState<Mes[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [excluidos, setExcluidos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [categoria, setCategoria] = useState("Todas");

  useEffect(() => {
    try {
      const u = localStorage.getItem("lle_user");
      if (!u) { router.replace("/"); return; }
      const parsed = JSON.parse(u);
      if (!["admin", "finance"].includes(parsed.role)) { router.replace("/agenda"); return; }
      setUserName(parsed.name || ""); setRole(parsed.role); setAuthorized(true);
    } catch { router.replace("/"); }
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    let alive = true;
    setLoading(true); setFeedback("");
    getAnnualReportData(ano).then(r => {
      if (!alive) return;
      if (r.success) {
        setMeses(r.meses as Mes[]); setLinhas(r.linhas as Linha[]); setExcluidos(r.excluidos);
      } else { setMeses([]); setLinhas([]); setFeedback(r.message || "Não foi possível calcular o relatório."); }
    }).catch(() => { if (alive) setFeedback("Erro de ligação ao relatório."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authorized, ano]);

  const mes = meses.find(m => m.mes === mesSelecionado);
  const linhasMes = useMemo(() => linhas.filter(l => Number(l.data.slice(5, 7)) === mesSelecionado), [linhas, mesSelecionado]);
  const detalhes = useMemo(() => linhasMes.filter(l => categoria === "Todas" || classificar(l.categoria) === categoria).sort((a, b) => a.data.localeCompare(b.data)), [linhasMes, categoria]);
  const grupos = ["Casamentos", "Eventos", "Residências"].map(tipo => {
    const rows = linhasMes.filter(l => classificar(l.categoria) === tipo);
    return { tipo, quantidade: rows.length, dentro: rows.reduce((n, x) => n + x.dentro, 0),
      fora: rows.reduce((n, x) => n + x.fora, 0),
      faturado: rows.reduce((n, x) => n + x.faturado, 0),
      custos: rows.reduce((n, x) => n + x.custo, 0) };
  });
  const lucroTotal = mes ? mes.faturado - mes.custo : 0;
  const custoCompleto = mes?.gastosFixos !== null && mes?.vencimentos !== null && !!mes;
  const lucroReal = custoCompleto && mes ? lucroTotal - (mes.gastosFixos || 0) - (mes.vencimentos || 0) : null;
  const delta = (atual: number, antigo: number) => antigo === 0 ? "Sem base comparável" : `${((atual - antigo) / Math.abs(antigo) * 100).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;
  const setCusto = (field: "gastosFixos" | "vencimentos", value: string) => {
    const n = value === "" ? null : Number(value);
    if (n !== null && (!Number.isFinite(n) || n < 0)) return;
    setMeses(ms => ms.map(m => m.mes === mesSelecionado ? { ...m, [field]: n } : m));
  };
  const guardarCustos = async () => {
    if (!mes || !custoCompleto) { setFeedback("Preenche gastos fixos e vencimentos antes de guardar."); return; }
    setSaving(true);
    try {
      const r = await saveReportMonthlyCosts(ano, mesSelecionado, mes.gastosFixos!, mes.vencimentos!);
      setFeedback(r.success ? `Custos de ${mesesNomes[mesSelecionado - 1]} de ${ano} guardados.` : (r.message || "Erro ao guardar."));
    } catch { setFeedback("Não foi possível guardar os custos."); }
    finally { setSaving(false); }
  };

  const panel: React.CSSProperties = { border: "1px solid var(--theme-border)", background: "var(--theme-surface)", padding: "1.2rem", marginTop: 16 };
  const th: React.CSSProperties = { padding: "10px 12px", fontSize: 11, textAlign: "left", color: "var(--theme-accent)", borderBottom: "1px solid var(--theme-border)", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid var(--theme-border)", fontSize: 12, whiteSpace: "nowrap" };
  const muted: React.CSSProperties = { color: "var(--theme-text-muted)", fontSize: 12, lineHeight: 1.7 };
  const input: React.CSSProperties = { minWidth: 100, width: 132, padding: 9, boxSizing: "border-box", border: "1px solid var(--theme-input-border)", background: "var(--theme-input-bg)", color: "var(--theme-text)" };
  const metric = (label: string, value: string) => <div style={{ ...panel, marginTop: 0, minWidth: 0 }}><div style={{ ...muted, fontSize: 11 }}>{label}</div><div style={{ fontSize: 24, fontFamily: "'Cormorant Garamond',serif", marginTop: 8 }}>{value}</div></div>;
  if (!authorized) return null;
  return (
    <div style={{ background: "var(--theme-bg)", color: "var(--theme-text)", minHeight: "100vh", fontFamily: "'Montserrat',sans-serif", opacity: mounted ? 1 : 0 }}>
      <div className="mob-page-desktop no-print"><DesktopNav userName={userName} active="relatorio-mensal" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/"); }} /></div>
      <main style={{ maxWidth: 1470, margin: "auto", padding: "2rem 1.2rem 7rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 15 }}>
          <div><div style={{ color: "var(--theme-accent)", fontSize: 11, letterSpacing: "0.3em" }}>LLE · FINANCEIRO</div>
            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 38, fontWeight: 400, margin: "0.3rem 0" }}>Relatório financeiro mensal</h1>
            <p style={muted}>{mesesNomes[mesSelecionado - 1]} de {ano} · Casamentos, Eventos e Residências</p>
          </div>
          <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
            <label style={{ fontSize: 12 }}>Mês <select value={mesSelecionado} onChange={e => { setMesSelecionado(Number(e.target.value)); setCategoria("Todas"); setFeedback(""); }} style={{ ...input, marginLeft: 6 }}>
              {mesesNomes.map((nome, i) => <option key={i} value={i + 1}>{nome}</option>)}
            </select></label>
            <label style={{ fontSize: 12 }}>Ano <select value={ano} onChange={e => setAno(Number(e.target.value))} style={{ ...input, marginLeft: 6 }}>
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 2 - i).map(y => <option key={y}>{y}</option>)}
            </select></label>
            <button type="button" onClick={() => window.print()} style={{ border: 0, background: "var(--theme-accent)", color: "var(--theme-accent-contrast)", padding: "10px 16px", cursor: "pointer" }}>Guardar PDF</button>
          </div>
        </div>
        <p style={muted}>Inclui apenas Confirmado, Adjudicado, Faturado e Pago. Exclui cancelados e oportunidades já convertidas em eventos. Os valores são comerciais registados no Hub, não faturação certificada.</p>
        {excluidos > 0 && <p style={muted}>{excluidos} residência(s) pessoal(ais) do João identificada(s) e excluída(s) da análise do ano.</p>}
        {feedback && <p role="status" style={{ color: "var(--theme-accent)" }}>{feedback}</p>}
        {loading ? <p style={muted}>A calcular o relatório…</p> : mes ? <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px,1fr))", gap: 10, marginTop: 20 }}>
            {metric("Faturação do mês", fmt(mes.faturado))}
            {metric("Custos dos eventos", fmt(mes.custo))}
            {metric("Lucro total", fmt(lucroTotal))}
            {metric("Vencimentos", mes.vencimentos !== null ? fmt(mes.vencimentos) : "Por apurar")}
            {metric("Gastos fixos", mes.gastosFixos !== null ? fmt(mes.gastosFixos) : "Por apurar")}
            {metric("Lucro real", lucroReal !== null ? fmt(lucroReal) : "Por apurar")}
          </div>
          <section style={panel}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Dentro e Fora</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>
              <div><div style={muted}>Dentro · faturação</div><strong>{fmt(mes.dentro)}</strong><p style={muted}>Custo atribuído: {fmt(mes.custoDentro)}</p></div>
              <div><div style={muted}>Fora · faturação</div><strong>{fmt(mes.fora)}</strong><p style={muted}>Custo atribuído: {fmt(mes.custoFora)}</p></div>
              <div><div style={muted}>IVA simulado (apenas Dentro)</div><strong>{fmt(mes.dentro * 0.23)}</strong><p style={muted}>23% caso os valores Dentro sejam sem IVA. Informativo, não deduzido do lucro.</p></div>
            </div>
          </section>
          <section style={panel}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Vencimentos e gastos fixos · {mesesNomes[mesSelecionado - 1]}</h2>
            <div className="report-cost-editor" style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 16 }}>
              <label style={{ display: "grid", gap: 5, fontSize: 12 }}>Vencimentos (€)<input aria-label="Vencimentos do mês" type="number" min="0" step="0.01" value={mes.vencimentos ?? ""} onChange={e => setCusto("vencimentos", e.target.value)} style={input} placeholder="Por apurar" /></label>
              <label style={{ display: "grid", gap: 5, fontSize: 12 }}>Gastos fixos (€)<input aria-label="Gastos fixos do mês" type="number" min="0" step="0.01" value={mes.gastosFixos ?? ""} onChange={e => setCusto("gastosFixos", e.target.value)} style={input} placeholder="Por apurar" /></label>
              <button disabled={!custoCompleto || saving} onClick={() => void guardarCustos()} style={{ background: "var(--theme-accent)", color: "var(--theme-accent-contrast)", border: 0, padding: "11px 17px", opacity: !custoCompleto || saving ? 0.5 : 1, cursor: "pointer" }}>{saving ? "A guardar…" : "Guardar custos"}</button>
            </div>
            <p style={muted}>O lucro real só é calculado quando ambos os custos são preenchidos. Valores de outros meses não são copiados automaticamente.</p>
          </section>
          <section style={panel}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Casamentos · Eventos · Residências</h2>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Tipo", "N.º", "Dentro", "Fora", "Faturado", "Custos", "Lucro"].map(h => <th style={th} key={h}>{h}</th>)}</tr></thead><tbody>
              {grupos.map(g => <tr key={g.tipo}><td style={td}>{g.tipo}</td><td style={td}>{g.quantidade}</td><td style={td}>{fmt(g.dentro)}</td><td style={td}>{fmt(g.fora)}</td><td style={td}>{fmt(g.faturado)}</td><td style={td}>{fmt(g.custos)}</td><td style={td}>{fmt(g.faturado - g.custos)}</td></tr>)}
            </tbody></table></div>
          </section>
          <section style={panel}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Comparativo · {mesesNomes[mesSelecionado - 1]} de {ano}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
              <div><p style={muted}>Mês anterior</p><strong>{fmt(mes.faturadoMesAnterior)}</strong><p style={muted}>Variação: {delta(mes.faturado, mes.faturadoMesAnterior)}</p></div>
              <div><p style={muted}>Mesmo mês de {ano - 1}</p><strong>{fmt(mes.faturadoAnterior)}</strong><p style={muted}>Variação: {delta(mes.faturado, mes.faturadoAnterior)}</p></div>
              <div><p style={muted}>Mês selecionado</p><strong>{fmt(mes.faturado)}</strong><p style={muted}>{mes.eventos} acontecimentos considerados</p></div>
            </div>
            <div style={{ overflowX: "auto", marginTop: 14 }}><table style={{ borderCollapse: "collapse", width: "100%" }}><thead><tr>{["Mês", "Eventos", "Faturado", `Faturado ${ano - 1}`, "Lucro total", "Lucro real"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
              {meses.map(m => <tr key={m.mes} style={{ background: m.mes === mesSelecionado ? "rgba(var(--theme-accent-rgb),.07)" : "transparent" }}><td style={td}>{mesesNomes[m.mes - 1]}</td><td style={td}>{m.eventos}</td><td style={td}>{fmt(m.faturado)}</td><td style={td}>{fmt(m.faturadoAnterior)}</td><td style={td}>{fmt(m.faturado - m.custo)}</td><td style={td}>{m.gastosFixos !== null && m.vencimentos !== null ? fmt(m.faturado - m.custo - m.gastosFixos - m.vencimentos) : "Por apurar"}</td></tr>)}
            </tbody></table></div>
          </section>
          <section style={panel}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, marginTop: 0 }}>Acontecimentos do mês · {linhasMes.length}</h2>
              <select className="no-print" value={categoria} onChange={e => setCategoria(e.target.value)} style={input} aria-label="Filtrar categoria"><option>Todas</option>{["Casamentos", "Eventos", "Residências"].map(c => <option key={c}>{c}</option>)}</select>
            </div>
            <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%" }}><thead><tr>{["Data", "Evento", "Cliente", "Tipo", "Estado", "Dentro", "Fora", "Custos", "Lucro"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
              {detalhes.map(l => <tr key={`${l.origem}-${l.id}`}><td style={td}>{formatDate(l.data)}</td><td style={td}>{l.descricao}</td><td style={td}>{l.cliente || "—"}</td><td style={td}>{classificar(l.categoria)}</td><td style={td}>{l.estado}</td><td style={td}>{fmt(l.dentro)}</td><td style={td}>{fmt(l.fora)}</td><td style={td}>{fmt(l.custo)}</td><td style={td}>{fmt(l.lucro)}</td></tr>)}
              {detalhes.length === 0 && <tr><td colSpan={9} style={td}>Sem acontecimentos nesta categoria e mês.</td></tr>}
            </tbody></table></div>
          </section>
        </> : <p style={muted}>Sem dados para o período escolhido.</p>}
      </main>
      <div className="mob-shell no-print"><MobTabBar active="faturacao" role={role} lightTheme={lightTheme} /></div>
      <style>{`@media print { .no-print, .report-cost-editor { display:none !important; } body { background:white !important; } section { break-inside:avoid; } main { padding:0 !important; } }`}</style>
    </div>
  );
}
