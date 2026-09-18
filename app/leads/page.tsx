"use client";

import MobTabBar from "../MobTabBar";
import DesktopNav from "../DesktopNav";

import { ARTIST_TIPOS, MODALIDADES, SERVICOS_VENDIDOS, TIPOS_COMERCIAIS, VALOR_CONTEXTOS, resolveColaboradorNome, parseServicosContratados, parseServicosContratadosDetalhes, isAutoBudgetPackService, standaloneSkillForService } from "../constants";
import { ArtistAutocomplete, type ArtistOption } from "../ArtistAutocomplete";
import { ServiceMultiSelect } from "../ServiceMultiSelect";
import { standaloneOptionsFromColaboradores, standaloneReferenceFromColaboradores } from "../autoBudgetPricing";
import { useTheme } from "../useTheme";
import { ThemeSwitcher } from "../ThemeSwitcher";
import React, { useEffect, useState, useCallback, useRef } from "react";

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
          background: "var(--theme-surface-elevated)", border: "1px solid var(--theme-input-border)",
          color: "var(--theme-text)",
          zIndex: 9999, maxHeight: 240, overflowY: "auto",
          boxShadow: "var(--theme-dropdown-shadow)",
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
                color: o.value === value ? "var(--theme-accent)" : "var(--theme-text)",
                background: o.value === value ? "var(--theme-dropdown-selected)" : "transparent",
                cursor: "pointer",
                borderBottom: "1px solid var(--theme-border)",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--theme-dropdown-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = o.value === value ? "var(--theme-dropdown-selected)" : "transparent")}
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
  getAllClientes, createCliente, createAgendaEvent, getAllAgenda, getAllArtistasAgenda,
  getAllColaboradores, getAllValoresFuncoes, getAllValoresMaster,
  syncArtistasEvento, getArtistasEvento, setupDatabase, syncArtistasParaAgenda,
  getAllMaterialPacks, getMaterialPackIdsLead, syncMaterialPacksLead, reservarMaterialPacksDaLeadParaEvento,
  syncAllExistingData, getArtistConflictOverrides, dismissArtistConflict, getLeadsPageBundle, getLeadsFormLookups, getMaterialPackIdsForServico, syncPacksComerciaisMateriaisEvento,
} from "../actions";

interface Lead {
  id: number; title: string; event_date: string; value: number;
  status?: string; cancelled?: number;
  local?: string; contacto?: string; notas?: string;
  cliente_nome?: string; cliente_id?: number | null; modalidade?: string; valor_recebido?: number;
  agenda_event_id?: number | null; event_id?: string;
  tipo_comercial?: string; servico_comercial?: string; valor_contexto?: string; autobudget_snapshot?: string; residencia_id?: number | null;
  material_revenue?: number; material_cost?: number;
}

interface AgendaEvent {
  id: number; title: string; event_date: string; event_id?: string; origem_lead_id?: number | null; cancelled?: number;
  material_revenue?: number; material_cost?: number;
}
interface ConflictOverride { event_date: string; artist_key: string; artist_name: string; note?: string; }
interface Cliente { id: number; nome: string; nif?: string; alias?: string; }
interface Colaborador {
  id: number; nome: string; nome_artistico?: string; nome_pessoal?: string; contacto?: string; email?: string; iban?: string;
  skills?: string; notas?: string; ativo: number;
  skill_profiles?: Record<string, {
    valor?: number; custo_interno?: number; custo_evento?: number;
    valor_sud?: number; valor_evento_residencia?: number;
    valor_parceria?: number; valor_cliente_final?: number;
    custo_sud?: number; custo_evento_residencia?: number; custo_parceria?: number; custo_cliente_final?: number; rating?: number;
  }>;
}

interface ValorFuncao {
  id: number; funcao: string; custo_padrao: number; valor_cliente_padrao: number; notas?: string; ativo: number;
}
interface ValorMaster {
  id: number; servico: string; duracao_formato: string; contexto: string; cliente_nome?: string;
  custo_interno: number; valor_parceiro: number; valor_sud: number; valor_cliente_final: number; notas?: string; ativo: number;
}
interface ResidenciaAtiva {
  id: number; nome: string; cliente_id?: number | null; cliente_nome: string; local: string; servico: string; duracao_formato: string;
  custo_interno: number; custo_evento?: number; valor_cliente: number; valor_evento?: number; performer_padrao_id?: number | null; performer_padrao_nome?: string; notas?: string; ativo: number;
}

interface PackComercialComponente {
  id: number; pack_id: number; tipo: "skill" | "material"; referencia: string; material_id?: number | null;
  quantidade: number; notas?: string; material_nome?: string; material_imagem?: string; material_custo_interno?: number;
}
interface PackComercial {
  id: number; nome: string; descricao?: string; valor_sud: number; valor_residencia: number; valor_evento_residencia: number;
  valor_parceria: number; valor_cliente_final: number; notas?: string; ativo: number; componentes: PackComercialComponente[];
}
interface MaterialPackItem { id: number; pack_id: number; material_nome: string; categoria: string; quantidade: number; notas?: string; }
interface MaterialPack {
  id: number; nome: string; descricao: string; valor_referencia: number; ativo: number;
  items: MaterialPackItem[];
  links?: { id: number; servico: string; duracao_formato: string; contexto: string; notas?: string }[];
}

function displayClienteNome(lead: { cliente_id?: number | null; cliente_nome?: string }, clientes: Cliente[]): string {
  if (lead.cliente_id) {
    const c = clientes.find(c => c.id === lead.cliente_id);
    if (c) return c.alias?.trim() || c.nome;
  }
  if (lead.cliente_nome) {
    const c = clientes.find(c => c.nome === lead.cliente_nome || (c.alias?.trim() && c.alias.trim() === lead.cliente_nome));
    if (c) return c.alias?.trim() || c.nome;
  }
  return lead.cliente_nome || '';
}
interface ArtistRow { id?: number; colaborador_id?: number | null; nome: string; tipo: string; fee: string; fee_auto?: boolean; }

const emptyArtist = (): ArtistRow => ({ colaborador_id: null, nome: "", tipo: "", fee: "", fee_auto: true });

const C = {
  gold: "var(--theme-accent)", goldDim: "var(--theme-accent-muted)", surface: "var(--theme-surface)", pageBg: "var(--theme-bg)",
  border: "rgba(var(--theme-accent-rgb),0.12)", borderDim: "rgba(var(--theme-contrast-rgb),0.05)",
  textPrimary: "var(--theme-text)", textSec: "var(--theme-text-muted)", textMuted: "var(--theme-text-faint)",
  green: "var(--theme-success)", amber: "var(--theme-warning)", blue: "var(--theme-info)", red: "var(--theme-danger)", purple: "#A78BFA",
};

const C_Light = {
  gold: "#8B4513", goldDim: "#6F3A18", surface: "#FFFFFF", pageBg: "#FFFBF7",
  border: "rgba(0,0,0,0.15)", borderDim: "rgba(0,0,0,0.12)",
  textPrimary: "#111827", textSec: "rgba(17,24,39,0.82)", textMuted: "rgba(17,24,39,0.62)",
  green: "#2E7D32", amber: "#A65300", blue: "#1565C0", red: "#C62828", purple: "#6A1B9A",
};

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
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeText(v: string) {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function tipoFromSkills(skills?: string) {
  const first = (skills || "").split(",").map(s => s.trim()).filter(Boolean)[0] || "";
  const map: Record<string, string> = {
    "Cantor/a": "Cantor(a)", "Cantor(a)": "Cantor(a)", "DJ": "DJ", "Saxofonista": "Saxofonista", "Violinista": "Violinista",
    "Pianista": "Pianista", "Guitarrista": "Guitarrista", "Baterista": "Baterista", "Percussionista": "Percussionista",
    "Bailarino/a": "Bailarino(a)", "Ator/Host": "Host", "Animador/a": "Animador(a)", "Animador": "Animador(a)", "Animadora": "Animador(a)",
    "Produtor/Coordenador": "Produtor", "Makeup & Hair": "Make-up & Hair", "Assistente de Guarda-Roupa": "Guarda-Roupa",
    "Coreógrafo/a": "Coreógrafo(a)",
  };
  const mapped = map[first] || first || "";
  return mapped && (ARTIST_TIPOS as readonly string[]).includes(mapped) ? mapped : "";
}

function safeNumber(value: number | string | undefined | null) {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function effectiveReceived(total: number | string | undefined, received: number | string | undefined, status?: string) {
  const t = Math.max(0, safeNumber(total));
  const r = Math.max(0, safeNumber(received));
  return status === "Pago" && t > 0 ? Math.max(t, r) : r;
}

function paymentPercent(total: number | string | undefined, received: number | string | undefined, status?: string) {
  const t = safeNumber(total);
  if (t <= 0) return 0;
  return Math.max(0, Math.min(100, (effectiveReceived(total, received, status) / t) * 100));
}

const STATUS_OPTIONS = ["Contacto", "Proposta Enviada", "Em Negociação", "Confirmado", "Em Adjudicação", "Adjudicado", "Faturado", "Pago", "Cancelado"];
const emptyForm = { title: "", event_date: "", value: "0", valor_recebido: "0", status: "Contacto", local: "", contacto: "", notas: "", cliente_nome: "", cliente_id: null as number | null, modalidade: "Fatura", tipo_comercial: "Evento", servico_comercial: "", valor_contexto: "Cliente Final", residencia_id: null as number | null, autobudget_snapshot: "" };

const addArtistRow = (setArtists: React.Dispatch<React.SetStateAction<ArtistRow[]>>) => 
  setArtists(prev => [...prev, emptyArtist()]);
const removeArtistRow = (setArtists: React.Dispatch<React.SetStateAction<ArtistRow[]>>, i: number) => 
  setArtists(prev => prev.filter((_, idx) => idx !== i));
const updateArtist = (setArtists: React.Dispatch<React.SetStateAction<ArtistRow[]>>, i: number, field: keyof ArtistRow, value: string) =>
  setArtists(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a));

export default function LeadsPage() {
  const router = useRouter();
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const C = getColors(lightTheme);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agendaEvents, setAgendaEvents] = useState<AgendaEvent[]>([]);
  const [artistasMap, setArtistasMap] = useState<Record<number, ArtistRow[]>>({});
  const [conflictOverrides, setConflictOverrides] = useState<ConflictOverride[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [valoresFuncoes, setValoresFuncoes] = useState<ValorFuncao[]>([]);
  const [valoresMaster, setValoresMaster] = useState<ValorMaster[]>([]);
  const [residenciasAtivas, setResidenciasAtivas] = useState<ResidenciaAtiva[]>([]);
  const [packsComerciais, setPacksComerciais] = useState<PackComercial[]>([]);
  const [materialPacks, setMaterialPacks] = useState<MaterialPack[]>([]);
  const [selectedPackIds, setSelectedPackIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ open: boolean; editing: Lead | null }>({ open: false, editing: null });
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteDropOpen, setClienteDropOpen] = useState(false);
  const [clienteCreating, setClienteCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [artists, setArtists] = useState<ArtistRow[]>([emptyArtist()]);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [toast, setToast] = useState("");
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [waModal, setWaModal] = useState(false);
  const [waText, setWaText] = useState("");
  const [waCopied, setWaCopied] = useState(false);
  const [waMonthModal, setWaMonthModal] = useState(false);
  const [selectedWaMonths, setSelectedWaMonths] = useState<Set<string>>(new Set());
  const [waMonthError, setWaMonthError] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);
  const [lookupsLoading, setLookupsLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };
  const togglePackSelecionado = (packId: number) => setSelectedPackIds(prev => prev.includes(packId) ? prev.filter(id => id !== packId) : [...prev, packId]);

  const loadLookups = useCallback(async () => {
    if (lookupsLoaded || lookupsLoading) return;
    setLookupsLoading(true);
    const r = await getLeadsFormLookups();
    if (r.success) {
      if (r.clientes?.success) setClientes(r.clientes.data as Cliente[]);
      if (r.colaboradores?.success) setColaboradores(r.colaboradores.data as Colaborador[]);
      if (r.valoresFuncoes?.success) setValoresFuncoes(r.valoresFuncoes.data as ValorFuncao[]);
      if (r.valoresMaster?.success) setValoresMaster(r.valoresMaster.data as ValorMaster[]);
      if (r.residencias?.success) setResidenciasAtivas((r.residencias.data as ResidenciaAtiva[]).filter(x => x.ativo === 1));
      if (r.packsComerciais?.success) setPacksComerciais((r.packsComerciais.data as PackComercial[]).filter(x => x.ativo === 1));
      setLookupsLoaded(true);
    }
    setLookupsLoading(false);
  }, [lookupsLoaded, lookupsLoading]);

  const load = useCallback(async (monthOverride?: string) => {
    setLoading(true);
    const targetMonth = monthOverride || selectedMonth;
    const bundle = await getLeadsPageBundle(targetMonth);
    if (!bundle.success) { setLoading(false); return; }
    const r = bundle.leads;
    const ar = bundle.agenda;
    const aar = bundle.artistas;
    const cor = bundle.conflicts;
    const mr = bundle.months;
    if (mr?.success) {
      const months = (mr.data as string[]).filter(Boolean);
      setAvailableMonths(months.includes(targetMonth) ? months : [...months, targetMonth].sort());
    }
    if (r?.success) setLeads(r.data as Lead[]);
    if (ar?.success) setAgendaEvents(ar.data as AgendaEvent[]);
    if (aar?.success) setArtistasMap(Object.fromEntries(Object.entries(aar.data as Record<number, any[]>).map(([k, v]) => [k, v.map((a: any) => ({ ...a, colaborador_id: a.colaborador_id ?? null, fee: String(a.fee ?? "") }))])));
    if (cor?.success) setConflictOverrides(cor.data as ConflictOverride[]);
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => {
    const u = localStorage.getItem("lle_user");
    if (!u) { router.push("/"); return; }
    const parsed = JSON.parse(u);
    setUserName(parsed.name);
    setUserRole(parsed.role || "admin");
    load(selectedMonth);
  }, [load, selectedMonth]);

  const colaboradorDisplayName = (c: Colaborador) => String(c.nome_artistico || c.nome || "");
  const colaboradoresAtivos = colaboradores
    .filter(c => c.ativo === 1)
    .sort((a, b) => colaboradorDisplayName(a).localeCompare(colaboradorDisplayName(b), "pt-PT", { sensitivity: "base" }));
  const autoBudgetStandaloneOptions = standaloneOptionsFromColaboradores(colaboradoresAtivos);
  const autoBudgetPackOptions = packsComerciais.filter(p => p.ativo === 1).map(p => p.nome).sort((a,b) => a.localeCompare(b, "pt-PT", { sensitivity: "base" }));
  const findCommercialPackByName = (name: string) => packsComerciais.find(p => normalizeText(p.nome) === normalizeText(name));
  const commercialPackBillingValue = (pack: PackComercial, contexto: string) => {
    if (contexto === "SUD") return Number(pack.valor_sud || pack.valor_cliente_final || 0);
    if (contexto === "Residência") return Number(pack.valor_residencia || 0);
    if (contexto === "Evento Residência") return Number(pack.valor_evento_residencia || 0);
    if (contexto === "Parceiro") return Number(pack.valor_parceria || 0);
    return Number(pack.valor_cliente_final || 0);
  };
  const commercialPackEstimatedCost = (pack: PackComercial, contexto: string) => (pack.componentes || []).reduce((sum, component) => {
    const qty = Math.max(1, Number(component.quantidade || 1));
    if (component.tipo === "material") return sum + Number(component.material_custo_interno || 0) * qty;
    const ref = standaloneReferenceFromColaboradores(component.referencia, contexto, colaboradoresAtivos, form.tipo_comercial);
    return sum + Number(ref?.custo || 0) * qty;
  }, 0);
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
  const skillProfileFor = (col: Colaborador | undefined, tipo: string) => {
    if (!col?.skill_profiles || !tipo) return undefined;
    const exact = col.skill_profiles[tipo];
    if (exact) return exact;
    const key = Object.keys(col.skill_profiles).find(k => normalizeText(k) === normalizeText(tipo));
    return key ? col.skill_profiles[key] : undefined;
  };
  const residenciaAppliesToArtist = (residencia: ResidenciaAtiva | undefined, col: Colaborador | undefined, tipo: string) => {
    if (!residencia || !col || !tipo) return false;
    const performerMatches = residencia.performer_padrao_id === col.id || (
      !!residencia.performer_padrao_nome && normalizeText(residencia.performer_padrao_nome) === normalizeText(col.nome_artistico || col.nome)
    );
    const performerIsVariable = !residencia.performer_padrao_id && !residencia.performer_padrao_nome;
    const residenceSkill = standaloneSkillForService(residencia.servico || "");
    if (!residenceSkill) return performerMatches;
    return normalizeText(residenceSkill) === normalizeText(tipo) && (performerIsVariable || performerMatches);
  };

  const artistCostSuggestion = (
    col: Colaborador | undefined,
    tipo: string,
    tipoComercial: string = form.tipo_comercial,
    _valorContexto: string = form.valor_contexto,
    residenciaId: number | null = form.residencia_id,
  ) => {
    const fallback = suggestedFeeForTipo(tipo);
    if (!col || !tipo) return { value: fallback, source: fallback ? "Tabela antiga · custo padrão" : "Sem custo definido" };
    const p = skillProfileFor(col, tipo);
    if (!p) return { value: fallback, source: fallback ? "Tabela antiga · custo padrão" : "Sem custo definido" };

    const custoEvento = Number(p.custo_evento ?? p.custo_interno ?? p.valor ?? fallback ?? 0);
    const residencia = residenciaId ? residenciasAtivas.find(r => r.id === residenciaId) : undefined;
    const canUseResidencia = residenciaAppliesToArtist(residencia, col, tipo);

    if (tipoComercial === "Residência") {
      if (canUseResidencia && Number(residencia?.custo_interno || 0) > 0) {
        return { value: Number(residencia!.custo_interno), source: `Residência · ${residencia!.nome} · custo residência` };
      }
      return { value: 0, source: residencia ? `Residência · ${residencia.nome} · custo por definir` : "Escolhe uma Residência para obter o custo" };
    }

    if (tipoComercial === "Evento de Residência") {
      if (canUseResidencia && Number(residencia?.custo_evento || 0) > 0) {
        return { value: Number(residencia!.custo_evento), source: `Residência · ${residencia!.nome} · custo evento` };
      }
      return { value: custoEvento, source: custoEvento ? "Colaborador · custo evento" : "Sem custo definido" };
    }

    return { value: custoEvento, source: custoEvento ? "Colaborador · custo evento" : "Sem custo definido" };
  };

  const suggestedFeeForArtist = (
    col: Colaborador | undefined,
    tipo: string,
    tipoComercial: string = form.tipo_comercial,
    valorContexto: string = form.valor_contexto,
    residenciaId: number | null = form.residencia_id,
  ) => artistCostSuggestion(col, tipo, tipoComercial, valorContexto, residenciaId).value;

  const repriceAutoArtists = (tipoComercial: string, valorContexto: string, residenciaId: number | null) => {
    setArtists(prev => prev.map(a => {
      if (!(a.fee_auto || isEmptyFee(a.fee))) return a;
      const col = findColaboradorById(a.colaborador_id) || findColaboradorByNome(a.nome);
      if (!col || !a.tipo) return a;
      const fee = suggestedFeeForArtist(col, a.tipo, tipoComercial, valorContexto, residenciaId);
      return { ...a, fee: fee ? String(fee) : "", fee_auto: true };
    }));
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

  const legacyValorMasterSuggestionSingle = (servico: string, contexto?: string) => {
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
    const resolvedRow = row || rows[0];
    const valor = ctx === "SUD"
      ? Number(resolvedRow.valor_sud || resolvedRow.valor_cliente_final || 0)
      : (ctx === "Parceiro" || ctx === "Residência")
        ? Number(resolvedRow.valor_parceiro || 0)
        : Number(resolvedRow.valor_cliente_final || 0);
    return {
      row: resolvedRow,
      valor,
      custo: Number(resolvedRow.custo_interno || 0),
      servico,
      sourceType: "legacy" as const,
      sourceName: isAutoBudgetPackService(servico) ? "Pack / tabela atual" : "Tabela atual",
      costSourceName: "Tabela atual",
      skill: "",
    };
  };

  const residenciaAppliesToService = (residencia: ResidenciaAtiva | undefined, servico: string) => {
    if (!residencia || !servico) return false;
    if (normalizeText(residencia.servico || "") === normalizeText(servico)) return true;
    const residenceSkill = standaloneSkillForService(residencia.servico || "");
    const serviceSkill = standaloneSkillForService(servico);
    return !!residenceSkill && !!serviceSkill && normalizeText(residenceSkill) === normalizeText(serviceSkill);
  };

  const valorMasterSuggestionSingle = (servico: string, contexto?: string) => {
    const ctx = contexto || form.valor_contexto || "Cliente Final";
    const commercialPack = findCommercialPackByName(servico);
    if (commercialPack) {
      return {
        row: undefined as ValorMaster | undefined,
        valor: commercialPackBillingValue(commercialPack, ctx),
        custo: commercialPackEstimatedCost(commercialPack, ctx),
        servico,
        sourceType: "pack" as const,
        sourceName: `Pack · ${commercialPack.nome}`,
        costSourceName: commercialPack.componentes?.length ? "Componentes do pack" : "Composição por definir",
        skill: "",
        candidateCount: 0,
      };
    }
    if (!isAutoBudgetPackService(servico)) {
      const ref = standaloneReferenceFromColaboradores(servico, ctx, colaboradoresAtivos, form.tipo_comercial);
      if (ref) {
        const residencia = form.residencia_id ? residenciasAtivas.find(r => r.id === form.residencia_id) : undefined;
        const residenceMatches = residenciaAppliesToService(residencia, servico);
        let valor = Number(ref.valor || 0);
        let custo = Number(ref.custo || 0);
        let sourceName = ref.sourceName;
        let costSourceName = ref.costSourceName;

        if (residenceMatches && form.tipo_comercial === "Residência") {
          if (Number(residencia?.valor_cliente || 0) > 0) {
            valor = Number(residencia!.valor_cliente);
            sourceName = `Residência · ${residencia!.nome} · faturação residência`;
          }
          if (Number(residencia?.custo_interno || 0) > 0) {
            custo = Number(residencia!.custo_interno);
            costSourceName = `Residência · ${residencia!.nome} · custo residência`;
          }
        } else if (residenceMatches && form.tipo_comercial === "Evento de Residência") {
          if (Number(residencia?.valor_evento || 0) > 0) {
            valor = Number(residencia!.valor_evento);
            sourceName = `Residência · ${residencia!.nome} · faturação evento residência`;
          }
          if (Number(residencia?.custo_evento || 0) > 0) {
            custo = Number(residencia!.custo_evento);
            costSourceName = `Residência · ${residencia!.nome} · custo evento`;
          }
        }

        return {
          row: undefined as ValorMaster | undefined,
          valor,
          custo,
          servico,
          sourceType: "colaboradores" as const,
          sourceName,
          costSourceName,
          skill: ref.skill,
          candidateCount: ref.candidateCount,
          noActiveProvider: ref.candidateCount === 0,
        };
      }
    }
    return legacyValorMasterSuggestionSingle(servico, contexto);
  };

  const valorMasterSuggestion = (servicoValue?: string, contexto?: string) => {
    const selected = parseServicosContratadosDetalhes(servicoValue);
    const servicos = selected.length > 0
      ? selected
      : ((servicoValue || "").trim() ? [{ nome: String(servicoValue).trim(), quantidade: 1 }] : []);
    if (servicos.length === 0) return null;
    const found = servicos.map(item => {
      const base = valorMasterSuggestionSingle(item.nome, contexto);
      if (!base) return null;
      const quantidade = Math.max(1, Number(item.quantidade || 1) || 1);
      const assignedCount = base.skill
        ? artists.filter(a => normalizeText(a.tipo || "") === normalizeText(base.skill)).length
        : null;
      return {
        ...base,
        quantidade,
        assignedCount,
        valorUnitario: Number(base.valor || 0),
        custoUnitario: Number(base.custo || 0),
        valorTotal: Number(base.valor || 0) * quantidade,
        custoTotal: Number(base.custo || 0) * quantidade,
      };
    }).filter(Boolean) as Array<NonNullable<ReturnType<typeof valorMasterSuggestionSingle>> & {
      quantidade: number; assignedCount: number | null; valorUnitario: number; custoUnitario: number; valorTotal: number; custoTotal: number;
    }>;
    if (found.length === 0) return null;
    const foundNames = new Set(found.map(x => x.servico));
    const semValor = servicos.filter(s => !foundNames.has(s.nome)).map(s => s.nome);
    for (const item of found) if (item.valorUnitario <= 0 && !semValor.includes(item.servico)) semValor.push(item.servico);
    return {
      row: found[0].row,
      valor: found.reduce((sum, x) => sum + x.valorTotal, 0),
      custo: found.reduce((sum, x) => sum + x.custoTotal, 0),
      encontrados: found.length,
      total: servicos.length,
      semValor,
      items: found,
    };
  };

  const aplicarValorSugerido = () => {
    const suggestion = valorMasterSuggestion(form.servico_comercial || form.title, form.valor_contexto);
    const total = Number(suggestion?.valor || 0);
    if (!suggestion && !total) { showToast("Sem valor sugerido para esta combinação"); return; }
    const snapshot = suggestion ? {
      version: 1,
      applied_at: new Date().toISOString(),
      tipo_comercial: form.tipo_comercial,
      valor_contexto: form.valor_contexto,
      residencia_id: form.residencia_id,
      faturacao_sugerida: total,
      custo_estimado: Number(suggestion.custo || 0),
      items: suggestion.items.map(item => ({
        servico: item.servico,
        quantidade: item.quantidade,
        skill: item.skill || "",
        valor_unitario: item.valorUnitario,
        valor_total: item.valorTotal,
        custo_unitario: item.custoUnitario,
        custo_total: item.custoTotal,
        fonte_faturacao: item.sourceName || "",
        fonte_custo: item.costSourceName || "",
      })),
    } : null;
    setForm(f => ({ ...f, value: String(total), autobudget_snapshot: snapshot ? JSON.stringify(snapshot) : f.autobudget_snapshot }));
    showToast(`Auto Budget aplicado: ${total}€`);
  };
  const normalizeArtistRow = (a: any): ArtistRow => {
    const col = findColaboradorById(a.colaborador_id) || findColaboradorByNome(a.nome || "");
    return {
      id: a.id,
      colaborador_id: col?.id ?? a.colaborador_id ?? null,
      nome: col ? colaboradorDisplayName(col) : (a.nome || ""),
      tipo: a.tipo || (col ? tipoFromSkills(col.skills) : ""),
      fee: String(a.fee ?? ""),
      fee_auto: false,
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
      const fee = col && nextTipo ? suggestedFeeForArtist(col, nextTipo) : (nextTipo ? suggestedFeeForTipo(nextTipo) : 0);
      return {
        ...a,
        colaborador_id: col?.id ?? suggestion.colaborador_id ?? null,
        nome: col ? colaboradorDisplayName(col) : suggestion.nome,
        tipo: nextTipo,
        fee: fee ? String(fee) : "",
        fee_auto: true,
      };
    }));
  };

  const updateArtistTipo = (i: number, tipo: string) => {
    setArtists(prev => prev.map((a, idx) => {
      if (idx !== i) return a;
      const col = findColaboradorById(a.colaborador_id) || findColaboradorByNome(a.nome);
      const fee = col ? suggestedFeeForArtist(col, tipo) : suggestedFeeForTipo(tipo);
      return { ...a, tipo, fee: fee ? String(fee) : "", fee_auto: true };
    }));
  };
  const updateArtistFee = (i: number, value: string) =>
    setArtists(prev => prev.map((a, idx) => idx === i ? { ...a, fee: value, fee_auto: false } : a));

  const applyResidenciaAtiva = (id: number | null) => {
    const r = id ? residenciasAtivas.find(x => x.id === id) : undefined;
    const nextTipo = r ? (form.tipo_comercial === "Evento de Residência" ? "Evento de Residência" : "Residência") : form.tipo_comercial;
    const nextContext = r ? (nextTipo === "Evento de Residência" ? "Evento Residência" : "Residência") : form.valor_contexto;
    setForm(f => ({
      ...f,
      autobudget_snapshot: "",
      residencia_id: id,
      tipo_comercial: nextTipo,
      valor_contexto: nextContext,
      servico_comercial: r?.servico || f.servico_comercial,
      local: r?.local || f.local,
      cliente_nome: r?.cliente_nome || f.cliente_nome,
      cliente_id: r?.cliente_id ?? f.cliente_id,
      value: r ? String(nextTipo === "Evento de Residência" ? (r.valor_evento || r.valor_cliente || 0) : (r.valor_cliente || 0)) : f.value,
    }));
    if (r?.cliente_nome) setClienteSearch(r.cliente_nome);
    repriceAutoArtists(nextTipo, nextContext, id);
  };

  const validArtistsPayload = () => artists.filter(a => a.nome.trim()).map(a => ({
    colaborador_id: a.colaborador_id ?? findColaboradorByNome(a.nome)?.id ?? null,
    nome: a.nome.trim(),
    tipo: a.tipo,
    fee: parseFloat(a.fee) || 0,
  }));

  const resetClienteState = () => {
    setClienteSearch("");
    setClienteDropOpen(false);
    setClienteCreating(false);
  };

  const openCreate = () => {
    loadLookups();
    setBudgetOpen(false);
    setForm({ ...emptyForm, event_date: new Date().toISOString().split("T")[0] });
    setArtists([emptyArtist()]);
    setSelectedPackIds([]);
    resetClienteState();
    setModal({ open: true, editing: null });
  };

  const openEdit = (l: Lead) => {
    loadLookups();
    setBudgetOpen(false);
    setForm({
      title: l.title, event_date: l.event_date, value: String(l.value || 0), valor_recebido: String(l.valor_recebido || 0),
      status: l.status || "Contacto", local: l.local || "", contacto: l.contacto || "",
      notas: l.notas || "", cliente_nome: l.cliente_nome || "",
      cliente_id: l.cliente_id ?? null, modalidade: l.modalidade || "Fatura",
      tipo_comercial: l.tipo_comercial || "Evento",
      servico_comercial: l.servico_comercial || "",
      valor_contexto: l.valor_contexto || inferValorContexto(l.cliente_nome || "", l.tipo_comercial || "Evento"),
      residencia_id: l.residencia_id ?? null,
      autobudget_snapshot: l.autobudget_snapshot || "",
    });
    setClienteSearch(l.cliente_nome || "");
    setClienteDropOpen(false);
    setClienteCreating(false);
    setSelectedPackIds([]);
    const agendaId = l.agenda_event_id ?? null;
    const cached = ((agendaId ? artistasMap[agendaId] : []) || artistasMap[-l.id] || []).map(normalizeArtistRow);
    setArtists(cached.length > 0 ? cached : [emptyArtist()]);
    setLoadingArtists(cached.length === 0);
    setModal({ open: true, editing: l });
    if (cached.length > 0) return;
    (async () => {
      let loaded: ArtistRow[] = [];
      if (agendaId) {
        const res = await getArtistasEvento(agendaId);
        if (res.success && res.data.length > 0) loaded = res.data.map(normalizeArtistRow);
      }
      if (loaded.length === 0) {
        const res = await getArtistasEvento(-l.id);
        if (res.success && res.data.length > 0) loaded = res.data.map(normalizeArtistRow);
      }
      setArtists(loaded.length > 0 ? loaded : [emptyArtist()]);
      setLoadingArtists(false);
    })();
  };

  const closeModal = () => {
    setModal({ open: false, editing: null });
    setBudgetOpen(false);
    resetClienteState();
  };

  const AGENDA_AUTO_STATUSES = ["Confirmado", "Em Adjudicação", "Adjudicado", "Faturado", "Pago"];

  const handleSave = async () => {
    if (!form.title.trim()) { showToast("Título obrigatório"); return; }
    setSaving(true);
    const data = {
      title: form.title.trim(), event_date: form.event_date,
      value: parseFloat(form.value) || 0, valor_recebido: parseFloat(form.valor_recebido) || 0, status: form.status,
      cliente_id: form.cliente_id ?? null,
      cliente_nome: form.cliente_nome, modalidade: form.modalidade,
      tipo_comercial: form.tipo_comercial,
      servico_comercial: form.servico_comercial,
      valor_contexto: form.valor_contexto,
      local: form.local || "",
      contacto: form.contacto || "", notas: form.notas || "",
      residencia_id: form.residencia_id,
      autobudget_snapshot: form.autobudget_snapshot || "",
    };
    const validArtists = validArtistsPayload();
    const getAutoPackIds = async () => {
      const selectedServices = parseServicosContratados(form.servico_comercial);
      const servicesForPacks = selectedServices.length > 0 ? selectedServices : [form.servico_comercial || form.title];
      const autoIds: number[] = [];
      for (const service of servicesForPacks.filter(Boolean)) {
        const auto = await getMaterialPackIdsForServico(service, form.valor_contexto || "Normal");
        if (auto.success) autoIds.push(...((auto.data || []) as number[]));
      }
      return Array.from(new Set([...(selectedPackIds || []), ...autoIds]));
    };
    if (modal.editing) {
      const previousStatus = modal.editing.status || "";
      const saveResult = await updateLead(modal.editing.id, data);
      if (!saveResult.success) {
        showToast("Erro ao guardar: " + (saveResult.message || "erro desconhecido"));
        setSaving(false);
        return;
      }
      // Save artistas linked to this lead (stored as lead id, will be synced)
      await syncArtistasEvento(modal.editing.id * -1, form.title.trim(), form.event_date, validArtists);
      await syncMaterialPacksLead(modal.editing.id, await getAutoPackIds());
      // Sync artistas para o evento de agenda ligado (se existir)
      await syncArtistasParaAgenda(modal.editing.id, form.title.trim(), form.event_date, validArtists);
      // Auto-importar para Agenda se passou para estado confirmado/avançado
      const isNowAdvanced = AGENDA_AUTO_STATUSES.includes(form.status);
      const wasAlreadyAdvanced = AGENDA_AUTO_STATUSES.includes(previousStatus);
      if (isNowAdvanced && !wasAlreadyAdvanced) {
        const agendaRes = await createAgendaEvent({
          title: form.title.trim(),
          date: form.event_date,
          time: "",
          tipo: "Evento",
          venue: form.local || "",
          bill: parseFloat(form.value) || 0,
          valor_recebido: parseFloat(form.valor_recebido) || 0,
          billing_status: form.status,
          cliente_id: form.cliente_id ?? null,
          cliente_nome: form.cliente_nome,
          modalidade: form.modalidade,
          tipo_comercial: form.tipo_comercial,
          servico_comercial: form.servico_comercial,
          valor_contexto: form.valor_contexto,
          autobudget_snapshot: form.autobudget_snapshot || "",
          origem_lead_id: modal.editing.id,
          contacto: form.contacto || "",
          notas: form.notas || "",
          residencia_id: form.residencia_id,
        });
        if (agendaRes.success && agendaRes.id) {
          await syncArtistasEvento(agendaRes.id, form.title.trim(), form.event_date, validArtists);
          await syncPacksComerciaisMateriaisEvento(agendaRes.id, parseServicosContratados(form.servico_comercial), userName);
          await reservarMaterialPacksDaLeadParaEvento(modal.editing.id, agendaRes.id, form.title.trim(), "Lead");
        }
        showToast("Lead actualizada · Evento criado na Agenda");
      } else {
        showToast("Lead actualizada");
      }
    } else {
      const res = await createLead(data);
      if (res.success && res.id) {
        await syncArtistasEvento(res.id * -1, form.title.trim(), form.event_date, validArtists);
        await syncMaterialPacksLead(res.id, await getAutoPackIds());
      }
      // Se criar directamente com estado avançado, também importa
      if (AGENDA_AUTO_STATUSES.includes(form.status)) {
        const agendaRes = await createAgendaEvent({
          title: form.title.trim(),
          date: form.event_date,
          time: "",
          tipo: "Evento",
          bill: parseFloat(form.value) || 0,
          valor_recebido: parseFloat(form.valor_recebido) || 0,
          billing_status: form.status,
          cliente_id: form.cliente_id ?? null,
          cliente_nome: form.cliente_nome,
          modalidade: form.modalidade,
          tipo_comercial: form.tipo_comercial,
          servico_comercial: form.servico_comercial,
          valor_contexto: form.valor_contexto,
          autobudget_snapshot: form.autobudget_snapshot || "",
          origem_lead_id: res.id ?? null,
          contacto: form.contacto || "",
          notas: form.notas || "",
          residencia_id: form.residencia_id,
        });
        if (agendaRes.success && agendaRes.id) {
          await syncArtistasEvento(agendaRes.id, form.title.trim(), form.event_date, validArtists);
          await syncPacksComerciaisMateriaisEvento(agendaRes.id, parseServicosContratados(form.servico_comercial), userName);
          if (res.id) await reservarMaterialPacksDaLeadParaEvento(res.id, agendaRes.id, form.title.trim(), "Lead");
        }
        showToast("Lead criada · Evento criado na Agenda");
      } else {
        showToast("Lead criada");
      }
    }
    setSaving(false);
    closeModal();
    load(selectedMonth);
  };

  const handleConvertToAgenda = async () => {
    if (!modal.editing) return;
    setConverting(true);
    const res = await createAgendaEvent({
      title: form.title.trim(),
      date: form.event_date,
      time: "",
      tipo: "Evento",
      bill: parseFloat(form.value) || 0,
      valor_recebido: parseFloat(form.valor_recebido) || 0,
      billing_status: "Contacto",
      cliente_id: form.cliente_id ?? null,
      cliente_nome: form.cliente_nome,
      modalidade: form.modalidade,
      tipo_comercial: form.tipo_comercial,
      servico_comercial: form.servico_comercial,
      valor_contexto: form.valor_contexto,
      autobudget_snapshot: form.autobudget_snapshot || "",
      venue: form.local || "",
      origem_lead_id: modal.editing.id,
      contacto: form.contacto || "",
      notas: form.notas || "",
      residencia_id: form.residencia_id,
    });
    setConverting(false);
    if (res.success) {
      if (res.id) {
        await syncPacksComerciaisMateriaisEvento(res.id, parseServicosContratados(form.servico_comercial), userName);
        const selectedServices = parseServicosContratados(form.servico_comercial);
        const servicesForPacks = selectedServices.length > 0 ? selectedServices : [form.servico_comercial || form.title];
        const autoIds: number[] = [];
        for (const service of servicesForPacks.filter(Boolean)) {
          const auto = await getMaterialPackIdsForServico(service, form.valor_contexto || "Normal");
          if (auto.success) autoIds.push(...((auto.data || []) as number[]));
        }
        await syncArtistasEvento(res.id, form.title.trim(), form.event_date, validArtistsPayload());
        await syncMaterialPacksLead(modal.editing.id, Array.from(new Set(autoIds)));
        await reservarMaterialPacksDaLeadParaEvento(modal.editing.id, res.id, form.title.trim(), "Lead");
      }
      showToast("Evento criado na Agenda");
      closeModal();
      load(selectedMonth);
    } else {
      showToast("Erro ao converter");
    }
  };

  const handleCancel = async (l: Lead) => {
    await cancelLead(l.id);
    showToast("Lead cancelada");
    load(selectedMonth);
  };

  const handleRestore = async (l: Lead) => {
    await restoreLead(l.id);
    showToast("Lead reposta");
    load(selectedMonth);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar esta lead definitivamente?")) return;
    await deleteLead(id);
    showToast("Lead eliminada");
    load(selectedMonth);
  };

  const filtered = leads.filter(l =>
    !search || l.title.toLowerCase().includes(search.toLowerCase()) || (l.status || "").toLowerCase().includes(search.toLowerCase())
  );

  // Histórico de artistas com tipos para autocomplete
  const artistHistory = Array.from(new Set(
    Object.values(artistasMap)
      .flat()
      .filter(a => a.nome?.trim() && a.tipo?.trim())
      .map(a => JSON.stringify({ nome: a.nome, tipo: a.tipo, colaborador_id: a.colaborador_id ?? null }))
  )).map(j => JSON.parse(j)).sort((a, b) => a.nome.localeCompare(b.nome));

  const normalizeConflictName = (name: string) => resolveColaboradorNome(name || '')
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  const artistsForLead = (l: Lead) => (l.agenda_event_id ? (artistasMap[l.agenda_event_id] || []) : (artistasMap[-l.id] || []));

  // Mantém a mesma lógica do módulo Pagamentos: o fee da Annia não é tratado como custo externo.
  const custoArtistasParaLucro = (rows: ArtistRow[]) => rows
    .filter(a => !normalizeText(resolveColaboradorNome(a.nome || "")).includes("annia"))
    .reduce((sum, a) => sum + (parseFloat(String(a.fee || 0)) || 0), 0);

  const lucroVisivel = (valor: number | string | undefined, rows: ArtistRow[], materialCost: number = 0) =>
    Number(valor || 0) - custoArtistasParaLucro(rows) - Number(materialCost || 0);

  const temMovimentoFinanceiro = (valor: number | string | undefined, rows: ArtistRow[], materialCost: number = 0) =>
    Number(valor || 0) !== 0 || custoArtistasParaLucro(rows) !== 0 || Number(materialCost || 0) !== 0;

  const conflictOverrideKeys = new Set(conflictOverrides.map(o => `${o.event_date}|${o.artist_key}`));
  const conflictItems = [
    ...agendaEvents.filter(e => !e.cancelled).map(e => ({ key: `event-${e.id}`, entityKey: e.event_id || `agenda-${e.id}`, date: toIsoDate(e.event_date), title: e.title || "Evento", artists: artistasMap[e.id] || [] })),
    ...leads.filter(l => !l.cancelled).map(l => ({ key: `lead-${l.id}`, entityKey: l.event_id || `lead-${l.id}`, date: toIsoDate(l.event_date), title: l.title || "Lead", artists: artistsForLead(l) })),
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
    const result = new Map<string, { artist: string; date: string; others: string[] }[]>();
    for (const [key, group] of groups.entries()) {
      const uniqueEntities = Array.from(new Set(group.items.map(i => i.entityKey)));
      if (uniqueEntities.length < 2) continue;
      const [date] = key.split('|');
      for (const item of group.items) {
        const others = group.items.filter(i => i.entityKey !== item.entityKey).map(i => i.title);
        if (!result.has(item.key)) result.set(item.key, []);
        result.get(item.key)!.push({ artist: group.artist, date, others: Array.from(new Set(others)) });
      }
    }
    return result;
  })();
  const conflictsForLead = (l: Lead) => conflictMap.get(`lead-${l.id}`) || [];
  const handleDismissConflict = async (date: string, artist: string) => {
    await dismissArtistConflict({ event_date: date, artist_name: artist, note: "Dá para fazer ambos", dismissed_by: userName });
    showToast("Alerta retirado para esse artista nesse dia");
    await load(selectedMonth);
  };
  const ConflictAlert = ({ conflicts }: { conflicts: { artist: string; date: string; others: string[] }[] }) => conflicts.length === 0 ? null : (
    <div style={{ marginTop: "5px", display: "flex", flexDirection: "column", gap: "4px" }}>
      {conflicts.map(c => (
        <div key={`${c.date}-${c.artist}`} style={{ background: "rgba(226,75,74,0.10)", border: "1px solid rgba(226,75,74,0.35)", color: C.red, padding: "5px 7px", fontSize: "11px", lineHeight: 1.35, fontWeight: 700 }}>
          🚨🚨 {c.artist} também está em {c.others.join(" / ")} 🚨🚨
          <button onClick={(ev) => { ev.stopPropagation(); handleDismissConflict(c.date, c.artist); }} style={{ marginLeft: "8px", background: "transparent", border: "none", color: C.red, textDecoration: "underline", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>retirar alerta</button>
        </div>
      ))}
    </div>
  );

  const grouped: Record<string, Lead[]> = {};
  filtered.forEach(l => {
    const ym = monthKey(l.event_date) || "sem-data";
    if (!grouped[ym]) grouped[ym] = [];
    grouped[ym].push(l);
  });
  const sortedMonths = Object.keys(grouped).sort((a, b) => {
    if (a === "sem-data") return 1;
    if (b === "sem-data") return -1;
    return a.localeCompare(b);
  });
  const monthTabs = (availableMonths.length ? availableMonths : [selectedMonth]).filter(Boolean).sort();

  const toggleMonth = (ym: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(ym)) next.delete(ym); else next.add(ym);
      return next;
    });
  };

  const monthLabel = (ym: string) => {
    if (ym === "sem-data") return "Sem data";
    const [y, m] = ym.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  };

  const statusColor = (s?: string) => {
    if (!s) return C.textMuted;
    const sl = s.toLowerCase();
    if (sl === "pago") return C.green;
    if (sl === "confirmado") return "#85C88A";
    if (sl === "adjudicado") return C.gold;
    if (sl === "em adjudicação") return C.gold;
    if (sl === "faturado") return C.purple;
    if (sl === "cancelado" || sl === "perdido") return C.red;
    if (sl === "em negociação" || sl === "negociação") return C.amber;
    if (sl === "proposta enviada") return C.blue;
    if (sl === "contacto") return C.textSec;
    return C.textSec;
  };


  // ── WhatsApp: abrir modal de seleção de meses ─────────────────────────────
  const openWaMonthModal = () => {
    setSelectedWaMonths(new Set());
    setWaMonthError(false);
    setWaMonthModal(true);
  };

  const availableWaMonths = (): string[] => {
    const todayYM = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthSet = new Set<string>();
    leads.forEach(l => {
      if (l.cancelled || l.status === "Cancelado") return;
      if (l.event_date && l.event_date.length >= 7) {
        const ym = l.event_date.slice(0, 7);
        if (ym >= todayYM) monthSet.add(ym); // só meses presentes e futuros
      }
    });
    return Array.from(monthSet).sort();
  };

  const waStatusEmoji = (status: string) => {
    const s = (status || "").toLowerCase();
    if (["confirmado", "adjudicado", "faturado", "pago"].includes(s)) return "🟢";
    if (s === "cancelado") return "🔴";
    return "🟡";
  };

  const buildWaTextForMonths = (months: string[]): string => {
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const blocks: string[] = [];
    [...months].sort().forEach(ym => {
      const monthLeads = leads
        .filter(l => !l.cancelled && l.status !== "Cancelado" && l.event_date?.startsWith(ym) && (l.event_date || "") >= todayStr)
        .sort((a, b) => (a.event_date || "").localeCompare(b.event_date || ""));
      if (monthLeads.length === 0) return;
      const [year, month] = ym.split("-");
      const mName = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-PT", { month: "long" });
      blocks.push(`*Leads de ${mName.charAt(0).toUpperCase() + mName.slice(1)}*`);
      monthLeads.forEach(l => {
        const lines: string[] = [];
        // Linha de data e título
        const dd = (l.event_date || "").slice(8, 10);
        const mm = (l.event_date || "").slice(5, 7);
        const dateStr = dd && mm ? `${dd}/${mm}` : "";
        const titleParts = [l.title, l.local].filter(v => v && v !== "undefined" && v !== "null");
        lines.push(`${dateStr}${dateStr ? " — " : ""}${titleParts.join(" · ")}`);
        // Cliente/Origem
        if (l.cliente_nome && l.cliente_nome !== "undefined") {
          lines.push(`Cliente/Origem: ${displayClienteNome(l, clientes)}`);
        } else if (l.contacto && l.contacto !== "undefined") {
          lines.push(`Origem: ${l.contacto}`);
        }
        // Estado
        if (l.status && l.status !== "undefined") {
          lines.push(`Estado: ${waStatusEmoji(l.status)} ${l.status}`);
        }
        // Valor
        const val = Number(l.value);
        if (!isNaN(val) && val > 0) {
          lines.push(`Valor: ${val.toLocaleString("pt-PT")}€`);
        }
        blocks.push(lines.filter(Boolean).join("\n"));
      });
    });
    return blocks.join("\n\n");
  };

  const handleCopySelectedMonths = () => {
    if (selectedWaMonths.size === 0) { setWaMonthError(true); return; }
    const text = buildWaTextForMonths(Array.from(selectedWaMonths));
    setWaText(text);
    setWaCopied(false);
    setWaMonthModal(false);
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

  // Deduplicated client list for dropdown
  const clientesUnicos = clientes.filter((c, i, arr) => arr.findIndex(x => x.nome === c.nome) === i);

  const statusColors: Record<string,string> = {
    "Contacto": "var(--theme-text-muted)", "Proposta Enviada": C.blue,
    "Em Negociação": C.amber, "Confirmado": C.green,
    "Em Adjudicação": C.gold, "Adjudicado": C.gold,
    "Faturado": "#A78BFA", "Pago": C.green, "Cancelado": C.red,
  };

  return (
    <>
    {/* ═══ DESKTOP ═══ */}
    {!modal.open && (
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: C.pageBg, color: C.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <DesktopNav userName={userName} active="leads" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/"); }} />

      <main style={{ padding: "2.75rem 3.25rem", maxWidth: "1500px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "11px", letterSpacing: "0.4em", color: C.textSec, textTransform: "uppercase", fontWeight: 600 }}>
            Pipeline de Leads
            {leads.length > 0 && <span style={{ color: C.textMuted, marginLeft: "0.75rem" }}>({leads.length} total)</span>}
          </p>
          <div style={{ display: "flex", gap: "0.95rem", alignItems: "center" }}>
            <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
            <button
              onClick={openWaMonthModal}
              style={{ background: "transparent", border: "1px solid rgba(93,202,165,0.2)", color: "var(--theme-success)", fontSize: "10px", letterSpacing: "0.3em", padding: "0.5rem 1.1rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}
            >
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
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" }} />
          <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.borderDim}`, overflowX: "auto" }}>
            {monthTabs.map(ym => (
              <button key={ym} onClick={() => setSelectedMonth(ym)} style={{ background: selectedMonth === ym ? "rgba(var(--theme-accent-rgb),0.08)" : "transparent", border: "none", borderRight: `1px solid ${C.borderDim}`, borderBottom: selectedMonth === ym ? `1px solid ${C.gold}` : "none", color: selectedMonth === ym ? C.gold : C.textMuted, fontSize: "10px", letterSpacing: "0.3em", padding: "0.75rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize", fontWeight: selectedMonth === ym ? 700 : 400, whiteSpace: "nowrap" }}>
                {monthLabel(ym)}
              </button>
            ))}
          </div>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar lead ou estado..."
            style={{ width: "100%", background: "var(--theme-subtle-bg)", border: "none", borderBottom: `1px solid ${C.borderDim}`, color: C.textPrimary, fontFamily: "inherit", fontSize: "13px", padding: "1rem 1.5rem", letterSpacing: "0.05em", outline: "none" }}
          />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Data Evento", "Lead / Projecto", "Local", "Cliente", "Estado", "Valor", "Ações"].map((h, i) => (
                    <th key={h} style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.goldDim, fontWeight: 600, textTransform: "uppercase", padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.border}`, textAlign: i >= 5 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedMonths.map(ym => (
                  <React.Fragment key={ym}>
                    <tr onClick={() => toggleMonth(ym)} style={{ cursor: "pointer" }}>
                      <td colSpan={7} style={{ padding: "0.75rem 1.25rem", background: "rgba(var(--theme-accent-rgb),0.05)", borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: "10px", letterSpacing: "0.4em", color: C.gold, fontWeight: 700, textTransform: "capitalize" }}>{monthLabel(ym)}</span>
                        <span style={{ fontSize: "10px", color: C.textMuted, marginLeft: "0.75rem" }}>({grouped[ym].length})</span>
                        <span style={{ fontSize: "11px", color: C.goldDim, marginLeft: "0.5rem", opacity: 0.7 }}>{collapsedMonths.has(ym) ? "▸" : "▾"}</span>
                      </td>
                    </tr>
                    {!collapsedMonths.has(ym) && grouped[ym].map(l => (
                      <tr key={l.id} style={{ opacity: l.cancelled ? 0.45 : 1 }}>
                        <td style={tdStyle({ nowrap: true })}>{fmtDate(l.event_date)}</td>
                        <td style={tdStyle({ maxW: "260px" })}>
                          <span style={{ textDecoration: l.cancelled ? "line-through" : "none" }}>{l.title}</span>
                          {!!l.cancelled && <span style={{ fontSize: "10px", color: C.red, letterSpacing: "0.2em", marginLeft: "0.5rem" }}>[CANCELADO]</span>}
                          {l.notas && <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "2px", fontStyle: "italic" }}>"{l.notas}"</div>}
                        </td>
                        <td style={tdStyle({ muted: true, maxW: "130px" })}>{l.local || <span style={{ color: C.textMuted }}>—</span>}</td>
                        <td style={tdStyle({ muted: true, maxW: "180px" })}>{displayClienteNome(l, clientes) ? `👤 ${displayClienteNome(l, clientes)}` : "—"}</td>
                        <td style={tdStyle({})}>
                          <StatusBadge color={statusColor(l.status)} label={l.status || "Pendente"} />
                        </td>
                        <td style={{ ...tdStyle({ nowrap: true }), textAlign: "right", color: C.gold, fontWeight: 600, fontSize: "13px" }}>
                          {userRole === "limited_novalues" ? "—" : (temMovimentoFinanceiro(l.value, artistsForLead(l), l.material_cost || 0) ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
                              <span>{Number(l.value || 0).toLocaleString("pt-PT")}€</span>
                              {Number(l.value || 0) > 0 && <span style={{ fontSize: "10px", color: C.green, fontWeight: 600, whiteSpace: "nowrap" }}>
                                Pago {effectiveReceived(l.value, l.valor_recebido, l.status).toLocaleString("pt-PT")}€ · {paymentPercent(l.value, l.valor_recebido, l.status).toFixed(0)}%
                              </span>}
                              <span style={{ fontSize: "10px", color: lucroVisivel(l.value, artistsForLead(l), l.material_cost || 0) >= 0 ? C.green : C.red, fontWeight: 600 }}>
                                Lucro {lucroVisivel(l.value, artistsForLead(l), l.material_cost || 0).toLocaleString("pt-PT")}€
                              </span>
                            </div>
                          ) : "—")}
                        </td>
                        <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                          {userRole !== "limited_novalues" && (
                          <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                            <IconBtn title="Editar" onClick={() => openEdit(l)} icon="edit" />
                            {!l.cancelled
                              ? <IconBtn title="Cancelar" onClick={() => handleCancel(l)} icon="cancel" danger />
                              : <IconBtn title="Repor" onClick={() => handleRestore(l)} icon="restore" success />
                            }
                            <IconBtn title="Eliminar" onClick={() => handleDelete(l.id)} icon="delete" danger />
                          </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "3rem", fontSize: "13px", color: C.textMuted, letterSpacing: "0.2em" }}>Sem leads encontradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

    </div>)}{/* end desktop */}

    {/* ═══ MOBILE ═══ */}
    {!modal.open && (
    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: "var(--theme-text)", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.9rem 1.1rem", borderBottom:"1px solid rgba(var(--theme-contrast-rgb),0.05)", background:"var(--theme-nav-bg)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10, flexShrink:0 }}>
        <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:"1.2rem", letterSpacing:"0.35em", color:"var(--theme-accent)", fontWeight:300 }}>LLE</span>
        <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} style={{ fontSize: "12px", padding:"0.4rem 0.5rem" }} />
          <span style={{ fontSize: "10px", letterSpacing:"0.35em", color:"var(--theme-text-faint)", textTransform:"uppercase" }}>{userName}</span>
        </div>
      </div>

      {/* Month pills */}
      <div className="mob-months">
        {monthTabs.map(ym => (
          <button key={ym} onClick={() => setSelectedMonth(ym)} className={`mob-mpill${selectedMonth === ym ? " active" : ""}`}>
            {monthLabel(ym).split(" ")[0]}{grouped[ym] ? ` (${grouped[ym].length})` : ""}
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="mob-topbar">
        <div className="mob-search-wrap">
          <svg className="mob-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="15" y2="15"/></svg>
          <input className="mob-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar lead..." />
        </div>
        <div style={{ display: "flex", gap: "0.7rem" }}>
          
          <button
            onClick={openWaMonthModal}
            style={{ background: "rgba(93,202,165,0.08)", border: "1px solid rgba(93,202,165,0.2)", color: "var(--theme-success)", fontSize: "12px", padding: "0.5rem 0.7rem", cursor: "pointer" }}
            title="Copiar Leads para WhatsApp"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </button>
          {userRole !== "limited_novalues" && (
            <button className="mob-fab" onClick={openCreate}>
              <svg width="16" height="16" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
            </button>
          )}
        </div>
      </div>

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
              const sc = statusColors[l.status||""] || "var(--theme-text-subtle)";
              return (
                <div key={l.id} className={`mob-card${l.cancelled?" is-folga":""}`} onClick={() => userRole !== "limited_novalues" && openEdit(l)} style={{cursor: userRole !== "limited_novalues" ? "pointer" : "default"}}>
                  <div className="mob-date-bubble">
                    <div className="mob-date-day">{d.getDate()}</div>
                    <div className="mob-date-weekday">{d.toLocaleDateString("pt-PT",{weekday:"short"})}</div>
                  </div>
                  <div className="mob-card-body">
                    <div className={`mob-card-title${l.cancelled?" cancelled":""}`}>{l.title}</div>
                    <ConflictAlert conflicts={conflictsForLead(l)} />
                    {l.local && <div className="mob-card-meta" style={{color:"var(--theme-accent)"}}>📍 {l.local}</div>}
                    {l.cliente_nome && <div className="mob-card-meta">👤 {displayClienteNome(l, clientes)}</div>}
                    {l.notas && <div className="mob-card-meta" style={{fontStyle:"italic", marginTop:2}}>"{l.notas}"</div>}
                    <div className="mob-card-badges">
                      <span className="mob-badge" style={{background:`${sc}18`,color:sc}}>
                        <span className="mob-badge-dot" style={{background:sc}}/>
                        {l.status||"Pendente"}
                      </span>
                    </div>
                  </div>
                  <div className="mob-card-right">
                    {userRole !== "limited_novalues" && temMovimentoFinanceiro(l.value, artistsForLead(l), l.material_cost || 0)
                      ? <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"2px"}}>
                          <span className="mob-card-value">{Number(l.value || 0).toLocaleString("pt-PT")}€</span>
                          {Number(l.value || 0) > 0 && <span style={{fontSize: "10px",fontWeight:700,color:"var(--theme-success)",whiteSpace:"nowrap"}}>Pago {paymentPercent(l.value, l.valor_recebido, l.status).toFixed(0)}%</span>}
                          <span style={{fontSize: "10px",fontWeight:700,color:lucroVisivel(l.value, artistsForLead(l), l.material_cost || 0)>=0?"var(--theme-success)":"var(--theme-danger)",whiteSpace:"nowrap"}}>Lucro {lucroVisivel(l.value, artistsForLead(l), l.material_cost || 0).toLocaleString("pt-PT")}€</span>
                        </div>
                      : <span className="mob-card-value muted">—</span>
                    }
                    <svg className="mob-card-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 4 10 8 6 12"/></svg>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <MobTabBar active="leads" role={userRole} lightTheme={lightTheme} />
    </div>)}

    {/* ═══ MODAL (partilhado desktop+mobile) ═══ */}
      {/* WhatsApp — Modal de Seleção de Meses */}
      {waMonthModal && (
        <div onClick={e => e.target === e.currentTarget && setWaMonthModal(false)} style={{ position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "none" }}>
          <div style={{ background: "var(--theme-surface)", border: "1px solid rgba(var(--theme-accent-rgb),0.12)", padding: "2rem", width: "380px", maxWidth: "95vw", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <p style={{ fontSize: "10px", letterSpacing: "0.4em", color: "var(--theme-accent)", textTransform: "uppercase", fontWeight: 600 }}>Copiar Leads para WhatsApp</p>
              <button onClick={() => setWaMonthModal(false)} style={{ background: "transparent", border: "none", color: "var(--theme-text-subtle)", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>
            <p style={{ fontSize: "11px", color: "var(--theme-text-subtle)", letterSpacing: "0.15em", marginBottom: "1.25rem" }}>Seleciona os meses a incluir:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.25rem", maxHeight: "280px", overflowY: "auto" }}>
              {availableWaMonths().length === 0 && (
                <p style={{ fontSize: "13px", color: "var(--theme-text-subtle)", textAlign: "center", padding: "1.2rem" }}>Sem leads disponíveis.</p>
              )}
              {availableWaMonths().map(ym => {
                const [year, month] = ym.split("-");
                const mName = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
                const mCap = mName.charAt(0).toUpperCase() + mName.slice(1);
                const checked = selectedWaMonths.has(ym);
                const count = leads.filter(l => !l.cancelled && l.status !== "Cancelado" && l.event_date?.startsWith(ym)).length;
                return (
                  <label key={ym} style={{ display: "flex", alignItems: "center", gap: "0.95rem", cursor: "pointer", padding: "0.6rem 0.75rem", background: checked ? "rgba(var(--theme-accent-rgb),0.06)" : "transparent", border: `1px solid ${checked ? "rgba(var(--theme-accent-rgb),0.22)" : "rgba(var(--theme-contrast-rgb),0.05)"}`, transition: "all 0.15s" }}>
                    <input type="checkbox" checked={checked} onChange={() => {
                      setWaMonthError(false);
                      setSelectedWaMonths(prev => {
                        const next = new Set(prev);
                        if (next.has(ym)) next.delete(ym); else next.add(ym);
                        return next;
                      });
                    }} style={{ accentColor: "var(--theme-accent)", width: "14px", height: "14px", flexShrink: 0 }} />
                    <span style={{ fontSize: "13px", color: checked ? "var(--theme-text)" : "var(--theme-text-secondary)", letterSpacing: "0.04em", textTransform: "capitalize", flex: 1 }}>{mCap}</span>
                    <span style={{ fontSize: "11px", color: "var(--theme-text-faint)", letterSpacing: "0.1em" }}>{count} leads</span>
                  </label>
                );
              })}
            </div>
            {waMonthError && (
              <p style={{ fontSize: "11px", color: "var(--theme-danger)", letterSpacing: "0.2em", marginBottom: "0.85rem", textTransform: "uppercase" }}>Selecione pelo menos um mês.</p>
            )}
            <div style={{ display: "flex", gap: "0.95rem", justifyContent: "flex-end" }}>
              <button onClick={() => setWaMonthModal(false)} style={{ background: "transparent", border: "1px solid var(--theme-input-border)", color: "var(--theme-text-subtle)", fontSize: "11px", letterSpacing: "0.3em", padding: "0.6rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Cancelar</button>
              <button onClick={handleCopySelectedMonths} style={{ background: "var(--theme-success)", border: "none", color: "var(--theme-bg)", fontSize: "11px", letterSpacing: "0.3em", fontWeight: 700, padding: "0.6rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Copiar Leads Selecionadas</button>
            </div>
          </div>
        </div>
      )}

    {/* WhatsApp Modal — Pré-visualização */}
      {waModal && (
        <div onClick={e => e.target === e.currentTarget && setWaModal(false)} style={{ position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "none" }}>
          <div style={{ background: "var(--theme-surface)", border: "1px solid rgba(var(--theme-accent-rgb),0.12)", padding: "2rem", width: "500px", maxWidth: "95vw", maxHeight: "85vh", display: "flex", flexDirection: "column", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "10px", letterSpacing: "0.4em", color: "var(--theme-accent)", textTransform: "uppercase", fontWeight: 600 }}>Copiar Leads para WhatsApp</p>
              <button onClick={() => setWaModal(false)} style={{ background: "transparent", border: "none", color: "var(--theme-text-subtle)", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>
            {waCopied && (
              <div style={{ marginBottom: "0.75rem", fontSize: "11px", letterSpacing: "0.25em", color: "var(--theme-success)", textTransform: "uppercase" }}>✓ Leads copiadas. Pode colar no WhatsApp.</div>
            )}
            <textarea
              readOnly
              value={waText}
              style={{ flex: 1, minHeight: "300px", background: "var(--theme-subtle-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text)", fontFamily: "monospace", fontSize: "13px", padding: "0.75rem", outline: "none", resize: "vertical", letterSpacing: "0.02em", lineHeight: "1.6" }}
              onClick={e => (e.target as HTMLTextAreaElement).select()}
            />
            <div style={{ display: "flex", gap: "0.95rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button onClick={() => setWaModal(false)} style={{ background: "transparent", border: "1px solid var(--theme-input-border)", color: "var(--theme-text-subtle)", fontSize: "11px", letterSpacing: "0.3em", padding: "0.6rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>Fechar</button>
              <button
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(waText).then(() => setWaCopied(true));
                  } else {
                    const ta = document.createElement("textarea");
                    ta.value = waText; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); setWaCopied(true);
                  }
                }}
                style={{ background: "var(--theme-success)", border: "none", color: "var(--theme-bg)", fontSize: "11px", letterSpacing: "0.3em", fontWeight: 700, padding: "0.6rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}
              >Copiar novamente</button>
            </div>
          </div>
        </div>
      )}

      {modal.open && (
        <div onClick={e => e.target === e.currentTarget && closeModal()} style={overlayStyle}>
          <div style={modalStyle}>
            <div style={topLineStyle} />
            <p style={{ fontSize: "11px", letterSpacing: "0.4em", color: C.goldDim, textTransform: "uppercase", fontWeight: 600, marginBottom: "2rem" }}>
              {modal.editing ? "Editar Lead" : "Nova Lead"}
            </p>

            <datalist id="leads-servicos-vendidos-list">
              {SERVICOS_VENDIDOS.map(s => <option key={s} value={s} />)}
            </datalist>
            <FormField label="Nome do Projecto / Lead">
              <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nome do evento ou projecto..." />
            </FormField>

            {/* Cliente dropdown */}
            <FormField label="Cliente" style={{ position: "relative" }}>
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
                  <button type="button" onClick={() => setClienteCreating(false)} style={{ ...btnSecStyle, padding: "0.6rem 0.75rem" }}>✕</button>
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <input
                    style={inputStyle}
                    value={clienteSearch}
                    onChange={e => {
                      setClienteSearch(e.target.value);
                      setForm(f => ({ ...f, cliente_nome: e.target.value, cliente_id: null }));
                      setClienteDropOpen(true);
                    }}
                    onFocus={() => setClienteDropOpen(true)}
                    onBlur={() => setTimeout(() => setClienteDropOpen(false), 150)}
                    placeholder="Pesquisar cliente..."
                  />
                  {clienteDropOpen && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--theme-surface-elevated)", color: "var(--theme-text)", border: "1px solid var(--theme-input-border)", boxShadow: "var(--theme-dropdown-shadow)", zIndex: 1500, maxHeight: "200px", overflowY: "auto" }}>
                      {clientesUnicos
                        .filter(c => c.nome.toLowerCase().includes(clienteSearch.toLowerCase()))
                        .map(c => (
                          <div
                            key={c.id}
                            onMouseDown={() => {
                              const nextContext = inferValorContexto(c.nome, form.tipo_comercial);
                              setForm(f => ({ ...f, cliente_nome: c.nome, cliente_id: c.id, valor_contexto: nextContext }));
                              repriceAutoArtists(form.tipo_comercial, nextContext, form.residencia_id);
                              setClienteSearch(c.nome);
                              setClienteDropOpen(false);
                            }}
                            style={{ padding: "0.6rem 1rem", fontSize: "13px", color: "var(--theme-text-secondary)", cursor: "pointer", borderBottom: "1px solid var(--theme-border)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--theme-dropdown-hover)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >
                            {c.nome}
                            {c.nif && <span style={{ fontSize: "11px", color: C.textMuted, marginLeft: "8px" }}>{c.nif}</span>}
                          </div>
                        ))
                      }
                      <div
                        onMouseDown={() => { setClienteCreating(true); setClienteDropOpen(false); }}
                        style={{ padding: "0.6rem 1rem", fontSize: "12px", color: C.gold, cursor: "pointer", letterSpacing: "0.15em", borderTop: "1px solid rgba(var(--theme-accent-rgb),0.12)", display: "flex", alignItems: "center", gap: "6px" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--theme-dropdown-hover)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <span>+</span> Criar novo cliente
                      </div>
                    </div>
                  )}
                </div>
              )}
            </FormField>

            {/* Contexto operacional — sempre visível, independente do Auto Budget */}
            <FormField label="Contexto do Trabalho">
              <CustomSelect
                value={form.tipo_comercial}
                onChange={v => {
                  const nextContext = inferValorContexto(form.cliente_nome, v);
                  const nextResidenciaId = v === "Residência" || v === "Evento de Residência" ? form.residencia_id : null;
                  setForm(f => ({ ...f, tipo_comercial: v, valor_contexto: nextContext, residencia_id: nextResidenciaId, autobudget_snapshot: "" }));
                  repriceAutoArtists(v, nextContext, nextResidenciaId);
                }}
                options={TIPOS_COMERCIAIS.map(t => ({ value: t, label: t }))}
                style={inputStyle}
              />
              <p style={{ marginTop: "0.4rem", fontSize: "10px", color: C.textMuted, lineHeight: 1.45 }}>
                Define o custo que a LLE prevê pagar aos artistas. A faturação ao cliente é independente e fica no Auto Budget / Faturação.
              </p>
            </FormField>
            {(form.tipo_comercial === "Residência" || form.tipo_comercial === "Evento de Residência") && (
              <FormField label="Residência Ativa">
                <CustomSelect
                  value={form.residencia_id ? String(form.residencia_id) : ""}
                  onChange={v => applyResidenciaAtiva(v ? Number(v) : null)}
                  options={[
                    { value: "", label: "Sem residência específica — usar tabela do colaborador" },
                    ...residenciasAtivas.map(r => ({ value: String(r.id), label: `${r.nome}${r.cliente_nome ? ` · ${r.cliente_nome}` : ""}${r.local ? ` · ${r.local}` : ""}` }))
                  ]}
                  style={inputStyle}
                />
                <p style={{ marginTop: "0.4rem", fontSize: "10px", color: C.textMuted, lineHeight: 1.45 }}>
                  Se estiver definida, custo e faturação específicos desta residência têm prioridade quando aplicáveis; sem override usa Colaboradores.
                </p>
              </FormField>
            )}

            <div style={{ gridColumn: "1 / -1", marginBottom: "1.25rem" }}>
              <button
                type="button"
                onClick={() => setBudgetOpen(v => !v)}
                style={{
                  width: "100%", minHeight: "48px", padding: "0 1rem",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
                  background: budgetOpen ? "rgba(var(--theme-accent-rgb),0.055)" : "rgba(var(--theme-contrast-rgb),0.015)",
                  border: `1px solid ${budgetOpen ? "rgba(var(--theme-accent-rgb),0.22)" : "var(--theme-input-border)"}`,
                  color: budgetOpen ? C.gold : C.textMuted,
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}
              >
                <span>
                  <b style={{ display: "block", fontSize: "11px", letterSpacing: "0.28em", textTransform: "uppercase" }}>Auto Budget</b>
                  <small style={{ display: "block", marginTop: "4px", fontSize: "10px", letterSpacing: "0.06em", color: C.textMuted }}>Serviços · perfil de valor · cálculo automático</small>
                </span>
                <span style={{ fontSize: "14px" }}>{budgetOpen ? "−" : "+"}</span>
              </button>

              {budgetOpen && (
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1.5rem",
                  padding: "1.2rem", border: "1px solid rgba(var(--theme-accent-rgb),0.14)", borderTop: "none",
                  background: "rgba(var(--theme-accent-rgb),0.018)",
                }}>
                  <FormField label="Serviços Contratados" style={{ gridColumn: "1 / -1" }}>
                    <ServiceMultiSelect
                      value={form.servico_comercial}
                      onChange={v => setForm(f => ({ ...f, servico_comercial: v, autobudget_snapshot: "" }))}
                      standaloneOptions={autoBudgetStandaloneOptions}
                      packOptions={autoBudgetPackOptions}
                      placeholder="DJ + Bailarino(a) + Produtor..."
                    />
                  </FormField>
                  <FormField label="Perfil de Valor">
                    <CustomSelect
                      value={form.valor_contexto}
                      onChange={v => {
                        setForm(f => ({ ...f, valor_contexto: v, autobudget_snapshot: "" }));
                        repriceAutoArtists(form.tipo_comercial, v, form.residencia_id);
                      }}
                      options={VALOR_CONTEXTOS.map(c => ({ value: c, label: c }))}
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Sugestão" style={{ gridColumn: "1 / -1" }}>
                    <button type="button" onClick={aplicarValorSugerido} style={{ ...btnSecStyle, width: "100%" }}>
                      Calcular faturação dos serviços selecionados
                    </button>
                  </FormField>
                  {valorMasterSuggestion(form.servico_comercial || form.title, form.valor_contexto) && (() => {
                    const suggestion = valorMasterSuggestion(form.servico_comercial || form.title, form.valor_contexto)!;
                    return (
                      <div style={{ gridColumn: "1 / -1", fontSize: "12px", color: C.textMuted, letterSpacing: "0.05em", marginTop: "-0.5rem", marginBottom: "0.2rem", lineHeight: 1.6 }}>
                        Faturação sugerida: <b style={{ color: C.gold }}>{suggestion.valor || 0}€</b> · Custo estimado LLE: {suggestion.custo || 0}€ · {form.valor_contexto || "Cliente Final"}
                        {suggestion.total > 1 && <span> · {suggestion.encontrados}/{suggestion.total} serviços com valor automático</span>}
                        {suggestion.items.length > 0 && (
                          <div style={{ marginTop: "7px", paddingTop: "7px", borderTop: "1px solid var(--theme-border)", display: "grid", gap: "4px" }}>
                            {suggestion.items.map(item => (
                              <div key={item.servico} style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "baseline" }}>
                                <span style={{ color: C.textSec }}>
                                  {item.servico}{item.quantidade > 1 ? ` ×${item.quantidade}` : ""}
                                  <small style={{ display: "block", color: C.textMuted, fontSize: "10px", letterSpacing: "0.03em" }}>
                                    Faturação: {item.sourceName || ("noActiveProvider" in item && item.noActiveProvider ? "sem colaborador ativo / preço por definir" : "sem referência")}
                                    {item.costSourceName ? ` · Custo: ${item.costSourceName}` : ""}
                                    {item.skill && item.assignedCount !== null ? ` · Atribuídos: ${item.assignedCount}/${item.quantidade}` : ""}
                                  </small>
                                </span>
                                <b style={{ color: C.textPrimary, whiteSpace: "nowrap" }}>{item.valorTotal}€</b>
                              </div>
                            ))}
                          </div>
                        )}
                        {suggestion.semValor.length > 0 && <div style={{ marginTop: "5px", color: "var(--theme-warning)" }}>Sem valor automático: {suggestion.semValor.join(" · ")}</div>}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <FormField label="Data do Evento">
              <input style={inputStyle} type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
            </FormField>
            {userRole !== "limited_novalues" && (
            <FormField label="Faturação estimada (€)">
              <input style={inputStyle} type="number" value={form.value} onFocus={e => e.currentTarget.select()} onChange={e => setForm(f => ({ ...f, value: e.target.value, valor_recebido: f.status === "Pago" ? e.target.value : f.valor_recebido, autobudget_snapshot: "" }))} />
            </FormField>
            )}
            {userRole !== "limited_novalues" && (
            <FormField label="Valor pago até agora (€)">
              <div>
                <input style={inputStyle} type="number" min="0" value={form.valor_recebido} onFocus={e => e.currentTarget.select()} onChange={e => setForm(f => ({ ...f, valor_recebido: e.target.value }))} />
                <div style={{ marginTop: "6px", fontSize: "11px", color: C.textMuted, display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                  <span>{paymentPercent(form.value, form.valor_recebido, form.status).toFixed(0)}% pago</span>
                  <span>{Math.max(0, Number(form.value || 0) - effectiveReceived(form.value, form.valor_recebido, form.status)).toLocaleString("pt-PT")}€ por receber</span>
                </div>
                <div style={{ height: "4px", background: "rgba(var(--theme-contrast-rgb),0.08)", marginTop: "6px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${paymentPercent(form.value, form.valor_recebido, form.status)}%`, background: "var(--theme-success)", transition: "width .2s ease" }} />
                </div>
              </div>
            </FormField>
            )}
            <FormField label="Estado">
              <CustomSelect
                value={form.status}
                onChange={v => setForm(f => ({ ...f, status: v, valor_recebido: v === "Pago" ? String(Number(f.value || 0)) : f.valor_recebido }))}
                options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))}
                style={inputStyle}
              />
            </FormField>
            <FormField label="Modalidade de Pagamento">
              <CustomSelect
                value={form.modalidade}
                onChange={v => setForm(f => ({ ...f, modalidade: v }))}
                options={MODALIDADES.map(m => ({ value: m, label: m }))}
                style={inputStyle}
              />
            </FormField>
            <FormField label="Local">
              <input style={inputStyle} value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} placeholder="SUD, Hyatt, Epic Sana..." />
            </FormField>
            <FormField label="Contacto">
              <input style={inputStyle} value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} placeholder="Nome ou telefone..." />
            </FormField>
            <FormField label="Materiais / Notas">
              <input style={inputStyle} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Ex: dual mic, 2 colunas... / observações" />
            </FormField>



            {/* ── Artistas & Pagamentos ── */}
            <div style={{ marginTop: "1.75rem", borderTop: `1px solid ${C.borderDim}`, paddingTop: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.textMuted, textTransform: "uppercase", fontWeight: 600 }}>Artistas & Pagamentos</span>
                {artists.filter(a => a.nome.trim()).reduce((s, a) => s + (parseFloat(a.fee) || 0), 0) > 0 && (
                  <span style={{ fontSize: "11px", color: C.amber, letterSpacing: "0.15em", fontWeight: 600 }}>
                    Total: {artists.filter(a => a.nome.trim()).reduce((s, a) => s + (parseFloat(a.fee) || 0), 0).toLocaleString("pt-PT")}€
                  </span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 90px 32px", gap: "4px", marginBottom: "6px" }}>
                {["Nome", "Tipo", "Custo (€)", ""].map(h => (
                  <span key={h} style={{ fontSize: "9px", letterSpacing: "0.3em", color: C.textMuted, textTransform: "uppercase", fontWeight: 600, padding: "0 4px" }}>{h}</span>
                ))}
              </div>
              <datalist id="leads-colaboradores-list">
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
                        nome_pessoal: c.nome_pessoal,
                        skills: c.skills,
                      }))}
                      placeholder="Escolher colaborador..."
                      inputStyle={{ ...inputStyle, padding: "0.5rem 0.75rem", fontSize: "13px" }}
                    />
                  </div>
                  <CustomSelect
                    value={a.tipo}
                    onChange={v => updateArtistTipo(i, v)}
                    options={[
                      { value: "", label: "Escolher skill..." },
                      ...[...ARTIST_TIPOS]
                        .sort((a, b) => a.localeCompare(b, "pt-PT", { sensitivity: "base" }))
                        .map(t => ({ value: t, label: t })),
                    ]}
                    placeholder="Escolher skill..."
                    style={{ ...inputStyle, padding: "0.5rem 0.5rem", fontSize: "12px" }}
                  />
                  <div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={a.fee}
                      onChange={e => updateArtistFee(i, e.target.value)}
                      onFocus={e => { if (e.target.value === "0") updateArtistFee(i, ""); }}
                      onBlur={e => { if (e.target.value === "") updateArtistFee(i, "0"); }}
                      placeholder="0"
                      style={{ ...inputStyle, padding: "0.5rem 0.75rem", fontSize: "13px" }}
                    />
                    {a.nome && a.tipo && (
                      <small style={{ display: "block", marginTop: "3px", color: C.textMuted, fontSize: "9px", lineHeight: 1.3 }}>
                        {a.fee_auto !== false
                          ? artistCostSuggestion(findColaboradorById(a.colaborador_id) || findColaboradorByNome(a.nome), a.tipo).source
                          : "Custo guardado / editável"}
                      </small>
                    )}
                  </div>
                  <button
                    onClick={() => removeArtistRow(setArtists, i)}
                    style={{ background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" fill="none" strokeWidth="2"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
                  </button>
                </div>
              ))}
              <button onClick={() => addArtistRow(setArtists)} style={{ ...btnSecStyle, fontSize: "10px", padding: "0.4rem 0.9rem", marginTop: "6px", display: "flex", alignItems: "center", gap: "5px" }}>
                <svg width="8" height="8" viewBox="0 0 10 10" stroke="currentColor" fill="none" strokeWidth="2.5"><line x1="5" y1="1" x2="5" y2="9" /><line x1="1" y1="5" x2="9" y2="5" /></svg>
                Adicionar artista
              </button>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button onClick={closeModal} style={btnSecStyle}>Fechar</button>
              {modal.editing && !modal.editing.cancelled && (
                <>
                  <button onClick={async () => { await cancelLead(modal.editing!.id); showToast("Lead cancelada"); closeModal(); load(selectedMonth); }} style={btnDangerStyle}>Cancelar Lead</button>
                  <button onClick={handleConvertToAgenda} disabled={converting} style={btnAgendaStyle}>
                    {converting ? "A converter..." : "→ Agenda"}
                  </button>
                </>
              )}
              <button onClick={handleSave} disabled={saving} style={btnPrimStyle}>{saving ? "A guardar..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

    {/* Toast (partilhado desktop+mobile) */}
    <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: "var(--theme-toast-bg)", border: `1px solid ${C.border}`, color: C.gold, fontSize: "12px", letterSpacing: "0.25em", padding: "1rem 1.5rem", zIndex: 2000, transform: toast ? "translateX(0)" : "translateX(200%)", transition: "transform 0.3s ease", textTransform: "uppercase", fontWeight: 600 }}>
      {toast}
    </div>
    </>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function Nav({ userName, active, onLogout }: { userName: string; active: string; onLogout: () => void }) {
  const stored = typeof window !== "undefined" ? localStorage.getItem("lle_user") : null;
  const role = stored ? JSON.parse(stored).role : "admin";
  const allLinks = [{ href: "/dashboard", label: "Dashboard" }, { href: "/agenda", label: "Agenda" }, { href: "/leads", label: "Leads" }, { href: "/faturacao", label: "Faturação" }, { href: "/pagamentos", label: "Pagamentos" }, { href: "/colaboradores", label: "Colaboradores" }, { href: "/valores", label: "Valores" }, { href: "/packs", label: "Packs" }, { href: "/residencias", label: "Residências" }];
  const restrictedHrefs = ["/dashboard", "/faturacao", "/pagamentos", "/colaboradores", "/valores", "/packs", "/residencias", "/clientes"];
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
            <a key={l.href} href={l.href} style={{ fontSize: "11px", letterSpacing: "0.3em", padding: "0.5rem 1rem", textTransform: "uppercase", fontWeight: 500, color: active === l.href.slice(1) ? "var(--theme-accent)" : "var(--theme-text-muted)", textDecoration: "none", fontFamily: "'Montserrat','Helvetica Neue',sans-serif" }}>{l.label}</a>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontSize: "11px", letterSpacing: "0.3em", color: "var(--theme-text-faint)", textTransform: "uppercase" }}>{userName}</span>
        <button onClick={onLogout} style={{ background: "transparent", border: "1px solid rgba(var(--theme-accent-rgb),0.12)", color: "var(--theme-text-faint)", fontSize: "10px", letterSpacing: "0.4em", padding: "0.5rem 1rem", cursor: "pointer", textTransform: "uppercase", fontFamily: "inherit", fontWeight: 600 }}>SAIR</button>
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

function StatusBadge({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", letterSpacing: "0.2em", padding: "3px 8px", fontWeight: 600, textTransform: "uppercase", background: `${color}18`, color }}>
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
  const color = danger ? "var(--theme-danger)" : success ? "var(--theme-success)" : "var(--theme-text-subtle)";
  return (
    <button title={title} onClick={onClick} style={{ background: "transparent", border: "none", cursor: "pointer", padding: "5px", color, transition: "color 0.15s" }}>
      {icons[icon]}
    </button>
  );
}

function FormField({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: "1.25rem", ...style }}>
      <label style={{ display: "block", fontSize: "9px", letterSpacing: "0.4em", color: "var(--theme-text-faint)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.6rem" }}>{label}</label>
      {children}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const addBtnStyle: React.CSSProperties = { background: "transparent", border: "1px solid rgba(var(--theme-accent-rgb),0.12)", color: "var(--theme-accent-muted)", fontSize: "10px", letterSpacing: "0.35em", padding: "0.5rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s" };
const tdStyle = ({ muted, nowrap, maxW }: { muted?: boolean; nowrap?: boolean; maxW?: string }): React.CSSProperties => ({ fontSize: "14px", color: muted ? "var(--theme-text-muted)" : "var(--theme-text)", padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--theme-border)", whiteSpace: nowrap ? "nowrap" : undefined, maxWidth: maxW, overflow: maxW ? "hidden" : undefined, textOverflow: maxW ? "ellipsis" : undefined });
const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "none" };
const modalStyle: React.CSSProperties = { background: "var(--theme-surface)", border: "1px solid rgba(var(--theme-accent-rgb),0.12)", padding: "2.5rem", width: "520px", maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto", position: "relative" };
const topLineStyle: React.CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" };
const inputStyle: React.CSSProperties = { width: "100%", background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text)", fontFamily: "'Montserrat','Helvetica Neue',sans-serif", fontSize: "13px", padding: "0.75rem 1rem", letterSpacing: "0.05em", outline: "none", boxSizing: "border-box" };
const btnPrimStyle: React.CSSProperties = { background: "var(--theme-accent)", border: "none", color: "var(--theme-accent-contrast)", fontSize: "11px", letterSpacing: "0.4em", fontWeight: 700, padding: "0.75rem 1.75rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };
const btnSecStyle: React.CSSProperties = { background: "transparent", border: "1px solid rgba(var(--theme-accent-rgb),0.12)", color: "var(--theme-text-subtle)", fontSize: "11px", letterSpacing: "0.4em", fontWeight: 600, padding: "0.75rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };
const btnDangerStyle: React.CSSProperties = { background: "transparent", border: "1px solid rgba(226,75,74,0.3)", color: "var(--theme-danger)", fontSize: "10px", letterSpacing: "0.3em", fontWeight: 600, padding: "0.75rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };
const btnAgendaStyle: React.CSSProperties = { background: "transparent", border: "1px solid rgba(93,202,165,0.3)", color: "var(--theme-success)", fontSize: "10px", letterSpacing: "0.3em", fontWeight: 600, padding: "0.75rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };

