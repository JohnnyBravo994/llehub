# V31 — Cancelamento consistente

## Problema
Um evento podia ter `billing_status = Cancelado` mas manter `agenda.status = Confirmado`. A Agenda aparentava cancelamento comercial, enquanto a Dashboard filtrava apenas pelo estado estrutural e podia continuar a mostrar o evento.

## Correções
- Dashboard passa a excluir cancelados por `agenda.status` **ou** `agenda.billing_status`, no SQL e no frontend.
- Criar evento com estado comercial `Cancelado` grava também `agenda.status = Cancelado`.
- Editar um evento e selecionar `Cancelado` grava também o estado estrutural como cancelado.
- Alterar o estado pela Faturação para `Cancelado` também sincroniza o estado estrutural.
- `propagateByEventId()` propaga um cancelamento para `agenda.status`, sem restaurar eventos automaticamente quando o estado comercial volta a outro valor.
- Normalizadores da Agenda tratam dados antigos inconsistentes como cancelados se qualquer um dos dois campos indicar cancelamento.
- Seletores operacionais de materiais deixam de incluir eventos com `billing_status` cancelado, mesmo que dados antigos tenham `status` incoerente.

## Regra de segurança
Mudar `billing_status` de `Cancelado` para outro estado **não restaura automaticamente** um evento estruturalmente cancelado. O restauro continua a ser uma ação explícita via `restoreAgendaEvent()`, evitando reativação acidental.
