// src/utils/pdfBuilder.js
const PDFDocument = require("pdfkit");

const COLORS = { dark: "#1a1a2e", mid: "#555", light: "#888", accent: "#2563eb", line: "#ddd" };

function fmt(n) {
  return Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function buildQuotePDF(quote) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  const createdDate = new Date(quote.created_at).toLocaleDateString("it-IT", {
    day: "2-digit", month: "long", year: "numeric"
  });

  // --- Header ---
  doc.rect(0, 0, 595, 90).fill(COLORS.dark);
  doc.fillColor("#fff").fontSize(22).font("Helvetica-Bold").text("PREVENTIVO", 50, 30);
  doc.fontSize(9).font("Helvetica").fillColor("#aaa").text(`${quote.quote_id}  •  ${createdDate}`, 50, 58);

  let y = 110;

  // --- Meta: professionista + cliente ---
  doc.fillColor(COLORS.light).fontSize(8).font("Helvetica-Bold");
  doc.text("PROFESSIONISTA", 50, y);
  doc.text("CLIENTE", 310, y);
  y += 14;

  doc.fillColor(COLORS.dark).fontSize(11).font("Helvetica-Bold");
  doc.text(quote.professional.name, 50, y);
  doc.text(quote.client.name, 310, y);
  y += 15;

  doc.fillColor(COLORS.mid).fontSize(9).font("Helvetica");
  doc.text(`${quote.professional.category} — ${quote.professional.city}`, 50, y);
  doc.text(quote.client.email, 310, y);
  y += 28;

  // --- Descrizione lavoro ---
  doc.fillColor(COLORS.light).fontSize(8).font("Helvetica-Bold").text("DESCRIZIONE LAVORO", 50, y);
  y += 14;
  doc.fillColor(COLORS.dark).fontSize(10).font("Helvetica").text(quote.job_description, 50, y, { width: 495, lineGap: 3 });
  y = doc.y + 20;

  // --- Tabella voci ---
  const colX = [50, 310, 400, 490];
  const colW = [260, 50, 70, 70];

  // header
  doc.rect(50, y, 495, 20).fill("#f5f5f5");
  doc.fillColor(COLORS.mid).fontSize(8).font("Helvetica-Bold");
  doc.text("Descrizione", colX[0] + 6, y + 5);
  doc.text("Qtà", colX[1] + 6, y + 5, { width: colW[1], align: "center" });
  doc.text("Prezzo", colX[2] + 6, y + 5, { width: colW[2], align: "right" });
  doc.text("Subtot.", colX[3] + 6, y + 5, { width: colW[3], align: "right" });
  y += 22;

  doc.font("Helvetica").fontSize(9).fillColor(COLORS.dark);
  for (const item of quote.line_items) {
    doc.text(item.description, colX[0] + 6, y + 3, { width: colW[0] });
    doc.text(String(item.quantity), colX[1] + 6, y + 3, { width: colW[1], align: "center" });
    doc.text(fmt(item.unit_price), colX[2] + 6, y + 3, { width: colW[2], align: "right" });
    doc.text(fmt(item.subtotal), colX[3] + 6, y + 3, { width: colW[3], align: "right" });

    y += 18;
    doc.moveTo(50, y).lineTo(545, y).strokeColor(COLORS.line).lineWidth(0.5).stroke();
    y += 4;
  }

  y += 10;

  // --- Totali (allineati a destra) ---
  const totX = 380;
  const valX = 490;

  doc.fontSize(9).fillColor(COLORS.mid).font("Helvetica");
  doc.text("Imponibile", totX, y);
  doc.text(fmt(quote.subtotal), valX, y, { width: 70, align: "right" });
  y += 16;

  doc.text("IVA 22%", totX, y);
  doc.text(fmt(quote.taxes), valX, y, { width: 70, align: "right" });
  y += 18;

  doc.moveTo(totX, y).lineTo(560, y).strokeColor(COLORS.dark).lineWidth(1.5).stroke();
  y += 8;

  doc.fontSize(13).fillColor(COLORS.dark).font("Helvetica-Bold");
  doc.text("TOTALE", totX, y);
  doc.text(fmt(quote.total), valX, y, { width: 70, align: "right" });
  y += 30;

  // --- Footer ---
  doc.moveTo(50, y).lineTo(545, y).strokeColor(COLORS.line).lineWidth(0.5).stroke();
  y += 10;

  doc.fontSize(8).fillColor(COLORS.light).font("Helvetica");
  doc.text(`Pagamento: ${quote.payment_terms}`, 50, y);
  doc.text(`Validità: ${quote.validity_days} giorni`, 400, y, { width: 145, align: "right" });

  return doc;
}

module.exports = { buildQuotePDF };
