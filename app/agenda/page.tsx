"use client";

import { ARTIST_TIPOS, MODALIDADES, SERVICOS_VENDIDOS, TIPOS_COMERCIAIS, VALOR_CONTEXTOS, resolveColaboradorNome } from "../constants";
import { ArtistAutocomplete, type ArtistOption } from "../ArtistAutocomplete";
import { useEffect, useState, useCallback, useRef } from "react";
import React from "react";
import { useRouter } from "next/navigation";
import { ThemeSwitcher } from "../ThemeSwitcher";

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
          background: "var(--theme-surface-elevated)", border: "1px solid rgba(201,169,110,0.2)",
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
                borderBottom: "1px solid var(--theme-border)",
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
  getAllClientes, createCliente, getAllLeads, getAllColaboradores, getAllValoresFuncoes, getAllValoresMaster, getAllResidenciasAtivas, syncAllExistingData,
  setupMateriais, getAllMateriais, getMovimentosMateriais, registarSaidaMaterial,
  registarVoltaMaterial, deleteMovimentoMaterial,
  getAllMaterialPacks, reservarMaterialPacksParaEvento, getMaterialPackReservasEvento, getMateriaisReservadosResumoEvento,
  getArtistConflictOverrides, dismissArtistConflict, getAgendaPageBundle, getAgendaFormLookups, getMaterialPackIdsForServico,
} from "../actions";

interface AgendaEvent {
  id: number; title: string; event_date: string; time_range?: string;
  tipo?: string; bill?: number; status?: string; cancelled?: number;
  billing_status?: string; cliente_nome?: string; modalidade?: string;
  origem_lead_id?: number | null; venue?: string;
  contacto?: string; notas?: string; residencia_id?: number | null; event_id?: string;
  tipo_comercial?: string; servico_comercial?: string; valor_contexto?: string;
}

interface Lead {
  id: number; title: string; event_date: string; value: number;
  status?: string; cancelled?: number; cliente_nome?: string; modalidade?: string; cliente_id?: number | null;
  agenda_event_id?: number | null; event_id?: string;
  tipo_comercial?: string; servico_comercial?: string; valor_contexto?: string;
}

const CONFIRMED_STATUSES = ["Confirmado", "Em Adjudicação", "Adjudicado", "Pago"];

interface ArtistRow {
  id?: number; colaborador_id?: number | null; nome: string; tipo: string; fee: string;
}

interface ConflictOverride { event_date: string; artist_key: string; artist_name: string; note?: string; }

interface Cliente {
  id: number; nome: string; nif?: string; alias?: string;
}

interface Colaborador {
  id: number; nome: string; nome_artistico?: string; nome_pessoal?: string; contacto?: string; email?: string; iban?: string;
  skills?: string; notas?: string; ativo: number;
}

interface ValorFuncao {
  id: number; funcao: string; custo_padrao: number; valor_cliente_padrao: number; notas?: string; ativo: number;
}

interface ValorMaster {
  id: number; servico: string; duracao_formato: string; contexto: string; cliente_nome?: string;
  custo_interno: number; valor_parceiro: number; valor_cliente_final: number; notas?: string; ativo: number;
}

interface ResidenciaAtiva {
  id: number; nome: string; cliente_id?: number | null; cliente_nome: string; local: string; servico: string; duracao_formato: string;
  custo_interno: number; valor_cliente: number; performer_padrao_id?: number | null; performer_padrao_nome?: string; notas?: string; ativo: number;
}

interface MaterialItem {
  id: number; nome: string; categoria: string; imagem: string;
  quantidade_total: number; notas: string; ativo: number;
}

interface MaterialMovimento {
  id: number; material_id: number; material_nome: string; material_imagem: string;
  quantidade: number; quantidade_devolvida: number; quantidade_consumida?: number;
  origem: string; origem_detalhe: string; evento: string; evento_id: number | null;
  responsavel: string; notas: string; data_saida: string; data_volta: string | null;
}

interface MaterialPackItem { id: number; pack_id: number; material_nome: string; categoria: string; quantidade: number; notas?: string; }
interface MaterialPack {
  id: number; nome: string; descricao: string; valor_referencia: number; ativo: number;
  items: MaterialPackItem[];
  links?: { id: number; servico: string; duracao_formato: string; contexto: string; notas?: string }[];
}
interface MaterialPackReserva { id: number; evento_id: number; pack_id: number; pack_nome: string; valor_referencia: number; valor_cobrado: number; desconto_oferta: number; }
interface MaterialReservadoResumo { material_nome: string; quantidade: number; quantidade_devolvida: number; quantidade_consumida: number; estado_regresso: string; data_volta: string; notas: string; }

const MATERIAL_ORIGENS = ["Loja", "João", "Annia", "Outro"];

const BILLING_ESTADOS = ["Contacto", "Proposta Enviada", "Em Negociação", "Confirmado", "Em Adjudicação", "Adjudicado", "Faturado", "Pago", "Cancelado"];

// Mapeamento tipo artista → emoji
const TIPO_ICON: Record<string, string> = {
  "DJ": "🎧", "Karaoke Host": "🎤", "Técnico de Som": "🔊", "Técnico AV": "🎚️", "Técnico de Luz": "💡",
  "Saxofonista": "🎷", "Sax": "🎷", "Violinista": "🎻", "Violino": "🎻", "Acordionista": "🪗", "Acordeão": "🪗",
  "Cantor(a)": "🎤", "Singer": "🎤", "Cantor(a) Fado": "🎙️", "Guitarra Portuguesa": "🪕", "Viola/Guitarra Fado": "🎸",
  "Guitarrista": "🎸", "Guitar": "🎸", "Baixista": "🎸", "Bass": "🎸", "Baterista": "🥁", "Drums": "🥁",
  "Percussionista": "🥁", "Percussão": "🥁", "Trompetista": "🎺", "Trompete": "🎺",
  "Bailarino(a)": "💃", "Dancer": "💃", "Bailarino(a) Asas Isis": "🪽",
  "Artista de Fogo": "🔥", "Fire": "🔥", "Malabarista": "🤹", "Performer Bolas de Sabão": "🫧",
  "Mágico(a)": "🪄", "Mágico": "🪄", "Performer Cubo": "⬛",
  "Acrobata": "🤸", "Acrobata Aéreo(a)": "🎪", "Performer Lyra": "⭕", "Performer Straps": "🎪", "Performer Plataforma": "💎",
  "Técnico de Rigging": "🧰", "Animador / Host": "🎙️", "Host": "🎙️", "MC": "🎤", "Ator(a)": "🎭", "Actor": "🎭",
  "Animador Infantil": "🎈", "Make-up & Hair": "💄", "Guarda-Roupa": "🥻", "Produtor": "🧑🏽‍💻",
  "Assistente de Produção": "📋", "Coreógrafo(a)": "🩰", "Coreógrafa": "🩰", "Fotógrafo/Videógrafo": "📷",
  "Animador": "🎪", "Comediante": "😂", "Ginasta": "🤸",
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

// Color constants - will be adapted for light theme by JS
const C = {
  gold: "#C9A96E", goldDim: "#8a7350", surface: "#111009", pageBg: "#0C0B09",
  border: "rgba(201,169,110,0.12)", borderDim: "rgba(255,255,255,0.05)",
  textPrimary: "#F5F0E8", textSec: "rgba(245,240,232,0.45)", textMuted: "rgba(245,240,232,0.22)",
  green: "#5DCAA5", amber: "#EF9F27", blue: "#85B7EB", red: "#E24B4A",
};

// Light theme colors - 100% contrast, document-style
const C_Light = {
  gold: "#8B4513", goldDim: "#6F3A18", surface: "#FFFFFF", pageBg: "#FFFBF7",
  border: "rgba(0,0,0,0.15)", borderDim: "rgba(0,0,0,0.12)",
  textPrimary: "#111827", textSec: "rgba(17,24,39,0.82)", textMuted: "rgba(17,24,39,0.62)",
  green: "#2E7D32", amber: "#A65300", blue: "#1565C0", red: "#C62828",
};

// Helper to get colors based on theme
const getColors = (lightTheme: boolean) => lightTheme ? C_Light : C;

function toIsoDate(s: string) {
  if (!s) return "";
  const v = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return v;
}
function monthKey(s: string) {
  const iso = toIsoDate(s);
  return /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : "";
}
function fmtDate(s: string) {
  if (!s) return "—";
  const iso = toIsoDate(s);
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return s;
  const weekday = d.toLocaleDateString("pt-PT", { weekday: "short" });
  const date = d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
  return `${date} · ${weekday.charAt(0).toUpperCase() + weekday.slice(1)}`;
}

function artistsSummary(artists: ArtistRow[]) {
  if (!artists.length) return "—";
  return artists.filter(a => a.nome.trim()).map(a => a.nome).join(" · ");
}

const emptyForm = { title: "", date: "", time: "", tipo: "", bill: "0", billing_status: "Contacto", cliente_nome: "", modalidade: "Fatura", tipo_comercial: "Evento", servico_comercial: "", valor_contexto: "Cliente Final", venue: "", contacto: "", notas: "", residencia_id: null as number | null };
const emptyArtist = (): ArtistRow => ({ colaborador_id: null, nome: "", tipo: "DJ", fee: "" });

function normalizeText(v: string) {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function tipoFromSkills(skills?: string) {
  const first = (skills || "").split(",").map(s => s.trim()).filter(Boolean)[0] || "";
  const map: Record<string, string> = {
    "Cantor/a": "Cantor(a)", "Cantor(a)": "Cantor(a)", "DJ": "DJ", "Saxofonista": "Saxofonista", "Violinista": "Violinista",
    "Pianista": "Pianista", "Guitarrista": "Guitarrista", "Baterista": "Baterista", "Percussionista": "Percussionista",
    "Bailarino/a": "Bailarino(a)", "Ator/Host": "Animador / Host", "Animador/a": "Animador / Host",
    "Produtor/Coordenador": "Produtor", "Makeup & Hair": "Make-up & Hair", "Assistente de Guarda-Roupa": "Guarda-Roupa",
    "Coreógrafo/a": "Coreógrafo(a)",
  };
  const mapped = map[first] || first || "DJ";
  return (ARTIST_TIPOS as readonly string[]).includes(mapped) ? mapped : "DJ";
}

export default function AgendaPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [artistasMap, setArtistasMap] = useState<Record<number, ArtistRow[]>>({});
  const [conflictOverrides, setConflictOverrides] = useState<ConflictOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterArtista, setFilterArtista] = useState("");
  const [filterCliente, setFilterCliente] = useState("");
  const [filterEquipa, setFilterEquipa] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);
  const [lookupsLoading, setLookupsLoading] = useState(false);
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
  const [lightTheme, setLightTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lle_light_theme') === 'true';
    }
    return false;
  });
  const [confirmedLeads, setConfirmedLeads] = useState<Lead[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [valoresFuncoes, setValoresFuncoes] = useState<ValorFuncao[]>([]);
  const [valoresMaster, setValoresMaster] = useState<ValorMaster[]>([]);
  const [residenciasAtivas, setResidenciasAtivas] = useState<ResidenciaAtiva[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteDropOpen, setClienteDropOpen] = useState(false);
  const [clienteCreating, setClienteCreating] = useState(false);
  const [isResidencia, setIsResidencia] = useState(false);
  const [residenciaDates, setResidenciaDates] = useState<string[]>([]);
  const [trocaNovaData, setTrocaNovaData] = useState("");
  const [materiais, setMateriais] = useState<MaterialItem[]>([]);
  const [movimentosMateriais, setMovimentosMateriais] = useState<MaterialMovimento[]>([]);
  const [materialPacks, setMaterialPacks] = useState<MaterialPack[]>([]);
  const [materiaisLoaded, setMateriaisLoaded] = useState(false);
  const [selectedPackIds, setSelectedPackIds] = useState<number[]>([]);
  const [materiaisReservadosResumo, setMateriaisReservadosResumo] = useState<MaterialReservadoResumo[]>([]);
  const [loadingMateriaisResumo, setLoadingMateriaisResumo] = useState(false);
  const [materialModal, setMaterialModal] = useState<{ open: boolean; event: AgendaEvent | null }>({ open: false, event: null });
  const emptyReservaForm = { material_id: 0, quantidade: 1, origem: "Loja", origem_detalhe: "", notas: "" };
  const [reservaForm, setReservaForm] = useState(emptyReservaForm);
  const [reservaSaving, setReservaSaving] = useState(false);

  const showToast = (msg: string, undo?: { label: string; fn: () => void }, durationMs: number = 4000) => {
    if (toastTimer) clearTimeout(toastTimer);
    setToast(msg);
    setUndoAction(undo || null);
    const t = setTimeout(() => { setToast(""); setUndoAction(null); }, durationMs);
    setToastTimer(t);
  };

  const loadLookups = useCallback(async () => {
    if (lookupsLoaded || lookupsLoading) return;
    setLookupsLoading(true);
    const r = await getAgendaFormLookups();
    if (r.success) {
      if (r.clientes?.success) setClientes(r.clientes.data as Cliente[]);
      if (r.colaboradores?.success) setColaboradores(r.colaboradores.data as Colaborador[]);
      if (r.valoresFuncoes?.success) setValoresFuncoes(r.valoresFuncoes.data as ValorFuncao[]);
      if (r.valoresMaster?.success) setValoresMaster(r.valoresMaster.data as ValorMaster[]);
      if (r.residencias?.success) setResidenciasAtivas((r.residencias.data as ResidenciaAtiva[]).filter(r => r.ativo === 1));
      setLookupsLoaded(true);
    }
    setLookupsLoading(false);
  }, [lookupsLoaded, lookupsLoading]);

  const load = useCallback(async (nameOverride?: string, monthOverride?: string) => {
    setLoading(true);
    const targetMonth = monthOverride || selectedMonth;
    const bundle = await getAgendaPageBundle(nameOverride || userName || 'Admin', targetMonth);
    if (!bundle.success) { setLoading(false); return; }
    const r = bundle.agenda;
    const ar = bundle.artistas;
    const lr = bundle.leads;
    const cor = bundle.conflicts;
    const mr = bundle.months;
    if (mr?.success) {
      const months = (mr.data as string[]).filter(Boolean);
      setAvailableMonths(months.includes(targetMonth) ? months : [...months, targetMonth].sort());
    }
    if (r?.success) setEvents(r.data as AgendaEvent[]);
    if (ar?.success) setArtistasMap(Object.fromEntries(Object.entries(ar.data as Record<number, any[]>).map(([k, v]) => [k, v.map((a: any) => ({ ...a, colaborador_id: a.colaborador_id ?? null, fee: String(a.fee ?? "") }))])));
    if (cor?.success) setConflictOverrides(cor.data as ConflictOverride[]);
    if (lr?.success) {
      const stripEmoji = (s: string) => s.replace(/[\p{Emoji}‍️]+/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
      const agendaEvents = r?.success ? (r.data as AgendaEvent[]) : [];
      const confirmed = (lr.data as Lead[]).filter(l => {
        if (!CONFIRMED_STATUSES.includes(l.status || "") || !l.event_date) return false;
        const leadTitle = stripEmoji(l.title);
        const leadValue = l.value || 0;
        const hasLinkedEvent = agendaEvents.some(e => e.origem_lead_id === l.id);
        if (hasLinkedEvent) return false;
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
  }, [userName, selectedMonth]);

  const loadMateriais = useCallback(async (force = false) => {
    if (materiaisLoaded && !force) return;
    await setupMateriais();
    const [mr, movr, pr] = await Promise.all([getAllMateriais(), getMovimentosMateriais(), getAllMaterialPacks()]);
    if (mr.success) setMateriais(mr.data as MaterialItem[]);
    if (movr.success) setMovimentosMateriais(movr.data as MaterialMovimento[]);
    if (pr.success) setMaterialPacks(pr.data as MaterialPack[]);
    setMateriaisLoaded(true);
  }, [materiaisLoaded]);

  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const u = localStorage.getItem("lle_user");
    if (!u) { router.push("/"); return; }
    const parsed = JSON.parse(u);
    setUserName(parsed.name);
    setUserRole(parsed.role || "admin");
    load(parsed.name, selectedMonth);
    setTimeout(() => setMounted(true), 100);
  }, [load, router, selectedMonth]);

  // Apply light theme to html element
  useEffect(() => {
    const html = document.documentElement;
    if (lightTheme) {
      html.classList.add('light-theme');
    } else {
      html.classList.remove('light-theme');
    }
    localStorage.setItem('lle_light_theme', lightTheme ? 'true' : 'false');
  }, [lightTheme]);

  const materiaisAtivos = materiais.filter(m => m.ativo === 1);

  const openMaterialModal = (e: AgendaEvent) => {
    setReservaForm(emptyReservaForm);
    setMaterialModal({ open: true, event: e });
    loadMateriais();
  };
  const closeMaterialModal = () => setMaterialModal({ open: false, event: null });

  const materiaisDoEvento = (eventoId: number) => movimentosMateriais.filter(m => m.evento_id === eventoId);
  const materiaisPendentesDoEvento = (eventoId: number) => materiaisDoEvento(eventoId).filter(m => (m.quantidade_devolvida + (m.quantidade_consumida || 0)) < m.quantidade);
  const selectedPacks = materialPacks.filter(p => selectedPackIds.includes(p.id));
  const togglePackSelecionado = (packId: number) => setSelectedPackIds(prev => prev.includes(packId) ? prev.filter(id => id !== packId) : [...prev, packId]);

  const handleReservarMaterial = async () => {
    if (!materialModal.event) return;
    const mat = materiais.find(m => m.id === reservaForm.material_id);
    if (!mat) { showToast("Escolhe um material"); return; }
    if (reservaForm.quantidade < 1) { showToast("Quantidade inválida"); return; }
    if (reservaForm.origem === "Outro" && !reservaForm.origem_detalhe.trim()) { showToast("Especifica para onde vai"); return; }
    setReservaSaving(true);
    const res = await registarSaidaMaterial({
      material_id: mat.id, material_nome: mat.nome, material_imagem: mat.imagem,
      quantidade: reservaForm.quantidade, origem: reservaForm.origem, origem_detalhe: reservaForm.origem_detalhe,
      evento: materialModal.event.title, evento_id: materialModal.event.id,
      responsavel: userName, notas: reservaForm.notas,
    });
    setReservaForm(emptyReservaForm);
    await loadMateriais(true);
    setReservaSaving(false);
    showToast(`Material reservado: ${mat.nome}`);
  };

  const handleRemoverReservaMaterial = async (id: number) => {
    await deleteMovimentoMaterial(id);
    await loadMateriais(true);
  };

  const handleMaterialVoltou = async (mov: MaterialMovimento) => {
    await registarVoltaMaterial(mov.id, mov.quantidade, mov.quantidade);
    await loadMateriais(true);
  };

  const colaboradoresAtivos = colaboradores.filter(c => c.ativo === 1);
  const colaboradorDisplayName = (c: Colaborador) => c.nome_artistico || c.nome;
  const findColaboradorByNome = (nome: string) => colaboradoresAtivos.find(c => {
    const q = normalizeText(nome);
    return [c.nome, c.nome_artistico || "", c.nome_pessoal || ""].some(v => normalizeText(v) === q);
  });
  const findColaboradorById = (id?: number | null) => id ? colaboradores.find(c => c.id === id) : undefined;
  const isEmptyFee = (fee: string) => fee.trim() === "" || Number(fee.replace(",", ".")) === 0;
  const suggestedFeeForTipo = (tipo: string) => {
    const row = valoresFuncoes.find(v => v.ativo === 1 && normalizeText(v.funcao) === normalizeText(tipo));
    return row?.custo_padrao || 0;
  };
  const suggestedFeeString = (tipo: string) => {
    const value = suggestedFeeForTipo(tipo);
    return value ? String(value) : "";
  };

  const inferValorContexto = (clienteNome: string, tipoComercial: string) => {
    if (tipoComercial === "Residência") return "Residência";
    if (tipoComercial === "Evento de Residência") return "Evento Residência";
    const q = normalizeText(clienteNome || "");
    if (q.includes("sud") || q.includes("du tage")) return "SUD";
    if (q.includes("sana") || q.includes("epic") || q.includes("azimar")) return "SANA";
    if (q.includes("hyatt") || q.includes("icon") || q.includes("odyssey")) return "Hyatt";
    return "Cliente Final";
  };

  const valorMasterSuggestion = (servico?: string, contexto?: string) => {
    const svc = normalizeText(servico || "");
    if (!svc) return null;
    const ctx = contexto || "Cliente Final";
    const rows = valoresMaster.filter(v => v.ativo === 1 && normalizeText(v.servico) === svc);
    if (rows.length === 0) return null;
    const byContext = (wanted: string) => rows.find(v => normalizeText(v.contexto) === normalizeText(wanted) || normalizeText(v.cliente_nome || "") === normalizeText(wanted));
    let row: ValorMaster | undefined;
    if (["SUD", "SANA", "Hyatt", "Conta Especial"].includes(ctx)) row = byContext(ctx);
    if (!row && (ctx === "Residência" || ctx === "Evento Residência")) row = byContext("Residência");
    if (!row && ctx === "Parceiro") row = byContext("Parceiro") || byContext("Normal") || byContext("Priceless Band") || rows[0];
    if (!row) row = byContext("Normal") || byContext("Cliente Final") || byContext("Priceless Band") || rows[0];
    const valor = (ctx === "Parceiro" || ctx === "Residência") ? Number(row.valor_parceiro || 0) : Number(row.valor_cliente_final || 0);
    return { row, valor, custo: Number(row.custo_interno || 0) };
  };

  const aplicarValorSugerido = () => {
    const suggestion = valorMasterSuggestion(form.servico_comercial || form.title, form.valor_contexto);
    if (!suggestion || !suggestion.valor) { showToast("Sem valor sugerido para esta combinação"); return; }
    setForm(f => ({ ...f, bill: String(suggestion.valor) }));
    showToast(`Valor sugerido aplicado: ${suggestion.valor}€`);
  };
  const normalizeArtistRow = (a: any): ArtistRow => {
    const col = findColaboradorById(a.colaborador_id) || findColaboradorByNome(a.nome || "");
    return {
      id: a.id,
      colaborador_id: col?.id ?? a.colaborador_id ?? null,
      nome: col ? colaboradorDisplayName(col) : (a.nome || ""),
      tipo: a.tipo || (col ? tipoFromSkills(col.skills) : "DJ"),
      fee: String(a.fee ?? ""),
    };
  };

  // Escrever/apagar no campo nunca deve selecionar automaticamente um colaborador.
  // A associação só acontece quando a pessoa clica numa sugestão.
  const updateArtistNome = (i: number, nome: string) => {
    setArtists(prev => prev.map((a, idx) => idx === i ? {
      ...a,
      colaborador_id: null,
      nome,
    } : a));
  };

  const selectArtistSuggestion = (i: number, suggestion: ArtistOption) => {
    const col = suggestion.colaborador_id
      ? findColaboradorById(suggestion.colaborador_id)
      : findColaboradorByNome(suggestion.nome);
    setArtists(prev => prev.map((a, idx) => {
      if (idx !== i) return a;
      const nextTipo = suggestion.tipo || (col ? tipoFromSkills(col.skills) : a.tipo);
      return {
        ...a,
        colaborador_id: col?.id ?? suggestion.colaborador_id ?? null,
        nome: col ? colaboradorDisplayName(col) : suggestion.nome,
        tipo: nextTipo,
        fee: isEmptyFee(a.fee) && nextTipo ? suggestedFeeString(nextTipo) : a.fee,
      };
    }));
  };

  const updateArtistTipo = (i: number, tipo: string) => {
    setArtists(prev => prev.map((a, idx) => idx === i ? {
      ...a,
      tipo,
      fee: isEmptyFee(a.fee) ? suggestedFeeString(tipo) : a.fee,
    } : a));
  };

  const applyResidenciaAtiva = (id: number | null) => {
    const r = id ? residenciasAtivas.find(x => x.id === id) : undefined;
    setForm(f => ({
      ...f,
      residencia_id: id,
      tipo_comercial: r ? "Residência" : f.tipo_comercial,
      servico_comercial: r?.servico || f.servico_comercial,
      valor_contexto: r ? "Residência" : f.valor_contexto,
      title: r?.nome || f.title,
      venue: r?.local || f.venue,
      time: r?.duracao_formato || f.time,
      tipo: r?.servico || f.tipo,
      bill: r?.valor_cliente ? String(r.valor_cliente) : f.bill,
      cliente_nome: r?.cliente_nome || f.cliente_nome,
    }));
    if (r?.cliente_nome) setClienteSearch(r.cliente_nome);
    if (r?.performer_padrao_id || r?.performer_padrao_nome) {
      setArtists([{
        colaborador_id: r.performer_padrao_id ?? null,
        nome: r.performer_padrao_nome || "",
        tipo: r.servico || "DJ",
        fee: r.custo_interno ? String(r.custo_interno) : "",
      }]);
    } else if (r) {
      setArtists(prev => prev.map((a, idx) => idx === 0 ? {
        ...a,
        tipo: r.servico || a.tipo,
        fee: isEmptyFee(a.fee) && r.custo_interno ? String(r.custo_interno) : a.fee,
      } : a));
    }
  };

  const openCreate = () => {
    loadLookups();
    setForm({ ...emptyForm, date: new Date().toISOString().split("T")[0] });
    setArtists([emptyArtist()]);
    setClienteSearch("");
    setClienteDropOpen(false);
    setClienteCreating(false);
    setIsResidencia(false);
    setResidenciaDates([new Date().toISOString().split("T")[0]]);
    setSelectedPackIds([]);
    setMateriaisReservadosResumo([]);
    setLoadingMateriaisResumo(false);
    setModal({ open: true, editing: null });
  };

  const openEdit = (e: AgendaEvent) => {
    loadLookups();
    setForm({
      title: e.title, date: e.event_date, time: e.time_range || "",
      tipo: e.tipo || "", bill: String(e.bill || 0),
      billing_status: e.billing_status || "Contacto",
      cliente_nome: e.cliente_nome || "",
      modalidade: e.modalidade || "Fatura",
      tipo_comercial: e.tipo_comercial || "Evento",
      servico_comercial: e.servico_comercial || "",
      valor_contexto: e.valor_contexto || inferValorContexto(e.cliente_nome || "", e.tipo_comercial || "Evento"),
      venue: e.venue || "",
      contacto: e.contacto || "", notas: e.notas || "",
      residencia_id: e.residencia_id ?? null,
    });
    setClienteSearch(e.cliente_nome || "");
    setSelectedPackIds([]);
    setClienteDropOpen(false);
    setClienteCreating(false);
    setIsResidencia(false);
    setResidenciaDates([]);
    setModal({ open: true, editing: e });
    setMateriaisReservadosResumo([]);
    setLoadingMateriaisResumo(true);
    getMateriaisReservadosResumoEvento(e.id).then(r => {
      if (r.success) setMateriaisReservadosResumo(r.data as MaterialReservadoResumo[]);
      setLoadingMateriaisResumo(false);
    });
    const cachedArtists = (artistasMap[e.id] || []).map(normalizeArtistRow);
    if (cachedArtists.length > 0) {
      setArtists(cachedArtists);
      setLoadingArtists(false);
      return;
    }
    setArtists([emptyArtist()]);
    setLoadingArtists(true);
    getArtistasEvento(e.id).then(r => {
      if (r.success && r.data.length > 0) setArtists(r.data.map(normalizeArtistRow));
      else setArtists([emptyArtist()]);
      setLoadingArtists(false);
    });
  };

  const closeModal = () => {
    setModal({ open: false, editing: null });
    setForm(emptyForm);
    setArtists([emptyArtist()]);
    setIsResidencia(false);
    setResidenciaDates([]);
    setTrocaNovaData("");
  };

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
      tipo_comercial: form.tipo_comercial,
      servico_comercial: form.servico_comercial,
      valor_contexto: form.valor_contexto,
      venue: form.venue || "",
      contacto: form.contacto || "", notas: form.notas || "",
      residencia_id: form.residencia_id,
    };
    const validArtists = artists.filter(a => a.nome.trim()).map(a => ({
      colaborador_id: a.colaborador_id ?? findColaboradorByNome(a.nome)?.id ?? null,
      nome: a.nome.trim(),
      tipo: a.tipo,
      fee: parseFloat(a.fee) || 0,
    }));
    const reservarPacksEvento = async (eventoId: number, eventoNome: string) => {
      const manualIds = selectedPackIds;
      const auto = await getMaterialPackIdsForServico(form.servico_comercial || form.title || cleanTitle, form.valor_contexto || "Normal");
      const packIds = Array.from(new Set([...(manualIds || []), ...((auto.success ? auto.data : []) as number[])]));
      if (packIds.length === 0) return;
      await reservarMaterialPacksParaEvento({
        evento_id: eventoId,
        evento_nome: eventoNome,
        pack_ids: packIds,
        servico: form.servico_comercial || form.title || cleanTitle,
        reservado_por: userName,
      });
    };

    if (modal.editing) {
      const updateRes = await updateAgendaEvent(modal.editing.id, data);
      await syncArtistasEvento(modal.editing.id, cleanTitle, form.date, validArtists);
      await reservarPacksEvento(modal.editing.id, cleanTitle);
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
          await reservarPacksEvento(res.id, cleanTitle);
        }
      }
      showToast(`${validDates.length} evento${validDates.length > 1 ? "s" : ""} criado${validDates.length > 1 ? "s" : ""}`);
    } else {
      const res = await createAgendaEvent(data);
      if (res.success && res.id) {
        await syncArtistasEvento(res.id, cleanTitle, form.date, validArtists);
        await reservarPacksEvento(res.id, cleanTitle);
      }
      showToast("Evento criado");
    }
    setSaving(false);
    closeModal();
    load(undefined, selectedMonth);
  };

  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const handleCancel = async (e: AgendaEvent) => {
    if (cancellingId === e.id) return;
    setCancellingId(e.id);
    try {
      const res: { success: boolean; message?: string } = await cancelAgendaEvent(e.id);
      if (!res.success) {
        console.error("Falha ao cancelar evento", { id: e.id, res });
        showToast(res.message ? `Erro: ${res.message}` : "Erro ao cancelar evento (ver consola)", undefined, 10000);
        return;
      }
      await load(undefined, selectedMonth);
      showToast("Evento cancelado", {
        label: "Undo",
        fn: async () => { await restoreAgendaEvent(e.id); setToast(""); setUndoAction(null); load(undefined, selectedMonth); },
      });
    } finally {
      setCancellingId(null);
    }
  };
  const handleRestore = async (e: AgendaEvent) => {
    await restoreAgendaEvent(e.id); showToast("Evento reposto"); load(undefined, selectedMonth);
  };
  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar este evento definitivamente?")) return;
    await deleteAgendaEvent(id); showToast("Evento eliminado"); load(undefined, selectedMonth);
  };
  const handleCancelFromModal = async () => {
    if (modal.editing && !cancellingId) {
      const ev = modal.editing;
      setCancellingId(ev.id);
      try {
        const res: { success: boolean; message?: string } = await cancelAgendaEvent(ev.id);
        if (!res.success) {
          console.error("Falha ao cancelar evento", { id: ev.id, res });
          showToast(res.message ? `Erro: ${res.message}` : "Erro ao cancelar evento (ver consola)", undefined, 10000);
          return;
        }
        closeModal(); await load(undefined, selectedMonth);
        showToast("Evento cancelado", {
          label: "Undo",
          fn: async () => { await restoreAgendaEvent(ev.id); setToast(""); setUndoAction(null); load(undefined, selectedMonth); },
        });
      } finally {
        setCancellingId(null);
      }
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
      tipo_comercial: l.tipo_comercial || "Evento",
      servico_comercial: l.servico_comercial || "",
      valor_contexto: l.valor_contexto || inferValorContexto(l.cliente_nome || "", l.tipo_comercial || "Evento"),
      contacto: (l as any).contacto || "", notas: (l as any).notas || "",
    });
    if (res.success) { showToast("Lead convertida em evento"); load(undefined, selectedMonth); }
    else showToast("Erro ao converter");
  };

  // Cancelar lead a partir da agenda (redireciona para leads page)
  const handleLeadRemove = (l: Lead) => {
    if (!confirm(`Remover "${l.title}" da vista da agenda?\n(A lead continua nas Leads)`)) return;
    // Esconde localmente sem alterar a BD — basta retirar do state
    setConfirmedLeads(prev => prev.filter(x => x.id !== l.id));
  };

  // ── Trocas: regista que um evento mudou de dia por troca com outra pessoa
  // (ex: SUD), guardando o dia original como anotação em "notas". Não cria
  // nem apaga eventos — só atualiza a data do evento existente.
  // Extrai a anotação de troca (se existir) do campo notas, sem perder o resto do texto
  const TROCA_TAG_RE = /\[TROCA:([^\]]*)\]/;
  const stripTrocaTag = (notas: string) => (notas || "").replace(TROCA_TAG_RE, "").trim();
  const getTrocaNota = (notas: string): string | null => {
    const m = TROCA_TAG_RE.exec(notas || "");
    return m ? m[1].trim() : null;
  };
  const fmtDataPt = (d: string) => {
    const [, m, dd] = d.split("-");
    return `${dd}/${m}`;
  };
  // Aplica a troca: muda a data do evento para novaData e regista o dia original na nota
  const handleAplicarTroca = async (ev: AgendaEvent, novaData: string) => {
    if (!novaData || novaData === ev.event_date) return;
    const diaOriginal = fmtDataPt(ev.event_date);
    const notaTroca = `[TROCA:troca, dia original ${diaOriginal}]`;
    const notasBase = stripTrocaTag(ev.notas || "");
    const res = await updateAgendaEvent(ev.id, {
      title: ev.title, date: novaData, time: ev.time_range || "",
      tipo: ev.tipo || "", bill: Number(ev.bill) || 0,
      billing_status: ev.billing_status, cliente_nome: ev.cliente_nome,
      modalidade: ev.modalidade, venue: ev.venue || "",
      contacto: ev.contacto || "",
      notas: `${notasBase} ${notaTroca}`.trim(),
    });
    if (res.success) {
      showToast(`Evento movido para ${fmtDataPt(novaData)} (troca registada)`);
      closeModal();
      await load(undefined, selectedMonth);
    } else {
      showToast("Erro ao registar troca");
    }
  };
  // Remove a anotação de troca, sem alterar mais nada
  const handleRemoverNotaTroca = async (ev: AgendaEvent) => {
    const novasNotas = stripTrocaTag(ev.notas || "");
    const res = await updateAgendaEvent(ev.id, {
      title: ev.title, date: ev.event_date, time: ev.time_range || "",
      tipo: ev.tipo || "", bill: Number(ev.bill) || 0,
      billing_status: ev.billing_status, cliente_nome: ev.cliente_nome,
      modalidade: ev.modalidade, venue: ev.venue || "",
      contacto: ev.contacto || "",
      notas: novasNotas,
    });
    if (res.success) {
      showToast("Anotação de troca removida");
      setModal(m => m.editing ? { ...m, editing: { ...m.editing, notas: novasNotas } } : m);
      await load(undefined, selectedMonth);
    }
  };

  // Verifica se um evento e so do Joao (equipa tem apenas azul)
  const isSoJoao = (tipo: string) => {
    const equipa = parseEquipa(tipo);
    return equipa.length > 0 && equipa.every(n => n === "João");
  };

  const filtered = events.filter(e => {
    const monthMatch = monthKey(e.event_date) === selectedMonth;
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
    // João, Tânia/Annia, Soraya e Inês veem a agenda completa.
    // Mantém-se apenas a restrição antiga da Larissa.
    const visibilityMatch = userName !== "Larissa" || !isSoJoao(e.tipo || "");
    return monthMatch && searchMatch && artistaMatch && clienteMatch && equipaMatch && visibilityMatch;
  });

  // Leads confirmadas do mês seleccionado que ainda não estão na agenda
  // Listas para os dropdowns — baseadas em TODOS os eventos do mês seleccionado
  const allMonthEvents = events.filter(e => monthKey(e.event_date) === selectedMonth);
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

  const filteredLeads = confirmedLeads.filter(l => monthKey(l.event_date) === selectedMonth);

  // Histórico de artistas com tipos para autocomplete
  const artistHistory = Array.from(new Set(
    Object.values(artistasMap)
      .flat()
      .filter(a => a.nome?.trim() && a.tipo?.trim())
      .map(a => JSON.stringify({ nome: a.nome, tipo: a.tipo }))
  )).map(j => JSON.parse(j)).sort((a, b) => a.nome.localeCompare(b.nome));

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

  const eventDates = new Set(filtered.map(e => toIsoDate(e.event_date)));
  const leadDates = new Set(filteredLeads.map(l => toIsoDate(l.event_date)));

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
    ...filtered.map(e => ({ kind: "event" as const, date: toIsoDate(e.event_date), data: e })),
    ...filteredLeads.map(l => ({ kind: "lead" as const, date: toIsoDate(l.event_date), data: l })),
    ...folgaDays.map(d => ({ kind: "folga" as const, date: d })),
  ].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    // Same day: sort events by start time
    const aTime = a.kind === "event" ? timeToMinutes(a.data.time_range) : (a.kind === "lead" ? 9998 : 9999);
    const bTime = b.kind === "event" ? timeToMinutes(b.data.time_range) : (b.kind === "lead" ? 9998 : 9999);
    return aTime - bTime;
  });

  const normalizeConflictName = (name: string) => resolveColaboradorNome(name || '')
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const conflictOverrideKeys = new Set(conflictOverrides.map(o => `${o.event_date}|${o.artist_key}`));
  const conflictItems = [
    ...filtered.map(e => ({ key: `event-${e.id}`, entityKey: e.event_id || `agenda-${e.id}`, date: toIsoDate(e.event_date), title: e.title || "Evento", artists: artistasMap[e.id] || [] })),
    ...filteredLeads.map(l => ({ key: `lead-${l.id}`, entityKey: l.event_id || `lead-${l.id}`, date: toIsoDate(l.event_date), title: l.title || "Lead", artists: artistasMap[-l.id] || [] })),
  ];
  const conflictMap = (() => {
    const groups = new Map<string, { artist: string; items: { key: string; entityKey: string; title: string }[] }>();
    for (const item of conflictItems) {
      const seenArtists = new Set<string>();
      for (const a of item.artists) {
        const display = resolveColaboradorNome(a.nome || '').trim();
        const artistKey = normalizeConflictName(display);
        if (!artistKey || seenArtists.has(artistKey)) continue;
        seenArtists.add(artistKey);
        const key = `${item.date}|${artistKey}`;
        if (conflictOverrideKeys.has(key)) continue;
        if (!groups.has(key)) groups.set(key, { artist: display, items: [] });
        groups.get(key)!.items.push({ key: item.key, entityKey: item.entityKey, title: item.title });
      }
    }
    const result = new Map<string, { artist: string; date: string; artistKey: string; others: string[] }[]>();
    for (const [key, group] of groups.entries()) {
      const uniqueEntities = Array.from(new Set(group.items.map(i => i.entityKey)));
      if (uniqueEntities.length < 2) continue;
      const [date, artistKey] = key.split('|');
      for (const item of group.items) {
        const others = group.items.filter(i => i.entityKey !== item.entityKey).map(i => i.title);
        if (!result.has(item.key)) result.set(item.key, []);
        result.get(item.key)!.push({ artist: group.artist, date, artistKey, others: Array.from(new Set(others)) });
      }
    }
    return result;
  })();
  const conflictsForEvent = (e: AgendaEvent) => conflictMap.get(`event-${e.id}`) || [];
  const conflictsForLead = (l: Lead) => conflictMap.get(`lead-${l.id}`) || [];
  const handleDismissConflict = async (date: string, artist: string) => {
    await dismissArtistConflict({ event_date: date, artist_name: artist, note: "Dá para fazer ambos", dismissed_by: userName });
    showToast("Alerta retirado para esse artista nesse dia");
    await load(undefined, selectedMonth);
  };
  const ConflictAlert = ({ conflicts }: { conflicts: { artist: string; date: string; others: string[] }[] }) => conflicts.length === 0 ? null : (
    <div style={{ marginTop: "5px", display: "flex", flexDirection: "column", gap: "4px" }}>
      {conflicts.map(c => (
        <div key={`${c.date}-${c.artist}`} style={{ background: "rgba(226,75,74,0.10)", border: "1px solid rgba(226,75,74,0.35)", color: Colors.red, padding: "5px 7px", fontSize: "9px", lineHeight: 1.35, fontWeight: 700 }}>
          🚨🚨 {c.artist} também está em {c.others.join(" / ")} 🚨🚨
          <button onClick={(ev) => { ev.stopPropagation(); handleDismissConflict(c.date, c.artist); }} style={{ marginLeft: "8px", background: "transparent", border: "none", color: Colors.red, textDecoration: "underline", cursor: "pointer", fontSize: "9px", fontFamily: "inherit" }}>retirar alerta</button>
        </div>
      ))}
    </div>
  );

  const monthTabs = availableMonths.length ? availableMonths : Array.from(new Set([
    ...events.map(e => e.event_date.slice(0, 7)),
    ...confirmedLeads.map(l => l.event_date.slice(0, 7)),
    selectedMonth,
  ])).filter(Boolean).sort();
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
        if (e.event_date !== dateStr) return false;
        if (userName === "Larissa" && isSoJoao(e.tipo || "")) return false;
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
      const dayLeads = confirmedLeads.filter(l => l.event_date === dateStr);

      // Dias sem nenhum evento/lead = Folga
      if (dayEvents.length === 0 && dayLeads.length === 0) {
        lines.push(`*${dd}/${mm} (${wd}-feira)* ⛱️ Folga`);
        lines.push("");
      } else {
        const dateLabel = `*${dd}/${mm} (${wd}-feira)*`;
        const totalItems = dayEvents.length + dayLeads.length;

        const eventLineFor = (e: AgendaEvent): string => {
          const evArtists = (artistasMap[e.id] || []).filter(a => a.nome.trim());
          const seen = new Set<string>();
          const icons = evArtists
            .map(a => { const ic = TIPO_ICON[a.tipo] || ""; if (!ic || seen.has(ic)) return ""; seen.add(ic); return ic; })
            .filter(Boolean).join("");
          const title = (e.title || "").trim();
          const venue = (e.venue || "").trim();
          const trocaNota = getTrocaNota(e.notas || "");
          const anotacao = trocaNota ? ` (${trocaNota})` : "";
          const canceladoTag = e.cancelled ? " 🔴 [CANCELADO]" : "";
          const prefix = icons ? `${icons} ` : "";
          const titleLine = venue ? `${prefix}${title} — ${venue}${anotacao}${canceladoTag}` : `${prefix}${title}${anotacao}${canceladoTag}`;
          const artistLines = evArtists.map(a => `  * ${a.nome} | ${a.tipo}`).join("\n");
          return artistLines ? `${titleLine}\n${artistLines}` : titleLine;
        };
        const leadLineFor = (l: Lead): string => {
          const status = (l.status || "").toLowerCase();
          const icon = ["confirmado","adjudicado","faturado","pago"].includes(status) ? "🟢" : status === "cancelado" ? "🔴" : "🟡";
          return `${icon} ${l.title}`;
        };

        if (totalItems === 1 && dayLeads.length === 1) {
          lines.push(`${dateLabel} ${leadLineFor(dayLeads[0])}`);
        } else if (totalItems === 1 && dayEvents.length === 1) {
          const evLine = eventLineFor(dayEvents[0]);
          const evParts = evLine.split("\n");
          if (evParts.length === 1) {
            lines.push(`${dateLabel} ${evLine}`);
          } else {
            lines.push(dateLabel);
            lines.push("");
            lines.push(evLine);
          }
        } else {
          lines.push(dateLabel);
          lines.push("");
          for (const e of dayEvents) lines.push(eventLineFor(e));
          for (const l of dayLeads) lines.push(leadLineFor(l));
        }
        lines.push("");
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
  // Get colors based on current theme
  const Colors = getColors(lightTheme);
  const bsColors: Record<string, string> = {
    "Contacto": "rgba(245,240,232,0.4)", "Proposta Enviada": Colors.blue,
    "Em Negociação": Colors.amber, "Confirmado": Colors.green,
    "Em Adjudicação": Colors.gold, "Adjudicado": Colors.gold,
    "Faturado": "#A78BFA", "Pago": Colors.green, "Cancelado": Colors.red,
  };

  return (
    <>
    {/* ═══ DESKTOP ═══ */}
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: lightTheme ? "#FFFBF7" : "#0C0B09", color: lightTheme ? Colors.textPrimary : Colors.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <Nav userName={userName} active="agenda" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/"); }} lightTheme={lightTheme} />

      <main style={{ padding: "2rem 2.5rem", maxWidth: "1400px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: Colors.textSec, textTransform: "uppercase", fontWeight: 600 }}>Agenda 2026</p>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
            <button
              onClick={openWaPeriodModal}
              style={{ background: "transparent", border: "1px solid rgba(93,202,165,0.2)", color: "#5DCAA5", fontSize: "8px", letterSpacing: "0.3em", padding: "0.5rem 1.1rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              WhatsApp
            </button>
            {userRole !== "limited_novalues" && (
            <button onClick={openCreate} style={createAddBtnStyle(lightTheme)}>
              <svg width="10" height="10" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
              Novo Evento
            </button>
            )}
          </div>
        </div>

        <div style={{ background: Colors.surface, border: `1px solid ${Colors.borderDim}`, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" }} />
          <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${Colors.borderDim}`, overflowX: "auto" }}>
            {monthTabs.map(ym => (
              <button key={ym} onClick={() => setSelectedMonth(ym)} style={{ background: selectedMonth === ym ? "rgba(201,169,110,0.08)" : "transparent", border: "none", borderRight: `1px solid ${Colors.borderDim}`, borderBottom: selectedMonth === ym ? `1px solid ${Colors.gold}` : "none", color: selectedMonth === ym ? Colors.gold : Colors.textMuted, fontSize: "8px", letterSpacing: "0.3em", padding: "0.75rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize", fontWeight: selectedMonth === ym ? 700 : 400, whiteSpace: "nowrap", transition: "all 0.2s" }}>
                {monthLabel(ym)}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0", borderBottom: `1px solid ${Colors.borderDim}` }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar evento..."
              style={{ flex: 1, background: "var(--theme-subtle-bg)", border: "none", borderRight: `1px solid ${Colors.borderDim}`, color: Colors.textPrimary, fontFamily: "inherit", fontSize: "11px", padding: "0.9rem 1.5rem", letterSpacing: "0.05em", outline: "none" }}
            />
            {/* Artista dropdown */}
            <CustomSelect
              value={filterArtista}
              onChange={v => setFilterArtista(v)}
              placeholder="Artista"
              options={[{ value: "", label: "Artista" }, ...dropdownArtistas.map(a => ({ value: a, label: a }))]}
              style={{ background: filterArtista ? "rgba(201,169,110,0.08)" : "rgba(255,255,255,0.02)", border: "none", borderRight: `1px solid ${Colors.borderDim}`, color: filterArtista ? Colors.gold : Colors.textMuted, fontFamily: "inherit", fontSize: "8px", letterSpacing: "0.25em", padding: "0.9rem 1.25rem", outline: "none", cursor: "pointer", minWidth: "130px", textTransform: "uppercase" as any }}
            />
            {/* Cliente dropdown */}
            <CustomSelect
              value={filterCliente}
              onChange={v => setFilterCliente(v)}
              placeholder="Cliente"
              options={[{ value: "", label: "Cliente" }, ...dropdownClientes.map(c => ({ value: c, label: c }))]}
              style={{ background: filterCliente ? "rgba(201,169,110,0.08)" : "rgba(255,255,255,0.02)", border: "none", borderRight: `1px solid ${Colors.borderDim}`, color: filterCliente ? Colors.gold : Colors.textMuted, fontFamily: "inherit", fontSize: "8px", letterSpacing: "0.25em", padding: "0.9rem 1.25rem", outline: "none", cursor: "pointer", minWidth: "130px", textTransform: "uppercase" as any }}
            />
            {/* Equipa dropdown */}
            <CustomSelect
              value={filterEquipa}
              onChange={v => setFilterEquipa(v)}
              placeholder="Equipa"
              options={[{ value: "", label: "Equipa" }, ...dropdownEquipa.map(n => ({ value: n, label: `${EQUIPA_SYMBOL[n]} ${n}` }))]}
              style={{ background: filterEquipa ? "rgba(201,169,110,0.08)" : "rgba(255,255,255,0.02)", border: "none", color: filterEquipa ? Colors.gold : Colors.textMuted, fontFamily: "inherit", fontSize: "8px", letterSpacing: "0.25em", padding: "0.9rem 1.25rem", outline: "none", cursor: "pointer", minWidth: "120px", textTransform: "uppercase" as any }}
            />
            {/* Clear filters — só aparece se houver algum filtro activo */}
            {(filterArtista || filterCliente || filterEquipa) && (
              <button
                onClick={() => { setFilterArtista(""); setFilterCliente(""); setFilterEquipa(""); }}
                style={{ background: "transparent", border: "none", borderLeft: `1px solid ${Colors.borderDim}`, color: Colors.textMuted, fontSize: "9px", padding: "0.9rem 1rem", cursor: "pointer", whiteSpace: "nowrap", letterSpacing: "0.2em" }}
                title="Limpar filtros"
              >✕</button>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Data", "Evento", "Hora", "Local", "Equipa", "Artistas", "Modalidade", "Estado", "Faturação", "Ações"].map((h, i) => (
                    <th key={h} style={{ fontSize: "7px", letterSpacing: "0.4em", color: Colors.goldDim, fontWeight: 600, textTransform: "uppercase", padding: "0.75rem 1.25rem", borderBottom: `1px solid ${Colors.border}`, textAlign: i >= 8 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allRows.map((row, idx) => {
                  if (row.kind === "folga") {
                    const isFolgaToday = row.date === todayStr;
                    return (
                      <tr key={`folga-${row.date}`} style={{ opacity: 0.38, background: isFolgaToday ? "rgba(201,169,110,0.04)" : undefined }}>
                        <td style={{ ...createTdStyle(lightTheme, { nowrap: true }), color: isFolgaToday ? "#C9A96E" : undefined, fontWeight: isFolgaToday ? 700 : undefined }}>{fmtDate(row.date)}</td>
                        <td colSpan={8} style={{ ...createTdStyle(lightTheme, {}), fontSize: "10px", color: Colors.textMuted, letterSpacing: "0.2em", fontStyle: "italic" }}>
                          ⛱️ Folga
                        </td>
                      </tr>
                    );
                  }
                  if (row.kind === "lead") {
                    const l = row.data;
                    const isLeadToday = l.event_date === todayStr;
                    return (
                      <tr key={`lead-${l.id}`} style={{ background: isLeadToday ? "rgba(201,169,110,0.07)" : "rgba(201,169,110,0.04)", borderLeft: isLeadToday ? `3px solid ${Colors.gold}` : `2px solid rgba(201,169,110,0.35)` }}>
                        <td style={{ ...createTdStyle(lightTheme, { nowrap: true }), color: isLeadToday ? Colors.gold : undefined, fontWeight: isLeadToday ? 700 : undefined }}>{fmtDate(l.event_date)}</td>
                        <td style={{ ...createTdStyle(lightTheme, {}), maxWidth: "280px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "11px" }}>{l.title}</span>
                            </span>
                            <span style={{ fontSize: "8px", color: Colors.goldDim, letterSpacing: "0.25em", textTransform: "uppercase" }}>Lead · {l.status}</span>
                            <ConflictAlert conflicts={conflictsForLead(l)} />
                          </div>
                        </td>
                        <td style={createTdStyle(lightTheme, { muted: true })} colSpan={3}>—</td>
                        <td style={createTdStyle(lightTheme, { muted: true })}>
                          <span style={{ fontSize: "9px", color: Colors.textMuted }}>{l.modalidade || "Fatura"}</span>
                        </td>
                        <td style={createTdStyle(lightTheme, {})}>
                          <StatusBadge color={Colors.amber} label={l.status || "Confirmado"} />
                        </td>
                        <td style={{ ...createTdStyle(lightTheme, { nowrap: true }), textAlign: "right", color: Colors.gold, fontWeight: 600, fontSize: "11px" }}>
                          {userRole === "limited_novalues" ? "—" : (Number(l.value) > 0 ? `${Number(l.value).toLocaleString("pt-PT")}€` : "—")}
                        </td>
                        <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end", alignItems: "center" }}>
                            <button
                              title="Converter para evento"
                              onClick={() => handleLeadConvert(l)}
                              style={{ background: "transparent", border: "none", cursor: "pointer", padding: "5px", color: Colors.green, fontSize: "9px", letterSpacing: "0.15em", fontFamily: "inherit", fontWeight: 600 }}
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
                  <tr key={e.id} style={{ opacity: e.cancelled ? 0.45 : 1, background: isEventToday ? "rgba(201,169,110,0.06)" : undefined, borderLeft: isEventToday ? `3px solid ${Colors.gold}` : undefined }}>
                    <td style={{ ...createTdStyle(lightTheme, { nowrap: true }), color: isEventToday ? Colors.gold : undefined, fontWeight: isEventToday ? 700 : undefined }}>{fmtDate(e.event_date)}</td>
                    <td style={{ ...createTdStyle(lightTheme, {}), maxWidth: "280px" }}>
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
                        {!!e.cancelled && <span style={{ fontSize: "8px", color: Colors.red, letterSpacing: "0.2em" }}>[CANCELADO]</span>}
                        <ConflictAlert conflicts={conflictsForEvent(e)} />
                      </div>
                    </td>
                    <td style={createTdStyle(lightTheme, { muted: true, nowrap: true })}>{e.time_range || "—"}</td>
                    <td style={createTdStyle(lightTheme, { muted: true, maxW: "140px" })}>{e.venue || <span style={{ color: Colors.textMuted }}>—</span>}</td>
                    <td style={{ ...createTdStyle(lightTheme, {}), padding: "0.85rem 1rem" }}>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                        {parseEquipa(e.tipo || "").length > 0
                          ? parseEquipa(e.tipo || "").map(n => (
                              <span key={n} title={n} style={{ fontSize: "16px", lineHeight: 1 }}>{EQUIPA_SYMBOL[n]}</span>
                            ))
                          : <span style={{ fontSize: "10px", color: Colors.textMuted }}>—</span>
                        }
                      </div>
                    </td>
                    <td style={{ ...createTdStyle(lightTheme, {}), maxWidth: "200px" }}>
                      {(() => {
                        const evArtists = (artistasMap[e.id] || []).filter(a => a.nome.trim());
                        return evArtists.length > 0
                          ? <span style={{ fontSize: "10px", color: Colors.textSec, letterSpacing: "0.03em" }}>
                              {evArtists.map(a => resolveColaboradorNome(a.nome)).join(" · ")}
                            </span>
                          : <span style={{ fontSize: "10px", color: Colors.textMuted }}>—</span>;
                      })()}
                    </td>
                    <td style={createTdStyle(lightTheme, { muted: true })}>
                      {e.modalidade && e.modalidade !== "Fatura" ? (
                        <span style={{ fontSize: "9px", color: Colors.amber, letterSpacing: "0.1em" }}>{e.modalidade}</span>
                      ) : (
                        <span style={{ fontSize: "9px", color: Colors.textMuted }}>Fatura</span>
                      )}
                    </td>
                    <td style={createTdStyle(lightTheme, {})}>
                      {e.cancelled ? (
                        <StatusBadge color={Colors.red} label="Cancelado" />
                      ) : (() => {
                        const bs = e.billing_status || "Contacto";
                        const colorMap: Record<string, string> = {
                          "Contacto": Colors.textSec, "Proposta Enviada": Colors.blue,
                          "Em Negociação": Colors.amber, "Confirmado": Colors.green,
                          "Em Adjudicação": Colors.gold, "Adjudicado": Colors.gold,
                          "Faturado": "#A78BFA", "Pago": Colors.green, "Cancelado": Colors.red,
                        };
                        return <StatusBadge color={colorMap[bs] || Colors.textSec} label={bs} />;
                      })()}
                    </td>
                    <td style={{ ...createTdStyle(lightTheme, { nowrap: true }), textAlign: "right", color: Colors.gold, fontWeight: 600, fontSize: "11px" }}>
                      {userRole === "limited_novalues" ? "—" : (Number(e.bill) > 0 ? `${Number(e.bill).toLocaleString("pt-PT")}€` : "—")}
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                      {userRole !== "limited_novalues" && (
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <IconBtn
                          title={materiaisPendentesDoEvento(e.id).length > 0 ? `${materiaisPendentesDoEvento(e.id).length} material(is) reservado(s)` : "Reservar material"}
                          onClick={() => openMaterialModal(e)}
                          icon="material"
                          success={materiaisPendentesDoEvento(e.id).length > 0}
                        />
                        <IconBtn title="Editar" onClick={() => openEdit(e)} icon="edit" />
                        {!e.cancelled
                          ? <IconBtn title="Cancelar" onClick={() => handleCancel(e)} icon="cancel" danger disabled={cancellingId === e.id} />
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
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: "3rem", fontSize: "11px", color: Colors.textMuted, letterSpacing: "0.2em" }}>Sem eventos encontrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

    </div>{/* end desktop */}

    {/* ═══ MOBILE ═══ */}
    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: "var(--theme-text)", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      {/* Mobile top nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--theme-border)", background: "rgba(12,11,9,0.97)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.2rem", letterSpacing: "0.35em", color: "#C9A96E", fontWeight: 300 }}>LLE</span>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} style={{ fontSize: "10px", padding: "0.4rem 0.5rem" }} />
          <span style={{ fontSize: "8px", letterSpacing: "0.35em", color: "rgba(245,240,232,0.2)", textTransform: "uppercase" }}>{userName}</span>
        </div>
      </div>

      {/* Month pills */}
      <div className="mob-months">
        {monthTabs.map(ym => (
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
        <div style={{ background: "var(--theme-surface)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0.75rem 1rem", flexShrink: 0 }}>
          {!mobFilterCategory ? (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(["equipa", "artista", "cliente"] as const).map(cat => (
                <button key={cat} onClick={() => setMobFilterCategory(cat)} style={{ background: "var(--theme-input-bg)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(245,240,232,0.6)", fontSize: "9px", letterSpacing: "0.2em", padding: "0.4rem 0.9rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>
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
                  <div className="mob-card-title" style={{opacity:0.35}}>⛱️ Folga</div>
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
                  <ConflictAlert conflicts={conflictsForLead(l)} />
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
          const bsColor = e.cancelled ? Colors.red : (bsColors[bs] || "rgba(245,240,232,0.3)");
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
                <ConflictAlert conflicts={conflictsForEvent(e)} />
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
                {userRole !== "limited_novalues" && (
                  <button
                    onClick={(ev) => { ev.stopPropagation(); openMaterialModal(e); }}
                    title="Material"
                    style={{ background: "transparent", border: "none", color: materiaisPendentesDoEvento(e.id).length > 0 ? "#5DCAA5" : "rgba(245,240,232,0.35)", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="1.8"><rect x="2" y="5" width="12" height="9" rx="1.2" /><path d="M5.5 5V3.5a2 2 0 014 0V5" /></svg>
                  </button>
                )}
                {userRole !== "limited_novalues" && (
                  e.cancelled
                    ? <button
                        onClick={(ev) => { ev.stopPropagation(); handleRestore(e); }}
                        title="Repor"
                        style={{ background: "transparent", border: "none", color: "#5DCAA5", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-9" /></svg>
                      </button>
                    : <button
                        onClick={(ev) => { ev.stopPropagation(); handleCancel(e); }}
                        disabled={cancellingId === e.id}
                        title="Cancelar"
                        style={{ background: "transparent", border: "none", color: "#E24B4A", cursor: cancellingId === e.id ? "default" : "pointer", padding: "4px", display: "flex", alignItems: "center", opacity: cancellingId === e.id ? 0.4 : 1 }}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="2"><circle cx="8" cy="8" r="6" /><path d="M5 5l6 6M11 5l-6 6" /></svg>
                      </button>
                )}
                <svg className="mob-card-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 4 10 8 6 12"/></svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom tab bar */}
      <MobTabBar active="agenda" role={userRole} lightTheme={lightTheme} />
    </div>

    {/* ═══ MODAL (shared) ═══ */}
      {/* WhatsApp — Modal de Período */}
      {waPeriodModal && (
        <div onClick={e => e.target === e.currentTarget && setWaPeriodModal(false)} style={{ position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--theme-surface)", border: "1px solid rgba(201,169,110,0.12)", padding: "2rem", width: "400px", maxWidth: "95vw", position: "relative" }}>
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
                  <input type="date" value={waCustomStart} onChange={e => { setWaCustomStart(e.target.value); setWaPeriodError(""); }} style={{ width: "100%", background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text)", fontFamily: "inherit", fontSize: "11px", padding: "0.6rem 0.75rem", outline: "none", boxSizing: "border-box" as const }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "7px", letterSpacing: "0.35em", color: "rgba(245,240,232,0.3)", textTransform: "uppercase", marginBottom: "0.4rem" }}>Até</label>
                  <input type="date" value={waCustomEnd} onChange={e => { setWaCustomEnd(e.target.value); setWaPeriodError(""); }} style={{ width: "100%", background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text)", fontFamily: "inherit", fontSize: "11px", padding: "0.6rem 0.75rem", outline: "none", boxSizing: "border-box" as const }} />
                </div>
              </div>
            )}
            {waPeriodError && <p style={{ fontSize: "9px", color: "#E24B4A", letterSpacing: "0.2em", marginBottom: "0.85rem", textTransform: "uppercase" }}>{waPeriodError}</p>}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setWaPeriodModal(false)} style={{ background: "transparent", border: "1px solid var(--theme-input-border)", color: "var(--theme-text-subtle)", fontSize: "9px", letterSpacing: "0.3em", padding: "0.6rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Cancelar</button>
              <button onClick={handleCopyAgenda} style={{ background: "#5DCAA5", border: "none", color: "#0C0B09", fontSize: "9px", letterSpacing: "0.3em", fontWeight: 700, padding: "0.6rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Copiar Agenda</button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {waModal && (
        <div onClick={e => e.target === e.currentTarget && setWaModal(false)} style={{ position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--theme-surface)", border: "1px solid rgba(201,169,110,0.12)", padding: "2rem", width: "500px", maxWidth: "95vw", maxHeight: "85vh", display: "flex", flexDirection: "column", position: "relative" }}>
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
              style={{ flex: 1, minHeight: "300px", background: "var(--theme-subtle-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text)", fontFamily: "monospace", fontSize: "11px", padding: "0.75rem", outline: "none", resize: "vertical", letterSpacing: "0.02em", lineHeight: "1.6" }}
              onClick={e => (e.target as HTMLTextAreaElement).select()}
            />
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button onClick={() => setWaModal(false)} style={{ background: "transparent", border: "1px solid var(--theme-input-border)", color: "var(--theme-text-subtle)", fontSize: "9px", letterSpacing: "0.3em", padding: "0.6rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Fechar</button>
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
              <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: Colors.goldDim, textTransform: "uppercase", fontWeight: 600, margin: 0 }}>
                {modal.editing ? "Editar Evento" : "Novo Evento"}
              </p>
              {!modal.editing && (
                <button
                  type="button"
                  onClick={() => setIsResidencia(r => !r)}
                  style={{
                    background: isResidencia ? "rgba(201,169,110,0.12)" : "transparent",
                    border: `1px solid ${isResidencia ? Colors.gold : "rgba(255,255,255,0.08)"}`,
                    color: isResidencia ? Colors.gold : Colors.textMuted,
                    fontSize: "8px", letterSpacing: "0.3em", padding: "0.4rem 0.9rem",
                    cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600,
                    display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s",
                  }}
                >
                  🔁 Residência
                </button>
              )}
            </div>

            <datalist id="agenda-servicos-vendidos-list">
              {SERVICOS_VENDIDOS.map(s => <option key={s} value={s} />)}
            </datalist>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1.5rem" }}>
              <FormField label="Título do Evento" style={{ gridColumn: "1 / -1" }}>
                <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nome do evento..." />
              </FormField>
              {isResidencia && !modal.editing ? (
                <>
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
                            <button type="button" onClick={() => setResidenciaDates(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "transparent", border: "none", color: Colors.textMuted, cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}>
                              <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setResidenciaDates(prev => [...prev, prev[prev.length - 1] || new Date().toISOString().split("T")[0]])} style={{ ...btnSecStyle, fontSize: "8px", padding: "0.4rem 0.9rem", alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "5px" }}>
                        <svg width="8" height="8" viewBox="0 0 10 10" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" /></svg>
                        Adicionar data
                      </button>
                    </div>
                  </FormField>
                  <FormField label="Residência Ativa" style={{ gridColumn: "1 / -1" }}>
                    <CustomSelect
                      value={form.residencia_id ? String(form.residencia_id) : ""}
                      onChange={v => applyResidenciaAtiva(v ? Number(v) : null)}
                      options={[
                        { value: "", label: "Sem residência master" },
                        ...residenciasAtivas.map(r => ({ value: String(r.id), label: `${r.nome}${r.cliente_nome ? ` · ${r.cliente_nome}` : ""}${r.local ? ` · ${r.local}` : ""}` }))
                      ]}
                      style={inputStyle}
                    />
                    <p style={{ marginTop: "0.5rem", fontSize: "9px", color: Colors.textMuted, letterSpacing: "0.08em" }}>
                      Ao escolher uma residência ativa, a app preenche cliente, local, serviço, duração, faturação e custo sugerido do performer.
                    </p>
                  </FormField>
                </>
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
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--theme-surface-elevated)", border: "1px solid rgba(201,169,110,0.18)", zIndex: 500, maxHeight: "200px", overflowY: "auto" }}>
                        {clientes
                          .filter((c, idx, arr) => arr.findIndex(x => x.nome === c.nome) === idx)
                          .filter(c => c.nome.toLowerCase().includes(clienteSearch.toLowerCase()))
                          .map(c => (
                            <div
                              key={c.id}
                              onMouseDown={() => {
                                setForm(f => ({ ...f, cliente_nome: c.nome, valor_contexto: inferValorContexto(c.nome, f.tipo_comercial) }));
                                setClienteSearch((c as any).alias?.trim() || c.nome);
                                setClienteDropOpen(false);
                              }}
                              style={{ padding: "0.6rem 1rem", fontSize: "11px", color: Colors.textSec, cursor: "pointer", borderBottom: "1px solid var(--theme-border)" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,169,110,0.08)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            >
                              {(c as any).alias?.trim() || c.nome}
                              {(c as any).alias?.trim() && <span style={{ fontSize: "9px", color: Colors.textMuted, marginLeft: "8px" }}>{c.nome}</span>}
                              {c.nif && !((c as any).alias?.trim()) && <span style={{ fontSize: "9px", color: Colors.textMuted, marginLeft: "8px" }}>{c.nif}</span>}
                            </div>
                          ))
                        }
                        <div
                          onMouseDown={() => { setClienteCreating(true); setClienteDropOpen(false); }}
                          style={{ padding: "0.6rem 1rem", fontSize: "10px", color: Colors.gold, cursor: "pointer", letterSpacing: "0.15em", borderTop: "1px solid rgba(201,169,110,0.12)", display: "flex", alignItems: "center", gap: "6px" }}
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
              <FormField label="Tipo Comercial">
                <CustomSelect
                  value={form.tipo_comercial}
                  onChange={v => setForm(f => ({ ...f, tipo_comercial: v, valor_contexto: inferValorContexto(f.cliente_nome, v) }))}
                  options={TIPOS_COMERCIAIS.map(t => ({ value: t, label: t }))}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Serviço Vendido">
                <input
                  list="agenda-servicos-vendidos-list"
                  style={inputStyle}
                  value={form.servico_comercial}
                  onChange={e => setForm(f => ({ ...f, servico_comercial: e.target.value }))}
                  placeholder="DJ s/ AV, Banda c/ AVs..."
                />
              </FormField>
              <FormField label="Perfil de Valor">
                <CustomSelect
                  value={form.valor_contexto}
                  onChange={v => setForm(f => ({ ...f, valor_contexto: v }))}
                  options={VALOR_CONTEXTOS.map(c => ({ value: c, label: c }))}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Sugestão">
                <button type="button" onClick={aplicarValorSugerido} style={{ ...btnSecStyle, width: "100%" }}>
                  Calcular valor
                </button>
              </FormField>
              {valorMasterSuggestion(form.servico_comercial || form.title, form.valor_contexto) && (
                <div style={{ gridColumn: "1 / -1", fontSize: "10px", color: Colors.textMuted, letterSpacing: "0.05em", marginTop: "-0.6rem", marginBottom: "0.6rem" }}>
                  Sugestão: {valorMasterSuggestion(form.servico_comercial || form.title, form.valor_contexto)?.valor || 0}€ · Custo interno: {valorMasterSuggestion(form.servico_comercial || form.title, form.valor_contexto)?.custo || 0}€ · {valorMasterSuggestion(form.servico_comercial || form.title, form.valor_contexto)?.row.contexto}
                </div>
              )}
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
              {modal.editing && (
                <div style={{ gridColumn: "1 / -1", border: `1px solid ${Colors.borderDim}`, padding: "0.85rem", background: "rgba(255,255,255,0.015)" }}>
                  <div style={{ fontSize: "7px", letterSpacing: "0.35em", color: Colors.textMuted, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.55rem" }}>Materiais reservados</div>
                  {loadingMateriaisResumo ? (
                    <div style={{ color: Colors.textMuted, fontSize: "10px" }}>A carregar materiais reservados...</div>
                  ) : materiaisReservadosResumo.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {materiaisReservadosResumo.map((m, idx) => {
                        const voltou = m.quantidade_devolvida || m.quantidade_consumida;
                        const estado = m.estado_regresso || (m.data_volta ? "Voltou" : "Reservado/Saiu");
                        return (
                          <div key={`${m.material_nome}-${idx}`} style={{ color: Colors.textSec, fontSize: "11px", lineHeight: 1.4 }}>
                            <strong style={{ color: Colors.textPrimary }}>{m.quantidade}x {m.material_nome}</strong>
                            {voltou ? <span> · voltou/consumido: {voltou}</span> : null}
                            <span> · {estado}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ color: Colors.textMuted, fontSize: "10px" }}>Sem materiais reservados no sistema.</div>
                  )}
                </div>
              )}
              <FormField label="Notas de materiais / observações" style={{ gridColumn: "1 / -1" }}>
                <textarea style={{ ...inputStyle, minHeight: "72px", resize: "vertical" }} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Ex: dual mic extra, 2 colunas, cabos XLR... / observações" />
              </FormField>
            </div>

            {/* ── Artistas ── */}
            <div style={{ marginTop: "1.75rem", borderTop: `1px solid ${Colors.borderDim}`, paddingTop: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <span style={{ fontSize: "7px", letterSpacing: "0.4em", color: Colors.textMuted, textTransform: "uppercase", fontWeight: 600 }}>Artistas & Pagamentos</span>
                {totalArtistas > 0 && (
                  <span style={{ fontSize: "9px", color: Colors.amber, letterSpacing: "0.15em", fontWeight: 600 }}>
                    Total: {userRole === "limited_novalues" ? "—" : `${totalArtistas.toLocaleString("pt-PT")}€`}
                  </span>
                )}
              </div>

              {loadingArtists ? (
                <p style={{ fontSize: "10px", color: Colors.textMuted, textAlign: "center", padding: "1rem" }}>A carregar...</p>
              ) : (
                <>
                  {/* Table header */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 90px 32px", gap: "4px", marginBottom: "6px" }}>
                    {["Nome", "Tipo", "Fee (€)", ""].map(h => (
                      <span key={h} style={{ fontSize: "7px", letterSpacing: "0.3em", color: Colors.textMuted, textTransform: "uppercase", fontWeight: 600, padding: "0 4px" }}>{h}</span>
                    ))}
                  </div>
                  <datalist id="agenda-colaboradores-list">
                    {colaboradoresAtivos.map(c => <option key={c.id} value={colaboradorDisplayName(c)}>{c.nome_pessoal || c.skills || "Colaborador"}</option>)}
                  </datalist>
                  {artists.map((a, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 130px 90px 32px", gap: "4px", marginBottom: "4px", alignItems: "flex-start" }}>
                      <div style={{ position: "relative" }}>
                        <ArtistAutocomplete
                          value={a.nome}
                          tipoValue={a.tipo}
                          onNomeChange={nome => updateArtistNome(i, nome)}
                          onTipoChange={tipo => updateArtistTipo(i, tipo)}
                          onSelectSuggestion={suggestion => selectArtistSuggestion(i, suggestion)}
                          artistHistory={artistHistory}
                          allTipos={[...ARTIST_TIPOS]}
                          colaboradores={colaboradoresAtivos.map(c => ({ 
                            id: c.id,
                            nome: c.nome,
                            nome_artistico: c.nome_artistico,
                            skills: c.skills,
                          }))}
                          placeholder="Escolher colaborador..."
                          inputStyle={{ ...inputStyle, padding: "0.5rem 0.75rem", fontSize: "11px" }}
                        />
                      </div>
                      <CustomSelect
                        value={a.tipo}
                        onChange={v => updateArtistTipo(i, v)}
                        options={[
                          { value: "", label: "Sem tipo" },
                          ...ARTIST_TIPOS.map(t => ({ value: t, label: t }))
                        ]}
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
                        style={{ background: "transparent", border: "none", color: Colors.textMuted, cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}
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

            {modal.editing && !modal.editing.cancelled && (
              <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <label style={{ display: "block", fontSize: "7px", letterSpacing: "0.4em", color: "var(--theme-text-faint)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.75rem" }}>Troca de Dia</label>
                {getTrocaNota(modal.editing.notas || "") ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", background: "rgba(201,169,110,0.06)", border: "1px solid rgba(201,169,110,0.18)", padding: "0.65rem 0.85rem" }}>
                    <span style={{ fontSize: "10px", color: Colors.gold, letterSpacing: "0.03em" }}>
                      🔁 {getTrocaNota(modal.editing.notas || "")}
                    </span>
                    <button
                      onClick={() => handleRemoverNotaTroca(modal.editing as AgendaEvent)}
                      style={{ background: "transparent", border: "none", color: "var(--theme-text-subtle)", fontSize: "8px", letterSpacing: "0.2em", cursor: "pointer", textTransform: "uppercase", fontFamily: "inherit", flexShrink: 0 }}
                    >Remover</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                    <input
                      type="date"
                      value={trocaNovaData}
                      onChange={e => setTrocaNovaData(e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      onClick={() => { if (trocaNovaData) { handleAplicarTroca(modal.editing as AgendaEvent, trocaNovaData); setTrocaNovaData(""); } }}
                      disabled={!trocaNovaData}
                      style={{ ...btnSecStyle, padding: "0.7rem 1.1rem", flexShrink: 0, opacity: !trocaNovaData ? 0.4 : 1, color: Colors.gold, borderColor: "rgba(201,169,110,0.25)" }}
                    >Registar troca</button>
                  </div>
                )}
                <p style={{ fontSize: "9px", color: "rgba(245,240,232,0.3)", letterSpacing: "0.02em", marginTop: "0.6rem", lineHeight: "1.5" }}>
                  Usa isto quando o evento mudou de dia por troca com outra pessoa (ex: SUD). O evento passa para o novo dia e fica anotado o dia original.
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", justifyContent: "flex-end" }}>
              <button onClick={closeModal} style={btnSecStyle}>Fechar</button>
              {modal.editing && !modal.editing.cancelled && (
                <button onClick={handleCancelFromModal} style={btnDangerStyle}>Cancelar Evento</button>
              )}
              <button onClick={handleSave} disabled={saving} style={btnPrimStyle}>{saving ? "A guardar..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Reservar Material ── */}
      {materialModal.open && materialModal.event && (
        <div onClick={e => e.target === e.currentTarget && closeMaterialModal()} style={{ position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1150, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--theme-surface)", border: `1px solid ${Colors.border}`, padding: "2rem", width: "480px", maxWidth: "95vw", maxHeight: "88vh", overflowY: "auto", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: "rgba(201,169,110,0.6)", textTransform: "uppercase", fontWeight: 600 }}>Material do Evento</p>
              <button onClick={closeMaterialModal} style={{ background: "transparent", border: "none", color: "rgba(245,240,232,0.3)", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>
            <p style={{ fontSize: "12px", color: Colors.textPrimary, marginBottom: "1.25rem" }}>{materialModal.event.title}</p>

            {materiaisDoEvento(materialModal.event.id).length > 0 && (
              <div style={{ marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "6px" }}>
                {materiaisDoEvento(materialModal.event.id).map(mov => {
                  const devolvido = mov.quantidade_devolvida >= mov.quantidade;
                  return (
                    <div key={mov.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.55rem 0.75rem", background: "var(--theme-subtle-bg)", border: `1px solid ${Colors.borderDim}` }}>
                      <span style={{ flex: 1, fontSize: "11px", color: Colors.textPrimary }}>{mov.material_nome} <span style={{ color: Colors.textMuted }}>×{mov.quantidade}</span></span>
                      <span style={{ fontSize: "9px", color: devolvido ? Colors.green : Colors.amber, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        {devolvido ? "Devolvido" : `Com ${mov.origem === "Outro" && mov.origem_detalhe ? mov.origem_detalhe : mov.origem}`}
                      </span>
                      {!devolvido && (
                        <button onClick={() => handleMaterialVoltou(mov)} title="Marcar como devolvido" style={{ background: "rgba(93,202,165,0.12)", border: "1px solid rgba(93,202,165,0.3)", color: Colors.green, fontSize: "8px", padding: "4px 8px", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Voltou</button>
                      )}
                      <button onClick={() => handleRemoverReservaMaterial(mov.id)} title="Remover" style={{ background: "transparent", border: "none", color: Colors.textMuted, cursor: "pointer", fontSize: "13px" }}>×</button>
                    </div>
                  );
                })}
              </div>
            )}

            <p style={{ fontSize: "8px", letterSpacing: "0.3em", color: Colors.textMuted, textTransform: "uppercase", fontWeight: 600, marginBottom: "0.75rem" }}>Reservar novo material</p>

            <div style={{ marginBottom: "0.85rem" }}>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={reservaForm.material_id} onChange={(e: any) => setReservaForm(f => ({ ...f, material_id: Number(e.target.value) }))}>
                <option value={0}>Selecionar material...</option>
                {materiaisAtivos.map(m => <option key={m.id} value={m.id}>{m.nome}{m.categoria ? ` · ${m.categoria}` : ""}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.75rem", marginBottom: "0.85rem" }}>
              <input type="number" min={1} style={inputStyle} value={reservaForm.quantidade} onChange={(e: any) => setReservaForm(f => ({ ...f, quantidade: Math.max(1, Number(e.target.value) || 1) }))} />
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {MATERIAL_ORIGENS.map(o => (
                  <button key={o} onClick={() => setReservaForm(f => ({ ...f, origem: o }))} style={{
                    background: reservaForm.origem === o ? "rgba(201,169,110,0.18)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${reservaForm.origem === o ? "rgba(201,169,110,0.4)" : "rgba(255,255,255,0.1)"}`,
                    color: reservaForm.origem === o ? Colors.gold : Colors.textMuted,
                    fontSize: "10px", padding: "6px 12px", cursor: "pointer", fontFamily: "inherit",
                  }}>{o}</button>
                ))}
              </div>
            </div>
            {reservaForm.origem === "Outro" && (
              <input style={{ ...inputStyle, marginBottom: "0.85rem" }} placeholder="Especificar..." value={reservaForm.origem_detalhe} onChange={(e: any) => setReservaForm(f => ({ ...f, origem_detalhe: e.target.value }))} />
            )}

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button onClick={closeMaterialModal} style={btnSecStyle}>Fechar</button>
              <button onClick={handleReservarMaterial} disabled={reservaSaving || !reservaForm.material_id} style={{ ...btnPrimStyle, opacity: !reservaForm.material_id ? 0.5 : 1 }}>{reservaSaving ? "A reservar..." : "Reservar"}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: "2rem", right: "2rem", maxWidth: "420px", background: "var(--theme-toast-bg)", border: `1px solid ${Colors.border}`, color: Colors.gold, fontSize: "10px", letterSpacing: toast.length > 40 ? "0.02em" : "0.25em", padding: "1rem 1.5rem", zIndex: 2000, transform: toast ? "translateX(0)" : "translateX(200%)", transition: "transform 0.3s ease", textTransform: toast.length > 40 ? "none" : "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ wordBreak: "break-word", userSelect: "text" }}>{toast}</span>
        {undoAction && (
          <button onClick={undoAction.fn} style={{ background: "rgba(201,169,110,0.15)", border: "1px solid rgba(201,169,110,0.3)", color: Colors.gold, fontSize: "9px", letterSpacing: "0.3em", padding: "0.3rem 0.75rem", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, flexShrink: 0 }}>
            {undoAction.label}
          </button>
        )}
      </div>
    </>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function Nav({ userName, active, onLogout, lightTheme }: { userName: string; active: string; onLogout: () => void; lightTheme: boolean }) {
  const stored = typeof window !== "undefined" ? localStorage.getItem("lle_user") : null;
  const role = stored ? JSON.parse(stored).role : "admin";
  const isDark = !lightTheme;
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
  const navBg = isDark ? "rgba(12,11,9,0.95)" : "#FFFFFF";
  const navBorder = isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.12)";
  const textMuted = isDark ? "rgba(245,240,232,0.45)" : "#000000";
  const textVeryMuted = isDark ? "rgba(245,240,232,0.22)" : "rgba(0,0,0,0.55)";
  const buttonBorder = isDark ? "1px solid rgba(201,169,110,0.12)" : "1px solid rgba(0,0,0,0.2)";
  const goldColor = isDark ? "#C9A96E" : "#000000";
  
  return (
    <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 2.5rem", borderBottom: navBorder, position: "sticky", top: 0, zIndex: 100, background: navBg, backdropFilter: "blur(12px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.3rem", letterSpacing: "0.35em", color: goldColor, fontWeight: lightTheme ? 700 : 300 }}>LLE</span>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {links.map(l => (
            <a key={l.href} href={l.href} style={{ fontSize: "9px", letterSpacing: "0.3em", padding: "0.5rem 1rem", textTransform: "uppercase", fontWeight: active === l.href.slice(1) ? (lightTheme ? 700 : 600) : (lightTheme ? 600 : 500), color: active === l.href.slice(1) ? goldColor : textMuted, textDecoration: "none", fontFamily: "'Montserrat','Helvetica Neue',sans-serif" }}>{l.label}</a>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontSize: "9px", letterSpacing: "0.3em", color: textVeryMuted, textTransform: "uppercase", fontWeight: lightTheme ? 600 : 400 }}>{userName}</span>
        <button onClick={onLogout} style={{ background: "transparent", border: buttonBorder, color: textVeryMuted, fontSize: "8px", letterSpacing: "0.4em", padding: "0.5rem 1rem", cursor: "pointer", textTransform: "uppercase", fontFamily: "inherit", fontWeight: lightTheme ? 700 : 600 }}>SAIR</button>
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

function IconBtn({ title, onClick, icon, danger, success, disabled }: { title: string; onClick: () => void; icon: string; danger?: boolean; success?: boolean; disabled?: boolean }) {
  const icons: Record<string, React.ReactNode> = {
    edit: <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="2"><path d="M11 2l3 3-9 9H2v-3l9-9z" /></svg>,
    cancel: <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="2"><circle cx="8" cy="8" r="6" /><path d="M5 5l6 6M11 5l-6 6" /></svg>,
    restore: <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-9" /></svg>,
    delete: <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="2"><polyline points="3 6 4 14 12 14 13 6" /><path d="M2 6h12M10 6V4H6v2" /></svg>,
    material: <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" fill="none" strokeWidth="1.8"><rect x="2" y="5" width="12" height="9" rx="1.2" /><path d="M5.5 5V3.5a2 2 0 014 0V5" /></svg>,
  };
  const color = danger ? "#E24B4A" : success ? "#5DCAA5" : "rgba(245,240,232,0.35)";
  return (
    <button title={title} onClick={onClick} disabled={disabled} style={{ background: "transparent", border: "none", cursor: disabled ? "default" : "pointer", padding: "5px", color, opacity: disabled ? 0.4 : 1, transition: "color 0.15s" }}>
      {icons[icon]}
    </button>
  );
}

function FormField({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: "1.25rem", ...style }}>
      <label style={{ display: "block", fontSize: "7px", letterSpacing: "0.4em", color: "var(--theme-text-faint)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.6rem" }}>{label}</label>
      {children}
    </div>
  );
}

const createAddBtnStyle = (lightTheme: boolean): React.CSSProperties => {
  const isDark = !lightTheme;
  return {
    background: "transparent",
    border: isDark ? "1px solid rgba(201,169,110,0.12)" : "1px solid rgba(0,0,0,0.2)",
    color: isDark ? "#8a7350" : "#000000",
    fontSize: "8px",
    letterSpacing: "0.35em",
    padding: "0.5rem 1.25rem",
    cursor: "pointer",
    fontFamily: "inherit",
    textTransform: "uppercase",
    fontWeight: lightTheme ? 700 : 600,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    transition: "all 0.2s"
  };
};

// Helper dinâmico para criar tdStyle baseado no tema
const createTdStyle = (lightTheme: boolean, { muted, nowrap, maxW }: { muted?: boolean; nowrap?: boolean; maxW?: string }): React.CSSProperties => {
  const isDark = !lightTheme;
  return {
    fontSize: "12px",
    color: isDark
      ? (muted ? "rgba(245,240,232,0.45)" : "#F5F0E8")
      : (muted ? "rgba(0,0,0,0.75)" : "#000000"),
    fontWeight: lightTheme ? 500 : undefined,
    padding: "0.85rem 1.25rem",
    borderBottom: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.12)",
    whiteSpace: nowrap ? "nowrap" : undefined,
    maxWidth: maxW,
    overflow: maxW ? "hidden" : undefined,
    textOverflow: maxW ? "ellipsis" : undefined
  };
};
const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" };
const modalStyle: React.CSSProperties = { background: "var(--theme-surface)", border: "1px solid rgba(201,169,110,0.12)", padding: "clamp(1.25rem, 4vw, 2.5rem)", width: "640px", maxWidth: "96vw", maxHeight: "92dvh", overflowY: "auto", position: "relative" };
const topLineStyle: React.CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, #C9A96E, transparent)" };
const inputStyle: React.CSSProperties = { width: "100%", background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text)", fontFamily: "'Montserrat','Helvetica Neue',sans-serif", fontSize: "11px", padding: "0.75rem 1rem", letterSpacing: "0.05em", outline: "none", boxSizing: "border-box" };
const btnPrimStyle: React.CSSProperties = { background: "var(--theme-accent)", border: "none", color: "var(--theme-accent-contrast)", fontSize: "9px", letterSpacing: "0.4em", fontWeight: 700, padding: "0.75rem 1.75rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };
const btnSecStyle: React.CSSProperties = { background: "transparent", border: "1px solid rgba(201,169,110,0.12)", color: "var(--theme-text-subtle)", fontSize: "9px", letterSpacing: "0.4em", fontWeight: 600, padding: "0.75rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };
const btnDangerStyle: React.CSSProperties = { background: "transparent", border: "1px solid rgba(226,75,74,0.3)", color: "#E24B4A", fontSize: "8px", letterSpacing: "0.3em", fontWeight: 600, padding: "0.75rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };

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
        <div style={{ width: "36px", height: "3px", background: drawerHandle, borderRadius: "2px", margin: "0 auto 0.75rem" }} />
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
