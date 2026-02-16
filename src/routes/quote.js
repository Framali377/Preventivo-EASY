// src/routes/quote.js
const express = require("express");
const router = express.Router();
const { getQuoteById, updateQuote, getUserById } = require("../utils/storage");
const { buildQuoteHTML, build404HTML, buildAcceptedHTML, buildAlreadyHandledHTML } = require("../utils/htmlBuilders");
const { buildQuotePDF } = require("../utils/pdfBuilder");
const { sendOrLog } = require("../utils/mailer");
const { buildAcceptedNotificationHTML } = require("../utils/emailTemplates");
const feedback = require("../utils/feedback");

// GET /q/:quote_id — pagina HTML pubblica
router.get("/:quote_id", (req, res) => {
  const quote = getQuoteById(req.params.quote_id);

  if (!quote) {
    return res.status(404).send(build404HTML(req.params.quote_id));
  }

  res.send(buildQuoteHTML(quote));
});

// GET /q/:quote_id/pdf — scarica PDF
router.get("/:quote_id/pdf", (req, res) => {
  const quote = getQuoteById(req.params.quote_id);

  if (!quote) {
    return res.status(404).json({ success: false, error: "Preventivo non trovato" });
  }

  const doc = buildQuotePDF(quote);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${quote.quote_id}.pdf"`);
  doc.pipe(res);
  doc.end();
});

// POST /q/:quote_id/accept — accettazione pubblica dal link email
router.post("/:quote_id/accept", async (req, res) => {
  const quote = getQuoteById(req.params.quote_id);

  if (!quote) {
    return res.status(404).send(build404HTML(req.params.quote_id));
  }

  if (quote.status !== "sent") {
    return res.send(buildAlreadyHandledHTML(quote));
  }

  // Aggiorna stato
  const updated = updateQuote(quote.quote_id, {
    status: "accepted",
    accepted_at: new Date().toISOString()
  });

  // Aggiorna outcome nel sistema feedback/apprendimento
  try {
    feedback.updateOutcome(quote.owner_user_id, quote.quote_id, "accepted");
  } catch (err) {
    console.error("[Accept] Errore feedback:", err.message);
  }

  // Notifica email al professionista
  try {
    const owner = getUserById(quote.owner_user_id);
    if (owner && owner.email) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const detailUrl = `${baseUrl}/quotes/${quote.quote_id}`;
      const html = buildAcceptedNotificationHTML(updated, detailUrl);
      await sendOrLog(owner.email, `Preventivo ${quote.quote_id} accettato`, html, quote.quote_id);
    }
  } catch (err) {
    console.error("[Accept] Errore invio notifica:", err.message);
  }

  res.send(buildAcceptedHTML(updated));
});

module.exports = router;
