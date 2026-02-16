// src/routes/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const { createUser, getUserByEmail } = require("../utils/storage");
const { page } = require("../utils/layout");

const SALT_ROUNDS = 10;

// ── GET /auth/login ──
router.get("/login", (req, res) => {
  const html = page({
    title: "Login",
    content: `
  <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px">
    <div class="card" style="padding:40px;max-width:420px;width:100%">
      <h1 style="font-size:1.4rem;margin-bottom:4px;text-align:center">Preventivo AI</h1>
      <p style="text-align:center;color:#888;font-size:.88rem;margin-bottom:28px">Accedi al tuo account</p>
      <div id="error" class="alert alert-error" style="display:none"></div>
      <form id="loginForm">
        <div class="field">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required placeholder="La tua email">
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required placeholder="La tua password">
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%">Accedi</button>
      </form>
      <p style="text-align:center;margin-top:20px;font-size:.85rem;color:#888">
        Non hai un account? <a href="/auth/register" class="link">Registrati</a>
      </p>
    </div>
  </div>`,
    script: `
    document.getElementById('loginForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var errEl = document.getElementById('error');
      errEl.style.display = 'none';
      var body = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
      };
      fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          window.location.href = '/dashboard';
        } else {
          errEl.textContent = data.error || data.errors.join(', ');
          errEl.style.display = 'block';
        }
      })
      .catch(function() {
        errEl.textContent = 'Errore di rete';
        errEl.style.display = 'block';
      });
    });`
  });
  res.send(html);
});

// ── GET /auth/register ──
router.get("/register", (req, res) => {
  const html = page({
    title: "Registrazione",
    content: `
  <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px">
    <div class="card" style="padding:40px;max-width:480px;width:100%">
      <h1 style="font-size:1.4rem;margin-bottom:4px;text-align:center">Preventivo AI</h1>
      <p style="text-align:center;color:#888;font-size:.88rem;margin-bottom:28px">Crea il tuo account</p>
      <div id="error" class="alert alert-error" style="display:none"></div>
      <form id="registerForm">
        <div class="field">
          <label for="name">Nome completo</label>
          <input type="text" id="name" name="name" required placeholder="es. Mario Rossi">
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required placeholder="La tua email">
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required minlength="6" placeholder="Minimo 6 caratteri">
        </div>
        <div class="field">
          <label for="category">Categoria professionale</label>
          <input type="text" id="category" name="category" placeholder="es. Idraulico, Elettricista, Architetto">
        </div>
        <div class="field">
          <label for="city">Citta</label>
          <input type="text" id="city" name="city" placeholder="es. Milano">
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%">Registrati</button>
      </form>
      <p style="text-align:center;margin-top:20px;font-size:.85rem;color:#888">
        Hai gia un account? <a href="/auth/login" class="link">Accedi</a>
      </p>
    </div>
  </div>`,
    script: `
    document.getElementById('registerForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var errEl = document.getElementById('error');
      errEl.style.display = 'none';
      var body = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        category: document.getElementById('category').value || undefined,
        city: document.getElementById('city').value || undefined
      };
      fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          window.location.href = '/dashboard';
        } else {
          errEl.textContent = data.error || data.errors.join(', ');
          errEl.style.display = 'block';
        }
      })
      .catch(function() {
        errEl.textContent = 'Errore di rete';
        errEl.style.display = 'block';
      });
    });`
  });
  res.send(html);
});

// POST /auth/register
router.post("/register", async (req, res) => {
  const { email, password, name, category, city, plan } = req.body;

  const errors = [];
  if (!email) errors.push("email è obbligatorio");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("email non valido");
  if (!password) errors.push("password è obbligatorio");
  else if (password.length < 6) errors.push("password deve avere almeno 6 caratteri");
  if (!name) errors.push("name è obbligatorio");

  if (errors.length) {
    return res.status(400).json({ success: false, errors });
  }

  if (getUserByEmail(email)) {
    return res.status(409).json({ success: false, error: "Email già registrata" });
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
    return res.status(400).json({ success: false, error: "email e password sono obbligatori" });
  }

  const user = getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ success: false, error: "Credenziali non valide" });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ success: false, error: "Credenziali non valide" });
  }

  req.session.userId = user.id;

  const { password_hash: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
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
