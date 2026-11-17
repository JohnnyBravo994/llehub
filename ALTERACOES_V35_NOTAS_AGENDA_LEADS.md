# v35 — Notas na Agenda e em Leads (preservação do histórico)

- Agenda: o campo **Notas / Observações do evento** está sempre visível, independentemente da checkbox de materiais. Utiliza a coluna `agenda.notas` existente.
- Leads: campo **Notas / Observações da Lead** expandido para texto multilinha, mantendo a coluna `leads.notas`.
- Compatibilidade: as leituras de Leads preferem o conteúdo da coluna `notas` e recorrem ao histórico `details` apenas quando a coluna está vazia.
- Integridade: ao sincronizar Agenda/Leads, o código deixa de substituir automaticamente `notas` na entidade ligada; cada módulo preserva os seus registos. A criação de um evento a partir de uma Lead continua a copiar as notas iniciais.
- Não existe migração SQL, `DELETE` ou limpeza de notas nesta atualização.

## Antes de publicar

Recomendado: criar uma cópia de segurança/snapshot da base de dados Turso, especialmente se houve gravações durante o período em que as notas estavam ocultas. A versão v35 não recupera dados que tenham sido efetivamente substituídos anteriormente; apenas repõe visibilidade e previne novas substituições entre módulos.
