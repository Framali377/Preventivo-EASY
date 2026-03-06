// src/utils/pdfBuilder.js
const PDFDocument = require("pdfkit");

const COLORS = {
  dark: "#1c1917",
  mid: "#57534e",
  light: "#a8a29e",
  accent: "#0d9488",
  accentLight: "#f0fdfa",
  line: "#e5e7eb",
  white: "#ffffff",
  headerBg: "#1c1917",
  tableHeaderBg: "#f9fafb",
  tableRowAlt: "#fafaf9",
};

const PAGE_WIDTH = 595.28;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function fmt(n) {
  return (
    Number(n).toLocaleString("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " \u20AC"
  );
}

function ensureSpace(doc, y, needed) {
  if (y + needed > 720) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function buildQuotePDF(quote) {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN });

  const createdDate = new Date(quote.created_at).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // ── 1. HEADER ──
  const headerH = 72;
  doc.rect(0, 0, PAGE_WIDTH, headerH).fill(COLORS.headerBg);

  // Accent bar under header
  doc.rect(0, headerH, PAGE_WIDTH, 3).fill(COLORS.accent);

  // Professional name
  doc
    .fillColor(COLORS.white)
    .fontSize(20)
    .font("Helvetica-Bold")
    .text(quote.professional.name, MARGIN, 20);

  // Category + city
  const catCity = [quote.professional.category, quote.professional.city]
    .filter(Boolean)
    .join(" \u2014 ");
  if (catCity) {
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#a8a29e")
      .text(catCity, MARGIN, 44);
  }

  // Date right-aligned
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#a8a29e")
    .text(createdDate, MARGIN, 20, { width: CONTENT_WIDTH, align: "right" });

  // "PREVENTIVO" label right
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(COLORS.accent)
    .text("PREVENTIVO", MARGIN, 36, { width: CONTENT_WIDTH, align: "right" });

  let y = headerH + 28;

  // ── 2. CLIENT + PROFESSIONAL INFO ──
  const leftCol = MARGIN;
  const rightCol = PAGE_WIDTH / 2 + 20;

  // Left: "Destinatario"
  doc
    .fillColor(COLORS.accent)
    .fontSize(8)
    .font("Helvetica-Bold")
    .text("DESTINATARIO", leftCol, y);
  y += 14;
  doc
    .fillColor(COLORS.dark)
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(quote.client.name, leftCol, y);
  y += 16;
  if (quote.client.email) {
    doc
      .fillColor(COLORS.mid)
      .fontSize(9)
      .font("Helvetica")
      .text(quote.client.email, leftCol, y);
    y += 13;
  }
  if (quote.client.phone) {
    doc
      .fillColor(COLORS.mid)
      .fontSize(9)
      .font("Helvetica")
      .text(quote.client.phone, leftCol, y);
    y += 13;
  }

  y += 8;

  // Separator
  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE_WIDTH - MARGIN, y)
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .stroke();
  y += 16;

  // ── 3. JOB DESCRIPTION ──
  // Accent left border effect
  doc.rect(MARGIN, y - 2, 3, 14).fill(COLORS.accent);
  doc
    .fillColor(COLORS.dark)
    .fontSize(9)
    .font("Helvetica-Bold")
    .text("OGGETTO", MARGIN + 10, y);
  y += 16;

  doc
    .fillColor(COLORS.mid)
    .fontSize(10)
    .font("Helvetica")
    .text(quote.job_description, MARGIN, y, {
      width: CONTENT_WIDTH,
      lineGap: 3,
    });
  y = doc.y + 20;

  // ── 4. ITEMS TABLE ──
  const colDefs = [
    { label: "#", x: MARGIN, w: 25, align: "center" },
    { label: "Descrizione", x: MARGIN + 25, w: 260, align: "left" },
    { label: "Qt\u00E0", x: MARGIN + 285, w: 40, align: "center" },
    { label: "Prezzo unit.", x: MARGIN + 325, w: 85, align: "right" },
    { label: "Importo", x: MARGIN + 410, w: 89, align: "right" },
  ];
  const tableW = CONTENT_WIDTH;
  const rowH = 22;
  const headerRowH = 24;

  y = ensureSpace(doc, y, headerRowH + rowH * 2);

  // Table header
  doc.rect(MARGIN, y, tableW, headerRowH).fill(COLORS.tableHeaderBg);

  doc.fillColor(COLORS.light).fontSize(7).font("Helvetica-Bold");
  for (const col of colDefs) {
    doc.text(col.label.toUpperCase(), col.x + 4, y + 8, {
      width: col.w - 8,
      align: col.align,
    });
  }
  y += headerRowH;

  // Rows
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.dark);

  for (let i = 0; i < quote.line_items.length; i++) {
    y = ensureSpace(doc, y, rowH + 2);

    const item = quote.line_items[i];

    // Alternating row bg
    if (i % 2 === 1) {
      doc.rect(MARGIN, y, tableW, rowH).fill(COLORS.tableRowAlt);
    }

    const textY = y + 6;

    // Row number
    doc
      .fillColor(COLORS.light)
      .fontSize(8)
      .font("Helvetica")
      .text(String(i + 1), colDefs[0].x + 4, textY, {
        width: colDefs[0].w - 8,
        align: "center",
      });

    // Description
    doc
      .fillColor(COLORS.dark)
      .fontSize(9)
      .font("Helvetica")
      .text(item.description, colDefs[1].x + 4, textY, {
        width: colDefs[1].w - 8,
        align: "left",
      });

    // Quantity
    doc
      .fillColor(COLORS.mid)
      .text(String(item.quantity), colDefs[2].x + 4, textY, {
        width: colDefs[2].w - 8,
        align: "center",
      });

    // Unit price
    doc
      .fillColor(COLORS.mid)
      .text(fmt(item.unit_price), colDefs[3].x + 4, textY, {
        width: colDefs[3].w - 8,
        align: "right",
      });

    // Subtotal
    doc
      .fillColor(COLORS.dark)
      .font("Helvetica-Bold")
      .text(fmt(item.subtotal), colDefs[4].x + 4, textY, {
        width: colDefs[4].w - 8,
        align: "right",
      });

    y += rowH;

    // Row line
    doc
      .moveTo(MARGIN, y)
      .lineTo(MARGIN + tableW, y)
      .strokeColor(COLORS.line)
      .lineWidth(0.3)
      .stroke();
  }

  y += 24;

  // ── 5. FISCAL SUMMARY ──
  y = ensureSpace(doc, y, 100);

  const summaryX = 340;
  const summaryValX = 440;
  const summaryValW = PAGE_WIDTH - MARGIN - summaryValX;

  // Background box for totals
  doc
    .rect(summaryX - 10, y - 6, PAGE_WIDTH - MARGIN - summaryX + 10, 0)
    .fill("transparent");

  // Imponibile
  doc.fontSize(9).fillColor(COLORS.mid).font("Helvetica");
  doc.text("Imponibile", summaryX, y);
  doc.text(fmt(quote.subtotal), summaryValX, y, {
    width: summaryValW,
    align: "right",
  });
  y += 16;

  // Cassa
  if (quote.cassa) {
    const prevPercent =
      quote.tax_profile && quote.tax_profile.previdenza_percent != null
        ? quote.tax_profile.previdenza_percent
        : 4;
    doc.text(`Contributo cassa ${prevPercent}%`, summaryX, y);
    doc.text(fmt(quote.cassa), summaryValX, y, {
      width: summaryValW,
      align: "right",
    });
    y += 16;
  }

  // IVA
  let ivaLabel;
  if (quote.tax_profile && quote.tax_profile.iva_percent === 0) {
    ivaLabel = "IVA (esente)";
  } else if (quote.tax_profile && quote.tax_profile.iva_percent != null) {
    ivaLabel = `IVA ${quote.tax_profile.iva_percent}%`;
  } else {
    ivaLabel = "IVA 22%";
  }
  doc.text(ivaLabel, summaryX, y);
  doc.text(fmt(quote.taxes), summaryValX, y, {
    width: summaryValW,
    align: "right",
  });
  y += 12;

  // Rule before total
  doc
    .moveTo(summaryX, y)
    .lineTo(PAGE_WIDTH - MARGIN, y)
    .strokeColor(COLORS.dark)
    .lineWidth(1.5)
    .stroke();
  y += 10;

  // TOTALE
  doc
    .fontSize(14)
    .fillColor(COLORS.dark)
    .font("Helvetica-Bold")
    .text("TOTALE", summaryX, y);
  doc.text(fmt(quote.total), summaryValX, y, {
    width: summaryValW,
    align: "right",
  });
  y += 32;

  // ── 6. NOTES ──
  if (quote.notes) {
    y = ensureSpace(doc, y, 50);

    doc
      .moveTo(MARGIN, y)
      .lineTo(PAGE_WIDTH - MARGIN, y)
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .stroke();
    y += 14;

    doc.rect(MARGIN, y - 2, 3, 14).fill(COLORS.accent);
    doc
      .fillColor(COLORS.dark)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("NOTE E CONDIZIONI", MARGIN + 10, y);
    y += 16;

    doc
      .fillColor(COLORS.mid)
      .fontSize(9)
      .font("Helvetica")
      .text(quote.notes, MARGIN, y, { width: CONTENT_WIDTH, lineGap: 3 });
    y = doc.y + 20;
  }

  // ── 7. FOOTER ──
  y = ensureSpace(doc, y, 50);

  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE_WIDTH - MARGIN, y)
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .stroke();
  y += 10;

  doc
    .fontSize(8)
    .fillColor(COLORS.mid)
    .font("Helvetica")
    .text(`Pagamento: ${quote.payment_terms}`, MARGIN, y);

  doc.text(`Validit\u00E0: ${quote.validity_days} giorni`, MARGIN, y, {
    width: CONTENT_WIDTH,
    align: "right",
  });

  // Branding
  doc
    .fontSize(7)
    .fillColor(COLORS.light)
    .font("Helvetica")
    .text("Generato con Preventivo EASY \u2014 preventivoeasy.it", MARGIN, 805, {
      width: CONTENT_WIDTH,
      align: "center",
    });

  return doc;
}

module.exports = { buildQuotePDF };
