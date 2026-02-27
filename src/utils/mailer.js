// src/utils/mailer.js
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

let _transporter = null;

const EMAIL_LOG_DIR = path.join(__dirname, "..", "data", "email_logs");
const EMAIL_LOG_FILE = path.join(EMAIL_LOG_DIR, "email_log.jsonl");

function ts() {
  return new Date().toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: (Number(process.env.SMTP_PORT) || 587) === 465,
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS ? "***configured***" : null
  };
}

function getTransporter() {
  if (!_transporter) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log(`[Mailer ${ts()}] SMTP non configurato. Variabili mancanti:`, {
        SMTP_HOST: !!process.env.SMTP_HOST,
        SMTP_USER: !!process.env.SMTP_USER,
        SMTP_PASS: !!process.env.SMTP_PASS
      });
      return null;
    }

    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = port === 465;

    const transportOpts = {
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000
    };

    // Porta 465 = TLS implicito (secure:true), porta 587 = STARTTLS (secure:false)
    if (secure) {
      transportOpts.tls = { minVersion: "TLSv1.2" };
    } else {
      transportOpts.requireTLS = true;
      transportOpts.tls = { minVersion: "TLSv1.2" };
    }

    _transporter = nodemailer.createTransport(transportOpts);

    console.log(`[Mailer ${ts()}] Transporter creato: ${process.env.SMTP_HOST}:${port} (secure: ${secure}) user: ${process.env.SMTP_USER}`);
  }
  return _transporter;
}

function isAvailable() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function logSmtpStatus() {
  const config = getSmtpConfig();
  if (isAvailable()) {
    console.log(`[Mailer ${ts()}] SMTP CONFIGURATO — host: ${config.host}:${config.port} | user: ${config.user} | secure: ${config.secure}`);
  } else {
    console.log(`[Mailer ${ts()}] SMTP NON CONFIGURATO — email verranno salvate su disco come fallback`);
    console.log(`[Mailer ${ts()}] Variabili mancanti: SMTP_HOST=${!!config.host}, SMTP_USER=${!!config.user}, SMTP_PASS=${!!config.pass}`);
  }
}

function logEmailEvent(entry) {
  if (!fs.existsSync(EMAIL_LOG_DIR)) fs.mkdirSync(EMAIL_LOG_DIR, { recursive: true });
  const record = { timestamp: new Date().toISOString(), ...entry };
  fs.appendFileSync(EMAIL_LOG_FILE, JSON.stringify(record) + "\n", "utf-8");
}

function loadEmailLog() {
  if (!fs.existsSync(EMAIL_LOG_FILE)) return [];
  const content = fs.readFileSync(EMAIL_LOG_FILE, "utf-8").trim();
  if (!content) return [];
  return content.split("\n").map(line => {
    try { return JSON.parse(line); }
    catch { return null; }
  }).filter(Boolean);
}

async function testSmtp() {
  console.log(`[Mailer ${ts()}] Test SMTP avviato...`);
  console.log(`[Mailer ${ts()}] Config:`, getSmtpConfig());

  if (!isAvailable()) {
    console.log(`[Mailer ${ts()}] Test fallito: SMTP non configurato`);
    return { ok: false, error: "SMTP non configurato. Imposta SMTP_HOST, SMTP_USER, SMTP_PASS nel .env", config: getSmtpConfig() };
  }

  _transporter = null;
  const transporter = getTransporter();
  if (!transporter) return { ok: false, error: "Impossibile creare transporter", config: getSmtpConfig() };

  const start = Date.now();
  try {
    await transporter.verify();
    const duration = Date.now() - start;
    console.log(`[Mailer ${ts()}] Test SMTP: OK — connessione riuscita (${duration}ms)`);
    return { ok: true, error: null, config: getSmtpConfig(), duration_ms: duration };
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[Mailer ${ts()}] Test SMTP FALLITO (${duration}ms):`, {
      message: err.message,
      code: err.code,
      responseCode: err.responseCode,
      command: err.command
    });
    return { ok: false, error: err.message, code: err.code, responseCode: err.responseCode, config: getSmtpConfig(), duration_ms: duration };
  }
}

async function sendQuoteEmail(to, subject, html) {
  const transporter = getTransporter();
  if (!transporter) throw new Error("SMTP non configurato. Imposta SMTP_HOST, SMTP_USER, SMTP_PASS nel .env");

  const fromName = process.env.SMTP_FROM_NAME || "Preventivo EASY";
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const config = getSmtpConfig();

  console.log(`[Mailer ${ts()}] Invio email a: ${to} | subject: ${subject} | from: ${fromName} <${fromEmail}> | smtp: ${config.host}:${config.port}`);

  const start = Date.now();
  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html
    });
    const duration = Date.now() - start;
    console.log(`[Mailer ${ts()}] Email inviata con successo! messageId: ${info.messageId} (${duration}ms)`);
    return { ...info, duration_ms: duration };
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[Mailer ${ts()}] Email FALLITA (${duration}ms):`, {
      message: err.message,
      code: err.code,
      responseCode: err.responseCode,
      command: err.command
    });
    throw err;
  }
}

async function sendTestEmail(to) {
  console.log(`[Mailer ${ts()}] Invio email di test a: ${to}`);

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Inter,sans-serif;padding:40px;background:#faf9f7">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <h2 style="color:#0d9488;margin:0 0 12px">Test Email — Preventivo EASY</h2>
    <p style="color:#374151;line-height:1.6">Questa è un'email di test inviata dalla piattaforma Preventivo EASY.</p>
    <p style="color:#374151;line-height:1.6">Se la ricevi, il sistema SMTP è configurato correttamente.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="font-size:.82rem;color:#9ca3af">Inviata il ${new Date().toLocaleString("it-IT")} da ${process.env.SMTP_HOST || "localhost"}</p>
  </div>
</body></html>`;

  return sendQuoteEmail(to, "Test Email — Preventivo EASY", html);
}

async function sendOrLog(to, subject, html, quoteId) {
  const config = getSmtpConfig();
  console.log(`[Mailer ${ts()}] sendOrLog | quoteId: ${quoteId} | to: ${to} | SMTP: ${isAvailable() ? config.host + ":" + config.port : "non disponibile"}`);

  if (isAvailable()) {
    const start = Date.now();
    try {
      const info = await sendQuoteEmail(to, subject, html);
      const duration = Date.now() - start;
      logEmailEvent({ quote_id: quoteId, to, subject, result: "sent", error: null, smtp_host: config.host, duration_ms: duration });
      console.log(`[Mailer ${ts()}] Email INVIATA per ${quoteId} a ${to} (${duration}ms)`);
      return { sent: true, logged: false, failed: false, error: null, messageId: info.messageId };
    } catch (err) {
      const duration = Date.now() - start;
      logEmailEvent({ quote_id: quoteId, to, subject, result: "failed", error: err.message, error_code: err.code, smtp_host: config.host, duration_ms: duration });
      console.error(`[Mailer ${ts()}] Email FALLITA per ${quoteId} (${duration}ms):`, {
        message: err.message,
        code: err.code,
        responseCode: err.responseCode,
        command: err.command
      });
      return { sent: false, logged: false, failed: true, error: err.message };
    }
  }

  // Fallback: salva HTML su disco
  if (!fs.existsSync(EMAIL_LOG_DIR)) fs.mkdirSync(EMAIL_LOG_DIR, { recursive: true });
  const timestamp = Date.now();
  const filePath = path.join(EMAIL_LOG_DIR, `${quoteId}_${timestamp}.html`);
  fs.writeFileSync(filePath, html, "utf-8");
  console.log(`[Mailer ${ts()}] Email SALVATA su disco per ${quoteId}: ${filePath}`);
  logEmailEvent({ quote_id: quoteId, to, subject, result: "logged", error: null, smtp_host: null, duration_ms: 0 });
  return { sent: false, logged: true, failed: false, error: null };
}

module.exports = { sendQuoteEmail, isAvailable, sendOrLog, loadEmailLog, testSmtp, sendTestEmail, getSmtpConfig, logSmtpStatus };
