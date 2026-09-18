export const SERVICOS_VENDIDOS = [
  "DJ",
  "DJ s/ AV",
  "DJ todo o dia",
  "Karaoke s/ AV",
  "Som 1 PA",
  "Som 2 PAs",
  "AV base evento",
  "AV Base",
  "AV Premium",
  "Sax",
  "Violinista",
  "Acordionista",
  "Cantor(a)",
  "Bailarinos s/ receção",
  "Bailarinos c/ receção",
  "Asas Isis (2 bailarinos)",
  "Artista de Fogo",
  "Artista de Malabares",
  "Anão",
  "Show Bolas de Sabão",
  "Mágico(a)",
  "Cubo (a partir de 3m)",
  "Forças Combinadas - dueto",
  "Acro - dueto",
  "Acro Aéreos - solo",
  "Lyra Aéreos - dueto",
  "Straps Aéreos - solo",
  "Straps Aéreos - dueto",
  "Pórtico Aéreos",
  "Spiral - plataforma",
  "Lollipop - plataforma",
  "Chandelier - plataforma",
  "Diamante - plataforma",
  "Animador / Host",
  "Animador Infantil c/ jogos",
  "Make-up & Hair",
  "Guarda Roupa",
  "Produtor",
  "Trio Fado",
  "Annia Solo",
  "Annia Solo c/ AVs",
  "Banda Duo s/ AV",
  "Banda Duo c/ AVs",
  "Banda Trio s/ AV",
  "Banda Trio c/ AVs",
  "Banda quarteto s/ AV",
  "Banda quarteto c/ AVs",
  "Banda quinteto s/ AV",
  "Banda quinteto c/ AVs",
  "Banda quinteto + Cantor",
  "Banda quinteto + Cantor c/ AVs",
  "Banda quinteto + 2 Back Vocals",
  "Banda quinteto + 2 BVs c/ AVs",
  "DJ Booth LED - branco",
  "DJ Booth LED - preto",
  "1 PA Mackie Thump 212 12\"",
  "Mixer Behringer Xenyx 1202SFX",
  "Controller Pioneer Rekordbox DJ DDJ-400",
  "Stairville LED Bar 240/8 RGB DMX 30º",
  "4 Baterias LEDs Uking RGBWA + UV Par Light",
  "8 LEDs Wash 7x12 RGBW",
  "4 LEDs Uking 105W 7x15W RGBW",
  "LED efeito flor Eurolite FE-700",
  "Máquina de fumo Ibiza LSM900W",
  "Microfone c/ fio Sennheiser e835",
  "2 Microfones dual UHF s/ fios GLXD2",
  "1 Shure SM58 s/ fios",
  "Cablagem completa XLR",
  "Discurso",
  "DJ Basic",
  "Let\'s Party",
  "Premium",
  "Serviço sob consulta",
  "Técnico de Som",
  "Técnico de Luz",
  "Deslocações",
  "Aluguer de Carrinha",
] as const;


export const MATERIAL_EQUIPMENT_SERVICES = [
  "DJ Booth LED - branco",
  "DJ Booth LED - preto",
  "1 PA Mackie Thump 212 12\"",
  "Mixer Behringer Xenyx 1202SFX",
  "Controller Pioneer Rekordbox DJ DDJ-400",
  "Stairville LED Bar 240/8 RGB DMX 30º",
  "4 Baterias LEDs Uking RGBWA + UV Par Light",
  "8 LEDs Wash 7x12 RGBW",
  "4 LEDs Uking 105W 7x15W RGBW",
  "LED efeito flor Eurolite FE-700",
  "Máquina de fumo Ibiza LSM900W",
  "Microfone c/ fio Sennheiser e835",
  "2 Microfones dual UHF s/ fios GLXD2",
  "1 Shure SM58 s/ fios",
  "Cablagem completa XLR",
] as const;

export const MATERIAL_PACK_SERVICES = [
  "Som 1 PA",
  "Som 2 PAs",
  "AV base evento",
  "AV Base",
  "AV Premium",
  "Discurso",
  "DJ Basic",
  "Let's Party",
  "Premium",
] as const;

export const MATERIAL_VALUE_SERVICES = [
  ...MATERIAL_EQUIPMENT_SERVICES,
  ...MATERIAL_PACK_SERVICES,
] as const;

function normalizeServiceKey(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const MATERIAL_VALUE_SERVICE_KEYS = new Set(MATERIAL_VALUE_SERVICES.map(normalizeServiceKey));
const MATERIAL_EQUIPMENT_SERVICE_KEYS = new Set(MATERIAL_EQUIPMENT_SERVICES.map(normalizeServiceKey));

export function isMaterialValueService(value: string): boolean {
  return MATERIAL_VALUE_SERVICE_KEYS.has(normalizeServiceKey(value));
}

export function isMaterialEquipmentService(value: string): boolean {
  return MATERIAL_EQUIPMENT_SERVICE_KEYS.has(normalizeServiceKey(value));
}

// Função/serviço executado numa Agenda/Lead por um colaborador.
// Deve ser mais operacional do que a lista comercial de serviços vendidos.
export const ARTIST_TIPOS = [
  "DJ",
  "Karaoke Host",
  "Técnico de Som",
  "Técnico AV",
  "Técnico de Luz",
  "Saxofonista",
  "Violinista",
  "Acordionista",
  "Cantor(a)",
  "Cantor(a) Fado",
  "Guitarra Portuguesa",
  "Viola/Guitarra Fado",
  "Guitarrista",
  "Pianista",
  "Baixista",
  "Baterista",
  "Percussionista",
  "Trompetista",
  "Bailarino(a)",
  "Bailarino(a) Asas Isis",
  "Artista de Fogo",
  "Malabarista",
  "Performer Bolas de Sabão",
  "Mágico(a)",
  "Performer Cubo",
  "Acrobata",
  "Acrobata Aéreo(a)",
  "Performer Lyra",
  "Performer Straps",
  "Performer Plataforma",
  "Técnico de Rigging",
  "Animador / Host",
  "MC",
  "Ator(a)",
  "Animador Infantil",
  "Make-up & Hair",
  "Guarda-Roupa",
  "Produtor",
  "Assistente de Produção",
  "Coreógrafo(a)",
  "Fotógrafo/Videógrafo",
  "Outro",
] as const;

// Skills disponíveis na ficha de colaborador. Mantém-se separado dos serviços vendidos.
export const COLABORADOR_SKILLS = [
  ...ARTIST_TIPOS,
  "Performer Especial",
] as const;

export const MODALIDADES = ["Fatura", "Por Fora", "50% Por Fora", "10% Por Fora"];

export const TIPOS_COMERCIAIS = ["Evento", "Residência", "Evento de Residência", "Cliente Especial"] as const;
export const VALOR_CONTEXTOS = ["Cliente Final", "Parceiro", "Residência", "Evento Residência", "SUD", "SANA", "Hyatt", "Conta Especial"] as const;

// Normalização de nomes de colaboradores/artistas:
// Chave = variante em lowercase → Valor = nome canónico
// Adiciona aqui novas variantes sem tocar noutro código
export const COLABORADOR_ALIASES: Record<string, string> = {
  "antonio": "António",
  "antónio": "António",
  "gio": "João Pereira",
  "joão pereira": "João Pereira",
};

export function resolveColaboradorNome(nome: string): string {
  return COLABORADOR_ALIASES[nome.trim().toLowerCase()] ?? nome.trim();
}

// Um evento/lead pode incluir vários serviços contratados. Mantemos o campo legado
// `servico_comercial` por compatibilidade, serializando múltiplos valores com um
// separador que não colide com os nomes do catálogo.
export const SERVICOS_CONTRATADOS_SEPARATOR = " || ";

export function parseServicosContratados(value?: string | null): string[] {
  const raw = (value || "").trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return Array.from(new Set(parsed.map(String).map(s => s.trim()).filter(Boolean)));
    } catch {}
  }
  return Array.from(new Set(raw.split(/\s*\|\|\s*/g).map(s => s.trim()).filter(Boolean)));
}

export function serializeServicosContratados(items: string[]): string {
  return Array.from(new Set(items.map(s => s.trim()).filter(Boolean))).join(SERVICOS_CONTRATADOS_SEPARATOR);
}

// Fundação para ligar o catálogo comercial às capacidades dos colaboradores.
// Não fundimos as duas listas: um serviço vendido pode exigir várias skills e
// alguns serviços (AV, material, packs) não correspondem a uma pessoa.
export const SERVICO_SKILL_LINKS: Record<string, readonly string[]> = {
  "DJ": ["DJ"],
  "DJ s/ AV": ["DJ"],
  "DJ todo o dia": ["DJ"],
  "Karaoke s/ AV": ["Karaoke Host"],
  "Sax": ["Saxofonista"],
  "Violinista": ["Violinista"],
  "Acordionista": ["Acordionista"],
  "Cantor(a)": ["Cantor(a)"],
  "Bailarinos s/ receção": ["Bailarino(a)"],
  "Bailarinos c/ receção": ["Bailarino(a)"],
  "Asas Isis (2 bailarinos)": ["Bailarino(a) Asas Isis"],
  "Artista de Fogo": ["Artista de Fogo"],
  "Artista de Malabares": ["Malabarista"],
  "Show Bolas de Sabão": ["Performer Bolas de Sabão"],
  "Mágico(a)": ["Mágico(a)"],
  "Cubo (a partir de 3m)": ["Performer Cubo"],
  "Forças Combinadas - dueto": ["Acrobata"],
  "Acro - dueto": ["Acrobata"],
  "Acro Aéreos - solo": ["Acrobata Aéreo(a)"],
  "Lyra Aéreos - dueto": ["Performer Lyra"],
  "Straps Aéreos - solo": ["Performer Straps"],
  "Straps Aéreos - dueto": ["Performer Straps"],
  "Pórtico Aéreos": ["Técnico de Rigging", "Acrobata Aéreo(a)"],
  "Spiral - plataforma": ["Performer Plataforma"],
  "Lollipop - plataforma": ["Performer Plataforma"],
  "Chandelier - plataforma": ["Performer Plataforma"],
  "Diamante - plataforma": ["Performer Plataforma"],
  "Animador / Host": ["Animador / Host", "MC"],
  "Animador Infantil c/ jogos": ["Animador Infantil"],
  "Make-up & Hair": ["Make-up & Hair"],
  "Guarda Roupa": ["Guarda-Roupa"],
  "Produtor": ["Produtor"],
  "Trio Fado": ["Cantor(a) Fado", "Guitarra Portuguesa", "Viola/Guitarra Fado"],
  "Annia Solo": ["Cantor(a)"],
  "Annia Solo c/ AVs": ["Cantor(a)"],
  "Banda Duo s/ AV": ["Cantor(a)", "Pianista", "Guitarrista"],
  "Banda Duo c/ AVs": ["Cantor(a)", "Pianista", "Guitarrista"],
  "Banda Trio s/ AV": ["Cantor(a)", "Pianista", "Saxofonista", "Guitarrista"],
  "Banda Trio c/ AVs": ["Cantor(a)", "Pianista", "Saxofonista", "Guitarrista"],
  "Banda quarteto s/ AV": ["Cantor(a)", "Pianista", "Saxofonista", "Baixista"],
  "Banda quarteto c/ AVs": ["Cantor(a)", "Pianista", "Saxofonista", "Baixista"],
  "Banda quinteto s/ AV": ["Cantor(a)", "Pianista", "Saxofonista", "Guitarrista", "Baterista"],
  "Banda quinteto c/ AVs": ["Cantor(a)", "Pianista", "Saxofonista", "Guitarrista", "Baterista"],
  "Banda quinteto + Cantor": ["Cantor(a)", "Pianista", "Saxofonista", "Guitarrista", "Baterista"],
  "Banda quinteto + Cantor c/ AVs": ["Cantor(a)", "Pianista", "Saxofonista", "Guitarrista", "Baterista"],
  "Banda quinteto + 2 Back Vocals": ["Cantor(a)", "Pianista", "Saxofonista", "Guitarrista", "Baterista"],
  "Banda quinteto + 2 BVs c/ AVs": ["Cantor(a)", "Pianista", "Saxofonista", "Guitarrista", "Baterista"],
  "Técnico de Som": ["Técnico de Som"],
  "Técnico de Luz": ["Técnico de Luz"],
};

export function skillsForServicosContratados(value?: string | null): string[] {
  return Array.from(new Set(parseServicosContratados(value).flatMap(s => SERVICO_SKILL_LINKS[s] || [])));
}
