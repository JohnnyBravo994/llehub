# LLE Hub v39 — Ficha única de Evento, Lead e Cliente

Base: v38. Esta atualização **não altera a estrutura das tabelas anteriores nem apaga dados**; reutiliza as três tabelas CRM criadas na v37.

## Agenda / Eventos
- Ao clicar no nome ou «Abrir ficha», abre **a própria ficha de edição** no separador CRM, não uma segunda página/formulário.
- A ficha tem **Evento** (campos originais e operações), **CRM · Histórico** (resumo, origem, contactos, tarefas, registos relacionados) e **Marketing**.
- Todos os campos anteriores da Agenda continuam na área Evento, incluindo artistas, custos, notas, materiais, troca de dia e ações de guardar/cancelar.
- **Check de Marketing agora no separador «Marketing», no topo da ficha**, e não misturado entre os campos do formulário. Visível apenas para João, Tânia, Inês e Soraya.
- **Ao guardar o evento com a opção assinalada**, o sistema tenta a notificação para `deptMarketing@lifeliveevent.eu` com nome, data, hora, local e pessoas atribuídas (sem valores financeiros). O remetente configurado é `deptComercial@lifeliveevent.eu` via Resend gratuito, sujeito à ativação das configurações de email da v36.
- «Guardar e notificar» não está disponível até terminar a leitura dos artistas, para evitar sobrescrever atribuições por engano.
- A Larissa abre o CRM do evento; a edição operacional e a opção de enviar Marketing não lhe são apresentadas.

## Leads
- Ao clicar no nome, num cartão Kanban ou em «Abrir ficha», abre a ficha única da Lead no separador CRM.
- Ao clicar em «Editar», abre o separador **Lead · Proposta** com todos os campos originais, incluindo ações de converter para Agenda.
- O separador CRM guarda proveniência, responsável, interações, próximas ações, histórico, tarefas e relações com clientes/eventos.
- A Larissa pode trabalhar o CRM, mas não vê o formulário de valores financeiros.
- O Kanban e a tabela anteriores foram mantidos.

## Clientes
- Nome e «Ver ficha» abrem o CRM na mesma ficha de Cliente.
- Utilizadores com edição podem alternar entre **Cliente · Dados** e **CRM · Histórico**.
- A Larissa vê apenas a parte CRM; o NIF é omitido da listagem desktop/mobile de leitura limitada.
- O CRM mostra contactos, histórico, tarefas, leads e eventos explicitamente associados (não por semelhança de nome).
- Desktop e mobile apresentam apenas uma instância de ficha de cada vez.

## Ligações antigas
- Endereços anteriores do tipo `/crm/evento/123`, `/crm/lead/123` e `/crm/cliente/123` são redirecionados para a ficha única do respetivo módulo, com o mês do registo quando conhecido.

## Preservação e verificação
- `app/actions.ts`, `app/crm-actions.ts`, ficheiros de faturação, materiais e pagamentos, base de dados e configuração do envio não foram alterados nesta atualização.
- Auditoria estática de ordem de execução e verificação de sintaxe TS/TSX passaram.
- **Não foi realizado um teste end-to-end** com o servidor Next.js e a base de dados Turso de produção; as dependências completas não estavam instaladas no ambiente de análise.
- As permissões continuam a depender de identidade fornecida pelo frontend e não equivalem a uma autenticação robusta no servidor. Reforçar antes de expor dados sensíveis.

## Como confirmar a versão em uso
1. Publicar a v39 no ambiente real (o download do ZIP não a publica por si).
2. Na Agenda, confirmar que aparece `CRM v39` no cabeçalho.
3. Abrir um evento: os separadores **Evento**, **CRM · Histórico** e **Marketing** devem aparecer para um dos quatro utilizadores autorizados.
4. Abrir Leads e Clientes e verificar que «Abrir ficha» apresenta separadores na mesma janela, tanto em desktop como em mobile.

**Aviso**: Fazer cópia de segurança da base de dados antes de testar a versão num ambiente conectado a dados reais.
