// src/index.js
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

// Webhook Stripe deve ricevere raw body PRIMA di express.json()
app.use("/stripe/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "preventivo-ai-dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// root redirect
app.get("/", (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect("/dashboard");
  }
  res.redirect("/auth/login");
});

// auth (pubblico)
app.use("/auth", authRoute);

// Stripe (checkout protetto, webhook pubblico)
app.use("/stripe", stripeRoute);

// API protette
app.use("/api/generate-quote", requireAuth, generateRoute);
app.use("/api/quotes", requireAuth, quotesRoute);

// dashboard protetto
app.use("/dashboard", requireAuth, dashboardRoute);

// form nuovo preventivo + dettaglio (protetto)
app.use("/quotes", requireAuth, require("./routes/newQuote"));

// profilo (protetto)
app.use("/profile", requireAuth, profileRoute);

// upgrade piano (protetto)
app.use("/upgrade", requireAuth, upgradeRoute);

// listino prezzi (protetto)
app.use("/settings/prices", requireAuth, pricesRoute);

// AI suggerimenti prezzi (protetto)
app.post("/ai/suggest-prices", requireAuth, require("./routes/prices").suggestPricesHandler);

// link pubblico preventivo (nessuna auth)
app.use("/q", quoteRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
