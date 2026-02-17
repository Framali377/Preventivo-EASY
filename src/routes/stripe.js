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

    // Se early non disponibile, notifica il client del fallback
    let fallback = false;
    if (priceType === "early" && !isEarlyBirdAvailable()) {
      priceType = "standard";
      fallback = true;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const session = await createCheckoutSession(req.session.userId, priceType, baseUrl);
    res.json({ success: true, url: session.url, fallback });
  } catch (err) {
    console.error("[Stripe] Errore checkout:", err.message);
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

// ─── POST /stripe/webhook ───
router.post("/webhook", async (req, res) => {
  // Verifica firma OBBLIGATORIA
  if (!WEBHOOK_SECRET) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET mancante nel file chiavi");
    return res.status(500).json({ error: "Webhook non configurato" });
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) {
    console.error("[Stripe Webhook] Header stripe-signature mancante");
    return res.status(400).json({ error: "Firma mancante" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("[Stripe Webhook] Firma non valida:", err.message);
    return res.status(400).json({ error: `Firma non valida: ${err.message}` });
  }

  // ─── Gestione eventi ───
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const priceType = session.metadata?.price_type;
        if (!userId) {
          console.warn("[Stripe Webhook] checkout.session.completed senza user_id");
          break;
        }

        if (priceType === "pay_per_use") {
          const user = getUserById(userId);
          const currentCredits = (user && user.credits) || 0;
          updateUser(userId, {
            plan: user.plan === "free" ? "pay_per_use" : user.plan,
            credits: currentCredits + 1
          });
          console.log(`[Stripe] +1 credito pay-per-use → utente ${userId} (totale: ${currentCredits + 1})`);
        } else {
          // early o standard
          updateUser(userId, {
            plan: priceType,
            subscription_id: session.subscription || null,
            subscription_status: "active"
          });
          console.log(`[Stripe] Piano "${priceType}" attivato → utente ${userId}`);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        if (!invoice.subscription) break;
        const customerId = invoice.customer;
        const users = loadUsers();
        const user = users.find(u => u.stripe_customer_id === customerId);
        if (user) {
          updateUser(user.id, { subscription_status: "active" });
          console.log(`[Stripe] Rinnovo confermato → utente ${user.id}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const users = loadUsers();
        const user = users.find(u => u.stripe_customer_id === customerId);
        if (user) {
          updateUser(user.id, {
            plan: "free",
            subscription_id: null,
            subscription_status: "canceled"
          });
          console.log(`[Stripe] Abbonamento cancellato → utente ${user.id}, downgrade a free`);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Evento ignorato: ${event.type}`);
    }
  } catch (err) {
    console.error("[Stripe Webhook] Errore gestione evento:", err.message);
  }

  res.json({ received: true });
});

module.exports = router;
