# Materiais e Valores — desempenho e reservas

- A entrada em **Materiais** carrega apenas movimentos realmente fora, reservas futuras e contagens essenciais.
- Histórico, catálogo, valores, packs, imagens e lista de eventos são carregados apenas ao abrir a respetiva área ou ação.
- Os movimentos iniciais deixam de transportar imagens em base64, reduzindo significativamente o payload.
- Reservar um pack já não cria uma saída física de material.
- Reservas aparecem como **“Reservado — ainda no local”** e oferecem a ação **“Registar saída”**.
- Registos automáticos antigos de reservas são corrigidos por uma migração única.
- Em **Valores**, a análise de serviços usados só corre quando solicitada.
- Mobile e desktop deixaram de ser renderizados simultaneamente: apenas a versão correspondente ao ecrã é criada.
- Navegação mobile usa transições internas e prefetch.
- Validação concluída com TypeScript e build de produção das 13 páginas.
