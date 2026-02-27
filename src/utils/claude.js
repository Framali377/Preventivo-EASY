// src/utils/claude.js
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { getUserPrompt, getUserBehaviorProfile } = require("./userPrompts");
const { loadQuotes } = require("./storage");

// ── Load profession templates ──
const professionTemplates = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/professionTemplates.json"), "utf-8")
);

// ── Categorie professionali non artigiane ──
const NON_ARTIGIANO_PROFESSIONS = [
  "avvocato", "commercialista", "consulente aziendale", "consulente IT",
  "consulente del lavoro", "notaio", "geometra", "ingegnere", "architetto",
  "perito industriale", "tecnico informatico", "medico", "odontoiatra",
  "psicologo", "fisioterapista", "veterinario", "grafico", "fotografo",
  "web designer", "videomaker", "traduttore", "copywriter"
];

function isNonArtigiano(category) {
  if (!category) return false;
  const cat = category.toLowerCase().trim();
  if (NON_ARTIGIANO_PROFESSIONS.includes(cat)) return true;
  // Check by group
  for (const [groupName, group] of Object.entries(professionTemplates.groups)) {
    if (groupName !== "Artigiani" && group.professions.includes(cat)) return true;
  }
  return false;
}

function getPromptHintForProfession(category) {
  if (!category) return "Scomponi il lavoro in voci realistiche (materiali, manodopera, eventuali costi accessori)";
  const cat = category.toLowerCase().trim();
  for (const group of Object.values(professionTemplates.groups)) {
    if (group.professions.includes(cat)) {
      return group.prompt_hint;
    }
  }
  // Fallback: se non artigiano, NON suggerire manodopera/materiali
  if (isNonArtigiano(cat)) {
    return "Scomponi il lavoro in voci professionali realistiche: onorario/parcella, analisi e studio, redazione documenti, assistenza, spese vive. NON usare MAI voci come 'manodopera', 'materiali', 'trasporto', 'smaltimento'";
  }
  return "Scomponi il lavoro in voci realistiche (materiali, manodopera, eventuali costi accessori)";
}

// ── System prompt originale (backward-compat per generate.js) ──

function buildSystemPrompt(language, userContext, professionCategory) {
  const lang = language === "it" ? "italiano" : "English";
  const hint = getPromptHintForProfession(professionCategory);

  let base = `Sei un assistente esperto nella generazione di preventivi professionali per il mercato italiano.
Dato l'input con professionista, descrizione lavoro e livello di prezzo, genera un preventivo dettagliato.
Rispondi in ${lang}.

REGOLE:
- ${hint}
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

function buildCostSuggestionsPrompt(language, userContext, professionCategory, options) {
  const lang = language === "it" ? "italiano" : "English";
  const hint = getPromptHintForProfession(professionCategory);
  const { jobType, priceLevel, urgency, notes, behaviorProfile } = options || {};

  let base = `Sei un assistente esperto nella stima dei costi per il mercato italiano.
Il tuo compito è analizzare una DESCRIZIONE LIBERA di un lavoro/incarico e generare le voci del preventivo con COSTI UNITARI e MARGINI.
NON calcolare mai il prezzo finale — lo farà il motore di pricing del sistema.
Rispondi in ${lang}.

REGOLE:
- Analizza la descrizione libera dell'utente ed estrai le singole voci di preventivo
- ${hint}
- Genera voci DETTAGLIATE e SPECIFICHE basate sulla descrizione fornita, non generiche
- Per ogni voce suggerisci:
  - suggested_unit_cost: il costo reale stimato (quanto costa al professionista)
  - suggested_margin_percent: il margine suggerito (tipicamente 20-40%)
- pricing_preset: "economy" = margini bassi (15-25%), "standard" = margini medi (25-35%), "premium" = margini alti (35-50%)
- confidence: "high" se sei sicuro della stima, "medium" se ragionevole, "low" se incerto
- explanation: spiega SEMPRE brevemente come hai stimato il costo (fonte, logica, riferimento mercato)
- needs_input: true se servono più dettagli dall'utente per una stima accurata
- Se la descrizione menziona metrature, quantita o materiali specifici, usali per calcoli precisi
- Genera tra 3 e 8 voci, non di piu a meno che il lavoro non sia molto complesso
- NON inventare voci generiche senza spiegazione
- Rispondi SOLO con JSON valido, nessun testo aggiuntivo`;

  // ── Guardrail per professioni non artigiane ──
  if (isNonArtigiano(professionCategory)) {
    base += `\n
REGOLE TASSATIVE PER PROFESSIONI INTELLETTUALI/NON ARTIGIANE:
- VIETATO usare le voci: "manodopera", "materiali", "trasporto", "smaltimento", "movimentazione", "posa in opera", "fornitura e posa", "calcinacci", "massetto"
- La struttura DEVE seguire questo schema:
  1. Onorario professionale (voce principale)
  2. Studio e analisi preliminare
  3. Redazione atti/pareri/documenti/relazioni (specifica per il tipo di incarico)
  4. Attivita continuativa / assistenza (se applicabile)
  5. Spese vive documentate (bolli, diritti, cancelleria — sempre separata e opzionale)
- Usa terminologia professionale reale, NON generica
- Ogni voce deve essere credibile per un professionista che emette parcella
- Se non conosci il tipo di incarico specifico, usa la struttura standard sopra`;
  }

  if (jobType) {
    base += `\n\nTipo di incarico selezionato: "${jobType}". Genera voci SPECIFICHE e credibili per questo tipo di incarico professionale. Non generare voci generiche.`;
  }

  if (priceLevel) {
    const marginGuide = {
      economico: "margini contenuti 15-25%",
      standard: "margini medi 25-35%",
      premium: "margini alti 35-50%, qualità e servizio superiori"
    };
    base += `\nLivello prezzo: ${priceLevel} — ${marginGuide[priceLevel] || marginGuide.standard}.`;
  }

  if (urgency && urgency !== "normale") {
    const surcharge = { urgente: 15, emergenza: 30 };
    base += `\nUrgenza: ${urgency} — applica maggiorazione di circa ${surcharge[urgency] || 0}% sui costi.`;
  }

  if (notes) {
    base += `\nNote aggiuntive dal professionista: ${notes}`;
  }

  if (userContext) {
    base += `\n\nCONTESTO PROFESSIONISTA (appreso dai preventivi precedenti):\n${userContext}`;
  }

  if (behaviorProfile) {
    const bp = behaviorProfile;
    let bpText = `\nPROFILO COMPORTAMENTALE (dati statistici reali):`;
    if (bp.avg_margin) bpText += `\n- Margine medio abituale: ${bp.avg_margin}%`;
    if (bp.avg_prices && Object.keys(bp.avg_prices).length) {
      bpText += `\n- Prezzi medi per fascia: ${Object.entries(bp.avg_prices).map(([k, v]) => `${k}: ${v}€`).join(", ")}`;
    }
    if (bp.frequent_items && bp.frequent_items.length) {
      bpText += `\n- Voci frequenti: ${bp.frequent_items.slice(0, 8).join(", ")}`;
    }
    if (bp.typical_item_count) bpText += `\n- Numero voci tipico per preventivo: ${bp.typical_item_count}`;
    if (bp.price_range && bp.price_range.max > 0) {
      bpText += `\n- Range prezzi totali: ${bp.price_range.min}€ - ${bp.price_range.max}€`;
    }
    bpText += `\nALLINEA i tuoi suggerimenti a questi dati storici.`;
    base += bpText;
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
      system: buildSystemPrompt(language, userContext, input.profession || (input.professional && input.professional.category)),
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

  // Profilo comportamentale se l'utente ha almeno 3 preventivi
  let behaviorProfile = null;
  if (input.user_id) {
    try {
      const allQuotes = loadQuotes();
      behaviorProfile = getUserBehaviorProfile(input.user_id, allQuotes);
    } catch (e) {
      console.error("[Claude] Errore caricamento profilo comportamentale:", e.message);
    }
  }

  const promptOptions = {
    jobType: input.jobType || null,
    priceLevel: input.priceLevel || null,
    urgency: input.urgency || null,
    notes: input.notes || null,
    behaviorProfile
  };

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
      system: buildCostSuggestionsPrompt(language, userContext, input.profession || (input.professional && input.professional.category), promptOptions),
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

async function reEstimateSingleItem({ user_id, professional, description, user_input, pricing_preset, profession }) {
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
      system: buildCostSuggestionsPrompt(language, userContext, profession || (professional && professional.category)),
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
