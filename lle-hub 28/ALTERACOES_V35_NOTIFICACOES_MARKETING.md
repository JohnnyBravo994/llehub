# LLE Hub v35 — Notificações à equipa de Marketing

## O que foi acrescentado

- Check «Equipa de Marketing — notificar por email» no formulário de criar/editar eventos da Agenda.
- Envio **após guardar o evento e sincronizar as pessoas**, para `deptMarketing@lifeliveevent.eu`, com:
  - nome do evento;
  - data (DD/MM/AAAA);
  - hora/intervalo horário;
  - local;
  - nome e função dos artistas/colaboradores associados ao evento;
  - nomes existentes na classificação «Equipa / Tipo» que não apareçam entre os artistas, excluindo a etiqueta genérica «Empresa».
- Nunca inclui valores, pagamentos ou custos.
- Estado por evento (não solicitado, pendente, a enviar, enviado, erro). Mostra uma indicação na Agenda (computador e telemóvel).
- Não envia duplicados só porque se voltou a guardar o evento. Desmarcar e guardar, seguido de voltar a marcar e guardar, inicia um novo pedido de notificação.
- Se faltar equipa/pessoas ou credenciais de email, guarda o pedido como pendente; é possível voltar a guardar o evento para tentar o envio.
- Nas residências criadas para vários dias, cada evento tem o seu pedido/notificação.

## Configuração obrigatória para o envio real

O ZIP **não contém** credenciais de email. O envio efetivo exige colocar estas **variáveis de ambiente do lado do servidor** no serviço de alojamento (por exemplo, Vercel):

```
RESEND_API_KEY=<chave privada do Resend>
MARKETING_FROM_EMAIL=notificacoes@<dominio-verificado>
```

Deve verificar o domínio/endereço de origem no serviço Resend. O destinatário está fixo no código: `deptMarketing@lifeliveevent.eu`.
Depois de configurar as variáveis, é necessário fazer novo deployment. Não escrever a chave no código nem numa variável `NEXT_PUBLIC_*`.

### Comportamento em caso de erro

- A API de email deve aceitar a mensagem para surgir como «enviado»; isto **não prova** a receção na caixa de entrada (a entrega depende do serviço externo).
- Ausência de pessoas associadas: «pendente» sem envio.
- Ausência de configuração: «pendente» sem envio.
- Erro de comunicação com o fornecedor: «erro» e opção de tentar novamente guardando.
- Repetir a gravação de um evento já enviado **não** gera outro email.

## Alterações técnicas

- `app/actions.ts`: migração não destrutiva da tabela `agenda` e função `guardarNotificacaoMarketing`.
- `app/agenda/page.tsx`: formulário, sinalização de estado e ligação após sincronizar artistas.
- Envios realizados **no servidor**, através da API do Resend, sem nova dependência npm; chave de idempotência para proteção de duplicados.

## Limitações e segurança

- A versão v34 já tem autenticação essencialmente no frontend. A verificação de utilizador nesta ação não substitui **autenticação e autorização reais no backend**. Antes de colocar em produção, reforçar a autenticação do Hub para prevenir pedidos forjados. O envio está limitado a um único endereço fixo para reduzir abuso.
- A receção real dos emails e o funcionamento com a base de dados Turso de produção ainda **não foram testados** nesta entrega.
- Pedidos já enviados não geram automaticamente notificações de atualização quando se alteram os artistas ou o horário. Para enviar novamente é necessário desmarcar e voltar a marcar em duas gravações.

## Testes realizados

- Parse/transpilação TypeScript dos dois ficheiros alterados: OK.
- Cenários com servidor/API simulados: envio com dados do evento; ausência de duplicados; novo pedido após desmarcação; pessoas em falta; configuração em falta; erro do fornecedor; utilizador não autorizado: OK.
- Teste integral da aplicação não realizado por ausência das dependências npm disponíveis localmente e credenciais de produção.
