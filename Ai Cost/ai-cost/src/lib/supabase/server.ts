/**
 * src/lib/supabase/server.ts
 *
 * Server-only Supabase client using the service role key (bypasses RLS).
 * Import ONLY in API routes and Server Components.
 * Never imported in client components.
 */

import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '@/src/config/env';

export function createServerSupabaseClient() {
  const url     = serverEnv.SUPABASE_URL;
  const roleKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !roleKey) {
    throw new Error(
      '[supabase/server] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. ' +
      'Check your .env.local file.'
    );
  }

  return createClient(url, roleKey, {
    auth: {
      persistSession:     false,
      autoRefreshToken:   false,
      detectSessionInUrl: false,
    },
  });
}
