import { NextResponse } from "next/server";
import { getUser, getUserOrg } from "@/lib/auth";
import { seedDefaultRules } from "@/lib/autopilot-engine";

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

async function resolve(request) {
  const user  = await getUser(request);
  const orgId = user ? await getUserOrg(user.id) : null;
  return { user, orgId };
}

/**
 * GET /api/autopilot/rules  — list rules + recent logs for org
 * POST /api/autopilot/rules — create a new rule
 */
export async function GET(request) {
  const { orgId } = await resolve(request);
  if (!orgId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const sb = getSB();
  if (!sb) return NextResponse.json({ error: "DB not configured." }, { status: 503 });

  const [rulesRes, logsRes] = await Promise.all([
    sb.from("autopilot_rules")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true }),
    sb.from("autopilot_log")
      .select("id, action, details, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    rules: rulesRes.data || [],
    logs:  logsRes.data  || [],
  });
}

export async function POST(request) {
  const { orgId } = await resolve(request);
  if (!orgId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body = {};
  try { body = await request.json(); } catch { /* pass */ }

  const sb = getSB();
  if (!sb) return NextResponse.json({ error: "DB not configured." }, { status: 503 });

  // Special: seed default rules for org
  if (body?.seed_defaults) {
    await seedDefaultRules(orgId);
    const { data } = await sb.from("autopilot_rules").select("*").eq("org_id", orgId).order("created_at");
    return NextResponse.json({ seeded: true, rules: data || [] }, { status: 201 });
  }

  const { name, trigger_type, action_type, config, enabled } = body;
  if (!name || !trigger_type || !action_type) {
    return NextResponse.json({ error: "name, trigger_type, action_type required." }, { status: 400 });
  }

  const { data, error } = await sb.from("autopilot_rules")
    .insert([{ org_id: orgId, name, trigger_type, action_type, config: config || {}, enabled: !!enabled }])
    .select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
