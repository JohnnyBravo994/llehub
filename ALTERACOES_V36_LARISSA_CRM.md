# LLE Hub v36 — permissões comerciais e benchmark CRM

Base: v35 (notas da Agenda e Leads preservadas).

## Larissa (perfil `limited_novalues`)
- Leads: criar, editar, ver e alterar faturação estimada, valores recebidos e estados; consultar a tabela no desktop e telemóvel.
- Ações de apagar/cancelar/repor e conversão manual não foram adicionadas ao perfil Marketing.
- Custos dos artistas, margens/lucros, relatórios financeiros e módulos de gestão continuam ocultos na interface.
- Alterar Leads em Marketing não substitui automaticamente artistas nem packs de materiais existentes.
- Clientes: criar/editar/consultar, sem permissão de eliminação.

## CRM / One Damn Place
Website analisado: https://www.onedamnplace.com/index-en.html
Referências úteis para melhorias futuras: pipeline de prospeção por etapas, próxima ação/responsável por oportunidade, historial de contactos e tarefas, propostas rastreadas, ficha única por cliente. A v36 não reproduz funcionalidades desta plataforma nem altera a arquitetura do CRM existente.

## Segurança / produção
A autenticação e as permissões são aplicadas sobretudo no navegador/localStorage e as Server Actions não validam identidade no servidor. Assim, esconder campos NÃO constitui proteção real de dados financeiros. Antes de produção com dados sensíveis é necessário implementar sessão autenticada no servidor e validação de permissões por operação.

Sem alterações à base de dados. Sem novas dependências. Não executar alterações estruturais ao publicar.
