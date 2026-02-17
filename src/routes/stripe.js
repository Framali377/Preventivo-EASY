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

  const extraCss = `
    .success-wrap{max-width:500px;text-align:center;padding-top:60px}
    .success-icon{font-size:3rem;margin-bottom:16px;color:#22c55e}
    .success-title{font-size:1.3rem;font-weight:700;margin-bottom:8px}
    .success-text{color:#6b7280;font-size:.9rem;margin-bottom:24px}
  `;

  const content = `
  <div class="wrap success-wrap">
    <div class="success-icon">&#10003;</div>
    <div class="success-title">Pagamento completato!</div>
    <p class="success-text">Il tuo piano è stato aggiornato con successo. Verrai reindirizzato alla dashboard tra pochi secondi.</p>
    <a href="/dashboard" class="btn btn-primary">Vai alla Dashboard</a>
  </div>`;

  const script = `setTimeout(function(){ window.location.href = '/dashboard'; }, 4000);`;
  res.send(page({ title: "Pagamento completato", user, content, extraCss, script }));
});

// ─── Trova utente per stripe_customer_id ───
function findUserByCustomerId(customerId) {
  return loadUsers().find(u => u.stripe_customer_id === customerId) || null;
}

// ─── POST /stripe/webhook ───
router.post("/webhook", async (req, res) => {
  if (!WEBHOOK_SECRET) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET mancante");
    return res.status(500).json({ error: "Webhook non configurato" });
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
