// src/utils/htmlBuilders.js
const { SHARED_CSS, esc, fmt } = require("./layout");

/* ─── Shared helpers for standalone public pages ─── */

const FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">`;

const BASE_RESET = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f3f0;color:#2c2825;min-height:100vh;font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
    a{color:inherit;text-decoration:none}`;

const FOOTER_MARK = `
    <div style="text-align:center;padding:24px 0 32px;font-size:.72rem;color:#b0ada8;letter-spacing:.03em">
      Generato con <span style="font-weight:600;color:#9a9691">Preventivo EASY</span>
    </div>`;

/* ──────────────────────────────────────────────────────────────
   buildQuoteHTML — Professional quote web view
   ────────────────────────────────────────────────────────────── */

function buildQuoteHTML(quote) {
  const createdDate = new Date(quote.created_at).toLocaleDateString("it-IT", {
    day: "2-digit", month: "long", year: "numeric"
  });

  const rows = quote.line_items.map((item, idx) => `
        <tr class="${idx % 2 === 1 ? 'row-alt' : ''}">
          <td class="cell-num">${idx + 1}</td>
          <td class="cell-desc">${esc(item.description)}</td>
          <td class="cell-qty">${item.quantity}</td>
          <td class="cell-price">${fmt(item.unit_price)} &euro;</td>
          <td class="cell-total">${fmt(item.subtotal)} &euro;</td>
        </tr>`).join("");

  /* Fiscal summary rows */
  const cassaRow = quote.cassa
    ? `<div class="summary-row">
         <span>Contributo cassa ${quote.tax_profile ? quote.tax_profile.previdenza_percent + "%" : "4%"}</span>
         <span>${fmt(quote.cassa)} &euro;</span>
       </div>`
    : "";

  let ivaLabel = "IVA";
  if (quote.tax_profile) {
    ivaLabel = quote.tax_profile.iva_percent > 0
      ? "IVA " + quote.tax_profile.iva_percent + "%"
      : "IVA (esente)";
  }

  /* Profile / preset badge */
  const presetLabels = { economy: "Economy", standard: "Standard", premium: "Premium" };
  const profileBadge = quote.tax_profile
    ? esc(quote.tax_profile.name)
    : esc(presetLabels[quote.pricing_preset] || quote.pricing_preset);

  /* Notes block */
  const notesBlock = quote.notes
    ? `<div class="section">
         <div class="section-label">Note</div>
         <div class="notes-content">${esc(quote.notes)}</div>
       </div>`
    : "";

  /* Accept button — only when status is "sent" */
  const acceptButton = quote.status === "sent"
    ? `<form method="POST" action="/q/${esc(quote.quote_id)}/accept" style="display:inline">
         <button type="submit" class="btn btn-accept">&#10003;&ensp;Accetta preventivo</button>
       </form>`
    : "";

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preventivo ${esc(quote.quote_id)}</title>
  ${FONT_LINKS}
  <style>
    ${BASE_RESET}

    /* ── Container ── */
    .page-wrap{max-width:720px;margin:0 auto;padding:24px 16px 8px}
    .card{background:#fff;border-radius:14px;box-shadow:0 2px 6px rgba(0,0,0,.04),0 8px 30px rgba(0,0,0,.07);overflow:hidden}

    /* ── Header ── */
    .header{background:linear-gradient(135deg,#1e1b18 0%,#302c28 50%,#1e1b18 100%);color:#fff;padding:36px 40px 32px;position:relative}
    .header::after{content:'';position:absolute;bottom:0;left:40px;right:40px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent)}
    .header-top{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px}
    .prof-name{font-size:1.35rem;font-weight:700;letter-spacing:-.03em;margin-bottom:2px}
    .prof-detail{font-size:.82rem;color:rgba(255,255,255,.5);font-weight:400}
    .quote-meta{text-align:right}
    .quote-label{font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.35);font-weight:600;margin-bottom:4px}
    .quote-number{font-size:.85rem;font-weight:600;color:rgba(255,255,255,.8);font-family:'Inter',monospace;letter-spacing:.02em}
    .quote-date{font-size:.78rem;color:rgba(255,255,255,.4);margin-top:2px}

    /* ── Body ── */
    .body{padding:36px 40px 28px}

    /* ── Section labels ── */
    .section{margin-bottom:28px}
    .section-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:#9a9691;font-weight:700;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #edeae6}

    /* ── Client info ── */
    .client-card{background:#faf9f7;border:1px solid #edeae6;border-radius:10px;padding:18px 22px;margin-bottom:28px}
    .client-card .section-label{border-bottom:none;padding-bottom:0;margin-bottom:8px}
    .client-name{font-size:1rem;font-weight:600;color:#2c2825}
    .client-email{font-size:.85rem;color:#7a756e;margin-top:2px}

    /* ── Job description ── */
    .job-desc{background:#f6faf9;border-left:3px solid #0d9488;padding:16px 20px;border-radius:0 10px 10px 0;font-size:.9rem;line-height:1.75;color:#3d3a36}

    /* ── Items table ── */
    .items-table{width:100%;border-collapse:collapse;font-size:.84rem;margin-top:4px}
    .items-table thead th{background:#faf9f7;text-align:left;padding:11px 16px;font-weight:700;font-size:.67rem;text-transform:uppercase;letter-spacing:.07em;color:#9a9691;border-bottom:2px solid #edeae6}
    .items-table thead th.col-num{width:40px;text-align:center}
    .items-table thead th.col-qty{width:56px;text-align:center}
    .items-table thead th.col-price{width:115px;text-align:right}
    .items-table thead th.col-total{width:115px;text-align:right}
    .items-table tbody td{padding:13px 16px;border-bottom:1px solid #f3f1ed}
    .items-table tbody tr:last-child td{border-bottom:none}
    .items-table tbody tr.row-alt{background:#fcfbf9}
    .items-table tbody tr:hover{background:#f6faf9}
    .cell-num{text-align:center;color:#b0ada8;font-weight:600;font-size:.78rem}
    .cell-desc{font-weight:500;color:#2c2825}
    .cell-qty{text-align:center;color:#7a756e}
    .cell-price{text-align:right;color:#7a756e;font-weight:500}
    .cell-total{text-align:right;font-weight:600;color:#2c2825}

    /* ── Fiscal summary ── */
    .fiscal-card{background:linear-gradient(135deg,#1e1b18 0%,#302c28 100%);border-radius:12px;padding:22px 28px;color:#fff;margin-top:6px;margin-bottom:28px}
    .summary-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:.88rem;color:rgba(255,255,255,.6)}
    .summary-row span:last-child{font-weight:500;font-variant-numeric:tabular-nums}
    .summary-divider{border:none;border-top:1px solid rgba(255,255,255,.12);margin:10px 0}
    .summary-total{display:flex;justify-content:space-between;align-items:center;padding:12px 0 4px;font-size:1.55rem;font-weight:800;color:#fff;letter-spacing:-.02em}

    /* ── Notes ── */
    .notes-content{background:#faf9f7;border-left:3px solid #d4c9b8;padding:14px 18px;border-radius:0 8px 8px 0;font-size:.88rem;line-height:1.7;color:#5a554e}

    /* ── Terms bar ── */
    .terms-bar{display:flex;flex-wrap:wrap;gap:24px;align-items:center;padding:18px 22px;background:#faf9f7;border:1px solid #edeae6;border-radius:10px;margin-bottom:28px;font-size:.82rem;color:#7a756e}
    .terms-bar strong{font-weight:600;color:#5a554e}
    .terms-badge{display:inline-block;background:#ecfdf5;color:#065f46;font-size:.7rem;font-weight:700;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:.04em;margin-left:auto}

    /* ── Action buttons ── */
    .actions{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;align-items:center;margin-bottom:8px;padding-top:4px}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 32px;border-radius:10px;font-size:.92rem;font-weight:700;cursor:pointer;border:none;text-decoration:none;text-align:center;transition:all .2s ease;line-height:1.4;font-family:'Inter',sans-serif}
    .btn:active{transform:scale(.97)}
    .btn-accept{background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 3px 12px rgba(22,163,74,.3);font-size:.95rem;padding:16px 40px}
    .btn-accept:hover{background:linear-gradient(135deg,#15803d,#166534);box-shadow:0 6px 20px rgba(22,163,74,.4);transform:translateY(-2px)}
    .btn-pdf{background:#f0fdfa;color:#0d9488;border:2px solid #99f6e4;padding:13px 28px}
    .btn-pdf:hover{background:#ccfbf1;border-color:#5eead4;transform:translateY(-1px)}

    /* ── Responsive ── */
    @media(max-width:640px){
      .body{padding:24px 20px 20px}
      .header{padding:28px 24px 24px}
      .header-top{flex-direction:column;gap:8px}
      .quote-meta{text-align:left}
      .terms-bar{flex-direction:column;align-items:flex-start;gap:10px}
      .terms-badge{margin-left:0}
      .actions{flex-direction:column}
      .btn{width:100%}
      .items-table{font-size:.78rem}
      .items-table thead th,.items-table tbody td{padding:10px 10px}
      .summary-total{font-size:1.3rem}
    }
    @media(max-width:420px){
      .page-wrap{padding:12px 6px 4px}
      .items-table thead th.col-price,.cell-price{display:none}
    }
  </style>
</head>
<body>
  <div class="page-wrap">
    <div class="card">

      <!-- Header -->
      <div class="header">
        <div class="header-top">
          <div>
            <div class="prof-name">${esc(quote.professional.name)}</div>
            <div class="prof-detail">${esc(quote.professional.category)} &middot; ${esc(quote.professional.city)}</div>
          </div>
          <div class="quote-meta">
            <div class="quote-label">Preventivo n&deg;</div>
            <div class="quote-number">${esc(quote.quote_id)}</div>
            <div class="quote-date">${createdDate}</div>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div class="body">

        <!-- Client info -->
        <div class="client-card">
          <div class="section-label">Intestato a</div>
          <div class="client-name">${esc(quote.client.name)}</div>
          <div class="client-email">${esc(quote.client.email)}</div>
        </div>

        <!-- Job description -->
        <div class="section">
          <div class="section-label">Descrizione lavoro</div>
          <div class="job-desc">${esc(quote.job_description)}</div>
        </div>

        <!-- Items table -->
        <div class="section">
          <div class="section-label">Dettaglio voci</div>
          <table class="items-table">
            <thead>
              <tr>
                <th class="col-num">#</th>
                <th>Descrizione</th>
                <th class="col-qty">Qt&agrave;</th>
                <th class="col-price">Prezzo unit.</th>
                <th class="col-total">Totale</th>
              </tr>
            </thead>
            <tbody>${rows}
            </tbody>
          </table>
        </div>

        <!-- Fiscal summary -->
        <div class="fiscal-card">
          <div class="summary-row">
            <span>Imponibile</span>
            <span>${fmt(quote.subtotal)} &euro;</span>
          </div>
          ${cassaRow}
          <div class="summary-row">
            <span>${ivaLabel}</span>
            <span>${fmt(quote.taxes)} &euro;</span>
          </div>
          <hr class="summary-divider">
          <div class="summary-total">
            <span>TOTALE</span>
            <span>${fmt(quote.total)} ${esc(quote.currency)}</span>
          </div>
        </div>

        <!-- Notes -->
        ${notesBlock}

        <!-- Terms bar -->
        <div class="terms-bar">
          <div><strong>Pagamento:</strong> ${esc(quote.payment_terms)}</div>
          <div><strong>Validit&agrave;:</strong> ${quote.validity_days} giorni</div>
          <span class="terms-badge">${profileBadge}</span>
        </div>

        <!-- Action buttons -->
        <div class="actions">
          ${acceptButton}
          <a href="/q/${esc(quote.quote_id)}/pdf" class="btn btn-pdf">&#128196;&ensp;Scarica PDF</a>
        </div>

      </div>
    </div>
    ${FOOTER_MARK}
  </div>
</body>
</html>`;
}

/* ──────────────────────────────────────────────────────────────
   build404HTML — Quote not found
   ────────────────────────────────────────────────────────────── */

function build404HTML(quoteId) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preventivo non trovato</title>
  ${FONT_LINKS}
  <style>
    ${BASE_RESET}
    body{display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;border-radius:14px;box-shadow:0 2px 6px rgba(0,0,0,.04),0 8px 30px rgba(0,0,0,.07);text-align:center;padding:56px 48px;max-width:440px;width:100%}
    .error-code{font-size:4.5rem;font-weight:800;color:#edeae6;letter-spacing:-.04em;line-height:1}
    .card h2{font-size:1.15rem;font-weight:700;color:#2c2825;margin:16px 0 8px}
    .card p{color:#7a756e;font-size:.92rem;line-height:1.6}
    code{background:#faf9f7;padding:3px 10px;border-radius:6px;font-size:.8rem;color:#9a9691;border:1px solid #edeae6}
  </style>
</head>
<body>
  <div class="card">
    <div class="error-code">404</div>
    <h2>Preventivo non trovato</h2>
    <p>Il preventivo <code>${esc(quoteId)}</code> non esiste o &egrave; stato rimosso.</p>
  </div>
</body>
</html>`;
}

/* ──────────────────────────────────────────────────────────────
   buildAcceptedHTML — Quote accepted confirmation
   ────────────────────────────────────────────────────────────── */

function buildAcceptedHTML(quote) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preventivo Accettato</title>
  ${FONT_LINKS}
  <style>
    ${BASE_RESET}
    body{display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;border-radius:14px;box-shadow:0 2px 6px rgba(0,0,0,.04),0 8px 30px rgba(0,0,0,.07);text-align:center;padding:56px 48px;max-width:500px;width:100%}
    .check-circle{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#16a34a,#15803d);display:flex;align-items:center;justify-content:center;margin:0 auto 24px;box-shadow:0 4px 16px rgba(22,163,74,.25)}
    .check-circle svg{width:36px;height:36px;color:#fff}
    .card h1{font-size:1.4rem;font-weight:700;color:#15803d;margin-bottom:12px}
    .card p{color:#7a756e;font-size:.92rem;line-height:1.7;margin-bottom:4px}
    .total-display{font-size:1.6rem;font-weight:800;color:#2c2825;margin:20px 0;letter-spacing:-.02em}
    .ref{font-size:.78rem;color:#b0ada8;margin-top:24px;padding-top:16px;border-top:1px solid #edeae6}
  </style>
</head>
<body>
  <div class="card">
    <div class="check-circle">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <h1>Preventivo accettato!</h1>
    <p>Grazie <strong>${esc(quote.client.name)}</strong>, il preventivo &egrave; stato accettato con successo.</p>
    <div class="total-display">${fmt(quote.total)} ${esc(quote.currency)}</div>
    <p>${esc(quote.professional.name)} ricever&agrave; una notifica e ti contatter&agrave; a breve.</p>
    <div class="ref">Rif. ${esc(quote.quote_id)}</div>
  </div>
</body>
</html>`;
}

/* ──────────────────────────────────────────────────────────────
   buildAlreadyHandledHTML — Quote already handled
   ────────────────────────────────────────────────────────────── */

function buildAlreadyHandledHTML(quote) {
  const statusLabels = {
    accepted: "gi\u00E0 accettato",
    rejected: "rifiutato",
    expired: "scaduto",
    draft: "ancora in bozza"
  };
  const label = statusLabels[quote.status] || quote.status;

  const statusColors = {
    accepted: { bg: "#ecfdf5", fg: "#065f46", border: "#a7f3d0" },
    rejected: { bg: "#fef2f2", fg: "#991b1b", border: "#fecaca" },
    expired: { bg: "#fffbeb", fg: "#92400e", border: "#fde68a" },
    draft: { bg: "#f0f9ff", fg: "#1e40af", border: "#bfdbfe" }
  };
  const sc = statusColors[quote.status] || { bg: "#faf9f7", fg: "#7a756e", border: "#edeae6" };

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preventivo gi&agrave; gestito</title>
  ${FONT_LINKS}
  <style>
    ${BASE_RESET}
    body{display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;border-radius:14px;box-shadow:0 2px 6px rgba(0,0,0,.04),0 8px 30px rgba(0,0,0,.07);text-align:center;padding:56px 48px;max-width:500px;width:100%}
    .icon-circle{width:72px;height:72px;border-radius:50%;background:${sc.bg};border:2px solid ${sc.border};display:flex;align-items:center;justify-content:center;margin:0 auto 24px}
    .icon-circle svg{width:32px;height:32px;color:${sc.fg}}
    .card h1{font-size:1.3rem;font-weight:700;color:#2c2825;margin-bottom:12px}
    .status-badge{display:inline-block;background:${sc.bg};color:${sc.fg};border:1px solid ${sc.border};font-size:.8rem;font-weight:700;padding:5px 16px;border-radius:20px;margin-bottom:16px;text-transform:uppercase;letter-spacing:.04em}
    .card p{color:#7a756e;font-size:.92rem;line-height:1.7}
    .ref{font-size:.78rem;color:#b0ada8;margin-top:24px;padding-top:16px;border-top:1px solid #edeae6}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-circle">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    </div>
    <div class="status-badge">${esc(label)}</div>
    <h1>Preventivo non disponibile</h1>
    <p>Questo preventivo risulta <strong>${esc(label)}</strong> e non pu&ograve; essere accettato.</p>
    <div class="ref">Rif. ${esc(quote.quote_id)}</div>
  </div>
</body>
</html>`;
}

module.exports = { buildQuoteHTML, build404HTML, buildAcceptedHTML, buildAlreadyHandledHTML };
