# V34 · Fecho Mensal Automático

Base: LLE Hub v33 (permissões da Larissa para Agenda, Leads e Clientes, apenas consulta).

## Funcionalidades

- Na Agenda, botão **Relatório Mensal** no desktop e no telemóvel (João, Tânia, Inês, Soraya).
- Selecionar mês e ano, inicialmente o mês escolhido na Agenda; **Ver PDF** abre a pré-visualização de impressão do browser e permite «Guardar como PDF».
- Mantém o PDF da Agenda existente sem alterações.
- Relatório independente dos filtros visuais da Agenda, obtendo eventos, cachês e custos de materiais diretamente da BD nos meses atual e anterior.
- Quatro estados de comercialização incluídos em conjunto: Confirmado, Adjudicado, Faturado e Pago. Apresenta faturado/Pago e recebido em métricas distintas. Não inclui cancelados, atividades sem valor ou estados preliminares.
- Dentro/Fora por **modalidade da Agenda**: Fatura=100% Dentro; Por Fora=100% Fora; 50% Por Fora=50/50; 10% Por Fora=90/10. Custos divididos na mesma proporção nas modalidades mistas.
- Atuações exclusivamente do João/Gio = repasses, sem margem LLE; atuações mistas João+equipa mantêm-se operacionais.
- Tânia/Annia: custo real externo zero; substituição de residências=100% da respetiva faturação; substituição de eventos/casamentos=fee de Tânia registado no evento. Fee de substituição em falta fica pendente.
- Custos de artistas e materiais, sem estimativas ocultas. Zero de cachês de artistas externos e atuações sem artistas assinalados para validação. Lucro final não é fechado se houver custos pendentes.
- Nova opção «Categoria para o relatório» na ficha da Agenda (automática / Evento / Casamento / Residência), independente da tabela comercial/Auto Budget. A nova coluna é adicionada de forma não destrutiva.
- Salários mensalizados como confirmado: Soraya 1.080€, Tânia 1.467,33€, Larissa 809,67€, João 300€, Inês 500€, Vilma 210€.
- Gastos fixos segundo o modelo de junho/2026, com NOS 47,99€ até outubro, DIGI provisória de 23,50€ a partir de novembro; Goldie apenas até outubro.
- Informações de IVA apenas para volume Dentro; nenhum cálculo de IVA, IRC ou impostos extraordinários. Valores operacionais pressupostos sem IVA.
- Comparativo com mês anterior; sem comparação anual.

## Limitações e precauções

- A autenticação do Hub original continua a basear-se em localStorage e password no frontend. Os controlos de UI e validação do nome no server action **não são uma garantia de autorização segura**; migrar autenticação para sessão validada no servidor antes de tratar o relatório como privado.
- Sem acesso à BD em produção, os cálculos não foram testados contra dados reais, apenas contra casos de teste sintéticos. Valores históricos anteriores a junho/2026 não têm vencimentos/fixos validados; a simulação assinala a limitação.
- «Ver PDF» inicia a impressão/pré-visualização do browser, o mesmo mecanismo do PDF da Agenda existente. Selecionar «Guardar como PDF» para exportar; não é criado ficheiro no servidor.
- Os valores de recebimentos vêm da Agenda, sem conciliação com a Moloni ou extratos bancários. Os quatro estados são volume comercial e não faturação contabilística.
- Um cachê de zero para artista externo fica pendente até confirmação. Para serviços apenas com materiais e sem artistas, a ausência de equipa também é sinalizada.
