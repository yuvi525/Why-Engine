import { NextResponse } from "next/server";

/**
 * POST /api/auth/setup
 *
 * Called from the signup page AFTER Supabase Auth creates the user.
 * Creates an org and links the user as owner.
 *
 * Body: { user_id: string, org_name: string }
 *
 * Uses service role key — bypasses RLS — safe because we validate
 * that user_id matches a real auth user before inserting.
 */

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

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { user_id, org_name } = body;
  if (!user_id || !org_name?.trim()) {
    return NextResponse.json({ error: "user_id and org_name required" }, { status: 400 });
  }

  const sb = getSB();
  if (!sb) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  // Verify the user actually exists in auth.users
  const { data: authUser, error: authErr } = await sb.auth.admin.getUserById(user_id);
  if (authErr || !authUser?.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Create org
  const { data: org, error: orgErr } = await sb
    .from("orgs")
    .insert([{ name: org_name.trim(), plan: "free" }])
    .select("id")
    .single();

  if (orgErr) {
    return NextResponse.json({ error: `Org creation failed: ${orgErr.message}` }, { status: 500 });
  }

  // Link user as owner
  const { error: memberErr } = await sb
    .from("org_members")
    .insert([{ org_id: org.id, user_id, role: "owner" }]);

  if (memberErr) {
    return NextResponse.json({ error: `Membership creation failed: ${memberErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, org_id: org.id });
}
