// src/routes/generate.js
const express = require("express");
const router = express.Router();
const { saveQuote } = require("../utils/storage");
const claude = require("../utils/claude");
const pricingEngine = require("../utils/pricingEngine");

function validateBody(body) {
  const errors = [];
  const { professional, client, job_description } = body || {};

  if (!professional || typeof professional !== "object") {
    errors.push("professional è obbligatorio");
  } else {
    if (!professional.name) errors.push("professional.name è obbligatorio");
    if (!professional.category) errors.push("professional.category è obbligatorio");
    if (!professional.city) errors.push("professional.city è obbligatorio");
  }

  if (!client || typeof client !== "object") {
    errors.push("client è obbligatorio");
  } else {
    if (!client.name) errors.push("client.name è obbligatorio");
    if (!client.email) errors.push("client.email è obbligatorio");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) {
      errors.push("client.email non è valido");
    }
  }

  if (!job_description || !job_description.trim()) {
    errors.push("job_description è obbligatorio");
  }

  return errors;
}

function buildMockQuote(input) {
  const items = [
    { description: "Intervento professionale", quantity: 1, unit_cost: 300, margin_percent: 33.33 }
  ];

  const result = pricingEngine.processQuote(items);

  return {
    line_items: result.line_items,
    subtotal: result.subtotal,
    taxes: result.taxes,
    total: result.total,
    currency: "EUR",
    payment_terms: "50% acconto, saldo a fine lavori",
    validity_days: 14
  };
}

router.post("/", async (req, res) => {
  const errors = validateBody(req.body);
  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  const {
    professional,
    client,
    job_description,
    pricing_preset = "standard"
  } = req.body;

  let generated;
  let ai_generated = false;

  try {
    if (claude.isAvailable()) {
      generated = await claude.generateQuoteWithClaude({
        professional, client, job_description, pricing_preset
      });
      ai_generated = true;
    } else {
      generated = buildMockQuote({ professional, client, job_description, pricing_preset });
    }
  } catch (err) {
    console.error("Claude API error, falling back to mock:", err.message);
    generated = buildMockQuote({ professional, client, job_description, pricing_preset });
  }

  // Valida con il pricing engine
  const validated = pricingEngine.processQuote(generated.line_items || []);

  const quote = {
    quote_id: `q-${Date.now()}`,
    created_at: new Date().toISOString(),
    user_id: req.session.userId || null,
    professional,
    client,
    job_description,
    pricing_preset,
    ai_generated,
    line_items: validated.line_items,
    subtotal: validated.subtotal,
    taxes: validated.taxes,
    total: validated.total,
    currency: generated.currency || "EUR",
    payment_terms: generated.payment_terms || "50% acconto, saldo a fine lavori",
    validity_days: generated.validity_days || 14,
    status: "draft"
  };

  saveQuote(quote);

  res.status(201).json({ success: true, quote });
});

module.exports = router;
