"use client";

import { ARTIST_TIPOS, MODALIDADES, resolveColaboradorNome } from "../constants";
import { useEffect, useState, useCallback, useRef } from "react";
import React from "react";
import { useRouter } from "next/navigation";

// ── CustomSelect — cross-browser dropdown (substitui <select> nativo) ─────────
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
import {
  getAllAgenda, createAgendaEvent, updateAgendaEvent,
  cancelAgendaEvent, restoreAgendaEvent, deleteAgendaEvent,
  getArtistasEvento, syncArtistasEvento, getAllArtistasAgenda, syncArtistasParaLead,
  getAllClientes, createCliente, getAllLeads, syncAllExistingData,
} from "../actions";

interface AgendaEvent {
  id: number; title: string; event_date: string; time_range?: string;
  tipo?: string; bill?: number; status?: string; cancelled?: number;
  billing_status?: string; cliente_nome?: string; modalidade?: string;
  origem_lead_id?: number | null; venue?: string; event_id?: string;
  contacto?: string; notas?: string;
}

interface Lead {
  id: number; title: string; event_date: string; value: number;
  status?: string; cancelled?: number; cliente_nome?: string; modalidade?: string; cliente_id?: number | null;
}

const CONFIRMED_STATUSES = ["Confirmado", "Em Adjudicação", "Adjudicado", "Pago"];

interface ArtistRow {
  id?: number; nome: string; tipo: string; fee: string;
}

interface Cliente {
  id: number; nome: string; nif?: string; alias?: string;
}

const BILLING_ESTADOS = ["Contacto", "Proposta Enviada", "Em Negociação", "Confirmado", "Em Adjudicação", "Adjudicado", "Faturado", "Pago", "Cancelado"];

// Mapeamento tipo artista → emoji
const TIPO_ICON: Record<string, string> = {
  "DJ": "🎧", "Singer": "🎤", "Dancer": "💃", "Sax": "🎷",
  "Guitar": "🎸", "Bass": "🎸", "Drums": "🥁", "Piano": "🎹",
  "Violino": "🎻", "Acordeão": "🪗", "Trompete": "🎺", "Percussão": "🥁",
  "Fire": "🔥", "Host": "🎙️", "MC": "🎤", "Actor": "🎭",
  "Comediante": "😂", "Mágico": "🪄", "Coreógrafa": "🩰", "Ginasta": "🤸",
  "Produtor": "🧑🏽‍💻", "Guarda-Roupa": "🥻", "Animador": "🎪",
};

// Equipa: João=azul 🔵, Annia=flor 🌸, Empresa=castanho 🟤
const EQUIPA_NOMES = ["João", "Annia", "Empresa"] as const;
const EQUIPA_SYMBOL: Record<string, string> = { "João": "🔵", "Annia": "🌸", "Empresa": "🟤" };
const EQUIPA_COLOR: Record<string, string> = { "João": "#85B7EB", "Annia": "#F4A7C0", "Empresa": "#A07850" };

function parseEquipa(tipo: string): string[] {
  if (!tipo) return [];
  return EQUIPA_NOMES.filter(n => tipo.toLowerCase().includes(n.toLowerCase()));
}

function artistIcons(artistas: ArtistRow[]): string {
  const seen = new Set<string>();
  return artistas
    .filter(a => a.nome.trim())
    .map(a => TIPO_ICON[a.tipo] || "🎵")
    .filter(ic => { if (seen.has(ic)) return false; seen.add(ic); return true; })
    .join("");
}

const C = {
  gold: "#C9A96E", goldDim: "#8a7350", surface: "#111009",
  border: "rgba(201,169,110,0.12)", borderDim: "rgba(255,255,255,0.05)",
  textPrimary: "#F5F0E8", textSec: "rgba(245,240,232,0.45)", textMuted: "rgba(245,240,232,0.22)",
  green: "#5DCAA5", amber: "#EF9F27", blue: "#85B7EB", red: "#E24B4A",
};

function fmtDate(s: string) {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  const weekday = d.toLocaleDateString("pt-PT", { weekday: "short" });
  const date = d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
  return `${date} · ${weekday.charAt(0).toUpperCase() + weekday.slice(1)}`;
}

function artistsSummary(artists: ArtistRow[]) {
  if (!artists.length) return "—";
  return artists.filter(a => a.nome.trim()).map(a => a.nome).join(" · ");
}

const emptyForm = { title: "", date: "", time: "", tipo: "", bill: "0", billing_status: "Contacto", cliente_nome: "", modalidade: "Fatura", venue: "", contacto: "", notas: "" };
const emptyArtist = (): ArtistRow => ({ nome: "", tipo: "DJ", fee: "" });

export default function AgendaPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [artistasMap, setArtistasMap] = useState<Record<number, ArtistRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterArtista, setFilterArtista] = useState("");
  const [filterCliente, setFilterCliente] = useState("");
  const [filterEquipa, setFilterEquipa] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [modal, setModal] = useState<{ open: boolean; editing: AgendaEvent | null }>({ open: false, editing: null });
  const [waModal, setWaModal] = useState(false);
  const [waText, setWaText] = useState("");
  const [waCopied, setWaCopied] = useState(false);
  const [waPeriodModal, setWaPeriodModal] = useState(false);
  const [waPeriodMode, setWaPeriodMode] = useState<"month" | "week7" | "custom">("month");
  const [waCustomStart, setWaCustomStart] = useState("");
  const [waCustomEnd, setWaCustomEnd] = useState("");
  const [waPeriodError, setWaPeriodError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [artists, setArtists] = useState<ArtistRow[]>([emptyArtist()]);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [undoAction, setUndoAction] = useState<{ label: string; fn: () => void } | null>(null);
  const [toastTimer, setToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  // Mobile filter panel state
  const [mobFilterOpen, setMobFilterOpen] = useState(false);
  const [mobFilterCategory, setMobFilterCategory] = useState<"" | "equipa" | "artista" | "cliente">("");
  const [mounted, setMounted] = useState(false);
  const [confirmedLeads, setConfirmedLeads] = useState<Lead[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteDropOpen, setClienteDropOpen] = useState(false);
  const [clienteCreating, setClienteCreating] = useState(false);
  const [isResidencia, setIsResidencia] = useState(false);
  const [residenciaDates, setResidenciaDates] = useState<string[]>([]);

  const showToast = (msg: string, undo?: { label: string; fn: () => void }) => {
    if (toastTimer) clearTimeout(toastTimer);
    setToast(msg);
    setUndoAction(undo || null);
    const t = setTimeout(() => { setToast(""); setUndoAction(null); }, 4000);
    setToastTimer(t);
  };

  const load = useCallback(async () => {
    const [r, ar, cr, lr] = await Promise.all([getAllAgenda(), getAllArtistasAgenda(), getAllClientes(), getAllLeads()]);
    if (r.success) setEvents(r.data as AgendaEvent[]);
    if (ar.success) setArtistasMap(Object.fromEntries(Object.entries(ar.data as Record<number, any[]>).map(([k, v]) => [k, v.map((a: any) => ({ ...a, fee: String(a.fee ?? "") }))])));
    if (cr.success) setClientes(cr.data as Cliente[]);
    if (lr.success) {
      const stripEmoji = (s: string) => s.replace(/[\p{Emoji}\u200d\ufe0f]+/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
      const agendaEvents = r.success ? (r.data as AgendaEvent[]) : [];

      const confirmed = (lr.data as Lead[]).filter(l => {
        if (!CONFIRMED_STATUSES.includes(l.status || "") || !l.event_date) return false;
        const leadTitle = stripEmoji(l.title);
        const leadValue = l.value || 0;
        // Critério primário: lead já tem evento na agenda com origem_lead_id = l.id
        const hasLinkedEvent = agendaEvents.some(e => e.origem_lead_id === l.id);
        if (hasLinkedEvent) return false;
        // Critério fallback (leads antigas sem origem_lead_id): título parecido OU mesmo valor na mesma data
        const isDuplicate = agendaEvents.some(e => {
          if (e.event_date !== l.event_date) return false;
          const agendaTitle = stripEmoji(e.title || "");
          const titleMatch = agendaTitle.includes(leadTitle.slice(0, 12)) || leadTitle.includes(agendaTitle.slice(0, 12));
          const valueMatch = leadValue > 0 && Number(e.bill) === leadValue;
          return titleMatch || valueMatch;
        });
        return !isDuplicate;
      });
      setConfirmedLeads(confirmed);
    }
    setLoading(false);
  }, []);

  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const u = localStorage.getItem("lle_user");
    if (!u) { router.push("/"); return; }
    const parsed = JSON.parse(u);
    setUserName(parsed.name);
    setUserRole(parsed.role || "admin");
    // Sync inicial: corrigir dados históricos (agenda ganha), silencioso, uma vez por sessão
    if (!sessionStorage.getItem("lle_sync_done")) {
      syncAllExistingData().then(r => {
        if (r.success) sessionStorage.setItem("lle_sync_done", "1");
      });
    }
    load();
    setTimeout(() => setMounted(true), 100);
  }, [load]);

  const openCreate = () => {
    setForm({ ...emptyForm, date: new Date().toISOString().split("T")[0] });
    setArtists([emptyArtist()]);
    setClienteSearch("");
    setClienteDropOpen(false);
    setClienteCreating(false);
    setIsResidencia(false);
    setResidenciaDates([new Date().toISOString().split("T")[0]]);
    setModal({ open: true, editing: null });
  };

  const openEdit = async (e: AgendaEvent) => {
    setForm({
      title: e.title, date: e.event_date, time: e.time_range || "",
      tipo: e.tipo || "", bill: String(e.bill || 0),
      billing_status: e.billing_status || "Contacto",
      cliente_nome: e.cliente_nome || "",
      modalidade: e.modalidade || "Fatura",
      venue: e.venue || "",
      contacto: e.contacto || "", notas: e.notas || "",
    });
    setClienteSearch(e.cliente_nome || "");
    setClienteDropOpen(false);
    setClienteCreating(false);
    setIsResidencia(false);
    setResidenciaDates([]);
    setModal({ open: true, editing: e });
    setArtists([emptyArtist()]);
    setLoadingArtists(true);
    const r = await getArtistasEvento(e.id);
    if (r.success && r.data.length > 0) {
      setArtists(r.data.map((a: any) => ({ id: a.id, nome: a.nome, tipo: a.tipo, fee: String(a.fee) })));
    } else {
      setArtists([emptyArtist()]);
    }
    setLoadingArtists(false);
  };

  const closeModal = () => setModal({ open: false, editing: null });

  // Artist table helpers
  const addArtistRow = () => setArtists(prev => [...prev, emptyArtist()]);
  const removeArtistRow = (i: number) => setArtists(prev => prev.filter((_, idx) => idx !== i));
  const updateArtist = (i: number, field: keyof ArtistRow, value: string | number) =>
    setArtists(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a));

  const totalArtistas = artists.filter(a => a.nome.trim()).reduce((s, a) => s + (parseFloat(a.fee) || 0), 0);

  const handleSave = async () => {
    if (!form.title.trim()) { showToast("Título obrigatório"); return; }
    setSaving(true);
    const cleanTitle = form.title.trim().replace(/^\p{Emoji}+\s*/u, "");
    const data = {
      title: cleanTitle, date: form.date, time: form.time, tipo: form.tipo,
      bill: parseFloat(form.bill) || 0, billing_status: form.billing_status,
      cliente_nome: form.cliente_nome, modalidade: form.modalidade,
      venue: form.venue || "",
      contacto: form.contacto || "", notas: form.notas || "",
    };
    const validArtists = artists.filter(a => a.nome.trim()).map(a => ({ ...a, fee: parseFloat(a.fee) || 0 }));

    if (modal.editing) {
      const updateRes = await updateAgendaEvent(modal.editing.id, data);
      await syncArtistasEvento(modal.editing.id, cleanTitle, form.date, validArtists);
      // Sync artistas para a lead ligada — usar leadId resolvido pela action (mais fiável que o objeto em memória)
      const linkedLeadId = updateRes.leadId ?? (modal.editing as any).origem_lead_id;
      if (linkedLeadId) {
        await syncArtistasParaLead(linkedLeadId, cleanTitle, form.date, validArtists);
      }
      showToast("Evento actualizado");
    } else if (isResidencia && residenciaDates.length > 0) {
      const validDates = residenciaDates.filter(d => d.trim());
      for (const d of validDates) {
        const res = await createAgendaEvent({ ...data, date: d });
        if (res.success && res.id) {
          await syncArtistasEvento(res.id, cleanTitle, d, validArtists);
        }
      }
      showToast(`${validDates.length} evento${validDates.length > 1 ? "s" : ""} criado${validDates.length > 1 ? "s" : ""}`);
    } else {
      const res = await createAgendaEvent(data);
      if (res.success && res.id) {
        await syncArtistasEvento(res.id, cleanTitle, form.date, validArtists);
      }
      showToast("Evento criado");
    }
    setSaving(false);
    closeModal();
    load();
  };

  const handleCancel = async (e: AgendaEvent) => {
    await cancelAgendaEvent(e.id);
    load();
    showToast("Evento cancelado", {
      label: "Undo",
      fn: async () => { await restoreAgendaEvent(e.id); setToast(""); setUndoAction(null); load(); },
    });
  };
  const handleRestore = async (e: AgendaEvent) => {
    await restoreAgendaEvent(e.id); showToast("Evento reposto"); load();
  };
  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar este evento definitivamente?")) return;
    await deleteAgendaEvent(id); showToast("Evento eliminado"); load();
  };
  const handleCancelFromModal = async () => {
    if (modal.editing) {
      const ev = modal.editing;
      await cancelAgendaEvent(ev.id);
      closeModal(); load();
      showToast("Evento cancelado", {
        label: "Undo",
        fn: async () => { await restoreAgendaEvent(ev.id); setToast(""); setUndoAction(null); load(); },
      });
    }
  };

  // Converter lead em evento real na agenda
  const handleLeadConvert = async (l: Lead) => {
    const res = await createAgendaEvent({
      title: l.title, date: l.event_date, time: "", tipo: "Evento",
      bill: l.value || 0, billing_status: l.status,
      cliente_id: (l as any).cliente_id ?? null,
      cliente_nome: l.cliente_nome, modalidade: l.modalidade,
      origem_lead_id: l.id,
      contacto: (l as any).contacto || "", notas: (l as any).notas || "",
    });
    if (res.success) { showToast("Lead convertida em evento"); load(); }
    else showToast("Erro ao converter");
  };

  // Cancelar lead a partir da agenda (redireciona para leads page)
  const handleLeadRemove = (l: Lead) => {
    if (!confirm(`Remover "${l.title}" da vista da agenda?\n(A lead continua nas Leads)`)) return;
    // Esconde localmente sem alterar a BD — basta retirar do state
    setConfirmedLeads(prev => prev.filter(x => x.id !== l.id));
  };

  // Verifica se um evento e so do Joao (equipa tem apenas azul)
  const isSoJoao = (tipo: string) => {
    const equipa = parseEquipa(tipo);
    return equipa.length > 0 && equipa.every(n => n === "João");
  };

  const filtered = events.filter(e => {
    const monthMatch = e.event_date.startsWith(selectedMonth);
    const searchMatch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || (e.tipo || "").toLowerCase().includes(search.toLowerCase());
    const evArtists = artistasMap[e.id] || [];
    const artistaMatch = !filterArtista || evArtists.some(a => resolveColaboradorNome(a.nome).toLowerCase() === filterArtista.toLowerCase());
    const clienteMatch = !filterCliente || (() => {
      const cn = e.cliente_nome || '';
      const c = clientes.find(c => c.nome === cn || (c.alias?.trim() && c.alias.trim() === cn));
      const display = c?.alias?.trim() || cn;
      return display.toLowerCase() === filterCliente.toLowerCase();
    })();
    const equipaMatch = !filterEquipa || parseEquipa(e.tipo || "").includes(filterEquipa);
    // Soraya, Annia e Larissa nao veem eventos so do Joao
    const visibilityMatch = (userRole === "admin" && userName === "João") || !isSoJoao(e.tipo || "");
    return monthMatch && searchMatch && artistaMatch && clienteMatch && equipaMatch && visibilityMatch;
  });

  // Leads confirmadas do mês seleccionado que ainda não estão na agenda
  // Listas para os dropdowns — baseadas em TODOS os eventos do mês seleccionado
  const allMonthEvents = events.filter(e => e.event_date.startsWith(selectedMonth));
  const dropdownArtistas = Array.from(new Set(
    allMonthEvents.flatMap(e => (artistasMap[e.id] || []).map(a => resolveColaboradorNome(a.nome))).filter(Boolean)
  )).sort();
  const dropdownClientes = Array.from(new Set(
    allMonthEvents.map(e => {
      if (!e.cliente_nome) return '';
      const c = clientes.find(c => c.nome === e.cliente_nome || (c.alias?.trim() && c.alias.trim() === e.cliente_nome));
      return c?.alias?.trim() || e.cliente_nome;
    }).filter(Boolean)
  )).sort();
  const dropdownEquipa = EQUIPA_NOMES.filter(n =>
    allMonthEvents.some(e => parseEquipa(e.tipo || "").includes(n))
  );

  const filteredLeads = confirmedLeads.filter(l => l.event_date.startsWith(selectedMonth));

  // Todos os dias do mês seleccionado para mostrar folgas
  const daysInSelectedMonth = (() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const count = new Date(y, m, 0).getDate();
    const days: string[] = [];
    for (let d = 1; d <= count; d++) {
      days.push(`${selectedMonth}-${String(d).padStart(2, "0")}`);
    }
    return days;
  })();

  const eventDates = new Set(filtered.map(e => e.event_date));
  const leadDates = new Set(filteredLeads.map(l => l.event_date));

  // Dias sem nenhum evento nem lead confirmada = Folga
  const folgaDays = !search ? daysInSelectedMonth.filter(d => !eventDates.has(d) && !leadDates.has(d)) : [];

  // Unificar tudo numa lista ordenada por data
  type Row =
    | { kind: "event"; date: string; data: AgendaEvent }
    | { kind: "lead"; date: string; data: Lead }
    | { kind: "folga"; date: string };

  // Helper: extract start hour from time_range like "20:00-23:00"
  const timeToMinutes = (t?: string) => {
    if (!t) return 9999;
    const m = t.match(/^(\d{1,2}):(\d{2})/);
    return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 9999;
  };

  const allRows: Row[] = [
    ...filtered.map(e => ({ kind: "event" as const, date: e.event_date, data: e })),
    ...filteredLeads.map(l => ({ kind: "lead" as const, date: l.event_date, data: l })),
    ...folgaDays.map(d => ({ kind: "folga" as const, date: d })),
  ].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    // Same day: sort events by start time
    const aTime = a.kind === "event" ? timeToMinutes(a.data.time_range) : (a.kind === "lead" ? 9998 : 9999);
    const bTime = b.kind === "event" ? timeToMinutes(b.data.time_range) : (b.kind === "lead" ? 9998 : 9999);
    return aTime - bTime;
  });

  const availableMonths = Array.from(new Set([
    ...events.map(e => e.event_date.slice(0, 7)),
    ...confirmedLeads.map(l => l.event_date.slice(0, 7)),
  ])).sort();
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  };


  // ── WhatsApp: abrir modal de seleção de período ───────────────────────────
  const openWaPeriodModal = () => {
    setWaPeriodMode("month");
    setWaCustomStart("");
    setWaCustomEnd("");
    setWaPeriodError("");
    setWaPeriodModal(true);
  };

  const WEEKDAYS_PT_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  const buildAgendaTextForRange = (startDate: string, endDate: string, label: string): string => {
    const lines: string[] = [label, ""];
    const TIPO_LABEL: Record<string, string> = {
      "DJ": "🎧 DJ", "Cantor": "🎤 Cantor", "Cantora": "🎤 Cantora",
      "Músico": "🎵 Músico", "Pianista": "🎹 Pianista", "Saxofonista": "🎷 Saxofone",
      "Guitarrista": "🎸 Guitarra", "Baterista": "🥁 Bateria", "Violinista": "🎻 Violino",
      "Backing Vocal": "🎤 Backing", "Host": "🎙️ Host", "Karaoke": "🎤 Karaoke",
      "Produtor": "🧑🏽‍💻 Produtor", "Técnico": "🔧 Técnico", "Outro": "🎵",
    };
    const parseLocalDate = (dateStr: string) => {
      const [y, m, d] = dateStr.split("-").map(Number);
      return new Date(y, m - 1, d);
    };
    const cur = parseLocalDate(startDate);
    const last = parseLocalDate(endDate);
    while (cur <= last) {
      const dd = String(cur.getDate()).padStart(2, "0");
      const mm = String(cur.getMonth() + 1).padStart(2, "0");
      const yyyy = cur.getFullYear();
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const wd = WEEKDAYS_PT_LONG[cur.getDay()];
      const dayEvents = events.filter(e => {
        if (e.event_date !== dateStr || e.cancelled) return false;
        if (!((userRole === "admin" && userName === "João") || !isSoJoao(e.tipo || ""))) return false;
        const evArtists = artistasMap[e.id] || [];
        if (filterArtista && !evArtists.some(a => resolveColaboradorNome(a.nome).toLowerCase() === filterArtista.toLowerCase())) return false;
        if (filterCliente && (() => {
          const cn = e.cliente_nome || '';
          const c = clientes.find(c => c.nome === cn || (c.alias?.trim() && c.alias.trim() === cn));
          const display = c?.alias?.trim() || cn;
          return display.toLowerCase() !== filterCliente.toLowerCase();
        })()) return false;
        if (filterEquipa && !parseEquipa(e.tipo || "").includes(filterEquipa)) return false;
        return true;
      });
      const dayLeads = confirmedLeads.filter(l => l.event_date === dateStr && !l.cancelled);
      if (dayEvents.length === 0 && dayLeads.length === 0) {
        lines.push(`*${dd}/${mm} ${wd}*`);
        lines.push(`⛱️ FOLGA`);
        lines.push("");
      } else {
        for (const e of dayEvents) {
          const evArtists = artistasMap[e.id] || [];
          const seen = new Set<string>();
          const icons = evArtists
            .filter(a => a.nome.trim())
            .map(a => { const ic = TIPO_ICON[a.tipo] || "🎵"; if (seen.has(ic)) return ""; seen.add(ic); return ic; })
            .filter(Boolean).join("") || "🎵";
          const title = (e.title || "").replace(/^\p{Emoji}[\p{Emoji}‍\s]*/u, "").trim();
          const venue = e.venue ? `\n📍 ${e.venue}` : "";
          const time = (e.time_range && e.time_range !== "undefined") ? `\n🕐 ${e.time_range}` : "";
          const artistLines = evArtists
            .filter(a => a.nome.trim())
            .map(a => {
              const label = TIPO_LABEL[a.tipo] || `🎵 ${a.tipo}`;
              const fee = parseFloat(a.fee) > 0 ? ` (${Number(a.fee).toLocaleString("pt-PT", { minimumFractionDigits: 0 })}€)` : "";
              return `   ${label}: ${resolveColaboradorNome(a.nome)}${fee}`;
            }).join("\n");
          const bill = e.bill ? `\n💶 Faturar: ${Number(e.bill).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€` : "";
          lines.push(`*${dd}/${mm} ${wd} ${icons} ${title}*${venue}${time}`);
          if (artistLines) lines.push(artistLines);
          if (bill) lines.push(bill);
          lines.push("");
        }
        for (const l of dayLeads) {
          const status = (l.status || "").toLowerCase();
          const icon = ["confirmado","adjudicado","faturado","pago"].includes(status) ? "🟢" : status === "cancelado" ? "🔴" : "🟡";
          lines.push(`*${dd}/${mm} ${wd} ${icon} ${l.title}*`);
          lines.push("");
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
    return lines.join("\n").trim();
  };

  const handleCopyAgenda = () => {
    let startDate = "", endDate = "", label = "";
    if (waPeriodMode === "month") {
      const [y, m] = selectedMonth.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      startDate = `${selectedMonth}-01`;
      endDate = `${selectedMonth}-${String(daysInMonth).padStart(2, "0")}`;
      const mName = new Date(y, m - 1, 1).toLocaleDateString("pt-PT", { month: "long" });
      label = `*Agenda de ${mName.charAt(0).toUpperCase() + mName.slice(1)}*`;
    } else if (waPeriodMode === "week7") {
      const today = new Date();
      const end = new Date(today);
      end.setDate(today.getDate() + 7);
      // Use local date (not toISOString which shifts timezone)
      const toLocalDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      startDate = toLocalDateStr(today);
      endDate = toLocalDateStr(end);
      const fmt = (d: Date) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
      label = `*Agenda de ${fmt(today)} a ${fmt(end)}*`;
    } else {
      if (!waCustomStart || !waCustomEnd) { setWaPeriodError("Preenche as duas datas."); return; }
      if (waCustomEnd < waCustomStart) { setWaPeriodError("Data final não pode ser anterior à inicial."); return; }
      startDate = waCustomStart;
      endDate = waCustomEnd;
      const [, sm, sd] = waCustomStart.split("-");
      const [, em, ed] = waCustomEnd.split("-");
      label = `*Agenda de ${sd}/${sm} a ${ed}/${em}*`;
    }
    const text = buildAgendaTextForRange(startDate, endDate, label);
    setWaText(text);
    setWaCopied(false);
    setWaPeriodModal(false);
    setWaModal(true);
    const doCopy = (t: string) => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(t).then(() => setWaCopied(true)).catch(() => {
          const ta = document.createElement("textarea");
          ta.value = t; document.body.appendChild(ta); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta); setWaCopied(true);
        });
      } else {
        const ta = document.createElement("textarea");
        ta.value = t; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta); setWaCopied(true);
      }
    };
    doCopy(text);
  };

  if (loading) return <Loading />;

  const todayStr = new Date().toISOString().split("T")[0];
  const bsColors: Record<string, string> = {
    "Contacto": "rgba(245,240,232,0.4)", "Proposta Enviada": C.blue,
    "Em Negociação": C.amber, "Confirmado": C.green,
    "Em Adjudicação": C.gold, "Adjudicado": C.gold,
    "Faturado": "#A78BFA", "Pago": C.green, "Cancelado": C.red,
  };

  return (
    <>
    {/* ═══ DESKTOP ═══ */}
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: "#0C0B09", color: C.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <Nav userName={userName} active="agenda" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/"); }} />

      <main style={{ padding: "2rem 2.5rem", maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.textSec, textTransform: "uppercase", fontWeight: 600 }}>Agenda 2026</p>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              onClick={openWaPeriodModal}
              style={{ background: "transparent", border: "1px solid rgba(93,202,165,0.2)", color: "#5DCAA5", fontSize: "8px", letterSpacing: "0.3em", padding: "0.5rem 1.1rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              WhatsApp
            </button>
            {userRole !== "limited_novalues" && (
            <button onClick={openCreate} style={addBtnStyle}>
              <svg width="10" height="10" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
              Novo Evento
            </button>
            )}
          </div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.borderDim}`, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" }} />
          <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.borderDim}`, overflowX: "auto" }}>
            {availableMonths.map(ym => (
              <button key={ym} onClick={() => setSelectedMonth(ym)} style={{ background: selectedMonth === ym ? "rgba(201,169,110,0.08)" : "transparent", border: "none", borderRight: `1px solid ${C.borderDim}`, borderBottom: selectedMonth === ym ? `1px solid ${C.gold}` : "none", color: selectedMonth === ym ? C.gold : C.textMuted, fontSize: "8px", letterSpacing: "0.3em", padding: "0.75rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize", fontWeight: selectedMonth === ym ? 700 : 400, whiteSpace: "nowrap", transition: "all 0.2s" }}>
                {monthLabel(ym)}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0", borderBottom: `1px solid ${C.borderDim}` }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar evento..."
              style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: "none", borderRight: `1px solid ${C.borderDim}`, color: C.textPrimary, fontFamily: "inherit", fontSize: "11px", padding: "0.9rem 1.5rem", letterSpacing: "0.05em", outline: "none" }}
            />
            {/* Artista dropdown */}
            <CustomSelect
              value={filterArtista}
              onChange={v => setFilterArtista(v)}
              placeholder="Artista"
              options={[{ value: "", label: "Artista" }, ...dropdownArtistas.map(a => ({ value: a, label: a }))]}
              style={{ background: filterArtista ? "rgba(201,169,110,0.08)" : "rgba(255,255,255,0.02)", border: "none", borderRight: `1px solid ${C.borderDim}`, color: filterArtista ? C.gold : C.textMuted, fontFamily: "inherit", fontSize: "8px", letterSpacing: "0.25em", padding: "0.9rem 1.25rem", outline: "none", cursor: "pointer", minWidth: "130px", textTransform: "uppercase" as any }}
            />
            {/* Cliente dropdown */}
            <CustomSelect
              value={filterCliente}
              onChange={v => setFilterCliente(v)}
              placeholder="Cliente"
              options={[{ value: "", label: "Cliente" }, ...dropdownClientes.map(c => ({ value: c, label: c }))]}
              style={{ background: filterCliente ? "rgba(201,169,110,0.08)" : "rgba(255,255,255,0.02)", border: "none", borderRight: `1px solid ${C.borderDim}`, color: filterCliente ? C.gold : C.textMuted, fontFamily: "inherit", fontSize: "8px", letterSpacing: "0.25em", padding: "0.9rem 1.25rem", outline: "none", cursor: "pointer", minWidth: "130px", textTransform: "uppercase" as any }}
            />
            {/* Equipa dropdown */}
            <CustomSelect
              value={filterEquipa}
              onChange={v => setFilterEquipa(v)}
              placeholder="Equipa"
              options={[{ value: "", label: "Equipa" }, ...dropdownEquipa.map(n => ({ value: n, label: `${EQUIPA_SYMBOL[n]} ${n}` }))]}
              style={{ background: filterEquipa ? "rgba(201,169,110,0.08)" : "rgba(255,255,255,0.02)", border: "none", color: filterEquipa ? C.gold : C.textMuted, fontFamily: "inherit", fontSize: "8px", letterSpacing: "0.25em", padding: "0.9rem 1.25rem", outline: "none", cursor: "pointer", minWidth: "120px", textTransform: "uppercase" as any }}
            />
            {/* Clear filters — só aparece se houver algum filtro activo */}
            {(filterArtista || filterCliente || filterEquipa) && (
              <button
                onClick={() => { setFilterArtista(""); setFilterCliente(""); setFilterEquipa(""); }}
                style={{ background: "transparent", border: "none", borderLeft: `1px solid ${C.borderDim}`, color: C.textMuted, fontSize: "9px", padding: "0.9rem 1rem", cursor: "pointer", whiteSpace: "nowrap", letterSpacing: "0.2em" }}
                title="Limpar filtros"
              >✕</button>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Data", "Evento", "Hora", "Local", "Equipa", "Artistas", "Modalidade", "Estado", "Faturação", "Ações"].map((h, i) => (
                    <th key={h} style={{ fontSize: "7px", letterSpacing: "0.4em", color: C.goldDim, fontWeight: 600, textTransform: "uppercase", padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.border}`, textAlign: i >= 8 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allRows.map((row, idx) => {
                  if (row.kind === "folga") {
                    const isFolgaToday = row.date === todayStr;
                    return (
                      <tr key={`folga-${row.date}`} style={{ opacity: 0.38, background: isFolgaToday ? "rgba(201,169,110,0.04)" : undefined }}>
                        <td style={{ ...tdStyle({ nowrap: true }), color: isFolgaToday ? "#C9A96E" : undefined, fontWeight: isFolgaToday ? 700 : undefined }}>{fmtDate(row.date)}</td>
                        <td colSpan={8} style={{ ...tdStyle({}), fontSize: "10px", color: C.textMuted, letterSpacing: "0.2em", fontStyle: "italic" }}>
                          🏝️ Folga
                        </td>
                      </tr>
                    );
                  }
                  if (row.kind === "lead") {
                    const l = row.data;
                    const isLeadToday = l.event_date === todayStr;
                    return (
                      <tr key={`lead-${l.id}`} style={{ background: isLeadToday ? "rgba(201,169,110,0.07)" : "rgba(201,169,110,0.04)", borderLeft: isLeadToday ? `3px solid ${C.gold}` : `2px solid rgba(201,169,110,0.35)` }}>
                        <td style={{ ...tdStyle({ nowrap: true }), color: isLeadToday ? C.gold : undefined, fontWeight: isLeadToday ? 700 : undefined }}>{fmtDate(l.event_date)}</td>
                        <td style={{ ...tdStyle({}), maxWidth: "280px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "11px" }}>{l.title}</span>
                            </span>
                            <span style={{ fontSize: "8px", color: C.goldDim, letterSpacing: "0.25em", textTransform: "uppercase" }}>Lead · {l.status}</span>
                          </div>
                        </td>
                        <td style={tdStyle({ muted: true })} colSpan={3}>—</td>
                        <td style={tdStyle({ muted: true })}>
                          <span style={{ fontSize: "9px", color: C.textMuted }}>{l.modalidade || "Fatura"}</span>
                        </td>
                        <td style={tdStyle({})}>
                          <StatusBadge color={C.amber} label={l.status || "Confirmado"} />
                        </td>
                        <td style={{ ...tdStyle({ nowrap: true }), textAlign: "right", color: C.gold, fontWeight: 600, fontSize: "11px" }}>
                          {userRole === "limited_novalues" ? "—" : (Number(l.value) > 0 ? `${Number(l.value).toLocaleString("pt-PT")}€` : "—")}
                        </td>
                        <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end", alignItems: "center" }}>
                            <button
                              title="Converter para evento"
                              onClick={() => handleLeadConvert(l)}
                              style={{ background: "transparent", border: "none", cursor: "pointer", padding: "5px", color: C.green, fontSize: "9px", letterSpacing: "0.15em", fontFamily: "inherit", fontWeight: 600 }}
                            >→</button>
                            <IconBtn title="Ocultar da agenda" onClick={() => handleLeadRemove(l)} icon="cancel" danger />
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  // kind === "event"
                  const e = row.data;
                  const isEventToday = e.event_date === todayStr;
                  return (
                  <tr key={e.id} style={{ opacity: e.cancelled ? 0.45 : 1, background: isEventToday ? "rgba(201,169,110,0.06)" : undefined, borderLeft: isEventToday ? `3px solid ${C.gold}` : undefined }}>
                    <td style={{ ...tdStyle({ nowrap: true }), color: isEventToday ? C.gold : undefined, fontWeight: isEventToday ? 700 : undefined }}>{fmtDate(e.event_date)}</td>
                    <td style={{ ...tdStyle({}), maxWidth: "280px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ textDecoration: e.cancelled ? "line-through" : "none", display: "flex", alignItems: "center", gap: "6px" }}>
                          {(() => {
                            const evArtists = artistasMap[e.id] || [];
                            const icons = artistIcons(evArtists);
                            return icons
                              ? <span style={{ fontSize: "13px", letterSpacing: "1px", flexShrink: 0 }}>{icons}</span>
                              : null;
                          })()}
                          <span style={{ fontSize: "11px" }}>{e.title.replace(/^\p{Emoji}[\p{Emoji}\u200d\s]*/u, "")}</span>
                        </span>
                        {!!e.cancelled && <span style={{ fontSize: "8px", color: C.red, letterSpacing: "0.2em" }}>[CANCELADO]</span>}
                      </div>
                    </td>
                    <td style={tdStyle({ muted: true, nowrap: true })}>{e.time_range || "—"}</td>
                    <td style={tdStyle({ muted: true, maxW: "140px" })}>{e.venue || <span style={{ color: C.textMuted }}>—</span>}</td>
                    <td style={{ ...tdStyle({}), padding: "0.85rem 1rem" }}>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                        {parseEquipa(e.tipo || "").length > 0
                          ? parseEquipa(e.tipo || "").map(n => (
                              <span key={n} title={n} style={{ fontSize: "16px", lineHeight: 1 }}>{EQUIPA_SYMBOL[n]}</span>
                            ))
                          : <span style={{ fontSize: "10px", color: C.textMuted }}>—</span>
                        }
                      </div>
                    </td>
                    <td style={{ ...tdStyle({}), maxWidth: "200px" }}>
                      {(() => {
                        const evArtists = (artistasMap[e.id] || []).filter(a => a.nome.trim());
                        return evArtists.length > 0
                          ? <span style={{ fontSize: "10px", color: C.textSec, letterSpacing: "0.03em" }}>
                              {evArtists.map(a => resolveColaboradorNome(a.nome)).join(" · ")}
                            </span>
                          : <span style={{ fontSize: "10px", color: C.textMuted }}>—</span>;
                      })()}
                    </td>
                    <td style={tdStyle({ muted: true })}>
                      {e.modalidade && e.modalidade !== "Fatura" ? (
                        <span style={{ fontSize: "9px", color: C.amber, letterSpacing: "0.1em" }}>{e.modalidade}</span>
                      ) : (
                        <span style={{ fontSize: "9px", color: C.textMuted }}>Fatura</span>
                      )}
                    </td>
                    <td style={tdStyle({})}>
                      {e.cancelled ? (
                        <StatusBadge color={C.red} label="Cancelado" />
                      ) : (() => {
                        const bs = e.billing_status || "Contacto";
                        const colorMap: Record<string, string> = {
                          "Contacto": C.textSec, "Proposta Enviada": C.blue,
                          "Em Negociação": C.amber, "Confirmado": C.green,
                          "Em Adjudicação": C.gold, "Adjudicado": C.gold,
                          "Faturado": "#A78BFA", "Pago": C.green, "Cancelado": C.red,
                        };
                        return <StatusBadge color={colorMap[bs] || C.textSec} label={bs} />;
                      })()}
                    </td>
                    <td style={{ ...tdStyle({ nowrap: true }), textAlign: "right", color: C.gold, fontWeight: 600, fontSize: "11px" }}>
                      {userRole === "limited_novalues" ? "—" : (Number(e.bill) > 0 ? `${Number(e.bill).toLocaleString("pt-PT")}€` : "—")}
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                      {userRole !== "limited_novalues" && (
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <IconBtn title="Editar" onClick={() => openEdit(e)} icon="edit" />
                        {!e.cancelled
                          ? <IconBtn title="Cancelar" onClick={() => handleCancel(e)} icon="cancel" danger />
                          : <IconBtn title="Repor" onClick={() => handleRestore(e)} icon="restore" success />
                        }
                        <IconBtn title="Eliminar" onClick={() => handleDelete(e.id)} icon="delete" danger />
                      </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
                {allRows.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: "3rem", fontSize: "11px", color: C.textMuted, letterSpacing: "0.2em" }}>Sem eventos encontrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

    </div>{/* end desktop */}

    {/* ═══ MOBILE ═══ */}
    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: "#F5F0E8", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      {/* Mobile top nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.1rem", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(12,11,9,0.97)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.2rem", letterSpacing: "0.35em", color: "#C9A96E", fontWeight: 300 }}>LLE</span>
        <span style={{ fontSize: "8px", letterSpacing: "0.35em", color: "rgba(245,240,232,0.2)", textTransform: "uppercase" }}>{userName}</span>
      </div>

      {/* Month pills */}
      <div className="mob-months">
        {availableMonths.map(ym => (
          <button key={ym} className={`mob-mpill${selectedMonth === ym ? " active" : ""}`} onClick={() => setSelectedMonth(ym)}>
            {monthLabel(ym).split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="mob-topbar">
        <div className="mob-search-wrap">
          <svg className="mob-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="15" y2="15"/>
          </svg>
          <input className="mob-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar evento..." />
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={openWaPeriodModal}
            style={{ background: "rgba(93,202,165,0.08)", border: "1px solid rgba(93,202,165,0.2)", color: "#5DCAA5", fontSize: "10px", padding: "0.5rem 0.7rem", cursor: "pointer", borderRadius: "2px" }}
            title="Copiar Agenda para WhatsApp"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </button>
          {/* Mobile filter button */}
          <button
            onClick={() => { setMobFilterOpen(o => !o); setMobFilterCategory(""); }}
            style={{ background: (filterArtista || filterCliente || filterEquipa) ? "rgba(201,169,110,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${(filterArtista || filterCliente || filterEquipa) ? "rgba(201,169,110,0.3)" : "rgba(255,255,255,0.1)"}`, color: (filterArtista || filterCliente || filterEquipa) ? "#C9A96E" : "rgba(245,240,232,0.4)", fontSize: "10px", padding: "0.5rem 0.7rem", cursor: "pointer", borderRadius: "2px", display: "flex", alignItems: "center", gap: "4px" }}
            title="Filtros"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            {(filterArtista || filterCliente || filterEquipa) && <span style={{ fontSize: "8px", fontWeight: 700 }}>1</span>}
          </button>
          {userRole !== "limited_novalues" && (
            <button className="mob-fab" onClick={openCreate}>
              <svg width="16" height="16" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Mobile filter panel */}
      {mobFilterOpen && (
        <div style={{ background: "#131108", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0.75rem 1rem", flexShrink: 0 }}>
          {!mobFilterCategory ? (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(["equipa", "artista", "cliente"] as const).map(cat => (
                <button key={cat} onClick={() => setMobFilterCategory(cat)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(245,240,232,0.6)", fontSize: "9px", letterSpacing: "0.2em", padding: "0.4rem 0.9rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>
                  {cat === "equipa" ? "Equipa" : cat === "artista" ? "Artistas" : "Clientes"}
                </button>
              ))}
              {(filterArtista || filterCliente || filterEquipa) && (
                <button onClick={() => { setFilterArtista(""); setFilterCliente(""); setFilterEquipa(""); setMobFilterOpen(false); }} style={{ background: "rgba(226,75,74,0.08)", border: "1px solid rgba(226,75,74,0.2)", color: "#E24B4A", fontSize: "9px", letterSpacing: "0.2em", padding: "0.4rem 0.9rem", cursor: "pointer", fontFamily: "inherit" }}>
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div>
              <button onClick={() => setMobFilterCategory("")} style={{ background: "transparent", border: "none", color: "rgba(201,169,110,0.6)", fontSize: "8px", letterSpacing: "0.3em", cursor: "pointer", fontFamily: "inherit", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "4px" }}>← Voltar</button>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {mobFilterCategory === "equipa" && dropdownEquipa.map(n => (
                  <button key={n} onClick={() => { setFilterEquipa(filterEquipa === n ? "" : n); setMobFilterOpen(false); }} style={{ background: filterEquipa === n ? "rgba(201,169,110,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${filterEquipa === n ? "rgba(201,169,110,0.3)" : "rgba(255,255,255,0.1)"}`, color: filterEquipa === n ? "#C9A96E" : "rgba(245,240,232,0.6)", fontSize: "10px", padding: "0.4rem 0.9rem", cursor: "pointer", fontFamily: "inherit" }}>
                    {EQUIPA_SYMBOL[n]} {n}
                  </button>
                ))}
                {mobFilterCategory === "artista" && dropdownArtistas.map(a => (
                  <button key={a} onClick={() => { setFilterArtista(filterArtista === a ? "" : a); setMobFilterOpen(false); }} style={{ background: filterArtista === a ? "rgba(201,169,110,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${filterArtista === a ? "rgba(201,169,110,0.3)" : "rgba(255,255,255,0.1)"}`, color: filterArtista === a ? "#C9A96E" : "rgba(245,240,232,0.6)", fontSize: "10px", padding: "0.4rem 0.9rem", cursor: "pointer", fontFamily: "inherit" }}>
                    {a}
                  </button>
                ))}
                {mobFilterCategory === "cliente" && dropdownClientes.map(c => (
                  <button key={c} onClick={() => { setFilterCliente(filterCliente === c ? "" : c); setMobFilterOpen(false); }} style={{ background: filterCliente === c ? "rgba(201,169,110,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${filterCliente === c ? "rgba(201,169,110,0.3)" : "rgba(255,255,255,0.1)"}`, color: filterCliente === c ? "#C9A96E" : "rgba(245,240,232,0.6)", fontSize: "10px", padding: "0.4rem 0.9rem", cursor: "pointer", fontFamily: "inherit" }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Card list */}
      <div className="mob-list">
        {allRows.length === 0 && <div className="mob-empty">Sem eventos encontrados</div>}
        {allRows.map((row) => {
          if (row.kind === "folga") {
            const d = new Date(row.date + "T00:00:00");
            return (
              <div key={`f-${row.date}`} className="mob-card is-folga">
                <div className="mob-date-bubble">
                  <div className="mob-date-day">{d.getDate()}</div>
                  <div className="mob-date-weekday">{d.toLocaleDateString("pt-PT",{weekday:"short"})}</div>
                </div>
                <div className="mob-card-body">
                  <div className="mob-card-title" style={{opacity:0.35}}>🏝️ Folga</div>
                </div>
              </div>
            );
          }
          if (row.kind === "lead") {
            const l = row.data;
            const d = new Date(l.event_date + "T00:00:00");
            const isToday = l.event_date === todayStr;
            return (
              <div key={`l-${l.id}`} className={`mob-card is-lead${isToday ? " is-today" : ""}`}>
                <div className="mob-date-bubble">
                  <div className="mob-date-day">{d.getDate()}</div>
                  <div className="mob-date-weekday">{d.toLocaleDateString("pt-PT",{weekday:"short"})}</div>
                </div>
                <div className="mob-card-body">
                  <div className="mob-card-title">{l.title}</div>
                  <div className="mob-card-meta">
                    <span className="mob-badge" style={{background:"rgba(201,169,110,0.08)",color:"#C9A96E"}}>
                      <span className="mob-badge-dot" style={{background:"#C9A96E"}}/>Lead
                    </span>
                    <span className="mob-badge" style={{background:"rgba(239,159,39,0.08)",color:"#EF9F27"}}>{l.status}</span>
                  </div>
                </div>
                <div className="mob-card-right">
                  {userRole !== "limited_novalues" && Number(l.value) > 0
                    ? <span className="mob-card-value">{Number(l.value).toLocaleString("pt-PT")}€</span>
                    : <span className="mob-card-value muted">—</span>
                  }
                  {userRole !== "limited_novalues" && (
                    <button onClick={() => handleLeadConvert(l)} style={{background:"transparent",border:"none",color:"#5DCAA5",fontSize:"16px",cursor:"pointer",padding:"2px"}}>→</button>
                  )}
                </div>
              </div>
            );
          }
          const e = row.data;
          const d = new Date(e.event_date + "T00:00:00");
          const isToday = e.event_date === todayStr;
          const evArtists = (artistasMap[e.id] || []).filter((a:any) => a.nome.trim());
          const bs = e.billing_status || "Contacto";
          const bsColor = e.cancelled ? C.red : (bsColors[bs] || "rgba(245,240,232,0.3)");
          return (
            <div key={e.id} className={`mob-card${isToday ? " is-today" : ""}${e.cancelled ? " is-folga" : ""}`}>
              <div className="mob-date-bubble">
                <div className="mob-date-day">{d.getDate()}</div>
                <div className="mob-date-weekday">{d.toLocaleDateString("pt-PT",{weekday:"short"})}</div>
              </div>
              <div className="mob-card-body" onClick={() => userRole !== "limited_novalues" && openEdit(e)} style={{cursor: userRole !== "limited_novalues" ? "pointer" : "default"}}>
                <div className={`mob-card-title${e.cancelled?" cancelled":""}`}>
                  {artistIcons(artistasMap[e.id]||[]) && <span style={{marginRight:4}}>{artistIcons(artistasMap[e.id]||[])}</span>}
                  {e.title.replace(/^\p{Emoji}[\p{Emoji}‍\s]*/u,"")}
                </div>
                <div className="mob-card-meta">
                  {e.time_range && <><span>{e.time_range}</span><span className="mob-card-meta-dot">·</span></>}
                  {e.venue && <><span style={{color:"rgba(201,169,110,0.7)"}}>📍 {e.venue}</span><span className="mob-card-meta-dot">·</span></>}
                  {parseEquipa(e.tipo||"").map(n=><span key={n}>{EQUIPA_SYMBOL[n]}</span>)}
                  {evArtists.length > 0 && <><span className="mob-card-meta-dot">·</span><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"140px"}}>{evArtists.slice(0,2).map((a:any)=>resolveColaboradorNome(a.nome)).join(" · ")}{evArtists.length>2?` +${evArtists.length-2}`:""}</span></>}
                </div>
                <div className="mob-card-badges">
                  <span className="mob-badge" style={{background:`${bsColor}18`,color:bsColor}}>
                    <span className="mob-badge-dot" style={{background:bsColor}}/>
                    {e.cancelled?"Cancelado":bs}
                  </span>
                </div>
              </div>
              <div className="mob-card-right">
                {userRole !== "limited_novalues" && Number(e.bill) > 0
                  ? <span className="mob-card-value">{Number(e.bill).toLocaleString("pt-PT")}€</span>
                  : <span className="mob-card-value muted">—</span>
                }
                <svg className="mob-card-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 4 10 8 6 12"/></svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom tab bar */}
      <MobTabBar active="agenda" role={userRole} />
    </div>

    {/* ═══ MODAL (shared) ═══ */}
      {/* WhatsApp — Modal de Período */}
      {waPeriodModal && (
        <div onClick={e => e.target === e.currentTarget && setWaPeriodModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#131108", border: "1px solid rgba(201,169,110,0.12)", padding: "2rem", width: "400px", maxWidth: "95vw", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "8px", letterSpacing: "0.4em", color: "rgba(201,169,110,0.6)", textTransform: "uppercase", fontWeight: 600 }}>Copiar Agenda para WhatsApp</p>
              <button onClick={() => setWaPeriodModal(false)} style={{ background: "transparent", border: "none", color: "rgba(245,240,232,0.3)", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
              {([
                { id: "month" as const, label: "Geral / Mês atual", sub: monthLabel(selectedMonth) },
                { id: "week7" as const, label: "Hoje + 7 dias", sub: (() => { const t = new Date(); const e2 = new Date(t); e2.setDate(t.getDate()+7); const fmt = (d: Date) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`; return `${fmt(t)} → ${fmt(e2)}`; })() },
                { id: "custom" as const, label: "Intervalo personalizado", sub: "" },
              ] as { id: "month" | "week7" | "custom"; label: string; sub: string }[]).map(opt => (
                <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "0.65rem 0.75rem", background: waPeriodMode === opt.id ? "rgba(201,169,110,0.06)" : "transparent", border: `1px solid ${waPeriodMode === opt.id ? "rgba(201,169,110,0.22)" : "rgba(255,255,255,0.05)"}`, transition: "all 0.15s" }}>
                  <input type="radio" name="waPeriod" checked={waPeriodMode === opt.id} onChange={() => { setWaPeriodMode(opt.id); setWaPeriodError(""); }} style={{ accentColor: "#C9A96E", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "11px", color: waPeriodMode === opt.id ? "#F5F0E8" : "rgba(245,240,232,0.6)", letterSpacing: "0.04em" }}>{opt.label}</div>
                    {opt.sub && <div style={{ fontSize: "9px", color: "rgba(245,240,232,0.3)", letterSpacing: "0.1em", marginTop: "2px", textTransform: "capitalize" }}>{opt.sub}</div>}
                  </div>
                </label>
              ))}
            </div>
            {waPeriodMode === "custom" && (
              <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "7px", letterSpacing: "0.35em", color: "rgba(245,240,232,0.3)", textTransform: "uppercase", marginBottom: "0.4rem" }}>De</label>
                  <input type="date" value={waCustomStart} onChange={e => { setWaCustomStart(e.target.value); setWaPeriodError(""); }} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F0E8", fontFamily: "inherit", fontSize: "11px", padding: "0.6rem 0.75rem", outline: "none", boxSizing: "border-box" as const }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "7px", letterSpacing: "0.35em", color: "rgba(245,240,232,0.3)", textTransform: "uppercase", marginBottom: "0.4rem" }}>Até</label>
                  <input type="date" value={waCustomEnd} onChange={e => { setWaCustomEnd(e.target.value); setWaPeriodError(""); }} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F0E8", fontFamily: "inherit", fontSize: "11px", padding: "0.6rem 0.75rem", outline: "none", boxSizing: "border-box" as const }} />
                </div>
              </div>
            )}
            {waPeriodError && <p style={{ fontSize: "9px", color: "#E24B4A", letterSpacing: "0.2em", marginBottom: "0.85rem", textTransform: "uppercase" }}>{waPeriodError}</p>}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setWaPeriodModal(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(245,240,232,0.35)", fontSize: "9px", letterSpacing: "0.3em", padding: "0.6rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Cancelar</button>
              <button onClick={handleCopyAgenda} style={{ background: "#5DCAA5", border: "none", color: "#0C0B09", fontSize: "9px", letterSpacing: "0.3em", fontWeight: 700, padding: "0.6rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Copiar Agenda</button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {waModal && (
        <div onClick={e => e.target === e.currentTarget && setWaModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#131108", border: "1px solid rgba(201,169,110,0.12)", padding: "2rem", width: "500px", maxWidth: "95vw", maxHeight: "85vh", display: "flex", flexDirection: "column", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <p style={{ fontSize: "8px", letterSpacing: "0.4em", color: "rgba(201,169,110,0.6)", textTransform: "uppercase", fontWeight: 600 }}>Copiar para WhatsApp</p>
              <button onClick={() => setWaModal(false)} style={{ background: "transparent", border: "none", color: "rgba(245,240,232,0.3)", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>
            {waCopied && (
              <div style={{ marginBottom: "0.75rem", fontSize: "9px", letterSpacing: "0.25em", color: "#5DCAA5", textTransform: "uppercase" }}>✓ Copiado — pode colar no WhatsApp</div>
            )}
            <textarea
              readOnly
              value={waText}
              style={{ flex: 1, minHeight: "300px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F0E8", fontFamily: "monospace", fontSize: "11px", padding: "0.75rem", outline: "none", resize: "vertical", letterSpacing: "0.02em", lineHeight: "1.6" }}
              onClick={e => (e.target as HTMLTextAreaElement).select()}
            />
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button onClick={() => setWaModal(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(245,240,232,0.35)", fontSize: "9px", letterSpacing: "0.3em", padding: "0.6rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Fechar</button>
              <button
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(waText).then(() => setWaCopied(true));
                  } else {
                    const ta = document.createElement("textarea");
                    ta.value = waText; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); setWaCopied(true);
                  }
                }}
                style={{ background: "#5DCAA5", border: "none", color: "#0C0B09", fontSize: "9px", letterSpacing: "0.3em", fontWeight: 700, padding: "0.6rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}
              >Copiar novamente</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div onClick={e => e.target === e.currentTarget && closeModal()} style={overlayStyle}>
          <div style={{ ...modalStyle, width: "640px" }}>
            <div style={topLineStyle} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
              <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.goldDim, textTransform: "uppercase", fontWeight: 600, margin: 0 }}>
                {modal.editing ? "Editar Evento" : "Novo Evento"}
              </p>
              {!modal.editing && (
                <button
                  type="button"
                  onClick={() => setIsResidencia(r => !r)}
                  style={{
                    background: isResidencia ? "rgba(201,169,110,0.12)" : "transparent",
                    border: `1px solid ${isResidencia ? C.gold : "rgba(255,255,255,0.08)"}`,
                    color: isResidencia ? C.gold : C.textMuted,
                    fontSize: "8px", letterSpacing: "0.3em", padding: "0.4rem 0.9rem",
                    cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600,
                    display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s",
                  }}
                >
                  🔁 Residência
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1.5rem" }}>
              <FormField label="Título do Evento" style={{ gridColumn: "1 / -1" }}>
                <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nome do evento..." />
              </FormField>
              {isResidencia && !modal.editing ? (
                <FormField label="Datas das Residências" style={{ gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {residenciaDates.map((d, i) => (
                      <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <input
                          type="date"
                          value={d}
                          onChange={e => {
                            const next = [...residenciaDates];
                            next[i] = e.target.value;
                            setResidenciaDates(next);
                          }}
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        {residenciaDates.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setResidenciaDates(prev => prev.filter((_, idx) => idx !== i))}
                            style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setResidenciaDates(prev => [...prev, prev[prev.length - 1] || new Date().toISOString().split("T")[0]])}
                      style={{ ...btnSecStyle, fontSize: "8px", padding: "0.4rem 0.9rem", alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "5px" }}
                    >
                      <svg width="8" height="8" viewBox="0 0 10 10" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" /></svg>
                      Adicionar data
                    </button>
                  </div>
                </FormField>
              ) : (
                <FormField label="Data">
                  <input style={inputStyle} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </FormField>
              )}
              <FormField label="Hora">
                <input style={inputStyle} value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} placeholder="20:00-23:00" />
              </FormField>
              <FormField label="Local">
                <input style={inputStyle} value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder="SUD, Hyatt, Epic Sana..." />
              </FormField>
              <FormField label="Contacto">
                <input style={inputStyle} value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} placeholder="Nome ou telefone..." />
              </FormField>
              <FormField label="Equipa / Tipo">
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {EQUIPA_NOMES.map(n => {
                    const active = parseEquipa(form.tipo).includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          const current = parseEquipa(form.tipo);
                          const next = active ? current.filter(x => x !== n) : [...current, n];
                          setForm(f => ({ ...f, tipo: next.join(" / ") }));
                        }}
                        style={{
                          background: active ? `${EQUIPA_COLOR[n]}18` : "rgba(255,255,255,0.03)",
                          border: `1px solid ${active ? EQUIPA_COLOR[n] : "rgba(255,255,255,0.08)"}`,
                          color: active ? EQUIPA_COLOR[n] : "rgba(245,240,232,0.35)",
                          fontSize: "10px", letterSpacing: "0.15em", padding: "0.5rem 1rem",
                          cursor: "pointer", fontFamily: "inherit", fontWeight: active ? 700 : 400,
                          display: "flex", alignItems: "center", gap: "6px", transition: "all 0.15s",
                        }}
                      >
                        <span style={{ fontSize: "14px" }}>{EQUIPA_SYMBOL[n]}</span>
                        {n}
                      </button>
                    );
                  })}
                </div>
              </FormField>
              <FormField label="Cliente" style={{ gridColumn: "1 / -1", position: "relative" }}>
                {clienteCreating ? (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      value={form.cliente_nome}
                      onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))}
                      placeholder="Nome do novo cliente..."
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!form.cliente_nome.trim()) return;
                        const r = await createCliente({ nome: form.cliente_nome.trim() });
                        if (r.success) {
                          const cr = await getAllClientes();
                          if (cr.success) setClientes(cr.data as Cliente[]);
                          setClienteSearch(form.cliente_nome.trim());
                          showToast("Cliente criado");
                        }
                        setClienteCreating(false);
                      }}
                      style={{ ...btnPrimStyle, whiteSpace: "nowrap", padding: "0.6rem 1rem" }}
                    >Guardar</button>
                    <button
                      type="button"
                      onClick={() => setClienteCreating(false)}
                      style={{ ...btnSecStyle, padding: "0.6rem 0.75rem" }}
                    >✕</button>
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    <input
                      style={inputStyle}
                      value={clienteSearch}
                      onChange={e => {
                        setClienteSearch(e.target.value);
                        setForm(f => ({ ...f, cliente_nome: e.target.value }));
                        setClienteDropOpen(true);
                      }}
                      onFocus={() => setClienteDropOpen(true)}
                      onBlur={() => setTimeout(() => setClienteDropOpen(false), 150)}
                      placeholder="Pesquisar cliente..."
                    />
                    {clienteDropOpen && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#1a1710", border: "1px solid rgba(201,169,110,0.18)", zIndex: 500, maxHeight: "200px", overflowY: "auto" }}>
                        {clientes
                          .filter((c, idx, arr) => arr.findIndex(x => x.nome === c.nome) === idx)
                          .filter(c => c.nome.toLowerCase().includes(clienteSearch.toLowerCase()))
                          .map(c => (
                            <div
                              key={c.id}
                              onMouseDown={() => {
                                setForm(f => ({ ...f, cliente_nome: c.nome }));
                                setClienteSearch((c as any).alias?.trim() || c.nome);
                                setClienteDropOpen(false);
                              }}
                              style={{ padding: "0.6rem 1rem", fontSize: "11px", color: C.textSec, cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,169,110,0.08)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >
                              {(c as any).alias?.trim() || c.nome}
                              {(c as any).alias?.trim() && <span style={{ fontSize: "9px", color: C.textMuted, marginLeft: "8px" }}>{c.nome}</span>}
                              {c.nif && !((c as any).alias?.trim()) && <span style={{ fontSize: "9px", color: C.textMuted, marginLeft: "8px" }}>{c.nif}</span>}
                            </div>
                          ))
                        }
                        <div
                          onMouseDown={() => { setClienteCreating(true); setClienteDropOpen(false); }}
                          style={{ padding: "0.6rem 1rem", fontSize: "10px", color: C.gold, cursor: "pointer", letterSpacing: "0.15em", borderTop: "1px solid rgba(201,169,110,0.12)", display: "flex", alignItems: "center", gap: "6px" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,169,110,0.06)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <span>+</span> Criar novo cliente
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </FormField>
              {userRole !== "limited_novalues" && (
              <FormField label="Faturação (€)">
                <input
                  style={inputStyle}
                  type="text"
                  inputMode="decimal"
                  value={form.bill}
                  onChange={e => setForm(f => ({ ...f, bill: e.target.value }))}
                  onFocus={e => { if (e.target.value === "0") setForm(f => ({ ...f, bill: "" })); }}
                  onBlur={e => { if (e.target.value === "") setForm(f => ({ ...f, bill: "0" })); }}
                />
              </FormField>
              )}
              <FormField label="Modalidade">
                <CustomSelect
                  value={form.modalidade}
                  onChange={v => setForm(f => ({ ...f, modalidade: v }))}
                  options={MODALIDADES.map(m => ({ value: m, label: m }))}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Estado" style={{ gridColumn: "1 / -1" }}>
                <CustomSelect
                  value={form.billing_status}
                  onChange={v => setForm(f => ({ ...f, billing_status: v }))}
                  options={BILLING_ESTADOS.map(s => ({ value: s, label: s }))}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Notas" style={{ gridColumn: "1 / -1" }}>
                <textarea style={{ ...inputStyle, minHeight: "72px", resize: "vertical" }} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Observações..." />
              </FormField>
            </div>

            {/* ── Artistas ── */}
            <div style={{ marginTop: "1.75rem", borderTop: `1px solid ${C.borderDim}`, paddingTop: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <span style={{ fontSize: "7px", letterSpacing: "0.4em", color: C.textMuted, textTransform: "uppercase", fontWeight: 600 }}>Artistas & Pagamentos</span>
                {totalArtistas > 0 && (
                  <span style={{ fontSize: "9px", color: C.amber, letterSpacing: "0.15em", fontWeight: 600 }}>
                    Total: {userRole === "limited_novalues" ? "—" : `${totalArtistas.toLocaleString("pt-PT")}€`}
                  </span>
                )}
              </div>

              {loadingArtists ? (
                <p style={{ fontSize: "10px", color: C.textMuted, textAlign: "center", padding: "1rem" }}>A carregar...</p>
              ) : (
                <>
                  {/* Table header */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 90px 32px", gap: "4px", marginBottom: "6px" }}>
                    {["Nome", "Tipo", "Fee (€)", ""].map(h => (
                      <span key={h} style={{ fontSize: "7px", letterSpacing: "0.3em", color: C.textMuted, textTransform: "uppercase", fontWeight: 600, padding: "0 4px" }}>{h}</span>
                    ))}
                  </div>
                  {artists.map((a, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 130px 90px 32px", gap: "4px", marginBottom: "4px", alignItems: "center" }}>
                      <input
                        value={a.nome}
                        onChange={e => updateArtist(i, "nome", e.target.value)}
                        placeholder="Nome do artista..."
                        style={{ ...inputStyle, padding: "0.5rem 0.75rem", fontSize: "11px" }}
                      />
                      <CustomSelect
                        value={a.tipo}
                        onChange={v => updateArtist(i, "tipo", v)}
                        options={ARTIST_TIPOS.map(t => ({ value: t, label: t }))}
                        style={{ ...inputStyle, padding: "0.5rem 0.5rem", fontSize: "10px" }}
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={a.fee}
                        onChange={e => updateArtist(i, "fee", e.target.value)}
                        onFocus={e => { if (e.target.value === "0") updateArtist(i, "fee", ""); }}
                        onBlur={e => { if (e.target.value === "") updateArtist(i, "fee", "0"); }}
                        placeholder="0"
                        style={{ ...inputStyle, padding: "0.5rem 0.75rem", fontSize: "11px" }}
                      />
                      <button
                        onClick={() => removeArtistRow(i)}
                        style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}
                        title="Remover"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
                      </button>
                    </div>
                  ))}
                  <button onClick={addArtistRow} style={{ ...btnSecStyle, fontSize: "8px", padding: "0.4rem 0.9rem", marginTop: "6px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <svg width="8" height="8" viewBox="0 0 10 10" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" /></svg>
                    Adicionar artista
                  </button>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", justifyContent: "flex-end" }}>
              {modal.editing && (
                <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                  <span style={{ fontSize: "8px", letterSpacing: "0.15em", color: "rgba(201,169,110,0.4)", fontFamily: "monospace" }}>
                    event_id: {(modal.editing as any).event_id || <span style={{ color: "rgba(255,80,80,0.6)" }}>vazio ⚠</span>}
                    {(modal.editing as any).origem_lead_id && <span style={{ marginLeft: "1rem" }}>lead_id: {(modal.editing as any).origem_lead_id}</span>}
                  </span>
                </div>
              )}
              <button onClick={closeModal} style={btnSecStyle}>Fechar</button>
              {modal.editing && !modal.editing.cancelled && (
                <button onClick={handleCancelFromModal} style={btnDangerStyle}>Cancelar Evento</button>
              )}
              <button onClick={handleSave} disabled={saving} style={btnPrimStyle}>{saving ? "A guardar..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: "#1a1408", border: `1px solid ${C.border}`, color: C.gold, fontSize: "10px", letterSpacing: "0.25em", padding: "1rem 1.5rem", zIndex: 2000, transform: toast ? "translateX(0)" : "translateX(200%)", transition: "transform 0.3s ease", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "1rem" }}>
        <span>{toast}</span>
        {undoAction && (
          <button onClick={undoAction.fn} style={{ background: "rgba(201,169,110,0.15)", border: "1px solid rgba(201,169,110,0.3)", color: C.gold, fontSize: "9px", letterSpacing: "0.3em", padding: "0.3rem 0.75rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
            {undoAction.label}
          </button>
        )}
      </div>
    </>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

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
  ];
  const restrictedHrefs = ["/dashboard", "/faturacao", "/pagamentos", "/colaboradores", "/clientes"];
  const links = role === "admin" ? allLinks : allLinks.filter(l => !restrictedHrefs.includes(l.href));
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

function Loading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0C0B09" }}>
      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "3rem", letterSpacing: "0.4em", color: "#C9A96E", fontWeight: 300 }}>LLE</span>
    </div>
  );
}

function StatusBadge({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "9px", letterSpacing: "0.2em", padding: "3px 8px", fontWeight: 600, textTransform: "uppercase", background: `${color}18`, color }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

function IconBtn({ title, onClick, icon, danger, success }: { title: string; onClick: () => void; icon: string; danger?: boolean; success?: boolean }) {
  const icons: Record<string, React.ReactNode> = {
    edit: <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="2"><path d="M11 2l3 3-9 9H2v-3l9-9z" /></svg>,
    cancel: <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="2"><circle cx="8" cy="8" r="6" /><path d="M5 5l6 6M11 5l-6 6" /></svg>,
    restore: <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-9" /></svg>,
    delete: <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="2"><polyline points="3 6 4 14 12 14 13 6" /><path d="M2 6h12M10 6V4H6v2" /></svg>,
  };
  const color = danger ? "#E24B4A" : success ? "#5DCAA5" : "rgba(245,240,232,0.35)";
  return (
    <button title={title} onClick={onClick} style={{ background: "transparent", border: "none", cursor: "pointer", padding: "5px", color, transition: "color 0.15s" }}>
      {icons[icon]}
    </button>
  );
}

function FormField({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: "1.25rem", ...style }}>
      <label style={{ display: "block", fontSize: "7px", letterSpacing: "0.4em", color: "rgba(245,240,232,0.22)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.6rem" }}>{label}</label>
      {children}
    </div>
  );
}

const addBtnStyle: React.CSSProperties = { background: "transparent", border: "1px solid rgba(201,169,110,0.12)", color: "#8a7350", fontSize: "8px", letterSpacing: "0.35em", padding: "0.5rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s" };
const tdStyle = ({ muted, nowrap, maxW }: { muted?: boolean; nowrap?: boolean; maxW?: string }): React.CSSProperties => ({ fontSize: "12px", color: muted ? "rgba(245,240,232,0.45)" : "#F5F0E8", padding: "0.85rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.05)", whiteSpace: nowrap ? "nowrap" : undefined, maxWidth: maxW, overflow: maxW ? "hidden" : undefined, textOverflow: maxW ? "ellipsis" : undefined });
const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" };
const modalStyle: React.CSSProperties = { background: "#131108", border: "1px solid rgba(201,169,110,0.12)", padding: "clamp(1.25rem, 4vw, 2.5rem)", width: "640px", maxWidth: "96vw", maxHeight: "92dvh", overflowY: "auto", position: "relative" };
const topLineStyle: React.CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" };
const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F0E8", fontFamily: "'Montserrat','Helvetica Neue',sans-serif", fontSize: "11px", padding: "0.75rem 1rem", letterSpacing: "0.05em", outline: "none", boxSizing: "border-box" };
const btnPrimStyle: React.CSSProperties = { background: "#C9A96E", border: "none", color: "#0C0B09", fontSize: "9px", letterSpacing: "0.4em", fontWeight: 700, padding: "0.75rem 1.75rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };
const btnSecStyle: React.CSSProperties = { background: "transparent", border: "1px solid rgba(201,169,110,0.12)", color: "rgba(245,240,232,0.35)", fontSize: "9px", letterSpacing: "0.4em", fontWeight: 600, padding: "0.75rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };
const btnDangerStyle: React.CSSProperties = { background: "transparent", border: "1px solid rgba(226,75,74,0.3)", color: "#E24B4A", fontSize: "8px", letterSpacing: "0.3em", fontWeight: 600, padding: "0.75rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };

// ── Mobile Tab Bar — 4 fixos + "Mais" drawer ───────────────────────────────
function MobTabBar({ active, role }: { active: string; role: string }) {
  const [maisOpen, setMaisOpen] = useState(false);

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
  ] : [];

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
        background: "#131108", borderTop: "1px solid rgba(201,169,110,0.15)",
        borderRadius: "16px 16px 0 0", padding: "0.75rem 0.5rem",
        paddingBottom: "0.5rem",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
      }}>
        {/* Handle */}
        <div style={{ width: "36px", height: "3px", background: "rgba(201,169,110,0.25)", borderRadius: "2px", margin: "0 auto 0.75rem" }} />
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

      {/* Tab bar principal */}
      <nav className="mob-tabbar">
        {mainTabs.map(l => (
          <a key={l.href} href={l.href} className={`mob-tab${active === l.id ? " active" : ""}`}>
            <span className="mob-tab-icon">{l.icon}</span>
            <span className="mob-tab-label">{l.label}</span>
          </a>
        ))}
        {/* Botão "Mais" — só para admin */}
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
