require("dotenv").config();
const express = require("express");
const session = require("express-session");

const authRoute = require("./routes/auth");
const generateRoute = require("./routes/generate");
const quotesRoute = require("./routes/quotes");
const quoteRoute = require("./routes/quote");
const dashboardRoute = require("./routes/dashboard");
const profileRoute = require("./routes/profile");
const upgradeRoute = require("./routes/upgrade");
const pricesRoute = require("./routes/prices");
const stripeRoute = require("./routes/stripe");
const requireAuth = require("./middleware/requireAuth");

const app = express();

/**
 * ⚠️ STRIPE WEBHOOK
 * Deve ricevere RAW BODY prima di express.json()
 */
app.use("/stripe/webhook", express.raw({ type: "application/json" }));

/**
 * Parser standard
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Sessioni
 */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "preventivo-ai-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: false, // true solo con HTTPS custom domain
    },
  })
);

/**
 * HEALTH CHECK (Render)
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    env: process.env.NODE_ENV || "development",
  });
});

/**
 * ROOT
 */
app.get("/", (req, res) => {
  if (req.session?.userId) {
    return res.redirect("/dashboard");
  }
  return res.redirect("/auth/login");
});

/**
 * AUTH (pubblico)
 */
app.use("/auth", authRoute);

/**
 * STRIPE
 * - /stripe/checkout → protetto
 * - /stripe/webhook → pubblico
 */
app.use("/stripe", stripeRoute);

/**
 * API PROTETTE
 */
app.use("/api/generate-quote", requireAuth, generateRoute);
app.use("/api/quotes", requireAuth, quotesRoute);

/**
 * DASHBOARD
 */
app.use("/dashboard", requireAuth, dashboardRoute);

/**
 * PREVENTIVI
 */
app.use("/quotes", requireAuth, require("./routes/newQuote"));
app.use("/q", quoteRoute); // link pubblico

/**
 * PROFILO / PIANI / PREZZI
 */
app.use("/profile", requireAuth, profileRoute);
app.use("/upgrade", requireAuth, upgradeRoute);
app.use("/settings/prices", requireAuth, pricesRoute);

/**
 * AI suggerimenti prezzi
 */
app.post(
  "/ai/suggest-prices",
  requireAuth,
  pricesRoute.suggestPricesHandler
);

/**
 * START SERVER
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Preventivo AI server running on port ${PORT}`);
});
