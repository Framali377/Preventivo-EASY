require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const path = require("path");
const FileStore = require("session-file-store")(session);
const logger = require("./utils/logger");
const { runBackup } = require("./utils/backup");

process.on("uncaughtException", async (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, "Uncaught exception");
  try {
    const { sendCriticalAlert } = require("./utils/mailer");
    await Promise.race([
      sendCriticalAlert("Uncaught Exception", `${err.message}\n\n${err.stack}`),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);
  } catch {}
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : "";
  logger.error({ reason: msg, stack }, "Unhandled promise rejection");
  try {
    const { sendCriticalAlert } = require("./utils/mailer");
    await Promise.race([
      sendCriticalAlert("Unhandled Rejection", `${msg}\n\n${stack}`),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);
  } catch {}
  // Non uscire — unhandledRejection non è necessariamente fatale
});

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
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false })); // CSP separato se necessario

// ─── HEALTH CHECK — pubblico, solo stato minimo ───
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// ─── SEO: robots.txt + sitemap.xml ───
app.get("/robots.txt", (_req, res) => {
  const base = resolveBaseUrl(_req);
  res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /admin\nDisallow: /profile\nDisallow: /quotes/\nDisallow: /api/\nSitemap: ${base}/sitemap.xml`);
});
app.get("/sitemap.xml", (req, res) => {
  const base = resolveBaseUrl(req);
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n  <url><loc>${base}/auth/login</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n  <url><loc>${base}/auth/register</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n</urlset>`);
});

// ─── Stripe webhook: raw body PRIMA di express.json() ───
app.use("/stripe/webhook", express.raw({ type: "application/json" }));

// ─── Parser ───
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Sessioni ───
const isProd = process.env.NODE_ENV === "production";

if (isProd && !process.env.SESSION_SECRET) {
  console.error("[FATAL] SESSION_SECRET non impostato in produzione. Uscita.");
  process.exit(1);
}

const WEAK_SECRETS = ["cambiami-in-produzione", "change-me", "secret", "admin", "password", "test"];
if (isProd && !process.env.ADMIN_RESET_SECRET) {
  console.error("[FATAL] ADMIN_RESET_SECRET non impostato in produzione. Uscita.");
  process.exit(1);
}
if (process.env.ADMIN_RESET_SECRET && (WEAK_SECRETS.includes(process.env.ADMIN_RESET_SECRET) || process.env.ADMIN_RESET_SECRET.length < 16)) {
  if (isProd) {
    console.error("[FATAL] ADMIN_RESET_SECRET troppo debole. Genera con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    process.exit(1);
  } else {
    console.warn("[WARN] ADMIN_RESET_SECRET debole — non usare in produzione");
  }
}

// ─── Verifica email: SMTP obbligatorio in produzione ───
// Senza SMTP la verifica email è impossibile e gli utenti non possono usare il servizio.
if (isProd && !(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)) {
  console.error("[FATAL] SMTP non configurato in produzione.");
  console.error("[FATAL] La verifica email è obbligatoria. Configura SMTP_HOST, SMTP_USER, SMTP_PASS nel .env");
  process.exit(1);
}

app.use(
  session({
    store: new FileStore({
      path: path.join(__dirname, "data", "sessions"),
      ttl: 86400,
      retries: 0
    }),
    secret: process.env.SESSION_SECRET || "dev-only-secret-not-for-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax",
      httpOnly: true
    },
  })
);

// ─── CSRF protection ───
const csrfProtection = require("./middleware/csrf");
app.use(csrfProtection({ excludePaths: ["/stripe/webhook"] }));

// ─── Helper: base URL (usa APP_URL se disponibile, altrimenti fallback da request) ───
function resolveBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const proto = req.get("x-forwarded-proto") || req.protocol;
  return `${proto}://${req.get("host")}`;
}
// Rendi disponibile a tutte le route
app.use((req, _res, next) => {
  req.baseUrl_resolved = resolveBaseUrl(req);
  next();
});

// ─── Root ───
const landingRoute = require("./routes/landing");
app.get("/", (req, res, next) => {
  if (req.session?.userId) return res.redirect("/dashboard");
  next();
});
app.use("/", landingRoute);

// ─── Rate limiting ───
const { authLimiter, aiLimiter } = require("./middleware/rateLimiter");

// ─── Pubbliche ───
app.post("/auth/login", authLimiter);
app.post("/auth/register", authLimiter);
app.use("/auth", authRoute);
app.use("/stripe", stripeRoute);
app.use("/q", quoteRoute);

// ─── Protette ───
app.use("/api/generate-quote", requireAuth, aiLimiter, generateRoute);
app.use("/api/quotes", requireAuth, quotesRoute);
app.use("/dashboard", requireAuth, dashboardRoute);
app.post("/quotes/preview", requireAuth, aiLimiter);
app.post("/quotes/re-estimate-row", requireAuth, aiLimiter);
app.use("/quotes", requireAuth, require("./routes/newQuote"));
app.use("/profile", requireAuth, profileRoute);
app.use("/upgrade", requireAuth, upgradeRoute);
app.use("/settings/prices", requireAuth, pricesRoute);
app.post("/ai/suggest-prices", requireAuth, aiLimiter, pricesRoute.suggestPricesHandler);
app.use("/admin", require("./routes/admin"));

// ─── HEALTH CHECK dettagliato — solo admin ───
const requireAdmin = require("./middleware/requireAdmin");
app.get("/health/admin", requireAuth, requireAdmin, (_req, res) => {
  const { isAvailable, getSmtpConfig } = require("./utils/mailer");
  const uptime = process.uptime();
  const mem = process.memoryUsage();
  res.json({
    status: "ok",
    env: process.env.NODE_ENV || "development",
    uptime_s: Math.round(uptime),
    memory_mb: Math.round(mem.rss / 1024 / 1024),
    smtp: isAvailable() ? "configured" : "not_configured",
    smtp_host: getSmtpConfig().host,
    app_url: process.env.APP_URL || null,
    timestamp: new Date().toISOString()
  });
});

// ─── Start ───
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || "development", app_url: process.env.APP_URL }, "Preventivo EASY avviato");
  require("./utils/mailer").logSmtpStatus();

  if (process.env.S3_BUCKET) {
    logger.info({ bucket: process.env.S3_BUCKET, endpoint: process.env.S3_ENDPOINT || "AWS S3" }, "Backup offsite S3 configurato");
  } else {
    logger.info("Backup offsite S3 non configurato — solo backup locale");
  }
  if (process.env.ALERT_EMAIL) {
    logger.info({ alert_email: process.env.ALERT_EMAIL }, "Alert email configurata");
  }

  // Backup immediato all'avvio + ogni 24h
  runBackup();
  setInterval(runBackup, 24 * 60 * 60 * 1000);
});
