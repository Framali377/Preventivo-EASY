// src/utils/claude.js
const axios = require("axios");
const { getUserPrompt } = require("./userPrompts");

// ── System prompt originale (backward-compat per generate.js) ──

function buildSystemPrompt(language, userContext) {
  const lang = language === "it" ? "italiano" : "English";

  let base = `Sei un assistente esperto nella generazione di preventivi professionali per il mercato italiano.
Dato l'input con professionista, descrizione lavoro e livello di prezzo, genera un preventivo dettagliato.
Rispondi in ${lang}.

REGOLE:
- Scomponi il lavoro in voci realistiche (materiali, manodopera, eventuali costi accessori)
- I prezzi devono essere realistici per il mercato italiano
- pricing_preset: "economy" = fascia bassa, "standard" = fascia media, "premium" = fascia alta
- Calcola subtotal come somma dei subtotali delle voci
- taxes = subtotal * 0.22 (IVA 22%)
- total = subtotal + taxes
- Aggiungi un campo "notes" con 1-2 frasi che spiegano la logica dei prezzi
- Rispondi SOLO con JSON valido, nessun testo aggiuntivo`;

  if (userContext) {
    base += `\n\nCONTESTO PROFESSIONISTA (appreso dai preventivi precedenti):\n${userContext}`;
  }

  return base;
}

// ── Nuovo system prompt: suggerimenti costo/margine, NON prezzi finali ──

function buildCostSuggestionsPrompt(language, userContext) {
  const lang = language === "it" ? "italiano" : "English";

  let base = `Sei un assistente esperto nella stima dei costi per il mercato italiano.
Il tuo compito è suggerire COSTI UNITARI e MARGINI per ogni voce di un preventivo.
NON calcolare mai il prezzo finale — lo farà il motore di pricing del sistema.
Rispondi in ${lang}.

REGOLE:
- Scomponi il lavoro in voci realistiche (materiali, manodopera, costi accessori)
- Per ogni voce suggerisci:
  - suggested_unit_cost: il costo reale stimato (quanto costa al professionista)
  - suggested_margin_percent: il margine suggerito (tipicamente 20-40%)
- pricing_preset: "economy" = margini bassi (15-25%), "standard" = margini medi (25-35%), "premium" = margini alti (35-50%)
- confidence: "high" se sei sicuro della stima, "medium" se ragionevole, "low" se incerto
- explanation: spiega SEMPRE brevemente come hai stimato il costo (fonte, logica, riferimento mercato)
- needs_input: true se servono più dettagli dall'utente per una stima accurata
- NON inventare voci generiche senza spiegazione
- Rispondi SOLO con JSON valido, nessun testo aggiuntivo`;

  if (userContext) {
    base += `\n\nCONTESTO PROFESSIONISTA (appreso dai preventivi precedenti):\n${userContext}`;
  }

  return base;
}

// ── Funzione originale (backward-compat) ──

async function generateQuoteWithClaude(input) {
  const language = input.language || "it";

  let userContext = null;
  if (input.user_id) {
    const prompt = getUserPrompt(input.user_id);
    if (prompt && prompt.context_prompt) {
      userContext = prompt.context_prompt;
    }
  }

  const userPrompt = `Genera il preventivo per questo lavoro:

${JSON.stringify(input, null, 2)}

Rispondi SOLO con questo formato JSON:
{
  "line_items": [
    { "description": "...", "quantity": 1, "unit_price": 0, "subtotal": 0 }
  ],
  "subtotal": 0,
  "taxes": 0,
  "total": 0,
  "currency": "EUR",
  "payment_terms": "...",
  "validity_days": 14,
  "notes": "..."
}`;

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      temperature: 0.3,
      system: buildSystemPrompt(language, userContext),
      messages: [{ role: "user", content: userPrompt }]
    },
    {
      headers: {
        "x-api-key": process.env.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      timeout: 30000
    }
  );

  const text = response.data.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude non ha restituito JSON valido");
  return JSON.parse(jsonMatch[0]);
}

// ── Nuova funzione: suggerimenti costo/margine per voce ──

async function generateCostSuggestions(input) {
  const language = input.language || "it";

  let userContext = null;
  if (input.user_id) {
    const prompt = getUserPrompt(input.user_id);
    if (prompt && prompt.context_prompt) {
      userContext = prompt.context_prompt;
    }
  }

  const userPrompt = `Analizza questo lavoro e suggerisci costi e margini per ogni voce:

${JSON.stringify(input, null, 2)}

Rispondi SOLO con questo formato JSON:
{
  "suggestions": [
    {
      "description": "Descrizione voce",
      "quantity": 1,
      "suggested_unit_cost": 0,
      "suggested_margin_percent": 30,
      "confidence": "high",
      "explanation": "Stima basata su...",
      "needs_input": false
    }
  ],
  "payment_terms": "50% acconto, saldo a fine lavori",
  "validity_days": 14,
  "notes": "..."
}`;

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      temperature: 0.3,
      system: buildCostSuggestionsPrompt(language, userContext),
      messages: [{ role: "user", content: userPrompt }]
    },
    {
      headers: {
        "x-api-key": process.env.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      timeout: 30000
    }
  );

  const text = response.data.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude non ha restituito JSON valido");

  const parsed = JSON.parse(jsonMatch[0]);

  // Regola trasparenza: filtra suggerimenti senza explanation
  if (Array.isArray(parsed.suggestions)) {
    parsed.suggestions = parsed.suggestions.filter(s => s.explanation && s.explanation.trim());
  }

  return parsed;
}

// ── Ri-stima singola voce con input aggiuntivo dall'utente ──

async function reEstimateSingleItem({ user_id, professional, description, user_input, pricing_preset }) {
  const language = "it";

  let userContext = null;
  if (user_id) {
    const prompt = getUserPrompt(user_id);
    if (prompt && prompt.context_prompt) {
      userContext = prompt.context_prompt;
    }
  }

  const userPrompt = `Ri-stima questa singola voce di preventivo con le informazioni aggiuntive fornite dall'utente.

Voce: ${description}
Informazioni aggiuntive dall'utente: ${user_input}
Fascia di prezzo: ${pricing_preset || "standard"}
${professional ? `Professionista: ${professional.name || ""}, ${professional.category || ""}, ${professional.city || ""}` : ""}

Rispondi SOLO con questo formato JSON:
{
  "description": "${description}",
  "quantity": 1,
  "suggested_unit_cost": 0,
  "suggested_margin_percent": 30,
  "confidence": "high",
  "explanation": "Stima basata su...",
  "needs_input": false
}`;

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 512,
      temperature: 0.3,
      system: buildCostSuggestionsPrompt(language, userContext),
      messages: [{ role: "user", content: userPrompt }]
    },
    {
      headers: {
        "x-api-key": process.env.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      timeout: 15000
    }
  );

  const text = response.data.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude non ha restituito JSON valido");
  return JSON.parse(jsonMatch[0]);
}

function isAvailable() {
  return !!process.env.CLAUDE_API_KEY;
}

module.exports = { generateQuoteWithClaude, generateCostSuggestions, reEstimateSingleItem, isAvailable };
