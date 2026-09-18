# v27 — Estabilidade de edição / Safari

- Removido `backdrop-filter` dos overlays fullscreen, que obrigava o Safari a recompor/blurar páginas muito grandes a cada tecla.
- Agenda, Leads e Colaboradores deixam de manter a listagem pesada renderizada enquanto o editor principal está aberto.
- Campos numéricos de Agenda/Leads deixam de limpar o valor via state no `focus`; passam a selecionar o conteúdo.
- Cálculos de pagamentos usam conversão numérica tolerante a estados intermédios/inválidos.
- Faturação: edição do valor recebido usa estado local isolado, evitando re-render da lista inteira a cada tecla.
- Adicionado `app/error.tsx` para capturar erros normais de renderização e permitir retry dentro da Hub.
- Nenhum dado/campo de negócio removido.
