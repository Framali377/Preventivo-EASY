// src/middleware/rateLimiter.js
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

/**
 * Auth rate limiter — brute force protection.
 * 5 tentativi ogni 15 minuti per IP su login/register.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: ipKeyGenerator,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: "Troppi tentativi. Riprova tra 15 minuti.",
      retry_after_seconds: 900
    });
  }
});

/**
 * AI rate limiter — cost abuse protection.
 * 20 richieste ogni 10 minuti, per utente autenticato (fallback IP).
 */
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.session?.userId) return req.session.userId;
    return ipKeyGenerator(req);
  },
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: "Hai raggiunto il limite di richieste AI. Riprova tra qualche minuto.",
      retry_after_seconds: 600
    });
  }
});

module.exports = { authLimiter, aiLimiter };
