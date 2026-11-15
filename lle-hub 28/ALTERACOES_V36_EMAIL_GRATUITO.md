# LLE Hub v36 — Notificação gratuita com remetente Comercial

## Alteração relativamente à v35

- Remetente fixo: **LLE Comercial <deptComercial@lifeliveevent.eu>**.
- Destinatário mantém-se: **deptMarketing@lifeliveevent.eu**.
- O check «Equipa de Marketing» continua na Agenda; enviar após guardar e sincronizar pessoas.
- Conteúdo mantém-se: nome do evento, data, hora, local, nomes e funções atribuídos, sem cachês, preços nem dados de faturação.
- Duplicados e estados pendente / enviado / erro seguem a lógica existente na v35.
- **Sem nova dependência npm e sem novo serviço pago.** O Resend permite o envio no plano gratuito (atualmente 3.000 emails/mês, máximo 100/dia). Sujeito aos termos do fornecedor.

## Para ativar o envio

1. Criar uma conta gratuita em https://resend.com/ (se não existir).
2. Adicionar **lifeliveevent.eu** em https://resend.com/domains e verificar os registos DNS solicitados (SPF/DKIM). Não modificar outros registos sem confirmar o impacto no email atual da empresa.
3. Criar uma API key no Resend.
4. Adicionar a variável de ambiente **RESEND_API_KEY** no alojamento da aplicação (servidor, por exemplo Vercel → Settings → Environment Variables).
5. Publicar a v36 e testar com um evento e destinatário reais. Não inserir a chave API no frontend, código ou neste chat.

O endereço deptComercial@lifeliveevent.eu não precisa fornecer palavra-passe: o fornecedor autoriza envios de endereços do domínio depois de o domínio ser verificado. A chave da API **é indispensável**.

## Limitações

- O código foi atualizado e verificado estaticamente, mas o envio real ainda depende da verificação do domínio e da credencial de produção.
- Estado «enviado» indica aceitação pela API, não comprova receção na caixa.
- A autenticação herdada do Hub é baseada no frontend; exige controlo de acesso no servidor antes de utilização em produção com dados confidenciais.
- Sem alterações ao design, permissões, esquema de base de dados ou cálculos financeiros.
