// src/utils/stripe.js
const fs = require("fs");
const path = require("path");
const Stripe = require("stripe");
const { getUserById, updateUser, loadUsers } = require("./storage");

// ─── Carica chiavi da file locale (mai committato) ───
const KEYS_PATH = path.join(__dirname, "..", "..", "stripe.keys.local.json");

function loadStripeKeys() {
  if (!fs.existsSync(KEYS_PATH)) {
    throw new Error(
      `File chiavi Stripe non trovato: ${KEYS_PATH}\n` +
      "Crea stripe.keys.local.json con STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET"
    );
  }
  return JSON.parse(fs.readFileSync(KEYS_PATH, "utf-8"));
}

const keys = loadStripeKeys();
const stripe = new Stripe(keys.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = keys.STRIPE_WEBHOOK_SECRET;

// ─── Soglia Early Bird ───
const EARLY_BIRD_LIMIT = 100;

// ─── Definizioni prezzi (inline price_data) ───
const PRICES = {
  early: {
    mode: "subscription",
    price_data: {
      currency: "eur",
      unit_amount: 500,
      recurring: { interval: "month" },
      product_data: { name: "Preventivo AI — Early Bird (5 €/mese)" }
    }
  },
  standard: {
    mode: "subscription",
    price_data: {
      currency: "eur",
      unit_amount: 899,
      recurring: { interval: "month" },
      product_data: { name: "Preventivo AI — Standard (8,99 €/mese)" }
    }
  },
  pay_per_use: {
    mode: "payment",
    price_data: {
      currency: "eur",
      unit_amount: 79,
      product_data: { name: "Preventivo AI — Singolo preventivo" }
    }
  }
};

/**
 * Conta gli abbonati attivi (early + standard) per la regola dei 100.
 */
function getActiveSubscriberCount() {
  const users = loadUsers();
  return users.filter(
    u => (u.plan === "early" || u.plan === "standard") && u.subscription_status === "active"
  ).length;
}

/**
 * Determina se Early Bird è ancora disponibile.
 */
function isEarlyBirdAvailable() {
  return getActiveSubscriberCount() < EARLY_BIRD_LIMIT;
}

/**
 * Crea una Checkout Session Stripe.
 * Se priceType è "early" ma il limite è raggiunto, forza "standard".
 */
async function createCheckoutSession(userId, priceType, baseUrl) {
  const user = getUserById(userId);
  if (!user) throw new Error("Utente non trovato");

  // Regola Early Bird: se esaurito, scala a standard
  if (priceType === "early" && !isEarlyBirdAvailable()) {
    priceType = "standard";
  }

  const config = PRICES[priceType];
  if (!config) throw new Error("Tipo prezzo non valido");

  // Crea o riusa Stripe Customer
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { user_id: userId }
    });
    customerId = customer.id;
    updateUser(userId, { stripe_customer_id: customerId });
  }

  const sessionParams = {
    customer: customerId,
    mode: config.mode,
    line_items: [{ price_data: config.price_data, quantity: 1 }],
    success_url: `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/upgrade`,
    metadata: { user_id: userId, price_type: priceType }
  };

  return stripe.checkout.sessions.create(sessionParams);
}

module.exports = {
  stripe,
  WEBHOOK_SECRET,
  PRICES,
  EARLY_BIRD_LIMIT,
  createCheckoutSession,
  getActiveSubscriberCount,
  isEarlyBirdAvailable
};
