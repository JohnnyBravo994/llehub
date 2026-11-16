"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DesktopNav from "../DesktopNav";
import MobTabBar from "../MobTabBar";
import { useTheme } from "../useTheme";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { getCrmUnified } from "../actions";

type Cliente = { id: number; nome: string; alias: string; email: string; telefone: string; nif: string; notas: string };
type Atividade = {
  id: number; origem: "agenda" | "lead"; title: string; event_date: string; estado: string;
  tipo: string; cliente_id: number | null; cliente_nome: string; contacto: string;
  event_id: string; lead_id: number | null; local: string; notas: string;
};
const normal = (s: string) => (s || "").toLocaleLowerCase("pt-PT").trim().replace(/\s+/g, " ");
const labelDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split("-").reverse().join("/") : (s || "—");

export default function CrmPage() {
  const router = useRouter();
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("admin");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [estado, setEstado] = useState("Todos");

  useEffect(() => {
    try {
      const u = localStorage.getItem("lle_user");
      if (!u) { router.replace("/"); return; }
      const parsed = JSON.parse(u);
      setUserName(parsed.name || "");
      setRole(parsed.role || "admin");
      getCrmUnified().then(res => {
        if (!res.success) setError(res.message || "Não foi possível carregar o CRM.");
        else { setClientes(res.clientes as Cliente[]); setAtividades(res.atividades as Atividade[]); }
      }).catch(() => setError("Erro na ligação ao CRM.")).finally(() => setLoading(false));
    } catch { router.replace("/"); }
  }, [router]);

  const clienteById = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes]);
  const clienteByName = useMemo(() => {
    const out = new Map<string, Cliente>();
    for (const c of clientes) { if (normal(c.nome)) out.set(normal(c.nome), c); if (normal(c.alias)) out.set(normal(c.alias), c); }
    return out;
  }, [clientes]);
  const clienteKey = (a: Atividade) => {
    if (a.cliente_id && clienteById.has(a.cliente_id)) return `id:${a.cliente_id}`;
    const match = clienteByName.get(normal(a.cliente_nome));
    if (match) return `id:${match.id}`;
    return `nome:${normal(a.cliente_nome) || "sem cliente"}`;
  };

  const grupos = useMemo(() => {
    const map = new Map<string, { key: string; cliente: Cliente | null; nome: string; atividades: Atividade[] }>();
    for (const c of clientes) map.set(`id:${c.id}`, { key: `id:${c.id}`, cliente: c, nome: c.alias || c.nome, atividades: [] });
    for (const a of atividades) {
      const key = clienteKey(a);
      if (!map.has(key)) map.set(key, { key, cliente: null, nome: a.cliente_nome || "Sem cliente associado", atividades: [] });
      map.get(key)!.atividades.push(a);
    }
    return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-PT"));
  // Mapping recalculated only when CRM data changes.
  }, [atividades, clientes, clienteById, clienteByName]);

  const filtrados = grupos.filter(g => {
    const q = normal(search);
    const matches = !q || [g.nome, g.cliente?.nome, g.cliente?.email, g.cliente?.telefone, g.cliente?.nif, ...g.atividades.map(a => a.title)].some(v => normal(v || "").includes(q));
    return matches && (estado === "Todos" || g.atividades.some(a => a.estado === estado));
  });
  const estados = [...new Set(atividades.map(a => a.estado).filter(Boolean))].sort();
  const selecionado = grupos.find(g => g.key === selected) || filtrados[0] || null;
  const uniqueCount = atividades.length;
  const panel: React.CSSProperties = { background: "var(--theme-surface)", border: "1px solid var(--theme-border)", padding: "1.2rem" };
  const muted: React.CSSProperties = { color: "var(--theme-text-muted)", fontSize: 12 };

  return (
    <div style={{ background: "var(--theme-bg)", color: "var(--theme-text)", minHeight: "100vh", fontFamily: "'Montserrat',sans-serif", opacity: mounted ? 1 : 0 }}>
      <div className="mob-page-desktop"><DesktopNav userName={userName} active="crm" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/"); }} /></div>
      <main style={{ maxWidth: 1480, margin: "0 auto", padding: "2rem 1.2rem 7rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div><div style={{ color: "var(--theme-accent)", letterSpacing: "0.3em", fontSize: 11 }}>LLE · COMERCIAL</div>
            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 38, fontWeight: 400, margin: "0.25rem 0" }}>CRM Unificado</h1>
            <p style={muted}>{clientes.length} clientes · {uniqueCount} registos únicos de Leads e Agenda</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
            <a href="/leads" style={{ color: "var(--theme-accent)", textDecoration: "none", fontSize: 12 }}>Leads</a>
            <a href="/clientes" style={{ color: "var(--theme-accent)", textDecoration: "none", fontSize: 12 }}>Clientes</a>
          </div>
        </div>
        <p style={{ ...muted, margin: "1.1rem 0" }}>Clientes, oportunidades e eventos relacionados pela ficha de cliente e pelo identificador partilhado de evento. As Leads convertidas não são contadas duas vezes. Sem valores financeiros nesta vista.</p>
        {error && <p role="alert" style={{ color: "var(--theme-danger)" }}>{error}</p>}
        {loading ? <p style={muted}>A carregar CRM…</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 350px), 1fr))", gap: 16, marginTop: 22 }}>
            <section style={panel}>
              <input aria-label="Pesquisar clientes e eventos" placeholder="Pesquisar cliente, contacto ou evento…" value={search} onChange={e => { setSearch(e.target.value); setSelected(""); }}
                style={{ width: "100%", boxSizing: "border-box", padding: 12, background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text)" }} />
              <select aria-label="Filtrar por estado" value={estado} onChange={e => { setEstado(e.target.value); setSelected(""); }} style={{ marginTop: 10, padding: 9, width: "100%", background: "var(--theme-input-bg)", color: "var(--theme-text)", border: "1px solid var(--theme-input-border)" }}>
                <option>Todos</option>{estados.map(v => <option key={v}>{v}</option>)}
              </select>
              <div style={{ maxHeight: 590, overflowY: "auto", marginTop: 12 }}>
                {filtrados.map(g => (
                  <button type="button" key={g.key} onClick={() => setSelected(g.key)} style={{ width: "100%", textAlign: "left", cursor: "pointer", padding: "0.9rem 0.6rem", background: selecionado?.key === g.key ? "rgba(var(--theme-accent-rgb),.10)" : "transparent", color: "var(--theme-text)", border: 0, borderBottom: "1px solid var(--theme-border)" }}>
                    <strong style={{ fontSize: 13 }}>{g.nome}</strong>
                    <div style={{ ...muted, marginTop: 4 }}>{g.atividades.length} registo(s) · {g.atividades[0]?.event_date ? `Último: ${labelDate(g.atividades[0].event_date)}` : "Sem eventos associados"}</div>
                  </button>
                ))}
                {filtrados.length === 0 && <p style={muted}>Sem resultados para este filtro.</p>}
              </div>
            </section>
            <section style={panel}>
              {selecionado ? <>
                <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, marginTop: 0 }}>{selecionado.nome}</h2>
                {selecionado.cliente ? <div style={{ ...muted, lineHeight: 1.9 }}>
                  <div>Nome oficial: {selecionado.cliente.nome}</div>
                  <div>Email: {selecionado.cliente.email || "—"}</div>
                  <div>Telefone: {selecionado.cliente.telefone || "—"}</div>
                  <div>NIF: {selecionado.cliente.nif || "—"}</div>
                  {selecionado.cliente.notas && <div>Notas: {selecionado.cliente.notas}</div>}
                </div> : <p style={muted}>Ainda sem ficha de cliente correspondente. Associa o cliente ao editar a Lead ou Agenda.</p>}
                <h3 style={{ color: "var(--theme-accent)", fontSize: 12, letterSpacing: "0.1em", marginTop: 24 }}>HISTÓRICO COMERCIAL · {selecionado.atividades.length}</h3>
                {selecionado.atividades.map(a => (
                  <div key={`${a.origem}-${a.id}`} style={{ borderTop: "1px solid var(--theme-border)", padding: "0.9rem 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <strong style={{ fontSize: 13 }}>{a.title || "Sem título"}</strong>
                      <span style={{ color: "var(--theme-accent)", fontSize: 11 }}>{a.estado || "Sem estado"}</span>
                    </div>
                    <div style={{ ...muted, marginTop: 5 }}>{labelDate(a.event_date)} · {a.tipo} · {a.origem === "agenda" ? "Agenda" : "Lead"}{a.local ? ` · ${a.local}` : ""}</div>
                    <a style={{ color: "var(--theme-accent)", textDecoration: "none", display: "inline-block", marginTop: 6, fontSize: 11 }} href={a.origem === "agenda" ? "/agenda" : "/leads"}>Abrir {a.origem === "agenda" ? "Agenda" : "Leads"}</a>
                  </div>
                ))}
                {selecionado.atividades.length === 0 && <p style={muted}>Este cliente ainda não tem Leads ou eventos associados.</p>}
              </> : <p style={muted}>Seleciona um cliente para consultar o histórico.</p>}
            </section>
          </div>
        )}
      </main>
      <div className="mob-shell"><MobTabBar active="crm" role={role} lightTheme={lightTheme} /></div>
    </div>
  );
}
