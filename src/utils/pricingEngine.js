// src/utils/pricingEngine.js
// Motore di pricing deterministico — tutta la matematica prezzi passa da qui.

const TAX_RATE = 0.22;
const DEFAULT_MARGIN = 30;
const MIN_MARGIN = 0;
const MAX_MARGIN = 90;

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Dato costo unitario e margine %, calcola il prezzo unitario (markup).
 * price = cost × (1 + margin/100)
 */
function computePrice(unit_cost, margin_percent) {
  const cost = round2(Math.max(0, Number(unit_cost) || 0));
  const margin = Math.min(MAX_MARGIN, Math.max(MIN_MARGIN, Number(margin_percent) || 0));
  const unit_price = round2(cost * (1 + margin / 100));
  return { unit_cost: cost, margin_percent: round2(margin), unit_price };
}

/**
 * Dato costo unitario e prezzo unitario, calcola il margine %.
 * margin = ((price - cost) / cost) × 100, clamp a min/max
 */
function computeMargin(unit_cost, unit_price) {
  const cost = round2(Math.max(0, Number(unit_cost) || 0));
  const price = round2(Math.max(0, Number(unit_price) || 0));

  if (cost <= 0) {
    return { unit_cost: cost, margin_percent: 0, unit_price: price };
  }

  let margin = ((price - cost) / cost) * 100;
  margin = Math.min(MAX_MARGIN, Math.max(MIN_MARGIN, margin));
  margin = round2(margin);

  return { unit_cost: cost, margin_percent: margin, unit_price: price };
}

/**
 * Processa un singolo line item:
 * - Se ha cost + margin → calcola price
 * - Se ha cost + price → calcola margin
 * - Se ha solo price (legacy) → cost=0, margin=0
 */
function processLineItem(item) {
  const quantity = Math.max(1, parseInt(item.quantity) || 1);
  let unit_cost, margin_percent, unit_price;

  if (item.unit_cost != null && item.unit_cost !== "" && item.margin_percent != null && item.margin_percent !== "") {
    // cost + margin → calcola price
    const result = computePrice(item.unit_cost, item.margin_percent);
    unit_cost = result.unit_cost;
    margin_percent = result.margin_percent;
    unit_price = result.unit_price;
  } else if (item.unit_cost != null && item.unit_cost !== "" && item.unit_price != null && item.unit_price !== "") {
    // cost + price → calcola margin
    const result = computeMargin(item.unit_cost, item.unit_price);
    unit_cost = result.unit_cost;
    margin_percent = result.margin_percent;
    unit_price = result.unit_price;
  } else {
    // Solo price (legacy) o dati mancanti
    unit_price = round2(Math.max(0, Number(item.unit_price) || 0));
    unit_cost = round2(Math.max(0, Number(item.unit_cost) || 0));
    margin_percent = 0;
  }

  const subtotal = round2(quantity * unit_price);

  return {
    description: item.description || "",
    quantity,
    unit_cost,
    margin_percent,
    unit_price,
    subtotal
  };
}

/**
 * Processa l'intero preventivo: ricalcola tutti i line items e i totali.
 */
function processQuote(line_items) {
  const processed = (line_items || []).map(processLineItem);
  const subtotal = round2(processed.reduce((s, i) => s + i.subtotal, 0));
  const taxes = round2(subtotal * TAX_RATE);
  const total = round2(subtotal + taxes);

  return { line_items: processed, subtotal, taxes, total };
}

/**
 * Processa suggerimenti AI: applica computePrice ai suggerimenti e preserva metadata AI.
 */
function processAiSuggestions(suggestions) {
  return (suggestions || []).map(s => {
    const cost = Number(s.suggested_unit_cost) || 0;
    const margin = Number(s.suggested_margin_percent) || DEFAULT_MARGIN;
    const { unit_cost, margin_percent, unit_price } = computePrice(cost, margin);

    return {
      description: s.description || "",
      quantity: Math.max(1, parseInt(s.quantity) || 1),
      unit_cost,
      margin_percent,
      unit_price,
      subtotal: round2((Math.max(1, parseInt(s.quantity) || 1)) * unit_price),
      confidence: s.confidence || "low",
      explanation: s.explanation || "",
      needs_input: !!s.needs_input,
      ai_suggested: { unit_cost, margin_percent, confidence: s.confidence || "low" }
    };
  });
}

/**
 * Calcolo fiscale completo dato subtotale e profilo fiscale.
 * Sostituisce il calcolo fisso TAX_RATE = 0.22 per lo Step 4 del wizard.
 *
 * @param {number} subtotal - Somma dei subtotali delle voci (imponibile)
 * @param {object} taxProfile - Oggetto dal tax_profiles.json (iva_percent, previdenza_percent)
 * @returns {{ imponibile, cassa, imponibile_con_cassa, iva, totale }}
 */
function computeFiscalTotals(subtotal, taxProfile) {
  const imponibile = round2(Math.max(0, Number(subtotal) || 0));
  const prevPercent = Number(taxProfile && taxProfile.previdenza_percent) || 0;
  const ivaPercent = Number(taxProfile && taxProfile.iva_percent) || 0;

  const cassa = round2(imponibile * prevPercent / 100);
  const imponibile_con_cassa = round2(imponibile + cassa);
  const iva = round2(imponibile_con_cassa * ivaPercent / 100);
  const totale = round2(imponibile_con_cassa + iva);

  return { imponibile, cassa, imponibile_con_cassa, iva, totale };
}

module.exports = {
  TAX_RATE,
  DEFAULT_MARGIN,
  MIN_MARGIN,
  MAX_MARGIN,
  round2,
  computePrice,
  computeMargin,
  processLineItem,
  processQuote,
  processAiSuggestions,
  computeFiscalTotals
};
