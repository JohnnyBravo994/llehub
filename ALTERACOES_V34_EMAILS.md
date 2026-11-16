# v34 — Correção dos emails departamentais LLE

**Marketing:** `Dept.marketing@lifeliveevent.eu`  
**Comercial:** `Dept.comercial@lifeliveevent.eu`

- Atualizado o endereço de destino predefinido do pedido de presença de Marketing em `app/actions.ts`.
- Sem alterações na Agenda, relatórios, CRM, permissões, base de dados ou desempenho.
- O endereço Comercial é registado aqui como referência; a v33 não tem uma notificação automática de Comercial equivalente à checkbox de Marketing, pelo que não foi inventada.

## Configuração na Vercel

Em **Project Settings → Environment Variables**, atualizar a variável existente `MARKETING_EMAIL` para:

`Dept.marketing@lifeliveevent.eu`

Se esta variável existir, prevalece sobre o endereço predefinido definido no código. Para o Comercial, `COMERCIAL_EMAIL=Dept.comercial@lifeliveevent.eu` só será necessária quando houver uma funcionalidade de envio comercial implementada.

Manter `RESEND_API_KEY` e `RESEND_FROM_EMAIL` configuradas. Fazer novo deployment depois de atualizar as variáveis ou publicar o novo código. Nunca incluir chaves privadas no GitHub.
