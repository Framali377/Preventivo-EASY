// src/utils/pdfBuilder.js
const PDFDocument = require("pdfkit");

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const COLORS = {
  dark: "#1a1a2e",
  mid: "#555",
  light: "#888",
  accent: "#0d9488",
  line: "#ddd",
  white: "#ffffff",
  headerBg: "#1a1a2e",
  tableHeaderBg: "#e8e8e8",
  tableRowAlt: "#f7f7f7",
};

const PAGE_WIDTH = 595.28; // A4 width in points
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 495.28

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(n) {
  return (
    Number(n).toLocaleString("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " \u20AC"
  );
}

/**
 * Check whether we are about to run off the page and, if so, add a new page.
 * Returns the (possibly reset) y position.
 */
function ensureSpace(doc, y, needed) {
  if (y + needed > 700) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------
function buildQuotePDF(quote) {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN });

  const createdDate = new Date(quote.created_at).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // -----------------------------------------------------------------------
  // 1. HEADER BAR
  // -----------------------------------------------------------------------
  const headerH = 80;
  doc.rect(0, 0, PAGE_WIDTH, headerH).fill(COLORS.headerBg);

  // Title left
  doc
    .fillColor(COLORS.white)
    .fontSize(24)
    .font("Helvetica-Bold")
    .text("PREVENTIVO", MARGIN, 24);

  // Quote ID + date right
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#cccccc")
    .text(
      `${quote.quote_id}  \u2022  ${createdDate}`,
      MARGIN,
      30,
      { width: CONTENT_WIDTH, align: "right" }
    );

  // Accent underline
  doc
    .moveTo(0, headerH)
    .lineTo(PAGE_WIDTH, headerH)
    .strokeColor(COLORS.accent)
    .lineWidth(3)
    .stroke();

  let y = headerH + 30;

  // -----------------------------------------------------------------------
  // 2. PROFESSIONAL INFO (left) + 3. CLIENT INFO (right)
  // -----------------------------------------------------------------------
  const leftCol = MARGIN;
  const rightCol = 320;

  // Professional
  doc
    .fillColor(COLORS.dark)
    .fontSize(13)
    .font("Helvetica-Bold")
    .text(quote.professional.name, leftCol, y);
  y += 18;
  doc
    .fillColor(COLORS.mid)
    .fontSize(10)
    .font("Helvetica")
    .text(
      `${quote.professional.category} \u2014 ${quote.professional.city}`,
      leftCol,
      y
    );

  // Client (same vertical baseline as professional name)
  const clientY = y - 18;
  doc
    .fillColor(COLORS.light)
    .fontSize(8)
    .font("Helvetica-Bold")
    .text("CLIENTE", rightCol, clientY - 12);
  doc
    .fillColor(COLORS.dark)
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(quote.client.name, rightCol, clientY);
  doc
    .fillColor(COLORS.mid)
    .fontSize(9)
    .font("Helvetica")
    .text(quote.client.email, rightCol, clientY + 17);

  y += 20;

  // Separator
  y += 10;
  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE_WIDTH - MARGIN, y)
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .stroke();
  y += 18;

  // -----------------------------------------------------------------------
  // 4. JOB DESCRIPTION
  // -----------------------------------------------------------------------
  doc
    .fillColor(COLORS.accent)
    .fontSize(9)
    .font("Helvetica-Bold")
    .text("OGGETTO", MARGIN, y);
  y += 16;

  doc
    .fillColor(COLORS.dark)
    .fontSize(10)
    .font("Helvetica")
    .text(quote.job_description, MARGIN, y, {
      width: CONTENT_WIDTH,
      lineGap: 3,
    });
  y = doc.y + 22;

  // -----------------------------------------------------------------------
  // 5. ITEMS TABLE
  // -----------------------------------------------------------------------
  const colDefs = [
    { label: "#", x: MARGIN, w: 28, align: "center" },
    { label: "Descrizione", x: MARGIN + 28, w: 247, align: "left" },
    { label: "Qt\u00E0", x: MARGIN + 275, w: 45, align: "center" },
    { label: "Prezzo unit.", x: MARGIN + 320, w: 85, align: "right" },
    { label: "Subtotale", x: MARGIN + 405, w: 90, align: "right" },
  ];
  const tableW = CONTENT_WIDTH;
  const rowH = 24;
  const headerRowH = 26;

  y = ensureSpace(doc, y, headerRowH + rowH);

  // Table header
  doc
    .rect(MARGIN, y, tableW, headerRowH)
    .fill(COLORS.tableHeaderBg);

  doc.fillColor(COLORS.mid).fontSize(8).font("Helvetica-Bold");
  for (const col of colDefs) {
    doc.text(col.label, col.x + 6, y + 8, {
      width: col.w - 12,
      align: col.align,
    });
  }
  y += headerRowH;

  // Table rows
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.dark);

  for (let i = 0; i < quote.line_items.length; i++) {
    y = ensureSpace(doc, y, rowH + 2);

    const item = quote.line_items[i];
    const isAlt = i % 2 === 1;

    // Row background
    if (isAlt) {
      doc.rect(MARGIN, y, tableW, rowH).fill(COLORS.tableRowAlt);
    }

    const textY = y + 7;

    // Row number
    doc
      .fillColor(COLORS.light)
      .fontSize(8)
      .font("Helvetica")
      .text(String(i + 1), colDefs[0].x + 6, textY, {
        width: colDefs[0].w - 12,
        align: "center",
      });

    // Description
    doc
      .fillColor(COLORS.dark)
      .fontSize(9)
      .font("Helvetica")
      .text(item.description, colDefs[1].x + 6, textY, {
        width: colDefs[1].w - 12,
        align: "left",
      });

    // Quantity
    doc.text(String(item.quantity), colDefs[2].x + 6, textY, {
      width: colDefs[2].w - 12,
      align: "center",
    });

    // Unit price
    doc.text(fmt(item.unit_price), colDefs[3].x + 6, textY, {
      width: colDefs[3].w - 12,
      align: "right",
    });

    // Subtotal
    doc
      .font("Helvetica-Bold")
      .text(fmt(item.subtotal), colDefs[4].x + 6, textY, {
        width: colDefs[4].w - 12,
        align: "right",
      });

    y += rowH;

    // Row separator line
    doc
      .moveTo(MARGIN, y)
      .lineTo(MARGIN + tableW, y)
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .stroke();
  }

  y += 20;

  // -----------------------------------------------------------------------
  // 6. FISCAL SUMMARY (right-aligned block)
  // -----------------------------------------------------------------------
  y = ensureSpace(doc, y, 100);

  const summaryLabelX = 350;
  const summaryValX = 450;
  const summaryValW = PAGE_WIDTH - MARGIN - summaryValX;

  // Imponibile
  doc.fontSize(9).fillColor(COLORS.mid).font("Helvetica");
  doc.text("Imponibile", summaryLabelX, y);
  doc.text(fmt(quote.subtotal), summaryValX, y, {
    width: summaryValW,
    align: "right",
  });
  y += 18;

  // Contributo cassa (if present)
  if (quote.cassa) {
    const prevPercent =
      quote.tax_profile && quote.tax_profile.previdenza_percent != null
        ? quote.tax_profile.previdenza_percent
        : 4;
    doc.text(`Contributo cassa ${prevPercent}%`, summaryLabelX, y);
    doc.text(fmt(quote.cassa), summaryValX, y, {
      width: summaryValW,
      align: "right",
    });
    y += 18;
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
  doc.text(ivaLabel, summaryLabelX, y);
  doc.text(fmt(quote.taxes), summaryValX, y, {
    width: summaryValW,
    align: "right",
  });
  y += 14;

  // Horizontal rule before total
  doc
    .moveTo(summaryLabelX, y)
    .lineTo(PAGE_WIDTH - MARGIN, y)
    .strokeColor(COLORS.dark)
    .lineWidth(1.5)
    .stroke();
  y += 10;

  // TOTALE
  doc
    .fontSize(15)
    .fillColor(COLORS.dark)
    .font("Helvetica-Bold")
    .text("TOTALE", summaryLabelX, y);
  doc.text(fmt(quote.total), summaryValX, y, {
    width: summaryValW,
    align: "right",
  });
  y += 35;

  // -----------------------------------------------------------------------
  // 7. NOTES (optional)
  // -----------------------------------------------------------------------
  if (quote.notes) {
    y = ensureSpace(doc, y, 50);

    doc
      .moveTo(MARGIN, y)
      .lineTo(PAGE_WIDTH - MARGIN, y)
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .stroke();
    y += 14;

    doc
      .fillColor(COLORS.accent)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("NOTE", MARGIN, y);
    y += 16;

    doc
      .fillColor(COLORS.mid)
      .fontSize(9)
      .font("Helvetica")
      .text(quote.notes, MARGIN, y, { width: CONTENT_WIDTH, lineGap: 3 });
    y = doc.y + 20;
  }

  // -----------------------------------------------------------------------
  // 8. FOOTER
  // -----------------------------------------------------------------------
  y = ensureSpace(doc, y, 60);

  // Separator
  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE_WIDTH - MARGIN, y)
    .strokeColor(COLORS.line)
    .lineWidth(0.5)
    .stroke();
  y += 12;

  // Payment terms left
  doc
    .fontSize(8)
    .fillColor(COLORS.mid)
    .font("Helvetica")
    .text(`Pagamento: ${quote.payment_terms}`, MARGIN, y);

  // Validity right
  doc.text(`Validit\u00E0: ${quote.validity_days} giorni`, MARGIN, y, {
    width: CONTENT_WIDTH,
    align: "right",
  });

  // Branding at page bottom
  doc
    .fontSize(7)
    .fillColor(COLORS.light)
    .font("Helvetica")
    .text("Generato con Preventivo EASY", MARGIN, 805, {
      width: CONTENT_WIDTH,
      align: "center",
    });

  return doc;
}

module.exports = { buildQuotePDF };
