# v28 — Correção runtime Leads

- Corrigido `ReferenceError: Cannot access ... before initialization` ao abrir Nova Lead.
- Causa: `colaboradoresAtivos` era ordenado com `colaboradorDisplayName()` antes da inicialização dessa função `const`.
- `colaboradorDisplayName` passa a ser inicializado antes de qualquer utilização e tolera nomes vazios.
- Mantidas as alterações de estabilidade da v27.
- O erro `AdGuard Extra Blocking ... SyntaxError` visto na consola pertence à extensão AdGuard, não à LLE Hub.
