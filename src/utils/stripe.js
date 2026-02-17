// src/utils/stripe.js
const fs = require("fs");
const path = require("path");
const Stripe = require("stripe");
const { getUserById, updateUser, loadUsers } = require("./storage");

const IS_PROD = process.env.NODE_ENV === "production";

// ─── Caricamento chiavi Stripe ───
function loadStripeConfig() {
  if (IS_PROD) {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("Stripe env vars mancanti in produzione");
    }
    return {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
    };
  }

  // Localhost: file locale
  const KEYS_PATH = path.join(__dirname, "..", "..", "stripe.keys.local.json");
  if (!fs.existsSync(KEYS_PATH)) {
    throw new Error(
      "File stripe.keys.local.json mancante in locale"
    );
  }
  return JSON.parse(fs.readFileSync(KEYS_PATH, "utf-8"));
}

const keys = loadStripeConfig();
const stripe = new Stripe(keys.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = keys.STRIPE_WEBHOOK_SECRET;

// ─── Early Bird ───
const EARLY_BIRD_LIMIT = 100;

// ─── Prezzi ───
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

function getActiveSubscriberCount() {
  const users = loadUsers();
  return users.filter(
    u =>
      (u.plan === "early" || u.plan === "standard") &&
      u.subscription_status === "active"
  ).length;
}

function isEarlyBirdAvailable() {
  return getActiveSubscriberCount() < EARLY_BIRD_LIMIT;
}

/**
 * Costruisce baseUrl rispettando X-Forwarded-Proto (Render/proxy).
 */
function resolveBaseUrl(req) {
  const proto = req.get("x-forwarded-proto") || req.protocol;
  return `${proto}://${req.get("host")}`;
}

async function createCheckoutSession(userId, priceType, req) {
  const user = getUserById(userId);
  if (!user) throw new Error("Utente non trovato");

  const originalType = priceType;
  if (priceType === "early" && !isEarlyBirdAvailable()) {
    priceType = "standard";
    console.log(`[Stripe] Early Bird esaurito, fallback standard per utente ${userId}`);
  }

  const config = PRICES[priceType];
  if (!config) throw new Error("Tipo prezzo non valido");

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { user_id: userId }
    });
    customerId = customer.id;
    updateUser(userId, { stripe_customer_id: customerId });
    console.log(`[Stripe] Nuovo customer ${customerId} per utente ${userId}`);
  }

  const baseUrl = resolveBaseUrl(req);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: config.mode,
    line_items: [{ price_data: config.price_data, quantity: 1 }],
    success_url: `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/upgrade`,
    metadata: { user_id: userId, price_type: priceType }
  });

  console.log(`[Stripe] Checkout creato | session=${session.id} | user=${userId} | plan=${priceType} | amount=${config.price_data.unit_amount}`);
  return { session, appliedType: priceType, wasFallback: originalType !== priceType };
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
