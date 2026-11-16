# v18 — Residências fora de Colaboradores

## Regra
A página **Colaboradores** deixa de definir valores próprios de Residência.

### Colaboradores mantém
- Custo Evento
- Faturação SUD
- Faturação Evento Residência
- Faturação Parceria
- Faturação Cliente Final
- Classificação por skill

### Residências é a fonte exclusiva para
- Custo Residência
- Faturação Residência

Na Agenda e Leads, quando o contexto é **Residência**, o custo/faturação são obtidos da Residência escolhida. Se não existir valor aplicável, o sistema deixa o valor por definir em vez de usar silenciosamente o Custo Evento do colaborador.

Os campos antigos na estrutura da base de dados são mantidos apenas por compatibilidade histórica, mas deixaram de ser expostos, gravados ou usados pelo fluxo atual de Colaboradores.
