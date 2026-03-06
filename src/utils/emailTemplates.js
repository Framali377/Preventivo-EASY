// src/utils/emailTemplates.js

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(n) {
  return Number(n || 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildQuoteEmailHTML(quote, acceptUrl, viewUrl) {
  const createdDate = new Date(quote.created_at).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const jobDesc = quote.job_description && quote.job_description.length > 120
    ? quote.job_description.substring(0, 117) + "..."
    : quote.job_description;

  // Build line items rows
  const itemRows = (quote.line_items || []).map((item, i) => `
                <tr>
                  <td style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;">${esc(item.description)}</td>
                  <td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;text-align:center;border-bottom:1px solid #f3f4f6;">${item.quantity}</td>
                  <td style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1c1917;text-align:right;font-weight:600;border-bottom:1px solid #f3f4f6;">${fmt(item.subtotal)} &euro;</td>
                </tr>`).join("");

  const cassaRow = quote.cassa
    ? `<tr>
        <td colspan="2" style="padding:6px 16px;font-size:13px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">Contributo cassa</td>
        <td style="padding:6px 16px;font-size:13px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;">${fmt(quote.cassa)} &euro;</td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Preventivo da ${esc(quote.professional.name)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1c1917;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f4;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background-color:#1c1917;padding:32px 40px 28px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:36px;height:36px;background:linear-gradient(135deg,#0d9488,#0891b2);border-radius:8px;text-align:center;vertical-align:middle;">
                          <span style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;">P</span>
                        </td>
                        <td style="padding-left:12px;">
                          <span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#ffffff;">${esc(quote.professional.name)}</span>
                          <br><span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#a8a29e;">${esc(quote.professional.category || "")}${quote.professional.city ? " &middot; " + esc(quote.professional.city) : ""}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="text-align:right;vertical-align:top;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#78716c;">${createdDate}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ACCENT LINE -->
          <tr><td style="height:3px;background:linear-gradient(90deg,#0d9488,#0891b2);font-size:1px;line-height:1px;">&nbsp;</td></tr>

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 40px 16px 40px;">
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#374151;margin:0;">
                Gentile <strong>${esc(quote.client.name)}</strong>,
              </p>
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#6b7280;margin:12px 0 0 0;">
                le invio il preventivo relativo a: <strong style="color:#1c1917;">${esc(jobDesc)}</strong>
              </p>
            </td>
          </tr>

          <!-- LINE ITEMS TABLE -->
          <tr>
            <td style="padding:8px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <!-- Table header -->
                <tr style="background-color:#f9fafb;">
                  <td style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;border-bottom:1px solid #e5e7eb;">Descrizione</td>
                  <td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;text-align:center;border-bottom:1px solid #e5e7eb;width:50px;">Qt&agrave;</td>
                  <td style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;text-align:right;border-bottom:1px solid #e5e7eb;width:100px;">Importo</td>
                </tr>
                <!-- Items -->
                ${itemRows}
              </table>
            </td>
          </tr>

          <!-- TOTALS -->
          <tr>
            <td style="padding:16px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <!-- Imponibile -->
                <tr>
                  <td colspan="2" style="padding:6px 16px;font-size:13px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">Imponibile</td>
                  <td style="padding:6px 16px;font-size:13px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;">${fmt(quote.subtotal)} &euro;</td>
                </tr>
                ${cassaRow}
                <!-- IVA -->
                <tr>
                  <td colspan="2" style="padding:6px 16px;font-size:13px;color:#6b7280;font-family:Arial,Helvetica,sans-serif;">IVA</td>
                  <td style="padding:6px 16px;font-size:13px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;">${fmt(quote.taxes)} &euro;</td>
                </tr>
                <!-- Separator -->
                <tr>
                  <td colspan="3" style="padding:4px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:2px solid #1c1917;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
                  </td>
                </tr>
                <!-- Totale -->
                <tr>
                  <td colspan="2" style="padding:10px 16px;font-size:20px;font-weight:bold;color:#1c1917;font-family:Arial,Helvetica,sans-serif;">Totale</td>
                  <td style="padding:10px 16px;font-size:20px;font-weight:bold;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;">${fmt(quote.total)} &euro;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- PAYMENT / VALIDITY -->
          <tr>
            <td style="padding:16px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;border-radius:8px;">
                <tr>
                  <td style="padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;">
                    <strong style="color:#374151;">Pagamento:</strong> ${esc(quote.payment_terms)}<br>
                    <strong style="color:#374151;">Validit&agrave;:</strong> ${quote.validity_days} giorni dalla data di emissione
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- NOTES -->
          ${quote.notes ? `<tr>
            <td style="padding:16px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-left:3px solid #0d9488;padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#57534e;line-height:1.6;background-color:#f0fdfa;border-radius:0 6px 6px 0;">
                    <strong style="color:#1c1917;">Note:</strong><br>${esc(quote.notes)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}

          <!-- CTA BUTTONS -->
          <tr>
            <td style="padding:28px 40px 0 40px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" style="background-color:#0d9488;border-radius:8px;">
                    <a href="${viewUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;min-width:220px;text-align:center;">
                      Visualizza preventivo completo
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 40px 0 40px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" style="background-color:#059669;border-radius:8px;">
                    <a href="${acceptUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;min-width:220px;text-align:center;">
                      Accetta preventivo
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:28px 40px 32px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #e7e5e4;padding-top:16px;">
                    <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#a8a29e;line-height:1.5;margin:0;">
                      Preventivo inviato tramite <strong style="color:#78716c;">Preventivo EASY</strong><br>
                      Questa email &egrave; stata generata automaticamente. Se non ha richiesto alcun preventivo, pu&ograve; ignorare questo messaggio.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildAcceptedNotificationHTML(quote, detailUrl) {
  const createdDate = new Date(quote.created_at).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const jobDesc = quote.job_description && quote.job_description.length > 120
    ? quote.job_description.substring(0, 117) + "..."
    : quote.job_description;

  return `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Preventivo Accettato</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1c1917;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f4;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background-color:#059669;padding:32px 40px 28px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;line-height:1.3;">
                    Preventivo accettato
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#a7f3d0;padding-top:6px;">
                    ${createdDate}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:3px;background:linear-gradient(90deg,#059669,#10b981);font-size:1px;line-height:1px;">&nbsp;</td></tr>

          <!-- BODY -->
          <tr>
            <td style="padding:28px 40px 16px 40px;">
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#374151;margin:0;">
                Il cliente <strong>${esc(quote.client.name)}</strong> ha accettato il preventivo.
              </p>
            </td>
          </tr>

          <!-- SUMMARY CARD -->
          <tr>
            <td style="padding:8px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 20px;font-size:13px;color:#4b5563;font-family:Arial,Helvetica,sans-serif;">Lavoro</td>
                  <td style="padding:14px 20px;font-size:14px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;font-weight:600;">${esc(jobDesc)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 20px;font-size:13px;color:#4b5563;font-family:Arial,Helvetica,sans-serif;">Cliente</td>
                  <td style="padding:6px 20px;font-size:14px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;">${esc(quote.client.name)} &mdash; <a href="mailto:${esc(quote.client.email)}" style="color:#059669;text-decoration:none;">${esc(quote.client.email)}</a></td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:4px 20px;"><table role="presentation" width="100%"><tr><td style="border-top:1px solid #bbf7d0;">&nbsp;</td></tr></table></td>
                </tr>
                <tr>
                  <td style="padding:10px 20px 14px;font-size:18px;font-weight:bold;color:#059669;font-family:Arial,Helvetica,sans-serif;">Totale</td>
                  <td style="padding:10px 20px 14px;font-size:18px;font-weight:bold;color:#059669;text-align:right;font-family:Arial,Helvetica,sans-serif;">${fmt(quote.total)} &euro;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:24px 40px 0 40px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" style="background-color:#0d9488;border-radius:8px;">
                    <a href="${detailUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Vedi dettaglio
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:28px 40px 32px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #e7e5e4;padding-top:16px;">
                    <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#a8a29e;line-height:1.5;margin:0;">
                      Notifica da <strong style="color:#78716c;">Preventivo EASY</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { buildQuoteEmailHTML, buildAcceptedNotificationHTML };
