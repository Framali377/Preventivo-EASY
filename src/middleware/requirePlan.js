// src/middleware/requirePlan.js
const { getUserById, getQuoteCountByUser, updateUser } = require("../utils/storage");

const FREE_QUOTE_LIMIT = Number(process.env.FREE_QUOTE_LIMIT) || 3;

function requirePlan(req, res, next) {
  const user = getUserById(req.session.userId);
  if (!user) return res.status(401).json({ success: false, error: "Autenticazione richiesta" });

  const plan = user.plan || "free";

  // Abbonamento attivo (early o standard)
  if ((plan === "early" || plan === "standard") && user.subscription_status === "active") {
    return next();
  }

  // Pay-per-use con crediti disponibili
  if (user.credits && user.credits > 0) {
    updateUser(user.id, { credits: user.credits - 1 });
    return next();
  }

  // Piano free: controlla limite
  const count = getQuoteCountByUser(user.id);
  if (count >= FREE_QUOTE_LIMIT) {
    return res.status(402).json({
      success: false,
      error: "Limite gratuito raggiunto",
      detail: `Il piano gratuito consente ${FREE_QUOTE_LIMIT} preventivi. Hai già creato ${count} preventivi.`,
      upgrade_hint: "Passa a un piano a pagamento per preventivi illimitati o acquista un singolo preventivo."
    });
  }

  next();
}

module.exports = requirePlan;
