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
 * PATCH /api/autopilot/rules/[id]
 * Toggle enabled state or update a rule field.
 * Body: { enabled?: boolean, name?: string, config?: object }
 */
export async function PATCH(request, { params }) {
  const user  = await getUser(request);
  const orgId = user ? await getUserOrg(user.id) : null;
  if (!orgId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const ruleId = params?.id;
  if (!ruleId) return NextResponse.json({ error: "Rule ID required." }, { status: 400 });

  let body = {};
  try { body = await request.json(); } catch { /* pass */ }

  const updates = {};
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
  if (typeof body.name   === "string")   updates.name    = body.name.trim();
  if (typeof body.config === "object")   updates.config  = body.config;

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const sb = getSB();
  const { data, error } = await sb
    .from("autopilot_rules")
    .update(updates)
    .eq("id", ruleId)
    .eq("org_id", orgId)   // org-scoped — can only update own rules
    .select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Rule not found." }, { status: 404 });

  return NextResponse.json(data);
}

/**
 * DELETE /api/autopilot/rules/[id]
 */
export async function DELETE(request, { params }) {
  const user  = await getUser(request);
  const orgId = user ? await getUserOrg(user.id) : null;
  if (!orgId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const sb = getSB();
  const { error } = await sb
    .from("autopilot_rules")
    .delete()
    .eq("id", params?.id)
    .eq("org_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
