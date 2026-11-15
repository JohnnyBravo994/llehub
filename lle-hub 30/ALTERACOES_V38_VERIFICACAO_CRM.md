# v38 — Correção de visibilidade do CRM e Marketing

## Revisão realizada à v37
- v37 contém 4 ficheiros novos e 4 alterados face a v36; não era um ZIP igual ao anterior.
- A ficha de Marketing estava apenas no editor antigo da Agenda, não na página CRM nova.
- O ZIP original não publica automaticamente a versão num site; uma instalação/deploy é necessária.

## v38
- Mostra "CRM v38" na Agenda (mobile e desktop) para confirmar que a versão instalada é a correta.
- Torna o botão "CRM" explícito nos cartões de evento da Agenda no telemóvel, mantendo o botão Editar.
- Mostra e permite guardar o check "Notificar Marketing por email" na ficha CRM do evento para João, Tânia, Inês e Soraya.
- A ficha CRM apresenta o estado de Marketing: não solicitado, pendente, erro ou enviado.
- Utiliza a função existente de notificação: não duplica envios enquanto o pedido estiver enviado e notifica depois de guardar.
- Não altera tabelas antigas, artistas, cachês, relatórios nem lógica de faturação. Mantém a identidade visual.

## Limitações
- A publicação e a base de dados de produção não foram verificadas. O ZIP por si só não atualiza a versão online.
- O envio real depende de RESEND_API_KEY e do remetente/domínio configurados.
- Autenticação e permissões no servidor ainda carecem de correção; as contas no frontend não são seguras.
- A compilação completa Next.js exige as dependências npm, não disponíveis neste pacote.

## Como verificar depois de publicar
1. Abrir Agenda. Verificar "CRM v38" no cabeçalho no computador e no telemóvel.
2. Abrir um evento pelo botão "CRM" (mobile) ou "Abrir CRM" (desktop).
3. Na ficha CRM, separador Resumo, verificar "Equipa de Marketing" e o check para utilizadores autorizados.
4. Na Agenda antiga, editar evento e confirmar que o check original continua disponível.
5. Sem chave Resend, o pedido deve ficar pendente, nunca aparecer como email enviado.
