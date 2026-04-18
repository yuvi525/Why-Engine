/**
 * lib/db.js
 *
 * Canonical server-side Supabase client (service role).
 * Never import this in client components — use lib/supabase-browser.js instead.
 *
 * SAFE MODE: If environment variables are missing, exports `null` and logs a
 * clear warning. The app continues running in demo mode — no crash.
 *
 * Required .env.local variables:
 *   NEXT_PUBLIC_SUPABASE_URL      = https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY     = eyJ...  (service_role key, NOT anon key)
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL   || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY  || "";

const configured = Boolean(url && key);

if (!configured) {
  console.warn(
    "[db] Supabase configuration missing.\n" +
    "  Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local\n" +
    "  The app will run in demo/fallback mode — DB writes are disabled."
  );
}

/**
 * Server-only Supabase client.
 * `null` when env vars are absent (demo mode) — all callers must guard with:
 *   const sb = getSupabase(); if (!sb) return;
 */
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession:    false,
        autoRefreshToken:  false,
        detectSessionInUrl: false,
      },
    })
  : null;

if (configured) {
  console.log("[db] Supabase client initialized successfully.");
}

/**
 * getSupabase()
 * Safe accessor — returns the client or null.
 * Prefer this over importing `supabase` directly when callers need to
 * handle the missing-config case explicitly.
 */
export function getSupabase() {
  return supabase;
}

/**
 * isConfigured()
 * Quick boolean check used by health/validate routes.
 */
export function isConfigured() {
  return configured;
}
