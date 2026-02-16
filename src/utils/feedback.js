// src/utils/feedback.js
// Salvataggio feedback supervisionato per miglioramento suggerimenti AI.

const fs = require("fs");
const path = require("path");

const FEEDBACK_DIR = path.join(__dirname, "..", "data", "feedback");

function ensureDir() {
  if (!fs.existsSync(FEEDBACK_DIR)) {
    fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
  }
}

function getFeedbackPath(user_id) {
  return path.join(FEEDBACK_DIR, `${user_id}.json`);
}

function loadFeedback(user_id) {
  const filePath = getFeedbackPath(user_id);
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

function saveFeedback(user_id, entries) {
  ensureDir();
  fs.writeFileSync(getFeedbackPath(user_id), JSON.stringify(entries, null, 2), "utf-8");
}

/**
 * Registra feedback per una singola voce di preventivo.
 * @param {Object} params
 * @param {string} params.user_id
 * @param {string} params.quote_id
 * @param {string} params.item_description
 * @param {Object} params.ai_suggested - { unit_cost, margin_percent, confidence }
 * @param {Object} params.user_final - { unit_cost, margin_percent, unit_price }
 */
function recordFeedback({ user_id, quote_id, item_description, ai_suggested, user_final }) {
  const entries = loadFeedback(user_id);

  entries.push({
    quote_id,
    item_description,
    ai_suggested,
    user_final,
    outcome: null,
    recorded_at: new Date().toISOString()
  });

  saveFeedback(user_id, entries);
}

/**
 * Aggiorna l'outcome per tutte le entry di un quote_id.
 * @param {string} user_id
 * @param {string} quote_id
 * @param {string} outcome - "accepted" | "rejected"
 */
function updateOutcome(user_id, quote_id, outcome) {
  const entries = loadFeedback(user_id);
  let changed = false;

  for (const entry of entries) {
    if (entry.quote_id === quote_id && entry.outcome === null) {
      entry.outcome = outcome;
      entry.outcome_at = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) {
    saveFeedback(user_id, entries);
  }
}

/**
 * Calcola KPI dall'utente basati sul feedback registrato.
 * @param {string} userId
 * @returns {{ total_feedback, acceptance_rate, avg_margin, ai_accuracy, total_accepted, total_rejected }}
 */
function getKpi(userId) {
  const entries = loadFeedback(userId);

  const total_feedback = entries.length;
  const withOutcome = entries.filter(e => e.outcome);
  const total_accepted = withOutcome.filter(e => e.outcome === "accepted").length;
  const total_rejected = withOutcome.filter(e => e.outcome === "rejected").length;

  const acceptance_rate = withOutcome.length > 0
    ? Math.round((total_accepted / withOutcome.length) * 100)
    : 0;

  // Media margine dalle scelte finali dell'utente
  const margins = entries
    .filter(e => e.user_final && e.user_final.margin_percent != null)
    .map(e => e.user_final.margin_percent);
  const avg_margin = margins.length > 0
    ? Math.round((margins.reduce((s, m) => s + m, 0) / margins.length) * 10) / 10
    : 0;

  // Precisione AI: % entry dove user_final === ai_suggested (costo e margine invariati)
  const withAi = entries.filter(e => e.ai_suggested && e.user_final);
  const accurate = withAi.filter(e =>
    e.user_final.unit_cost === e.ai_suggested.unit_cost &&
    e.user_final.margin_percent === e.ai_suggested.margin_percent
  ).length;
  const ai_accuracy = withAi.length > 0
    ? Math.round((accurate / withAi.length) * 100)
    : 0;

  return { total_feedback, acceptance_rate, avg_margin, ai_accuracy, total_accepted, total_rejected };
}

module.exports = { recordFeedback, updateOutcome, getKpi };
