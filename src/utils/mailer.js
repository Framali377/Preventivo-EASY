// src/utils/mailer.js
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

let _transporter = null;

function getTransporter() {
  if (!_transporter) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return null;
    }
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return _transporter;
}

function isAvailable() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendQuoteEmail(to, subject, html) {
  const transporter = getTransporter();
  if (!transporter) throw new Error("SMTP non configurato. Imposta SMTP_HOST, SMTP_USER, SMTP_PASS nel .env");

  await transporter.sendMail({
    from: `"Preventivo AI" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html
  });
}

async function sendOrLog(to, subject, html, quoteId) {
  if (isAvailable()) {
    await sendQuoteEmail(to, subject, html);
    return { sent: true, logged: false };
  }

  // Fallback: salva HTML su disco
  const logsDir = path.join(__dirname, "..", "data", "email_logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  const timestamp = Date.now();
  const filePath = path.join(logsDir, `${quoteId}_${timestamp}.html`);
  fs.writeFileSync(filePath, html, "utf-8");
  console.log(`[Mailer] SMTP non disponibile — email salvata in ${filePath}`);
  return { sent: false, logged: true };
}

module.exports = { sendQuoteEmail, isAvailable, sendOrLog };
