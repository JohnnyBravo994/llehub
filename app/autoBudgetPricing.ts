import { COLABORADOR_SKILLS, SERVICO_SKILL_LINKS, isAutoBudgetPackService, standaloneSkillForService } from "./constants";

export interface AutoBudgetSkillProfile {
  valor?: number; // legado
  custo_interno?: number; // legado = custo de evento
  custo_evento?: number;
  custo_residencia?: number;

  // Valores de faturação / venda ao cliente
  valor_sud?: number;
  valor_residencia?: number;
  valor_evento_residencia?: number;
  valor_parceria?: number;
  valor_cliente_final?: number;

  // Campos legados mantidos para migração/compatibilidade
  custo_sud?: number;
  custo_evento_residencia?: number;
  custo_parceria?: number;
  custo_cliente_final?: number;
  rating?: number;
}

export interface AutoBudgetColaborador {
  id: number;
  nome: string;
  nome_artistico?: string;
  nome_pessoal?: string;
  skills?: string;
  ativo: number;
  skill_profiles?: Record<string, AutoBudgetSkillProfile>;
}

function normalize(value: string): string {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function skillsOf(col: AutoBudgetColaborador): string[] {
  return Array.from(new Set((col.skills || "").split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)));
}

function displayName(col: AutoBudgetColaborador): string {
  return col.nome_artistico || col.nome || col.nome_pessoal || "Colaborador";
}

function profileFor(col: AutoBudgetColaborador, skill: string): AutoBudgetSkillProfile | undefined {
  const profiles = col.skill_profiles || {};
  if (profiles[skill]) return profiles[skill];
  const key = Object.keys(profiles).find(k => normalize(k) === normalize(skill));
  return key ? profiles[key] : undefined;
}

/**
 * Os standalones não desaparecem quando não há fornecedor ativo.
 * A lista é a união de:
 * - skills operacionais conhecidas (exceto "Outro");
 * - serviços comerciais históricos que correspondem inequivocamente a uma só skill;
 * - skills encontradas nos colaboradores ativos.
 */
export function standaloneOptionsFromColaboradores(colaboradores: AutoBudgetColaborador[]): string[] {
  const knownSkills = (COLABORADOR_SKILLS as readonly string[]).filter(s => normalize(s) !== "outro");
  const historicalSingleSkillServices = Object.entries(SERVICO_SKILL_LINKS)
    .filter(([service, skills]) => !isAutoBudgetPackService(service) && skills.length === 1)
    .map(([service]) => service);
  const activeSkills = colaboradores.filter(c => c.ativo === 1).flatMap(skillsOf);
  return Array.from(new Set([...knownSkills, ...historicalSingleSkillServices, ...activeSkills]))
    .sort((a, b) => a.localeCompare(b, "pt-PT", { sensitivity: "base" }));
}

/** Valor de faturação / venda ao cliente. Nunca representa o custo do artista. */
export function profileBillingValue(profile: AutoBudgetSkillProfile | undefined, contexto?: string): number {
  if (!profile) return 0;
  switch (contexto || "Cliente Final") {
    case "SUD": return Number(profile.valor_sud ?? profile.custo_sud ?? 0);
    case "Residência": return Number(profile.valor_residencia ?? 0);
    case "Evento Residência": return Number(profile.valor_evento_residencia ?? profile.custo_evento_residencia ?? 0);
    case "Parceiro": return Number(profile.valor_parceria ?? profile.custo_parceria ?? 0);
    case "Cliente Final": return Number(profile.valor_cliente_final ?? profile.custo_cliente_final ?? 0);
    // SANA / Hyatt / Conta Especial ainda não têm coluna própria no novo modelo.
    // Até serem modelados explicitamente, caem em Cliente Final.
    default: return Number(profile.valor_cliente_final ?? profile.custo_cliente_final ?? 0);
  }
}

/** Custo real esperado para a LLE pagar ao colaborador. Independente do preço vendido. */
export function profileArtistCost(profile: AutoBudgetSkillProfile | undefined, tipoComercial?: string): number {
  if (!profile) return 0;
  const custoEvento = Number(profile.custo_evento ?? profile.custo_interno ?? profile.valor ?? 0);
  if (tipoComercial === "Residência") return Number(profile.custo_residencia || custoEvento || 0);
  // Evento de Residência é um evento extraordinário: usa custo de evento salvo override específico da residência.
  return custoEvento;
}

export function standaloneReferenceFromColaboradores(
  service: string,
  valorContexto: string | undefined,
  colaboradores: AutoBudgetColaborador[],
  tipoComercial: string = "Evento",
) {
  const skill = standaloneSkillForService(service);
  if (!skill) return null;
  const candidates = colaboradores.filter(c => c.ativo === 1 && skillsOf(c).some(s => normalize(s) === normalize(skill)));
  if (candidates.length === 0) {
    return {
      skill,
      valor: 0,
      custo: 0,
      sourceName: "",
      costSourceName: "",
      candidateCount: 0,
    };
  }

  let billingValue = 0;
  let billingSource = "";
  let artistCost = 0;
  let costSource = "";
  for (const col of candidates) {
    const p = profileFor(col, skill);
    const contextualBilling = profileBillingValue(p, valorContexto);
    if (contextualBilling > billingValue) {
      billingValue = contextualBilling;
      billingSource = displayName(col);
    }
    const contextualCost = profileArtistCost(p, tipoComercial);
    if (contextualCost > artistCost) {
      artistCost = contextualCost;
      costSource = displayName(col);
    }
  }

  return {
    skill,
    valor: billingValue,
    custo: artistCost,
    sourceName: billingSource,
    costSourceName: costSource,
    candidateCount: candidates.length,
  };
}
