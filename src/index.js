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

// ─── HEALTH CHECK — nessun middleware, prima di tutto ───
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", env: process.env.NODE_ENV || "development" });
});

// ─── Stripe webhook: raw body PRIMA di express.json() ───
app.use("/stripe/webhook", express.raw({ type: "application/json" }));

// ─── Parser ───
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Sessioni ───
app.use(
  session({
    secret: process.env.SESSION_SECRET || "preventivo-ai-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: false,
    },
  })
);

// ─── Root ───
app.get("/", (req, res) => {
  if (req.session?.userId) return res.redirect("/dashboard");
  res.redirect("/auth/login");
});

// ─── Pubbliche ───
app.use("/auth", authRoute);
app.use("/stripe", stripeRoute);
app.use("/q", quoteRoute);

// ─── Protette ───
app.use("/api/generate-quote", requireAuth, generateRoute);
app.use("/api/quotes", requireAuth, quotesRoute);
app.use("/dashboard", requireAuth, dashboardRoute);
app.use("/quotes", requireAuth, require("./routes/newQuote"));
app.use("/profile", requireAuth, profileRoute);
app.use("/upgrade", requireAuth, upgradeRoute);
app.use("/settings/prices", requireAuth, pricesRoute);
app.post("/ai/suggest-prices", requireAuth, pricesRoute.suggestPricesHandler);
app.use("/admin", require("./routes/admin"));

// ─── Start ───
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Preventivo AI running | port=${PORT} | env=${process.env.NODE_ENV || "development"}`);
});
