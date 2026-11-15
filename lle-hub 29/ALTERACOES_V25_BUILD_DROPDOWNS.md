# v25 — Build + dropdowns

- Corrigido erro TypeScript em Faturação (`editingRecebido` possivelmente `null`).
- Agenda e Leads começam com artista/skill vazios, sem pré-selecionar DJ.
- O autocomplete de artista permite escolher primeiro a pessoa sem forçar automaticamente a primeira skill.
- Dropdowns/listas de artistas e skills relevantes ordenados A→Z com locale pt-PT.
- Residências e gestão/ligação de colaboradores também ordenam os colaboradores alfabeticamente.
- Pagamentos ordena skills alfabeticamente e permite estado vazio ao adicionar artista.

- Removidos overrides manuais de `Cache-Control` do `next.config.ts`; o Next.js gere o cache de assets estáticos.
- Dropdown de origem na fusão de colaboradores também ordenado A→Z.
