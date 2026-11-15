import type { MonthlyReport, ReportCategory, ReportSplit, ReportStatus } from '../financial-report-core';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
const euro = (n: number) => Number(n || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const fmt = (n: number | null) => n == null ? '<span class="pending">POR VALIDAR</span>' : euro(n);
const fmtDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? `${d.slice(8,10)}/${d.slice(5,7)}` : esc(d);
const labelMonth = (ym: string) => {
  const [year, month] = ym.split('-').map(Number);
  return new Date(Date.UTC(year,month-1,1)).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const countPercentage = (n: number, total: number) => total > 0 ? (n / total * 100).toFixed(1).replace('.', ',') + ' %' : '—';
const moneyRows = (items: { nome: string; valor: number; observacao?: string }[]) => items.map(i => `<tr><td>${esc(i.nome)} ${i.observacao ? '<small class="muted">('+esc(i.observacao)+')</small>' : ''}</td><td class="num">${euro(i.valor)}</td></tr>`).join('');
const change = (current: number | null, previous: number | null) => {
  if (current == null || previous == null) return '—';
  const delta = current - previous;
  return `${delta > 0 ? '+' : ''}${euro(delta)}${previous ? ' (' + (delta / Math.abs(previous) * 100).toFixed(1).replace('.', ',') + ' %)' : ''}`;
};
const splitRow = (name: string, s: ReportSplit) => `<tr><th>${esc(name)}</th><td class="num">${s.n}</td><td class="num">${euro(s.receita)}</td><td class="num">${euro(s.custo)}${s.n ? '<sup>*</sup>' : ''}</td><td class="num">${euro(s.lucroParcial)}<sup>*</sup></td></tr>`;

export function buildRelatorioMensalHtml(atual: MonthlyReport, anterior: MonthlyReport) {
  const c: ReportCategory[] = ['Residência', 'Evento', 'Casamento'];
  const statuses: ReportStatus[] = ['Confirmado', 'Adjudicado', 'Faturado', 'Pago'];
  const nome = labelMonth(atual.month);
  const sameComparable = anterior.total.n > 0 && !anterior.custoPendente && !atual.custoPendente;
  const generated = new Date(atual.geradoEm).toLocaleString('pt-PT', { dateStyle:'short',timeStyle:'short', timeZone:'Europe/Lisbon' });
  const warnings = [...new Set(atual.pendentes.map(p => `${fmtDate(p.data)} — ${p.evento}: ${p.motivo}`))];
  const estadoLabels = statuses.map(s => `<tr><td>${esc(s)}</td><td class="num">${atual.estados[s].n}</td><td class="num">${euro(atual.estados[s].valor)}</td><td class="num">${euro(atual.estados[s].recebido)}</td></tr>`).join('');
  const rows = atual.linhas.map(l => `<tr class="${l.repasse ? 'repasse' : ''}">
    <td>${fmtDate(l.data)}</td><td>${esc(l.evento)}${l.pendente ? '<span class="warn"> · custo pendente</span>' : ''}</td><td>${esc(l.categoria)}</td>
    <td>${esc(l.modalidade)}</td><td>${esc(l.estado)}</td><td class="num">${euro(l.valor)}</td>
    <td class="num">${l.repasse ? 'Repasse' : euro(l.custo) + (l.pendente ? '*' : '')}</td>
  </tr>`).join('');
  const fixedWarning = atual.custosHistoricosAConfirmar ? '<p class="warning">Vencimentos e custos fixos anteriores a junho de 2026 não foram validados historicamente.</p>' : '';
  const vatNote = atual.dentro.receita > 0
    ? `<p class="note"><b>Informação de IVA (apenas Dentro):</b> as operações classificadas como Dentro podem estar sujeitas a IVA conforme o documento emitido. O IVA liquidado/dedutível e o valor a entregar ao Estado <b>não são calculados</b> neste relatório. Todos os resultados excluem IVA; verificar se os valores da Agenda estão efetivamente sem IVA.</p>` : '';
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"/>
  <title>LLE — Fecho mensal — ${esc(nome)}</title>
  <style>
    @page { size: A4; margin: 16mm 11mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Montserrat', Arial, sans-serif; color:#282522; font-size:10px; margin:0; background:#fff; line-height:1.46; }
    h1,h2,h3,p { margin:0; }
    .mast { padding:0 0 15px; border-bottom:2px solid #b89660; margin:0 0 18px; display:flex; justify-content:space-between; align-items:flex-end; }
    .brand {font-family:Georgia,serif; font-size:26px; letter-spacing:6px; color:#a27a40; font-weight:normal; }
    .super {font-size:8px;letter-spacing:2px;color:#867e73;text-transform:uppercase;}
    .head { font-family:Georgia,serif; font-size:28px; font-weight:normal; padding:6px 0; }
    .section { break-inside:avoid; margin:22px 0 11px; padding-bottom:6px; border-bottom:1px solid #d9c8a9; color:#745c37; letter-spacing:1px; font-size:12px; text-transform:uppercase; }
    .grid { break-inside:avoid; display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:14px 0; }
    .stat {border:1px solid #e5ded4;padding:12px;min-height:70px;background:#fcfbf9;}
    .stat small {display:block;font-size:8px;letter-spacing:1px;text-transform:uppercase;color:#80796f;margin-bottom:5px;}
    .stat strong{font-size:17px;font-weight:600;color:#403a32;}
    .stat em{display:block;font-style:normal;font-size:8px;color:#806950;margin-top:5px;}
    table {width:100%;border-collapse:collapse; margin:9px 0 12px; font-size:9px;}
    thead {display:table-header-group;}
    tr {break-inside:avoid;}
    th,td {padding:5px 6px;border-bottom:1px solid #eee9e0;text-align:left;vertical-align:top;}
    th{color:#7c6a51;background:#f7f3ed;font-weight:700;font-size:8px;letter-spacing:.3px;}
    td.num, th.num{text-align:right;white-space:nowrap;}
    td small{display:block;line-height:1.3;font-size:8px;}
    .num {white-space:nowrap;}
    .note{color:#66605a; background:#faf7f2;border-left:3px solid #bea373;padding:10px 12px;margin:11px 0 14px;font-size:9px;}
    .warning{background:#fff7ee;border-left:3px solid #b37228;padding:9px 11px;margin:9px 0;color:#75491a;}
    .muted {color:#898176;} .pending,.warn{color:#9b5725;font-weight:700;} .repasse{color:#7c7164;background:#fcfaf7;}
    .footer{font-size:8px;color:#928c81;padding-top:12px;margin-top:25px;border-top:1px solid #ddd4c7;}
    .break {break-before:page;} .avoid {break-inside:avoid;}
    .nowrap{white-space:nowrap;}
    @media screen {body{max-width:900px;margin:30px auto;padding:34px;box-shadow:0 8px 40px #ddd}} 
    @media print {body{max-width:unset;margin:0;padding:0;box-shadow:none} .section{break-after:avoid} }
  </style></head><body>
  <div class="mast"><div><p class="brand">LLE</p><p class="super">Life Live Event · Gestão financeira</p></div><div class="super">Documento interno · ${esc(generated)}</div></div>
  <h1 class="head">Fecho mensal · ${esc(nome)}</h1>
  <p class="muted">Relatório gerado automaticamente a partir dos registos da Agenda · Valores sem IVA · Não substitui reconciliação contabilística.</p>
  <div class="grid">
    <div class="stat"><small>Volume comercial na agenda</small><strong>${euro(atual.total.receita + atual.repasses.valor)}</strong><em>Inclui repasses</em></div>
    <div class="stat"><small>Volume operacional LLE</small><strong>${euro(atual.total.receita)}</strong><em>4 estados elegíveis</em></div>
    <div class="stat"><small>Lucro operacional</small><strong>${fmt(atual.lucroOperacional)}</strong><em>${atual.custoPendente ? 'Custos pendentes de validar' : 'Com os custos registados'}</em></div>
  </div>
  <h2 class="section">1 · Listagem financeira</h2>
  <p class="muted">${atual.linhas.length} atuações comerciais incluídas, das quais ${atual.repasses.n} repasses. Estados elegíveis: Confirmado, Adjudicado, Faturado e Pago.</p>
  <table><thead><tr><th>Data</th><th>Atuação</th><th>Tipo</th><th>Dentro/Fora</th><th>Estado</th><th class="num">Valor</th><th class="num">Custo</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Sem atuações comerciais elegíveis neste mês.</td></tr>'}</tbody></table>
  <p class="muted">Excluídos automaticamente: ${atual.excluidos.cancelados} cancelados, ${atual.excluidos.semValor} sem valor e ${atual.excluidos.foraEstados} em estados ainda não elegíveis. * Custo pode estar incompleto.</p>

  <h2 class="section">2 · Totais gerais e estados financeiros</h2>
  <div class="grid">
    <div class="stat"><small>Contratado / operação LLE</small><strong>${euro(atual.total.receita)}</strong></div>
    <div class="stat"><small>Faturado ou Pago</small><strong>${euro(atual.faturado)}</strong><em>Estado, não comprovativo fiscal</em></div>
    <div class="stat"><small>Recebido na Agenda</small><strong>${euro(atual.recebimentos)}</strong><em>Não reconciliado com banco</em></div>
  </div>
  <table><thead><tr><th>Estado</th><th class="num">Nº atuações</th><th class="num">Valor LLE</th><th class="num">Recebido registado</th></tr></thead><tbody>${estadoLabels}</tbody></table>
  <table><thead><tr><th>Modalidade</th><th class="num">Atuações*</th><th class="num">Receita LLE</th><th class="num">Custo conhecido</th><th class="num">Lucro parcial</th></tr></thead><tbody>
    ${splitRow('Dentro',atual.dentro)}${splitRow('Fora',atual.fora)}${splitRow('Total',atual.total)}
  </tbody></table>
  <p class="muted">* As atuações mistas podem contar simultaneamente em Dentro e Fora. Custos repartidos proporcionalmente às modalidades «50% Por Fora» e «10% Por Fora». Valores parciais não equivalem a lucro validado quando existem pendências.</p>
  ${vatNote}
  <table><thead><tr><th>Repasses exclusivos João/Gio</th><th class="num">Nº</th><th class="num">Volume comercial</th><th class="num">Recebido registado</th></tr></thead><tbody><tr><td>Fora da operação LLE</td><td class="num">${atual.repasses.n}</td><td class="num">${euro(atual.repasses.valor)}</td><td class="num">${euro(atual.repasses.recebido)}</td></tr></tbody></table>

  <h2 class="section">3 · Atuações por tipo</h2>
  <table><thead><tr><th>Categoria</th><th class="num">Atuações</th><th class="num">Receita</th><th class="num">Custo conhecido</th><th class="num">Lucro parcial</th></tr></thead><tbody>
    ${c.map(x => splitRow(x, atual.categorias[x])).join('')}
  </tbody></table>
  <p class="note">A Agenda tem «Tipo Comercial» mas não distingue automaticamente todos os casamentos pelo nome. Para classificar corretamente, usa o campo «Categoria para o relatório» na ficha do evento; sem indicação, aplica-se a categoria automática.</p>
  <h2 class="section">4 · Contributo da Tânia / substituição</h2>
  <div class="grid"><div class="stat"><small>Lucro com Tânia</small><strong>${fmt(atual.lucroOperacional)}</strong></div>
    <div class="stat"><small>Lucro com substituta</small><strong>${fmt(atual.lucroSemTania)}</strong></div>
    <div class="stat"><small>Contributo estimado</small><strong>${fmt(atual.contribuicaoTania)}</strong></div></div>
  <p class="note">Residências com Tânia/Annia: substituta = 100% do valor da residência. Eventos/casamentos: substituta = cachê registado da Tânia/Annia no evento. O fee da Tânia não é tratado como custo externo no cenário atual. Cachês de substituição em falta ficam pendentes, nunca assumidos como zero.</p>

  <h2 class="section">5 · Vencimentos, gastos fixos e lucro final</h2>
  <div class="avoid"><h3>Vencimentos</h3><table><tbody>${moneyRows(atual.vencimentos)}<tr><th>Total vencimentos</th><th class="num">${euro(atual.vencimentosTotal)}</th></tr></tbody></table></div>
  <div class="avoid"><h3>Gastos fixos</h3><table><tbody>${moneyRows(atual.gastosFixos)}<tr><th>Total gastos fixos</th><th class="num">${euro(atual.gastosFixosTotal)}</th></tr></tbody></table></div>
  ${fixedWarning}
  <table><tbody>
    <tr><th>Lucro total operacional</th><td class="num">${fmt(atual.lucroOperacional)}</td></tr>
    <tr><td>Vencimentos</td><td class="num">−${euro(atual.vencimentosTotal)}</td></tr>
    <tr><td>Gastos fixos</td><td class="num">−${euro(atual.gastosFixosTotal)}</td></tr>
    <tr><th>Lucro real / final (antes de IRC)</th><th class="num">${fmt(atual.lucroFinal)}</th></tr>
  </tbody></table>

  <h2 class="section">6 · Comparativo com o mês anterior</h2>
  <p class="muted">Comparação mensal com o mesmo critério de cálculo. A comparação anual foi deliberadamente excluída.</p>
  <table><thead><tr><th>Indicador</th><th class="num">${esc(labelMonth(anterior.month))}</th><th class="num">${esc(nome)}</th><th class="num">Variação</th></tr></thead><tbody>
    <tr><td>Receita operacional LLE</td><td class="num">${anterior.total.n ? euro(anterior.total.receita) : '—'}</td><td class="num">${euro(atual.total.receita)}</td><td class="num">${anterior.total.n ? change(atual.total.receita, anterior.total.receita) : '—'}</td></tr>
    <tr><td>Lucro operacional</td><td class="num">${anterior.total.n ? fmt(anterior.lucroOperacional) : '—'}</td><td class="num">${fmt(atual.lucroOperacional)}</td><td class="num">${sameComparable ? change(atual.lucroOperacional, anterior.lucroOperacional) : '—'}</td></tr>
    <tr><td>Lucro final</td><td class="num">${anterior.total.n ? fmt(anterior.lucroFinal) : '—'}</td><td class="num">${fmt(atual.lucroFinal)}</td><td class="num">${sameComparable ? change(atual.lucroFinal, anterior.lucroFinal) : '—'}</td></tr>
  </tbody></table>

  <h2 class="section">Validações pendentes</h2>
  ${warnings.length ? `<p class="warning">Encontradas ${warnings.length} ocorrências a confirmar. O lucro real não foi fechado para evitar apresentar um resultado enganador.</p><table><thead><tr><th>Evento e motivo</th></tr></thead><tbody>${warnings.map(w => `<tr><td>${esc(w)}</td></tr>`).join('')}</tbody></table>` : '<p>Sem pendências de cachês detetadas automaticamente.</p>'}
  <p class="note">O relatório utiliza exclusivamente custos de artistas registados e custos de materiais contabilizados no Hub. Não inclui investimentos, despesas extraordinárias, IRC ou IVA. A DIGI foi considerada a 23,50 €/mês desde novembro de 2026 (valor por confirmar) e Goldie termina em outubro de 2026. Valores mensais históricos devem ser validados.</p>
  <div class="footer">LLE · Documento interno e provisório · Gerado a partir da Agenda em ${esc(generated)}. Sem auditoria contabilística.</div>
  </body></html>`;
}
