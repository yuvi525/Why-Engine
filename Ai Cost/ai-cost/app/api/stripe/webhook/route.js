import { NextResponse } from "next/server";
import { initStripe, handleWebhook } from "@/lib/stripe";

/**
 * POST /api/stripe/webhook
 *
 * Receives and verifies Stripe webhook events.
 *
 * CRITICAL: Stripe signature verification requires the RAW request body.
 * We use request.text() — never request.json() — in this route.
 *
 * Register this URL in Stripe Dashboard → Webhooks:
 *   https://your-app.vercel.app/api/stripe/webhook
 *
 * Events to enable:
 *   • checkout.session.completed
 *   • customer.subscription.deleted
 *
 * Set STRIPE_WEBHOOK_SECRET from the signing secret shown in Stripe Dashboard.
 */

// Next.js App Router — disable body parsing so we get raw bytes.
export const runtime = "nodejs";

export async function POST(request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  // ── Read raw body (required for signature verification) ───────────────
  const rawBody  = await request.text();
  const sigHeader = request.headers.get("stripe-signature");

  if (!sigHeader) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  // ── Verify signature ──────────────────────────────────────────────────
  let event;
  try {
    const stripe = initStripe();
    event = stripe.webhooks.constructEvent(rawBody, sigHeader, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: `Webhook verification failed: ${err.message}` }, { status: 400 });
  }

  // ── Handle event ──────────────────────────────────────────────────────
  try {
    const result = await handleWebhook(event);
    console.log(`[stripe/webhook] ${event.type} → ${result.action}`);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    // Return 200 to prevent Stripe from retrying — log the error instead.
    console.error("[stripe/webhook] handleWebhook error:", err.message);
    return NextResponse.json({ received: true, error: err.message });
  }
}
