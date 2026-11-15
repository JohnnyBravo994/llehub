# LLE Hub v16 — Custos vs Faturação

## Separação de conceitos

- **Custo Evento** e **Custo Residência** representam quanto a LLE prevê pagar ao artista.
- **Faturação** representa quanto a LLE pede ao cliente e é independente do custo do artista.

## Colaboradores

Por skill/função existem agora:
- Custo Evento
- Custo Residência
- Faturação SUD
- Faturação Residência
- Faturação Evento Residência
- Faturação Parceria
- Faturação Cliente Final
- classificação por estrelas

As gavetas continuam por ordem alfabética; artistas usam estrelas como ordenação default e podem ser ordenados por ABC ou qualquer valor.

## Residências

Cada residência pode definir overrides próprios para:
- custo numa Residência
- custo num Evento de Residência
- faturação numa Residência
- faturação num Evento de Residência

Quando um override de Residência se aplica, ele tem prioridade. Na ausência de override, usa os valores da skill do Colaborador.

## Agenda e Leads

O **Contexto do Trabalho** continua fora do Auto Budget e determina o custo sugerido do artista:
- Evento → Custo Evento do colaborador
- Residência → custo da residência, se aplicável; senão Custo Residência do colaborador
- Evento de Residência → custo de evento da residência, se aplicável; senão Custo Evento do colaborador

O custo sugerido é sempre editável. Depois de guardado no evento/lead, não depende de futuras alterações à tabela do colaborador.

A origem do custo é mostrada junto ao campo do artista.

## Auto Budget

- Packs continuam primeiro; Standalones depois.
- Standalones são derivados das skills dos colaboradores.
- Faturação de referência usa o maior valor ativo daquela skill no perfil escolhido.
- Custo estimado usa o maior custo aplicável da skill, de forma conservadora.
- Residências podem sobrepor faturação/custo quando o serviço corresponde.
- Standalones continuam visíveis mesmo sem colaborador ativo; nesse caso ficam sem preço automático em vez de desaparecer.
- Quantidades mostram progresso de atribuição de artistas (ex.: 2/4 atribuídos).
- Ao aplicar o Auto Budget é guardado um snapshot da origem e dos valores usados, para preservar contexto histórico.

## Histórico e compatibilidade

Campos legados são mantidos e migrados para o novo modelo para reduzir risco de perda de dados. A página Valores antiga ainda não foi removida.

## Próximo passo

Criar **Packs** como entidade/página própria, composta por standalones/skills + materiais, com preços comerciais próprios. Não foi criada uma página Standalones.
