# v22 — Skills canónicas + gestão de duplicados de colaboradores

## Skills
- Corrigida a duplicação semântica de skills antigas (ex.: `Acordeão` passa para `Acordionista`).
- Adicionada normalização central de aliases para impedir novas gavetas duplicadas.
- Migração automática preserva os valores existentes quando junta variantes da mesma skill.
- Adicionadas as skills `Palhaço` e `Empregado Trapalhão`.

## Colaboradores duplicados
- Nova ação **Ligar colaboradores**.
- Escolhe-se o registo duplicado a retirar e o colaborador que fica.
- Histórico de Agenda/Leads associado ao duplicado é transferido para o colaborador que fica.
- Residências que tinham o duplicado como performer padrão passam para o colaborador mantido.
- Skills e dados são combinados; os dados já preenchidos no colaborador mantido têm prioridade.
- O duplicado é eliminado depois da transferência.

## Retirar colaborador
- Nova ação **Retirar** no perfil.
- Só permite eliminação definitiva se o colaborador não tiver Agenda/Residências associadas.
- Quando existe histórico, a app bloqueia a eliminação e recomenda ligar/fundir ou desativar, evitando perda de histórico.
