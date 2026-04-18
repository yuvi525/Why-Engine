/**
 * lib/auth.js
 *
 * Server-side auth helpers for WHY Engine.
 *
 * BACKWARD COMPATIBLE — every function returns null on any failure.
 * No existing API will break if these return null.
 *
 * SQL schema (run once in Supabase SQL editor):
 * ─────────────────────────────────────────────
 * CREATE TABLE IF NOT EXISTS orgs (
 *   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   name       text NOT NULL,
 *   plan       text NOT NULL DEFAULT 'free',
 *   created_at timestamptz DEFAULT now()
 * );
 *
 * CREATE TABLE IF NOT EXISTS org_members (
 *   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   org_id     uuid REFERENCES orgs(id) ON DELETE CASCADE,
 *   user_id    uuid NOT NULL,
 *   role       text NOT NULL DEFAULT 'owner',
 *   created_at timestamptz DEFAULT now(),
 *   UNIQUE(org_id, user_id)
 * );
 *
 * ALTER TABLE ai_usage_logs    ADD COLUMN IF NOT EXISTS org_id uuid;
 * ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS org_id uuid;
 * ─────────────────────────────────────────────
 *
 * Env vars required:
 *   NEXT_PUBLIC_SUPABASE_URL      — already in .env.local
 *   SUPABASE_SERVICE_ROLE_KEY     — already in .env.local
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — add to .env.local (from Supabase dashboard)
 */

import { createClient } from "@supabase/supabase-js";

// ── Service-role client (server only) ─────────────────────────────────────
let _serviceClient = null;
function getServiceClient() {
  if (_serviceClient) return _serviceClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return _serviceClient;
}

// ─────────────────────────────────────────────────────────────────────────
// getUser(request)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Extract and validate the Supabase user from an incoming API request.
 *
 * Reads the JWT from (in priority order):
 *   1. Authorization: Bearer <token>  header
 *   2. sb-access-token cookie
 *
 * Uses the service-role client's auth.getUser() to validate the token —
 * this hits Supabase and confirms the token is live (not expired/revoked).
 *
 * Returns null on ANY failure — caller always falls back to anonymous mode.
 *
 * @param {Request} request - Next.js App Router request object
 * @returns {Promise<object|null>} Supabase user object or null
 */
export async function getUser(request) {
  try {
    const sb = getServiceClient();
    if (!sb) return null;

    // 1. Authorization header
    let token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

    // 2. Cookie fallback
    if (!token) {
      const cookieHeader = request.headers.get("cookie") || "";
      const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }

    if (!token) return null;

    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return null;

    return data.user;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// getUserOrg(userId)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Look up the primary org for a user (their first/only org).
 *
 * @param {string} userId - Supabase auth user ID
 * @returns {Promise<string|null>} org_id or null
 */
export async function getUserOrg(userId) {
  try {
    const sb = getServiceClient();
    if (!sb || !userId) return null;

    const { data, error } = await sb
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data.org_id;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// getOrgPlan(orgId)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Fetch the current plan for an org.
 *
 * @param {string} orgId
 * @returns {Promise<"free"|"growth"|"scale"|null>}
 */
export async function getOrgPlan(orgId) {
  try {
    const sb = getServiceClient();
    if (!sb || !orgId) return null;

    const { data, error } = await sb
      .from("orgs")
      .select("plan")
      .eq("id", orgId)
      .maybeSingle();

    if (error || !data) return null;
    return data.plan;
  } catch {
    return null;
  }
}
