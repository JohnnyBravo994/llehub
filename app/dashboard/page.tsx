"use client";

import MobTabBar from "../MobTabBar";

import { useTheme } from "../useTheme";
import { ThemeSwitcher } from "../ThemeSwitcher";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getDashboardData } from "../actions";
import { resolveColaboradorNome } from "../constants";

interface Lead {
  id: number; title: string; event_date: string; status_icon: string; value: number;
  local?: string; contacto?: string; notas?: string;
}
interface AgendaEvent {
  id: number; title: string; event_date: string; hours?: string;
  location?: string; staff?: string; bill?: number; artists?: string;
  artistas?: { nome: string; tipo: string }[];
}

// Mapeamento tipo artista → emoji (igual à agenda)
const TIPO_ICON: Record<string, string> = {
  "DJ": "🎧", "Singer": "🎤", "Dancer": "💃", "Sax": "🎷",
  "Guitar": "🎸", "Bass": "🎸", "Drums": "🥁", "Piano": "🎹",
  "Fire": "🔥", "Host": "🎙️", "Actor": "🎭",
  "Produtor": "🧑🏽‍💻", "Guarda-Roupa": "🥻", "Animador": "🎪",
};

function artistIcons(artistas: { nome: string; tipo: string }[]): string {
  if (!artistas || !artistas.length) return "";
  const seen = new Set<string>();
  return artistas
    .filter(a => a.nome.trim())
    .map(a => TIPO_ICON[a.tipo] || "🎵")
    .filter(ic => { if (seen.has(ic)) return false; seen.add(ic); return true; })
    .join("");
}

function cleanTitle(t: string): string {
  return t.replace(/^\p{Emoji}[\p{Emoji}\u200d\s]*/u, "").trim();
}

function parseArtists(raw?: string): string {
  if (!raw) return "";
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return "";
    return arr.map((a: any) => `${a.n}${a.f ? ` (${a.f})` : ""}`).join(" · ");
  } catch { return ""; }
}

const C = {
  gold: "var(--theme-accent)", goldDim: "var(--theme-accent-muted)", surface: "var(--theme-surface)", pageBg: "var(--theme-bg)",
  border: "rgba(var(--theme-accent-rgb),0.12)", borderDim: "rgba(var(--theme-contrast-rgb),0.05)",
  textPrimary: "var(--theme-text)", textSec: "var(--theme-text-muted)", textMuted: "var(--theme-text-faint)",
};

const C_Light = {
  gold: "#8B4513", goldDim: "#6F3A18", surface: "#FFFFFF", pageBg: "#FFFBF7",
  border: "rgba(0,0,0,0.15)", borderDim: "rgba(0,0,0,0.12)",
  textPrimary: "#111827", textSec: "rgba(17,24,39,0.82)", textMuted: "rgba(17,24,39,0.62)",
  green: "#2E7D32", amber: "#A65300", blue: "#1565C0", red: "#C62828", purple: "#6A1B9A",
};

const getColors = (lightTheme: boolean) => lightTheme ? C_Light : C;


function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Dashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const C = getColors(lightTheme);
  const todayPanelBg = lightTheme ? C.surface : "linear-gradient(135deg, #1a1408 0%, #110f07 100%)";
  const todayItemBg = lightTheme ? "rgba(0,0,0,0.025)" : "rgba(var(--theme-accent-rgb),0.04)";
  const softItemBg = lightTheme ? "rgba(0,0,0,0.025)" : "rgba(var(--theme-contrast-rgb),0.02)";
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agendaAll, setAgendaAll] = useState<AgendaEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    // Passa a data local do browser ao servidor para filtrar leads correctamente
    const now = new Date();
    const clientToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const d = await getDashboardData('Admin', clientToday);
    if (d.success) {
      setLeads(d.leads as Lead[]);
      setAgendaAll(d.agendaAll as AgendaEvent[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("lle_user");
    if (!u) { router.push("/"); return; }
    const parsed = JSON.parse(u);
    if (parsed.role !== "admin") { router.push("/agenda"); return; }
    setUserName(parsed.name);
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }));
      setCurrentDate(now.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    };
    tick();
    const iv = setInterval(tick, 1000);
    load();
    return () => clearInterval(iv);
  }, [load]);

  // Usa data local (não UTC) para evitar desfasamento depois da meia-noite
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todayEvs = agendaAll.filter(a => a.event_date === todayStr);

  // Leads activas — 3 regras por ordem:
  // 1. event_date passado (ou sem data) → excluída
  // 2. status Cancelado → excluída
  // 3. já convertida para Agenda (mesma data + valor) → excluída

  // Chave date+value para leads já existentes na Agenda
  const agendaDateValKeys = new Set(
    agendaAll
      .filter(a => (a.bill ?? 0) > 0)
      .map(a => `${a.event_date}||${a.bill}`)
  );

  const activeLeads = leads.filter((l: any) => {
    const ldRaw = (l.event_date || "").trim();
    const ls = (l.status || "").trim();
    // Normalizar data para YYYY-MM-DD (DD/MM/YYYY ou YYYY-MM-DD)
    let ld = ldRaw;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(ldRaw)) {
      const [d, m, y] = ldRaw.split("/");
      ld = `${y}-${m}-${d}`;
    }
    // Regra 1: sem data ou data passada → fora
    if (!ld || ld < todayStr) return false;
    // Regra 2: Cancelado → fora
    if (ls === "Cancelado") return false;
    // Regra 3: já na Agenda com mesma data+valor → fora
    if ((l.value ?? 0) > 0 && agendaDateValKeys.has(`${ld}||${l.value}`)) return false;
    return true;
  });

  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i + 1);
    const ds = toDateStr(d);
    return {
      dateStr: ds,
      label: d.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short" }),
      events: agendaAll.filter(a => a.event_date === ds),
    };
  }).filter(day => day.events.length > 0);

  if (isLoading) return <Loading />;

  return (
    <>
    {/* ═══ DESKTOP ═══ */}
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: C.pageBg, color: C.textPrimary, fontFamily: "'Montserrat', sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <Nav userName={userName} active="dashboard" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/");  }} />

      <main style={{ padding: "2rem 2.5rem", maxWidth: "1400px", margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1.5rem" }}>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>

          <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, padding: "2rem" }}>
            <p style={{ fontSize: "7px", letterSpacing: "0.5em", color: C.goldDim, marginBottom: "1rem" }}>HORA ACTUAL</p>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "3.5rem", lineHeight: 1 }}>{currentTime}</p>
            <p style={{ fontSize: "8px", color: C.textMuted, marginTop: "0.5rem", textTransform: "capitalize" }}>{currentDate}</p>
          </div>

          <div style={{ background: todayPanelBg, border: `1px solid ${C.border}`, padding: "2rem", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" }} />
            <p style={{ fontSize: "7px", letterSpacing: "0.5em", color: C.goldDim, marginBottom: "1.25rem" }}>EVENTOS DE HOJE</p>
            {todayEvs.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" }}>
                {todayEvs.map(e => (
                  <div key={e.id} style={{ background: todayItemBg, border: `1px solid ${C.border}`, padding: "1rem 1.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.35rem" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                        {artistIcons(e.artistas||[]) && <span style={{ fontSize: "13px", letterSpacing: "1px" }}>{artistIcons(e.artistas||[])}</span>}
                        {cleanTitle(e.title)}
                      </span>
                      {e.hours && <span style={{ fontSize: "11px", color: C.gold, fontWeight: 700, marginLeft: "0.75rem", whiteSpace: "nowrap" }}>{e.hours}</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      {e.location && <span style={{ fontSize: "9px", color: C.textSec }}>📍 {e.location}</span>}
                      {(e.artistas && e.artistas.length > 0)
                        ? <span style={{ fontSize: "9px", color: C.textSec }}>🎵 {e.artistas.map((a: any) => resolveColaboradorNome(a.nome)).join(" · ")}</span>
                        : parseArtists(e.artists)
                          ? <span style={{ fontSize: "9px", color: C.textSec }}>🎵 {parseArtists(e.artists)}</span>
                          : e.staff ? <span style={{ fontSize: "9px", color: C.textMuted }}>👥 {e.staff}</span> : null
                      }
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "11px", color: C.textMuted, fontStyle: "italic" }}>Nada agendado para hoje.</p>
            )}
          </div>
        </div>

        {/* ROW 2: PRÓXIMOS 7 DIAS */}
        <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, padding: "2rem", marginBottom: "1.5rem", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <p style={{ fontSize: "7px", letterSpacing: "0.5em", color: C.goldDim }}>PRÓXIMOS 7 DIAS</p>
            <a href="/agenda" style={{ fontSize: "7px", letterSpacing: "0.3em", color: C.goldDim, textDecoration: "none", textTransform: "uppercase" }}>Ver agenda →</a>
          </div>
          {next7Days.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
              {next7Days.map(day => (
                <div key={day.dateStr} style={{ background: softItemBg, border: `1px solid ${C.borderDim}`, padding: "1rem" }}>
                  <p style={{ fontSize: "8px", letterSpacing: "0.3em", color: C.gold, fontWeight: 600, marginBottom: "0.75rem", textTransform: "uppercase" }}>{day.label}</p>
                  {day.events.map((e, idx) => (
                    <div key={e.id} style={{ marginBottom: idx < day.events.length - 1 ? "0.6rem" : 0, paddingBottom: idx < day.events.length - 1 ? "0.6rem" : 0, borderBottom: idx < day.events.length - 1 ? `1px solid ${C.borderDim}` : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: "11px", color: C.textPrimary, fontWeight: 500, display: "flex", alignItems: "center", gap: "5px" }}>
                          {artistIcons(e.artistas||[]) && <span style={{ fontSize: "12px", letterSpacing: "1px" }}>{artistIcons(e.artistas||[])}</span>}
                          {cleanTitle(e.title)}
                        </span>
                        {e.hours && <span style={{ fontSize: "9px", color: C.textSec, marginLeft: "0.5rem", whiteSpace: "nowrap" }}>{e.hours}</span>}
                      </div>
                      {e.location && <p style={{ fontSize: "9px", color: C.textMuted, marginTop: "2px" }}>📍 {e.location}</p>}
                      {(e.artistas && e.artistas.length > 0)
                        ? <p style={{ fontSize: "9px", color: C.textSec, marginTop: "2px" }}>🎵 {e.artistas.map((a: any) => resolveColaboradorNome(a.nome)).join(" · ")}</p>
                        : parseArtists(e.artists)
                          ? <p style={{ fontSize: "9px", color: C.textSec, marginTop: "2px" }}>🎵 {parseArtists(e.artists)}</p>
                          : e.staff ? <p style={{ fontSize: "9px", color: C.textMuted, marginTop: "2px" }}>👥 {e.staff}</p> : null
                      }
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "11px", color: C.textMuted, fontStyle: "italic" }}>Sem eventos nos próximos 7 dias.</p>
          )}
        </div>

        {/* ROW 3: LEADS */}
        <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, padding: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <p style={{ fontSize: "7px", letterSpacing: "0.5em", color: C.goldDim }}>LEADS ACTIVAS</p>
            <a href="/leads" style={{ fontSize: "7px", letterSpacing: "0.3em", color: C.goldDim, textDecoration: "none", textTransform: "uppercase" }}>Ver todas →</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
            {activeLeads.slice(0, 6).map(l => (
              <div key={l.id} style={{ background: softItemBg, padding: "1.25rem", border: `1px solid ${C.borderDim}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: C.gold, flex: 1, marginRight: "0.5rem" }}>{l.title}</span>
                  <span style={{ fontSize: "11px", color: C.textPrimary, whiteSpace: "nowrap" }}>{l.value > 0 ? `${l.value.toLocaleString("pt-PT")}€` : "—"}</span>
                </div>
                <p style={{ fontSize: "9px", color: C.textSec, marginTop: "0.5rem" }}>📅 {new Date(l.event_date + "T00:00:00").toLocaleDateString("pt-PT")}</p>
                {l.local && <p style={{ fontSize: "9px", color: C.textSec }}>📍 {l.local}</p>}
                {l.notas && <p style={{ fontSize: "9px", color: C.textMuted, marginTop: "0.4rem", fontStyle: "italic" }}>"{l.notas}"</p>}
                {l.contacto && <div style={{ marginTop: "0.6rem", fontSize: "8px", color: C.goldDim, letterSpacing: "0.1em" }}>📞 {l.contacto}</div>}
              </div>
            ))}
            {activeLeads.length === 0 && (
              <p style={{ fontSize: "11px", color: C.textMuted, gridColumn: "1/-1" }}>Sem leads activas.</p>
            )}
          </div>
        </div>

      </main>
    </div>{/* end desktop */}

    {/* ═══ MOBILE DASHBOARD ═══ */}
    <div className="mob-dash-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.9rem 1.1rem", borderBottom:"1px solid rgba(var(--theme-contrast-rgb),0.05)", background:"var(--theme-nav-bg)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10, flexShrink:0 }}>
        <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"1.2rem", letterSpacing:"0.35em", color:"var(--theme-accent)", fontWeight:300 }}>LLE</span>
        <div style={{ display:"flex", gap:"0.6rem", alignItems:"center" }}>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} style={{ fontSize:"10px", padding:"0.4rem 0.5rem" }} />
          <button onClick={() => { localStorage.removeItem("lle_user"); window.location.href = "/"; }} style={{ background:"transparent", border:"1px solid rgba(var(--theme-contrast-rgb),0.06)", color:"var(--theme-text-faint)", fontSize:"8px", letterSpacing:"0.35em", padding:"0.4rem 0.75rem", cursor:"pointer", fontFamily:"inherit", textTransform:"uppercase", fontWeight:600 }}>SAIR</button>
        </div>
      </div>

      <div className="mob-dash-hero">
        <div className="mob-dash-time">{currentTime}</div>
        <div className="mob-dash-date">{currentDate}</div>
        <div style={{ marginTop:"0.5rem", fontSize:"9px", letterSpacing:"0.35em", color:"var(--theme-text-faint)", textTransform:"uppercase" }}>{userName}</div>
      </div>

      <div className="mob-dash-today">
        <div className="mob-dash-section-label">Hoje</div>
        {todayEvs.length > 0 ? todayEvs.slice(0,4).map((e:any) => (
          <div key={e.id} className="mob-dash-today-item" style={{flexDirection:"column", alignItems:"flex-start", gap:"0.3rem", padding:"0.9rem 1.2rem"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", width:"100%"}}>
              <span className="mob-dash-today-name" style={{display:"flex", alignItems:"center", gap:"5px"}}>
                {artistIcons(e.artistas||[]) && <span style={{fontSize:"13px",letterSpacing:"1px"}}>{artistIcons(e.artistas||[])}</span>}
                {cleanTitle(e.title)}
              </span>
              {e.hours && <span className="mob-dash-today-hour">{e.hours}</span>}
            </div>
            <div style={{display:"flex", flexDirection:"column", gap:"2px"}}>
              {e.location && <span style={{fontSize:"10px", color:"var(--theme-text-muted)"}}>📍 {e.location}</span>}
              {(e.artistas && e.artistas.length > 0)
                ? <span style={{fontSize:"10px", color:"var(--theme-text-muted)"}}>🎵 {e.artistas.map((a: any) => resolveColaboradorNome(a.nome)).join(" · ")}</span>
                : parseArtists(e.artists)
                  ? <span style={{fontSize:"10px", color:"var(--theme-text-muted)"}}>🎵 {parseArtists(e.artists)}</span>
                  : e.staff ? <span style={{fontSize:"10px", color:"var(--theme-text-subtle)"}}>👥 {e.staff}</span> : null
              }
            </div>
          </div>
        )) : <div style={{fontSize:"12px", color:"var(--theme-text-faint)", fontStyle:"italic", padding:"0.75rem 1.2rem"}}>Sem eventos hoje</div>}
      </div>

      {next7Days.length > 0 && (
        <div style={{ borderBottom:"1px solid rgba(var(--theme-contrast-rgb),0.05)", flexShrink:0 }}>
          <div style={{ padding:"0.85rem 1.2rem 0.5rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div className="mob-dash-section-label" style={{marginBottom:0}}>Próximos dias</div>
            <a href="/agenda" style={{ fontSize:"8px", letterSpacing:"0.25em", color:"var(--theme-accent)", textDecoration:"none", textTransform:"uppercase" }}>agenda →</a>
          </div>
          <div style={{ paddingBottom:"0.5rem" }}>
            {next7Days.map(day => day.events.map((e, idx) => (
              <div key={e.id} style={{ padding:"0.65rem 1.2rem", borderTop: idx === 0 ? "1px solid rgba(var(--theme-contrast-rgb),0.03)" : "none" }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:"0.75rem", marginBottom:"0.2rem" }}>
                  <span style={{ fontSize:"9px", color:"var(--theme-accent)", letterSpacing:"0.05em", whiteSpace:"nowrap", minWidth:"52px", flexShrink:0 }}>
                    {new Date(e.event_date+"T00:00:00").toLocaleDateString("pt-PT",{weekday:"short",day:"numeric",month:"short"})}
                  </span>
                  <span style={{ fontSize:"12px", color:"var(--theme-text)", fontWeight:500, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:"4px" }}>
                    {artistIcons(e.artistas||[]) && <span style={{fontSize:"12px",letterSpacing:"1px",flexShrink:0}}>{artistIcons(e.artistas||[])}</span>}
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cleanTitle(e.title)}</span>
                  </span>
                  {e.hours && <span style={{ fontSize:"10px", color:"var(--theme-text-subtle)", whiteSpace:"nowrap", flexShrink:0 }}>{e.hours}</span>}
                </div>
                <div style={{ paddingLeft:"calc(52px + 0.75rem)", display:"flex", flexDirection:"column", gap:"2px" }}>
                  {e.location && <span style={{fontSize:"10px", color:"var(--theme-text-muted)"}}>📍 {e.location}</span>}
                  {(e.artistas && e.artistas.length > 0)
                    ? <span style={{fontSize:"10px", color:"var(--theme-text-muted)"}}>🎵 {e.artistas.map((a: any) => resolveColaboradorNome(a.nome)).join(" · ")}</span>
                    : parseArtists(e.artists)
                      ? <span style={{fontSize:"10px", color:"var(--theme-text-muted)"}}>🎵 {parseArtists(e.artists)}</span>
                      : e.staff ? <span style={{fontSize:"10px", color:"var(--theme-text-faint)"}}>👥 {e.staff}</span> : null
                  }
                </div>
              </div>
            )))}
          </div>
        </div>
      )}

      <div style={{ padding:"0.6rem 1.2rem 0.3rem", borderBottom:"1px solid rgba(var(--theme-contrast-rgb),0.04)", flexShrink:0 }}>
        <div className="mob-dash-section-label" style={{marginBottom:0}}>Leads activas</div>
      </div>
      <div className="mob-dash-scroll">
        {activeLeads.length === 0 && <div className="mob-empty">Sem leads activas</div>}
        {activeLeads.slice(0,15).map((l:any) => (
          <a key={l.id} href="/leads" className="mob-dash-lead-card" style={{display:"flex", textDecoration:"none"}}>
            <div style={{flex:1, minWidth:0}}>
              <div className="mob-dash-lead-name">{l.title}</div>
              <div className="mob-dash-lead-meta">{new Date(l.event_date+"T00:00:00").toLocaleDateString("pt-PT",{day:"numeric",month:"short"})}{l.local ? ` · ${l.local}` : ""}</div>
            </div>
            <div className="mob-dash-lead-val">{l.value > 0 ? `${Number(l.value).toLocaleString("pt-PT")}€` : "—"}</div>
          </a>
        ))}
      </div>

      <MobTabBar active="dashboard" role="admin" lightTheme={lightTheme} />
    </div>
    </>
  );
}

function Nav({ userName, active, onLogout }: { userName: string; active: string; onLogout: () => void }) {
  const stored = typeof window !== "undefined" ? localStorage.getItem("lle_user") : null;
  const role = stored ? JSON.parse(stored).role : "admin";
  const allLinks = [{ href: "/dashboard", label: "Dashboard" }, { href: "/agenda", label: "Agenda" }, { href: "/leads", label: "Leads" }, { href: "/faturacao", label: "Faturação" }, { href: "/pagamentos", label: "Pagamentos" }, { href: "/colaboradores", label: "Colaboradores" }, { href: "/valores", label: "Valores" }, { href: "/residencias", label: "Residências" }];
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
    <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 2.5rem", borderBottom: "1px solid var(--theme-border)", position: "sticky", top: 0, zIndex: 100, background: "var(--theme-nav-bg)", backdropFilter: "blur(12px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.3rem", letterSpacing: "0.35em", color: "var(--theme-accent)", fontWeight: 300 }}>LLE</span>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {links.map(l => (
            <a key={l.href} href={l.href} style={{ fontSize: "9px", letterSpacing: "0.3em", padding: "0.5rem 1rem", textTransform: "uppercase", fontWeight: 500, color: active === l.href.slice(1) ? "var(--theme-accent)" : "var(--theme-text-muted)", textDecoration: "none", fontFamily: "'Montserrat','Helvetica Neue',sans-serif" }}>{l.label}</a>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontSize: "9px", letterSpacing: "0.3em", color: "var(--theme-text-faint)", textTransform: "uppercase" }}>{userName}</span>
        <button onClick={onLogout} style={{ background: "transparent", border: "1px solid rgba(var(--theme-accent-rgb),0.12)", color: "var(--theme-text-faint)", fontSize: "8px", letterSpacing: "0.4em", padding: "0.5rem 1rem", cursor: "pointer", textTransform: "uppercase", fontFamily: "inherit", fontWeight: 600 }}>SAIR</button>
      </div>
    </nav>
  );
}

function Loading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.pageBg }}>
      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "3rem", letterSpacing: "0.4em", color: "var(--theme-accent)", fontWeight: 300 }}>LLE</span>
    </div>
  );
}

