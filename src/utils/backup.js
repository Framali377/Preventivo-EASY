// src/utils/backup.js
const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const { DB_PATH } = require("./db");

const BACKUP_DIR = path.join(__dirname, "..", "data", "backups");
const MAX_BACKUPS = 7;

// Upload offsite su S3 o storage S3-compatibile (Backblaze B2, MinIO, ecc.)
// Silenzioso se S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY non configurati
async function uploadToS3(localPath, filename) {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) return; // S3 non configurato

  let S3Client, PutObjectCommand;
  try {
    ({ S3Client, PutObjectCommand } = require("@aws-sdk/client-s3"));
  } catch {
    logger.warn("@aws-sdk/client-s3 non disponibile — backup offsite disabilitato");
    return;
  }

  const region = process.env.S3_REGION || "auto";
  const endpoint = process.env.S3_ENDPOINT || undefined;

  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    ...(endpoint && { endpoint, forcePathStyle: true })
  });

  const key = `backups/${filename}`;

  try {
    const body = fs.readFileSync(localPath);
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/x-sqlite3"
    }));
    logger.info({ bucket, key }, "Backup offsite S3 completato");
  } catch (err) {
    logger.error({ err: err.message, bucket, key }, "Backup offsite S3 fallito");
    // Il backup locale è già stato fatto — non blocchiamo il processo
  }
}

async function runBackup() {
  if (!fs.existsSync(DB_PATH)) {
    logger.warn("Backup: database non trovato, skip");
    return;
  }

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `app-${date}.db`;
  const dest = path.join(BACKUP_DIR, filename);

  try {
    fs.copyFileSync(DB_PATH, dest);
    logger.info({ dest }, "Backup locale completato");

    // Mantieni solo gli ultimi MAX_BACKUPS backup locali
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => /^app-\d{4}-\d{2}-\d{2}\.db$/.test(f))
      .sort();

    if (files.length > MAX_BACKUPS) {
      for (const f of files.slice(0, files.length - MAX_BACKUPS)) {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
      }
    }

    // Upload offsite (non blocking — errori già loggati dentro uploadToS3)
    uploadToS3(dest, filename).catch(() => {});
  } catch (err) {
    logger.error({ err: err.message }, "Backup locale fallito");
  }
}

module.exports = { runBackup };
