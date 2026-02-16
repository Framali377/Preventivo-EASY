// src/utils/itemLibrary.js
// Libreria voci cercabile: aggrega listino utente + voci da preventivi passati.

const { loadQuotes, getUserById } = require("./storage");

/**
 * Cerca voci nella libreria dell'utente (listino + storia preventivi).
 * @param {string} userId
 * @param {Array} priceList - Il listino prezzi dell'utente (user.priceList || [])
 * @param {string} query - Testo di ricerca (min 2 char)
 * @param {number} limit - Max risultati (default 8)
 * @returns {Array<{description, last_unit_cost, last_margin_percent, last_unit_price, avg_unit_price, occurrences, source}>}
 */
function searchItems(userId, priceList, query, limit = 8) {
  const q = (query || "").toLowerCase().trim();
  if (q.length < 2) return [];

  // ── 1. Voci dal listino prezzi ──
  const listMap = new Map();
  if (Array.isArray(priceList)) {
    for (const p of priceList) {
      const desc = (p.description || "").trim();
      if (!desc) continue;
      if (!desc.toLowerCase().includes(q)) continue;
      listMap.set(desc.toLowerCase(), {
        description: desc,
        last_unit_cost: p.unit_cost || p.unit_price || 0,
        last_margin_percent: p.margin_percent || 0,
        last_unit_price: p.unit_price || 0,
        avg_unit_price: p.unit_price || 0,
        occurrences: 0,
        source: "priceList"
      });
    }
  }

  // ── 2. Voci dalla storia preventivi ──
  const histMap = new Map();
  const allQuotes = loadQuotes()
    .filter(qo => qo.user_id === userId || qo.owner_user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  for (const quote of allQuotes) {
    if (!Array.isArray(quote.line_items)) continue;
    for (const item of quote.line_items) {
      const desc = (item.description || "").trim();
      if (!desc) continue;
      if (!desc.toLowerCase().includes(q)) continue;

      const key = desc.toLowerCase();
      if (histMap.has(key)) {
        const h = histMap.get(key);
        h.occurrences++;
        h._totalPrice += (item.unit_price || 0);
      } else {
        histMap.set(key, {
          description: desc,
          last_unit_cost: item.unit_cost || 0,
          last_margin_percent: item.margin_percent || 0,
          last_unit_price: item.unit_price || 0,
          _totalPrice: item.unit_price || 0,
          occurrences: 1,
          source: "history"
        });
      }
    }
  }

  // ── 3. Merge: listino ha priorità, arricchisci con stats storia ──
  const merged = new Map();

  for (const [key, val] of listMap) {
    const hist = histMap.get(key);
    if (hist) {
      val.occurrences = hist.occurrences;
      val.avg_unit_price = Math.round((hist._totalPrice / hist.occurrences) * 100) / 100;
    }
    merged.set(key, val);
  }

  for (const [key, val] of histMap) {
    if (merged.has(key)) continue;
    val.avg_unit_price = Math.round((val._totalPrice / val.occurrences) * 100) / 100;
    delete val._totalPrice;
    merged.set(key, val);
  }

  // ── 4. Ordina: prefisso esatto prima, poi per occurrences desc ──
  const results = Array.from(merged.values());

  results.sort((a, b) => {
    const aPrefix = a.description.toLowerCase().startsWith(q) ? 0 : 1;
    const bPrefix = b.description.toLowerCase().startsWith(q) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return b.occurrences - a.occurrences;
  });

  return results.slice(0, limit);
}

module.exports = { searchItems };
