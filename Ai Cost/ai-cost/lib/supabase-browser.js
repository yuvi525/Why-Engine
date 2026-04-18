/**
 * lib/supabase-browser.js
 *
 * Client-side Supabase singleton using the ANON key.
 * Import this ONLY in client components ('use client').
 *
 * Required env var (add to .env.local):
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 *   (find in Supabase Dashboard → Settings → API → anon public)
 */
import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!url || !anon) {
  console.warn(
    "[supabase-browser] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
    "Add them to .env.local to enable authentication."
  );
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
    storageKey:        "why-engine-auth",
  },
});
