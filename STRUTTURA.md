# Preventivo EASY — Struttura Applicazione

## Overview
SaaS Node.js/Express per generazione automatica di preventivi professionali tramite AI (Claude).
Server-side rendering HTML, autenticazione a sessione, storage JSON su file, integrazione Stripe per pagamenti.

**Stack**: Node.js, Express, Nodemailer, Stripe, Claude AI (Anthropic)
**Porta**: configurabile via `PORT` env (default 3000, attualmente 4000)

---

## Struttura Directory

```
src/
├── index.js                  # Entry point — Express setup, middleware, route mounting
├── middleware/
│   ├── requireAdmin.js       # Middleware: blocca accesso se user.role !== "admin"
│   ├── requireAuth.js        # Middleware: richiede sessione autenticata
│   └── requirePlan.js        # Middleware: verifica piano attivo o crediti disponibili
├── routes/
│   ├── admin.js              # Dashboard admin (6 tab: Utenti, Preventivi, Email, Revenue, Sistema)
│   ├── auth.js               # Login, registrazione, logout
│   ├── dashboard.js          # Dashboard utente — lista preventivi, KPI, CTA
│   ├── generate.js           # API generazione preventivo tramite Claude AI
│   ├── landing.js            # Landing page pubblica (/)
│   ├── newQuote.js           # Wizard creazione preventivo (4 step)
│   ├── prices.js             # Gestione prezzi/listino personalizzato
│   ├── profile.js            # Profilo utente — dati aziendali, logo, preferenze
│   ├── quote.js              # Vista pubblica preventivo (/q/:id) + accettazione cliente
│   ├── quotes.js             # CRUD preventivi — GET dettaglio, POST invio email, GET PDF
│   ├── stripe.js             # Webhook e callback Stripe (checkout success/cancel)
│   └── upgrade.js            # Pagina upgrade piano / acquisto crediti
├── utils/
│   ├── claude.js             # Integrazione API Claude — prompt engineering, generazione items
│   ├── emailTemplates.js     # Template HTML email preventivo (buildQuoteEmailHTML)
│   ├── feedback.js           # Sistema feedback e KPI (accettazione, margine, accuratezza AI)
│   ├── htmlBuilders.js       # Generatore HTML pagina pubblica preventivo
│   ├── itemLibrary.js        # Libreria voci/item salvati dall'utente
│   ├── layout.js             # Layout condiviso — sidebar, CSS globale, page shell, esc/fmt
│   ├── mailer.js             # Sistema email — SMTP transport, sendOrLog, test, logging
│   ├── pdfBuilder.js         # Generazione PDF preventivo
│   ├── pricingEngine.js      # Motore prezzi — calcolo totali, sconti, margini
│   ├── storage.js            # Persistenza JSON — users.json, quotes.json, CRUD
│   ├── stripe.js             # Configurazione Stripe — piani, checkout session creation
│   └── userPrompts.js        # Prompt personalizzati per Claude AI
└── data/                     # Directory dati (gitignored)
    ├── users.json            # Database utenti
    ├── quotes.json           # Database preventivi
    └── email_logs/
        └── email_log.jsonl   # Log strutturato email (JSON Lines)
```

---

## Routes

| Percorso | File | Auth | Descrizione |
|----------|------|------|-------------|
| `GET /` | landing.js | No | Landing page pubblica |
| `GET /auth/login` | auth.js | No | Form login |
| `POST /auth/login` | auth.js | No | Processa login |
| `GET /auth/register` | auth.js | No | Form registrazione |
| `POST /auth/register` | auth.js | No | Processa registrazione |
| `GET /auth/logout` | auth.js | No | Logout e redirect |
| `GET /dashboard` | dashboard.js | Si | Dashboard utente |
| `GET /quotes/new` | newQuote.js | Si + Plan | Wizard nuovo preventivo |
| `POST /quotes/create` | newQuote.js | Si + Plan | Salva preventivo + invia email |
| `GET /quotes/:id` | quotes.js | Si | Dettaglio preventivo |
| `POST /api/quotes/:id/send` | quotes.js | Si | (Re)invia email preventivo |
| `GET /quotes/:id/pdf` | quotes.js | Si | Download PDF preventivo |
| `GET /q/:id` | quote.js | No | Vista pubblica preventivo |
| `POST /q/:id/accept` | quote.js | No | Cliente accetta preventivo |
| `GET /profile` | profile.js | Si | Profilo utente |
| `POST /profile` | profile.js | Si | Aggiorna profilo |
| `GET /upgrade` | upgrade.js | Si | Pagina upgrade piano |
| `GET /prices` | prices.js | Si | Gestione listino |
| `POST /api/generate` | generate.js | Si | Genera items via Claude AI |
| `POST /stripe/checkout` | stripe.js | Si | Crea sessione checkout Stripe |
| `GET /stripe/success` | stripe.js | Si | Callback pagamento OK |
| `GET /stripe/cancel` | stripe.js | Si | Callback pagamento annullato |
| `POST /stripe/webhook` | stripe.js | No | Webhook Stripe (raw body) |
| `GET /admin` | admin.js | Admin | Tab Utenti |
| `GET /admin/quotes` | admin.js | Admin | Tab Preventivi (filtri) |
| `GET /admin/emails` | admin.js | Admin | Tab Email Log |
| `GET /admin/revenue` | admin.js | Admin | Tab Revenue/Analytics |
| `GET /admin/user/:id` | admin.js | Admin | Dettaglio utente |
| `GET /admin/health` | admin.js | Admin | Stato sistema + test SMTP |
| `GET /admin/test-email` | admin.js | Admin | Test connessione SMTP (JSON) |
| `POST /admin/send-test-email` | admin.js | Admin | Invia email test all'admin |
| `POST /admin/send-manual-email` | admin.js | Admin | Invia email a destinatario personalizzato |
| `POST /admin/quotes/:id/resend` | admin.js | Admin | Reinvia email preventivo |
| `POST /admin/reset-admin-password` | admin.js | Admin | Reset password admin (richiede secret) |

---

## Sistema Email (mailer.js)

### Configurazione
Variabili `.env` richieste:
```
SMTP_HOST=smtps.aruba.it
SMTP_PORT=465
SMTP_USER=noreply@preventivoeasy.it
SMTP_PASS=password_app
SMTP_FROM_NAME=Preventivo EASY
SMTP_FROM_EMAIL=noreply@preventivoeasy.it
```

### Funzionamento
- Se SMTP configurato → invia email reale, logga risultato
- Se SMTP non configurato → salva HTML su disco in `src/data/email_logs/`, logga come "logged"
- Ogni tentativo viene registrato in `email_log.jsonl` con: timestamp, quote_id, to, subject, result, error, smtp_host, duration_ms, error_code

### Flusso email preventivo
1. Utente crea preventivo via wizard (`POST /quotes/create`)
2. Sistema chiama `sendOrLog(to, subject, html, quoteId)`
3. Se SMTP disponibile → invio email reale tramite nodemailer
4. Se invio OK → logga "sent", aggiorna quote con `email_status: "sent"`
5. Se invio fallisce → logga "failed" con dettagli errore (code, responseCode, command)
6. Se SMTP non disponibile → salva HTML su disco, logga "logged"

### Campi quote tracking
- `email_status`: "sent" | "failed" | "logged"
- `email_sent_at`: ISO timestamp
- `email_error`: messaggio errore (se failed)

### Logging
All'avvio dell'app viene loggato lo stato SMTP (configurato/non configurato con dettagli).
Ogni operazione email include timestamp leggibile, dettagli SMTP, durata in ms.

---

## Variabili Ambiente

### Locale (.env)
```
PORT=4000
LEARNING_THRESHOLD=10
SMTP_HOST=smtps.aruba.it
SMTP_PORT=465
SMTP_USER=noreply@preventivoeasy.it
SMTP_PASS=***
SMTP_FROM_NAME=Preventivo EASY
SMTP_FROM_EMAIL=noreply@preventivoeasy.it
CLAUDE_API_KEY=***
STRIPE_SECRET_KEY=***
STRIPE_WEBHOOK_SECRET=***
SESSION_SECRET=***
ADMIN_RESET_SECRET=*** (opzionale, per reset password admin)
```

### Produzione (render.yaml)
Le variabili con `sync: false` vanno configurate manualmente nella dashboard Render.
Le variabili con `value` sono pre-configurate nel yaml.

---

## Autenticazione e Ruoli

- **Sessione**: express-session con FileStore
- **Password**: bcrypt hash
- **Ruoli**: `user` (default), `admin`
- **Piani**: `free` (limite preventivi), `early_bird`, `standard` (abbonamenti), `pay-per-use` (crediti)

### Admin
- Email: `francesco.malitesta@gmail.com`
- Nome: Francesco Malitesta
- Accesso: `/admin` (sidebar visibile solo per admin)
- Middleware: `requireAdmin.js`
- Reset password: `POST /admin/reset-admin-password` con body `{ secret, newPassword }`

---

## Integrazione Stripe (utils/stripe.js + routes/stripe.js)

- 3 piani: Early Bird (5€/mese), Standard (8.99€/mese), Singolo preventivo (2.99€)
- Checkout session → webhook conferma → aggiornamento piano utente in storage

---

## Integrazione AI (claude.js)

- API Anthropic Claude per generazione voci preventivo
- Prompt engineering con contesto professione + descrizione lavoro
- `pricingEngine.js` per calcolo prezzi finali
- `feedback.js` per tracking accuratezza AI

---

## Palette UI
- **Primary**: Teal `#0d9488` / `#0f766e` (hover)
- **CTA**: Amber `#f59e0b` / `#d97706` (hover)
- **Background**: Off-white `#faf9f7`
- **Sidebar**: Dark warm `#1c1917` → `#292524`
- **Text**: `#1c1917`
