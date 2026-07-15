"use client";

import MobTabBar from "../MobTabBar";

import { useTheme } from "../useTheme";
import { ThemeSwitcher } from "../ThemeSwitcher";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  createMaterial, updateMaterial, updateMaterialCompraStatus, toggleMaterialAtivo,
  registarSaidaMaterial, registarVoltaMaterial, deleteMovimentoMaterial,
  updateMaterialPackValues, getMateriaisInitialBundle, getMateriaisTabData, getMateriaisSaidaLookups, getMaterialById,
  confirmarSaidaReservaEvento,
} from "../actions";

interface Material {
  id: number; nome: string; categoria: string; imagem: string;
  quantidade_total: number; dono: string; local_habitual: string; consumivel: number;
  stock_minimo: number; precisa_comprar: number; motivo_compra: string; quantidade_comprar: number; notas_compra: string;
  duracao_formato: string; custo_interno: number; valor_parceiro: number; valor_sud: number; valor_cliente_final: number;
  notas: string; ativo: number;
}

interface MaterialPack {
  id: number; nome: string; descricao: string; duracao_formato: string;
  custo_interno: number; valor_parceiro: number; valor_sud: number; valor_cliente_final: number; valor_referencia: number; ativo: number;
  items: { id: number; material_nome: string; quantidade: number; categoria: string; notas: string }[];
}

interface Movimento {
  id: number; material_id: number; material_nome: string; material_imagem: string;
  quantidade: number; quantidade_devolvida: number; quantidade_consumida: number;
  origem: string; origem_detalhe: string; dono_material: string; quem_levou: string;
  evento: string; evento_id: number | null; responsavel: string; notas: string;
  estado_regresso: string; precisa_comprar: number; motivo_compra: string; quantidade_comprar: number;
  quem_confirmou_regresso: string; notas_regresso: string;
  data_saida: string; data_volta: string | null;
}

interface EventoOpcao { id: number; title: string; date: string; }

interface ReservaMaterial {
  reserva_id: number;
  reserva_source: "manual" | "legacy" | "pack";
  evento_id: number;
  evento_nome: string;
  evento_data: string;
  pack_nome: string;
  reservado_por: string;
  material_id: number;
  material_nome: string;
  material_imagem: string;
  quantidade: number;
  local_habitual: string;
  dono_material: string;
}

interface MateriaisStats {
  activeMaterials: number;
  totalUnits: number;
  openRecords: number;
  openUnits: number;
  reservedUnits: number;
  historyCount: number;
  catalogCount: number;
  valuesCount: number;
}

const PESSOAL = "Pessoal";
const SEL_PESSOAL = "pessoal";

const C = {
  gold: "var(--theme-accent)", goldDim: "var(--theme-accent-muted)", surface: "var(--theme-surface)", pageBg: "var(--theme-bg)",
  border: "rgba(var(--theme-accent-rgb),0.12)", borderDim: "rgba(var(--theme-contrast-rgb),0.05)",
  textPrimary: "var(--theme-text)", textSec: "var(--theme-text-muted)", textMuted: "var(--theme-text-faint)",
  green: "var(--theme-success)", amber: "var(--theme-warning)", blue: "var(--theme-info)", red: "var(--theme-danger)",
};

const C_Light = {
  gold: "#8B4513", goldDim: "#6F3A18", surface: "#FFFFFF", pageBg: "#FFFBF7",
  border: "rgba(0,0,0,0.15)", borderDim: "rgba(0,0,0,0.12)",
  textPrimary: "#111827", textSec: "rgba(17,24,39,0.82)", textMuted: "rgba(17,24,39,0.62)",
  green: "#2E7D32", amber: "#A65300", blue: "#1565C0", red: "#C62828", purple: "#6A1B9A",
};

const getColors = (lightTheme: boolean) => lightTheme ? C_Light : C;


const CATEGORIAS = ["Som", "Luz", "DJ / Cabine", "Microfones", "Estrutura", "Decoração", "Roupa", "Outro"];
const ORIGENS = ["Loja", "João", "Annia", "Tânia", "Fornecedor", "Outro"];

const emptyMaterialForm = { nome: "", categoria: "", imagem: "", quantidade_total: 1, dono: "LLE", local_habitual: "Loja", consumivel: 0, stock_minimo: 0, precisa_comprar: 0, motivo_compra: "", quantidade_comprar: 0, notas_compra: "", duracao_formato: "", custo_interno: 0, valor_parceiro: 0, valor_sud: 0, valor_cliente_final: 0, notas: "" };
const emptySaidaForm = { material_id: 0, quantidade: 1, origem: "Loja", origem_detalhe: "", quem_levou: "", evento_sel: SEL_PESSOAL, evento: "", evento_id: null as number | null, notas: "" };

function fmtDateTime(s: string) {
  if (!s) return "—";
  const d = new Date(s.replace(" ", "T") + (s.includes("Z") ? "" : "Z"));
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" }) + " · " +
    d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function diasFora(dataSaida: string) {
  const d = new Date(dataSaida.replace(" ", "T") + (dataSaida.includes("Z") ? "" : "Z"));
  if (isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 480;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("sem contexto canvas")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => reject(new Error("erro ao carregar imagem"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("erro ao ler ficheiro"));
    reader.readAsDataURL(file);
  });
}

function origemLabel(m: Movimento) {
  return m.origem === "Outro" && m.origem_detalhe ? m.origem_detalhe : m.origem;
}

function pendenteMovimento(m: Movimento) {
  return Math.max(0, m.quantidade - (m.quantidade_devolvida || 0) - (m.quantidade_consumida || 0));
}

function fmtDateShort(s: string) {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

// Agrupa movimentos por evento (ligado à agenda), texto legado, ou "Pessoal"
function agruparPorEvento(movs: Movimento[], eventos: EventoOpcao[]) {
  const eventosMap = new Map(eventos.map(e => [e.id, e]));
  const groups = new Map<string, { key: string; label: string; date: string; isPessoal: boolean; items: Movimento[] }>();
  for (const mov of movs) {
    let key: string, label: string, date = "";
    if (mov.evento_id) {
      const ev = eventosMap.get(mov.evento_id);
      key = `ev-${mov.evento_id}`;
      label = ev?.title || mov.evento || `Evento #${mov.evento_id}`;
      date = ev?.date || "";
    } else if (mov.evento && mov.evento.trim() && mov.evento.trim() !== PESSOAL) {
      key = `legacy-${mov.evento.trim().toLowerCase()}`;
      label = mov.evento.trim();
    } else {
      key = "pessoal";
      label = PESSOAL;
    }
    if (!groups.has(key)) groups.set(key, { key, label, date, isPessoal: key === "pessoal", items: [] });
    groups.get(key)!.items.push(mov);
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (a.isPessoal !== b.isPessoal) return a.isPessoal ? 1 : -1;
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date !== b.date) return a.date ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

function agruparReservasPorEvento(reservas: ReservaMaterial[]) {
  const groups = new Map<number, { key: string; label: string; date: string; items: ReservaMaterial[] }>();
  for (const reserva of reservas) {
    const current = groups.get(reserva.evento_id) || {
      key: `reserva-${reserva.evento_id}`,
      label: reserva.evento_nome || `Evento #${reserva.evento_id}`,
      date: reserva.evento_data || "",
      items: [],
    };
    current.items.push(reserva);
    groups.set(reserva.evento_id, current);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date !== b.date) return a.date ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export default function MateriaisPage() {
  const { lightTheme, setLightTheme, mounted } = useTheme();
  const C = getColors(lightTheme);
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("admin");
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [movimentosFechados, setMovimentosFechados] = useState<Movimento[]>([]);
  const [reservas, setReservas] = useState<ReservaMaterial[]>([]);
  const [eventos, setEventos] = useState<EventoOpcao[]>([]);
  const [packs, setPacks] = useState<MaterialPack[]>([]);
  const [stats, setStats] = useState<MateriaisStats>({
    activeMaterials: 0, totalUnits: 0, openRecords: 0, openUnits: 0,
    reservedUnits: 0, historyCount: 0, catalogCount: 0, valuesCount: 0,
  });
  const [loadedTabs, setLoadedTabs] = useState({ fora: true, historico: false, catalogo: false, valores: false });
  const [tabLoading, setTabLoading] = useState(false);
  const [saidaLookupsLoaded, setSaidaLookupsLoaded] = useState(false);
  const [packDrafts, setPackDrafts] = useState<Record<number, { duracao_formato: string; custo_interno: string; valor_parceiro: string; valor_sud: string; valor_cliente_final: string }>>({});
  const [packSavingId, setPackSavingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileView, setMobileView] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"fora" | "historico" | "catalogo" | "valores">("fora");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  const [saidaModal, setSaidaModal] = useState(false);
  const [saidaForm, setSaidaForm] = useState(emptySaidaForm);
  const [saidaReserva, setSaidaReserva] = useState<ReservaMaterial | null>(null);

  const [materialModal, setMaterialModal] = useState<{ open: boolean; editing: Material | null }>({ open: false, editing: null });
  const [materialForm, setMaterialForm] = useState(emptyMaterialForm);
  const [imgUploading, setImgUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [voltaQty, setVoltaQty] = useState<Record<number, number>>({});
  const [voltaModal, setVoltaModal] = useState<{ open: boolean; movimento: Movimento | null }>({ open: false, movimento: null });
  const [voltaForm, setVoltaForm] = useState({ quantidade_devolvida: 1, quantidade_consumida: 0, estado_regresso: "OK", precisa_comprar: 0, motivo_compra: "", quantidade_comprar: 0, notas_regresso: "" });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const applyPacks = useCallback((data: MaterialPack[]) => {
    setPacks(data);
    setPackDrafts(Object.fromEntries(data.map(pack => [pack.id, {
      duracao_formato: pack.duracao_formato || "",
      custo_interno: String(pack.custo_interno || ""),
      valor_parceiro: String(pack.valor_parceiro || ""),
      valor_sud: String(pack.valor_sud || ""),
      valor_cliente_final: String(pack.valor_cliente_final || pack.valor_referencia || ""),
    }])));
  }, []);

  const loadInitial = useCallback(async (showFullLoader = true) => {
    if (showFullLoader) setLoading(true);
    const bundle = await getMateriaisInitialBundle();
    if (bundle.success) {
      setMovimentos((bundle.movimentos || []) as Movimento[]);
      setReservas((bundle.reservas || []) as ReservaMaterial[]);
      setStats(bundle.stats as MateriaisStats);
    }
    setLoading(false);
  }, []);

  const loadTabData = useCallback(async (target: "historico" | "catalogo" | "valores", force = false) => {
    if (!force && loadedTabs[target]) return;
    setTabLoading(true);
    const result = await getMateriaisTabData(target);
    if (result.success) {
      if (target === "historico") {
        const history = (result.movimentos || []) as Movimento[];
        setMovimentosFechados(history);
        setStats(prev => ({ ...prev, historyCount: Number(result.historyCount) || history.length }));
      }
      if (target === "catalogo") {
        const catalog = (result.materiais || []) as Material[];
        setMateriais(catalog);
        setStats(prev => ({ ...prev, catalogCount: catalog.filter(item => item.ativo === 1).length }));
      }
      if (target === "valores") {
        const valueMaterials = (result.materiais || []) as Material[];
        const valuePacks = (result.packs || []) as MaterialPack[];
        setMateriais(valueMaterials);
        applyPacks(valuePacks);
        setStats(prev => ({ ...prev, valuesCount: valueMaterials.length + valuePacks.length }));
      }
      setLoadedTabs(prev => ({ ...prev, [target]: true }));
    } else {
      showToast("Não foi possível carregar esta área");
    }
    setTabLoading(false);
  }, [applyPacks, loadedTabs]);

  const handleTabChange = async (target: "fora" | "historico" | "catalogo" | "valores") => {
    setTab(target);
    if (target !== "fora") await loadTabData(target);
  };

  const refreshAfterMovement = async () => {
    await loadInitial(false);
    if (tab === "historico" && loadedTabs.historico) await loadTabData("historico", true);
  };

  const refreshAfterMaterial = async () => {
    await loadInitial(false);
    if (loadedTabs.catalogo) await loadTabData("catalogo", true);
    if (loadedTabs.valores) await loadTabData("valores", true);
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
    if (["limited_novalues", "finance"].includes(parsed.role || "")) { router.push("/agenda"); return; }
    setUserName(parsed.name);
    setUserRole(parsed.role || "admin");
    loadInitial();
  }, [loadInitial, router]);

  const materiaisAtivos = materiais.filter(m => m.ativo === 1);
  const movimentosAbertos = movimentos;
  const foraAgrupados = agruparPorEvento(movimentosAbertos, eventos);
  const reservasAgrupadas = agruparReservasPorEvento(reservas);
  const totalUnidades = stats.totalUnits;
  const totalFora = stats.openUnits;

  function pendenteAtualDoMaterial(materialId: number) {
    return movimentosAbertos
      .filter(m => m.material_id === materialId)
      .reduce((s, m) => s + pendenteMovimento(m), 0);
  }

  // ── Saída ──────────────────────────────────────────────────────────────
  const ensureSaidaLookups = async () => {
    if (saidaLookupsLoaded) return { materiais: materiaisAtivos, eventos };
    const result = await getMateriaisSaidaLookups();
    const alreadyHaveMaterials = loadedTabs.catalogo || loadedTabs.valores;
    const lookupMateriais = alreadyHaveMaterials ? materiaisAtivos : (result.success ? ((result.materiais || []) as Material[]) : materiaisAtivos);
    const lookupEventos = result.success ? ((result.eventos || []) as EventoOpcao[]) : eventos;
    if (result.success) {
      if (!alreadyHaveMaterials) setMateriais(lookupMateriais);
      setEventos(lookupEventos);
      setSaidaLookupsLoaded(true);
    }
    return { materiais: lookupMateriais, eventos: lookupEventos };
  };

  const openSaida = async (materialId?: number, reserva?: ReservaMaterial) => {
    const lookups = await ensureSaidaLookups();
    const selected = lookups.materiais.find(m => m.id === (reserva?.material_id || materialId))
      || lookups.materiais.find(m => reserva && m.nome.trim().toLowerCase() === reserva.material_nome.trim().toLowerCase())
      || lookups.materiais[0];
    if (!selected) { showToast("Sem materiais disponíveis"); return; }

    const local = reserva?.local_habitual || selected.local_habitual || "Loja";
    const origemConhecida = ORIGENS.includes(local);
    setSaidaReserva(reserva || null);
    setSaidaForm({
      ...emptySaidaForm,
      material_id: selected.id,
      quantidade: reserva?.quantidade || 1,
      origem: origemConhecida ? local : "Outro",
      origem_detalhe: origemConhecida ? "" : local,
      quem_levou: userName,
      evento_sel: reserva ? String(reserva.evento_id) : SEL_PESSOAL,
      evento: reserva?.evento_nome || "",
      evento_id: reserva?.evento_id ?? null,
      notas: reserva ? `Saída de material reservado${reserva.pack_nome ? ` · ${reserva.pack_nome}` : ""}` : "",
    });
    setSaidaModal(true);
  };
  const closeSaida = () => { setSaidaModal(false); setSaidaReserva(null); };

  const handleRegistarSaida = async () => {
    const mat = materiais.find(m => m.id === saidaForm.material_id);
    if (!mat) { showToast("Escolhe um material"); return; }
    if (saidaForm.quantidade < 1) { showToast("Quantidade inválida"); return; }
    if (saidaForm.origem === "Outro" && !saidaForm.origem_detalhe.trim()) { showToast("Especifica de onde saiu"); return; }
    const isPessoal = saidaForm.evento_sel === SEL_PESSOAL;
    const eventoSelecionado = isPessoal ? null : eventos.find(e => String(e.id) === saidaForm.evento_sel) || null;
    setSaving(true);
    if (saidaReserva && (saidaReserva.reserva_source === "manual" || saidaReserva.reserva_source === "legacy")) {
      await confirmarSaidaReservaEvento({
        id: saidaReserva.reserva_id,
        source: saidaReserva.reserva_source,
        quantidade: saidaForm.quantidade,
        origem: saidaForm.origem,
        origem_detalhe: saidaForm.origem_detalhe,
        quem_levou: saidaForm.quem_levou || userName,
        responsavel: userName,
        notas: saidaForm.notas,
      });
    } else {
      await registarSaidaMaterial({
        material_id: mat.id, material_nome: mat.nome, material_imagem: mat.imagem,
        quantidade: saidaForm.quantidade, origem: saidaForm.origem, origem_detalhe: saidaForm.origem_detalhe,
        dono_material: mat.dono || "LLE", quem_levou: saidaForm.quem_levou || userName,
        evento: isPessoal ? PESSOAL : (eventoSelecionado?.title || saidaForm.evento || ""),
        evento_id: isPessoal ? null : (eventoSelecionado?.id ?? saidaForm.evento_id ?? null),
        responsavel: userName, notas: saidaForm.notas,
      });
    }
    showToast(`Saída registada: ${mat.nome}`);
    closeSaida();
    await refreshAfterMovement();
    setSaving(false);
  };

  // ── Volta ──────────────────────────────────────────────────────────────
  const openVolta = (mov: Movimento, quantidade?: number) => {
    const pendente = pendenteMovimento(mov);
    const qtd = Math.max(0, Math.min(pendente, quantidade ?? pendente));
    setVoltaForm({
      quantidade_devolvida: qtd,
      quantidade_consumida: 0,
      estado_regresso: "OK",
      precisa_comprar: 0,
      motivo_compra: "",
      quantidade_comprar: 0,
      notas_regresso: "",
    });
    setVoltaModal({ open: true, movimento: mov });
  };
  const closeVolta = () => setVoltaModal({ open: false, movimento: null });

  const handleGuardarVolta = async () => {
    const mov = voltaModal.movimento;
    if (!mov) return;
    const pendente = pendenteMovimento(mov);
    const qtdVoltou = Math.max(0, Math.min(pendente, Number(voltaForm.quantidade_devolvida) || 0));
    const maxConsumivel = Math.max(0, pendente - qtdVoltou);
    const qtdConsumida = Math.max(0, Math.min(maxConsumivel, Number(voltaForm.quantidade_consumida) || 0));
    const novaDevolvida = Math.min(mov.quantidade, (mov.quantidade_devolvida || 0) + qtdVoltou);
    const novaConsumida = Math.min(mov.quantidade, (mov.quantidade_consumida || 0) + qtdConsumida);
    await registarVoltaMaterial(mov.id, novaDevolvida, mov.quantidade, {
      quantidade_consumida: novaConsumida,
      estado_regresso: voltaForm.estado_regresso,
      precisa_comprar: voltaForm.precisa_comprar,
      motivo_compra: voltaForm.motivo_compra,
      quantidade_comprar: voltaForm.quantidade_comprar,
      quem_confirmou_regresso: userName,
      notas_regresso: voltaForm.notas_regresso,
    });
    showToast(pendenteMovimento({ ...mov, quantidade_devolvida: novaDevolvida, quantidade_consumida: novaConsumida }) <= 0 ? `${mov.material_nome} fechado` : `Regresso parcial registado`);
    closeVolta();
    await refreshAfterMovement();
  };

  const handleDeleteMovimento = async (id: number) => {
    if (!confirm("Apagar este registo de movimento?")) return;
    await deleteMovimentoMaterial(id);
    showToast("Movimento apagado");
    await refreshAfterMovement();
  };

  // ── Catálogo ───────────────────────────────────────────────────────────
  const openCreateMaterial = () => { setMaterialForm(emptyMaterialForm); setMaterialModal({ open: true, editing: null }); };
  const openEditMaterial = async (m: Material) => {
    let full = m;
    if (!loadedTabs.catalogo) {
      const result = await getMaterialById(m.id);
      if (result.success && result.data) full = result.data as Material;
    }
    setMaterialForm({ nome: full.nome, categoria: full.categoria, imagem: full.imagem, quantidade_total: full.quantidade_total, dono: full.dono || "LLE", local_habitual: full.local_habitual || "Loja", consumivel: full.consumivel || 0, stock_minimo: full.stock_minimo || 0, precisa_comprar: full.precisa_comprar || 0, motivo_compra: full.motivo_compra || "", quantidade_comprar: full.quantidade_comprar || 0, notas_compra: full.notas_compra || "", duracao_formato: full.duracao_formato || "", custo_interno: full.custo_interno || 0, valor_parceiro: full.valor_parceiro || 0, valor_sud: full.valor_sud || 0, valor_cliente_final: full.valor_cliente_final || 0, notas: full.notas });
    setMaterialModal({ open: true, editing: full });
  };
  const closeMaterialModal = () => setMaterialModal({ open: false, editing: null });

  const handleImageUpload = async (file: File) => {
    setImgUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setMaterialForm(f => ({ ...f, imagem: dataUrl }));
    } catch {
      showToast("Erro ao processar imagem");
    }
    setImgUploading(false);
  };

  const handleSaveMaterial = async () => {
    if (!materialForm.nome.trim()) { showToast("Nome é obrigatório"); return; }
    setSaving(true);
    if (materialModal.editing) {
      await updateMaterial(materialModal.editing.id, materialForm);
      showToast("Material atualizado");
    } else {
      await createMaterial(materialForm);
      showToast("Material criado");
    }
    closeMaterialModal();
    await refreshAfterMaterial();
    setSaving(false);
  };

  const handleToggleMaterialAtivo = async (m: Material) => {
    const novo = m.ativo === 1 ? 0 : 1;
    await toggleMaterialAtivo(m.id, novo);
    showToast(novo === 1 ? "Material reativado" : "Material arquivado");
    await refreshAfterMaterial();
  };

  const handleToggleCompraMaterial = async (m: Material) => {
    const novo = m.precisa_comprar === 1 ? 0 : 1;
    await updateMaterialCompraStatus(m.id, {
      precisa_comprar: novo,
      motivo_compra: novo ? (m.motivo_compra || "precisa de mais") : "",
      quantidade_comprar: novo ? (m.quantidade_comprar || Math.max(1, m.stock_minimo || 1)) : 0,
      notas_compra: novo ? m.notas_compra : "",
    });
    showToast(novo ? "Marcado para comprar" : "Compra resolvida");
    await refreshAfterMaterial();
  };

  const updatePackDraft = (id: number, field: string, value: string) => setPackDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  const toPrice = (value: string) => Number(String(value || "").replace(",", ".")) || 0;
  const savePackValues = async (pack: MaterialPack) => {
    const draft = packDrafts[pack.id];
    if (!draft) return;
    setPackSavingId(pack.id);
    const result = await updateMaterialPackValues(pack.id, {
      duracao_formato: draft.duracao_formato, custo_interno: toPrice(draft.custo_interno), valor_parceiro: toPrice(draft.valor_parceiro),
      valor_sud: toPrice(draft.valor_sud), valor_cliente_final: toPrice(draft.valor_cliente_final),
    });
    showToast(result.success ? "Valores do pack atualizados" : "Erro ao atualizar valores");
    await loadTabData("valores", true);
    setPackSavingId(null);
  };

  // ── Styles ─────────────────────────────────────────────────────────────
  const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" };
  const overlayBottomStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "var(--theme-overlay)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(4px)" };
  const modalStyle: React.CSSProperties = { background: "var(--theme-surface)", border: `1px solid ${C.border}`, padding: "2.5rem", width: "480px", maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", position: "relative" };
  const modalMobStyle: React.CSSProperties = { background: "var(--theme-surface)", borderTop: `1px solid ${C.border}`, width: "100%", maxHeight: "92dvh", overflowY: "auto", padding: "1.5rem 1.25rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))", borderRadius: "12px 12px 0 0", position: "relative" };
  const topLineStyle: React.CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, var(--theme-accent), transparent)" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "7px", letterSpacing: "0.4em", color: C.textMuted, textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" };
  const inputStyle: React.CSSProperties = { width: "100%", background: "var(--theme-input-bg)", border: `1px solid var(--theme-input-border)`, color: C.textPrimary, fontFamily: "'Montserrat',sans-serif", fontSize: "11px", padding: "0.75rem 1rem", letterSpacing: "0.05em", outline: "none", boxSizing: "border-box" };
  const btnPrimStyle: React.CSSProperties = { background: C.gold, border: "none", color: "var(--theme-accent-contrast)", fontSize: "9px", letterSpacing: "0.4em", fontWeight: 700, padding: "0.75rem 1.75rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };
  const btnSecStyle: React.CSSProperties = { background: "transparent", border: `1px solid ${C.border}`, color: C.textSec, fontSize: "9px", letterSpacing: "0.4em", fontWeight: 600, padding: "0.75rem 1.5rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" };

  if (loading || mobileView === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.pageBg }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "3rem", letterSpacing: "0.4em", color: C.gold, fontWeight: 300 }}>LLE</span>
      </div>
    );
  }

  const TabBtn = ({ id, label, count }: { id: "fora" | "historico" | "catalogo" | "valores"; label: string; count?: number }) => (
    <button onClick={() => void handleTabChange(id)} style={{
      background: tab === id ? "rgba(var(--theme-accent-rgb),0.1)" : "transparent",
      border: "none", borderBottom: tab === id ? `2px solid ${C.gold}` : "2px solid transparent",
      color: tab === id ? C.gold : C.textSec, fontSize: "9px", letterSpacing: "0.25em", fontWeight: 600,
      padding: "0.85rem 1.25rem", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase",
      display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
    }}>
      {label}{typeof count === "number" && <span style={{ background: tab === id ? "rgba(var(--theme-accent-rgb),0.2)" : "rgba(var(--theme-contrast-rgb),0.06)", color: tab === id ? C.gold : C.textMuted, fontSize: "9px", padding: "1px 6px", borderRadius: "8px" }}>{count}</span>}
    </button>
  );

  const MaterialThumb = ({ src, size = 44 }: { src: string; size?: number }) => (
    src
      ? <img src={src} alt="" style={{ width: size, height: size, objectFit: "cover", border: `1px solid ${C.border}`, flexShrink: 0   }} />
      : <div style={{ width: size, height: size, background: "var(--theme-input-bg)", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
        </div>
  );

  return (
    <>
    {/* ═══ DESKTOP ═══ */}
    {mobileView === false && (
    <div className="mob-page-desktop" style={{ minHeight: "100vh", background: C.pageBg, color: C.textPrimary, fontFamily: "'Montserrat','Helvetica Neue',sans-serif", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <Nav userName={userName} active="materiais" onLogout={() => { localStorage.removeItem("lle_user"); router.push("/");   }} />
      <main style={{ padding: "2rem 2.5rem", maxWidth: "1400px", margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.textSec, textTransform: "uppercase", fontWeight: 600 }}>Materiais</p>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} />
            <button onClick={openCreateMaterial} style={btnSecStyle}>+ Novo Material</button>
            <button onClick={() => openSaida()} style={btnPrimStyle}>+ Registar Saída</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {[
            { label: "Materiais ativos", value: stats.activeMaterials },
            { label: "Unidades totais", value: totalUnidades },
            { label: "Unidades fora", value: totalFora, color: totalFora > 0 ? C.amber : undefined },
            { label: "Reservadas", value: stats.reservedUnits, color: stats.reservedUnits > 0 ? C.blue : undefined },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "16px", fontWeight: 700, color: s.color || C.textPrimary }}>{s.value}</span>
              <span style={{ fontSize: "8px", letterSpacing: "0.2em", color: C.textMuted, textTransform: "uppercase" }}>{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", borderBottom: `1px solid ${C.borderDim}`, marginBottom: "1.5rem" }}>
          <TabBtn id="fora" label="Fora" count={movimentosAbertos.length} />
          <TabBtn id="historico" label="Histórico" count={loadedTabs.historico ? stats.historyCount : undefined} />
          <TabBtn id="catalogo" label="Catálogo" count={stats.catalogCount} />
          <TabBtn id="valores" label="Valores" count={loadedTabs.valores ? stats.valuesCount : undefined} />
        </div>

        {tabLoading && tab !== "fora" && (
          <div style={{ padding: "3rem", textAlign: "center", color: C.textMuted, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase" }}>A carregar apenas esta área...</div>
        )}

        {tab === "fora" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {foraAgrupados.map(group => (
              <div key={group.key} style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1.1rem", borderBottom: `1px solid ${C.borderDim}`, background: "rgba(var(--theme-accent-rgb),0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "9px", letterSpacing: "0.2em", fontWeight: 700, color: group.isPessoal ? C.textSec : C.gold, textTransform: "uppercase" }}>
                      {group.isPessoal ? "👤 Pessoal" : `🎪 ${group.label}`}
                    </span>
                    {group.date && <span style={{ fontSize: "9px", color: C.textMuted, letterSpacing: "0.1em" }}>{fmtDateShort(group.date)}</span>}
                  </div>
                  <span style={{ fontSize: "9px", color: C.textMuted, background: "rgba(var(--theme-contrast-rgb),0.05)", padding: "2px 8px", borderRadius: "8px" }}>{group.items.length} {group.items.length === 1 ? "item" : "itens"}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: "0.6rem", padding: "0.85rem" }}>
                  {group.items.map(mov => {
                    const pendente = pendenteMovimento(mov);
                    const dias = diasFora(mov.data_saida);
                    return (
                      <div key={mov.id} style={{ background: "rgba(var(--theme-contrast-rgb),0.02)", border: `1px solid ${C.borderDim}`, padding: "0.85rem", display: "flex", gap: "0.75rem" }}>
                        <MaterialThumb src={mov.material_imagem} size={48} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                            <span style={{ fontSize: "12px", fontWeight: 600 }}>{mov.material_nome}</span>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: C.amber, whiteSpace: "nowrap" }}>×{pendente}</span>
                          </div>
                          <div style={{ fontSize: "10px", color: C.textSec, marginTop: "2px" }}>
                            Com <span style={{ color: C.gold }}>{origemLabel(mov)}</span> · {dias === 0 ? "hoje" : dias === 1 ? "há 1 dia" : `há ${dias} dias`}
                          </div>
                          <div style={{ fontSize: "9px", color: C.textMuted, marginTop: "2px" }}>Saiu de {origemLabel(mov)} · Levou: {mov.quem_levou || mov.responsavel || "—"} · Dono: {mov.dono_material || "—"}</div>
                          <div style={{ fontSize: "9px", color: C.textMuted, marginTop: "2px" }}>Registo: {fmtDateTime(mov.data_saida)} · {mov.responsavel}</div>
                          <div style={{ display: "flex", gap: "6px", marginTop: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                            <button onClick={() => openVolta(mov)} style={{ background: "rgba(93,202,165,0.12)", border: "1px solid rgba(93,202,165,0.3)", color: C.green, fontSize: "9px", letterSpacing: "0.15em", padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, textTransform: "uppercase" }}>✓ Voltou{pendente > 1 ? " tudo" : ""}</button>
                            {pendente > 1 && (
                              <>
                                <input type="number" min={1} max={pendente} value={voltaQty[mov.id] ?? 1}
                                  onChange={e => setVoltaQty(v => ({ ...v, [mov.id]: Math.max(1, Math.min(pendente, Number(e.target.value) || 1)) }))}
                                  style={{ width: "44px", background: "rgba(var(--theme-contrast-rgb),0.05)", border: `1px solid ${C.border}`, color: C.textPrimary, fontSize: "10px", padding: "5px", textAlign: "center", outline: "none"   }} />
                                <button onClick={() => openVolta(mov, voltaQty[mov.id] ?? 1)} style={{ ...btnSecStyle, padding: "5px 10px", fontSize: "8px" }}>Parcial</button>
                              </>
                            )}
                            <button onClick={() => handleDeleteMovimento(mov.id)} title="Apagar registo" style={{ marginLeft: "auto", background: "transparent", border: "none", color: C.textMuted, cursor: "pointer", fontSize: "13px" }}>×</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {movimentosAbertos.length === 0 && <div style={{ textAlign: "center", padding: "1.6rem", fontSize: "11px", color: C.textMuted, letterSpacing: "0.16em", border: `1px solid ${C.borderDim}`, background: C.surface }}>Nada fora de momento — tudo continua no local</div>}

            {reservasAgrupadas.length > 0 && (
              <section style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                <div>
                  <div style={{ fontSize: "9px", letterSpacing: "0.28em", color: C.blue, textTransform: "uppercase", fontWeight: 700 }}>Reservado</div>
                  <div style={{ fontSize: "10px", color: C.textMuted, marginTop: "0.25rem" }}>Bloqueado para a data do evento, mas ainda não saiu do local habitual.</div>
                </div>
                {reservasAgrupadas.map(group => (
                  <div key={group.key} style={{ background: C.surface, border: `1px solid rgba(80,140,220,0.24)` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1.1rem", borderBottom: `1px solid ${C.borderDim}`, background: "rgba(80,140,220,0.06)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "9px", letterSpacing: "0.2em", fontWeight: 700, color: C.blue, textTransform: "uppercase" }}>📌 {group.label}</span>
                        {group.date && <span style={{ fontSize: "9px", color: C.textMuted }}>{fmtDateShort(group.date)}</span>}
                      </div>
                      <span style={{ fontSize: "9px", color: C.blue, background: "rgba(80,140,220,0.09)", padding: "2px 8px", borderRadius: "8px" }}>{group.items.reduce((sum, item) => sum + item.quantidade, 0)} un.</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "0.6rem", padding: "0.85rem" }}>
                      {group.items.map((reserva, index) => (
                        <div key={`${group.key}-${reserva.material_nome}-${index}`} style={{ background: "rgba(var(--theme-contrast-rgb),0.02)", border: `1px solid ${C.borderDim}`, padding: "0.85rem", display: "flex", gap: "0.75rem" }}>
                          <MaterialThumb src={reserva.material_imagem} size={44} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                              <span style={{ fontSize: "12px", fontWeight: 700 }}>{reserva.material_nome}</span>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: C.blue }}>×{reserva.quantidade}</span>
                            </div>
                            <div style={{ fontSize: "10px", color: C.textSec, marginTop: "3px" }}>Permanece em <span style={{ color: C.gold }}>{reserva.local_habitual || "local habitual"}</span></div>
                            <div style={{ fontSize: "9px", color: C.textMuted, marginTop: "2px" }}>{reserva.pack_nome || "Reserva de material"}{reserva.reservado_por ? ` · por ${reserva.reservado_por}` : ""}</div>
                            <button onClick={() => void openSaida(undefined, reserva)} style={{ ...btnSecStyle, marginTop: "0.6rem", padding: "6px 10px", fontSize: "8px", color: C.blue, borderColor: "rgba(80,140,220,0.3)" }}>Registar saída</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}

        {!tabLoading && tab === "historico" && (
          <div style={{ background: C.surface, border: `1px solid ${C.borderDim}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Material", "Qtd", "Foi para", "Saiu em", "Voltou em", "Ações"].map((h, i) => (
                    <th key={h} style={{ fontSize: "7px", letterSpacing: "0.3em", color: C.goldDim, fontWeight: 600, textTransform: "uppercase", padding: "0.75rem 1rem", borderBottom: `1px solid ${C.border}`, textAlign: i === 5 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movimentosFechados.map(mov => (
                  <tr key={mov.id}>
                    <td style={{ fontSize: "11px", padding: "0.7rem 1rem", borderBottom: `1px solid ${C.borderDim}`, display: "flex", alignItems: "center", gap: "8px" }}>
                      <MaterialThumb src={mov.material_imagem} size={28} />{mov.material_nome}
                    </td>
                    <td style={{ fontSize: "11px", color: C.textSec, padding: "0.7rem 1rem", borderBottom: `1px solid ${C.borderDim}` }}>
                      {mov.quantidade_devolvida > 0 && <span>{mov.quantidade_devolvida} voltou</span>}
                      {mov.quantidade_consumida > 0 && <span>{mov.quantidade_devolvida > 0 ? " · " : ""}{mov.quantidade_consumida} consumido</span>}
                      {!mov.quantidade_devolvida && !mov.quantidade_consumida && <span>{mov.quantidade}</span>}
                    </td>
                    <td style={{ fontSize: "11px", color: C.textSec, padding: "0.7rem 1rem", borderBottom: `1px solid ${C.borderDim}` }}>{origemLabel(mov)}</td>
                    <td style={{ fontSize: "10px", color: C.textMuted, padding: "0.7rem 1rem", borderBottom: `1px solid ${C.borderDim}`, whiteSpace: "nowrap" }}>{fmtDateTime(mov.data_saida)}</td>
                    <td style={{ fontSize: "10px", color: C.green, padding: "0.7rem 1rem", borderBottom: `1px solid ${C.borderDim}`, whiteSpace: "nowrap" }}>
                      {mov.data_volta ? fmtDateTime(mov.data_volta) : "—"}
                      {mov.estado_regresso && <div style={{ color: mov.estado_regresso === "OK" ? C.green : C.amber }}>{mov.estado_regresso}</div>}
                      {mov.precisa_comprar === 1 && <div style={{ color: C.red }}>Comprar ×{mov.quantidade_comprar || "?"}</div>}
                    </td>
                    <td style={{ padding: "0.7rem 1rem", borderBottom: `1px solid ${C.borderDim}`, textAlign: "right" }}>
                      <button onClick={() => handleDeleteMovimento(mov.id)} title="Apagar" style={{ background: "transparent", border: "1px solid rgba(var(--theme-contrast-rgb),0.06)", color: C.textMuted, padding: "4px 7px", cursor: "pointer" }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 4h10M6 4V2.5h4V4M4 4l.5 9.5A1 1 0 005.5 14.5h5A1 1 0 0011.5 13.5L12 4" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {movimentosFechados.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "3rem", fontSize: "11px", color: C.textMuted, letterSpacing: "0.2em" }}>Sem histórico ainda</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!tabLoading && tab === "catalogo" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "0.85rem" }}>
            {materiaisAtivos.map(m => {
              const fora = pendenteAtualDoMaterial(m.id);
              return (
                <div key={m.id} style={{ background: C.surface, border: `1px solid ${C.borderDim}`, overflow: "hidden" }}>
                  <div style={{ width: "100%", aspectRatio: "1.3/1", background: "var(--theme-subtle-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {m.imagem
                      ? <img src={m.imagem} alt={m.nome} style={{ width: "100%", height: "100%", objectFit: "cover"   }} />
                      : <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.4"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>}
                  </div>
                  <div style={{ padding: "0.85rem" }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "2px" }}>{m.nome}</div>
                    {m.categoria && <div style={{ fontSize: "9px", color: C.gold, letterSpacing: "0.1em", marginBottom: "4px" }}>{m.categoria}</div>}
                    <div style={{ fontSize: "10px", color: C.textSec }}>
                      Total: <b style={{ color: C.textPrimary }}>{m.quantidade_total}</b>
                      {fora > 0 && <span style={{ color: C.amber }}> · {fora} fora</span>}
                    </div>
                    <div style={{ fontSize: "9px", color: C.textMuted, marginTop: "3px" }}>Dono: {m.dono || "—"} · Local: {m.local_habitual || "—"}</div>
                    <div style={{ display: "flex", gap: "4px", marginTop: "0.45rem", flexWrap: "wrap" }}>
                      {m.consumivel === 1 && <span style={{ fontSize: "8px", color: C.amber, border: `1px solid ${C.border}`, padding: "2px 6px" }}>Consumível</span>}
                      {m.precisa_comprar === 1 && <span style={{ fontSize: "8px", color: C.red, border: "1px solid rgba(226,75,74,0.35)", padding: "2px 6px" }}>Comprar ×{m.quantidade_comprar || "?"}</span>}
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "0.6rem" }}>
                      <button onClick={() => openSaida(m.id)} style={{ ...btnSecStyle, flex: 1, padding: "6px 8px", fontSize: "8px" }}>Registar Saída</button>
                      <button onClick={() => handleToggleCompraMaterial(m)} title={m.precisa_comprar === 1 ? "Compra resolvida" : "Marcar para comprar"} style={{ background: "transparent", border: "1px solid rgba(var(--theme-contrast-rgb),0.06)", color: m.precisa_comprar === 1 ? C.green : C.amber, padding: "6px 8px", cursor: "pointer", fontSize: "10px" }}>
                        🛒
                      </button>
                      <button onClick={() => openEditMaterial(m)} title="Editar" style={{ background: "transparent", border: "1px solid rgba(var(--theme-contrast-rgb),0.06)", color: C.textMuted, padding: "6px 8px", cursor: "pointer" }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 2l3 3-9 9H2v-3L11 2z" /></svg>
                      </button>
                      <button onClick={() => handleToggleMaterialAtivo(m)} title="Arquivar" style={{ background: "transparent", border: "1px solid rgba(var(--theme-contrast-rgb),0.06)", color: C.red, padding: "6px 8px", cursor: "pointer" }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 4h10M6 4V2.5h4V4M4 4l.5 9.5A1 1 0 005.5 14.5h5A1 1 0 0011.5 13.5L12 4" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {materiaisAtivos.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "3rem", fontSize: "11px", color: C.textMuted, letterSpacing: "0.2em" }}>Sem material no catálogo — cria o primeiro</div>}
          </div>
        )}

        {!tabLoading && tab === "valores" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <section>
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "9px", letterSpacing: "0.3em", color: C.gold, textTransform: "uppercase", fontWeight: 700 }}>Packs e sistemas</div>
                <div style={{ fontSize: "10px", color: C.textMuted, marginTop: "0.3rem" }}>Som, AV e packs comerciais são geridos aqui e deixam de aparecer na Master de Valores.</div>
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.borderDim}` }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.2fr repeat(4, 110px) 90px", gap: "8px", padding: "0.7rem 0.9rem", borderBottom: `1px solid ${C.border}`, fontSize: "7px", letterSpacing: "0.18em", color: C.textMuted, textTransform: "uppercase" }}>
                  <span>Pack</span><span>Formato</span><span style={{ textAlign: "right" }}>Custo</span><span style={{ textAlign: "right" }}>Parceiro</span><span style={{ textAlign: "right" }}>SUD</span><span style={{ textAlign: "right" }}>Cliente</span><span />
                </div>
                {packs.map(pack => { const draft = packDrafts[pack.id]; return (
                  <div key={pack.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1.2fr repeat(4, 110px) 90px", gap: "8px", alignItems: "center", padding: "0.75rem 0.9rem", borderBottom: `1px solid ${C.borderDim}` }}>
                    <div><div style={{ fontSize: "11px", fontWeight: 700 }}>{pack.nome}</div><div style={{ fontSize: "8px", color: C.textMuted, marginTop: "2px" }}>{pack.items?.length || 0} itens</div></div>
                    <input value={draft?.duracao_formato || ""} onChange={e => updatePackDraft(pack.id, "duracao_formato", e.target.value)} style={{ ...inputStyle, fontSize: "10px", padding: "0.55rem" }} placeholder="Formato" />
                    {(["custo_interno", "valor_parceiro", "valor_sud", "valor_cliente_final"] as const).map(field => <input key={field} value={draft?.[field] || ""} onChange={e => updatePackDraft(pack.id, field, e.target.value)} inputMode="decimal" style={{ ...inputStyle, fontSize: "10px", padding: "0.55rem", textAlign: "right" }} placeholder="0" />)}
                    <button onClick={() => savePackValues(pack)} disabled={packSavingId === pack.id} style={{ ...btnSecStyle, padding: "0.55rem 0.6rem", fontSize: "8px" }}>{packSavingId === pack.id ? "..." : "Guardar"}</button>
                  </div>
                ); })}
              </div>
            </section>

            <section>
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "9px", letterSpacing: "0.3em", color: C.gold, textTransform: "uppercase", fontWeight: 700 }}>Equipamento avulso</div>
                <div style={{ fontSize: "10px", color: C.textMuted, marginTop: "0.3rem" }}>Os preços ficam na própria ficha do material.</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "0.75rem" }}>
                {materiaisAtivos.map(material => (
                  <div key={material.id} style={{ background: C.surface, border: `1px solid ${C.borderDim}`, padding: "0.9rem" }}>
                    <div style={{ display: "flex", gap: "0.7rem", alignItems: "center" }}><MaterialThumb src={material.imagem} size={38} /><div style={{ flex: 1 }}><div style={{ fontSize: "11px", fontWeight: 700 }}>{material.nome}</div><div style={{ fontSize: "9px", color: C.textMuted }}>{material.duracao_formato || material.categoria || "Equipamento"}</div></div><button onClick={() => openEditMaterial(material)} style={{ ...btnSecStyle, padding: "0.45rem 0.6rem", fontSize: "8px" }}>Editar</button></div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.45rem", marginTop: "0.75rem" }}>
                      {[ ["Custo", material.custo_interno], ["Parceiro", material.valor_parceiro], ["SUD", material.valor_sud], ["Cliente", material.valor_cliente_final] ].map(([label,value]) => <div key={String(label)}><div style={{ fontSize: "7px", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</div><div style={{ fontSize: "11px", fontWeight: 700, marginTop: "2px" }}>{Number(value) ? `${Number(value).toLocaleString("pt-PT")}€` : "—"}</div></div>)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
    )}

    {/* ═══ MOBILE ═══ */}
    {mobileView === true && (
    <div className="mob-shell" style={{ fontFamily: "'Montserrat','Helvetica Neue',sans-serif", color: "var(--theme-text)", opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--theme-border)", background: "var(--theme-nav-bg)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.2rem", letterSpacing: "0.35em", color: "var(--theme-accent)", fontWeight: 300 }}>LLE</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
          <ThemeSwitcher lightTheme={lightTheme} setLightTheme={setLightTheme} style={{ fontSize: "10px", padding: "0.4rem 0.5rem" }} />
          <span style={{ fontSize: "8px", letterSpacing: "0.35em", color: "var(--theme-text-faint)", textTransform: "uppercase" }}>{userName}</span>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--theme-border)", flexShrink: 0, overflowX: "auto" }}>
        <TabBtn id="fora" label="Fora" count={movimentosAbertos.length} />
        <TabBtn id="historico" label="Histórico" count={loadedTabs.historico ? stats.historyCount : undefined} />
        <TabBtn id="catalogo" label="Catálogo" count={stats.catalogCount} />
        <TabBtn id="valores" label="Valores" count={loadedTabs.valores ? stats.valuesCount : undefined} />
      </div>

      {tab === "fora" && (
        <div style={{ display: "flex", gap: "1.25rem", padding: "0.85rem 1.1rem", borderBottom: "1px solid var(--theme-border)" }}>
          {[
            { label: "Ativos", value: stats.activeMaterials },
            { label: "Total", value: totalUnidades },
            { label: "Fora", value: totalFora, color: totalFora > 0 ? "var(--theme-warning)" : undefined },
            { label: "Reservado", value: stats.reservedUnits, color: stats.reservedUnits > 0 ? "var(--theme-info)" : undefined },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: s.color || "var(--theme-text)" }}>{s.value}</span>
              <span style={{ fontSize: "7px", letterSpacing: "0.15em", color: "var(--theme-text-subtle)", textTransform: "uppercase" }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mob-list">
        {tabLoading && tab !== "fora" && <div style={{ padding: "3rem 1.2rem", textAlign: "center", fontSize: "10px", color: "var(--theme-text-faint)", letterSpacing: "0.18em", textTransform: "uppercase" }}>A carregar esta área...</div>}
        {tab === "fora" && foraAgrupados.map(group => (
          <div key={group.key} style={{ borderBottom: "1px solid var(--theme-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.7rem 1.1rem", background: "rgba(var(--theme-accent-rgb),0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "9px", letterSpacing: "0.15em", fontWeight: 700, color: group.isPessoal ? "var(--theme-text-muted)" : "var(--theme-accent)", textTransform: "uppercase" }}>
                  {group.isPessoal ? "👤 Pessoal" : `🎪 ${group.label}`}
                </span>
                {group.date && <span style={{ fontSize: "9px", color: "var(--theme-text-faint)" }}>{fmtDateShort(group.date)}</span>}
              </div>
              <span style={{ fontSize: "9px", color: "var(--theme-text-subtle)", background: "rgba(var(--theme-contrast-rgb),0.05)", padding: "2px 7px", borderRadius: "8px" }}>{group.items.length}</span>
            </div>
            {group.items.map(mov => {
              const pendente = pendenteMovimento(mov);
              const dias = diasFora(mov.data_saida);
              return (
                <div key={mov.id} style={{ padding: "0.9rem 1.1rem", borderTop: "1px solid rgba(var(--theme-contrast-rgb),0.03)", display: "flex", gap: "0.75rem" }}>
                  <MaterialThumb src={mov.material_imagem} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>{mov.material_nome}</span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--theme-warning)" }}>×{pendente}</span>
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--theme-text-muted)", marginTop: "2px" }}>
                      Saiu de <span style={{ color: "var(--theme-accent)" }}>{origemLabel(mov)}</span> · levou {mov.quem_levou || mov.responsavel || "—"} · {dias === 0 ? "hoje" : `há ${dias}d`}
                    </div>
                    <div style={{ fontSize: "9px", color: "var(--theme-text-subtle)", marginTop: "1px" }}>Dono: {mov.dono_material || "—"}</div>
                    <button onClick={() => openVolta(mov)} style={{ marginTop: "0.5rem", background: "rgba(93,202,165,0.12)", border: "1px solid rgba(93,202,165,0.3)", color: "var(--theme-success)", fontSize: "10px", letterSpacing: "0.1em", padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, textTransform: "uppercase" }}>✓ Voltou{pendente > 1 ? " tudo" : ""}</button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {tab === "fora" && movimentosAbertos.length === 0 && <div style={{ padding: "1.4rem 1.1rem", textAlign: "center", fontSize: "10px", color: "var(--theme-text-faint)", letterSpacing: "0.14em", borderBottom: "1px solid var(--theme-border)" }}>Nada fora — tudo continua no local</div>}

        {tab === "fora" && reservasAgrupadas.length > 0 && (
          <div>
            <div style={{ padding: "0.8rem 1.1rem", background: "rgba(80,140,220,0.07)", borderBottom: "1px solid rgba(80,140,220,0.2)" }}>
              <div style={{ fontSize: "9px", letterSpacing: "0.2em", color: "var(--theme-info)", textTransform: "uppercase", fontWeight: 700 }}>Reservado · ainda no local</div>
              <div style={{ fontSize: "9px", color: "var(--theme-text-faint)", marginTop: "3px" }}>Só passa para “Fora” quando a saída for registada.</div>
            </div>
            {reservasAgrupadas.map(group => (
              <div key={group.key} style={{ borderBottom: "1px solid var(--theme-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.7rem 1.1rem", background: "rgba(80,140,220,0.035)" }}>
                  <div>
                    <div style={{ fontSize: "9px", letterSpacing: "0.14em", color: "var(--theme-info)", textTransform: "uppercase", fontWeight: 700 }}>📌 {group.label}</div>
                    {group.date && <div style={{ fontSize: "9px", color: "var(--theme-text-faint)", marginTop: "2px" }}>{fmtDateShort(group.date)}</div>}
                  </div>
                  <span style={{ fontSize: "9px", color: "var(--theme-info)" }}>{group.items.reduce((sum, item) => sum + item.quantidade, 0)} un.</span>
                </div>
                {group.items.map((reserva, index) => (
                  <div key={`${group.key}-${reserva.material_nome}-${index}`} style={{ padding: "0.9rem 1.1rem", borderTop: "1px solid rgba(var(--theme-contrast-rgb),0.03)", display: "flex", gap: "0.75rem" }}>
                    <MaterialThumb src={reserva.material_imagem} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700 }}>{reserva.material_nome}</span>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--theme-info)" }}>×{reserva.quantidade}</span>
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--theme-text-muted)", marginTop: "3px" }}>Permanece em {reserva.local_habitual || "local habitual"}</div>
                      <div style={{ fontSize: "9px", color: "var(--theme-text-faint)", marginTop: "2px" }}>{reserva.pack_nome || "Reserva de material"}</div>
                      <button onClick={() => void openSaida(undefined, reserva)} style={{ marginTop: "0.55rem", background: "rgba(80,140,220,0.1)", border: "1px solid rgba(80,140,220,0.28)", color: "var(--theme-info)", fontSize: "9px", letterSpacing: "0.08em", padding: "6px 10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, textTransform: "uppercase" }}>Registar saída</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {!tabLoading && tab === "historico" && movimentosFechados.map(mov => (
          <div key={mov.id} style={{ padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--theme-border)", display: "flex", gap: "0.75rem" }}>
            <MaterialThumb src={mov.material_imagem} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 600 }}>{mov.material_nome} <span style={{ color: "var(--theme-text-muted)", fontWeight: 400 }}>×{mov.quantidade}</span></div>
              <div style={{ fontSize: "10px", color: "var(--theme-text-muted)" }}>Saiu de {origemLabel(mov)} · levou {mov.quem_levou || mov.responsavel || "—"}</div>
              <div style={{ fontSize: "9px", color: "var(--theme-text-faint)" }}>{fmtDateTime(mov.data_saida)} → {mov.data_volta ? fmtDateTime(mov.data_volta) : "—"}</div>
              {(mov.estado_regresso || mov.precisa_comprar === 1) && <div style={{ fontSize: "9px", color: mov.precisa_comprar === 1 ? "var(--theme-danger)" : "var(--theme-success)" }}>{mov.estado_regresso || ""}{mov.precisa_comprar === 1 ? ` · Comprar ×${mov.quantidade_comprar || "?"}` : ""}</div>}
            </div>
          </div>
        ))}
        {!tabLoading && tab === "historico" && movimentosFechados.length === 0 && <div style={{ padding: "3rem 1.5rem", textAlign: "center", fontSize: "11px", color: "var(--theme-text-faint)", letterSpacing: "0.2em" }}>Sem histórico</div>}

        {!tabLoading && tab === "catalogo" && materiaisAtivos.map(m => {
          const fora = pendenteAtualDoMaterial(m.id);
          return (
            <div key={m.id} style={{ padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--theme-border)", display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <MaterialThumb src={m.imagem} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: 600 }}>{m.nome}</div>
                <div style={{ fontSize: "10px", color: "var(--theme-text-muted)" }}>Total {m.quantidade_total}{fora > 0 && <span style={{ color: "var(--theme-warning)" }}> · {fora} fora</span>}</div>
                <div style={{ fontSize: "9px", color: "var(--theme-text-subtle)" }}>{m.dono || "—"} · {m.local_habitual || "—"}{m.consumivel === 1 ? " · Consumível" : ""}</div>
                {m.precisa_comprar === 1 && <div style={{ fontSize: "9px", color: "var(--theme-danger)", marginTop: "2px" }}>🛒 Comprar ×{m.quantidade_comprar || "?"}</div>}
              </div>
              <button onClick={() => openSaida(m.id)} style={{ background: "rgba(var(--theme-accent-rgb),0.1)", border: "1px solid rgba(var(--theme-accent-rgb),0.25)", color: "var(--theme-accent)", fontSize: "9px", padding: "6px 10px", cursor: "pointer", fontFamily: "inherit" }}>Saída</button>
              <button onClick={() => openEditMaterial(m)} style={{ background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text-muted)", fontSize: "10px", padding: "6px 8px", cursor: "pointer" }}>✏️</button>
            </div>
          );
        })}
        {!tabLoading && tab === "catalogo" && materiaisAtivos.length === 0 && <div style={{ padding: "3rem 1.5rem", textAlign: "center", fontSize: "11px", color: "var(--theme-text-faint)", letterSpacing: "0.2em" }}>Sem material — cria o primeiro</div>}

        {!tabLoading && tab === "valores" && (
          <div>
            <div style={{ padding: "0.85rem 1.1rem", background: "rgba(var(--theme-accent-rgb),0.05)", borderBottom: "1px solid var(--theme-border)", fontSize: "9px", letterSpacing: "0.2em", color: "var(--theme-accent)", textTransform: "uppercase", fontWeight: 700 }}>Packs e sistemas</div>
            {packs.map(pack => { const draft = packDrafts[pack.id]; return (
              <div key={pack.id} style={{ padding: "1rem 1.1rem", borderBottom: "1px solid var(--theme-border)" }}>
                <div style={{ fontSize: "13px", fontWeight: 700 }}>{pack.nome}</div>
                <input value={draft?.duracao_formato || ""} onChange={e => updatePackDraft(pack.id, "duracao_formato", e.target.value)} style={{ ...inputStyle, marginTop: "0.6rem" }} placeholder="Formato" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem", marginTop: "0.55rem" }}>
                  {([ ["custo_interno", "Custo"], ["valor_parceiro", "Parceiro"], ["valor_sud", "SUD"], ["valor_cliente_final", "Cliente"] ] as const).map(([field,label]) => <label key={field}><span style={{ display: "block", fontSize: "7px", color: "var(--theme-text-faint)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "3px" }}>{label}</span><input value={draft?.[field] || ""} onChange={e => updatePackDraft(pack.id, field, e.target.value)} inputMode="decimal" style={{ ...inputStyle, textAlign: "right" }} placeholder="0" /></label>)}
                </div>
                <button onClick={() => savePackValues(pack)} disabled={packSavingId === pack.id} style={{ ...btnPrimStyle, width: "100%", marginTop: "0.65rem", padding: "0.65rem" }}>{packSavingId === pack.id ? "A guardar..." : "Guardar valores"}</button>
              </div>
            ); })}
            <div style={{ padding: "0.85rem 1.1rem", background: "rgba(var(--theme-accent-rgb),0.05)", borderBottom: "1px solid var(--theme-border)", fontSize: "9px", letterSpacing: "0.2em", color: "var(--theme-accent)", textTransform: "uppercase", fontWeight: 700 }}>Equipamento avulso</div>
            {materiaisAtivos.map(material => (
              <div key={material.id} style={{ padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--theme-border)", display: "flex", gap: "0.7rem", alignItems: "center" }}>
                <MaterialThumb src={material.imagem} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: "12px", fontWeight: 700 }}>{material.nome}</div><div style={{ fontSize: "9px", color: "var(--theme-text-muted)", marginTop: "3px" }}>C {material.custo_interno || "—"}€ · P {material.valor_parceiro || "—"}€ · SUD {material.valor_sud || "—"}€ · Final {material.valor_cliente_final || "—"}€</div></div>
                <button onClick={() => openEditMaterial(material)} style={{ background: "var(--theme-input-bg)", border: "1px solid var(--theme-input-border)", color: "var(--theme-text-muted)", fontSize: "10px", padding: "7px 9px", cursor: "pointer" }}>✏️</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FABs mobile */}
      <div style={{ position: "fixed", bottom: "calc(74px + env(safe-area-inset-bottom))", right: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem", zIndex: 50 }}>
        {tab === "catalogo" && (
          <button onClick={openCreateMaterial} style={{ background: "var(--theme-surface)", border: "1px solid rgba(var(--theme-accent-rgb),0.3)", color: "var(--theme-accent)", width: "44px", height: "44px", borderRadius: "50%", fontSize: "20px", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>+</button>
        )}
        {tab !== "valores" && <button onClick={() => openSaida()} style={{ background: "var(--theme-accent)", border: "none", color: "var(--theme-accent-contrast)", width: "50px", height: "50px", borderRadius: "50%", fontSize: "22px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>↗</button>}
      </div>

      <MobTabBar active="materiais" role={userRole} lightTheme={lightTheme} />
    </div>
    )}

    {/* ── Modal: Nova Saída ── */}
    {saidaModal && (
      <>
        <div className="mob-page-desktop" onClick={e => e.target === e.currentTarget && closeSaida()} style={overlayStyle}>
          <div style={modalStyle}><div style={topLineStyle} />
            <SaidaModalContent {...{ materiais: materiaisAtivos, eventos, saidaForm, setSaidaForm, saving, closeSaida, handleRegistarSaida, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C, MaterialThumb   }} />
          </div>
        </div>
        <div className="mob-shell" onClick={e => e.target === e.currentTarget && closeSaida()} style={overlayBottomStyle}>
          <div style={modalMobStyle}><div style={topLineStyle} />
            <SaidaModalContent {...{ materiais: materiaisAtivos, eventos, saidaForm, setSaidaForm, saving, closeSaida, handleRegistarSaida, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C, MaterialThumb   }} />
          </div>
        </div>
      </>
    )}

    {/* ── Modal: Regresso de Material ── */}
    {voltaModal.open && voltaModal.movimento && (
      <>
        <div className="mob-page-desktop" onClick={e => e.target === e.currentTarget && closeVolta()} style={overlayStyle}>
          <div style={modalStyle}><div style={topLineStyle} />
            <VoltaModalContent {...{ voltaForm, setVoltaForm, movimento: voltaModal.movimento, pendente: pendenteMovimento(voltaModal.movimento), saving, closeVolta, handleGuardarVolta, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C }} />
          </div>
        </div>
        <div className="mob-shell" onClick={e => e.target === e.currentTarget && closeVolta()} style={overlayBottomStyle}>
          <div style={modalMobStyle}><div style={topLineStyle} />
            <VoltaModalContent {...{ voltaForm, setVoltaForm, movimento: voltaModal.movimento, pendente: pendenteMovimento(voltaModal.movimento), saving, closeVolta, handleGuardarVolta, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C }} />
          </div>
        </div>
      </>
    )}

    {/* ── Modal: Novo/Editar Material ── */}
    {materialModal.open && (
      <>
        <div className="mob-page-desktop" onClick={e => e.target === e.currentTarget && closeMaterialModal()} style={overlayStyle}>
          <div style={modalStyle}><div style={topLineStyle} />
            <MaterialModalContent {...{ materialForm, setMaterialForm, materialModal, saving, imgUploading, closeMaterialModal, handleSaveMaterial, handleImageUpload, fileInputRef, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C   }} />
          </div>
        </div>
        <div className="mob-shell" onClick={e => e.target === e.currentTarget && closeMaterialModal()} style={overlayBottomStyle}>
          <div style={modalMobStyle}><div style={topLineStyle} />
            <MaterialModalContent {...{ materialForm, setMaterialForm, materialModal, saving, imgUploading, closeMaterialModal, handleSaveMaterial, handleImageUpload, fileInputRef, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C   }} />
          </div>
        </div>
      </>
    )}

    <div style={{ position: "fixed", bottom: "2rem", right: "2rem", background: "var(--theme-toast-bg)", border: `1px solid ${C.border}`, color: C.gold, fontSize: "10px", letterSpacing: "0.25em", padding: "1rem 1.5rem", zIndex: 2000, transform: toast ? "translateX(0)" : "translateX(200%)", transition: "transform 0.3s ease", textTransform: "uppercase", fontWeight: 600 }}>
      {toast}
    </div>
    </>
  );
}

function SaidaModalContent({ materiais, eventos, saidaForm, setSaidaForm, saving, closeSaida, handleRegistarSaida, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C, MaterialThumb }: any) {
  const selected = materiais.find((m: Material) => m.id === saidaForm.material_id);
  return (
    <>
      <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.goldDim, textTransform: "uppercase", fontWeight: 600, marginBottom: "1.5rem" }}>Registar Saída</p>

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Material *</label>
        <select style={{ ...inputStyle, cursor: "pointer" }} value={saidaForm.material_id} onChange={(e: any) => setSaidaForm((f: any) => ({ ...f, material_id: Number(e.target.value) }))}>
          <option value={0}>Selecionar material...</option>
          {materiais.map((m: Material) => <option key={m.id} value={m.id}>{m.nome}{m.categoria ? ` · ${m.categoria}` : ""}</option>)}
        </select>
      </div>

      {selected && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem", padding: "0.6rem", background: "rgba(var(--theme-contrast-rgb),0.02)", border: `1px solid ${C.borderDim}` }}>
          <MaterialThumb src={selected.imagem} size={36} />
          <span style={{ fontSize: "10px", color: C.textSec }}>
            Total no catálogo: <b style={{ color: C.textPrimary }}>{selected.quantidade_total}</b>
            <br />Dono: <b style={{ color: C.textPrimary }}>{selected.dono || "—"}</b> · Habitual: <b style={{ color: C.textPrimary }}>{selected.local_habitual || "—"}</b>
            {selected.consumivel === 1 && <><br /><span style={{ color: C.amber }}>Consumível</span></>}
          </span>
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Quantidade *</label>
        <input type="number" min={1} style={inputStyle} value={saidaForm.quantidade} onChange={(e: any) => setSaidaForm((f: any) => ({ ...f, quantidade: Math.max(1, Number(e.target.value) || 1) }))} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Saiu de onde *</label>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {ORIGENS.map((o: string) => (
            <button key={o} onClick={() => setSaidaForm((f: any) => ({ ...f, origem: o }))} style={{
              background: saidaForm.origem === o ? "rgba(var(--theme-accent-rgb),0.18)" : "rgba(var(--theme-contrast-rgb),0.04)",
              border: `1px solid ${saidaForm.origem === o ? "rgba(var(--theme-accent-rgb),0.4)" : "rgba(var(--theme-contrast-rgb),0.1)"}`,
              color: saidaForm.origem === o ? C.gold : C.textMuted,
              fontSize: "10px", padding: "8px 14px", cursor: "pointer", fontFamily: "inherit",
            }}>{o}</button>
          ))}
        </div>
        {saidaForm.origem === "Outro" && (
          <input style={{ ...inputStyle, marginTop: "0.5rem" }} placeholder="Especificar..." value={saidaForm.origem_detalhe} onChange={(e: any) => setSaidaForm((f: any) => ({ ...f, origem_detalhe: e.target.value }))} />
        )}
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Quem levou</label>
        <input style={inputStyle} placeholder="Ex: João, Tânia, técnico, artista..." value={saidaForm.quem_levou} onChange={(e: any) => setSaidaForm((f: any) => ({ ...f, quem_levou: e.target.value }))} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Para evento ou pessoal?</label>
        <select style={{ ...inputStyle, cursor: "pointer" }} value={saidaForm.evento_sel} onChange={(e: any) => setSaidaForm((f: any) => ({ ...f, evento_sel: e.target.value }))}>
          <option value="pessoal">👤 Pessoal (sem evento)</option>
          {eventos.map((ev: EventoOpcao) => (
            <option key={ev.id} value={String(ev.id)}>{ev.date ? `${fmtDateShort(ev.date)} · ` : ""}{ev.title}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <label style={labelStyle}>Notas</label>
        <textarea style={{ ...inputStyle, height: "60px", resize: "vertical" as any }} value={saidaForm.notas} onChange={(e: any) => setSaidaForm((f: any) => ({ ...f, notas: e.target.value }))} />
      </div>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button onClick={closeSaida} style={{ ...btnSecStyle, flex: 1 }}>Cancelar</button>
        <button onClick={handleRegistarSaida} disabled={saving || !saidaForm.material_id} style={{ ...btnPrimStyle, flex: 2, opacity: !saidaForm.material_id ? 0.5 : 1 }}>{saving ? "A registar..." : "Registar Saída"}</button>
      </div>
    </>
  );
}

function VoltaModalContent({ voltaForm, setVoltaForm, movimento, pendente, saving, closeVolta, handleGuardarVolta, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C }: any) {
  const estados = ["OK", "Parcial", "Danificado", "Em falta", "Perdido", "Consumido"];
  return (
    <>
      <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.goldDim, textTransform: "uppercase", fontWeight: 600, marginBottom: "0.75rem" }}>Regresso de Material</p>
      <div style={{ background: "var(--theme-subtle-bg)", border: `1px solid ${C.borderDim}`, padding: "0.8rem", marginBottom: "1rem" }}>
        <div style={{ fontSize: "12px", color: C.textPrimary, fontWeight: 700 }}>{movimento.material_nome}</div>
        <div style={{ fontSize: "10px", color: C.textSec, marginTop: "3px" }}>Pendente: {pendente} · Levou: {movimento.quem_levou || movimento.responsavel || "—"} · Dono: {movimento.dono_material || "—"}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <label style={labelStyle}>Quantidade que voltou</label>
          <input type="number" min={0} max={pendente} style={inputStyle} value={voltaForm.quantidade_devolvida} onChange={(e: any) => setVoltaForm((f: any) => ({ ...f, quantidade_devolvida: Math.max(0, Math.min(pendente, Number(e.target.value) || 0)) }))} />
        </div>
        <div>
          <label style={labelStyle}>Quantidade consumida / não volta</label>
          <input type="number" min={0} max={pendente} style={inputStyle} value={voltaForm.quantidade_consumida} onChange={(e: any) => setVoltaForm((f: any) => ({ ...f, quantidade_consumida: Math.max(0, Math.min(pendente, Number(e.target.value) || 0)) }))} />
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Estado no regresso</label>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {estados.map((estado: string) => (
            <button key={estado} onClick={() => setVoltaForm((f: any) => ({ ...f, estado_regresso: estado }))} style={{
              background: voltaForm.estado_regresso === estado ? "rgba(var(--theme-accent-rgb),0.18)" : "rgba(var(--theme-contrast-rgb),0.04)",
              border: `1px solid ${voltaForm.estado_regresso === estado ? "rgba(var(--theme-accent-rgb),0.4)" : "rgba(var(--theme-contrast-rgb),0.1)"}`,
              color: voltaForm.estado_regresso === estado ? C.gold : C.textMuted,
              fontSize: "10px", padding: "8px 10px", cursor: "pointer", fontFamily: "inherit",
            }}>{estado}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "1rem", padding: "0.75rem", border: `1px solid ${voltaForm.precisa_comprar ? "rgba(226,75,74,0.35)" : C.borderDim}`, background: voltaForm.precisa_comprar ? "rgba(226,75,74,0.06)" : "rgba(var(--theme-contrast-rgb),0.02)" }}>
        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input type="checkbox" checked={voltaForm.precisa_comprar === 1} onChange={(e: any) => setVoltaForm((f: any) => ({ ...f, precisa_comprar: e.target.checked ? 1 : 0 }))} />
          Precisa comprar / repor stock
        </label>
        {voltaForm.precisa_comprar === 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.75rem" }}>
            <input style={inputStyle} placeholder="Motivo: acabou / precisa mais..." value={voltaForm.motivo_compra} onChange={(e: any) => setVoltaForm((f: any) => ({ ...f, motivo_compra: e.target.value }))} />
            <input type="number" min={0} style={inputStyle} placeholder="Qtd comprar" value={voltaForm.quantidade_comprar} onChange={(e: any) => setVoltaForm((f: any) => ({ ...f, quantidade_comprar: Math.max(0, Number(e.target.value) || 0) }))} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <label style={labelStyle}>Notas de regresso</label>
        <textarea style={{ ...inputStyle, height: "64px", resize: "vertical" as any }} value={voltaForm.notas_regresso} onChange={(e: any) => setVoltaForm((f: any) => ({ ...f, notas_regresso: e.target.value }))} placeholder="Ex: voltou riscado, falta cabo, consumido no evento..." />
      </div>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button onClick={closeVolta} style={{ ...btnSecStyle, flex: 1 }}>Cancelar</button>
        <button onClick={handleGuardarVolta} disabled={saving} style={{ ...btnPrimStyle, flex: 2 }}>{saving ? "A guardar..." : "Guardar Regresso"}</button>
      </div>
    </>
  );
}

function MaterialModalContent({ materialForm, setMaterialForm, materialModal, saving, imgUploading, closeMaterialModal, handleSaveMaterial, handleImageUpload, fileInputRef, labelStyle, inputStyle, btnPrimStyle, btnSecStyle, C }: any) {
  return (
    <>
      <p style={{ fontSize: "9px", letterSpacing: "0.4em", color: C.goldDim, textTransform: "uppercase", fontWeight: 600, marginBottom: "1.5rem" }}>
        {materialModal.editing ? "Editar Material" : "Novo Material"}
      </p>

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Foto</label>
        <div onClick={() => fileInputRef.current?.click()} style={{
          width: "100%", height: "140px", background: "var(--theme-subtle-bg)", border: `1px dashed ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden",
        }}>
          {imgUploading
            ? <span style={{ fontSize: "10px", color: C.textMuted, letterSpacing: "0.2em" }}>A processar...</span>
            : materialForm.imagem
              ? <img src={materialForm.imagem} alt="" style={{ width: "100%", height: "100%", objectFit: "cover"   }} />
              : <div style={{ textAlign: "center" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.4" style={{ marginBottom: "6px" }}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                  <div style={{ fontSize: "9px", color: C.textMuted, letterSpacing: "0.15em" }}>Toca para adicionar foto</div>
                </div>}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
          onChange={(e: any) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f);   }} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Nome *</label>
        <input style={inputStyle} value={materialForm.nome} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Coluna JBL, Microfone SM58..." />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <label style={labelStyle}>Categoria</label>
          <select style={{ ...inputStyle, cursor: "pointer" }} value={materialForm.categoria} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, categoria: e.target.value }))}>
            <option value="">Sem categoria</option>
            {CATEGORIAS.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Quantidade total</label>
          <input type="number" min={1} style={inputStyle} value={materialForm.quantidade_total} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, quantidade_total: Math.max(1, Number(e.target.value) || 1) }))} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <label style={labelStyle}>Dono do material</label>
          <input style={inputStyle} value={materialForm.dono} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, dono: e.target.value }))} placeholder="LLE / João / Tânia / Alugado..." />
        </div>
        <div>
          <label style={labelStyle}>Local habitual</label>
          <input style={inputStyle} value={materialForm.local_habitual} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, local_habitual: e.target.value }))} placeholder="Loja / casa João / SUD..." />
        </div>
      </div>

      <div style={{ marginBottom: "1rem", padding: "0.75rem", border: `1px solid ${C.borderDim}`, background: "rgba(var(--theme-contrast-rgb),0.02)" }}>
        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "0.75rem" }}>
          <input type="checkbox" checked={materialForm.consumivel === 1} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, consumivel: e.target.checked ? 1 : 0 }))} />
          Material consumível
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={labelStyle}>Stock mínimo</label>
            <input type="number" min={0} style={inputStyle} value={materialForm.stock_minimo} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, stock_minimo: Math.max(0, Number(e.target.value) || 0) }))} />
          </div>
          <div>
            <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginTop: "1.4rem" }}>
              <input type="checkbox" checked={materialForm.precisa_comprar === 1} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, precisa_comprar: e.target.checked ? 1 : 0 }))} />
              Precisa comprar
            </label>
          </div>
        </div>
        {materialForm.precisa_comprar === 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.75rem" }}>
            <input style={inputStyle} placeholder="Motivo" value={materialForm.motivo_compra} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, motivo_compra: e.target.value }))} />
            <input type="number" min={0} style={inputStyle} placeholder="Qtd comprar" value={materialForm.quantidade_comprar} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, quantidade_comprar: Math.max(0, Number(e.target.value) || 0) }))} />
            <textarea style={{ ...inputStyle, gridColumn: "1 / -1", height: "54px", resize: "vertical" as any }} placeholder="Notas de compra" value={materialForm.notas_compra} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, notas_compra: e.target.value }))} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: "1.25rem", padding: "0.9rem", border: `1px solid ${C.borderDim}`, background: "rgba(var(--theme-contrast-rgb),0.02)" }}>
        <p style={{ fontSize: "8px", letterSpacing: "0.3em", color: C.goldDim, textTransform: "uppercase", fontWeight: 700, marginBottom: "0.85rem" }}>Valores do material</p>
        <div style={{ marginBottom: "0.8rem" }}>
          <label style={labelStyle}>Duração / formato</label>
          <input style={inputStyle} value={materialForm.duracao_formato} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, duracao_formato: e.target.value }))} placeholder="Ex: por evento, até 4h, unidade..." />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
          {[
            ["Custo interno", "custo_interno"],
            ["Parceiro", "valor_parceiro"],
            ["SUD", "valor_sud"],
            ["Cliente final", "valor_cliente_final"],
          ].map(([label, field]) => (
            <div key={field}>
              <label style={labelStyle}>{label}</label>
              <input type="number" min={0} step="0.01" inputMode="decimal" style={inputStyle} value={materialForm[field] ?? 0} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, [field]: Number(String(e.target.value).replace(",", ".")) || 0 }))} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <label style={labelStyle}>Notas</label>
        <textarea style={{ ...inputStyle, height: "60px", resize: "vertical" as any }} value={materialForm.notas} onChange={(e: any) => setMaterialForm((f: any) => ({ ...f, notas: e.target.value }))} />
      </div>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button onClick={closeMaterialModal} style={{ ...btnSecStyle, flex: 1 }}>Cancelar</button>
        <button onClick={handleSaveMaterial} disabled={saving} style={{ ...btnPrimStyle, flex: 2 }}>{saving ? "A guardar..." : materialModal.editing ? "Guardar" : "Criar"}</button>
      </div>
    </>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

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
    { href: "/valores", label: "Valores" }, { href: "/residencias", label: "Residências" },
    { href: "/clientes", label: "Clientes" },
    { href: "/materiais", label: "Materiais" },
  ];
  const financeHrefs = ["/agenda", "/leads", "/faturacao", "/pagamentos", "/clientes"];
  const adminOnlyHrefs = ["/dashboard", "/colaboradores", "/valores", "/residencias", "/materiais"];
  const novaluesBlockedHrefs = ["/materiais"];
  const links = role === "finance"
    ? allLinks.filter(l => financeHrefs.includes(l.href))
    : allLinks.filter(l => {
        if (adminOnlyHrefs.includes(l.href) && role !== "admin") return false;
        if (novaluesBlockedHrefs.includes(l.href) && role === "limited_novalues") return false;
        return true;
      });
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

