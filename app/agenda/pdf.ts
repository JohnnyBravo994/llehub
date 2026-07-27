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
  const line = (name: string, value: unknown) => `
    <div class="detail-line">
      <span class="detail-label">${escapeHtml(name)}:</span>
      <span class="detail-value">${escapeHtml(value || "—")}</span>
    </div>`;

  const eventsHtml = events.map((event, index) => {
    const artists = Array.isArray(event.artistas) ? event.artistas : [];
    const materials = Array.isArray(event.materiais) ? event.materiais : [];
    const artistsTotal = artists.reduce((sum, artist) => sum + Number(artist.fee || 0), 0);
    const troca = getTrocaNota(event.notas || "");
    const cleanNotes = stripTrocaTag(event.notas || "");
    const eventStatus = event.cancelled ? "Cancelado" : (event.billing_status || event.status || "Confirmado");

    const artistItems = artists.length
      ? artists.map(artist => {
        const parts = [
          artist.nome || "—",
          artist.tipo || "—",
          showValues ? formatMoney(artist.fee) : "",
        ].filter(Boolean);
        return `<li>${parts.map(part => escapeHtml(part)).join(" — ")}</li>`;
      }).join("")
      : '<li class="empty-item">Sem artistas associados.</li>';

    const materialItems = materials.length
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
        ].filter(Boolean).join(" · ");
        const materialName = `${Number(material.quantidade || 0)}× ${material.material_nome || "—"}`;
        const details = [
          status && status !== "—" ? `Estado: ${status}` : "",
          origin ? `Origem: ${origin}` : "",
          material.notas ? `Notas: ${material.notas}` : "",
        ].filter(Boolean);

        return `<li><strong>${escapeHtml(materialName)}</strong>${details.length ? ` — ${details.map(detail => escapeHtml(detail)).join(" · ")}` : ""}</li>`;
      }).join("")
      : '<li class="empty-item">Sem materiais associados.</li>';

    return `
      <section class="event-block">
        <div class="event-number">EVENTO ${String(index + 1).padStart(2, "0")}</div>
        <h2>${escapeHtml(event.title || "Evento sem título")}</h2>

        <div class="details">
          ${line("Data", formatAgendaPdfDate(event.event_date || ""))}
          ${line("Hora", event.time_range)}
          ${line("Local", event.venue)}
          ${line("Contacto", event.contacto)}
          ${line("Equipa / Tipo", event.tipo)}
          ${line("Cliente", event.cliente_nome)}
          ${line("Tipo comercial", event.tipo_comercial)}
          ${line("Serviço vendido", event.servico_comercial)}
          ${line("Perfil de valor", event.valor_contexto)}
          ${showValues ? line("Faturação", formatMoney(event.bill)) : ""}
          ${line("Modalidade", event.modalidade)}
          ${line("Estado", eventStatus)}
          ${troca ? line("Troca de dia", troca) : ""}
        </div>

        <div class="list-section">
          <h3>Artistas${showValues ? ` <span class="section-total">(Total: ${escapeHtml(formatMoney(artistsTotal))})</span>` : ""}</h3>
          <ul class="item-list">${artistItems}</ul>
        </div>

        <div class="list-section">
          <h3>Lista de materiais</h3>
          <ul class="item-list">${materialItems}</ul>
        </div>

        <div class="list-section notes-section">
          <h3>Notas / observações</h3>
          <div class="notes">${cleanNotes ? escapeHtml(cleanNotes).replace(/\n/g, "<br>") : "Sem notas."}</div>
        </div>
      </section>`;
  }).join("");

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<title>${escapeHtml(label)} — LLE Hub</title>
<style>
  @page { size: A4; margin: 13mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1c1915; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.5; }
  .report-header { border-bottom: 2px solid #b79a57; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; gap: 20px; align-items: flex-end; }
  .brand { font-size: 8px; letter-spacing: .36em; color: #8c7240; font-weight: 700; text-transform: uppercase; }
  h1 { margin: 5px 0 0; font-family: Georgia, serif; font-size: 23px; font-weight: 400; }
  .meta { text-align: right; color: #6f675d; font-size: 9px; }
  .summary { padding: 8px 10px; border: 1px solid #ded7cb; background: #faf8f3; margin-bottom: 17px; display: flex; justify-content: space-between; gap: 20px; }
  .event-block { margin: 0 0 20px; padding: 0 0 18px; border-bottom: 1px solid #cfc6b7; break-inside: avoid-page; page-break-inside: avoid; }
  .event-block:last-of-type { border-bottom: 0; margin-bottom: 0; }
  .event-number { color: #9b814b; letter-spacing: .24em; font-size: 7px; font-weight: 700; margin-bottom: 3px; }
  h2 { margin: 0 0 9px; font-family: Georgia, serif; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: .025em; break-after: avoid-page; page-break-after: avoid; }
  .details { margin-bottom: 12px; page-break-inside: avoid; }
  .detail-line { display: flex; align-items: baseline; gap: 5px; margin: 2px 0; }
  .detail-label { font-weight: 700; min-width: 94px; }
  .detail-value { flex: 1; min-width: 0; word-break: break-word; }
  .list-section { margin-top: 11px; break-inside: avoid-page; page-break-inside: avoid; }
  h3 { margin: 0 0 4px; color: #725d31; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; break-after: avoid-page; page-break-after: avoid; }
  .section-total { color: #6f675d; font-weight: 400; letter-spacing: 0; text-transform: none; }
  .item-list { margin: 0; padding-left: 17px; }
  .item-list li { margin: 2px 0; padding-left: 1px; word-break: break-word; break-inside: avoid-page; page-break-inside: avoid; }
  .empty-item { color: #867e73; font-style: italic; }
  .notes { border-left: 2px solid #d8c59a; padding-left: 9px; min-height: 18px; white-space: normal; word-break: break-word; }
  .footer { position: fixed; bottom: -8mm; left: 0; right: 0; text-align: center; color: #8b8378; font-size: 7px; letter-spacing: .12em; }
  .empty-report { text-align: center; color: #867e73; font-style: italic; padding: 25px 0; }
</style>
</head>
<body>
  <header class="report-header">
    <div><div class="brand">Life Live Event · LLE Hub</div><h1>${escapeHtml(label)}</h1></div>
    <div class="meta">Período: ${escapeHtml(formatAgendaPdfDate(startDate))} — ${escapeHtml(formatAgendaPdfDate(endDate))}<br>Gerado em ${escapeHtml(generatedAt)}</div>
  </header>
  <div class="summary"><strong>${events.length} ${events.length === 1 ? "evento" : "eventos"}</strong><span>Relatório completo de agenda</span></div>
  ${eventsHtml || '<div class="empty-report">Não existem eventos neste período.</div>'}
  <div class="footer">LLE HUB · RELATÓRIO INTERNO DE EVENTOS</div>
</body>
</html>`;
}
