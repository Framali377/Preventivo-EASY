// src/routes/stripe.js
const express = require("express");
const router = express.Router();
const { stripe, createCheckoutSession } = require("../utils/stripe");
const { getUserById, updateUser } = require("../utils/storage");
const { page } = require("../utils/layout");
const requireAuth = require("../middleware/requireAuth");

// POST /stripe/checkout — Crea Checkout Session
router.post("/checkout", requireAuth, async (req, res) => {
  try {
    const { priceType } = req.body;
    if (!["early", "standard", "pay_per_use"].includes(priceType)) {
      return res.status(400).json({ success: false, error: "Tipo prezzo non valido" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const session = await createCheckoutSession(req.session.userId, priceType, baseUrl);
    res.json({ success: true, url: session.url });
  } catch (err) {
    console.error("[Stripe] Errore checkout:", err.message);
    res.status(500).json({ success: false, error: "Errore creazione sessione di pagamento" });
  }
});

// GET /stripe/success — Pagina di successo
router.get("/success", requireAuth, async (req, res) => {
  const user = getUserById(req.session.userId);

  const extraCss = `
    .success-wrap{max-width:500px;text-align:center;padding-top:60px}
    .success-icon{font-size:3rem;margin-bottom:16px}
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

// POST /stripe/webhook — Webhook Stripe
router.post("/webhook", async (req, res) => {
  let event;

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const sig = req.headers["stripe-signature"];
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("[Stripe Webhook] Firma non valida:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    // In sviluppo senza webhook secret, accetta l'evento direttamente
    event = req.body;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata.user_id;
        const priceType = session.metadata.price_type;

        if (!userId) break;

        if (priceType === "pay_per_use") {
          // Aggiungi 1 credito
          const user = getUserById(userId);
          const currentCredits = (user && user.credits) || 0;
          updateUser(userId, {
            plan: user.plan === "free" ? "pay_per_use" : user.plan,
            credits: currentCredits + 1
          });
          console.log(`[Stripe] +1 credito per utente ${userId}`);
        } else {
          // Abbonamento early o standard
          const subscriptionId = session.subscription;
          updateUser(userId, {
            plan: priceType, // "early" o "standard"
            subscription_id: subscriptionId,
            subscription_status: "active"
          });
          console.log(`[Stripe] Piano ${priceType} attivato per utente ${userId}`);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) break;

        const customerId = invoice.customer;
        // Trova utente per stripe_customer_id
        const { loadUsers } = require("../utils/storage");
        const users = loadUsers();
        const user = users.find(u => u.stripe_customer_id === customerId);
        if (user) {
          updateUser(user.id, { subscription_status: "active" });
          console.log(`[Stripe] Rinnovo confermato per utente ${user.id}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { loadUsers } = require("../utils/storage");
        const users = loadUsers();
        const user = users.find(u => u.stripe_customer_id === customerId);
        if (user) {
          updateUser(user.id, {
            plan: "free",
            subscription_id: null,
            subscription_status: "canceled"
          });
          console.log(`[Stripe] Abbonamento cancellato per utente ${user.id}`);
        }
        break;
      }
    }
  } catch (err) {
    console.error("[Stripe Webhook] Errore gestione evento:", err.message);
  }

  res.json({ received: true });
});

module.exports = router;
