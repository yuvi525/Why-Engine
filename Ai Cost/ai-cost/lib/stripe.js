/**
 * lib/stripe.js
 *
 * Stripe integration for WHY Engine.
 *
 * Setup checklist:
 * ────────────────────────────────────────────────────────────────
 * 1. Create account at https://stripe.com
 * 2. Create two products in Stripe Dashboard → Products:
 *      "WHY Engine Growth"  — recurring $12/month
 *      "WHY Engine Scale"   — recurring $49/month
 * 3. Copy Price IDs (price_xxx) into .env.local
 * 4. Add .env.local vars:
 *      STRIPE_SECRET_KEY=sk_live_xxx (or sk_test_xxx for dev)
 *      STRIPE_WEBHOOK_SECRET=whsec_xxx
 *      NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
 *      STRIPE_PRICE_GROWTH_ID=price_xxx
 *      STRIPE_PRICE_SCALE_ID=price_xxx
 * 5. Register webhook in Stripe Dashboard → Webhooks:
 *      URL: https://your-app.vercel.app/api/stripe/webhook
 *      Events: checkout.session.completed, customer.subscription.deleted
 * ────────────────────────────────────────────────────────────────
 *
 * SQL (run once in Supabase):
 * ALTER TABLE orgs ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';
 * ALTER TABLE orgs ADD COLUMN IF NOT EXISTS stripe_customer_id text;
 */

import Stripe from "stripe";

// ── Constants ─────────────────────────────────────────────────────────────
export const PLANS = {
  free:   { name: "Free",   price: 0,  priceId: null },
  growth: { name: "Growth", price: 12, priceId: process.env.STRIPE_PRICE_GROWTH_ID || "" },
  scale:  { name: "Scale",  price: 49, priceId: process.env.STRIPE_PRICE_SCALE_ID  || "" },
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ── Lazy Stripe client ────────────────────────────────────────────────────
let _stripe = null;
export function initStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  _stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  return _stripe;
}

// ── Lazy Supabase (service role) ──────────────────────────────────────────
let _sb = null;
function getSupabase() {
  if (_sb) return _sb;
  const { createClient } = require("@supabase/supabase-js");
  _sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return _sb;
}

// ─────────────────────────────────────────────────────────────────────────
// createCheckoutSession(orgId, planKey, userEmail?)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Creates a Stripe Hosted Checkout session.
 * Returns the session URL to redirect the user to.
 *
 * @param {string} orgId    - Organisation ID (attached to session metadata)
 * @param {"growth"|"scale"} planKey - Which plan to subscribe to
 * @param {string} [userEmail]       - Pre-fill email on checkout page
 * @returns {Promise<{ url: string, sessionId: string }>}
 */
export async function createCheckoutSession(orgId, planKey, userEmail) {
  const stripe = initStripe();
  const plan   = PLANS[planKey];

  if (!plan || !plan.priceId) {
    throw new Error(`Invalid plan "${planKey}" or price ID not configured. Set STRIPE_PRICE_${planKey.toUpperCase()}_ID.`);
  }

  const sessionParams = {
    mode:                 "subscription",
    payment_method_types: ["card"],
    line_items: [{
      price:    plan.priceId,
      quantity: 1,
    }],
    metadata: {
      org_id: orgId,
      plan:   planKey,
    },
    client_reference_id: orgId,
    success_url: `${APP_URL}/dashboard?upgrade=success&plan=${planKey}`,
    cancel_url:  `${APP_URL}/pricing?upgrade=cancelled`,
    allow_promotion_codes: true,
  };

  // Pre-fill email if we have it
  if (userEmail) sessionParams.customer_email = userEmail;

  const session = await stripe.checkout.sessions.create(sessionParams);
  return { url: session.url, sessionId: session.id };
}

// ─────────────────────────────────────────────────────────────────────────
// handleWebhook(event)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Processes verified Stripe webhook events.
 * Called by the webhook route AFTER signature verification.
 *
 * Handles:
 *   checkout.session.completed    → upgrade org plan
 *   customer.subscription.deleted → downgrade org to free
 *
 * @param {Stripe.Event} event
 * @returns {Promise<{ handled: boolean, action: string }>}
 */
export async function handleWebhook(event) {
  const sb = getSupabase();

  switch (event.type) {

    // ── Successful checkout → activate plan ───────────────────────────
    case "checkout.session.completed": {
      const session    = event.data.object;
      const orgId      = session.metadata?.org_id;
      const plan       = session.metadata?.plan;
      const customerId = session.customer;

      if (!orgId || !plan) {
        console.warn("[stripe] checkout.session.completed missing org_id/plan in metadata");
        return { handled: false, action: "missing_metadata" };
      }

      const { error } = await sb
        .from("orgs")
        .update({
          plan:               plan,
          stripe_customer_id: customerId,
        })
        .eq("id", orgId);

      if (error) {
        console.error("[stripe] upgrade org failed:", error.message);
        return { handled: false, action: "db_error" };
      }

      console.log(`[stripe] org ${orgId} upgraded to ${plan} (customer: ${customerId})`);
      return { handled: true, action: `upgraded_to_${plan}` };
    }

    // ── Subscription deleted → downgrade to free ─────────────────────
    case "customer.subscription.deleted": {
      const sub        = event.data.object;
      const customerId = sub.customer;

      const { error } = await sb
        .from("orgs")
        .update({ plan: "free" })
        .eq("stripe_customer_id", customerId);

      if (error) {
        console.error("[stripe] downgrade org failed:", error.message);
        return { handled: false, action: "db_error" };
      }

      console.log(`[stripe] org with customer ${customerId} downgraded to free`);
      return { handled: true, action: "downgraded_to_free" };
    }

    default:
      // Acknowledge but don't act on unhandled events
      return { handled: false, action: `unhandled_event: ${event.type}` };
  }
}
