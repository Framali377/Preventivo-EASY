// src/utils/storage.js
const { getDb } = require("./db");

// ─── Helpers ───

function userFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    name: row.name,
    category: row.category,
    city: row.city,
    plan: row.plan,
    created_at: row.created_at,
    credits: row.credits,
    subscription_status: row.subscription_status,
    subscription_id: row.subscription_id,
    stripe_customer_id: row.stripe_customer_id,
    disabled: !!row.disabled,
    email_verified: !!row.email_verified,
    role: row.role || null
  };
}

// ─── Quotes ───

function loadQuotes() {
  return getDb()
    .prepare("SELECT data FROM quotes ORDER BY rowid")
    .all()
    .map(r => JSON.parse(r.data));
}

function saveQuote(quote) {
  getDb().prepare(`
    INSERT OR REPLACE INTO quotes (quote_id, user_id, created_at, status, data)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    quote.quote_id,
    quote.user_id || quote.owner_user_id,
    quote.created_at || new Date().toISOString(),
    quote.status || "draft",
    JSON.stringify(quote)
  );

  const userId = quote.user_id || quote.owner_user_id;
  if (userId) {
    try {
      const { analyzeAndGenerate } = require("./userPrompts");
      analyzeAndGenerate(userId, loadQuotes());
    } catch (err) {
      console.error("[Learning] Errore analisi:", err.message);
    }
  }
}

function getQuoteById(id) {
  const row = getDb().prepare("SELECT data FROM quotes WHERE quote_id = ?").get(id);
  return row ? JSON.parse(row.data) : null;
}

function updateQuote(id, updates) {
  const row = getDb().prepare("SELECT data FROM quotes WHERE quote_id = ?").get(id);
  if (!row) return null;
  const quote = { ...JSON.parse(row.data), ...updates };
  getDb().prepare("UPDATE quotes SET data = ?, status = ? WHERE quote_id = ?")
    .run(JSON.stringify(quote), quote.status || "draft", id);
  return quote;
}

function deleteQuote(id) {
  const result = getDb().prepare("DELETE FROM quotes WHERE quote_id = ?").run(id);
  return result.changes > 0;
}

// ─── Users ───

function loadUsers() {
  return getDb().prepare("SELECT * FROM users").all().map(userFromRow);
}

function createUser(user) {
  getDb().prepare(`
    INSERT INTO users
      (id, email, password_hash, name, category, city, plan, created_at,
       credits, subscription_status, subscription_id, stripe_customer_id,
       disabled, email_verified, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id, user.email, user.password_hash, user.name,
    user.category || null, user.city || null,
    user.plan || "free", user.created_at || new Date().toISOString(),
    user.credits || 0,
    user.subscription_status || null, user.subscription_id || null,
    user.stripe_customer_id || null,
    user.disabled ? 1 : 0,
    user.email_verified ? 1 : 0,
    user.role || null
  );
}

function getUserByEmail(email) {
  return userFromRow(getDb().prepare("SELECT * FROM users WHERE email = ?").get(email));
}

function getUserById(id) {
  return userFromRow(getDb().prepare("SELECT * FROM users WHERE id = ?").get(id));
}

function getQuoteCountByUser(userId) {
  return getDb().prepare("SELECT COUNT(*) as c FROM quotes WHERE user_id = ?").get(userId)?.c ?? 0;
}

function updateUser(userId, updates) {
  const allowed = [
    "name", "category", "city", "plan", "credits",
    "subscription_status", "subscription_id", "stripe_customer_id",
    "disabled", "email_verified", "password_hash", "role"
  ];
  const fields = Object.keys(updates).filter(k => allowed.includes(k));
  if (!fields.length) return getUserById(userId);

  const setClauses = fields.map(f => `${f} = ?`).join(", ");
  const values = fields.map(f => {
    if (f === "disabled" || f === "email_verified") return updates[f] ? 1 : 0;
    return updates[f] ?? null;
  });
  values.push(userId);

  getDb().prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...values);
  return getUserById(userId);
}

module.exports = {
  saveQuote, getQuoteById, loadQuotes, updateQuote, deleteQuote,
  createUser, getUserByEmail, getUserById, getQuoteCountByUser, updateUser, loadUsers
};
