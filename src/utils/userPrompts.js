// src/utils/userPrompts.js
const fs = require("fs");
const path = require("path");

const PROMPTS_DIR = path.join(__dirname, "..", "data", "user_prompts");
const TRAINING_THRESHOLD = Number(process.env.TRAINING_THRESHOLD) || 5;

function promptPath(userId) {
  return path.join(PROMPTS_DIR, `${userId}.json`);
}

function getUserPrompt(userId) {
  const p = promptPath(userId);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); }
  catch { return null; }
}

function saveUserPrompt(userId, promptData) {
  if (!fs.existsSync(PROMPTS_DIR)) fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  fs.writeFileSync(promptPath(userId), JSON.stringify(promptData, null, 2));
}

/**
 * Analizza i preventivi di un utente e genera un profilo completo.
 * Chiamata dopo ogni saveQuote. Richiede almeno TRAINING_THRESHOLD preventivi.
 *
 * Il profilo include:
 * - margine_medio: margine % medio applicato dall'utente
 * - voci_ricorrenti: top 10 voci con frequenza, prezzo medio, margine medio
 * - prezzi_medi: media totale per fascia di prezzo
 * - context_prompt: testo iniettato nel system prompt di Claude
 */
function analyzeAndGenerate(userId, quotes) {
  const userQuotes = quotes.filter(q => q.user_id === userId || q.owner_user_id === userId);

  if (userQuotes.length < TRAINING_THRESHOLD) return null;

  // Già aggiornato per questo conteggio?
  const existing = getUserPrompt(userId);
  if (existing && existing.based_on_count === userQuotes.length) return existing;

  // ── Raccolta dati ──
  const presets = {};
  const categories = {};
  const avgByPreset = {};
  let totalSum = 0;
  let marginSum = 0;
  let marginCount = 0;

  // Per ogni voce: prezzo medio, margine medio, frequenza
  const itemStats = {};

  for (const q of userQuotes) {
    const preset = q.pricing_preset || "standard";
    presets[preset] = (presets[preset] || 0) + 1;

    const cat = q.professional?.category || q.profession;
    if (cat) categories[cat] = (categories[cat] || 0) + 1;

    if (!avgByPreset[preset]) avgByPreset[preset] = { sum: 0, count: 0 };
    avgByPreset[preset].sum += q.total || 0;
    avgByPreset[preset].count += 1;

    totalSum += q.total || 0;

    if (q.line_items) {
      for (const item of q.line_items) {
        const key = (item.description || "").toLowerCase().trim();
        if (!key) continue;

        if (!itemStats[key]) {
          itemStats[key] = { priceSum: 0, costSum: 0, marginSum: 0, count: 0 };
        }
        itemStats[key].priceSum += item.unit_price || item.subtotal || 0;
        itemStats[key].costSum += item.unit_cost || 0;
        itemStats[key].count += 1;

        const m = item.margin_percent;
        if (typeof m === "number" && m > 0) {
          itemStats[key].marginSum += m;
          marginSum += m;
          marginCount += 1;
        }
      }
    }
  }

  // Margine medio globale
  const margine_medio = marginCount > 0 ? Math.round(marginSum / marginCount * 10) / 10 : 30;

  // Medie per fascia
  const prezzi_medi = {};
  for (const [preset, data] of Object.entries(avgByPreset)) {
    prezzi_medi[preset] = Math.round(data.sum / data.count);
  }

  // Voci ricorrenti: top 10 per frequenza, con prezzo e margine medi
  const voci_ricorrenti = Object.entries(itemStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([desc, s]) => ({
      description: desc,
      frequenza: s.count,
      prezzo_medio: Math.round(s.priceSum / s.count * 100) / 100,
      costo_medio: s.costSum > 0 ? Math.round(s.costSum / s.count * 100) / 100 : null,
      margine_medio: s.marginSum > 0 ? Math.round(s.marginSum / s.count * 10) / 10 : null
    }));

  // Categoria principale
  const mainCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // ── Context prompt per Claude ──
  const contextParts = [];
  contextParts.push(`Professionista: ${mainCategory || "professionista"}, ${userQuotes.length} preventivi completati.`);
  contextParts.push(`Margine medio applicato: ${margine_medio}%.`);

  if (Object.keys(prezzi_medi).length) {
    const lines = Object.entries(prezzi_medi).map(([p, avg]) => `${p}: ${avg}€`).join(", ");
    contextParts.push(`Totale medio per fascia: ${lines}.`);
  }

  if (voci_ricorrenti.length) {
    const itemList = voci_ricorrenti
      .filter(v => v.frequenza >= 2 || voci_ricorrenti.length <= 5)
      .slice(0, 8)
      .map(v => {
        let s = `"${v.description}" (${v.prezzo_medio}€`;
        if (v.margine_medio) s += `, margine ${v.margine_medio}%`;
        s += `, ${v.frequenza}x)`;
        return s;
      })
      .join(", ");
    if (itemList) {
      contextParts.push(`Voci ricorrenti con prezzi medi: ${itemList}.`);
    }
  }

  contextParts.push("USA questi dati per allineare prezzi, margini e stile delle voci a quelli abituali di questo professionista.");

  const promptData = {
    user_id: userId,
    generated_at: new Date().toISOString(),
    based_on_count: userQuotes.length,
    threshold: TRAINING_THRESHOLD,
    profile: {
      main_category: mainCategory,
      total_quotes: userQuotes.length,
      margine_medio,
      prezzi_medi,
      voci_ricorrenti,
      preferred_preset: Object.entries(presets).sort((a, b) => b[1] - a[1])[0]?.[0] || "standard"
    },
    context_prompt: contextParts.join(" ")
  };

  saveUserPrompt(userId, promptData);
  console.log(`[Learning] Profilo aggiornato: ${userId} (${userQuotes.length} preventivi)`);
  return promptData;
}

module.exports = { getUserPrompt, saveUserPrompt, analyzeAndGenerate, TRAINING_THRESHOLD };
