# v17 · Packs comerciais

- Corrigida a nomenclatura: Evento de Residência usa **Faturação Evento Residência** (`valor_evento`).
- Nova página `/packs`.
- Packs têm faturação própria para SUD, Residência, Evento Residência, Parceria e Cliente Final.
- Packs são compostos por **skills** (standalones vindos de Colaboradores) e/ou **materiais**.
- Standalones continuam sem página própria.
- Packs existentes do Auto Budget são migrados para a nova tabela para preservar preços anteriores.
- Auto Budget passa a carregar Packs dinamicamente da página Packs, antes dos Standalones.
- Custo estimado do Pack é derivado da composição: custo das skills + custo interno dos materiais.
- Materiais incluídos num Pack são reservados automaticamente no evento; entram no custo, mas não acrescentam faturação novamente, evitando dupla cobrança.
- Nova navegação Packs em desktop e mobile.
