# LLE Hub v37 — CRM integrado (Leads, Clientes e Agenda)

## O que muda

- **Leads:** tabela original mantida. Novo botão **Abrir CRM** em cada linha; nome da lead abre a ficha 360º. Nova vista **Kanban** de consulta por estado comercial, com acesso à mesma ficha. No telemóvel, tocar no cartão abre o CRM; o botão **Editar** mantém a edição comercial existente para os utilizadores autorizados.
- **Clientes:** botão **Abrir CRM**, incluindo no telemóvel. Os formulários existentes de Cliente não foram substituídos. Larissa continua sem permissão de editar os campos existentes de Clientes.
- **Agenda:** botão **Abrir CRM** em cada evento, com nome clicável. No telemóvel, tocar no nome/corpo abre o CRM; **Editar** mantém o editor anterior. O CRM mostra equipa atribuída sem apresentar cachês.
- **Ficha CRM:** página completa com separadores **Resumo**, **Histórico**, **Tarefas** e **Relacionados**, inspirada numa ficha do Notion e com as cores e tipografia do Hub.
- **Proveniência:** origem, detalhe da origem (quem recomendou, campanha), canal de entrada, data do primeiro contacto, pessoa que contactou, responsável LLE, etiquetas e briefing.
- **Interações:** contacto inicial, email, telefone, WhatsApp, reuniões, propostas, follow-ups e notas; guarda quem registou, com quem falou, quando e resumo.
- **Tarefas:** criação, atribuição, prazo, conclusão/reabertura, registo na cronologia; centro de tarefas **As minhas tarefas** e **Toda a equipa**.
- **Relacionados:** links por `cliente_id`, `origem_lead_id` ou `event_id`; não une clientes apenas por nomes semelhantes.

## Preservação de dados

Nenhum `DROP`, `DELETE` ou alteração dos campos financeiros/operacionais foi acrescentado às tabelas antigas. Os novos conteúdos ficam apenas em três tabelas:

- `crm_fichas`
- `crm_interacoes`
- `crm_tarefas`

As tabelas são criadas de forma idempotente automaticamente no primeiro acesso ao CRM. Os eventos, artistas, materiais, estados, faturação, pagamentos, notificações de marketing e relatórios da v36 mantêm os códigos e tabelas anteriores. Os nomes e equipas existentes aparecem na ficha CRM em modo consulta.

**Antes de publicar:** criar um backup completo da base de dados Turso em produção e testar numa cópia de staging. O ZIP inclui o projeto de código, não altera automaticamente os dados de produção nem publica a versão.

## Permissões

- Os utilizadores habituais com acesso a Leads/Clientes/Agenda podem acrescentar informações na **camada de CRM** (incluindo Larissa).
- Larissa não ganha permissão para modificar os campos financeiros ou os formulários antigos de Leads/Clientes/Agenda; não aparecem valores financeiros no novo CRM.
- A visibilidade da Agenda de Larissa continua filtrada para eventos públicos nos ecrãs e consultas CRM conforme nome de utilizador da versão atual.

**Limitação de segurança herdada:** a autenticação original da aplicação baseia-se essencialmente no browser/localStorage. As ações CRM ainda não são protegidas por sessões autenticadas e permissões verificadas no servidor. O nome do utilizador enviado pelo browser pode ser falsificado. Antes de utilizar com dados confidenciais em produção, é recomendado introduzir autenticação de servidor (cookies de sessão assinados) e controlo de acesso por papel/identidade. Não considerar o filtro atual uma fronteira de segurança.

## Testes executados

- Verificação da sintaxe de todos os ficheiros TS/TSX: sem erros de parsing.
- `npm run audit:runtime`: passou para os 32 ficheiros TS/TSX.
- Testes SQL com SQLite em memória: criação idempotente das 3 tabelas, inserção/atualização de perfil CRM, histórico, tarefas, ligações por ID e preservação das linhas das tabelas legadas.
- **Não executado:** build Next.js nem teste de interface com a base de dados de produção. O `npm ci` falhou por indisponibilidade de acesso à registry npm (`EAI_AGAIN`).

## Próximos passos

Validar na base de testes com três cenários: (1) lead não convertida, (2) lead convertida para Agenda, (3) cliente com vários eventos. Depois reforçar a autenticação de servidor. A vista Kanban é de **consulta**, não contém drag-and-drop para mudar os estados comerciais, para não interferir com as sincronizações da v36.
