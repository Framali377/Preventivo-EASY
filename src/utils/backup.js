// src/utils/backup.js
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

const DB_PATH = path.join(__dirname, "..", "data", "app.db");
const BACKUP_DIR = path.join(__dirname, "..", "data", "backups");
const MAX_BACKUPS = 7;

function runBackup() {
  if (!fs.existsSync(DB_PATH)) {
    logger.warn("Backup: database non trovato, skip");
    return;
  }

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dest = path.join(BACKUP_DIR, `app-${date}.db`);

  try {
    fs.copyFileSync(DB_PATH, dest);
    logger.info({ dest }, "Backup database completato");

    // Mantieni solo gli ultimi MAX_BACKUPS backup
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => /^app-\d{4}-\d{2}-\d{2}\.db$/.test(f))
      .sort();

    if (files.length > MAX_BACKUPS) {
      for (const f of files.slice(0, files.length - MAX_BACKUPS)) {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, "Backup database fallito");
  }
}

module.exports = { runBackup };
