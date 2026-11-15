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
  const periodLabel = `${formatAgendaPdfDate(startDate)} — ${formatAgendaPdfDate(endDate)}`;
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
      <section class="event-page" data-event-page>
        <div class="event-page-inner">
          <header class="page-header">
            <div>
              <div class="brand">Life Live Event · LLE Hub</div>
              <div class="report-label">${escapeHtml(label)}</div>
            </div>
            <div class="page-meta">
              <strong>EVENTO ${String(index + 1).padStart(2, "0")} DE ${String(events.length).padStart(2, "0")}</strong><br>
              Período: ${escapeHtml(periodLabel)}<br>
              Gerado em ${escapeHtml(generatedAt)}
            </div>
          </header>

          <article class="event-block">
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
          </article>
        </div>

        <div class="page-footer">LLE HUB · RELATÓRIO INTERNO DE EVENTOS · ${index + 1}/${events.length}</div>
      </section>`;
  }).join("");

  const emptyHtml = `
    <section class="event-page single-page" data-event-page>
      <div class="event-page-inner">
        <header class="page-header">
          <div><div class="brand">Life Live Event · LLE Hub</div><div class="report-label">${escapeHtml(label)}</div></div>
          <div class="page-meta">Período: ${escapeHtml(periodLabel)}<br>Gerado em ${escapeHtml(generatedAt)}</div>
        </header>
        <div class="empty-report">Não existem eventos neste período.</div>
      </div>
      <div class="page-footer">LLE HUB · RELATÓRIO INTERNO DE EVENTOS</div>
    </section>`;

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<title>${escapeHtml(label)} — LLE Hub</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { color: #1c1915; font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.45; }

  /* Cada bloco abaixo corresponde fisicamente a uma página A4 útil.
     O page-break-after é mais fiável no Safari do que depender apenas de
     break-before entre eventos. */
  .event-page {
    position: relative;
    width: 186mm;
    height: 272mm;
    margin: 0;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid-page;
  }
  .event-page:last-of-type,
  .event-page.single-page {
    page-break-after: auto;
    break-after: auto;
  }
  .event-page-inner {
    width: 100%;
    transform-origin: top left;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 18px;
    border-bottom: 2px solid #b79a57;
    padding-bottom: 8px;
    margin-bottom: 11px;
  }
  .brand { font-size: 7px; letter-spacing: .34em; color: #8c7240; font-weight: 700; text-transform: uppercase; }
  .report-label { margin-top: 4px; font-family: Georgia, serif; font-size: 14px; font-weight: 400; }
  .page-meta { text-align: right; color: #6f675d; font-size: 7.5px; line-height: 1.45; }

  .event-block { margin: 0; padding: 0 0 10px; }
  h2 { margin: 0 0 8px; font-family: Georgia, serif; font-size: 17px; font-weight: 700; text-transform: uppercase; letter-spacing: .025em; }
  .details { margin-bottom: 9px; }
  .detail-line { display: flex; align-items: baseline; gap: 5px; margin: 1px 0; }
  .detail-label { font-weight: 700; min-width: 94px; }
  .detail-value { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .list-section { margin-top: 8px; }
  h3 { margin: 0 0 3px; color: #725d31; font-size: 8.5px; letter-spacing: .12em; text-transform: uppercase; }
  .section-total { color: #6f675d; font-weight: 400; letter-spacing: 0; text-transform: none; }
  .item-list { margin: 0; padding-left: 17px; }
  .item-list li { margin: 1px 0; padding-left: 1px; overflow-wrap: anywhere; }
  .empty-item { color: #867e73; font-style: italic; }
  .notes { border-left: 2px solid #d8c59a; padding-left: 8px; min-height: 16px; overflow-wrap: anywhere; }
  .empty-report { text-align: center; color: #867e73; font-style: italic; padding: 35mm 0; }
  .page-footer { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; color: #8b8378; font-size: 6.5px; letter-spacing: .11em; }

  @media screen {
    body { padding: 18px; background: #ece9e3; }
    .event-page { margin: 0 auto 18px; background: #fff; box-shadow: 0 5px 22px rgba(0,0,0,.12); }
  }

  @media print {
    body { background: #fff; }
    .event-page { margin: 0; }
  }
</style>
</head>
<body>
  ${eventsHtml || emptyHtml}

<script>
(function () {
  function fitEventPages() {
    var pages = document.querySelectorAll('[data-event-page]');

    pages.forEach(function (page) {
      var inner = page.querySelector('.event-page-inner');
      if (!inner) return;

      inner.style.transform = 'none';
      inner.style.width = '100%';

      var footer = page.querySelector('.page-footer');
      var footerHeight = footer ? footer.getBoundingClientRect().height + 8 : 0;
      var availableHeight = page.clientHeight - footerHeight;
      var naturalHeight = inner.scrollHeight;

      if (naturalHeight > availableHeight && naturalHeight > 0) {
        var scale = Math.min(1, availableHeight / naturalHeight);
        inner.style.width = (100 / scale) + '%';
        inner.style.transform = 'scale(' + scale + ')';
      }
    });

    document.documentElement.dataset.pdfReady = 'true';
  }

  function scheduleFit() {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(fitEventPages);
    });
  }

  window.addEventListener('load', scheduleFit, { once: true });
  window.addEventListener('beforeprint', fitEventPages);
  scheduleFit();
})();
</script>
</body>
</html>`;
}
