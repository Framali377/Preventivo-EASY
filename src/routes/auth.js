// src/routes/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const { createUser, getUserByEmail } = require("../utils/storage");

const SALT_ROUNDS = 10;

// ── Shared auth page shell (standalone, no topbar) ──
function authPage({ title, cardHtml, script }) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Preventivo EASY</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#faf9f7;color:#1c1917;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-size:14px;line-height:1.6}
    .auth-card{background:#fff;border-radius:16px;box-shadow:0 4px 32px rgba(0,0,0,.08),0 0 0 1px rgba(0,0,0,.03);padding:44px 40px;max-width:440px;width:100%}
    .auth-logo{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px}
    .auth-logo-icon{width:36px;height:36px;background:linear-gradient(135deg,#0d9488,#0891b2);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;color:#fff}
    .auth-logo span{font-size:1.15rem;font-weight:700;letter-spacing:-.02em;color:#1c1917}
    .auth-title{text-align:center;font-size:1.2rem;font-weight:700;margin-top:20px;margin-bottom:4px}
    .auth-sub{text-align:center;color:#888;font-size:.88rem;margin-bottom:28px}
    .field{margin-bottom:20px}
    .field label{display:block;font-size:.76rem;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.04em;margin-bottom:7px}
    .field input,.field select{width:100%;padding:11px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:.9rem;font-family:inherit;transition:all .2s;background:#fff}
    .field input:focus,.field select:focus{outline:none;border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,.1)}
    .field .hint{font-size:.75rem;color:#9ca3af;margin-top:5px}
    .btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:12px 24px;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer;border:none;text-align:center;transition:all .2s;line-height:1.4}
    .btn-primary{background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;box-shadow:0 2px 8px rgba(13,148,136,.25)}
    .btn-primary:hover{background:linear-gradient(135deg,#0f766e,#115e59);box-shadow:0 4px 12px rgba(13,148,136,.35);transform:translateY(-1px)}
    .auth-footer{text-align:center;margin-top:24px;font-size:.85rem;color:#888}
    .auth-footer a{color:#0d9488;text-decoration:none;font-weight:500}
    .auth-footer a:hover{text-decoration:underline}
    .alert{padding:12px 16px;border-radius:8px;font-size:.85rem;margin-bottom:18px;display:none}
    .alert-error{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
    .free-badge{display:inline-flex;align-items:center;gap:5px;background:#ecfdf5;color:#065f46;font-size:.76rem;font-weight:600;padding:4px 12px;border-radius:16px;margin-top:8px}
    .back-link{display:block;text-align:center;margin-top:16px;font-size:.82rem;color:#9ca3af}
    .back-link a{color:#6b7280;text-decoration:none}
    .back-link a:hover{color:#0d9488}
  </style>
</head>
<body>
  <div class="auth-card">
    ${cardHtml}
  </div>
  <script>${script || ""}</script>
</body>
</html>`;
}

// ── GET /auth/login ──
router.get("/login", (req, res) => {
  res.send(authPage({
    title: "Accedi",
    cardHtml: `
    <div class="auth-logo">
      <div class="auth-logo-icon">P</div>
      <span>Preventivo EASY</span>
    </div>
    <h1 class="auth-title">Bentornato</h1>
    <p class="auth-sub">Accedi per gestire i tuoi preventivi</p>
    <div id="error" class="alert alert-error"></div>
    <form id="loginForm">
      <div class="field">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required placeholder="La tua email" autocomplete="email">
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required placeholder="La tua password" autocomplete="current-password">
      </div>
      <button type="submit" class="btn btn-primary">Accedi</button>
    </form>
    <p style="text-align:center;margin-top:12px"><a href="/auth/forgot" style="color:#9ca3af;font-size:.82rem;text-decoration:none">Password dimenticata?</a></p>
    <p class="auth-footer">
      Non hai un account? <a href="/auth/register">Registrati gratis</a>
    </p>
    <div class="back-link"><a href="/">&larr; Torna alla home</a></div>`,
    script: `
    document.getElementById('loginForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var errEl = document.getElementById('error');
      errEl.style.display = 'none';
      var btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Accesso in corso...';
      fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('email').value,
          password: document.getElementById('password').value
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          window.location.href = data.redirect || '/dashboard';
        } else {
          errEl.textContent = data.error || (data.errors && data.errors.join(', ')) || 'Errore';
          errEl.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Accedi';
        }
      })
      .catch(function() {
        errEl.textContent = 'Impossibile connettersi. Controlla la connessione e riprova.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Accedi';
      });
    });`
  }));
});

// ── GET /auth/register ──
router.get("/register", (req, res) => {
  res.send(authPage({
    title: "Registrazione",
    cardHtml: `
    <div class="auth-logo">
      <div class="auth-logo-icon">P</div>
      <span>Preventivo EASY</span>
    </div>
    <h1 class="auth-title">Inizia subito</h1>
    <p class="auth-sub">Crea preventivi professionali in pochi secondi <span class="free-badge">FREE &mdash; nessuna carta richiesta</span></p>
    <div id="error" class="alert alert-error"></div>
    <form id="registerForm">
      <div class="field">
        <label for="name">Nome completo</label>
        <input type="text" id="name" name="name" required placeholder="es. Mario Rossi" autocomplete="name">
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required placeholder="La tua email" autocomplete="email">
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required minlength="6" placeholder="Minimo 6 caratteri" autocomplete="new-password">
      </div>
      <div class="field">
        <label for="category">Categoria professionale</label>
        <input type="text" id="category" name="category" list="category-list" placeholder="es. Idraulico, Avvocato, Web Designer">
        <datalist id="category-list">
          <option value="Idraulico">
          <option value="Elettricista">
          <option value="Avvocato">
          <option value="Commercialista">
          <option value="Architetto">
          <option value="Geometra">
          <option value="Web Designer">
          <option value="Odontoiatra">
          <option value="Fisioterapista">
          <option value="Fotografo">
        </datalist>
        <div class="hint">Opzionale &mdash; puoi aggiungerla dopo nel profilo</div>
      </div>
      <div class="field">
        <label for="city">Citt&agrave;</label>
        <input type="text" id="city" name="city" placeholder="es. Milano" autocomplete="address-level2">
      </div>
      <button type="submit" class="btn btn-primary">Crea il tuo account gratuito</button>
    </form>
    <p class="auth-footer">
      Hai gi&agrave; un account? <a href="/auth/login">Accedi</a>
    </p>
    <div class="back-link"><a href="/">&larr; Torna alla home</a></div>`,
    script: `
    document.getElementById('registerForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var errEl = document.getElementById('error');
      errEl.style.display = 'none';
      var btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Creazione account...';
      fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('name').value,
          email: document.getElementById('email').value,
          password: document.getElementById('password').value,
          category: document.getElementById('category').value || undefined,
          city: document.getElementById('city').value || undefined
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          window.location.href = '/dashboard';
        } else {
          errEl.textContent = data.error || (data.errors && data.errors.join(', ')) || 'Errore';
          errEl.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Crea il tuo account gratuito';
        }
      })
      .catch(function() {
        errEl.textContent = 'Impossibile connettersi. Controlla la connessione e riprova.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Registrati gratis';
      });
    });`
  }));
});

// POST /auth/register
router.post("/register", async (req, res) => {
  const { email, password, name, category, city, plan } = req.body;

  const errors = [];
  if (!email) errors.push("Inserisci la tua email");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("L'email inserita non è valida");
  if (!password) errors.push("Inserisci una password");
  else if (password.length < 6) errors.push("La password deve avere almeno 6 caratteri");
  if (!name) errors.push("Inserisci il tuo nome");

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  if (getUserByEmail(email)) {
    return res.status(409).json({ success: false, error: "Esiste già un account con questa email. Prova ad accedere." });
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = {
    id: `u-${Date.now()}`,
    email,
    password_hash,
    name,
    category: category || null,
    city: city || null,
    plan: plan || "free",
    created_at: new Date().toISOString()
  };

  createUser(user);

  req.session.userId = user.id;

  const { password_hash: _, ...safeUser } = user;
  res.status(201).json({ success: true, user: safeUser });
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Inserisci email e password per accedere" });
  }

  const user = getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ success: false, error: "Email o password non corretti. Riprova." });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ success: false, error: "Email o password non corretti. Riprova." });
  }

  req.session.userId = user.id;

  const redirect = req.session.returnTo || "/dashboard";
  delete req.session.returnTo;

  const { password_hash: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser, redirect });
});

// GET /auth/forgot (placeholder)
router.get("/forgot", (req, res) => {
  res.send(authPage({
    title: "Password dimenticata",
    cardHtml: `
    <div class="auth-logo">
      <div class="auth-logo-icon">P</div>
      <span>Preventivo EASY</span>
    </div>
    <h1 class="auth-title">Password dimenticata?</h1>
    <p class="auth-sub">Questa funzionalit&agrave; sar&agrave; disponibile a breve. Nel frattempo, contattaci per assistenza.</p>
    <a href="mailto:support@preventivoeasy.it" class="btn btn-primary" style="text-decoration:none;display:block;text-align:center">Contattaci via email</a>
    <div class="back-link" style="margin-top:20px"><a href="/auth/login">&larr; Torna al login</a></div>`
  }));
});

// POST /auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ success: false, error: "Errore durante il logout" });
    res.clearCookie("connect.sid");
    res.json({ success: true, message: "Logout effettuato" });
  });
});

module.exports = router;
