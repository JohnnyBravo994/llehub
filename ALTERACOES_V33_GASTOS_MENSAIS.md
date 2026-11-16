# LLE Hub v33 — custos mensais por rubrica

Esta atualização modifica apenas:

- `app/actions.ts`: valores de referência por mês de 2026 e persistência separada de cada custo mensal em `report_monthly_cost_lines`.
- `app/relatorio-mensal/page.tsx`: editor individual de vencimentos e despesas, totais automáticos e aviso para valores históricos por confirmar.

## Valores de referência — junho a outubro de 2026

- Google: 100,00 €; renda: 325,00 €; garagem: 275,00 €; Segurança Social: 829,69 €.
- EDP: 11,00 €; seguradora: 46,98 €; NOS: 47,99 €; Goldie: 29,99 €.
- Gastos fixos: **1.665,65 €/mês**.
- Vencimentos: Soraya 1.080,00 €; Tânia 1.467,33 €; Larissa 809,67 €; João 300,00 €; Inês 500,00 €; Vilma 210,00 €. **Total: 4.367,00 €/mês**.

## Referências — novembro a dezembro de 2026

- Goldie retirada; NOS substituída por DIGI 23,50 € (10 € + 3 × 4,50 €).
- Gastos fixos de referência: **1.611,17 €/mês**; vencimentos: **4.367,00 €/mês**.
- Dezembro é uma projeção, não um comprovativo de despesas.

## Janeiro a maio de 2026

- Fevereiro: renda 350,00 €; NOS 47,99 €; EDP 11,00 €; seguradora 46,98 €.
- Março–maio: NOS, EDP e seguradora indicados como referências recorrentes. Outros custos e vencimentos não comprovados ficam em branco, para evitar inferir retroativamente valores de junho.
- Janeiro: sem valores confirmados suficientes.

## Integridade de dados

- Nenhum registo anterior é apagado. Se existirem totais consolidados anteriores da v32, são respeitados até o utilizador guardar os valores individuais para o mesmo mês.
- As rubricas individuais são guardadas num novo registo por mês, ano e código. As restantes funcionalidades da v32 são mantidas.
- Uma despesa desconhecida não é tratada como zero; o lucro real só aparece se os valores do mês estiverem completos.
- Os montantes são referências fornecidas para acompanhamento interno, não uma declaração de despesas pagas, nem dados certificados de contabilidade.

## Publicação

O ZIP disponibiliza a raiz do repositório (o ficheiro `package.json` fica na raiz e `app/` dentro). Não carregues uma pasta `lle-hub` adicional dentro do repositório GitHub.

## Verificações realizadas

- Auditoria de ordem de inicialização: 30 ficheiros TS/TSX verificados sem problemas.
- Validação de sintaxe TypeScript/TSX: 30 ficheiros sem erros de parsing.
- Totais calculados a partir da função de custos e comparados com os valores anteriores.
- Build Next.js e teste funcional em produção não realizados (dependências Next.js não instaladas neste ambiente).
