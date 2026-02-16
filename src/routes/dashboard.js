// src/routes/dashboard.js
const express = require("express");
const router = express.Router();
const { loadQuotes, getUserById, getQuoteCountByUser } = require("../utils/storage");
const feedback = require("../utils/feedback");
const { page, esc, fmt } = require("../utils/layout");

const FREE_QUOTE_LIMIT = Number(process.env.FREE_QUOTE_LIMIT) || 3;

const STATUS = {
  draft:          { bg: "#fff3cd", color: "#856404", label: "Bozza" },
  sent:           { bg: "#cce5ff", color: "#004085", label: "Inviato" },
  accepted:       { bg: "#d4edda", color: "#155724", label: "Accettato" },
  acconto_pagato: { bg: "#b8daff", color: "#004085", label: "Acconto pagato" },
  rejected:       { bg: "#f8d7da", color: "#721c24", label: "Rifiutato" },
  expired:        { bg: "#e2e3e5", color: "#383d41", label: "Scaduto" }
};

function badge(status) {
  const s = STATUS[status] || STATUS.draft;
  return `<span class="q-badge" style="background:${s.bg};color:${s.color}">${esc(s.label)}</span>`;
}

router.get("/", (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.redirect("/auth/login");

  const allQuotes = loadQuotes();
  const quotes = allQuotes
    .filter(q => q.user_id === user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const planLabel = (user.plan && user.plan !== "free") ? "PRO" : "FREE";
  const planClass = planLabel === "PRO" ? "plan-pro" : "plan-free";

  // FREE limit check
  const isFree = !user.plan || user.plan === "free";
  const quoteCount = getQuoteCountByUser(user.id);
  const limitReached = isFree && quoteCount >= FREE_QUOTE_LIMIT;

  // Build quote cards
  const quoteCards = quotes.map(q => {
    const date = new Date(q.created_at).toLocaleDateString("it-IT", {
      day: "2-digit", month: "short", year: "numeric"
    });
    const clientName = q.client?.name || "Cliente non specificato";
    const jobShort = q.job_description
      ? (q.job_description.length > 60 ? q.job_description.slice(0, 60) + "\u2026" : q.job_description)
      : "";

    return `
    <div class="quote-card">
      <div class="quote-card-top">
        <div class="quote-card-client">
          <div class="quote-card-avatar">${esc(clientName.charAt(0).toUpperCase())}</div>
          <div>
            <div class="quote-card-name">${esc(clientName)}</div>
            <div class="quote-card-desc">${esc(jobShort)}</div>
          </div>
        </div>
        ${badge(q.status)}
      </div>
      <div class="quote-card-bottom">
        <div class="quote-card-total">${fmt(q.total || 0)} &euro;</div>
        <div class="quote-card-date">${date}</div>
      </div>
      <div class="quote-card-actions">
        <a href="/quotes/${esc(q.quote_id)}" class="qbtn qbtn-open">Apri</a>
        <button class="qbtn qbtn-send" onclick="copyLink('/q/${esc(q.quote_id)}', this)">Link pubblico</button>
      </div>
    </div>`;
  }).join("");

  // CTA card: disabled if limit reached
  const ctaHtml = limitReached
    ? `<div class="cta-card cta-disabled">
        <div>
          <h3>Limite raggiunto</h3>
          <p>Hai usato ${quoteCount} preventivi su ${FREE_QUOTE_LIMIT} disponibili nel piano gratuito.</p>
        </div>
        <a href="/upgrade" class="cta-btn" style="background:#2563eb;color:#fff">Passa a PRO</a>
      </div>`
    : `<div class="cta-card">
        <div>
          <h3>Crea un nuovo preventivo</h3>
          <p>Descrivi il lavoro e l'AI generer&agrave; il preventivo per te${isFree ? ` &middot; ${quoteCount}/${FREE_QUOTE_LIMIT} usati` : ""}</p>
        </div>
        <a href="/quotes/new" class="cta-btn">+ Nuovo preventivo</a>
      </div>`;

  const extraCss = `
    /* ── Dashboard header ── */
    .dash-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:28px}
    .dash-header h2{font-size:1.3rem;font-weight:700}
    .plan-badge{display:inline-block;font-size:.7rem;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:.06em;vertical-align:middle;margin-left:10px}
    .plan-free{background:#fff3cd;color:#856404}
    .plan-pro{background:#d4edda;color:#155724}

    /* ── CTA ── */
    .cta-card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px 28px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:28px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
    .cta-card h3{font-size:1rem;font-weight:600;margin-bottom:4px;color:#1e1e2d}
    .cta-card p{font-size:.85rem;color:#6b7280}
    .cta-btn{background:#2563eb;color:#fff;padding:10px 24px;border-radius:6px;font-size:.88rem;font-weight:500;text-decoration:none;transition:background .15s;display:inline-block}
    .cta-btn:hover{background:#1d4ed8}
    .cta-disabled{background:#f9fafb;border-color:#e5e7eb}
    .cta-btn-disabled{background:#e5e7eb;color:#9ca3af;padding:10px 24px;border-radius:6px;font-size:.88rem;font-weight:500;display:inline-block;cursor:not-allowed}

    /* ── Quote cards ── */
    .quote-list{display:flex;flex-direction:column;gap:14px}
    .quote-card{background:#fff;border-radius:12px;padding:20px 24px;box-shadow:0 1px 6px rgba(0,0,0,.05);transition:box-shadow .15s}
    .quote-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08)}
    .quote-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
    .quote-card-client{display:flex;align-items:center;gap:12px;min-width:0}
    .quote-card-avatar{width:38px;height:38px;border-radius:50%;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem;flex-shrink:0}
    .quote-card-name{font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .quote-card-desc{font-size:.82rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px}
    .q-badge{padding:4px 12px;border-radius:20px;font-size:.72rem;font-weight:600;white-space:nowrap}
    .quote-card-bottom{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #f0f0f0}
    .quote-card-total{font-size:1.15rem;font-weight:700;color:#1a1a2e}
    .quote-card-date{font-size:.78rem;color:#aaa}
    .quote-card-actions{display:flex;gap:8px;flex-wrap:wrap}
    .qbtn{padding:6px 16px;border-radius:6px;font-size:.78rem;font-weight:500;cursor:pointer;border:none;text-decoration:none;transition:background .15s}
    .qbtn-open{background:#2563eb;color:#fff}
    .qbtn-open:hover{background:#2d6fd6}
    .qbtn-send{background:#f0f2f5;color:#555}
    .qbtn-send:hover{background:#e2e4e8}

    .empty-state{text-align:center;padding:60px 24px;color:#aaa}
    .empty-state .empty-icon{font-size:3rem;margin-bottom:12px;opacity:.4}
    .empty-state p{font-size:.95rem;margin-bottom:20px}

    .section-title{font-size:.85rem;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px}

    /* ── Toast ── */
    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:10px 24px;border-radius:8px;font-size:.85rem;opacity:0;transition:opacity .3s;pointer-events:none;z-index:100}
    .toast.show{opacity:1}
  `;

  const kpi = feedback.getKpi(user.id);

  const kpiHtml = kpi.total_feedback > 0 ? `
    <div class="stats" style="margin-top:8px">
      <div class="stat">
        <div class="label">Tasso accettazione</div>
        <div class="value">${kpi.acceptance_rate}%</div>
      </div>
      <div class="stat">
        <div class="label">Margine medio</div>
        <div class="value">${kpi.avg_margin}%</div>
      </div>
      <div class="stat">
        <div class="label">Precisione AI</div>
        <div class="value">${kpi.ai_accuracy}%</div>
      </div>
    </div>` : '';

  const content = `
  <div class="wrap">
    <!-- Header -->
    <div class="dash-header">
      <h2>Ciao, ${esc(user.name.split(" ")[0])} <span class="plan-badge ${planClass}">${planLabel}</span></h2>
    </div>

    <!-- CTA -->
    ${ctaHtml}

    <!-- Stats -->
    <div class="stats">
      <div class="stat">
        <div class="label">Totali</div>
        <div class="value">${quotes.length}</div>
      </div>
      <div class="stat">
        <div class="label">Inviati</div>
        <div class="value">${quotes.filter(q => q.status === "sent").length}</div>
      </div>
      <div class="stat">
        <div class="label">Accettati</div>
        <div class="value">${quotes.filter(q => q.status === "accepted" || q.status === "acconto_pagato").length}</div>
      </div>
      <div class="stat">
        <div class="label">Fatturato</div>
        <div class="value">${fmt(quotes.filter(q => q.status === "accepted" || q.status === "acconto_pagato").reduce((s, q) => s + (q.total || 0), 0))} &euro;</div>
      </div>
    </div>

    <!-- KPI AI -->
    ${kpiHtml}

    <!-- Lista preventivi -->
    <div class="section-title">I tuoi preventivi</div>
    ${quotes.length === 0
      ? `<div class="card"><div class="empty-state">
          <div class="empty-icon">&#128203;</div>
          <p>Non hai ancora creato nessun preventivo.</p>
          ${limitReached ? "" : '<a href="/quotes/new" class="btn btn-primary">Crea il primo</a>'}
        </div></div>`
      : `<div class="quote-list">${quoteCards}</div>`}
  </div>

  <div class="toast" id="toast"></div>`;

  const script = `
    function copyLink(path, btn) {
      var url = window.location.origin + path;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function() {
          showToast('Link copiato!');
        });
      } else {
        var inp = document.createElement('input');
        inp.value = url;
        document.body.appendChild(inp);
        inp.select();
        document.execCommand('copy');
        document.body.removeChild(inp);
        showToast('Link copiato!');
      }
    }
    function showToast(msg) {
      var t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(function(){ t.classList.remove('show'); }, 2000);
    }`;

  res.send(page({ title: "Dashboard", user, content, extraCss, script, activePage: "dashboard" }));
});

module.exports = router;
