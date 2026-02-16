// src/utils/stripe.js
const Stripe = require("stripe");
const { getUserById, updateUser } = require("./storage");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  early: {
    mode: "subscription",
    price_data: {
      currency: "eur",
      unit_amount: 500, // 5,00 €
      recurring: { interval: "month" },
      product_data: { name: "Preventivo AI — Early Bird" }
    }
  },
  standard: {
    mode: "subscription",
    price_data: {
      currency: "eur",
      unit_amount: 899, // 8,99 €
      recurring: { interval: "month" },
      product_data: { name: "Preventivo AI — Standard" }
    }
  },
  pay_per_use: {
    mode: "payment",
    price_data: {
      currency: "eur",
      unit_amount: 79, // 0,79 €
      product_data: { name: "Preventivo AI — Singolo preventivo" }
    }
  }
};

async function createCheckoutSession(userId, priceType, baseUrl) {
  const user = getUserById(userId);
  if (!user) throw new Error("Utente non trovato");

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
    line_items: [{
      price_data: config.price_data,
      quantity: 1
    }],
    success_url: `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/upgrade`,
    metadata: { user_id: userId, price_type: priceType }
  };

  return stripe.checkout.sessions.create(sessionParams);
}

module.exports = { stripe, createCheckoutSession, PRICES };
