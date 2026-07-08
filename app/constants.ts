export const SERVICOS_VENDIDOS = [
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
] as const;

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
