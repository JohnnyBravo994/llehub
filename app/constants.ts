export const ARTIST_TIPOS = ["DJ", "Singer", "Dancer", "Sax", "Guitar", "Bass", "Drums", "Piano", "Violino", "Acordeão", "Trompete", "Percussão", "Fire", "Host", "MC", "Actor", "Comediante", "Mágico", "Coreógrafa", "Ginasta", "Produtor", "Guarda-Roupa", "Animador", "Karaoke"];
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
