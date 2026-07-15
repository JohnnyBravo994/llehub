# Gestão de materiais por evento

## Correções

- Reservar um material na Agenda deixa de criar uma saída física.
- Reservas individuais passam a ser guardadas em `material_reservas`.
- `material_movimentos.saida_confirmada` distingue uma reserva antiga de uma saída real.
- Registos antigos criados pela antiga ação “Reservar” são reclassificados quando não têm `quem_levou` e foram criados mais de dois dias antes do evento.
- Registos antigos que duplicavam materiais já incluídos num pack deixam de ser contados duas vezes.

## Edição no evento

No modal de edição do evento existe agora **Gerir materiais**. Nessa área é possível:

- alterar a quantidade reservada;
- remover uma reserva;
- registar a saída física;
- marcar um material que está fora como devolvido;
- remover uma saída incorreta;
- adicionar uma nova reserva sem a transformar automaticamente em “Fora”.

## Estados

- **Reservado · ainda no local**: associado ao evento, mas fisicamente no local habitual;
- **Fora**: saída confirmada por uma ação explícita;
- **Devolvido**: regresso confirmado.

As imagens continuam a ser carregadas apenas para os itens visíveis, sem voltar a carregar o catálogo completo na entrada de Materiais.
