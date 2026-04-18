import { NextResponse } from "next/server";
import { getUser, getUserOrg } from "@/lib/auth";
import { initStripe } from "@/lib/stripe";

let _sb = null;
function getSB() {
  if (_sb) return _sb;
  const { createClient } = require("@supabase/supabase-js");
  _sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return _sb;
}

/**
 * GET /api/stripe/portal
 * Redirects authenticated user to their Stripe Customer Portal.
 * Requires: org has a stripe_customer_id (i.e. has paid at least once).
 */
export async function GET(request) {
  const user  = await getUser(request);
  const orgId = user ? await getUserOrg(user.id) : null;
  if (!orgId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const sb = getSB();
  const { data } = await sb.from("orgs").select("stripe_customer_id").eq("id", orgId).maybeSingle();

  if (!data?.stripe_customer_id) {
    return NextResponse.redirect(new URL("/pricing", request.url));
  }

  try {
    const stripe  = initStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer:   data.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing`,
    });
    return NextResponse.redirect(session.url);
  } catch (err) {
    console.error("[stripe/portal]", err.message);
    return NextResponse.redirect(new URL("/pricing?error=portal_failed", request.url));
  }
}
