# LLE Hub v40 — Agenda: Marketing, CRM e Relatórios para todos

## Causa corrigida
Na v39, o separador Marketing estava restrito a João, Tânia, Inês e Soraya no cliente e nas ações do servidor; o PDF de Fecho Mensal tinha essa restrição e ainda uma exigência adicional de perfil financeiro. O check de Marketing estava apenas num separador no início do formulário, fora da zona de edição habitual.

## Funcionalidades
- Acesso às ferramentas de Marketing, CRM e Relatório Mensal na Agenda para os cinco utilizadores atuais: João, Tânia, Inês, Soraya e Larissa.
- Check de Marketing também dentro do separador **Evento**, junto de materiais, para ficar à vista no formulário que a equipa já usa; permanece igualmente acessível no separador Marketing. É **um único campo**, não duas notificações.
- Os perfis sem valores, como Larissa, podem abrir CRM e Marketing. Ao guardar Marketing fazem uma alteração **isolada**, sem regravar preço, artistas, pagamentos ou outros campos financeiros.
- PDF Fecho Mensal, com seleção de mês e ano, disponível no topo da Agenda (desktop) e no botão «Relatório» (mobile). O gerador e a função de servidor aceitam os mesmos perfis da Agenda.
- Marca `CRM v40` na Agenda para confirmar a versão publicada.

## Atenção: confidencialidade
O relatório mensal é financeiro: contém faturação, lucros, cachês, salários e despesas fixas. A Larissa passa a poder gerar e ver o PDF completo, mesmo mantendo a edição de preços e custos bloqueada na ficha da Agenda. Antes de publicar, confirmar se é essa a política pretendida.

## Validação / publicação
1. Fazer backup da base de dados antes de publicar.
2. Instalar/publicar esta v40. A operação não é feita por descarregar o ZIP.
3. Na Agenda confirmar `CRM v40`, abrir um evento existente e verificar o check «Equipa de Marketing» abaixo de «Usar materiais».
4. Confirmar separadores Evento / CRM / Marketing, conforme o perfil.
5. Em desktop verificar «Relatório mensal»; em mobile verificar «Relatório». Selecionar mês/ano e «Ver PDF».
6. Testar Marketing com conta Resend gratuita e domínio verificado. O email real requer `RESEND_API_KEY` e DNS configurados.
7. Confirmar resultados com a base de dados real e realizar testes de interface antes de uso em produção.

## Segurança pré-existente
A autenticação continua a depender do frontend: a verificação de permissões através de `userName` recebido da aplicação não substitui autenticação verificada pelo servidor. Reforçar a autenticação é necessário antes de considerar estes dados financeiros protegidos.
