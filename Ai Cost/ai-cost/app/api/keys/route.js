import { NextResponse } from "next/server";
import { getUser, getUserOrg } from "@/lib/auth";
import { createKey, listKeys } from "@/lib/api-key-manager";

/**
 * GET /api/keys  — list all keys for authenticated user's org
 * POST /api/keys — create a new key, returns rawKey once
 *
 * Both routes require a valid Supabase JWT.
 */

async function resolveOrg(request) {
  const user = await getUser(request);
  if (!user) return { user: null, orgId: null };
  const orgId = await getUserOrg(user.id);
  return { user, orgId };
}

export async function GET(request) {
  const { orgId } = await resolveOrg(request);
  if (!orgId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const keys = await listKeys(orgId);
  return NextResponse.json({ keys });
}

export async function POST(request) {
  const { orgId } = await resolveOrg(request);
  if (!orgId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body = {};
  try { body = await request.json(); } catch { /* name is optional */ }

  const name = String(body?.name || "").trim() || "API Key";
  const result = await createKey(orgId, name);

  if (!result) {
    return NextResponse.json({ error: "Failed to create API key." }, { status: 500 });
  }

  return NextResponse.json({
    id:         result.id,
    name,
    prefix:     result.prefix,
    rawKey:     result.rawKey,   // returned ONCE — caller must store immediately
    createdAt:  result.createdAt,
    note:       "Save this key now — it will never be shown again.",
  }, { status: 201 });
}
