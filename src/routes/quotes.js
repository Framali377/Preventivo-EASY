// src/routes/quotes.js
const express = require("express");
const router = express.Router();
const { getQuoteById, updateQuote, deleteQuote, loadQuotes } = require("../utils/storage");
const { sendOrLog } = require("../utils/mailer");
const { buildQuoteEmailHTML } = require("../utils/emailTemplates");
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

// POST /api/quotes/:id/send — invia via email
router.post("/:id/send", async (req, res) => {
  const quote = getQuoteById(req.params.id);
  if (!quote) return res.status(404).json({ success: false, error: "Preventivo non trovato" });

  const userId = req.session.userId;
  if (quote.user_id !== userId && quote.owner_user_id !== userId) {
    return res.status(403).json({ success: false, error: "Accesso non autorizzato" });
  }

  const to = req.body.email || quote.client?.email;
  if (!to) {
    return res.status(400).json({ success: false, error: "Nessun indirizzo email disponibile" });
  }

  try {
    const baseUrl = req.baseUrl_resolved || `${req.protocol}://${req.get("host")}`;
    const acceptUrl = `${baseUrl}/q/${quote.quote_id}/accept`;
    const viewUrl = `${baseUrl}/q/${quote.quote_id}`;
    const html = buildQuoteEmailHTML(quote, acceptUrl, viewUrl);
    const result = await sendOrLog(to, `Preventivo ${quote.quote_id}`, html, quote.quote_id);

    if (result.sent) {
      updateQuote(req.params.id, { status: "sent", sent_at: new Date().toISOString(), sent_to: to, email_status: "sent", email_sent_at: new Date().toISOString(), email_error: null });
      return res.json({ success: true, message: `Preventivo inviato a ${to}` });
    } else if (result.logged) {
      updateQuote(req.params.id, { status: "sent", sent_at: new Date().toISOString(), sent_to: to, email_status: "logged", email_sent_at: new Date().toISOString(), email_error: null });
      return res.json({ success: true, message: "Preventivo segnato come inviato (email salvata localmente)" });
    } else {
      updateQuote(req.params.id, { email_status: "failed", email_error: result.error });
      return res.status(500).json({ success: false, error: result.error || "Invio email fallito" });
    }
  } catch (err) {
    updateQuote(req.params.id, { email_status: "failed", email_error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
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
