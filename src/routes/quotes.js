// src/routes/quotes.js
const express = require("express");
const router = express.Router();
const { getQuoteById, updateQuote, deleteQuote, loadQuotes } = require("../utils/storage");
const { sendQuoteEmail, isAvailable: smtpAvailable } = require("../utils/mailer");
const { buildQuoteHTML } = require("../utils/htmlBuilders");
const feedback = require("../utils/feedback");

const VALID_STATUSES = ["draft", "sent", "accepted", "acconto_pagato", "rejected", "expired"];

// GET /api/quotes — lista preventivi dell'utente
router.get("/", (req, res) => {
  const userId = req.session.userId;
  const quotes = loadQuotes()
    .filter(q => q.user_id === userId || q.owner_user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ success: true, count: quotes.length, quotes });
});

// GET /api/quotes/:id — dettaglio
router.get("/:id", (req, res) => {
  const quote = getQuoteById(req.params.id);
  if (!quote) return res.status(404).json({ success: false, error: "Preventivo non trovato" });

  const userId = req.session.userId;
  if (quote.user_id !== userId && quote.owner_user_id !== userId) {
    return res.status(403).json({ success: false, error: "Accesso non autorizzato" });
  }

  res.json({ success: true, quote });
});

// PATCH /api/quotes/:id/status — cambia stato
router.patch("/:id/status", (req, res) => {
  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, error: `Stato non valido. Validi: ${VALID_STATUSES.join(", ")}` });
  }

  const quote = getQuoteById(req.params.id);
  if (!quote) return res.status(404).json({ success: false, error: "Preventivo non trovato" });

  const userId = req.session.userId;
  if (quote.user_id !== userId && quote.owner_user_id !== userId) {
    return res.status(403).json({ success: false, error: "Accesso non autorizzato" });
  }

  const updated = updateQuote(req.params.id, { status });

  // Quando stato diventa "accepted" o "rejected" → aggiorna feedback
  if (status === "accepted" || status === "rejected") {
    try {
      const ownerId = quote.user_id || quote.owner_user_id;
      if (ownerId) {
        feedback.updateOutcome(ownerId, req.params.id, status);
      }
    } catch (err) {
      console.error("Feedback updateOutcome error:", err.message);
    }
  }

  res.json({ success: true, quote: updated });
});

// POST /api/quotes/:id/send — invia via email o segna come inviato
router.post("/:id/send", async (req, res) => {
  const quote = getQuoteById(req.params.id);
  if (!quote) return res.status(404).json({ success: false, error: "Preventivo non trovato" });

  const userId = req.session.userId;
  if (quote.user_id !== userId && quote.owner_user_id !== userId) {
    return res.status(403).json({ success: false, error: "Accesso non autorizzato" });
  }

  const to = req.body.email || quote.client?.email;

  // Se SMTP configurato, invia email
  if (smtpAvailable() && to) {
    try {
      const html = buildQuoteHTML(quote);
      await sendQuoteEmail(to, `Preventivo ${quote.quote_id}`, html);
      updateQuote(req.params.id, { status: "sent", sent_at: new Date().toISOString(), sent_to: to });
      return res.json({ success: true, message: `Preventivo inviato a ${to}` });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Fallback: segna come inviato senza email
  updateQuote(req.params.id, { status: "sent", sent_at: new Date().toISOString() });
  res.json({ success: true, message: "Preventivo segnato come inviato" });
});

// DELETE /api/quotes/:id
router.delete("/:id", (req, res) => {
  const quote = getQuoteById(req.params.id);
  if (!quote) return res.status(404).json({ success: false, error: "Preventivo non trovato" });

  const userId = req.session.userId;
  if (quote.user_id !== userId && quote.owner_user_id !== userId) {
    return res.status(403).json({ success: false, error: "Accesso non autorizzato" });
  }

  deleteQuote(req.params.id);
  res.json({ success: true, message: "Preventivo eliminato" });
});

module.exports = router;
