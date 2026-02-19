// src/routes/stripe.js
const express = require("express");
const router = express.Router();
const {
  stripe,
  WEBHOOK_SECRET,
  createCheckoutSession,
  isEarlyBirdAvailable
} = require("../utils/stripe");
const { getUserById, updateUser, loadUsers } = require("../utils/storage");
const { page } = require("../utils/layout");
const requireAuth = require("../middleware/requireAuth");

// ─── POST /stripe/checkout ───
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    let { priceType } = req.body;
    if (!["early", "standard", "pay_per_use"].includes(priceType)) {
      return res.status(400).json({ success: false, error: "Tipo prezzo non valido" });
    }

    const { session, appliedType, wasFallback } = await createCheckoutSession(
      req.session.userId,
      priceType,
      req
    );

    res.json({ success: true, url: session.url, fallback: wasFallback, appliedType });
  } catch (err) {
    console.error(`[Stripe] Checkout fallito | user=${req.session.userId} | err=${err.message}`);
    res.status(500).json({ success: false, error: "Errore creazione sessione di pagamento" });
  }
});

// ─── GET /stripe/success ───
router.get("/success", requireAuth, async (req, res) => {
  const user = getUserById(req.session.userId);

  // Recupera dettagli sessione Stripe per mostrare cosa è stato acquistato
  let purchaseInfo = { title: "Pagamento completato!", detail: "Il tuo piano è stato aggiornato con successo." };
  const sessionId = req.query.session_id;
  if (sessionId && stripe) {
    try {
      const stripeSession = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
      const priceType = stripeSession.metadata?.price_type;
      const amount = stripeSession.amount_total;
      const formattedAmount = amount ? (amount / 100).toFixed(2).replace(".", ",") + " €" : "";

      if (priceType === "pay_per_use") {
        purchaseInfo = {
          title: "Credito acquistato!",
          detail: `Hai acquistato 1 credito preventivo per ${formattedAmount}. Puoi generare subito un nuovo preventivo.`,
          cta: { label: "Genera preventivo", href: "/quotes/new" }
        };
      } else if (priceType === "early") {
        purchaseInfo = {
          title: "Benvenuto Early Bird!",
          detail: `Abbonamento attivato a ${formattedAmount}/mese. Hai accesso a preventivi illimitati e tutte le funzionalità premium.`,
          cta: { label: "Vai alla Dashboard", href: "/dashboard" }
        };
      } else if (priceType === "standard") {
        purchaseInfo = {
          title: "Piano Standard attivato!",
          detail: `Abbonamento attivato a ${formattedAmount}/mese. Hai accesso a preventivi illimitati e tutte le funzionalità premium.`,
          cta: { label: "Vai alla Dashboard", href: "/dashboard" }
        };
      }
    } catch (err) {
      console.error(`[Stripe] Errore recupero sessione ${sessionId}: ${err.message}`);
    }
  }

  const extraCss = `
    .success-wrap{max-width:520px;text-align:center;padding-top:60px}
    .success-icon{width:64px;height:64px;border-radius:50%;background:#dcfce7;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:2rem;color:#16a34a}
    .success-title{font-size:1.3rem;font-weight:700;margin-bottom:10px;color:#1e1e2d}
    .success-text{color:#6b7280;font-size:.9rem;margin-bottom:28px;line-height:1.6}
    .success-btn{display:inline-block;background:#2563eb;color:#fff;padding:12px 32px;border-radius:8px;font-size:.9rem;font-weight:500;text-decoration:none;transition:background .15s}
    .success-btn:hover{background:#1d4ed8}
    .success-sub{font-size:.78rem;color:#9ca3af;margin-top:16px}
  `;

  const ctaHref = purchaseInfo.cta ? purchaseInfo.cta.href : "/dashboard";
  const ctaLabel = purchaseInfo.cta ? purchaseInfo.cta.label : "Vai alla Dashboard";

  const content = `
  <div class="wrap success-wrap">
    <div class="success-icon">&#10003;</div>
    <div class="success-title">${purchaseInfo.title}</div>
    <p class="success-text">${purchaseInfo.detail}</p>
    <a href="${ctaHref}" class="success-btn">${ctaLabel}</a>
    <div class="success-sub">Verrai reindirizzato automaticamente tra 5 secondi</div>
  </div>`;

  const script = `setTimeout(function(){ window.location.href = '${ctaHref}'; }, 5000);`;
  res.send(page({ title: "Pagamento completato", user, content, extraCss, script }));
});

// ─── GET /stripe/cancel ───
router.get("/cancel", requireAuth, (req, res) => {
  const user = getUserById(req.session.userId);

  const extraCss = `
    .cancel-wrap{max-width:500px;text-align:center;padding-top:60px}
    .cancel-icon{width:64px;height:64px;border-radius:50%;background:#fef3c7;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:2rem;color:#d97706}
    .cancel-title{font-size:1.2rem;font-weight:700;margin-bottom:10px;color:#1e1e2d}
    .cancel-text{color:#6b7280;font-size:.9rem;margin-bottom:28px;line-height:1.6}
    .cancel-btn{display:inline-block;background:#2563eb;color:#fff;padding:12px 32px;border-radius:8px;font-size:.9rem;font-weight:500;text-decoration:none;transition:background .15s}
    .cancel-btn:hover{background:#1d4ed8}
  `;

  const content = `
  <div class="wrap cancel-wrap">
    <div class="cancel-icon">&#8617;</div>
    <div class="cancel-title">Pagamento annullato</div>
    <p class="cancel-text">Non è stato addebitato nulla. Puoi tornare alla pagina upgrade per scegliere un piano quando vuoi.</p>
    <a href="/upgrade" class="cancel-btn">Torna ai piani</a>
  </div>`;

  res.send(page({ title: "Pagamento annullato", user, content, extraCss }));
});

// ─── Trova utente per stripe_customer_id ───
function findUserByCustomerId(customerId) {
  return loadUsers().find(u => u.stripe_customer_id === customerId) || null;
}

// ─── POST /stripe/webhook ───
router.post("/webhook", async (req, res) => {
  if (!WEBHOOK_SECRET) {
    console.warn("[Stripe Webhook] STRIPE_WEBHOOK_SECRET mancante — evento ignorato");
    return res.status(200).json({ received: true, warning: "webhook_secret_missing" });
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) {
    console.error("[Stripe Webhook] Header stripe-signature assente");
    return res.status(400).json({ error: "Firma mancante" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error(`[Stripe Webhook] Firma rifiutata | err=${err.message}`);
    return res.status(400).json({ error: "Firma non valida" });
  }

  const eventId = event.id;
  const eventType = event.type;

  try {
    switch (eventType) {
      // ─── Checkout completato ───
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const priceType = session.metadata?.price_type;

        if (!userId) {
          console.warn(`[Stripe Webhook] ${eventId} | checkout senza user_id, ignorato`);
          break;
        }

        if (priceType === "pay_per_use") {
          const user = getUserById(userId);
          const prev = (user && user.credits) || 0;
          updateUser(userId, {
            plan: user.plan === "free" ? "pay_per_use" : user.plan,
            credits: prev + 1
          });
          console.log(`[Stripe Webhook] ${eventId} | CREDITO +1 | user=${userId} | crediti=${prev}→${prev + 1}`);
        } else {
          updateUser(userId, {
            plan: priceType,
            subscription_id: session.subscription || null,
            subscription_status: "active"
          });
          console.log(`[Stripe Webhook] ${eventId} | PIANO ATTIVATO | user=${userId} | plan=${priceType} | sub=${session.subscription}`);
        }
        break;
      }

      // ─── Rinnovo confermato ───
      case "invoice.paid": {
        const invoice = event.data.object;
        if (!invoice.subscription) break;
        const user = findUserByCustomerId(invoice.customer);
        if (user) {
          updateUser(user.id, { subscription_status: "active" });
          console.log(`[Stripe Webhook] ${eventId} | RINNOVO OK | user=${user.id} | sub=${invoice.subscription} | amount=${invoice.amount_paid}`);
        } else {
          console.warn(`[Stripe Webhook] ${eventId} | invoice.paid per customer sconosciuto ${invoice.customer}`);
        }
        break;
      }

      // ─── Abbonamento cancellato ───
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const user = findUserByCustomerId(sub.customer);
        if (user) {
          const oldPlan = user.plan;
          updateUser(user.id, {
            plan: "free",
            subscription_id: null,
            subscription_status: "canceled"
          });
          console.log(`[Stripe Webhook] ${eventId} | CANCELLAZIONE | user=${user.id} | ${oldPlan}→free`);
        } else {
          console.warn(`[Stripe Webhook] ${eventId} | subscription.deleted per customer sconosciuto ${sub.customer}`);
        }
        break;
      }

      // ─── Pagamento fallito ───
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const user = findUserByCustomerId(invoice.customer);
        console.error(`[Stripe Webhook] ${eventId} | PAGAMENTO FALLITO | customer=${invoice.customer} | user=${user?.id || "?"} | sub=${invoice.subscription} | attempt=${invoice.attempt_count}`);
        break;
      }

      default:
        // Non loggare eventi non gestiti per evitare rumore
        break;
    }
  } catch (err) {
    console.error(`[Stripe Webhook] ${eventId} | ERRORE INTERNO | type=${eventType} | err=${err.message}`);
  }

  res.json({ received: true });
});

module.exports = router;
