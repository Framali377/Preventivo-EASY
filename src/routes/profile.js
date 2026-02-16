// src/routes/profile.js
const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const { getUserById, updateUser } = require("../utils/storage");
const { page, esc } = require("../utils/layout");

const SALT_ROUNDS = 10;

router.get("/", (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.redirect("/auth/login");

  const planLabel = (user.plan && user.plan !== "free") ? "PRO" : "FREE";

  const extraCss = `
    .profile-card{padding:32px}
    .profile-card h2{font-size:1.15rem;font-weight:700;margin-bottom:24px}
    .profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    @media(max-width:500px){.profile-grid{grid-template-columns:1fr}}
    .section-divider{border:none;border-top:1px solid #f0f0f0;margin:28px 0}
    .section-title{font-size:.82rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:18px}
    .plan-row{display:flex;align-items:center;justify-content:space-between;background:#f8f9fb;border-radius:8px;padding:16px 20px;margin-bottom:24px}
    .plan-label{font-size:.95rem;font-weight:600}
    .plan-badge{font-size:.72rem;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:.04em}
    .plan-free{background:#fff3cd;color:#856404}
    .plan-pro{background:#d4edda;color:#155724}
  `;

  const content = `
  <div class="wrap" style="max-width:600px">
    <div class="card profile-card">
      <h2>Il tuo profilo</h2>

      <div id="success" class="alert alert-success" style="display:none"></div>
      <div id="error" class="alert alert-error" style="display:none"></div>

      <!-- Piano -->
      <div class="plan-row">
        <div>
          <div class="plan-label">Piano attivo</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <span class="plan-badge ${planLabel === "PRO" ? "plan-pro" : "plan-free"}">${planLabel}</span>
          ${planLabel === "FREE" ? '<a href="/upgrade" class="link" style="font-size:.82rem">Passa a PRO</a>' : ""}
        </div>
      </div>

      <!-- Dati personali -->
      <div class="section-title">Dati personali</div>
      <form id="profileForm">
        <div class="profile-grid">
          <div class="field">
            <label for="name">Nome completo</label>
            <input type="text" id="name" value="${esc(user.name)}" required>
          </div>
          <div class="field">
            <label for="email">Email</label>
            <input type="email" id="email" value="${esc(user.email)}" disabled style="background:#f5f6f8;color:#888">
            <div class="hint">L'email non può essere modificata</div>
          </div>
          <div class="field">
            <label for="category">Categoria professionale</label>
            <input type="text" id="category" value="${esc(user.category || "")}" placeholder="es. Idraulico, Elettricista">
          </div>
          <div class="field">
            <label for="city">Città</label>
            <input type="text" id="city" value="${esc(user.city || "")}" placeholder="es. Milano">
          </div>
        </div>
        <button type="submit" class="btn btn-primary">Salva modifiche</button>
      </form>

      <hr class="section-divider">

      <!-- Cambio password -->
      <div class="section-title">Cambia password</div>
      <form id="passwordForm">
        <div class="profile-grid">
          <div class="field">
            <label for="currentPassword">Password attuale</label>
            <input type="password" id="currentPassword" placeholder="Inserisci la password attuale">
          </div>
          <div class="field">
            <label for="newPassword">Nuova password</label>
            <input type="password" id="newPassword" placeholder="Minimo 6 caratteri" minlength="6">
          </div>
        </div>
        <button type="submit" class="btn btn-secondary">Aggiorna password</button>
      </form>

    </div>
  </div>`;

  const script = `
  (function() {
    var successEl = document.getElementById('success');
    var errorEl = document.getElementById('error');

    function showMsg(type, msg) {
      successEl.style.display = 'none';
      errorEl.style.display = 'none';
      if (type === 'success') {
        successEl.textContent = msg;
        successEl.style.display = 'block';
      } else {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.getElementById('profileForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var body = {
        name: document.getElementById('name').value.trim(),
        category: document.getElementById('category').value.trim(),
        city: document.getElementById('city').value.trim()
      };
      if (!body.name) { showMsg('error', 'Il nome è obbligatorio'); return; }

      fetch('/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) showMsg('success', 'Profilo aggiornato');
        else showMsg('error', data.error || 'Errore');
      })
      .catch(function() { showMsg('error', 'Errore di rete'); });
    });

    document.getElementById('passwordForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var current = document.getElementById('currentPassword').value;
      var newPwd = document.getElementById('newPassword').value;
      if (!current || !newPwd) { showMsg('error', 'Compila entrambi i campi password'); return; }
      if (newPwd.length < 6) { showMsg('error', 'La nuova password deve avere almeno 6 caratteri'); return; }

      fetch('/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: newPwd })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          showMsg('success', 'Password aggiornata');
          document.getElementById('currentPassword').value = '';
          document.getElementById('newPassword').value = '';
        } else {
          showMsg('error', data.error || 'Errore');
        }
      })
      .catch(function() { showMsg('error', 'Errore di rete'); });
    });
  })();`;

  res.send(page({ title: "Profilo", user, content, extraCss, script, activePage: "profile" }));
});

// POST /profile — aggiorna dati
router.post("/", (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.status(401).json({ success: false, error: "Sessione non valida" });

  const { name, category, city } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: "Il nome è obbligatorio" });
  }

  const updated = updateUser(user.id, {
    name: name.trim(),
    category: (category || "").trim() || null,
    city: (city || "").trim() || null
  });

  if (!updated) return res.status(500).json({ success: false, error: "Errore durante l'aggiornamento" });
  res.json({ success: true });
});

// POST /profile/password — cambia password
router.post("/password", async (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.status(401).json({ success: false, error: "Sessione non valida" });

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: "Compila entrambi i campi" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, error: "La nuova password deve avere almeno 6 caratteri" });
  }

  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) {
    return res.status(401).json({ success: false, error: "Password attuale non corretta" });
  }

  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  updateUser(user.id, { password_hash });

  res.json({ success: true });
});

module.exports = router;
