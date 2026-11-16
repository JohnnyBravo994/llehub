# Mudanças de código

## `app/ArtistAutocomplete.tsx`

- O `colaborador_id` passou a ser a chave principal de deduplicação.
- O histórico é resolvido primeiro pelo ID e só depois pelos nomes atuais.
- O campo vazio devolve todos os colaboradores da função selecionada.
- A pesquisa considera nome, nome artístico, nome pessoal e alias histórico.
- A lista deixou de ter o limite fixo de oito resultados.
- O valor já selecionado não reaparece como sugestão.

## `app/agenda/page.tsx`

- O histórico enviado ao autocomplete passa a preservar `colaborador_id`.
- O autocomplete recebe também `nome_pessoal`.

## `app/leads/page.tsx`

- O histórico enviado ao autocomplete passa a preservar `colaborador_id`.
- O autocomplete recebe também `nome_pessoal`.

## Fora do âmbito

- Sem migrações de base de dados.
- Sem alterações a faturação, pagamentos, materiais, clientes ou autenticação.
- Sem alterações ao formato dos registos guardados.
