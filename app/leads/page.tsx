"use client";

import { MODALIDADES } from "../constants";
import React, { useEffect, useState, useCallback, useRef } from "react";

// ── CustomSelect ──────────────────────────────────────────────────────────────
function CustomSelect({
  value, onChange, options, style, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const label = options.find(o => o.value === value)?.label ?? placeholder ?? value;
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          ...style,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", userSelect: "none", boxSizing: "border-box",
        }}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ marginLeft: 6, flexShrink: 0, opacity: 0.5, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0,
          background: "#1a1710", border: "1px solid rgba(201,169,110,0.2)",
          zIndex: 9999, maxHeight: 240, overflowY: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>
          {options.map(o => (
            <div
              key={o.value}
              onMouseDown={e => { e.preventDefault(); onChange(o.value); setOpen(false); }}
              style={{
                padding: "0.6rem 1rem",
                fontSize: style?.fontSize ?? "11px",
                fontFamily: style?.fontFamily ?? "inherit",
                letterSpacing: style?.letterSpacing ?? "0.05em",
                color: o.value === value ? "#C9A96E" : "#F5F0E8",
                background: o.value === value ? "rgba(201,169,110,0.1)" : "transparent",
                cursor: "pointer",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,169,110,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = o.value === value ? "rgba(201,169,110,0.1)" : "transparent")}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useRouter } from "next/navigation";
import {
  getAllLeads, createLead, updateLead,
  cancelLead, restoreLead, deleteLead,
  getAllClientes, createCliente, createAgendaEvent,
  syncArtistasEvento, getArtistasEvento, setupDatabase, syncArtistasParaAgenda,
  syncAllExistingData,
} from "../actions";

// ── INTERFACES ───────────────────────────────────────────────────────────────
interface Lead {
  id: number; title: string; event_date: string; value: number;
  status?: string; cancelled?: number;
  local?: string; contacto?: string; notas?: string;
  cliente_nome?: string; cliente_id?: number | null; modalidade?: string;
  agenda_event_id?: number | null;
}

interface Cliente { id: number; nome: string; nif?: string; alias?: string; }
interface ArtistRow { nome: string; tipo: string; fee: string; }

// ── HELPERS ──────────────────────────────────────────────────────────────────
function displayClienteNome(lead: { cliente_id?: number | null; cliente_nome?: string }, clientes: Cliente[]): string {
  if (lead.cliente_id) { const c = clientes.find(c => c.id === lead.cliente_id); if (c) return c.alias?.trim() || c.nome; }
  if (lead.cliente_nome) { const c = clientes.find(c => c.nome === lead.cliente_nome || (c.alias?.trim() && c.alias.trim() === lead.cliente_nome)); if (c) return c.alias?.trim() || c.nome; }
  return lead.cliente_nome || '';
}

const ARTIST_TIPOS = ["DJ", "Singer", "Dancer", "Sax", "Guitar", "Bass", "Drums", "Piano", "Fire", "Host", "Actor", "Produtor", "Guarda-Roupa", "Animador"];
const emptyArtist = (): ArtistRow => ({ nome: "", tipo: "DJ", fee: "" });

const C = {
  gold: "#C9A96E", goldDim: "#8a7350", surface: "#111009",
  border: "rgba(201,169,110,0.12)", borderDim: "rgba(255,255,255,0.05)",
  textPrimary: "#F5F0E8", textSec: "rgba(245,240,232,0.45)", textMuted: "rgba(245,240,232,0.22)",
  green: "#5DCAA5", amber: "#EF9F27", blue: "#85B7EB", red: "#E24B4A", purple: "#A78BFA",
};

function fmtDate(s: string) {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_OPTIONS = ["Contacto", "Proposta Enviada", "Em Negociação", "Confirmado", "Em Adjudicação", "Adjudicado", "Faturado", "Pago", "Cancelado"];
const emptyForm = { title: "", event_date: "", value: "0", status: "Contacto", local: "", contacto: "", notas: "", cliente_nome: "", cliente_id: null as number | null, modalidade: "Fatura" };

const addArtistRow = (setArtists: React.Dispatch<React.SetStateAction<ArtistRow[]>>) => setArtists(prev => [...prev, emptyArtist()]);
const removeArtistRow = (setArtists: React.Dispatch<React.SetStateAction<ArtistRow[]>>, i: number) => setArtists(prev => prev.filter((_, idx) => idx !== i));
const updateArtist = (setArtists: React.Dispatch<React.SetStateAction<ArtistRow[]>>, i: number, field: keyof ArtistRow, value: string) => setArtists(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a));

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function LeadsPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ open: boolean; editing: Lead | null }>({ open: false, editing: null });
  const [form, setForm] = useState(emptyForm);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteDropOpen, setClienteDropOpen] = useState(false);
  const [clienteCreating, setClienteCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [artists, setArtists] = useState<ArtistRow[]>([emptyArtist()]);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [toast, setToast] = useState("");
  const [mounted, setMounted] = useState(false);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [waModal, setWaModal] = useState(false);
  const [waText, setWaText] = useState("");
  const [waCopied, setWaCopied] = useState(false);
  const [waMonthModal, setWaMonthModal] = useState(false);
  const [selectedWaMonths, setSelectedWaMonths] = useState<Set<string>>(new Set());
  const [waMonthError, setWaMonthError] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // ✅ FIX: load() com resiliência
  const load = useCallback(async () => {
    try {
      const [r, cr] = await Promise.all([
        getAllLeads().catch(() => ({ success: false, data: [] })),
        getAllClientes().catch(() => ({ success: false, data: [] })),
      ]);
      if (r.success) {
        setLeads(r.data as Lead[]);
        const currentYM = new Date().toISOString().slice(0, 7);
        const pastMonths = new Set<string>();
        (r.data as Lead[]).forEach(l => {
          if (l.event_date && l.event_date.length >= 7) { const ym = l.event_date.slice(0, 7); if (ym < currentYM) pastMonths.add(ym); }
        });
        setCollapsedMonths(pastMonths);
      }
      if (cr.success) setClientes(cr.data as Cliente[]);
    } catch (err) { console.error("load error:", err); } finally { setLoading(false); }
  }, []);

  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const u = localStorage.getItem("lle_user");
    if (!u) { router.push("/"); return; }
    const parsed = JSON.parse(u);
    setUserName(parsed.name);
    setUserRole(parsed.role || "admin");
    if (!sessionStorage.getItem("lle_sync_done")) {
      syncAllExistingData().then(r => { if (r?.success) sessionStorage.setItem("lle_sync_done", "1"); }).catch(() => {});
    }
    setupDatabase().then(() => load()).catch(() => { setLoading(false); });
    setTimeout(() => setMounted(true), 100);
  }, [load]);

  const resetClienteState = () => { setClienteSearch(""); setClienteDropOpen(false); setClienteCreating(false); };

  const openCreate = () => {
    setForm({ ...emptyForm, event_date: new Date().toISOString().split("T")[0] });
    setArtists([emptyArtist()]); resetClienteState();
    setModal({ open: true, editing: null });
  };

  const openEdit = (l: Lead) => {
    setForm({
      title: l.title, event_date: l.event_date, value: String(l.value || 0),
      status: l.status || "Contacto", local: l.local || "", contacto: l.contacto || "",
      notas: l.notas || "", cliente_nome: l.cliente_nome || "",
      cliente_id: l.cliente_id ?? null, modalidade: l.modalidade || "Fatura",
    });
    setClienteSearch(l.cliente_nome || ""); setClienteDropOpen(false); setClienteCreating(false);
    setArtists([emptyArtist()]); setModal({ open: true, editing: l });
    setLoadingArtists(true);
    (async () => {
      const agendaId = l.agenda_event_id ?? null;
      let loaded: ArtistRow[] = [];
      if (agendaId) { const res = await getArtistasEvento(agendaId); if (res.success && res.data.length > 0) loaded = res.data.map(a => ({ nome: a.nome, tipo: a.tipo, fee: String(a.fee) })); }
      if (loaded.length === 0) { const res = await getArtistasEvento(-l.id); if (res.success && res.data.length > 0) loaded = res.data.map(a => ({ nome: a.nome, tipo: a.tipo, fee: String(a.fee) })); }
      setArtists(loaded.length > 0 ? loaded : [emptyArtist()]); setLoadingArtists(false);
    })();
  };

  const closeModal = () => { setModal({ open: false, editing: null }); resetClienteState(); };
  const AGENDA_AUTO_STATUSES = ["Confirmado", "Em Adjudicação", "Adjudicado", "Faturado", "Pago"];

  const handleSave = async () => {
    if (!form.title.trim()) { showToast("Título obrigatório"); return; }
    setSaving(true);
    const data = {
      title: form.title.trim(), event_date: form.event_date, value: parseFloat(form.value) || 0, status: form.status,
      cliente_id: form.cliente_id ?? null, cliente_nome: form.cliente_nome, modalidade: form.modalidade,
      local: form.local || "", contacto: form.contacto || "", notas: form.notas || "",
    };
    if (modal.editing) {
      const previousStatus = modal.editing.status || "";
      const saveResult = await updateLead(modal.editing.id, data);
      if (!saveResult.success) { showToast("Erro ao guardar: " + (saveResult.message || "erro desconhecido")); setSaving(false); return; }
      const validArtists = artists.filter(a => a.nome.trim()).map(a => ({ ...a, fee: parseFloat(a.fee) || 0 }));
      if (validArtists.length > 0) {
        await syncArtistasEvento(modal.editing.id * -1, form.title.trim(), form.event_date, validArtists);
        await syncArtistasParaAgenda(modal.editing.id, form.title.trim(), form.event_date, validArtists);
      }
      const isNowAdvanced = AGENDA_AUTO_STATUSES.includes(form.status);
      const wasAlreadyAdvanced = AGENDA_AUTO_STATUSES.includes(previousStatus);
      if (isNowAdvanced && !wasAlreadyAdvanced) {
        await createAgendaEvent({ title: form.title.trim(), date: form.event_date, time: "", tipo: "Evento", venue: form.local || "", bill: parseFloat(form.value) || 0, billing_status: form.status, cliente_id: form.cliente_id ?? null, cliente_nome: form.cliente_nome, modalidade: form.modalidade, origem_lead_id: modal.editing.id, contacto: form.contacto || "", notas: form.notas || "" });
        showToast("Lead actualizada · Evento criado na Agenda");
      } else { showToast("Lead actualizada"); }
    } else {
      const res = await createLead(data);
      if (AGENDA_AUTO_STATUSES.includes(form.status)) {
        await createAgendaEvent({ title: form.title.trim(), date: form.event_date, time: "", tipo: "Evento", bill: parseFloat(form.value) || 0, billing_status: form.status, cliente_id: form.cliente_id ?? null, cliente_nome: form.cliente_nome, modalidade: form.modalidade, origem_lead_id: res.id ?? null, contacto: form.contacto || "", notas: form.notas || "" });
        showToast("Lead criada · Evento criado na Agenda");
      } else { showToast("Lead criada"); }
    }
    setSaving(false); closeModal(); load();
  };

  const handleConvertToAgenda = async () => {
    if (!modal.editing) return;
    setConverting(true);
    const res = await createAgendaEvent({ title: form.title.trim(), date: form.event_date, time: "", tipo: "Evento", bill: parseFloat(form.value) || 0, billing_status: "Contacto", cliente_id: form.cliente_id ?? null, cliente_nome: form.cliente_nome, modalidade: form.modalidade, venue: form.local || "", origem_lead_id: modal.editing.id, contacto: form.contacto || "", notas: form.notas || "" });
    setConverting(false);
    if (res.success) { showToast("Evento criado na Agenda"); closeModal(); load(); } else showToast("Erro ao converter");
  };

  // ✅ FIX: handlers com try/catch
  const handleCancel = async (l: Lead) => {
    try { const res = await cancelLead(l.id); if (!res.success) { showToast("Erro ao cancelar lead"); return; } await load(); showToast("Lead cancelada"); }
    catch (err) { console.error("handleCancel error:", err); showToast("Erro ao cancelar"); }
  };

  const handleRestore = async (l: Lead) => {
    try { const res = await restoreLead(l.id); if (!res.success) { showToast("Erro ao repor lead"); return; } await load(); showToast("Lead reposta"); }
    catch (err) { console.error("handleRestore error:", err); showToast("Erro ao repor"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar esta lead definitivamente?")) return;
    try { const res = await deleteLead(id); if (!res.success) { showToast("Erro ao eliminar"); return; } await load(); showToast("Lead eliminada"); }
    catch (err) { console.error("handleDelete error:", err); showToast("Erro ao eliminar"); }
  };

  const filtered = leads.filter(l => !search || l.title.toLowerCase().includes(search.toLowerCase()) || (l.status || "").toLowerCase().includes(search.toLowerCase()));

  const grouped: Record<string, Lead[]> = {};
  filtered.forEach(l => { const ym = l.event_date && l.event_date.length >= 7 ? l.event_date.slice(0, 7) : "sem-data"; if (!grouped[ym]) grouped[ym] = []; grouped[ym].push(l); });
  const sortedMonths = Object.keys(grouped).sort((a, b) => { if (a === "sem-data") return 1; if (b === "sem-data") return -1; return a.localeCompare(b); });

  const toggleMonth = (ym: string) => { setCollapsedMonths(prev => { const next = new Set(prev); if (next.has(ym)) next.delete(ym); else next.add(ym); return next; }); };

  const monthLabel = (ym: string) => {
    if (ym === "sem-data") return "Sem data";
    const [y, m] = ym.split("-"); const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  };

  const statusColor = (s?: string) => {
    if (!s) return C.textMuted; const sl = s.toLowerCase();
    if (sl === "pago") return C.green; if (sl === "confirmado") return "#85C88A"; if (sl === "adjudicado") return C.gold;
    if (sl === "em adjudicação") return C.gold; if (sl === "faturado") return C.purple; if (sl === "cancelado" || sl === "perdido") return C.red;
    if (sl === "em negociação" || sl === "negociação") return C.amber; if (sl === "proposta enviada") return C.blue; if (sl === "contacto") return C.textSec;
    return C.textSec;
  };

  // ── WHATSAPP ────────────────────────────────────────────────────────────────
  const openWaMonthModal = () => { setSelectedWaMonths(new Set()); setWaMonthError(false); setWaMonthModal(true); };

  const availableWaMonths = (): string[] => {
    const todayYM = new Date().toISOString().slice(0, 7); const monthSet = new Set<string>();
    leads.forEach(l => { if (l.cancelled || l.status === "Cancelado") return; if (l.event_date && l.event_date.length >= 7) { const ym = l.event_date.slice(0, 7); if (ym >= todayYM) monthSet.add(ym); } });
    return Array.from(monthSet).sort();
  };

  const waStatusEmoji = (status: string) => { const s = (status || "").toLowerCase(); if (["confirmado", "adjudicado", "faturado", "pago"].includes(s)) return "🟢"; if (s === "cancelado") return "🔴"; return "🟡"; };

  const buildWaTextForMonths = (months: string[]): string => {
    const todayStr = new Date().toISOString().slice(0, 10); const blocks: string[] = [];
    [...months].sort().forEach(ym => {
      const monthLeads = leads.filter(l => !l.cancelled && l.status !== "Cancelado" && l.event_date?.startsWith(ym) && (l.event_date || "") >= todayStr).sort((a, b) => (a.event_date || "").localeCompare(b.event_date || ""));
      if (monthLeads.length === 0) return;
      const [year, month] = ym.split("-"); const mName = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-PT", { month: "long" });
      blocks.push(`*Leads de ${mName.charAt(0).toUpperCase() + mName.slice(1)}*`);
      monthLeads.forEach(l => {
        const lines: string[] = [];
        const dd = (l.event_date || "").slice(8, 10); const mm = (l.event_date || "").slice(5, 7); const dateStr = dd && mm ? `${dd}/${mm}` : "";
        const titleParts = [l.title, l.local].filter(v => v && v !== "undefined" && v !== "null");
        lines.push(`${dateStr}${dateStr ? " — " : ""}${titleParts.join(" · ")}`);
        if (l.cliente_nome && l.cliente_nome !== "undefined") lines.push(`Cliente/Origem: ${displayClienteNome(l, clientes)}`);
        else if (l.contacto && l.contacto !== "undefined") lines.push(`Origem: ${l.contacto}`);
        if (l.status && l.status !== "undefined") lines.push(`Estado: ${waStatusEmoji(l.status)} ${l.status}`);
        const val = Number(l.value); if (!isNaN(val) && val > 0) lines.push(`Valor: ${val.toLocaleString("pt-PT")}€`);
        blocks.push(lines.filter(Boolean).join("\n"));
      });
    });
    return blocks.join("\n\n");
  };

  const handleCopySelectedMonths = () => {
    if (selectedWaMonths.size === 0) { setWaMonthError(true); return; }
    const text = buildWaTextForMonths(Array.from(selectedWaMonths));
    setWaText(text); setWaCopied(false); setWaMonthModal(false); setWaModal(true);
    const doCopy = (t: string) => {
      if (navigator.clipboard) { navigator.clipboard.writeText(t).then(() => setWaCopied(true)).catch(() => { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); setWaCopied(true); }); }
      else { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); setWaCopied(true); }
    };
    doCopy(text);
  };

  if (loading) return <Loading />;

  const clientesUnicos = clientes.filter((c, i, arr) => arr.findIndex(x => x.nome === c.nome) === i);
  const statusColors: Record<string, string> = { "Contacto": "rgba(245,240,232,0.4)", "Proposta Enviada": C.blue, "Em Negociação": C.amber, "Confirmado": C.green, "Em Adjudicação": C.gold, "Adjudicado": C.gold, "Faturado": "#A78BFA", "Pago": C.green, "Cancelado": C.red };

  return (
    <>
    {/* ═══ DESKTOP ═══ */}
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: "#0C0B09", color: C.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <Nav userName={userName} active="leads" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/"); }} />
      <main style={{ padding: "2rem 2.5rem", maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.textSec, textTransform: "uppercase", fontWeight: 600 }}>
            Pipeline de Leads{leads.length > 0 && <span style={{ color: C.textMuted, marginLeft: "0.75rem" }}>({leads.length} total)</span>}
          </p>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button onClick={openWaMonthModal} style={{ background: "transparent", border: "1px solid rgba(93,202,165,0.2)", color: "#5DCAA5", fontSize: "8px", letterSpacing: "0.3em", padding: "0.5rem 1.1rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              WhatsApp
            </button>
            {userRole !== "limited_novalues" && (
              <button onClick={openCreate} style={addBtnStyle}>
                <svg width="10" height="10" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
                Nova Lead
              </button>
            )}
          </div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar lead ou estado..." style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "none", borderBottom: `1px solid ${C.borderDim}`, color: C.textPrimary, fontFamily: "inherit", fontSize: "11px", padding: "1rem 1.5rem", letterSpacing: "0.05em", outline: "none" }} />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Data Evento", "Lead / Projecto", "Local", "Cliente", "Estado", "Valor", "Ações"].map((h, i) => (
                    <th key={h} style={{ fontSize: "7px", letterSpacing: "0.4em", color: C.goldDim, fontWeight: 600, textTransform: "uppercase", padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.border}`, textAlign: i >= 5 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedMonths.map(ym => (
                  <React.Fragment key={ym}>
                    <tr onClick={() => toggleMonth(ym)} style={{ cursor: "pointer" }}>
                      <td colSpan={7} style={{ padding: "0.75rem 1.25rem", background: "rgba(201,169,110,0.05)", borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: "8px", letterSpacing: "0.4em", color: C.gold, fontWeight: 700, textTransform: "capitalize" }}>{monthLabel(ym)}</span>
                        <span style={{ fontSize: "8px", color: C.textMuted, marginLeft: "0.75rem" }}>({grouped[ym].length})</span>
                        <span style={{ fontSize: "9px", color: C.goldDim, marginLeft: "0.5rem", opacity: 0.7 }}>{collapsedMonths.has(ym) ? "▸" : "▾"}</span>
                      </td>
                    </tr>
                    {!collapsedMonths.has(ym) && grouped[ym].map(l => (
                      <tr key={l.id} style={{ opacity: l.cancelled ? 0.45 : 1 }}>
                        <td style={tdStyle({ nowrap: true })}>{fmtDate(l.event_date)}</td>
                        <td style={tdStyle({ maxW: "260px" })}>
                          <span style={{ textDecoration: l.cancelled ? "line-through" : "none" }}>{l.title}</span>
                          {!!l.cancelled && <span style={{ fontSize: "8px", color: C.red, letterSpacing: "0.2em", marginLeft: "0.5rem" }}>[CANCELADO]</span>}
                          {l.notas && <div style={{ fontSize: "9px", color: C.textMuted, marginTop: "2px", fontStyle: "italic" }}>"{l.notas}"</div>}
                        </td>
                        <td style={tdStyle({ muted: true, maxW: "130px" })}>{l.local || <span style={{ color: C.textMuted }}>—</span>}</td>
                        <td style={tdStyle({ muted: true, maxW: "180px" })}>{displayClienteNome(l, clientes) || "—"}</td>
                        <td style={tdStyle({})}><StatusBadge color={statusColor(l.status)} label={l.status || "Pendente"} /></td>
                        <td style={{ ...tdStyle({ nowrap: true }), textAlign: "right", color: C.gold, fontWeight: 600, fontSize: "11px" }}>{userRole === "limited_novalues" ? "—" : (Number(l.value) > 0 ? `${Number(l.value).toLocaleString("pt-PT")}€` : "—")}</td>
                        <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                          {userRole !== "limited_novalues" && (
                            <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                              <IconBtn title="Editar" onClick={() => openEdit(l)} icon="edit" />
                              {!l.cancelled ? <IconBtn title="Cancelar" onClick={() => handleCancel(l)} icon="cancel" danger /> : <IconBtn title="Repor" onClick={() => handleRestore(l)} icon="restore" success />}
                              <IconBtn title="Eliminar" onClick={() => handleDelete(l.id)} icon="delete" danger />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: "3rem", fontSize: "11px", color: C.textMuted, letterSpacing: "0.2em" }}>Sem leads encontradas</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>

    {/* ═══ MOBILE ═══ */}
    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: "#F5F0E8", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(12,11,9,0.97)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.2rem", letterSpacing: "0.35em", color: "#C9A96E", fontWeight: 300 }}>LLE</span>
        <span style={{ fontSize: "8px", letterSpacing: "0.35em", color: "rgba(245,240,232,0.2)", textTransform: "uppercase" }}>{userName}</span>
      </div>

      <div className="mob-months">
        {sortedMonths.map(ym => (
          <button key={ym} className="mob-mpill" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, color: "rgba(245,240,232,0.35)", fontFamily: "'Montserrat',sans-serif", fontSize: "9px", letterSpacing: "0.15em", padding: "0.35rem 0.9rem", cursor: "pointer", textTransform: "capitalize", whiteSpace: "nowrap" }}>
            {monthLabel(ym).split(" ")[0]} ({grouped[ym].length})
          </button>
        ))}
      </div>

      <div className="mob-topbar">
        <div className="mob-search-wrap">
          <svg className="mob-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="15" y2="15"/></svg>
          <input className="mob-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar lead..." />
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={openWaMonthModal} style={{ background: "rgba(93,202,165,0.08)", border: "1px solid rgba(93,202,165,0.2)", color: "#5DCAA5", fontSize: "10px", padding: "0.5rem 0.7rem", cursor: "pointer" }} title="Copiar Leads para WhatsApp">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </button>
          {userRole !== "limited_novalues" && (
            <button className="mob-fab" onClick={openCreate}>
              <svg width="16" height="16" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* ✅ FIX: Mobile list com botões cancelar/repor */}
      <div className="mob-list">
        {filtered.length === 0 && <div className="mob-empty">Sem leads encontradas</div>}
        {sortedMonths.map(ym => (
          <div key={ym}>
            <div className="mob-section-header">
              <span>{monthLabel(ym)}</span>
              <span className="mob-section-count">{grouped[ym].length}</span>
            </div>
            {grouped[ym].map(l => {
              const d = new Date(l.event_date + "T00:00:00");
              const sc = statusColors[l.status || ""] || "rgba(245,240,232,0.3)";
              return (
                <div key={l.id} className={`mob-card${l.cancelled ? " is-folga" : ""}`} style={{ cursor: userRole !== "limited_novalues" ? "pointer" : "default" }}>
                  <div className="mob-date-bubble" onClick={() => userRole !== "limited_novalues" && openEdit(l)} style={{ cursor: userRole !== "limited_novalues" ? "pointer" : "default" }}>
                    <div className="mob-date-day">{d.getDate()}</div>
                    <div className="mob-date-weekday">{d.toLocaleDateString("pt-PT", { weekday: "short" })}</div>
                  </div>
                  <div className="mob-card-body" onClick={() => userRole !== "limited_novalues" && openEdit(l)} style={{ cursor: userRole !== "limited_novalues" ? "pointer" : "default" }}>
                    <div className={`mob-card-title${l.cancelled ? " cancelled" : ""}`}>{l.title}</div>
                    {l.local && <div className="mob-card-meta" style={{ color: "rgba(201,169,110,0.7)" }}>📍 {l.local}</div>}
                    {l.cliente_nome && <div className="mob-card-meta">{displayClienteNome(l, clientes)}</div>}
                    {l.notas && <div className="mob-card-meta" style={{ fontStyle: "italic", marginTop: 2 }}>"{l.notas}"</div>}
                    <div className="mob-card-badges">
                      <span className="mob-badge" style={{ background: `${sc}18`, color: sc }}>
                        <span className="mob-badge-dot" style={{ background: sc }} />
                        {l.status || "Pendente"}
                      </span>
                    </div>
                  </div>
                  <div className="mob-card-right" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                    {userRole !== "limited_novalues" && Number(l.value) > 0 && <span className="mob-card-value">{Number(l.value).toLocaleString("pt-PT")}€</span>}
                    {userRole !== "limited_novalues" && (
                      <div style={{ display: "flex", gap: "4px", alignItems: "center" }} onClick={ev => ev.stopPropagation()}>
                        {!l.cancelled ? (
                          <button onClick={() => handleCancel(l)} style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.25)", color: "#E24B4A", fontSize: "9px", letterSpacing: "0.1em", padding: "0.25rem 0.55rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", borderRadius: "2px", fontWeight: 600 }}>✕</button>
                        ) : (
                          <button onClick={() => handleRestore(l)} style={{ background: "rgba(93,202,165,0.1)", border: "1px solid rgba(93,202,165,0.25)", color: "#5DCAA5", fontSize: "9px", letterSpacing: "0.1em", padding: "0.25rem 0.55rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", borderRadius: "2px", fontWeight: 600 }}>↺</button>
                        )}
                        <svg className="mob-card-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ cursor: "pointer" }} onClick={() => userRole !== "limited_novalues" && openEdit(l)}><polyline points="6 4 10 8 6 12" /></svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: "5.5rem", left: "50%", transform: "translateX(-50%)", background: "rgba(19,17,8,0.95)", border: "1px solid rgba(201,169,110,0.2)", padding: "0.6rem 1.25rem", zIndex: 1000, backdropFilter: "blur(8px)" }}>
          <span style={{ fontSize: "10px", color: C.textPrimary, letterSpacing: "0.1em" }}>{toast}</span>
        </div>
      )}

      <MobTabBar active="leads" role={userRole} />
    </div>

    {/* ═══ MODAIS ═══ */}

    {waMonthModal && (
      <div onClick={e => e.target === e.currentTarget && setWaMonthModal(false)} style={overlayStyle}>
        <div style={{ ...modalStyle, width: "380px", maxWidth: "95vw" }}>
          <div style={topLineStyle} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "8px", letterSpacing: "0.4em", color: "rgba(201,169,110,0.6)", textTransform: "uppercase", fontWeight: 600 }}>Copiar Leads para WhatsApp</p>
            <button onClick={() => setWaMonthModal(false)} style={{ background: "transparent", border: "none", color: "rgba(245,240,232,0.3)", cursor: "pointer", fontSize: "16px" }}>✕</button>
          </div>
          <p style={{ fontSize: "9px", color: "rgba(245,240,232,0.35)", letterSpacing: "0.15em", marginBottom: "1rem" }}>Seleciona os meses a incluir:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.25rem", maxHeight: "280px", overflowY: "auto" }}>
            {availableWaMonths().length === 0 && <p style={{ fontSize: "11px", color: "rgba(245,240,232,0.3)", textAlign: "center", padding: "1rem" }}>Sem leads disponíveis.</p>}
            {availableWaMonths().map(ym => {
              const [year, month] = ym.split("-");
              const mName = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
              const mCap = mName.charAt(0).toUpperCase() + mName.slice(1);
              const checked = selectedWaMonths.has(ym);
              const count = leads.filter(l => !l.cancelled && l.status !== "Cancelado" && l.event_date?.startsWith(ym)).length;
              return (
                <label key={ym} style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "0.6rem 0.75rem", background: checked ? "rgba(201,169,110,0.06)" : "transparent", border: `1px solid ${checked ? "rgba(201,169,110,0.22)" : "rgba(255,255,255,0.05)"}`, transition: "all 0.15s" }}>
                  <input type="checkbox" checked={checked} onChange={() => { setWaMonthError(false); setSelectedWaMonths(prev => { const next = new Set(prev); if (next.has(ym)) next.delete(ym); else next.add(ym); return next; }); }} style={{ accentColor: "#C9A96E", width: "14px", height: "14px", flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", color: checked ? "#F5F0E8" : "rgba(245,240,232,0.6)", letterSpacing: "0.04em", textTransform: "capitalize", flex: 1 }}>{mCap}</span>
                  <span style={{ fontSize: "9px", color: "rgba(245,240,232,0.25)", letterSpacing: "0.1em" }}>{count} leads</span>
                </label>
              );
            })}
          </div>
          {waMonthError && <p style={{ fontSize: "9px", color: "#E24B4A", letterSpacing: "0.2em", marginBottom: "0.85rem", textTransform: "uppercase" }}>Selecione pelo menos um mês.</p>}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button onClick={() => setWaMonthModal(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(245,240,232,0.35)", fontSize: "9px", letterSpacing: "0.3em", padding: "0.6rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Cancelar</button>
            <button onClick={handleCopySelectedMonths} style={{ background: "#5DCAA5", border: "none", color: "#0C0B09", fontSize: "9px", letterSpacing: "0.3em", fontWeight: 700, padding: "0.6rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Copiar Leads Selecionadas</button>
          </div>
        </div>
      </div>
    )}

    {waModal && (
      <div onClick={e => e.target === e.currentTarget && setWaModal(false)} style={overlayStyle}>
        <div style={{ ...modalStyle, width: "500px", maxWidth: "95vw", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
          <div style={topLineStyle} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <p style={{ fontSize: "8px", letterSpacing: "0.4em", color: "rgba(201,169,110,0.6)", textTransform: "uppercase", fontWeight: 600 }}>Copiar Leads para WhatsApp</p>
            <button onClick={() => setWaModal(false)} style={{ background: "transparent", border: "none", color: "rgba(245,240,232,0.3)", cursor: "pointer", fontSize: "16px" }}>✕</button>
          </div>
          {waCopied && <div style={{ marginBottom: "0.75rem", fontSize: "9px", letterSpacing: "0.25em", color: "#5DCAA5", textTransform: "uppercase" }}>✓ Leads copiadas. Pode colar no WhatsApp.</div>}
          <textarea readOnly value={waText} style={{ flex: 1, minHeight: "300px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F0E8", fontFamily: "monospace", fontSize: "11px", padding: "0.75rem", outline: "none", resize: "vertical", letterSpacing: "0.02em", lineHeight: "1.6" }} onClick={e => (e.target as HTMLTextAreaElement).select()} />
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button onClick={() => setWaModal(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(245,240,232,0.35)", fontSize: "9px", letterSpacing: "0.3em", padding: "0.6rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Fechar</button>
            <button onClick={() => { if (navigator.clipboard) { navigator.clipboard.writeText(waText).then(() => setWaCopied(true)); } else { const ta = document.createElement("textarea"); ta.value = waText; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); setWaCopied(true); } }} style={{ background: "#5DCAA5", border: "none", color: "#0C0B09", fontSize: "9px", letterSpacing: "0.3em", fontWeight: 700, padding: "0.6rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Copiar novamente</button>
          </div>
        </div>
      </div>
    )}

    {modal.open && (
      <div onClick={e => e.target === e.currentTarget && closeModal()} style={overlayStyle}>
        <div style={{ ...modalStyle, width: "640px", maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
          <div style={topLineStyle} />
          <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.goldDim, textTransform: "uppercase", fontWeight: 600, marginBottom: "2rem" }}>{modal.editing ? "Editar Lead" : "Nova Lead"}</p>

          <FormField label="Nome do Projecto / Lead">
            <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nome do evento ou projecto..." />
          </FormField>

          <FormField label="Cliente" style={{ position: "relative" }}>
            {clienteCreating ? (
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input style={{ ...inputStyle, flex: 1 }} value={form.cliente_nome} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))} placeholder="Nome do novo cliente..." autoFocus />
                <button type="button" onClick={async () => { if (!form.cliente_nome.trim()) return; const r = await createCliente({ nome: form.cliente_nome.trim() }); if (r.success) { const cr = await getAllClientes(); if (cr.success) setClientes(cr.data as Cliente[]); setClienteSearch(form.cliente_nome.trim()); showToast("Cliente criado"); } setClienteCreating(false); }} style={{ ...btnPrimStyle, whiteSpace: "nowrap", padding: "0.6rem 1rem" }}>Guardar</button>
                <button type="button" onClick={() => setClienteCreating(false)} style={{ ...btnSecStyle, padding: "0.6rem 0.75rem" }}>✕</button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input style={inputStyle} value={clienteSearch} onChange={e => { setClienteSearch(e.target.value); setForm(f => ({ ...f, cliente_nome: e.target.value, cliente_id: null })); setClienteDropOpen(true); }} onFocus={() => setClienteDropOpen(true)} onBlur={() => setTimeout(() => setClienteDropOpen(false), 150)} placeholder="Pesquisar cliente..." />
                {clienteDropOpen && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#1a1710", border: "1px solid rgba(201,169,110,0.18)", zIndex: 1500, maxHeight: "200px", overflowY: "auto" }}>
                    {clientesUnicos.filter(c => c.nome.toLowerCase().includes(clienteSearch.toLowerCase())).map(c => (
                      <div key={c.id} onMouseDown={() => { setForm(f => ({ ...f, cliente_nome: c.nome, cliente_id: c.id })); setClienteSearch(c.nome); setClienteDropOpen(false); }} style={{ padding: "0.6rem 1rem", fontSize: "11px", color: C.textSec, cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,169,110,0.08)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        {c.nome}{c.nif && <span style={{ fontSize: "9px", color: C.textMuted, marginLeft: "8px" }}>{c.nif}</span>}
                      </div>
                    ))}
                    <div onMouseDown={() => { setClienteCreating(true); setClienteDropOpen(false); }} style={{ padding: "0.6rem 1rem", fontSize: "10px", color: C.gold, cursor: "pointer", letterSpacing: "0.15em", borderTop: "1px solid rgba(201,169,110,0.12)", display: "flex", alignItems: "center", gap: "6px" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,169,110,0.06)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><span>+</span> Criar novo cliente</div>
                  </div>
                )}
              </div>
            )}
          </FormField>

          <FormField label="Data do Evento"><input style={inputStyle} type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} /></FormField>
          {userRole !== "limited_novalues" && <FormField label="Valor Estimado (€)"><input style={inputStyle} type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} /></FormField>}
          <FormField label="Estado"><CustomSelect value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} style={inputStyle} /></FormField>
          <FormField label="Modalidade de Pagamento"><CustomSelect value={form.modalidade} onChange={v => setForm(f => ({ ...f, modalidade: v }))} options={MODALIDADES.map(m => ({ value: m, label: m }))} style={inputStyle} /></FormField>
          <FormField label="Local"><input style={inputStyle} value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} placeholder="SUD, Hyatt, Epic Sana..." /></FormField>
          <FormField label="Contacto"><input style={inputStyle} value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} placeholder="Nome ou telefone..." /></FormField>
          <FormField label="Notas"><input style={inputStyle} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Observações..." /></FormField>

          <div style={{ marginTop: "1.75rem", borderTop: `1px solid ${C.borderDim}`, paddingTop: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <span style={{ fontSize: "7px", letterSpacing: "0.4em", color: C.textMuted, textTransform: "uppercase", fontWeight: 600 }}>Artistas & Pagamentos</span>
              {artists.filter(a => a.nome.trim()).reduce((s, a) => s + (parseFloat(a.fee) || 0), 0) > 0 && <span style={{ fontSize: "9px", color: C.amber, letterSpacing: "0.15em", fontWeight: 600 }}>Total: {artists.filter(a => a.nome.trim()).reduce((s, a) => s + (parseFloat(a.fee) || 0), 0).toLocaleString("pt-PT")}€</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 90px 32px", gap: "4px", marginBottom: "6px" }}>
              {["Nome", "Tipo", "Fee (€)", ""].map(h => <span key={h} style={{ fontSize: "7px", letterSpacing: "0.3em", color: C.textMuted, textTransform: "uppercase", fontWeight: 600, padding: "0 4px" }}>{h}</span>)}
            </div>
            {loadingArtists && <div style={{ fontSize: "10px", color: C.textMuted, padding: "0.5rem 0" }}>A carregar artistas...</div>}
            {artists.map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 130px 90px 32px", gap: "4px", marginBottom: "4px", alignItems: "center" }}>
                <input value={a.nome} onChange={e => updateArtist(setArtists, i, "nome", e.target.value)} placeholder="Nome do artista..." style={{ ...inputStyle, padding: "0.5rem 0.75rem", fontSize: "11px" }} />
                <CustomSelect value={a.tipo} onChange={v => updateArtist(setArtists, i, "tipo", v)} options={ARTIST_TIPOS.map(t => ({ value: t, label: t }))} style={{ ...inputStyle, padding: "0.5rem 0.5rem", fontSize: "10px" }} />
                <input value={a.fee} onChange={e => updateArtist(setArtists, i, "fee", e.target.value)} placeholder="0" type="number" style={{ ...inputStyle, padding: "0.5rem 0.5rem", fontSize: "11px" }} />
                <button type="button" onClick={() => removeArtistRow(setArtists, i)} style={{ background: "transparent", border: "none", color: "rgba(245,240,232,0.2)", cursor: "pointer", fontSize: "13px", padding: "0.4rem", textAlign: "center" }}>✕</button>
              </div>
            ))}
            <button type="button" onClick={() => addArtistRow(setArtists)} style={{ background: "transparent", border: "1px dashed rgba(201,169,110,0.2)", color: C.goldDim, fontSize: "9px", letterSpacing: "0.2em", padding: "0.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", width: "100%", marginTop: "0.25rem" }}>+ Artista</button>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "2rem", paddingTop: "1.5rem", borderTop: `1px solid ${C.borderDim}` }}>
            {modal.editing && !modal.editing.cancelled && <button onClick={async () => { if (modal.editing) { await handleCancel(modal.editing); closeModal(); } }} style={{ ...btnSecStyle, color: C.red, borderColor: "rgba(226,75,74,0.2)" }}>Cancelar Lead</button>}
            {modal.editing && modal.editing.cancelled && <button onClick={async () => { if (modal.editing) { await handleRestore(modal.editing); closeModal(); } }} style={{ ...btnSecStyle, color: C.green, borderColor: "rgba(93,202,165,0.2)" }}>Repor Lead</button>}
            {modal.editing && <button onClick={handleConvertToAgenda} disabled={converting} style={{ ...btnSecStyle, color: C.blue, borderColor: "rgba(133,183,235,0.2)", opacity: converting ? 0.6 : 1 }}>{converting ? "..." : "→ Agenda"}</button>}
            <button onClick={closeModal} style={btnSecStyle}>Fechar</button>
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimStyle, opacity: saving ? 0.6 : 1 }}>{saving ? "A guardar..." : (modal.editing ? "Guardar Alterações" : "Criar Lead")}</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ── COMPONENTES PARTILHADOS (FORA da função principal) ──────────────────────

const tdStyle = (opts?: { nowrap?: boolean; muted?: boolean; maxW?: string }) => ({
  padding: "0.85rem 1.25rem", fontSize: "11px", letterSpacing: "0.03em",
  color: opts?.muted ? C.textSec : C.textPrimary,
  whiteSpace: opts?.nowrap ? "nowrap" as const : undefined,
  maxWidth: opts?.maxW, borderBottom: `1px solid ${C.borderDim}`, verticalAlign: "top" as const,
});

const addBtnStyle: React.CSSProperties = {
  background: "transparent", border: "1px solid rgba(201,169,110,0.3)",
  color: "#C9A96E", fontSize: "8px", letterSpacing: "0.3em", padding: "0.5rem 1.1rem",
  cursor: "pointer", fontFamily: "'Montserrat','Helvetica Neue',sans-serif",
  textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)",
  zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)",
};

const modalStyle: React.CSSProperties = {
  background: "#131108", border: "1px solid rgba(201,169,110,0.12)", padding: "2rem", position: "relative",
};

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  color: "#F5F0E8", fontFamily: "'Montserrat','Helvetica Neue',sans-serif", fontSize: "11px",
  padding: "0.75rem 1rem", letterSpacing: "0.05em", outline: "none", boxSizing: "border-box",
};

const btnPrimStyle: React.CSSProperties = {
  background: "#C9A96E", border: "none", color: "#0C0B09", fontSize: "9px",
  letterSpacing: "0.3em", fontWeight: 700, padding: "0.65rem 1.5rem", cursor: "pointer",
  fontFamily: "'Montserrat','Helvetica Neue',sans-serif", textTransform: "uppercase",
};

const btnSecStyle: React.CSSProperties = {
  background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(245,240,232,0.35)", fontSize: "9px", letterSpacing: "0.3em", padding: "0.65rem 1.25rem",
  cursor: "pointer", fontFamily: "'Montserrat','Helvetica Neue',sans-serif", textTransform: "uppercase",
};

const topLineStyle: React.CSSProperties = {
  position: "absolute", top: 0, left: 0, right: 0, height: "1px",
  background: "linear-gradient(90deg, transparent, #C9A96E, transparent)",
};

function Nav({ userName, active, onLogout }: { userName: string; active: string; onLogout: () => void }) {
  const router = useRouter();
  const items = [
    { key: "dashboard", label: "Dashboard", path: "/dashboard" },
    { key: "agenda", label: "Agenda", path: "/agenda" },
    { key: "leads", label: "Leads", path: "/leads" },
    { key: "faturacao", label: "Faturação", path: "/faturacao" },
    { key: "colaboradores", label: "Colaboradores", path: "/colaboradores" },
    { key: "clientes", label: "Clientes", path: "/clientes" },
  ];
  return (
    <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 2.5rem", borderBottom: `1px solid ${C.borderDim}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        <span onClick={() => router.push("/dashboard")} style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.4rem", letterSpacing: "0.4em", color: C.gold, fontWeight: 300, cursor: "pointer" }}>LLE</span>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {items.map(it => (
            <button key={it.key} onClick={() => router.push(it.path)} style={{ background: active === it.key ? "rgba(201,169,110,0.08)" : "transparent", border: "none", borderBottom: active === it.key ? `1px solid ${C.gold}` : "1px solid transparent", color: active === it.key ? C.gold : C.textMuted, fontSize: "8px", letterSpacing: "0.3em", padding: "0.5rem 0.75rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: active === it.key ? 700 : 400, transition: "all 0.2s" }}>{it.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ fontSize: "9px", color: C.textSec, letterSpacing: "0.2em" }}>{userName}</span>
        <button onClick={onLogout} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: C.textMuted, fontSize: "8px", letterSpacing: "0.2em", padding: "0.4rem 0.8rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Sair</button>
      </div>
    </nav>
  );
}

function IconBtn({ title, onClick, icon, danger, success }: { title: string; onClick: () => void; icon: string; danger?: boolean; success?: boolean }) {
  const color = danger ? C.red : success ? C.green : C.textMuted;
  const hoverBg = danger ? "rgba(226,75,74,0.1)" : success ? "rgba(93,202,165,0.1)" : "rgba(255,255,255,0.06)";
  const [hovered, setHovered] = useState(false);
  const icons: Record<string, React.ReactNode> = {
    edit: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 1.5l3 3L5 14H2v-3z"/></svg>,
    cancel: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>,
    restore: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="1 4 1 1 4 1"/><path d="M1 1l4.5 4.5"/><path d="M4 12a6 6 0 1 0 6-6"/></svg>,
    delete: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="2 4 14 4"/><path d="M5 4V2h6v2"/><path d="M3 4l1 10h8l1-10"/><line x1="7" y1="7" x2="7" y2="11"/><line x1="9" y1="7" x2="9" y2="11"/></svg>,
  };
  return (
    <button title={title} onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ background: hovered ? hoverBg : "transparent", border: "none", cursor: "pointer", padding: "5px", color, display: "flex", alignItems: "center", transition: "background 0.15s" }}>
      {icons[icon] || null}
    </button>
  );
}

function StatusBadge({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "9px", letterSpacing: "0.1em", color, fontWeight: 500 }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function FormField({ label, style, children }: { label: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.25rem", ...style }}>
      <label style={{ display: "block", fontSize: "7px", letterSpacing: "0.4em", color: C.textMuted, textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>{label}</label>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "#0C0B09", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
        <div style={{ width: "24px", height: "24px", border: "2px solid rgba(201,169,110,0.15)", borderTopColor: "#C9A96E", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <span style={{ fontSize: "8px", letterSpacing: "0.4em", color: C.textMuted, textTransform: "uppercase" }}>A carregar</span>
      </div>
    </div>
  );
}

function MobTabBar({ active, role }: { active: string; role: string }) {
  const router = useRouter();
  const tabs = [
    { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
    { key: "agenda", label: "Agenda", path: "/agenda", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { key: "leads", label: "Leads", path: "/leads", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
    { key: "faturacao", label: "Faturas", path: "/faturacao", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(12,11,9,0.97)", borderTop: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(12px)", display: "flex", justifyContent: "space-around", padding: "0.5rem 0 0.75rem", zIndex: 50 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => router.push(t.path)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", color: active === t.key ? "#C9A96E" : "rgba(245,240,232,0.25)", transition: "color 0.2s" }}>
          {t.icon}
          <span style={{ fontSize: "8px", letterSpacing: "0.1em", textTransform: "uppercase" }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}