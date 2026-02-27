// src/routes/admin.js
const express = require("express");
const router = express.Router();
const { loadUsers, getUserById, updateUser, getQuoteCountByUser, loadQuotes, getQuoteById, updateQuote } = require("../utils/storage");
const { getActiveSubscriberCount, EARLY_BIRD_LIMIT } = require("../utils/stripe");
const { page, esc, fmt, planInfo } = require("../utils/layout");
const { loadEmailLog, testSmtp, sendOrLog, sendTestEmail, getSmtpConfig, isAvailable: smtpAvailable } = require("../utils/mailer");
const { buildQuoteEmailHTML } = require("../utils/emailTemplates");
const requireAuth = require("../middleware/requireAuth");
const requireAdmin = require("../middleware/requireAdmin");
const fs = require("fs");
const path = require("path");

router.use(requireAuth, requireAdmin);

// ─── Shared CSS for all admin pages ───
const ADMIN_CSS = `
    .admin-wrap{max-width:1200px}
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
    .act-credits{color:#0d9488;border-color:#5eead4}
    .act-credits:hover{background:#f0fdfa}
    .credits-input{padding:4px 6px;border:1px solid #d1d5db;border-radius:6px;font-size:.78rem;font-family:inherit}
    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1c1917;color:#fff;padding:10px 24px;border-radius:8px;font-size:.85rem;opacity:0;transition:opacity .3s;pointer-events:none;z-index:100}
    .toast.show{opacity:1}

    /* Tab navigation */
    .admin-tabs{display:flex;gap:4px;margin-bottom:28px;border-bottom:2px solid #e5e7eb;padding-bottom:0}
    .admin-tab{padding:10px 20px;font-size:.84rem;font-weight:600;color:#6b7280;text-decoration:none;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s}
    .admin-tab:hover{color:#1c1917;background:#f9fafb}
    .admin-tab.active{color:#0d9488;border-bottom-color:#0d9488}

    /* KPI cards */
    .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:28px}
    .kpi-card{background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
    .kpi-card .kpi-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:6px}
    .kpi-card .kpi-value{font-size:1.8rem;font-weight:700;color:#1c1917}
    .kpi-card .kpi-sub{font-size:.78rem;color:#6b7280;margin-top:4px}

    /* Email badges */
    .email-badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:.68rem;font-weight:600}
    .email-sent{background:#ecfdf5;color:#065f46}
    .email-failed{background:#fef2f2;color:#dc2626}
    .email-logged{background:#fffbeb;color:#92400e}

    /* Status badges */
    .status-badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:.72rem;font-weight:600}

    /* Filters */
    .filters{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;align-items:flex-end}
    .filter-group{display:flex;flex-direction:column;gap:4px}
    .filter-group label{font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#9ca3af}
    .filter-group select,.filter-group input{padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:.82rem;font-family:inherit}
    .filter-btn{padding:6px 16px;border:1px solid #d1d5db;border-radius:6px;font-size:.82rem;font-weight:500;cursor:pointer;background:#fff;transition:all .15s}
    .filter-btn:hover{background:#f9fafb}

    /* Health card */
    .health-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}
    .health-card{background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
    .health-card h3{font-size:.9rem;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px}
    .health-item{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:.84rem}
    .health-item:last-child{border-bottom:none}
    .health-ok{color:#065f46;font-weight:600}
    .health-err{color:#dc2626;font-weight:600}
`;

function adminNav(activeTab) {
  const tabs = [
    { key: "users", label: "Utenti", href: "/admin" },
    { key: "quotes", label: "Preventivi", href: "/admin/quotes" },
    { key: "emails", label: "Email Log", href: "/admin/emails" },
    { key: "revenue", label: "Revenue", href: "/admin/revenue" },
    { key: "health", label: "Sistema", href: "/admin/health" }
  ];
  return `<div class="admin-tabs">${tabs.map(t =>
    `<a href="${t.href}" class="admin-tab${activeTab === t.key ? ' active' : ''}">${t.label}</a>`
  ).join("")}</div>`;
}

const STATUS_COLORS = {
  draft:          { bg: "#fff3cd", color: "#856404" },
  sent:           { bg: "#cce5ff", color: "#004085" },
  accepted:       { bg: "#d4edda", color: "#155724" },
  acconto_pagato: { bg: "#b8daff", color: "#004085" },
  rejected:       { bg: "#f8d7da", color: "#721c24" },
  expired:        { bg: "#e2e3e5", color: "#383d41" }
};

function statusBadge(status) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.draft;
  const labels = { draft: "Bozza", sent: "Inviato", accepted: "Accettato", acconto_pagato: "Acconto", rejected: "Rifiutato", expired: "Scaduto" };
  return `<span class="status-badge" style="background:${s.bg};color:${s.color}">${labels[status] || status}</span>`;
}

function emailBadge(emailStatus) {
  if (emailStatus === "sent") return '<span class="email-badge email-sent">Inviata</span>';
  if (emailStatus === "failed") return '<span class="email-badge email-failed">Fallita</span>';
  if (emailStatus === "logged") return '<span class="email-badge email-logged">Locale</span>';
  return '<span class="email-badge" style="background:#f3f4f6;color:#9ca3af">N/A</span>';
}

// ─── GET /admin — Utenti ───
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
      <td><a href="/admin/user/${esc(u.id)}" class="link">${esc(u.email)}</a></td>
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
        <input type="number" class="credits-input" data-uid="${esc(u.id)}" placeholder="+crediti" min="1" max="100" style="width:70px">
        <button class="act-btn act-credits" data-uid="${esc(u.id)}" data-action="credits">+Crediti</button>
        <button class="act-btn ${disabled ? "act-enable" : "act-disable"}" data-uid="${esc(u.id)}" data-action="${disabled ? "enable" : "disable"}">
          ${disabled ? "Attiva" : "Disattiva"}
        </button>`}
      </td>
    </tr>`;
  }).join("");

  const content = `
  <div class="wrap admin-wrap">
    ${adminNav("users")}
    <div class="admin-header">
      <h2>Gestione Utenti</h2>
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

    document.querySelectorAll('.act-credits').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var uid = this.dataset.uid;
        var input = document.querySelector('.credits-input[data-uid="' + uid + '"]');
        var amount = parseInt(input.value) || 0;
        if (amount < 1) { showToast('Inserisci un numero di crediti'); return; }
        this.disabled = true;
        fetch('/admin/user/' + uid + '/credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: amount })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.success) {
            showToast('+' + amount + ' crediti aggiunti (totale: ' + data.credits + ')');
            setTimeout(function() { location.reload(); }, 800);
          } else {
            showToast(data.error || 'Errore');
            btn.disabled = false;
          }
        })
        .catch(function() { showToast('Errore di rete'); btn.disabled = false; });
      });
    });

    document.querySelectorAll('.act-btn:not(.act-credits)').forEach(function(btn) {
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

  res.send(page({ title: "Admin — Utenti", user: admin, content, extraCss: ADMIN_CSS, script, activePage: "admin" }));
});

// ─── GET /admin/quotes — Lista preventivi ───
router.get("/quotes", (req, res) => {
  const admin = getUserById(req.session.userId);
  const allQuotes = loadQuotes().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const users = loadUsers();
  const userMap = {};
  users.forEach(u => { userMap[u.id] = u; });

  // Filtri
  const filterUser = req.query.user || "";
  const filterStatus = req.query.status || "";
  const filterFrom = req.query.from || "";
  const filterTo = req.query.to || "";

  let filtered = allQuotes;
  if (filterUser) filtered = filtered.filter(q => q.user_id === filterUser || q.owner_user_id === filterUser);
  if (filterStatus) filtered = filtered.filter(q => q.status === filterStatus);
  if (filterFrom) filtered = filtered.filter(q => q.created_at >= filterFrom);
  if (filterTo) filtered = filtered.filter(q => q.created_at <= filterTo + "T23:59:59");

  const userOptions = users.map(u => `<option value="${esc(u.id)}"${filterUser === u.id ? " selected" : ""}>${esc(u.name)} (${esc(u.email)})</option>`).join("");

  const rows = filtered.map(q => {
    const owner = userMap[q.user_id] || userMap[q.owner_user_id];
    const date = new Date(q.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
    const clientName = q.client?.name || "—";
    const resendBtn = (q.email_status === "failed" || q.email_status === "logged")
      ? `<button class="act-btn" onclick="resendQuote('${esc(q.quote_id)}', this)" style="font-size:.72rem">Reinvia</button>`
      : "";

    return `<tr>
      <td style="font-size:.78rem;font-family:monospace">${esc(q.quote_id).slice(0, 12)}</td>
      <td>${esc(clientName)}</td>
      <td>${owner ? esc(owner.name) : "—"}</td>
      <td class="r">${fmt(q.total || 0)} &euro;</td>
      <td>${statusBadge(q.status)}</td>
      <td>${emailBadge(q.email_status)}</td>
      <td>${date}</td>
      <td>${resendBtn}</td>
    </tr>`;
  }).join("");

  const content = `
  <div class="wrap admin-wrap">
    ${adminNav("quotes")}
    <div class="admin-header">
      <h2>Tutti i preventivi</h2>
      <span style="color:#9ca3af;font-size:.84rem">${filtered.length} risultati</span>
    </div>

    <form class="filters" method="GET" action="/admin/quotes">
      <div class="filter-group">
        <label>Utente</label>
        <select name="user"><option value="">Tutti</option>${userOptions}</select>
      </div>
      <div class="filter-group">
        <label>Stato</label>
        <select name="status">
          <option value="">Tutti</option>
          <option value="draft"${filterStatus === "draft" ? " selected" : ""}>Bozza</option>
          <option value="sent"${filterStatus === "sent" ? " selected" : ""}>Inviato</option>
          <option value="accepted"${filterStatus === "accepted" ? " selected" : ""}>Accettato</option>
          <option value="acconto_pagato"${filterStatus === "acconto_pagato" ? " selected" : ""}>Acconto</option>
          <option value="rejected"${filterStatus === "rejected" ? " selected" : ""}>Rifiutato</option>
          <option value="expired"${filterStatus === "expired" ? " selected" : ""}>Scaduto</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Da</label>
        <input type="date" name="from" value="${esc(filterFrom)}">
      </div>
      <div class="filter-group">
        <label>A</label>
        <input type="date" name="to" value="${esc(filterTo)}">
      </div>
      <button type="submit" class="filter-btn">Filtra</button>
    </form>

    <div class="admin-table">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Cliente</th>
            <th>Professionista</th>
            <th class="r">Totale</th>
            <th>Stato</th>
            <th>Email</th>
            <th>Data</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="8" class="c" style="padding:32px;color:#9ca3af">Nessun preventivo trovato</td></tr>'}</tbody>
      </table>
    </div>
  </div>
  <div class="toast" id="toast"></div>`;

  const script = `
  (function() {
    window.resendQuote = function(id, btn) {
      btn.disabled = true;
      btn.textContent = 'Invio...';
      fetch('/admin/quotes/' + id + '/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        showToast(data.success ? 'Email reinviata' : (data.error || 'Errore'));
        if (data.success) setTimeout(function() { location.reload(); }, 1000);
        else { btn.disabled = false; btn.textContent = 'Reinvia'; }
      })
      .catch(function() { showToast('Errore di rete'); btn.disabled = false; btn.textContent = 'Reinvia'; });
    };
    function showToast(msg) {
      var t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(function() { t.classList.remove('show'); }, 2500);
    }
  })();`;

  res.send(page({ title: "Admin — Preventivi", user: admin, content, extraCss: ADMIN_CSS, script, activePage: "admin" }));
});

// ─── GET /admin/emails — Email log ───
router.get("/emails", (req, res) => {
  const admin = getUserById(req.session.userId);
  const logs = loadEmailLog().reverse();

  const rows = logs.map(entry => {
    const ts = new Date(entry.timestamp).toLocaleString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const resultBadge = entry.result === "sent"
      ? '<span class="email-badge email-sent">Inviata</span>'
      : entry.result === "failed"
        ? '<span class="email-badge email-failed">Fallita</span>'
        : '<span class="email-badge email-logged">Locale</span>';

    return `<tr>
      <td style="font-size:.82rem">${ts}</td>
      <td style="font-size:.78rem;font-family:monospace">${esc((entry.quote_id || "").slice(0, 12))}</td>
      <td>${esc(entry.to || "—")}</td>
      <td>${esc(entry.subject || "—")}</td>
      <td>${resultBadge}</td>
      <td style="font-size:.78rem;color:#dc2626">${esc(entry.error || "")}</td>
    </tr>`;
  }).join("");

  const content = `
  <div class="wrap admin-wrap">
    ${adminNav("emails")}
    <div class="admin-header">
      <h2>Log Email</h2>
      <span style="color:#9ca3af;font-size:.84rem">${logs.length} record</span>
    </div>

    <div class="admin-stats">
      <div class="admin-stat">
        <div class="as-label">Inviate</div>
        <div class="as-value" style="color:#065f46">${logs.filter(l => l.result === "sent").length}</div>
      </div>
      <div class="admin-stat">
        <div class="as-label">Fallite</div>
        <div class="as-value" style="color:#dc2626">${logs.filter(l => l.result === "failed").length}</div>
      </div>
      <div class="admin-stat">
        <div class="as-label">Locali</div>
        <div class="as-value" style="color:#92400e">${logs.filter(l => l.result === "logged").length}</div>
      </div>
    </div>

    <div class="admin-table">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Quote ID</th>
            <th>Destinatario</th>
            <th>Oggetto</th>
            <th>Risultato</th>
            <th>Errore</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="6" class="c" style="padding:32px;color:#9ca3af">Nessuna email nel log</td></tr>'}</tbody>
      </table>
    </div>
  </div>`;

  res.send(page({ title: "Admin — Email Log", user: admin, content, extraCss: ADMIN_CSS, activePage: "admin" }));
});

// ─── GET /admin/revenue — Analytics fatturato ───
router.get("/revenue", (req, res) => {
  const admin = getUserById(req.session.userId);
  const allQuotes = loadQuotes();
  const users = loadUsers();
  const userMap = {};
  users.forEach(u => { userMap[u.id] = u; });

  // Solo quote accettate/acconto
  const accepted = allQuotes.filter(q => q.status === "accepted" || q.status === "acconto_pagato");
  const totalRevenue = accepted.reduce((s, q) => s + (q.total || 0), 0);
  const avgPerQuote = accepted.length > 0 ? totalRevenue / accepted.length : 0;
  const sentOrBetter = allQuotes.filter(q => ["sent", "accepted", "acconto_pagato", "rejected"].includes(q.status));
  const acceptanceRate = sentOrBetter.length > 0 ? Math.round((accepted.length / sentOrBetter.length) * 100) : 0;

  // Breakdown per mese
  const byMonth = {};
  accepted.forEach(q => {
    const d = new Date(q.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { count: 0, total: 0 };
    byMonth[key].count++;
    byMonth[key].total += q.total || 0;
  });
  const monthRows = Object.keys(byMonth).sort().reverse().map(m =>
    `<tr><td>${m}</td><td class="c">${byMonth[m].count}</td><td class="r">${fmt(byMonth[m].total)} &euro;</td><td class="r">${fmt(byMonth[m].total / byMonth[m].count)} &euro;</td></tr>`
  ).join("");

  // Breakdown per utente
  const byUser = {};
  accepted.forEach(q => {
    const uid = q.user_id || q.owner_user_id;
    if (!byUser[uid]) byUser[uid] = { count: 0, total: 0 };
    byUser[uid].count++;
    byUser[uid].total += q.total || 0;
  });
  const userRows = Object.keys(byUser).sort((a, b) => byUser[b].total - byUser[a].total).map(uid => {
    const u = userMap[uid];
    return `<tr>
      <td>${u ? `<a href="/admin/user/${esc(uid)}" class="link">${esc(u.name)}</a>` : esc(uid)}</td>
      <td class="c">${byUser[uid].count}</td>
      <td class="r">${fmt(byUser[uid].total)} &euro;</td>
      <td class="r">${fmt(byUser[uid].total / byUser[uid].count)} &euro;</td>
    </tr>`;
  }).join("");

  const content = `
  <div class="wrap admin-wrap">
    ${adminNav("revenue")}
    <div class="admin-header">
      <h2>Revenue Analytics</h2>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Fatturato totale</div>
        <div class="kpi-value">${fmt(totalRevenue)} &euro;</div>
        <div class="kpi-sub">${accepted.length} preventivi accettati</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Media per preventivo</div>
        <div class="kpi-value">${fmt(avgPerQuote)} &euro;</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Tasso accettazione</div>
        <div class="kpi-value">${acceptanceRate}%</div>
        <div class="kpi-sub">${accepted.length} / ${sentOrBetter.length} inviati</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Preventivi totali</div>
        <div class="kpi-value">${allQuotes.length}</div>
      </div>
    </div>

    <h3 style="font-size:.85rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:14px">Breakdown per mese</h3>
    <div class="admin-table" style="margin-bottom:32px">
      <table>
        <thead><tr><th>Mese</th><th class="c">Preventivi</th><th class="r">Fatturato</th><th class="r">Media</th></tr></thead>
        <tbody>${monthRows || '<tr><td colspan="4" class="c" style="padding:24px;color:#9ca3af">Nessun dato</td></tr>'}</tbody>
      </table>
    </div>

    <h3 style="font-size:.85rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:14px">Breakdown per utente</h3>
    <div class="admin-table">
      <table>
        <thead><tr><th>Utente</th><th class="c">Preventivi</th><th class="r">Fatturato</th><th class="r">Media</th></tr></thead>
        <tbody>${userRows || '<tr><td colspan="4" class="c" style="padding:24px;color:#9ca3af">Nessun dato</td></tr>'}</tbody>
      </table>
    </div>
  </div>`;

  res.send(page({ title: "Admin — Revenue", user: admin, content, extraCss: ADMIN_CSS, activePage: "admin" }));
});

// ─── GET /admin/user/:id — Dettaglio utente ───
router.get("/user/:id", (req, res) => {
  const admin = getUserById(req.session.userId);
  const target = getUserById(req.params.id);
  if (!target) return res.status(404).send(page({ title: "Utente non trovato", user: admin, content: '<div class="wrap"><div class="alert alert-error">Utente non trovato</div></div>', extraCss: ADMIN_CSS, activePage: "admin" }));

  const pi = planInfo(target);
  const allQuotes = loadQuotes().filter(q => q.user_id === target.id || q.owner_user_id === target.id);
  const accepted = allQuotes.filter(q => q.status === "accepted" || q.status === "acconto_pagato");
  const totalRevenue = accepted.reduce((s, q) => s + (q.total || 0), 0);
  const createdAt = target.created_at ? new Date(target.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }) : "—";

  const quoteRows = allQuotes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(q => {
    const date = new Date(q.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
    return `<tr>
      <td style="font-size:.78rem;font-family:monospace">${esc(q.quote_id).slice(0, 12)}</td>
      <td>${esc(q.client?.name || "—")}</td>
      <td class="r">${fmt(q.total || 0)} &euro;</td>
      <td>${statusBadge(q.status)}</td>
      <td>${emailBadge(q.email_status)}</td>
      <td>${date}</td>
    </tr>`;
  }).join("");

  const content = `
  <div class="wrap admin-wrap">
    ${adminNav("users")}
    <div style="margin-bottom:8px"><a href="/admin" class="link" style="font-size:.82rem">&larr; Torna agli utenti</a></div>

    <div class="admin-header">
      <h2>${esc(target.name)}</h2>
      <span class="tb-badge ${pi.cls}">${pi.label}</span>
    </div>

    <div class="kpi-grid" style="margin-bottom:32px">
      <div class="kpi-card">
        <div class="kpi-label">Email</div>
        <div style="font-size:.95rem;font-weight:500;word-break:break-all">${esc(target.email)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Registrato il</div>
        <div style="font-size:.95rem;font-weight:500">${createdAt}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Crediti</div>
        <div class="kpi-value">${target.credits || 0}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Stato</div>
        <div style="font-size:.95rem;font-weight:600;color:${target.disabled ? '#dc2626' : '#22c55e'}">${target.disabled ? "Disattivato" : "Attivo"}</div>
      </div>
    </div>

    <div class="admin-stats">
      <div class="admin-stat">
        <div class="as-label">Preventivi totali</div>
        <div class="as-value">${allQuotes.length}</div>
      </div>
      <div class="admin-stat">
        <div class="as-label">Accettati</div>
        <div class="as-value">${accepted.length}</div>
      </div>
      <div class="admin-stat">
        <div class="as-label">Fatturato</div>
        <div class="as-value">${fmt(totalRevenue)} &euro;</div>
      </div>
    </div>

    <h3 style="font-size:.85rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:14px">Preventivi dell'utente</h3>
    <div class="admin-table" style="margin-bottom:24px">
      <table>
        <thead><tr><th>ID</th><th>Cliente</th><th class="r">Totale</th><th>Stato</th><th>Email</th><th>Data</th></tr></thead>
        <tbody>${quoteRows || '<tr><td colspan="6" class="c" style="padding:24px;color:#9ca3af">Nessun preventivo</td></tr>'}</tbody>
      </table>
    </div>

    <h3 style="font-size:.85rem;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:14px">Azioni</h3>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <select class="act-select" id="planSelect">
        <option value="">Cambia piano...</option>
        <option value="free">Free</option>
        <option value="early">Early Bird</option>
        <option value="standard">Standard</option>
      </select>
      <div style="display:flex;gap:6px;align-items:center">
        <input type="number" class="credits-input" id="creditsInput" placeholder="+crediti" min="1" max="100" style="width:80px">
        <button class="act-btn act-credits" id="addCreditsBtn">+Crediti</button>
      </div>
      <button class="act-btn ${target.disabled ? 'act-enable' : 'act-disable'}" id="toggleBtn">${target.disabled ? 'Attiva utente' : 'Disattiva utente'}</button>
    </div>
  </div>
  <div class="toast" id="toast"></div>`;

  const script = `
  (function() {
    var uid = '${esc(target.id)}';
    document.getElementById('planSelect').addEventListener('change', function() {
      var plan = this.value;
      if (!plan) return;
      this.disabled = true;
      fetch('/admin/user/' + uid + '/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: plan }) })
      .then(function(r) { return r.json(); })
      .then(function(data) { showToast(data.success ? 'Piano aggiornato' : (data.error || 'Errore')); if (data.success) setTimeout(function(){ location.reload(); }, 800); })
      .catch(function() { showToast('Errore di rete'); });
    });
    document.getElementById('addCreditsBtn').addEventListener('click', function() {
      var amount = parseInt(document.getElementById('creditsInput').value) || 0;
      if (amount < 1) { showToast('Inserisci un numero di crediti'); return; }
      this.disabled = true;
      fetch('/admin/user/' + uid + '/credits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: amount }) })
      .then(function(r) { return r.json(); })
      .then(function(data) { showToast(data.success ? '+' + amount + ' crediti (totale: ' + data.credits + ')' : (data.error || 'Errore')); if (data.success) setTimeout(function(){ location.reload(); }, 800); })
      .catch(function() { showToast('Errore di rete'); });
    });
    document.getElementById('toggleBtn').addEventListener('click', function() {
      var action = '${target.disabled ? "enable" : "disable"}';
      this.disabled = true;
      fetch('/admin/user/' + uid + '/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      .then(function(r) { return r.json(); })
      .then(function(data) { showToast(data.success ? (action === 'disable' ? 'Disattivato' : 'Riattivato') : (data.error || 'Errore')); if (data.success) setTimeout(function(){ location.reload(); }, 800); })
      .catch(function() { showToast('Errore di rete'); });
    });
    function showToast(msg) {
      var t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(function() { t.classList.remove('show'); }, 2500);
    }
  })();`;

  res.send(page({ title: "Admin — " + target.name, user: admin, content, extraCss: ADMIN_CSS, script, activePage: "admin" }));
});

// ─── GET /admin/health — Stato sistema ───
router.get("/health", async (req, res) => {
  const admin = getUserById(req.session.userId);

  // SMTP status
  const smtpResult = await testSmtp();
  const smtpConfig = getSmtpConfig();

  // Storage stats
  const quotesPath = path.join(__dirname, "..", "data", "quotes.json");
  const usersPath = path.join(__dirname, "..", "data", "users.json");
  let quotesSize = "—", usersSize = "—";
  let quotesCount = 0, usersCount = 0;
  try {
    const qs = fs.statSync(quotesPath);
    quotesSize = (qs.size / 1024).toFixed(1) + " KB";
    quotesCount = loadQuotes().length;
  } catch {}
  try {
    const us = fs.statSync(usersPath);
    usersSize = (us.size / 1024).toFixed(1) + " KB";
    usersCount = loadUsers().length;
  } catch {}

  const emailLogs = loadEmailLog();
  const sentCount = emailLogs.filter(l => l.result === "sent").length;
  const failedCount = emailLogs.filter(l => l.result === "failed").length;
  const loggedCount = emailLogs.filter(l => l.result === "logged").length;

  const smtpConfigured = smtpAvailable();

  const content = `
  <div class="wrap admin-wrap">
    ${adminNav("health")}
    <div class="admin-header">
      <h2>Stato Sistema</h2>
    </div>

    <div class="health-grid">
      <div class="health-card">
        <h3>&#128233; SMTP Email</h3>
        <div class="health-item"><span>SMTP_HOST</span><span class="${smtpConfig.host ? 'health-ok' : 'health-err'}">${esc(smtpConfig.host || "NON IMPOSTATO")}</span></div>
        <div class="health-item"><span>SMTP_PORT</span><span>${smtpConfig.port}</span></div>
        <div class="health-item"><span>SMTP_USER</span><span class="${smtpConfig.user ? 'health-ok' : 'health-err'}">${esc(smtpConfig.user || "NON IMPOSTATO")}</span></div>
        <div class="health-item"><span>SMTP_PASS</span><span class="${smtpConfig.pass ? 'health-ok' : 'health-err'}">${smtpConfig.pass || "NON IMPOSTATO"}</span></div>
        <div class="health-item"><span>Secure (TLS)</span><span>${smtpConfig.secure ? 'Si (465)' : 'No (STARTTLS)'}</span></div>
        <div class="health-item" style="border-top:2px solid #e5e7eb;padding-top:12px;margin-top:4px"><span><strong>Test connessione</strong></span><span class="${smtpResult.ok ? 'health-ok' : 'health-err'}" style="font-size:.88rem">${smtpResult.ok ? 'CONNESSO' : esc(smtpResult.error)}</span></div>

        ${!smtpConfigured ? `
        <div style="margin-top:16px;padding:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:.82rem;color:#92400e;line-height:1.5">
          <strong>SMTP non configurato.</strong> Aggiungi al file <code>.env</code>:<br>
          <code style="display:block;margin-top:8px;padding:8px;background:#fff;border-radius:4px;font-size:.78rem;color:#1c1917">
            SMTP_HOST=smtp.gmail.com<br>
            SMTP_PORT=587<br>
            SMTP_USER=tua@email.com<br>
            SMTP_PASS=password-app<br>
          </code>
          <div style="margin-top:8px;font-size:.78rem">Per Gmail: attiva <strong>Password per le app</strong> nelle impostazioni Google.</div>
        </div>` : ''}

        <div style="margin-top:16px;padding:12px;border-radius:8px;background:${smtpConfigured ? (smtpResult.ok ? '#ecfdf5' : '#fef2f2') : '#fffbeb'};border:1px solid ${smtpConfigured ? (smtpResult.ok ? '#a7f3d0' : '#fca5a5') : '#fde68a'}">
          <span style="font-size:.88rem;font-weight:600;color:${smtpConfigured ? (smtpResult.ok ? '#065f46' : '#dc2626') : '#92400e'}">
            ${smtpConfigured ? (smtpResult.ok ? 'SMTP ATTIVO — Connessione OK' : 'SMTP CONFIGURATO — Connessione fallita') : 'SMTP NON CONFIGURATO'}
          </span>
        </div>

        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="act-btn" id="testSmtpBtn" style="padding:8px 16px;font-size:.82rem" ${!smtpConfigured ? 'disabled style="opacity:.5"' : ''}>Test connessione SMTP</button>
          <button class="act-btn" id="sendTestBtn" style="padding:8px 16px;font-size:.82rem;color:#0d9488;border-color:#5eead4" ${!smtpConfigured ? 'disabled style="opacity:.5"' : ''}>Invia email di test (admin)</button>
        </div>
        <div id="smtpTestResult" style="margin-top:10px;font-size:.82rem;display:none"></div>

        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb">
          <h4 style="font-size:.82rem;font-weight:600;margin-bottom:10px;color:#374151">Invia email manuale</h4>
          <div style="display:flex;flex-direction:column;gap:8px">
            <input type="email" id="manualTo" placeholder="destinatario@email.com" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:.82rem;font-family:inherit" ${!smtpConfigured ? 'disabled' : ''}>
            <input type="text" id="manualSubject" placeholder="Oggetto (opzionale)" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:.82rem;font-family:inherit" ${!smtpConfigured ? 'disabled' : ''}>
            <textarea id="manualBody" placeholder="Testo email (opzionale)" rows="2" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:.82rem;font-family:inherit;resize:vertical" ${!smtpConfigured ? 'disabled' : ''}></textarea>
            <button class="act-btn" id="sendManualBtn" style="padding:8px 16px;font-size:.82rem;color:#0d9488;border-color:#5eead4;align-self:flex-start" ${!smtpConfigured ? 'disabled style="opacity:.5"' : ''}>Invia email</button>
          </div>
          <div id="manualResult" style="margin-top:8px;font-size:.82rem;display:none"></div>
        </div>
      </div>

      <div class="health-card">
        <h3>&#128190; Storage</h3>
        <div class="health-item"><span>quotes.json</span><span>${quotesSize} (${quotesCount} record)</span></div>
        <div class="health-item"><span>users.json</span><span>${usersSize} (${usersCount} record)</span></div>
        <div class="health-item"><span>Email log totale</span><span>${emailLogs.length} record</span></div>
        <div class="health-item"><span>Email inviate</span><span style="color:#065f46;font-weight:600">${sentCount}</span></div>
        <div class="health-item"><span>Email fallite</span><span style="color:#dc2626;font-weight:600">${failedCount}</span></div>
        <div class="health-item"><span>Email solo locale</span><span style="color:#92400e;font-weight:600">${loggedCount}</span></div>
      </div>

      <div class="health-card">
        <h3>&#9881; Ambiente</h3>
        <div class="health-item"><span>NODE_ENV</span><span>${esc(process.env.NODE_ENV || "development")}</span></div>
        <div class="health-item"><span>Porta</span><span>${esc(process.env.PORT || "3000")}</span></div>
        <div class="health-item"><span>Claude API</span><span class="${process.env.CLAUDE_API_KEY ? 'health-ok' : 'health-err'}">${process.env.CLAUDE_API_KEY ? 'Configurata' : 'Non configurata'}</span></div>
        <div class="health-item"><span>Stripe</span><span class="${process.env.STRIPE_SECRET_KEY ? 'health-ok' : 'health-err'}">${process.env.STRIPE_SECRET_KEY ? 'Configurato' : 'Non configurato'}</span></div>
      </div>
    </div>
  </div>
  <div class="toast" id="toast"></div>`;

  const script = `
  (function() {
    var resultEl = document.getElementById('smtpTestResult');

    document.getElementById('testSmtpBtn').addEventListener('click', function() {
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Testing...';
      resultEl.style.display = 'block';
      resultEl.innerHTML = '<span style="color:#6b7280">Connessione in corso...</span>';

      fetch('/admin/test-email', { method: 'GET' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        btn.disabled = false;
        btn.textContent = 'Test connessione SMTP';
        if (data.ok) {
          resultEl.innerHTML = '<span style="color:#065f46;font-weight:600">SMTP connesso correttamente!</span>';
        } else {
          resultEl.innerHTML = '<span style="color:#dc2626;font-weight:600">Errore: ' + (data.error || 'Sconosciuto') + '</span>';
        }
      })
      .catch(function() {
        btn.disabled = false;
        btn.textContent = 'Test connessione SMTP';
        resultEl.innerHTML = '<span style="color:#dc2626">Errore di rete</span>';
      });
    });

    document.getElementById('sendTestBtn').addEventListener('click', function() {
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Invio...';
      resultEl.style.display = 'block';
      resultEl.innerHTML = '<span style="color:#6b7280">Invio email di test...</span>';

      fetch('/admin/send-test-email', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        btn.disabled = false;
        btn.textContent = 'Invia email di test (admin)';
        if (data.success) {
          resultEl.innerHTML = '<span style="color:#065f46;font-weight:600">Email di test inviata a ' + data.to + '!</span>';
          showToast('Email di test inviata!');
        } else {
          resultEl.innerHTML = '<span style="color:#dc2626;font-weight:600">Errore: ' + (data.error || 'Sconosciuto') + '</span>';
        }
      })
      .catch(function() {
        btn.disabled = false;
        btn.textContent = 'Invia email di test (admin)';
        resultEl.innerHTML = '<span style="color:#dc2626">Errore di rete</span>';
      });
    });

    var manualResult = document.getElementById('manualResult');
    document.getElementById('sendManualBtn').addEventListener('click', function() {
      var btn = this;
      var to = document.getElementById('manualTo').value.trim();
      if (!to || to.indexOf('@') === -1) { showToast('Inserisci un indirizzo email valido'); return; }
      var subject = document.getElementById('manualSubject').value.trim();
      var body = document.getElementById('manualBody').value.trim();
      btn.disabled = true;
      btn.textContent = 'Invio...';
      manualResult.style.display = 'block';
      manualResult.innerHTML = '<span style="color:#6b7280">Invio in corso...</span>';

      fetch('/admin/send-manual-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to, subject: subject, body: body })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        btn.disabled = false;
        btn.textContent = 'Invia email';
        if (data.success) {
          manualResult.innerHTML = '<span style="color:#065f46;font-weight:600">Email inviata a ' + data.to + ' (ID: ' + (data.messageId || '-') + ')</span>';
          showToast('Email inviata!');
        } else {
          manualResult.innerHTML = '<span style="color:#dc2626;font-weight:600">Errore: ' + (data.error || 'Sconosciuto') + (data.code ? ' [' + data.code + ']' : '') + '</span>';
        }
      })
      .catch(function() {
        btn.disabled = false;
        btn.textContent = 'Invia email';
        manualResult.innerHTML = '<span style="color:#dc2626">Errore di rete</span>';
      });
    });

    function showToast(msg) {
      var t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(function() { t.classList.remove('show'); }, 2500);
    }
  })();`;

  res.send(page({ title: "Admin — Sistema", user: admin, content, extraCss: ADMIN_CSS, script, activePage: "admin" }));
});

// ─── GET /admin/test-email — Test SMTP (JSON) ───
router.get("/test-email", async (req, res) => {
  const result = await testSmtp();
  res.json(result);
});

// ─── POST /admin/send-test-email — Invia email di test reale ───
router.post("/send-test-email", async (req, res) => {
  const admin = getUserById(req.session.userId);
  if (!admin) return res.status(401).json({ success: false, error: "Non autenticato" });

  if (!smtpAvailable()) {
    return res.json({ success: false, error: "SMTP non configurato. Aggiungi SMTP_HOST, SMTP_USER, SMTP_PASS nel .env" });
  }

  try {
    await sendTestEmail(admin.email);
    return res.json({ success: true, to: admin.email, message: "Email di test inviata" });
  } catch (err) {
    console.error("[Admin] Test email fallito:", err.message);
    return res.json({ success: false, error: err.message });
  }
});

// ─── POST /admin/send-manual-email — Invio email a destinatario personalizzato ───
router.post("/send-manual-email", async (req, res) => {
  const { to, subject, body } = req.body;
  if (!to || !to.includes("@")) {
    return res.json({ success: false, error: "Indirizzo email non valido" });
  }
  if (!smtpAvailable()) {
    return res.json({ success: false, error: "SMTP non configurato" });
  }

  const emailSubject = subject || "Test Email — Preventivo EASY";
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Inter,sans-serif;padding:40px;background:#faf9f7">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <h2 style="color:#0d9488;margin:0 0 12px">${emailSubject}</h2>
    <p style="color:#374151;line-height:1.6">${body || "Questa è un'email di test inviata dalla piattaforma Preventivo EASY."}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="font-size:.82rem;color:#9ca3af">Inviata il ${new Date().toLocaleString("it-IT")} da Preventivo EASY</p>
  </div>
</body></html>`;

  try {
    const { sendQuoteEmail } = require("../utils/mailer");
    const info = await sendQuoteEmail(to, emailSubject, html);
    return res.json({ success: true, to, messageId: info.messageId });
  } catch (err) {
    console.error("[Admin] Manual email fallito:", err.message);
    return res.json({ success: false, error: err.message, code: err.code });
  }
});

// ─── POST /admin/quotes/:id/resend — Reinvio email da admin ───
router.post("/quotes/:id/resend", async (req, res) => {
  const quote = getQuoteById(req.params.id);
  if (!quote) return res.status(404).json({ success: false, error: "Preventivo non trovato" });

  const to = quote.client?.email;
  if (!to) return res.status(400).json({ success: false, error: "Nessun indirizzo email nel preventivo" });

  try {
    const baseUrl = req.baseUrl_resolved || `${req.protocol}://${req.get("host")}`;
    const acceptUrl = `${baseUrl}/q/${quote.quote_id}/accept`;
    const viewUrl = `${baseUrl}/q/${quote.quote_id}`;
    const html = buildQuoteEmailHTML(quote, acceptUrl, viewUrl);
    const result = await sendOrLog(to, `Preventivo ${quote.quote_id}`, html, quote.quote_id);

    if (result.sent) {
      updateQuote(req.params.id, { email_status: "sent", email_sent_at: new Date().toISOString(), email_error: null });
      return res.json({ success: true, message: "Email inviata" });
    } else if (result.logged) {
      updateQuote(req.params.id, { email_status: "logged", email_sent_at: new Date().toISOString(), email_error: null });
      return res.json({ success: true, message: "Email salvata localmente" });
    } else {
      updateQuote(req.params.id, { email_status: "failed", email_error: result.error });
      return res.status(500).json({ success: false, error: result.error || "Invio fallito" });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
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

// ─── POST /admin/user/:id/credits ───
router.post("/user/:id/credits", (req, res) => {
  const amount = parseInt(req.body.amount);
  if (!amount || amount < 1 || amount > 100) {
    return res.status(400).json({ success: false, error: "Quantità non valida (1-100)" });
  }

  const target = getUserById(req.params.id);
  if (!target) return res.status(404).json({ success: false, error: "Utente non trovato" });

  const newCredits = (target.credits || 0) + amount;
  updateUser(req.params.id, { credits: newCredits });
  console.log(`[Admin] +${amount} crediti a ${target.email} (totale: ${newCredits})`);
  res.json({ success: true, credits: newCredits });
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

// ─── POST /admin/reset-admin-password — Reset password admin (protetto da secret) ───
router.post("/reset-admin-password", async (req, res) => {
  const { secret, newPassword } = req.body;
  if (!process.env.ADMIN_RESET_SECRET) {
    return res.status(500).json({ success: false, error: "ADMIN_RESET_SECRET non configurato nel .env" });
  }

  if (secret !== process.env.ADMIN_RESET_SECRET) {
    return res.status(403).json({ success: false, error: "Secret non valido" });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, error: "Password troppo corta (min 6 caratteri)" });
  }

  const bcrypt = require("bcrypt");
  const hash = await bcrypt.hash(newPassword, 10);
  const admin = getUserById(req.session.userId);
  if (!admin || admin.role !== "admin") {
    return res.status(403).json({ success: false, error: "Non sei admin" });
  }

  updateUser(admin.id, { password_hash: hash });
  console.log(`[Admin] Password resettata per ${admin.email}`);
  res.json({ success: true, message: "Password admin aggiornata" });
});

module.exports = router;
