# Correção final — autocomplete de artistas

## Problemas corrigidos

1. **Aliases históricos duplicados**
   - Entradas como `ANTONIO` e `António Coimbra`, quando ligadas ao mesmo `colaborador_id`, passam a representar uma única pessoa.
   - A deduplicação é feita primeiro pelo ID real do colaborador, não pelo texto escrito no evento antigo.
   - O nome apresentado é sempre o nome atual definido na ficha de Colaboradores.

2. **Dropdown vazio**
   - Ao focar o campo sem escrever texto, são apresentados todos os colaboradores ativos compatíveis com o tipo selecionado.
   - Exemplo: `DJ` mostra todos os DJs; `Técnico de Som` mostra todos os técnicos de som.
   - A lista deixou de estar limitada às primeiras oito pessoas e continua com scroll quando necessário.

3. **Filtro por função**
   - Os colaboradores são filtrados pelas skills atuais da respetiva ficha.
   - Nomes históricos ligados a um colaborador obedecem também às skills atuais desse colaborador.
   - Um colaborador sem a função selecionada não aparece artificialmente nessa função.

4. **Pesquisa por nomes antigos e atuais**
   - A pesquisa reconhece nome atual, nome artístico, nome pessoal e aliases históricos ligados pelo ID.
   - Um alias histórico devolve o registo atual, sem criar uma segunda opção.

## Aplicação

A mesma lógica foi aplicada em:

- Agenda
- Leads

Não houve alterações à base de dados, às tabelas nem ao processo de guardar eventos.

## Validação

- `npm ci`: concluído
- `npx tsc --noEmit`: concluído sem erros
- `npm run build`: concluído sem erros
- Testes funcionais da lógica: 5 cenários passaram, incluindo deduplicação por ID, dropdown vazio por função e ocultação do nome já selecionado

Data: 11 de julho de 2026
