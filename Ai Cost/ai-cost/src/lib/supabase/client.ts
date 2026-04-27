"use client";

/**
 * src/lib/supabase/client.ts
 *
 * Browser-safe Supabase singleton using the ANON key only.
 * Uses clientEnv — no server secrets ever reach this file.
 */

import { createClient } from '@supabase/supabase-js';
import { clientEnv } from '@/src/config/env';

let supabaseBrowserClient: ReturnType<typeof createClient> | null = null;

export function createBrowserSupabaseClient() {
  if (supabaseBrowserClient) return supabaseBrowserClient;

  const url  = clientEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anon = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.warn(
      '[supabase/client] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. ' +
      'Auth and data features will be disabled.'
    );
    return null;
  }

  supabaseBrowserClient = createClient(url, anon, {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
      storageKey:         'why-engine-auth',
    },
  });

  return supabaseBrowserClient;
}
