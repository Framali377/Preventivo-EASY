// src/routes/admin.js
const express = require("express");
const router = express.Router();
const { loadUsers, getUserById, updateUser, getQuoteCountByUser } = require("../utils/storage");
const { getActiveSubscriberCount, EARLY_BIRD_LIMIT } = require("../utils/stripe");
const { page, esc, planInfo } = require("../utils/layout");
const requireAuth = require("../middleware/requireAuth");
const requireAdmin = require("../middleware/requireAdmin");

router.use(requireAuth, requireAdmin);

// ─── GET /admin ───
router.get("/", (req, res) => {
  const admin = getUserById(req.session.userId);
  const users = loadUsers();
  const activeCount = getActiveSubscriberCount();
  const earlyRemaining = Math.max(0, EARLY_BIRD_LIMIT - activeCount);

  const rows = users.map(u => {
    const pi = planInfo(u);
    const quotes = getQuoteCountByUser(u.id);
    const status = u.subscription_status || "\u2014";
    const disabled = u.disabled ? "yes" : "";
    const isAdmin = u.role === "admin";

    return `<tr class="${disabled ? "row-disabled" : ""}">
      <td>${esc(u.email)}</td>
      <td>${esc(u.name)}</td>
      <td><span class="tb-badge ${pi.cls}">${pi.label}</span></td>
      <td>${esc(status)}</td>
      <td class="c">${quotes}</td>
      <td class="c">${u.credits || 0}</td>
      <td class="c">${disabled ? '<span style="color:#dc2626">Disattivo</span>' : '<span style="color:#22c55e">Attivo</span>'}</td>
      <td class="c">${isAdmin ? "" : `
        <select class="act-select" data-uid="${esc(u.id)}" data-action="plan">
          <option value="">Piano...</option>
          <option value="free">Free</option>
          <option value="early">Early Bird</option>
          <option value="standard">Standard</option>
        </select>
        <button class="act-btn ${disabled ? "act-enable" : "act-disable"}" data-uid="${esc(u.id)}" data-action="${disabled ? "enable" : "disable"}">
          ${disabled ? "Attiva" : "Disattiva"}
        </button>`}
      </td>
    </tr>`;
  }).join("");

  const extraCss = `
    .admin-wrap{max-width:1100px}
    .admin-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:24px}
    .admin-header h2{font-size:1.2rem;font-weight:700}
    .admin-stats{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px}
    .admin-stat{background:#fff;border-radius:10px;padding:16px 22px;box-shadow:0 1px 3px rgba(0,0,0,.04);min-width:140px}
    .admin-stat .as-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:4px}
    .admin-stat .as-value{font-size:1.4rem;font-weight:700}
    .admin-table{background:#fff;border-radius:12px;box-shadow:0 1px 6px rgba(0,0,0,.05);overflow-x:auto}
    .admin-table table{min-width:800px}
    .tb-badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:.72rem;font-weight:600}
    .row-disabled{opacity:.5}
    .act-select{padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:.78rem;font-family:inherit;cursor:pointer}
    .act-btn{padding:4px 12px;border-radius:6px;font-size:.76rem;font-weight:500;cursor:pointer;border:1px solid #d1d5db;background:#fff;transition:all .15s}
    .act-disable{color:#dc2626;border-color:#fca5a5}
    .act-disable:hover{background:#fef2f2}
    .act-enable{color:#22c55e;border-color:#a7f3d0}
    .act-enable:hover{background:#ecfdf5}
    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:10px 24px;border-radius:8px;font-size:.85rem;opacity:0;transition:opacity .3s;pointer-events:none;z-index:100}
    .toast.show{opacity:1}
  `;

  const content = `
  <div class="wrap admin-wrap">
    <div class="admin-header">
      <h2>Admin Dashboard</h2>
    </div>

    <div class="admin-stats">
      <div class="admin-stat">
        <div class="as-label">Utenti totali</div>
        <div class="as-value">${users.length}</div>
      </div>
      <div class="admin-stat">
        <div class="as-label">Abbonati attivi</div>
        <div class="as-value">${activeCount}</div>
      </div>
      <div class="admin-stat">
        <div class="as-label">Early Bird rimasti</div>
        <div class="as-value">${earlyRemaining} / ${EARLY_BIRD_LIMIT}</div>
      </div>
      <div class="admin-stat">
        <div class="as-label">Utenti Free</div>
        <div class="as-value">${users.filter(u => !u.plan || u.plan === "free").length}</div>
      </div>
    </div>

    <div class="admin-table">
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Nome</th>
            <th>Piano</th>
            <th>Subscription</th>
            <th class="c">Preventivi</th>
            <th class="c">Crediti</th>
            <th class="c">Stato</th>
            <th class="c">Azioni</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
  <div class="toast" id="toast"></div>`;

  const script = `
  (function() {
    // Plan upgrade via select
    document.querySelectorAll('.act-select').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var uid = this.dataset.uid;
        var plan = this.value;
        if (!plan) return;
        this.disabled = true;
        fetch('/admin/user/' + uid + '/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: plan })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.success) {
            showToast('Piano aggiornato a ' + plan);
            setTimeout(function() { location.reload(); }, 800);
          } else {
            showToast(data.error || 'Errore');
            sel.disabled = false;
          }
        })
        .catch(function() { showToast('Errore di rete'); sel.disabled = false; });
        this.value = '';
      });
    });

    // Disable/Enable buttons
    document.querySelectorAll('.act-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var uid = this.dataset.uid;
        var action = this.dataset.action;
        this.disabled = true;
        fetch('/admin/user/' + uid + '/' + action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.success) {
            showToast(action === 'disable' ? 'Utente disattivato' : 'Utente riattivato');
            setTimeout(function() { location.reload(); }, 800);
          } else {
            showToast(data.error || 'Errore');
            btn.disabled = false;
          }
        })
        .catch(function() { showToast('Errore di rete'); btn.disabled = false; });
      });
    });

    function showToast(msg) {
      var t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(function() { t.classList.remove('show'); }, 2500);
    }
  })();`;

  res.send(page({ title: "Admin", user: admin, content, extraCss, script }));
});

// ─── POST /admin/user/:id/plan ───
router.post("/user/:id/plan", (req, res) => {
  const { plan } = req.body;
  if (!["free", "early", "standard"].includes(plan)) {
    return res.status(400).json({ success: false, error: "Piano non valido" });
  }

  const target = getUserById(req.params.id);
  if (!target) return res.status(404).json({ success: false, error: "Utente non trovato" });

  const updates = { plan };
  if (plan === "free") {
    updates.subscription_status = null;
    updates.subscription_id = null;
  } else {
    updates.subscription_status = "active";
  }

  updateUser(req.params.id, updates);
  res.json({ success: true });
});

// ─── POST /admin/user/:id/disable ───
router.post("/user/:id/disable", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) return res.status(404).json({ success: false, error: "Utente non trovato" });
  if (target.role === "admin") return res.status(403).json({ success: false, error: "Non puoi disattivare un admin" });

  updateUser(req.params.id, { disabled: true });
  res.json({ success: true });
});

// ─── POST /admin/user/:id/enable ───
router.post("/user/:id/enable", (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) return res.status(404).json({ success: false, error: "Utente non trovato" });

  updateUser(req.params.id, { disabled: false });
  res.json({ success: true });
});

module.exports = router;
