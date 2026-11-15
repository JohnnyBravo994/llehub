# v24 — Valor pago + percentagem paga

## Agenda
- Adicionado `Valor pago até agora (€)` no formulário.
- Mostra percentagem paga e valor ainda por receber.
- Barra visual de progresso do pagamento.
- Cards desktop/mobile mostram percentagem paga.
- Estado `Pago` preenche automaticamente o valor pago com 100% da faturação.
- Alterar a faturação enquanto o estado é `Pago` mantém o valor pago sincronizado.

## Leads
- Adicionado `Valor pago até agora (€)` no formulário.
- Mostra percentagem paga, valor por receber e barra de progresso.
- Cards desktop/mobile mostram percentagem paga.
- Ao converter uma lead em evento, o valor já recebido é preservado.
- Estado `Pago` preenche automaticamente 100%.

## Faturação
- O valor recebido passa a ser editável em qualquer item não cancelado, e não apenas em `Adjudicado`.
- Mostra `valor recebido + percentagem paga` por evento/lead.
- Barra de progresso no desktop.
- Edição do valor recebido disponível também no mobile.
- Totais de `Recebido` e `A Receber` passam a considerar pagamentos parciais em todos os estados.
- Resumo por cliente mostra percentagem total paga.
- Eventos futuros com pagamentos já recebidos passam a aparecer na Faturação.
- Mudar o estado para `Pago` grava automaticamente o total como recebido.

## Dados
- Usa a coluna já existente `valor_recebido` em Agenda e Leads.
- O valor recebido é sincronizado entre Lead e Agenda quando partilham `event_id`.
