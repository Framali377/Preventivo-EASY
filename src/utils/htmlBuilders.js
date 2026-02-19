// src/utils/htmlBuilders.js
const { SHARED_CSS, esc, fmt } = require("./layout");

function buildQuoteHTML(quote) {
  const rows = quote.line_items.map(i => `
    <tr>
      <td style="padding:14px 18px;font-weight:500;color:#1e1e2d">${esc(i.description)}</td>
      <td class="c" style="padding:14px 12px;color:#6b7280">${i.quantity}</td>
      <td class="r" style="padding:14px 18px;font-weight:500">${fmt(i.unit_price)} &euro;</td>
      <td class="r" style="padding:14px 18px;font-weight:600;color:#1e1e2d">${fmt(i.subtotal)} &euro;</td>
    </tr>
  `).join("");

  const createdDate = new Date(quote.created_at).toLocaleDateString("it-IT", {
    day: "2-digit", month: "long", year: "numeric"
  });

  const presetLabels = {
    economy: "Economy",
    standard: "Standard",
    premium: "Premium"
  };

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preventivo ${esc(quote.quote_id)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f2f5;color:#1e1e2d;min-height:100vh;font-size:14px;line-height:1.6}
    .container{max-width:720px;margin:24px auto;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);overflow:hidden}
    .header{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);color:#fff;padding:32px 36px;position:relative}
    .header h1{font-size:1.3rem;font-weight:700;margin-bottom:4px;letter-spacing:-.02em}
    .header .id{font-size:.82rem;opacity:.5}
    .body{padding:36px}

    /* Meta grid */
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}
    @media(max-width:500px){.meta{grid-template-columns:1fr}}
    .meta-block{background:#f8f9fb;border-radius:10px;padding:16px 20px}
    .meta-block h3{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:8px;font-weight:600}
    .meta-block p{font-size:.95rem;line-height:1.5}
    .meta-block strong{font-weight:600;color:#1e1e2d}

    /* Description */
    .desc{background:linear-gradient(135deg,#f0f4ff,#f8f9ff);border-left:3px solid #2563eb;padding:16px 20px;border-radius:0 10px 10px 0;margin-bottom:28px;font-size:.93rem;line-height:1.7;color:#374151}

    /* Table */
    .items-table{width:100%;border-collapse:collapse;font-size:.88rem;margin-bottom:4px}
    .items-table thead th{background:#f9fafb;text-align:left;padding:12px 18px;font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:2px solid #e5e7eb}
    .items-table thead th.r{text-align:right}
    .items-table thead th.c{text-align:center}
    .items-table tbody td{border-bottom:1px solid #f3f4f6}
    .items-table tbody tr:nth-child(even){background:#f9fafb}
    .items-table tbody tr:last-child td{border-bottom:none}
    .items-table tbody tr:hover{background:#f0f4ff}

    /* Totals */
    .totals-card{background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:12px;padding:20px 24px;color:#fff;margin:20px 0 28px}
    .totals-row{display:flex;justify-content:space-between;padding:6px 0;font-size:.92rem;color:rgba(255,255,255,.7)}
    .totals-row.grand{font-size:1.5rem;font-weight:700;color:#fff;border-top:2px solid rgba(255,255,255,.25);padding-top:14px;margin-top:10px}

    /* Footer */
    .footer{display:flex;flex-wrap:wrap;gap:20px;justify-content:space-between;align-items:center;font-size:.82rem;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:20px;margin-top:8px}
    .footer strong{color:#6b7280}
    .preset-badge{display:inline-block;background:#ecfdf5;color:#065f46;font-size:.72rem;font-weight:600;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:.04em}

    /* PDF button */
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:12px 28px;border-radius:10px;font-size:.88rem;font-weight:600;cursor:pointer;border:none;text-decoration:none;text-align:center;transition:all .2s;line-height:1.4}
    .btn-primary{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;box-shadow:0 2px 8px rgba(37,99,235,.25)}
    .btn-primary:hover{box-shadow:0 4px 16px rgba(37,99,235,.35);transform:translateY(-1px)}

    /* Notes */
    .notes-block{background:#f8f9fb;border-left:3px solid #2563eb;padding:14px 18px;border-radius:0 8px 8px 0;font-size:.9rem;line-height:1.6;margin-bottom:20px;color:#374151}

    @media(max-width:640px){
      .body{padding:24px 20px}
      .header{padding:24px 20px}
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Preventivo</h1>
      <span class="id">${esc(quote.quote_id)} &middot; ${createdDate}</span>
    </div>
    <div class="body">
      <div class="meta">
        <div class="meta-block">
          <h3>Professionista</h3>
          <p><strong>${esc(quote.professional.name)}</strong><br>
          ${esc(quote.professional.category)} &middot; ${esc(quote.professional.city)}</p>
        </div>
        <div class="meta-block">
          <h3>Cliente</h3>
          <p><strong>${esc(quote.client.name)}</strong><br>
          ${esc(quote.client.email)}</p>
        </div>
      </div>

      <div class="desc">${esc(quote.job_description)}</div>

      <h3 style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;font-weight:700;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #f0f1f3">Dettaglio voci</h3>
      <table class="items-table">
        <thead>
          <tr>
            <th>Descrizione</th>
            <th class="c" style="width:60px">Qtà</th>
            <th class="r" style="width:120px">Prezzo unit.</th>
            <th class="r" style="width:120px">Subtotale</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals-card">
        <div class="totals-row"><span>Imponibile</span><span>${fmt(quote.subtotal)} &euro;</span></div>
        ${quote.cassa ? `<div class="totals-row"><span>Contributo cassa ${quote.tax_profile ? quote.tax_profile.previdenza_percent + "%" : "4%"}</span><span>${fmt(quote.cassa)} &euro;</span></div>` : ""}
        <div class="totals-row"><span>${quote.tax_profile ? (quote.tax_profile.iva_percent > 0 ? "IVA " + quote.tax_profile.iva_percent + "%" : "IVA (esente)") : "IVA"}</span><span>${fmt(quote.taxes)} &euro;</span></div>
        <div class="totals-row grand"><span>Totale</span><span>${fmt(quote.total)} ${esc(quote.currency)}</span></div>
      </div>

      ${quote.notes ? `<div class="notes-block">${esc(quote.notes)}</div>` : ""}

      <div class="footer">
        <div><strong>Pagamento:</strong> ${esc(quote.payment_terms)}</div>
        <div><strong>Validità:</strong> ${quote.validity_days} giorni</div>
        ${quote.tax_profile ? `<div><span class="preset-badge">${esc(quote.tax_profile.name)}</span></div>` : `<div><span class="preset-badge">${esc(presetLabels[quote.pricing_preset] || quote.pricing_preset)}</span></div>`}
      </div>

      <div style="text-align:center;margin-top:28px">
        <a href="/q/${esc(quote.quote_id)}/pdf" class="btn btn-primary">Scarica PDF</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function build404HTML(quoteId) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preventivo non trovato</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f2f5;color:#1e1e2d;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center;padding:48px 40px}
    .card h1{font-size:3rem;color:#e2e4e8;margin-bottom:8px;font-weight:700}
    .card p{color:#6b7280;font-size:1rem}
    code{background:#f3f4f6;padding:2px 8px;border-radius:6px;font-size:.85rem}
  </style>
</head>
<body>
  <div class="card">
    <h1>404</h1>
    <p>Preventivo <code>${esc(quoteId)}</code> non trovato.</p>
  </div>
</body>
</html>`;
}

function buildAcceptedHTML(quote) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preventivo Accettato</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f2f5;color:#1e1e2d;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center;padding:48px 40px;max-width:480px}
    .icon{font-size:3.5rem;margin-bottom:12px}
    .card h1{font-size:1.4rem;font-weight:700;color:#059669;margin-bottom:8px}
    .card p{color:#6b7280;font-size:.95rem;line-height:1.6;margin-bottom:6px}
    .total{font-size:1.3rem;font-weight:700;color:#1e1e2d;margin:16px 0}
    .note{font-size:.82rem;color:#9ca3af;margin-top:20px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>Preventivo Accettato</h1>
    <p>Grazie <strong>${esc(quote.client.name)}</strong>, il preventivo &egrave; stato accettato con successo.</p>
    <div class="total">${fmt(quote.total)} ${esc(quote.currency)}</div>
    <p>${esc(quote.professional.name)} ricever&agrave; una notifica e ti contatter&agrave; a breve.</p>
    <p class="note">Rif. ${esc(quote.quote_id)}</p>
  </div>
</body>
</html>`;
}

function buildAlreadyHandledHTML(quote) {
  const statusLabels = {
    accepted: "gi\u00E0 accettato",
    rejected: "rifiutato",
    expired: "scaduto",
    draft: "ancora in bozza"
  };
  const label = statusLabels[quote.status] || quote.status;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preventivo gi&agrave; gestito</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f2f5;color:#1e1e2d;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center;padding:48px 40px;max-width:480px}
    .icon{font-size:3.5rem;margin-bottom:12px;color:#9ca3af}
    .card h1{font-size:1.4rem;font-weight:700;color:#6b7280;margin-bottom:8px}
    .card p{color:#6b7280;font-size:.95rem;line-height:1.6}
    .note{font-size:.82rem;color:#9ca3af;margin-top:20px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#8505;</div>
    <h1>Preventivo ${esc(label)}</h1>
    <p>Questo preventivo risulta <strong>${esc(label)}</strong> e non pu&ograve; essere accettato.</p>
    <p class="note">Rif. ${esc(quote.quote_id)}</p>
  </div>
</body>
</html>`;
}

module.exports = { buildQuoteHTML, build404HTML, buildAcceptedHTML, buildAlreadyHandledHTML };
