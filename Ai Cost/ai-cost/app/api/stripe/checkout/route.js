import { NextResponse } from "next/server";
import { getUser, getUserOrg } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Hosted Checkout session and returns the redirect URL.
 *
 * Body: { plan: "growth" | "scale" }
 *
 * Auth: JWT required (identifies the org to upgrade).
 *
 * Response: { url: string }
 */
export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const { plan } = body;
  if (!plan || !["growth", "scale"].includes(plan)) {
    return NextResponse.json({ error: "plan must be 'growth' or 'scale'." }, { status: 400 });
  }

  // ── Require auth ──────────────────────────────────────────────────────
  const user  = await getUser(request);
  const orgId = user ? await getUserOrg(user.id) : null;

  if (!orgId) {
    return NextResponse.json(
      { error: "Sign in required to upgrade.", redirectTo: "/login" },
      { status: 401 }
    );
  }

  // ── Create Stripe Checkout session ────────────────────────────────────
  try {
    const { url } = await createCheckoutSession(orgId, plan, user?.email);
    return NextResponse.json({ url });
  } catch (err) {
    const msg = err?.message || "Failed to create checkout session.";
    const isConfig = msg.includes("not configured") || msg.includes("not set");
    console.error("[stripe/checkout]", msg);
    return NextResponse.json({ error: msg }, { status: isConfig ? 503 : 500 });
  }
}
