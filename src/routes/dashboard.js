// src/routes/dashboard.js
const express = require("express");
const router = express.Router();
const { loadQuotes, getUserById, getQuoteCountByUser } = require("../utils/storage");
const feedback = require("../utils/feedback");
const { page, esc, fmt, planInfo } = require("../utils/layout");

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

  const pi = planInfo(user);
  const isFree = pi.label === "Free";
  const quoteCount = getQuoteCountByUser(user.id);
  const credits = user.credits || 0;
  const limitReached = isFree && credits <= 0 && quoteCount >= FREE_QUOTE_LIMIT;
  const progressPct = isFree ? Math.min(100, Math.round((quoteCount / FREE_QUOTE_LIMIT) * 100)) : 0;
  const progressColor = progressPct >= 100 ? "#dc2626" : progressPct >= 66 ? "#f59e0b" : "#22c55e";

  // Quote cards
  const quoteCards = quotes.map(q => {
    const date = new Date(q.created_at).toLocaleDateString("it-IT", {
      day: "2-digit", month: "short", year: "numeric"
    });
    const clientName = q.client?.name || "Cliente non specificato";
    const jobShort = q.job_description
      ? (q.job_description.length > 60 ? q.job_description.slice(0, 60) + "\u2026" : q.job_description)
      : "";

    const emailBadge = q.email_status === "failed"
      ? '<span class="email-badge email-badge-failed">Invio fallito</span>'
      : q.email_status === "logged"
        ? '<span class="email-badge email-badge-logged">Non inviata (log)</span>'
        : q.email_status === "sent"
          ? '<span class="email-badge email-badge-sent">Inviata</span>'
          : '';

    const resendBtn = (q.email_status === "failed" || q.email_status === "logged")
      ? `<button class="qbtn qbtn-resend" onclick="resendQuote('${esc(q.quote_id)}', this)">Reinvia email</button>`
      : '';

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
        <div>${badge(q.status)}${emailBadge}</div>
      </div>
      <div class="quote-card-bottom">
        <div class="quote-card-total">${fmt(q.total || 0)} &euro;</div>
        <div class="quote-card-date">${date}</div>
      </div>
      <div class="quote-card-actions">
        <a href="/quotes/${esc(q.quote_id)}" class="qbtn qbtn-open">Apri</a>
        <button class="qbtn qbtn-send" onclick="copyLink('/q/${esc(q.quote_id)}', this)">Link pubblico</button>
        ${resendBtn}
      </div>
    </div>`;
  }).join("");

  // Free limit block
  let limitBlockHtml = "";
  if (isFree) {
    limitBlockHtml = limitReached
      ? `<div class="limit-block limit-reached">
          <div class="limit-content">
            <div class="limit-title">&#9888; Limite raggiunto</div>
            <p>Hai usato tutti i <strong>${FREE_QUOTE_LIMIT}</strong> preventivi del piano gratuito. Fai l'upgrade per continuare a creare preventivi senza limiti.</p>
            <div class="progress-bar"><div class="progress-fill" style="width:100%;background:#dc2626"></div></div>
            <div class="limit-count">${quoteCount} / ${FREE_QUOTE_LIMIT} preventivi utilizzati</div>
          </div>
          <a href="/upgrade" class="btn btn-primary">Passa a un piano Pro</a>
        </div>`
      : `<div class="limit-block">
          <div class="limit-content">
            <div class="limit-title">Piano gratuito &mdash; ${FREE_QUOTE_LIMIT - quoteCount} rimast${FREE_QUOTE_LIMIT - quoteCount === 1 ? "o" : "i"}</div>
            <p>Puoi ancora creare <strong>${FREE_QUOTE_LIMIT - quoteCount}</strong> preventiv${FREE_QUOTE_LIMIT - quoteCount === 1 ? "o" : "i"} gratuitamente. Passa a Pro per preventivi illimitati.</p>
            <div class="progress-bar"><div class="progress-fill" style="width:${progressPct}%;background:${progressColor}"></div></div>
            <div class="limit-count">${quoteCount} di ${FREE_QUOTE_LIMIT} utilizzati</div>
          </div>
          <a href="/upgrade" class="btn btn-secondary" style="white-space:nowrap">Scopri i piani</a>
        </div>`;
  }

  // Credits block for pay-per-use
  let creditsHtml = "";
  if (credits > 0 && pi.label === "Pay-per-use") {
    creditsHtml = `<div class="limit-block" style="border-color:#e9d5ff">
      <div class="limit-content">
        <div class="limit-title">Crediti pay-per-use</div>
        <p>Hai <strong>${credits}</strong> credit${credits === 1 ? "o" : "i"} disponibil${credits === 1 ? "e" : "i"} per generare preventivi.</p>
      </div>
      <a href="/upgrade" class="btn btn-secondary" style="white-space:nowrap">Compra crediti</a>
    </div>`;
  }

  // CTA
  const ctaHtml = limitReached
    ? ""
    : `<a href="/quotes/new" class="cta-btn-main">
        <span class="cta-btn-icon">&#9998;</span>
        <span>Crea nuovo preventivo</span>
      </a>`;

  const extraCss = `
    .dash-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:28px}
    .dash-header h2{font-size:1.3rem;font-weight:700}
    .dash-plan{display:inline-flex;align-items:center;gap:6px;font-size:.78rem;font-weight:600;padding:5px 14px;border-radius:20px;letter-spacing:.04em;vertical-align:middle;margin-left:10px}

    /* ── CTA principale ── */
    .cta-btn-main{display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:16px 28px;border-radius:12px;font-size:.95rem;font-weight:600;text-decoration:none;transition:all .2s;box-shadow:0 4px 16px rgba(245,158,11,.25);margin-bottom:28px}
    .cta-btn-main:hover{box-shadow:0 6px 24px rgba(245,158,11,.35);transform:translateY(-2px)}
    .cta-btn-icon{width:36px;height:36px;background:rgba(255,255,255,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;flex-shrink:0}

    /* ── Limit block ── */
    .limit-block{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:24px}
    .limit-block.limit-reached{border-color:#fecaca;background:#fef2f2}
    .limit-content{flex:1;min-width:0}
    .limit-title{font-size:.9rem;font-weight:700;margin-bottom:4px}
    .limit-content p{font-size:.84rem;color:#6b7280;margin:0}
    .limit-count{font-size:.75rem;color:#9ca3af;margin-top:2px}

    /* ── Quote cards ── */
    .quote-list{display:flex;flex-direction:column;gap:14px}
    .quote-card{background:#fff;border-radius:12px;padding:20px 24px;box-shadow:0 1px 6px rgba(0,0,0,.05);transition:box-shadow .15s}
    .quote-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08)}
    .quote-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
    .quote-card-client{display:flex;align-items:center;gap:12px;min-width:0}
    .quote-card-avatar{width:38px;height:38px;border-radius:50%;background:#0d9488;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem;flex-shrink:0}
    .quote-card-name{font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .quote-card-desc{font-size:.82rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:340px}
    .q-badge{padding:4px 12px;border-radius:20px;font-size:.72rem;font-weight:600;white-space:nowrap}
    .quote-card-bottom{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #f0f0f0}
    .quote-card-total{font-size:1.15rem;font-weight:700;color:#1c1917}
    .quote-card-date{font-size:.78rem;color:#aaa}
    .quote-card-actions{display:flex;gap:8px;flex-wrap:wrap}
    .qbtn{padding:6px 16px;border-radius:6px;font-size:.78rem;font-weight:500;cursor:pointer;border:none;text-decoration:none;transition:background .15s}
    .qbtn-open{background:#0d9488;color:#fff}
    .qbtn-open:hover{background:#0f766e}
    .qbtn-send{background:#faf9f7;color:#555}
    .qbtn-send:hover{background:#e2e4e8}
    .qbtn-resend{background:#fef2f2;color:#dc2626;border:1px solid #fca5a5}
    .qbtn-resend:hover{background:#fee2e2}
    .email-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.66rem;font-weight:600;margin-left:6px;vertical-align:middle}
    .email-badge-failed{background:#fef2f2;color:#dc2626}
    .email-badge-logged{background:#fffbeb;color:#92400e}
    .email-badge-sent{background:#ecfdf5;color:#065f46}

    .empty-state{text-align:center;padding:60px 24px;color:#aaa}
    .empty-state .empty-icon{font-size:3rem;margin-bottom:12px;opacity:.4}
    .empty-state p{font-size:.95rem;margin-bottom:20px}

    .section-title{font-size:.85rem;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px}

    .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1c1917;color:#fff;padding:10px 24px;border-radius:8px;font-size:.85rem;opacity:0;transition:opacity .3s;pointer-events:none;z-index:100}
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
      <div>
        <h2>Ciao, ${esc(user.name.split(" ")[0])}</h2>
        <p style="margin:4px 0 0;font-size:.9rem;color:#6b7280">Ecco i tuoi preventivi</p>
      </div>
    </div>

    <!-- CTA principale -->
    ${ctaHtml}

    <!-- Limite / Crediti -->
    ${limitBlockHtml}
    ${creditsHtml}

    <!-- Stats -->
    <div class="section-title">Riepilogo attivit&agrave;</div>
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
          <p>Crea il tuo primo preventivo in 60 secondi. Descrivi il lavoro e l'AI far&agrave; il resto!</p>
          ${limitReached ? '<a href="/upgrade" class="btn btn-primary">Passa a un piano Pro</a>' : '<a href="/quotes/new" class="btn btn-primary">Crea il tuo primo preventivo</a>'}
        </div></div>`
      : `<div class="quote-list">${quoteCards}</div>`}
  </div>

  <div class="toast" id="toast"></div>`;

  const script = `
    function resendQuote(id, btn) {
      btn.disabled = true;
      btn.textContent = 'Invio...';
      fetch('/api/quotes/' + id + '/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          showToast(data.message || 'Email reinviata');
          setTimeout(function() { location.reload(); }, 1000);
        } else {
          showToast(data.error || 'Errore invio');
          btn.disabled = false;
          btn.textContent = 'Reinvia email';
        }
      })
      .catch(function() {
        showToast('Errore di rete');
        btn.disabled = false;
        btn.textContent = 'Reinvia email';
      });
    }
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
