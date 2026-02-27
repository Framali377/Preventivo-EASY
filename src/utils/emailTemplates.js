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

  const jobDesc = quote.job_description && quote.job_description.length > 100
    ? quote.job_description.substring(0, 97) + "..."
    : quote.job_description;

  const cassaRow = quote.cassa
    ? `<tr>
        <td style="padding:8px 20px;font-size:14px;color:#57534e;font-family:Arial,Helvetica,sans-serif;">Contributo cassa</td>
        <td style="padding:8px 20px;font-size:14px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;">${fmt(quote.cassa)} &euro;</td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Nuovo Preventivo</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1c1917;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f4;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Main container 600px -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">

          <!-- ===== HEADER ===== -->
          <tr>
            <td style="background-color:#1c1917;padding:36px 40px 32px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;line-height:1.3;">
                    ${esc(quote.professional.name)}
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#a8a29e;padding-top:6px;letter-spacing:0.03em;">
                    ${esc(quote.professional.category)} &middot; ${esc(quote.professional.city)}
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color:#0d9488;border-radius:4px;padding:6px 14px;">
                          <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#ffffff;letter-spacing:0.04em;text-transform:uppercase;">Nuovo Preventivo</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#78716c;padding-top:12px;">
                    ${esc(quote.quote_id)} &middot; ${createdDate}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ===== GREETING ===== -->
          <tr>
            <td style="padding:32px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#374151;">
                    Gentile <strong>${esc(quote.client.name)}</strong>,<br><br>
                    <strong>${esc(quote.professional.name)}</strong> le ha inviato un preventivo.
                    Trova di seguito il riepilogo; pu&ograve; consultare il dettaglio completo e accettare il preventivo tramite i pulsanti in basso.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ===== SUMMARY CARD ===== -->
          <tr>
            <td style="padding:24px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;overflow:hidden;">

                <!-- Card title -->
                <tr>
                  <td colspan="2" style="padding:16px 20px 12px 20px;border-bottom:1px solid #e7e5e4;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#a8a29e;">Riepilogo preventivo</span>
                  </td>
                </tr>

                <!-- Oggetto -->
                <tr>
                  <td style="padding:12px 20px 4px 20px;font-size:13px;color:#78716c;font-family:Arial,Helvetica,sans-serif;">Oggetto</td>
                  <td style="padding:12px 20px 4px 20px;font-size:14px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;font-weight:bold;">${esc(jobDesc)}</td>
                </tr>

                <!-- Numero voci -->
                <tr>
                  <td style="padding:4px 20px;font-size:13px;color:#78716c;font-family:Arial,Helvetica,sans-serif;">Voci</td>
                  <td style="padding:4px 20px;font-size:14px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;">${quote.line_items.length} voci</td>
                </tr>

                <!-- Separator -->
                <tr>
                  <td colspan="2" style="padding:8px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="border-top:1px solid #e7e5e4;font-size:1px;line-height:1px;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>

                <!-- Imponibile -->
                <tr>
                  <td style="padding:8px 20px;font-size:14px;color:#57534e;font-family:Arial,Helvetica,sans-serif;">Imponibile</td>
                  <td style="padding:8px 20px;font-size:14px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;">${fmt(quote.subtotal)} &euro;</td>
                </tr>

                <!-- Cassa (conditional) -->
                ${cassaRow}

                <!-- IVA -->
                <tr>
                  <td style="padding:8px 20px;font-size:14px;color:#57534e;font-family:Arial,Helvetica,sans-serif;">IVA</td>
                  <td style="padding:8px 20px;font-size:14px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;">${fmt(quote.taxes)} &euro;</td>
                </tr>

                <!-- Totale -->
                <tr>
                  <td colspan="2" style="padding:4px 20px 0 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="border-top:2px solid #1c1917;font-size:1px;line-height:1px;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 20px 16px 20px;font-size:18px;font-weight:bold;color:#1c1917;font-family:Arial,Helvetica,sans-serif;">Totale</td>
                  <td style="padding:12px 20px 16px 20px;font-size:18px;font-weight:bold;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;">${fmt(quote.total)} &euro;</td>
                </tr>

                <!-- Separator -->
                <tr>
                  <td colspan="2" style="padding:0 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="border-top:1px solid #e7e5e4;font-size:1px;line-height:1px;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>

                <!-- Pagamento -->
                <tr>
                  <td style="padding:12px 20px 4px 20px;font-size:13px;color:#78716c;font-family:Arial,Helvetica,sans-serif;">Pagamento</td>
                  <td style="padding:12px 20px 4px 20px;font-size:14px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;">${esc(quote.payment_terms)}</td>
                </tr>

                <!-- Validit&agrave; -->
                <tr>
                  <td style="padding:4px 20px 16px 20px;font-size:13px;color:#78716c;font-family:Arial,Helvetica,sans-serif;">Validit&agrave;</td>
                  <td style="padding:4px 20px 16px 20px;font-size:14px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;">${quote.validity_days} giorni</td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- ===== CTA BUTTONS ===== -->
          <tr>
            <td style="padding:32px 40px 0 40px;" align="center">
              <!-- View button (teal) -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" style="background-color:#0d9488;border-radius:8px;">
                    <a href="${viewUrl}" target="_blank" style="display:inline-block;padding:15px 40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;min-width:240px;text-align:center;">
                      Visualizza preventivo completo
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 40px 0 40px;" align="center">
              <!-- Accept button (green, prominent) -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" style="background-color:#059669;border-radius:8px;">
                    <a href="${acceptUrl}" target="_blank" style="display:inline-block;padding:17px 40px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;min-width:240px;text-align:center;letter-spacing:0.02em;">
                      &#10003; Accetta preventivo
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ===== NOTES (if any) ===== -->
          ${quote.notes ? `<tr>
            <td style="padding:28px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-left:3px solid #0d9488;padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#57534e;line-height:1.6;background-color:#f0fdfa;border-radius:0 6px 6px 0;">
                    <strong style="color:#1c1917;">Note:</strong><br>${esc(quote.notes)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}

          <!-- ===== FOOTER ===== -->
          <tr>
            <td style="padding:32px 40px 36px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #e7e5e4;padding-top:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#a8a29e;line-height:1.6;">
                          Preventivo inviato tramite <strong style="color:#78716c;">Preventivo EASY</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#d6d3d1;line-height:1.5;padding-top:8px;">
                          Questa email &egrave; stata generata automaticamente.
                          Se non ha richiesto alcun preventivo, pu&ograve; ignorare questo messaggio.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- End main container -->

      </td>
    </tr>
  </table>
  <!-- End outer wrapper -->
</body>
</html>`;
}

function buildAcceptedNotificationHTML(quote, detailUrl) {
  const createdDate = new Date(quote.created_at).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const jobDesc = quote.job_description && quote.job_description.length > 100
    ? quote.job_description.substring(0, 97) + "..."
    : quote.job_description;

  return `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Preventivo Accettato</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1c1917;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f4;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Main container 600px -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">

          <!-- ===== HEADER ===== -->
          <tr>
            <td style="background-color:#059669;padding:36px 40px 32px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold;color:#ffffff;line-height:1.3;">
                    &#10003; Preventivo accettato!
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#a7f3d0;padding-top:8px;">
                    ${esc(quote.quote_id)} &middot; ${createdDate}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ===== BODY ===== -->
          <tr>
            <td style="padding:32px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#374151;">
                    Ottima notizia! Il cliente ha accettato il suo preventivo.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ===== CLIENT INFO CARD ===== -->
          <tr>
            <td style="padding:20px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;overflow:hidden;">
                <tr>
                  <td colspan="2" style="padding:14px 20px 10px 20px;border-bottom:1px solid #bbf7d0;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#15803d;">Dati cliente</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 20px 4px 20px;font-size:13px;color:#4b5563;font-family:Arial,Helvetica,sans-serif;">Nome</td>
                  <td style="padding:10px 20px 4px 20px;font-size:14px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;font-weight:bold;">${esc(quote.client.name)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 20px 14px 20px;font-size:13px;color:#4b5563;font-family:Arial,Helvetica,sans-serif;">Email</td>
                  <td style="padding:4px 20px 14px 20px;font-size:14px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;">
                    <a href="mailto:${esc(quote.client.email)}" style="color:#059669;text-decoration:none;">${esc(quote.client.email)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ===== QUOTE SUMMARY CARD ===== -->
          <tr>
            <td style="padding:12px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;overflow:hidden;">
                <tr>
                  <td colspan="2" style="padding:14px 20px 10px 20px;border-bottom:1px solid #e7e5e4;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:#a8a29e;">Riepilogo preventivo</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 20px 4px 20px;font-size:13px;color:#78716c;font-family:Arial,Helvetica,sans-serif;">Lavoro</td>
                  <td style="padding:10px 20px 4px 20px;font-size:14px;color:#1c1917;text-align:right;font-family:Arial,Helvetica,sans-serif;">${esc(jobDesc)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 20px 0 20px;" colspan="2">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="border-top:1px solid #e7e5e4;font-size:1px;line-height:1px;padding-top:4px;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 20px 16px 20px;font-size:18px;font-weight:bold;color:#059669;font-family:Arial,Helvetica,sans-serif;">Totale</td>
                  <td style="padding:10px 20px 16px 20px;font-size:18px;font-weight:bold;color:#059669;text-align:right;font-family:Arial,Helvetica,sans-serif;">${fmt(quote.total)} &euro;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ===== CTA BUTTON ===== -->
          <tr>
            <td style="padding:28px 40px 0 40px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td align="center" style="background-color:#0d9488;border-radius:8px;">
                    <a href="${detailUrl}" target="_blank" style="display:inline-block;padding:15px 40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;min-width:200px;text-align:center;">
                      Vedi dettaglio preventivo
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ===== FOOTER ===== -->
          <tr>
            <td style="padding:32px 40px 36px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #e7e5e4;padding-top:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#a8a29e;line-height:1.6;">
                          Notifica da <strong style="color:#78716c;">Preventivo EASY</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#d6d3d1;line-height:1.5;padding-top:8px;">
                          Questa &egrave; una notifica automatica relativa a un preventivo gestito tramite la piattaforma.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- End main container -->

      </td>
    </tr>
  </table>
  <!-- End outer wrapper -->
</body>
</html>`;
}

module.exports = { buildQuoteEmailHTML, buildAcceptedNotificationHTML };
