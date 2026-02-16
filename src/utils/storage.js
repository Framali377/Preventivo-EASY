// src/utils/storage.js
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "quotes.json");
const USERS_PATH = path.join(DATA_DIR, "users.json");

function loadQuotes() {
  if (!fs.existsSync(DB_PATH)) return [];
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function writeAll(data) {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function saveQuote(quote) {
  const data = loadQuotes();
  data.push(quote);
  writeAll(data);

  // Trigger apprendimento incrementale
  const userId = quote.user_id || quote.owner_user_id;
  if (userId) {
    try {
      const { analyzeAndGenerate } = require("./userPrompts");
      analyzeAndGenerate(userId, data);
    } catch (err) {
      console.error("[Learning] Errore analisi:", err.message);
    }
  }
}

function getQuoteById(id) {
  return loadQuotes().find(q => q.quote_id === id) || null;
}

function updateQuote(id, updates) {
  const data = loadQuotes();
  const idx = data.findIndex(q => q.quote_id === id);
  if (idx === -1) return null;
  Object.assign(data[idx], updates);
  writeAll(data);
  return data[idx];
}

function deleteQuote(id) {
  const data = loadQuotes();
  const idx = data.findIndex(q => q.quote_id === id);
  if (idx === -1) return false;
  data.splice(idx, 1);
  writeAll(data);
  return true;
}

// ─── Users ───

function loadUsers() {
  if (!fs.existsSync(USERS_PATH)) return [];
  return JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
}

function writeUsers(data) {
  ensureDir();
  fs.writeFileSync(USERS_PATH, JSON.stringify(data, null, 2));
}

function createUser(user) {
  const users = loadUsers();
  users.push(user);
  writeUsers(users);
}

function getUserByEmail(email) {
  return loadUsers().find(u => u.email === email) || null;
}

function getUserById(id) {
  return loadUsers().find(u => u.id === id) || null;
}

function getQuoteCountByUser(userId) {
  return loadQuotes().filter(q => q.user_id === userId || q.owner_user_id === userId).length;
}

function updateUser(userId, updates) {
  const users = loadUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return null;
  Object.assign(users[idx], updates);
  writeUsers(users);
  return users[idx];
}

module.exports = {
  saveQuote, getQuoteById, loadQuotes, updateQuote, deleteQuote,
  createUser, getUserByEmail, getUserById, getQuoteCountByUser, updateUser
};
