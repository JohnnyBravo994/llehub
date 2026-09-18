# v29 — Auditoria transversal de runtime

Revisão feita depois do erro `ReferenceError: Cannot access 'tk' before initialization` observado em Leads.

## O que foi verificado

- Agenda
- Leads
- Faturação
- Pagamentos
- Colaboradores
- Residências
- Packs
- Materiais
- Clientes
- Valores
- Dashboard
- componentes partilhados e actions

## Correções adicionais

1. Agenda: `Colors` passa a ser inicializado logo após o estado de tema, antes de qualquer helper de render que o use.
2. Pagamentos: `filtered` / `byMonth` passam a ser calculados antes do helper de exportação CSV, eliminando outra referência a binding lexical definido mais tarde.
3. Packs: deixou de existir `materials.sort(...)` diretamente sobre o array de state; usa agora uma cópia (`[...materials].sort(...)`).
4. Tema: leitura do booleano de tema deixou de depender de `JSON.parse`, evitando crash por storage inválido.
5. Error boundary: mostra opcionalmente detalhes técnicos (`error.name`, `error.message`, `digest`) para diagnóstico futuro sem depender do DevTools.

## Proteção preventiva

Foi adicionado `npm run audit:runtime`, e `prebuild` executa-o automaticamente antes de `next build`.
O audit procura dependências entre `const`/`let` em inicializadores dentro do mesmo componente/função que possam causar Temporal Dead Zone em runtime.

## Validações executadas

- Runtime-order audit: 27 ficheiros TS/TSX, 0 problemas.
- Transpile TypeScript: 30 ficheiros TS/TSX, 0 erros de parsing/transpilação.
- Auditoria com `strictNullChecks`: 0 avisos de null/undefined/order nos ficheiros da aplicação; as únicas mensagens restantes no stub de auditoria são limitações do próprio stub (`key` JSX e `Viewport` do Next).

O `next build` completo não foi executado neste ambiente porque o ZIP não inclui uma instalação funcional de todas as dependências npm.
