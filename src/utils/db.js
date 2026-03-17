// src/utils/db.js
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "..", "data", "app.db");
const DATA_DIR = path.join(__dirname, "..", "data");

// Carica better-sqlite3 con errore chiaro se manca o non è compilato
let Database;
try {
  Database = require("better-sqlite3");
} catch (loadErr) {
  console.error("[FATAL] Impossibile caricare better-sqlite3:", loadErr.message);
  if (loadErr.message.includes("NODE_MODULE_VERSION") || loadErr.message.includes("was compiled against")) {
    console.error("[HINT] Il modulo nativo non è compatibile con questa versione di Node.");
    console.error("[HINT] Ricompila con: npm rebuild better-sqlite3");
  } else if (loadErr.code === "MODULE_NOT_FOUND") {
    console.error("[HINT] Modulo mancante. Esegui: npm install --production");
    console.error("[HINT] Il VPS deve avere build-essential e python3 installati.");
  }
  process.exit(1);
}

let _db = null;

function getDb() {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  try {
    _db = new Database(DB_PATH);
  } catch (err) {
    console.error("[FATAL] Impossibile aprire il database SQLite:", err.message);
    console.error("[PATH]", DB_PATH);
    process.exit(1);
  }

  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  initSchema(_db);
  autoMigrateFromJson(_db);

  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      city TEXT,
      plan TEXT DEFAULT 'free',
      created_at TEXT NOT NULL,
      credits INTEGER DEFAULT 0,
      subscription_status TEXT,
      subscription_id TEXT,
      stripe_customer_id TEXT,
      disabled INTEGER DEFAULT 0,
      email_verified INTEGER DEFAULT 0,
      role TEXT
    );

    CREATE TABLE IF NOT EXISTS quotes (
      quote_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      data TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS api_usage (
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      call_count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, date)
    );
  `);
}

// Migrazione automatica da JSON a SQLite (eseguita solo se DB è vuoto)
function autoMigrateFromJson(db) {
  const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  if (userCount > 0) return; // già popolato

  const usersJson = path.join(DATA_DIR, "users.json");
  const quotesJson = path.join(DATA_DIR, "quotes.json");

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users
      (id, email, password_hash, name, category, city, plan, created_at,
       credits, subscription_status, subscription_id, stripe_customer_id,
       disabled, email_verified, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertQuote = db.prepare(`
    INSERT OR IGNORE INTO quotes (quote_id, user_id, created_at, status, data)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    if (fs.existsSync(usersJson)) {
      const users = JSON.parse(fs.readFileSync(usersJson, "utf-8"));
      for (const u of users) {
        insertUser.run(
          u.id, u.email, u.password_hash, u.name,
          u.category || null, u.city || null,
          u.plan || "free", u.created_at || new Date().toISOString(),
          u.credits || 0,
          u.subscription_status || null, u.subscription_id || null,
          u.stripe_customer_id || null,
          u.disabled ? 1 : 0,
          1, // utenti esistenti già verificati
          u.role || null
        );
      }
      console.log(`[DB] Migrati ${users.length} utenti da users.json`);
    }

    if (fs.existsSync(quotesJson)) {
      const quotes = JSON.parse(fs.readFileSync(quotesJson, "utf-8"));
      for (const q of quotes) {
        insertQuote.run(
          q.quote_id,
          q.user_id || q.owner_user_id,
          q.created_at || new Date().toISOString(),
          q.status || "draft",
          JSON.stringify(q)
        );
      }
      console.log(`[DB] Migrati ${quotes.length} preventivi da quotes.json`);
    }
  })();
}

module.exports = { getDb, DB_PATH };
