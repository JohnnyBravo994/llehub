# v15 · Auto Budget ligado a Colaboradores

## Alterações
- O Auto Budget continua a mostrar PACKS primeiro e STANDALONES depois.
- Os STANDALONES passam a nascer das skills dos colaboradores ativos, ordenadas alfabeticamente.
- A referência de preço de cada standalone é o valor mais alto configurado entre colaboradores ativos dessa skill para o perfil selecionado (SUD, Residência, Evento Residência, Parceria ou Cliente Final).
- O custo interno de referência usa o maior custo interno da skill.
- A sugestão mostra qual colaborador originou o valor máximo, para ser auditável.
- Serviços standalone suportam quantidade (ex.: Bailarino(a) ×4). O Auto Budget multiplica valor e custo pela quantidade.
- Packs permanecem com quantidade 1 e, temporariamente, continuam a usar a tabela de valores existente até existir o módulo próprio de Packs.
- Registos antigos continuam compatíveis: serviços já guardados permanecem selecionáveis e a serialização continua legível.
- Os custos dos artistas escolhidos continuam a ser guardados no evento/lead; alterações futuras aos preços de Colaboradores não reescrevem automaticamente o histórico já guardado.

## Próximo passo recomendado
Criar o módulo Packs como entidade própria, composto por skills/serviços + materiais, com os seus preços comerciais, sem criar uma página Standalones separada.
