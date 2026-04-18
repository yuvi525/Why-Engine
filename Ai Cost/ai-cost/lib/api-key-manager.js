/**
 * lib/api-key-manager.js
 *
 * API key generation and validation for WHY Engine.
 *
 * Key format:  whe_<32 url-safe base64 chars>
 * Storage:     sha256(rawKey) stored as key_hash — raw key NEVER persisted
 * Prefix:      first 12 chars of rawKey stored for display (e.g. "whe_aB3xYz9k")
 *
 * SQL schema (run once in Supabase SQL editor):
 * ──────────────────────────────────────────────────────
 * CREATE TABLE IF NOT EXISTS api_keys (
 *   id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   org_id       uuid,
 *   name         text,
 *   key_hash     text NOT NULL UNIQUE,
 *   key_prefix   text NOT NULL,
 *   created_at   timestamptz DEFAULT now(),
 *   last_used_at timestamptz,
 *   revoked_at   timestamptz
 * );
 *
 * CREATE TABLE IF NOT EXISTS api_key_usage (
 *   id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   key_id       uuid REFERENCES api_keys(id),
 *   org_id       uuid,
 *   endpoint     text NOT NULL,
 *   tokens_used  integer  DEFAULT 0,
 *   cost_usd     numeric(10,6) DEFAULT 0,
 *   created_at   timestamptz DEFAULT now()
 * );
 *
 * CREATE INDEX ON api_keys (key_hash);
 * CREATE INDEX ON api_key_usage (key_id);
 * CREATE INDEX ON api_key_usage (org_id, created_at DESC);
 * ──────────────────────────────────────────────────────
 */

import crypto from "crypto";

const KEY_PREFIX = "whe_";
const KEY_BYTES  = 24; // → 32 url-safe base64 chars

// ── Lazy Supabase (service role) ──────────────────────────────────────────
let _sb = null;
function getSupabase() {
  if (_sb) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require("@supabase/supabase-js");
  _sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return _sb;
}

// ── Internal: hash a raw key ──────────────────────────────────────────────
function hashKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────
// generateKey()
// ─────────────────────────────────────────────────────────────────────────
/**
 * Generates a new raw API key.
 * The rawKey is returned ONCE — the caller must display it immediately.
 * Only the hash and prefix are stored.
 *
 * @returns {{ rawKey: string, hash: string, prefix: string }}
 */
export function generateKey() {
  const random = crypto.randomBytes(KEY_BYTES).toString("base64url");
  const rawKey = `${KEY_PREFIX}${random}`;
  const hash   = hashKey(rawKey);
  const prefix = rawKey.slice(0, 12); // "whe_" + first 8 chars
  return { rawKey, hash, prefix };
}

// ─────────────────────────────────────────────────────────────────────────
// validateKey(authorizationHeader)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Validates an API key from an Authorization header.
 *
 * Accepts:
 *   Authorization: Bearer whe_xxxx
 *   Authorization: whe_xxxx          (bare token, no "Bearer" prefix)
 *
 * Returns:
 *   { valid: false }                              — missing / invalid / revoked
 *   { valid: true, orgId, keyId }                 — active key
 *
 * @param {string|null} header - Value of the Authorization header
 * @returns {Promise<{ valid: boolean, orgId?: string, keyId?: string }>}
 */
export async function validateKey(header) {
  if (!header) return { valid: false };

  // Extract token
  const token = header.replace(/^Bearer\s+/i, "").trim();

  // Fast reject — must start with our prefix
  if (!token.startsWith(KEY_PREFIX)) return { valid: false };

  const sb = getSupabase();
  if (!sb) {
    console.warn("[api-key-manager] DB not configured — key validation skipped");
    return { valid: false };
  }

  const hash = hashKey(token);

  const { data, error } = await sb
    .from("api_keys")
    .select("id, org_id, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();

  if (error) {
    console.error("[api-key-manager] validateKey DB error:", error.message);
    return { valid: false };
  }

  if (!data)            return { valid: false };       // key not found
  if (data.revoked_at)  return { valid: false };       // revoked

  // Update last_used_at — fire-and-forget
  sb.from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return { valid: true, orgId: data.org_id, keyId: data.id };
}

// ─────────────────────────────────────────────────────────────────────────
// createKey(orgId, name)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Generates and persists a new API key for an org.
 * Returns the rawKey for one-time display — not stored.
 *
 * @param {string} orgId
 * @param {string} [name] - Human-readable label
 * @returns {Promise<{ rawKey: string, prefix: string, id: string, createdAt: string } | null>}
 */
export async function createKey(orgId, name = "Default") {
  const sb = getSupabase();
  if (!sb) return null;

  const { rawKey, hash, prefix } = generateKey();

  const { data, error } = await sb
    .from("api_keys")
    .insert([{ org_id: orgId, name, key_hash: hash, key_prefix: prefix }])
    .select("id, created_at")
    .single();

  if (error) {
    console.error("[api-key-manager] createKey insert failed:", error.message);
    return null;
  }

  return { rawKey, prefix, id: data.id, createdAt: data.created_at };
}

// ─────────────────────────────────────────────────────────────────────────
// revokeKey(keyId, orgId)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Soft-revokes a key. The row stays in DB for audit trail.
 * orgId scoping ensures an org can only revoke its own keys.
 *
 * @param {string} keyId
 * @param {string} orgId - Safety scope: only revoke if key belongs to this org
 * @returns {Promise<boolean>}
 */
export async function revokeKey(keyId, orgId) {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("org_id", orgId)     // safety scope — can only revoke own keys
    .is("revoked_at", null); // idempotent — don't double-revoke

  if (error) {
    console.error("[api-key-manager] revokeKey failed:", error.message);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// listKeys(orgId)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Returns all keys for an org (active + revoked) for display.
 * Never returns key_hash.
 *
 * @param {string} orgId
 * @returns {Promise<Array>}
 */
export async function listKeys(orgId) {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("api_keys")
    .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api-key-manager] listKeys failed:", error.message);
    return [];
  }
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────
// trackUsage(keyId, orgId, endpoint, tokensUsed, costUsd)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Fire-and-forget usage tracking. Never throws.
 *
 * @param {string} keyId
 * @param {string|null} orgId
 * @param {string} endpoint
 * @param {number} tokensUsed
 * @param {number} costUsd
 */
export function trackUsage(keyId, orgId, endpoint, tokensUsed = 0, costUsd = 0) {
  const sb = getSupabase();
  if (!sb || !keyId) return;

  sb.from("api_key_usage")
    .insert([{
      key_id:      keyId,
      org_id:      orgId || null,
      endpoint,
      tokens_used: Math.round(tokensUsed),
      cost_usd:    parseFloat(Number(costUsd).toFixed(6)),
    }])
    .then(({ error }) => {
      if (error) console.error("[api-key-manager] trackUsage failed:", error.message);
    });
}
