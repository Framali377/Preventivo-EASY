// src/utils/emailTemplates.js

function esc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function fmt(n) { return Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function buildQuoteEmailHTML(quote, acceptUrl, viewUrl) {
  const rows = quote.line_items.map(i => `
    <tr>
      <td style="padding:12px 16px;font-weight:500;color:#1e1e2d;border-bottom:1px solid #f3f4f6">${esc(i.description)}</td>
      <td style="padding:12px 10px;color:#6b7280;text-align:center;border-bottom:1px solid #f3f4f6">${i.quantity}</td>
      <td style="padding:12px 16px;font-weight:500;text-align:right;border-bottom:1px solid #f3f4f6">${fmt(i.unit_price)} &euro;</td>
      <td style="padding:12px 16px;font-weight:600;color:#1e1e2d;text-align:right;border-bottom:1px solid #f3f4f6">${fmt(i.subtotal)} &euro;</td>
    </tr>
  `).join("");

  const createdDate = new Date(quote.created_at).toLocaleDateString("it-IT", {
    day: "2-digit", month: "long", year: "numeric"
  });

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#1e1e2d">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);color:#fff;padding:32px 36px">
          <h1 style="margin:0 0 4px;font-size:1.3rem;font-weight:700;letter-spacing:-.02em">Nuovo Preventivo</h1>
          <span style="font-size:.82rem;opacity:.5">${esc(quote.quote_id)} &middot; ${createdDate}</span>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px">
          <p style="margin:0 0 20px;font-size:.95rem;line-height:1.6;color:#374151">
            Gentile <strong>${esc(quote.client.name)}</strong>,<br>
            Le inviamo il preventivo richiesto da <strong>${esc(quote.professional.name)}</strong>.
          </p>

          <!-- Job description -->
          <div style="background:linear-gradient(135deg,#f0f4ff,#f8f9ff);border-left:3px solid #2563eb;padding:14px 18px;border-radius:0 10px 10px 0;margin-bottom:24px;font-size:.93rem;line-height:1.7;color:#374151">
            ${esc(quote.job_description)}
          </div>

          <!-- Items table -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:.88rem;margin-bottom:4px">
            <tr style="background:#f9fafb">
              <th style="text-align:left;padding:12px 16px;font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:2px solid #e5e7eb">Descrizione</th>
              <th style="text-align:center;padding:12px 10px;font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:2px solid #e5e7eb;width:60px">Qt&agrave;</th>
              <th style="text-align:right;padding:12px 16px;font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:2px solid #e5e7eb;width:110px">Prezzo unit.</th>
              <th style="text-align:right;padding:12px 16px;font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:2px solid #e5e7eb;width:110px">Subtotale</th>
            </tr>
            ${rows}
          </table>

          <!-- Totals -->
          <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:12px;padding:20px 24px;color:#fff;margin:20px 0 28px">
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:.92rem;color:rgba(255,255,255,.7)"><span>Imponibile</span><span>${fmt(quote.subtotal)} &euro;</span></div>
            ${quote.cassa ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:.92rem;color:rgba(255,255,255,.7)"><span>Contributo cassa</span><span>${fmt(quote.cassa)} &euro;</span></div>` : ""}
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:.92rem;color:rgba(255,255,255,.7)"><span>IVA</span><span>${fmt(quote.taxes)} &euro;</span></div>
            <div style="display:flex;justify-content:space-between;padding-top:12px;margin-top:8px;border-top:1px solid rgba(255,255,255,.15);font-size:1.3rem;font-weight:700;color:#fff"><span>Totale</span><span>${fmt(quote.total)} ${esc(quote.currency)}</span></div>
          </div>

          <!-- CTA Buttons -->
          <div style="text-align:center;margin:32px 0 16px">
            <a href="${acceptUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#059669,#047857);color:#fff;font-size:.95rem;font-weight:700;border-radius:10px;text-decoration:none;box-shadow:0 2px 8px rgba(5,150,105,.3)">Accetta preventivo</a>
          </div>
          <div style="text-align:center;margin-bottom:8px">
            <a href="${viewUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:.88rem;font-weight:600;border-radius:10px;text-decoration:none;box-shadow:0 2px 8px rgba(37,99,235,.25)">Visualizza online</a>
          </div>

          <!-- Footer -->
          <div style="font-size:.82rem;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:20px;margin-top:24px">
            <p style="margin:0"><strong style="color:#6b7280">Pagamento:</strong> ${esc(quote.payment_terms)}</p>
            <p style="margin:4px 0 0"><strong style="color:#6b7280">Validit&agrave;:</strong> ${quote.validity_days} giorni</p>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildAcceptedNotificationHTML(quote, detailUrl) {
  const createdDate = new Date(quote.created_at).toLocaleDateString("it-IT", {
    day: "2-digit", month: "long", year: "numeric"
  });

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#1e1e2d">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);color:#fff;padding:32px 36px">
          <h1 style="margin:0 0 4px;font-size:1.3rem;font-weight:700;letter-spacing:-.02em">Preventivo Accettato!</h1>
          <span style="font-size:.82rem;opacity:.7">${esc(quote.quote_id)} &middot; ${createdDate}</span>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px">
          <p style="margin:0 0 20px;font-size:.95rem;line-height:1.6;color:#374151">
            Il cliente <strong>${esc(quote.client.name)}</strong> (${esc(quote.client.email)}) ha accettato il preventivo.
          </p>

          <!-- Summary card -->
          <div style="background:#f8f9fb;border-radius:10px;padding:20px 24px;margin-bottom:24px">
            <p style="margin:0 0 8px;font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;font-weight:600">Riepilogo</p>
            <p style="margin:0 0 4px;font-size:.95rem"><strong>Lavoro:</strong> ${esc(quote.job_description)}</p>
            <p style="margin:0;font-size:1.2rem;font-weight:700;color:#059669;margin-top:12px">Totale: ${fmt(quote.total)} ${esc(quote.currency)}</p>
          </div>

          <div style="text-align:center;margin:28px 0 8px">
            <a href="${detailUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:.88rem;font-weight:600;border-radius:10px;text-decoration:none;box-shadow:0 2px 8px rgba(37,99,235,.25)">Vedi dettaglio</a>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { buildQuoteEmailHTML, buildAcceptedNotificationHTML };
