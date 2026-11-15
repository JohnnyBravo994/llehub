// LLE v34 — motor puro de fecho mensal. Não consulta nem altera a base de dados.
// As receitas/custos e o IVA são tratados SEM IVA.

export type ReportCategory = 'Residência' | 'Evento' | 'Casamento';
export type ReportStatus = 'Confirmado' | 'Adjudicado' | 'Faturado' | 'Pago';
export type ReportArtist = { nome?: string; tipo?: string; fee?: number | string | null };
export type ReportEvent = {
  id: number; title: string; event_date: string; tipo?: string; bill?: number;
  billing_status?: string; status?: string; cancelled?: number; modalidade?: string;
  valor_recebido?: number; tipo_comercial?: string; servico_comercial?: string;
  categoria_relatorio?: string; venue?: string; material_cost?: number;
  artistas?: ReportArtist[];
};
export type ReportMonthlyInputs = { events: ReportEvent[]; month: string };
export type ReportExpense = { nome: string; valor: number; observacao?: string };
export type ReportPending = { id: number; data: string; evento: string; motivo: string };
export type ReportLine = {
  id: number; data: string; evento: string; categoria: ReportCategory;
  modalidade: string; estado: ReportStatus; equipa: string;
  valor: number; dentro: number; fora: number; recebido: number;
  custo: number; custoDentro: number; custoFora: number;
  repasse: boolean; lucroParcial: number; pendente: boolean;
  contributoTania: number; substituicaoPendente: boolean;
};
export type ReportSplit = { n: number; receita: number; custo: number; lucroParcial: number };
export type MonthlyReport = {
  month: string; geradoEm: string; linhas: ReportLine[];
  estados: Record<ReportStatus, { n: number; valor: number; recebido: number }>;
  total: ReportSplit; dentro: ReportSplit; fora: ReportSplit;
  categorias: Record<ReportCategory, ReportSplit>;
  repasses: { n: number; valor: number; recebido: number };
  recebimentos: number; faturado: number; porReceber: number;
  custoPendente: boolean; lucroOperacional: number | null;
  vencimentos: ReportExpense[]; gastosFixos: ReportExpense[];
  vencimentosTotal: number; gastosFixosTotal: number;
  lucroFinal: number | null;
  contribuicaoTania: number | null; lucroSemTania: number | null;
  pendentes: ReportPending[];
  excluidos: { cancelados: number; semValor: number; foraEstados: number };
  custosHistoricosAConfirmar: boolean;
};

const estadosValidos = ['Confirmado', 'Adjudicado', 'Faturado', 'Pago'] as const;
const categoriaKeys: ReportCategory[] = ['Residência', 'Evento', 'Casamento'];
const ordenadosEstados: ReportStatus[] = [...estadosValidos];
const money = (n: unknown) => Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0;
const cent = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const nomeInterno = (name: string) => /(^|\b)(annia|tania|tania silva)(\b|$)/.test(norm(name));
const nomeRepasse = (name: string) => /(^|\b)(joao|gio|giovanni)(\b|$)/.test(norm(name));

export function dentroPercentagem(modalidade: string) {
  const mode = norm(modalidade);
  if (mode.includes('50%') && mode.includes('fora')) return .5;
  if (mode.includes('10%') && mode.includes('fora')) return .9;
  if (mode === 'por fora') return 0;
  return 1;
}

export function categoriaEvento(e: ReportEvent): ReportCategory {
  const manual = norm(e.categoria_relatorio);
  if (manual === 'casamento') return 'Casamento';
  if (manual === 'residencia') return 'Residência';
  if (manual === 'evento') return 'Evento';
  if (norm(e.tipo_comercial) === 'residencia') return 'Residência';
  const descricao = norm(`${e.title || ''} ${e.servico_comercial || ''}`);
  if (/casamento|wedding|boda|matrimonio/.test(descricao)) return 'Casamento';
  return 'Evento';
}

export function configuracaoCustos(month: string) {
  const vencimentos: ReportExpense[] = [
    { nome: 'Soraya', valor: 1080 },
    { nome: 'Tânia', valor: 1467.33 },
    { nome: 'Larissa', valor: 809.67 },
    { nome: 'João', valor: 300 },
    { nome: 'Inês', valor: 500 },
    { nome: 'Vilma', valor: 210 },
  ];
  const isDigi = month >= '2026-11';
  const gastosFixos: ReportExpense[] = [
    isDigi
      ? { nome: 'DIGI (10 € + 3 × 4,50 €)', valor: 23.5, observacao: 'Valor comunicado como aproximado; confirmar fatura' }
      : { nome: 'NOS', valor: 47.99 },
    { nome: 'EDP', valor: 11 },
    { nome: 'Seguradora', valor: 46.98 },
    { nome: 'Renda da loja', valor: 325 },
    { nome: 'Garagem / carro', valor: 275 },
    { nome: 'Segurança Social', valor: 829.69, observacao: 'Tratada como adicional aos vencimentos; confirmar não duplicação' },
    { nome: 'Google', valor: 100 },
    ...(month <= '2026-10' ? [{ nome: 'Goldie', valor: 29.99 }] : []),
  ];
  return { vencimentos, gastosFixos, historicoPendente: month < '2026-06' };
}

const emptySplit = (): ReportSplit => ({ n: 0, receita: 0, custo: 0, lucroParcial: 0 });

export function calcularFechoMensal({ events, month }: ReportMonthlyInputs): MonthlyReport {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Mês inválido');
  const linhas: ReportLine[] = [];
  const pendentes: ReportPending[] = [];
  const estados = Object.fromEntries(ordenadosEstados.map(e => [e, { n: 0, valor: 0, recebido: 0 }])) as MonthlyReport['estados'];
  const categorias = Object.fromEntries(categoriaKeys.map(c => [c, emptySplit()])) as MonthlyReport['categorias'];
  const dentro = emptySplit(); const fora = emptySplit(); const total = emptySplit();
  const repasses = { n: 0, valor: 0, recebido: 0 };
  const excluidos = { cancelados: 0, semValor: 0, foraEstados: 0 };
  let recebidoTotal = 0; let faturado = 0; let contribuicao = 0; let substituicaoPendente = false;

  for (const e of events) {
    const rawStatus = String(e.billing_status || '').trim();
    const state = estadosValidos.find(s => norm(s) === norm(rawStatus));
    if (e.cancelled || norm(e.status) === 'cancelado' || norm(rawStatus) === 'cancelado') { excluidos.cancelados++; continue; }
    const valor = cent(money(e.bill));
    if (valor <= 0) { excluidos.semValor++; continue; }
    if (!state) { excluidos.foraEstados++; continue; }

    const artists = (e.artistas || []).filter(a => String(a.nome || '').trim());
    const equipa = String(e.tipo || '').trim();
    const equipas = ['joao', 'annia', 'empresa'].filter(n => norm(equipa).includes(n));
    // Repasses apenas em atuações EXCLUSIVAS do João/Gio.
    const equipaSolo = equipas.length === 1 && equipas[0] === 'joao';
    const artistaSolo = artists.length > 0 && artists.every(a => nomeRepasse(a.nome || '')) && !equipas.includes('empresa') && !equipas.includes('annia');
    const repasse = equipaSolo || (equipas.length === 0 && artistaSolo);
    const pagoRegistado = cent(Math.min(valor, state === 'Pago' ? Math.max(valor, money(e.valor_recebido)) : money(e.valor_recebido)));
    const categoria = categoriaEvento(e);
    const percent = dentroPercentagem(String(e.modalidade || 'Fatura'));
    const valorDentro = cent(valor * percent), valorFora = cent(valor - valorDentro);

    if (repasse) {
      repasses.n++; repasses.valor = cent(repasses.valor + valor); repasses.recebido = cent(repasses.recebido + pagoRegistado);
      linhas.push({ id: e.id, data: e.event_date, evento: e.title, categoria, modalidade: e.modalidade || 'Fatura', estado: state, equipa,
        valor, dentro: valorDentro, fora: valorFora, recebido: pagoRegistado, custo: valor, custoDentro: valorDentro, custoFora: valorFora,
        repasse: true, lucroParcial: 0, pendente: false, contributoTania: 0, substituicaoPendente: false });
      continue;
    }

    let eventPending = false;
    if (!artists.length) {
      eventPending = true;
      pendentes.push({ id: e.id, data: e.event_date, evento: e.title, motivo: 'Equipa/custos de artistas por confirmar' });
    }
    for (const a of artists) {
      if (!nomeInterno(a.nome || '') && !nomeRepasse(a.nome || '') && money(a.fee) === 0) {
        eventPending = true;
        pendentes.push({ id: e.id, data: e.event_date, evento: e.title, motivo: `Cachê sem valor: ${a.nome}` });
      }
    }
    // O cachê da Tânia/Annia não é custo externo real. Para a simulação, corresponde ao custo de substituição no evento.
    const externos = cent(artists.filter(a => !nomeInterno(a.nome || '')).reduce((s, a) => s + money(a.fee), 0));
    const custo = cent(externos + money(e.material_cost));
    const custoDentro = cent(custo * percent), custoFora = cent(custo - custoDentro);
    const anniaRows = artists.filter(a => nomeInterno(a.nome || ''));
    const temTania = anniaRows.length > 0 || /annia|tânia|tania/i.test(equipa);
    let contribuicaoTania = 0; let eventoSubPendente = false;
    if (temTania) {
      if (categoria === 'Residência') {
        // Regra de negócio LLE: substituta recebe a totalidade da faturação da residência.
        contribuicaoTania = valor;
      } else {
        const fee = cent(anniaRows.reduce((s, a) => s + money(a.fee), 0));
        if (fee > 0) contribuicaoTania = fee;
        else {
          eventoSubPendente = true; substituicaoPendente = true;
          pendentes.push({ id: e.id, data: e.event_date, evento: e.title, motivo: 'Cachê da Tânia/Annia por registar para simular substituta' });
        }
      }
    }
    contribuicao = cent(contribuicao + contribuicaoTania);
    estados[state].n++;
    estados[state].valor = cent(estados[state].valor + valor);
    estados[state].recebido = cent(estados[state].recebido + pagoRegistado);
    if (state === 'Faturado' || state === 'Pago') faturado = cent(faturado + valor);
    recebidoTotal = cent(recebidoTotal + pagoRegistado);
    total.n++; total.receita = cent(total.receita + valor); total.custo = cent(total.custo + custo);
    total.lucroParcial = cent(total.receita - total.custo);
    const dc = categorias[categoria]; dc.n++; dc.receita = cent(dc.receita + valor); dc.custo = cent(dc.custo + custo); dc.lucroParcial = cent(dc.receita - dc.custo);
    if (valorDentro > 0) dentro.n++;
    if (valorFora > 0) fora.n++;
    dentro.receita = cent(dentro.receita + valorDentro); dentro.custo = cent(dentro.custo + custoDentro); dentro.lucroParcial = cent(dentro.receita - dentro.custo);
    fora.receita = cent(fora.receita + valorFora); fora.custo = cent(fora.custo + custoFora); fora.lucroParcial = cent(fora.receita - fora.custo);
    linhas.push({ id: e.id, data: e.event_date, evento: e.title, categoria, modalidade: e.modalidade || 'Fatura', estado: state, equipa,
      valor, dentro: valorDentro, fora: valorFora, recebido: pagoRegistado, custo, custoDentro, custoFora,
      repasse: false, lucroParcial: cent(valor - custo), pendente: eventPending,
      contributoTania: contribuicaoTania, substituicaoPendente: eventoSubPendente });
  }
  linhas.sort((a,b) => a.data.localeCompare(b.data) || a.id - b.id);
  const cfg = configuracaoCustos(month);
  const vencimentosTotal = cent(cfg.vencimentos.reduce((s,x) => s+x.valor,0));
  const gastosFixosTotal = cent(cfg.gastosFixos.reduce((s,x) => s+x.valor,0));
  const custosPendentes = linhas.some(l => l.pendente) || cfg.historicoPendente;
  const lucroOperacional = custosPendentes ? null : total.lucroParcial;
  const lucroFinal = lucroOperacional == null ? null : cent(lucroOperacional - vencimentosTotal - gastosFixosTotal);
  const contribuicaoTania = substituicaoPendente ? null : contribuicao;
  const lucroSemTania = lucroOperacional == null || contribuicaoTania == null ? null : cent(lucroOperacional - contribuicaoTania);
  return {
    month, geradoEm: new Date().toISOString(), linhas, estados, total, dentro, fora, categorias, repasses,
    recebimentos: recebidoTotal, faturado, porReceber: cent(Math.max(0, total.receita - recebidoTotal)),
    custoPendente: custosPendentes, lucroOperacional, vencimentos: cfg.vencimentos, gastosFixos: cfg.gastosFixos,
    vencimentosTotal, gastosFixosTotal, lucroFinal, contribuicaoTania, lucroSemTania,
    pendentes, excluidos, custosHistoricosAConfirmar: cfg.historicoPendente,
  };
}
