import { NextResponse } from "next/server";
import { getUser, getUserOrg } from "@/lib/auth";

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
 * GET /api/auth/me
 * Returns basic identity + plan for the authenticated user.
 * Used by the pricing page and dashboard to show current plan.
 */
export async function GET(request) {
  const user  = await getUser(request);
  const orgId = user ? await getUserOrg(user.id) : null;

  if (!user || !orgId) {
    return NextResponse.json({ authenticated: false, plan: null });
  }

  const sb = getSB();
  let plan = "free";

  if (sb) {
    const { data } = await sb.from("orgs").select("plan").eq("id", orgId).maybeSingle();
    plan = data?.plan || "free";
  }

  return NextResponse.json({
    authenticated: true,
    userId:  user.id,
    email:   user.email,
    orgId,
    plan,
  });
}
