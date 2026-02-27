// src/routes/upgrade.js
const express = require("express");
const router = express.Router();
const { getUserById } = require("../utils/storage");
const { page, esc } = require("../utils/layout");
const { getActiveSubscriberCount, EARLY_BIRD_LIMIT, isEarlyBirdAvailable } = require("../utils/stripe");

const FREE_QUOTE_LIMIT = Number(process.env.FREE_QUOTE_LIMIT) || 3;

router.get("/", (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) return res.redirect("/auth/login");

  const currentPlan = user.plan || "free";
  const isActive = user.subscription_status === "active";
  const credits = user.credits || 0;
  const earlyAvailable = isEarlyBirdAvailable();
  const earlyRemaining = Math.max(0, EARLY_BIRD_LIMIT - getActiveSubscriberCount());

  function planLabel(plan) {
    if (plan === "early") return "Early Bird";
    if (plan === "standard") return "Standard";
    if (plan === "pay_per_use") return "Pay-per-use";
    return "Free";
  }

  const extraCss = `
    .upgrade-wrap{max-width:900px}
    .upgrade-header{text-align:center;margin-bottom:32px}
    .upgrade-header h2{font-size:1.3rem;font-weight:700;margin-bottom:8px}
    .upgrade-header p{color:#6b7280;font-size:.9rem}
    .plans{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:32px}
    @media(max-width:700px){.plans{grid-template-columns:1fr}}
    .plan-card{background:#fff;border:2px solid #e5e7eb;border-radius:10px;padding:28px 24px;text-align:center;transition:border-color .15s}
    .plan-card.current{border-color:#0d9488}
    .plan-card.highlight{border-color:#0d9488;box-shadow:0 2px 12px rgba(13,148,136,.1)}
    .plan-name{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:8px}
    .plan-price{font-size:2rem;font-weight:700;color:#1c1917;margin-bottom:4px}
    .plan-price span{font-size:.85rem;font-weight:400;color:#9ca3af}
    .plan-desc{font-size:.82rem;color:#6b7280;margin-bottom:20px}
    .plan-features{text-align:left;margin-bottom:24px}
    .plan-features li{font-size:.84rem;padding:6px 0;color:#444;list-style:none;display:flex;align-items:center;gap:8px}
    .plan-features li::before{content:"\\2713";color:#22c55e;font-weight:700;font-size:.8rem;flex-shrink:0}
    .plan-features li.disabled{color:#bbb}
    .plan-features li.disabled::before{content:"\\2717";color:#ddd}
    .plan-cta{width:100%;padding:10px;border-radius:6px;font-size:.88rem;font-weight:500;cursor:pointer;border:none;transition:background .15s}
    .plan-cta-current{background:#f0f1f3;color:#888;cursor:default}
    .plan-cta-upgrade{background:#0d9488;color:#fff}
    .plan-cta-upgrade:hover{background:#0f766e}
    .current-label{display:inline-block;background:#ecfdf5;color:#065f46;font-size:.72rem;font-weight:600;padding:3px 10px;border-radius:12px;margin-bottom:12px}
    .ppu-section{background:#fff;border:2px solid #e5e7eb;border-radius:10px;padding:28px 24px;text-align:center;max-width:500px;margin:0 auto}
    .ppu-section h3{font-size:1rem;font-weight:700;margin-bottom:8px}
    .ppu-section p{font-size:.85rem;color:#6b7280;margin-bottom:16px}
    .ppu-price{font-size:1.5rem;font-weight:700;color:#1c1917;margin-bottom:16px}
    .ppu-credits{font-size:.82rem;color:#6b7280;margin-bottom:16px}
    .status-section{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:20px 24px;margin-bottom:24px;text-align:center}
    .status-section .status-title{font-weight:600;color:#0369a1;margin-bottom:4px}
    .status-section .status-detail{font-size:.84rem;color:#6b7280}
  `;

  // Sezione stato abbonamento attivo
  let statusHtml = "";
  if (currentPlan !== "free" && isActive) {
    statusHtml = `
    <div class="status-section">
      <div class="status-title">Piano attivo: ${planLabel(currentPlan)}</div>
      <div class="status-detail">Il tuo abbonamento è attivo.${credits > 0 ? ` Crediti disponibili: ${credits}` : ""}</div>
    </div>`;
  } else if (credits > 0) {
    statusHtml = `
    <div class="status-section">
      <div class="status-title">Crediti pay-per-use: ${credits}</div>
      <div class="status-detail">Puoi generare ancora ${credits} preventiv${credits === 1 ? "o" : "i"}.</div>
    </div>`;
  }

  const content = `
  <div class="wrap upgrade-wrap">
    <div class="upgrade-header">
      <h2>Scegli il tuo piano</h2>
      <p>Abbonati per preventivi illimitati o acquista singoli preventivi.</p>
    </div>

    ${statusHtml}

    <div id="msg" class="alert alert-success" style="display:none"></div>
    <div id="err" class="alert alert-error" style="display:none"></div>

    <div class="plans">
      <!-- FREE -->
      <div class="plan-card${currentPlan === "free" && !credits ? " current" : ""}">
        ${currentPlan === "free" && !credits ? '<span class="current-label">Piano attivo</span>' : ""}
        <div class="plan-name">Free</div>
        <div class="plan-price">0 &euro; <span>/ mese</span></div>
        <div class="plan-desc">Per iniziare</div>
        <ul class="plan-features">
          <li>${FREE_QUOTE_LIMIT} preventivi inclusi</li>
          <li>Generazione AI base</li>
          <li>Link pubblico condivisibile</li>
          <li>Esportazione PDF</li>
          <li class="disabled">Genera tutti i preventivi che vuoi</li>
          <li class="disabled">Invia e traccia accettazioni in tempo reale</li>
        </ul>
        <button class="plan-cta plan-cta-current" disabled>Gratuito</button>
      </div>

      <!-- EARLY BIRD -->
      <div class="plan-card${currentPlan === "early" && isActive ? " current" : earlyAvailable ? " highlight" : ""}">
        ${currentPlan === "early" && isActive ? '<span class="current-label">Piano attivo</span>' : ""}
        <div class="plan-name">Early Bird</div>
        <div class="plan-price">5 &euro; <span>/ mese</span></div>
        <div class="plan-desc">${earlyAvailable ? `Solo per i primi 100 &mdash; restano <strong>${earlyRemaining}</strong> posti` : "Posti esauriti"}</div>
        <ul class="plan-features">
          <li>Genera tutti i preventivi che vuoi</li>
          <li>AI che impara dal tuo stile</li>
          <li>Esportazione PDF</li>
          <li>Invia e traccia accettazioni in tempo reale</li>
          <li>Storico e analytics preventivi</li>
          <li>Supporto prioritario</li>
        </ul>
        ${currentPlan === "early" && isActive
          ? '<button class="plan-cta plan-cta-current" disabled>Piano attuale</button>'
          : earlyAvailable
            ? '<button class="plan-cta plan-cta-upgrade" onclick="checkout(\'early\')">Scegli Early Bird</button>'
            : '<button class="plan-cta plan-cta-current" disabled>Esaurito</button>'}
      </div>

      <!-- STANDARD -->
      <div class="plan-card${currentPlan === "standard" && isActive ? " current" : ""}">
        ${currentPlan === "standard" && isActive ? '<span class="current-label">Piano attivo</span>' : ""}
        <div class="plan-name">Standard</div>
        <div class="plan-price">8,99 &euro; <span>/ mese</span></div>
        <div class="plan-desc">Per professionisti</div>
        <ul class="plan-features">
          <li>Genera tutti i preventivi che vuoi</li>
          <li>AI che impara dal tuo stile</li>
          <li>Esportazione PDF</li>
          <li>Invia e traccia accettazioni in tempo reale</li>
          <li>Storico e analytics preventivi</li>
          <li>Supporto prioritario</li>
        </ul>
        ${currentPlan === "standard" && isActive
          ? '<button class="plan-cta plan-cta-current" disabled>Piano attuale</button>'
          : '<button class="plan-cta plan-cta-upgrade" onclick="checkout(\'standard\')">Scegli Standard</button>'}
      </div>
    </div>

    <!-- PAY-PER-USE -->
    <div class="ppu-section">
      <h3>Oppure: paga per singolo preventivo</h3>
      <p>Non vuoi un abbonamento? Paga solo quando serve: 0,79 &euro; per ogni preventivo generato con AI.</p>
      <div class="ppu-price">0,79 &euro; <span style="font-size:.85rem;font-weight:400;color:#9ca3af">/ preventivo AI</span></div>
      ${credits > 0 ? `<div class="ppu-credits">Crediti disponibili: <strong>${credits}</strong></div>` : ""}
      <button class="plan-cta plan-cta-upgrade" onclick="checkout('pay_per_use')" style="max-width:300px;margin:0 auto">Compra 1 preventivo</button>
    </div>
  </div>`;

  const script = `
  function checkout(priceType) {
    var btns = document.querySelectorAll('.plan-cta-upgrade');
    btns.forEach(function(b){ b.disabled = true; b.textContent = 'Reindirizzamento...'; });

    fetch('/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceType: priceType })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        var err = document.getElementById('err');
        err.textContent = data.error || 'Errore durante il checkout.';
        err.style.display = 'block';
        btns.forEach(function(b){ b.disabled = false; b.textContent = 'Riprova'; });
      }
    })
    .catch(function() {
      var err = document.getElementById('err');
      err.textContent = 'Errore di rete. Riprova.';
      err.style.display = 'block';
      btns.forEach(function(b){ b.disabled = false; b.textContent = 'Riprova'; });
    });
  }`;

  res.send(page({ title: "Upgrade", user, content, extraCss, script }));
});

module.exports = router;
