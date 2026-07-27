export interface AgendaPdfArtist {
  nome?: string;
  tipo?: string;
  fee?: number;
}

export interface AgendaPdfMaterial {
  material_nome?: string;
  quantidade?: number;
  quantidade_devolvida?: number;
  quantidade_consumida?: number;
  status?: string;
  origem?: string;
  origem_detalhe?: string;
  pack_nome?: string;
  notas?: string;
}

export interface AgendaPdfEvent {
  title?: string;
  event_date?: string;
  time_range?: string;
  venue?: string;
  contacto?: string;
  tipo?: string;
  cliente_nome?: string;
  tipo_comercial?: string;
  servico_comercial?: string;
  valor_contexto?: string;
  bill?: number;
  modalidade?: string;
  billing_status?: string;
  status?: string;
  cancelled?: number;
  notas?: string;
  artistas?: AgendaPdfArtist[];
  materiais?: AgendaPdfMaterial[];
}

const TROCA_TAG_RE = /\[TROCA:([^\]]*)\]/;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripTrocaTag(notas: string) {
  return (notas || "").replace(TROCA_TAG_RE, "").trim();
}

function getTrocaNota(notas: string) {
  const match = TROCA_TAG_RE.exec(notas || "");
  return match ? match[1].trim() : "";
}

export function formatAgendaPdfDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr || "—";
  return new Date(year, month - 1, day).toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatMoney(value: unknown) {
  return `${Number(value || 0).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

export function buildAgendaPdfHtml({
  events,
  startDate,
  endDate,
  label,
  showValues,
}: {
  events: AgendaPdfEvent[];
  startDate: string;
  endDate: string;
  label: string;
  showValues: boolean;
}) {
  const generatedAt = new Date().toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
  const field = (name: string, value: unknown, wide = false) => `
    <div class="field${wide ? " wide" : ""}">
      <div class="field-label">${escapeHtml(name)}</div>
      <div class="field-value">${escapeHtml(value || "—")}</div>
    </div>`;

  const eventsHtml = events.map((event, index) => {
    const artists = Array.isArray(event.artistas) ? event.artistas : [];
    const materials = Array.isArray(event.materiais) ? event.materiais : [];
    const artistsTotal = artists.reduce((sum, artist) => sum + Number(artist.fee || 0), 0);
    const troca = getTrocaNota(event.notas || "");
    const cleanNotes = stripTrocaTag(event.notas || "");

    const artistRows = artists.length
      ? artists.map(artist => `
        <tr>
          <td>${escapeHtml(artist.nome || "—")}</td>
          <td>${escapeHtml(artist.tipo || "—")}</td>
          ${showValues ? `<td class="money">${escapeHtml(formatMoney(artist.fee))}</td>` : ""}
        </tr>`).join("")
      : `<tr><td colspan="${showValues ? 3 : 2}" class="empty">Sem artistas associados.</td></tr>`;

    const materialRows = materials.length
      ? materials.map(material => {
        const returned = Number(material.quantidade_devolvida || 0);
        const consumed = Number(material.quantidade_consumida || 0);
        const statusBase = material.status === "reservado"
          ? "Reservado"
          : material.status === "fora"
            ? "Fora do local"
            : material.status === "devolvido"
              ? "Devolvido"
              : (material.status || "—");
        const statusDetails = [
          returned ? `${returned} devolvido(s)` : "",
          consumed ? `${consumed} consumido(s)` : "",
        ].filter(Boolean).join(" · ");
        const status = statusDetails ? `${statusBase} · ${statusDetails}` : statusBase;
        const origin = [
          material.pack_nome ? `Pack: ${material.pack_nome}` : "",
          material.origem,
          material.origem_detalhe,
        ].filter(Boolean).join(" · ") || "—";

        return `
          <tr>
            <td class="qty">${escapeHtml(material.quantidade || 0)}</td>
            <td>${escapeHtml(material.material_nome || "—")}</td>
            <td>${escapeHtml(status)}</td>
            <td>${escapeHtml(origin)}</td>
            <td>${escapeHtml(material.notas || "—")}</td>
          </tr>`;
      }).join("")
      : '<tr><td colspan="5" class="empty">Sem materiais associados.</td></tr>';

    return `
      <section class="event-card">
        <div class="event-heading">
          <div>
            <div class="event-index">EVENTO ${String(index + 1).padStart(2, "0")}</div>
            <h2>${escapeHtml(event.title || "Evento sem título")}</h2>
          </div>
          <div class="status${event.cancelled ? " cancelled" : ""}">${escapeHtml(event.cancelled ? "Cancelado" : (event.billing_status || event.status || "Confirmado"))}</div>
        </div>

        <div class="fields">
          ${field("Data", formatAgendaPdfDate(event.event_date || ""))}
          ${field("Hora", event.time_range)}
          ${field("Local", event.venue)}
          ${field("Contacto", event.contacto)}
          ${field("Equipa / Tipo", event.tipo)}
          ${field("Cliente", event.cliente_nome)}
          ${field("Tipo comercial", event.tipo_comercial)}
          ${field("Serviço vendido", event.servico_comercial)}
          ${field("Perfil de valor", event.valor_contexto)}
          ${showValues ? field("Faturação", formatMoney(event.bill)) : ""}
          ${field("Modalidade", event.modalidade)}
          ${field("Estado", event.billing_status || event.status)}
          ${troca ? field("Troca de dia", troca, true) : ""}
        </div>

        <div class="section-title">Notas de materiais / observações</div>
        <div class="notes">${cleanNotes ? escapeHtml(cleanNotes).replace(/\n/g, "<br>") : "Sem notas."}</div>

        <div class="section-title row-title">
          <span>Artistas &amp; pagamentos</span>
          ${showValues ? `<span>Total artistas: ${escapeHtml(formatMoney(artistsTotal))}</span>` : ""}
        </div>
        <table>
          <thead><tr><th>Nome</th><th>Tipo</th>${showValues ? '<th class="money">Fee</th>' : ""}</tr></thead>
          <tbody>${artistRows}</tbody>
        </table>

        <div class="section-title">Materiais do evento</div>
        <table>
          <thead><tr><th class="qty">Qtd.</th><th>Material</th><th>Estado</th><th>Origem</th><th>Notas</th></tr></thead>
          <tbody>${materialRows}</tbody>
        </table>
      </section>`;
  }).join("");

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<title>${escapeHtml(label)} — LLE Hub</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1c1915; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.45; }
  .report-header { border-bottom: 2px solid #b79a57; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; gap: 20px; align-items: flex-end; }
  .brand { font-size: 8px; letter-spacing: .36em; color: #8c7240; font-weight: 700; text-transform: uppercase; }
  h1 { margin: 5px 0 0; font-family: Georgia, serif; font-size: 24px; font-weight: 400; }
  .meta { text-align: right; color: #6f675d; font-size: 9px; }
  .summary { padding: 9px 11px; border: 1px solid #ded7cb; background: #faf8f3; margin-bottom: 15px; display: flex; justify-content: space-between; gap: 20px; }
  .event-card { border: 1px solid #d9d1c3; margin: 0 0 14px; padding: 14px; break-inside: auto; page-break-inside: auto; }
  .event-heading { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding-bottom: 10px; border-bottom: 1px solid #e9e3da; break-inside: avoid; }
  .event-index { color: #9b814b; letter-spacing: .25em; font-size: 7px; font-weight: 700; }
  h2 { margin: 3px 0 0; font-family: Georgia, serif; font-size: 18px; font-weight: 400; }
  .status { border: 1px solid #9b814b; color: #725d31; padding: 4px 7px; text-transform: uppercase; letter-spacing: .12em; font-size: 7px; white-space: nowrap; }
  .status.cancelled { border-color: #a64949; color: #8c3030; }
  .fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 12px; padding: 11px 0 4px; break-inside: avoid; }
  .field.wide { grid-column: 1 / -1; }
  .field-label, .section-title { color: #8b7650; text-transform: uppercase; letter-spacing: .16em; font-size: 7px; font-weight: 700; }
  .field-value { margin-top: 2px; font-size: 10px; word-break: break-word; }
  .section-title { margin: 12px 0 5px; border-top: 1px solid #eee8df; padding-top: 9px; break-after: avoid; }
  .row-title { display: flex; justify-content: space-between; gap: 15px; }
  .notes { min-height: 28px; border: 1px solid #e5dfd5; background: #fcfbf8; padding: 8px; white-space: normal; break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th { text-align: left; color: #766543; background: #f6f2ea; text-transform: uppercase; letter-spacing: .12em; font-size: 7px; padding: 6px; border: 1px solid #ddd5c8; }
  td { padding: 6px; border: 1px solid #e3ddd3; vertical-align: top; word-break: break-word; }
  .money { text-align: right; width: 85px; white-space: nowrap; }
  .qty { width: 42px; text-align: center; }
  .empty { text-align: center; color: #867e73; font-style: italic; }
  .footer { position: fixed; bottom: -7mm; left: 0; right: 0; text-align: center; color: #8b8378; font-size: 7px; letter-spacing: .12em; }
  @media print { .event-card:last-child { margin-bottom: 0; } }
</style>
</head>
<body>
  <header class="report-header">
    <div><div class="brand">Life Live Event · LLE Hub</div><h1>${escapeHtml(label)}</h1></div>
    <div class="meta">Período: ${escapeHtml(formatAgendaPdfDate(startDate))} — ${escapeHtml(formatAgendaPdfDate(endDate))}<br>Gerado em ${escapeHtml(generatedAt)}</div>
  </header>
  <div class="summary"><strong>${events.length} ${events.length === 1 ? "evento" : "eventos"}</strong><span>Relatório completo de agenda</span></div>
  ${eventsHtml || '<div class="empty">Não existem eventos neste período.</div>'}
  <div class="footer">LLE HUB · RELATÓRIO INTERNO DE EVENTOS</div>
</body>
</html>`;
}
