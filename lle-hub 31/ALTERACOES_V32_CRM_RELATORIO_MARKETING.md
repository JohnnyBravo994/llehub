# LLE Hub · Correções v32 · 16/11/2026

## Alterações incluídas

1. **CRM unificado**: nova vista `/crm`, acessível pelos menus, pela página Leads e pela página Clientes. Associa fichas de clientes às Leads e aos eventos da Agenda, evitando contar Leads convertidas duas vezes. A vista não devolve valores financeiros.
2. **Clientes para Larissa**: perfil `limited_novalues` pode consultar Clientes e CRM; não pode criar, editar ou eliminar Clientes na interface. Também foi ajustada a navegação móvel, sem separadores financeiros para este perfil.
3. **Relatório financeiro mensal**: nova página `/relatorio-mensal` com seleção de mês/ano, faturação, Dentro/Fora, custos dos eventos, lucro total, vencimentos, gastos fixos, lucro real, categorias, lista de acontecimentos e comparativos com o mês anterior e ano anterior. A ligação antiga `/relatorio-anual` redireciona para a nova. Os custos fixos e vencimentos são configurados por mês e só são considerados depois de registados. PDF via impressão do navegador.
4. **Pedido de Marketing por evento**: checkbox no formulário da Agenda, ao lado da gestão de materiais; quando marcada e o evento é guardado, é registada a solicitação e é enviado um email com nome do evento, data, horário, local e nomes/funções da equipa. A notificação só é enviada uma vez por ativação; desativar e voltar a ativar cria um novo pedido. Se o fornecedor falhar, o pedido mantém-se guardado como pendente e pode ser reenviado ao voltar a guardar.

## Configuração obrigatória para enviar emails

No projeto alojado (Vercel / Settings / Environment Variables), adicionar:

- `RESEND_API_KEY`: chave da API do fornecedor Resend.
- `RESEND_FROM_EMAIL`: remetente com domínio verificado no Resend, por exemplo `notificacoes@lifeliveevent.eu` **apenas se esse endereço estiver autorizado no fornecedor**.
- `MARKETING_EMAIL`: opcional; por defeito, `deptMarketing@lifeliveevent.eu`.

Depois de configurar, republicar a aplicação. Sem as duas primeiras variáveis, a checkbox funciona e fica guardada, mas **nenhum email pode ser enviado** e o Hub apresenta uma mensagem de pendência. O envio depende de uma conta Resend válida e de um remetente verificado.

## Restrições e verificações

- A base de dados do ZIP não foi alterada; as tabelas adicionais são criadas na primeira utilização.
- A autenticação atual é baseada principalmente no navegador. Estas correções **não tornam as operações financeiras seguras contra pedidos de rede não autorizados**. É necessária autenticação e autorização reais no servidor antes de expor o Hub a terceiros.
- A divisão proporcional dos custos entre Dentro/Fora e o IVA informativo são estimativas contabilísticas e devem ser validadas com a contabilidade.
- O comparativo anual usa os registos existentes no Hub, não dados certificados do Moloni.
- A compilação integral não pôde ser executada neste ambiente por indisponibilidade de dependências; foi executada auditoria interna de runtime e parsing TypeScript/TSX.
