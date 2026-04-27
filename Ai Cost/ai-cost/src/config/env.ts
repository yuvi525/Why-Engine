/**
 * src/config/env.ts
 *
 * Split environment configuration:
 *   - clientEnv  → NEXT_PUBLIC_* only. Safe for browser. No secrets.
 *   - serverEnv  → Private keys. Validated with Zod. Server/API only.
 *
 * USAGE:
 *   Client components  → import { clientEnv } from '@/src/config/env'
 *   API routes / libs  → import { serverEnv } from '@/src/config/env'
 *
 * The Zod parse for serverEnv is guarded by typeof window === 'undefined'
 * so it NEVER runs in the browser bundle.
 */

import { z } from 'zod';

// ─── 1. CLIENT ENV ─────────────────────────────────────────────────────────────
// Only NEXT_PUBLIC_* vars — safe to expose to the browser.
// No crash on missing — warn only so the UI stays up.

const ClientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL:      z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

type ClientEnv = z.infer<typeof ClientSchema>;

function buildClientEnv(): ClientEnv {
  const result = ClientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!result.success) {
    // Warn — do NOT throw. Missing public keys degrade auth gracefully.
    result.error.issues.forEach((issue) => {
      console.warn(`[clientEnv] ${issue.path.join('.')}: ${issue.message}`);
    });
    // Return whatever is available (may be partial)
    return {
      NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL      ?? '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    };
  }

  return result.data;
}

export const clientEnv = buildClientEnv();

// ─── 2. SERVER ENV ─────────────────────────────────────────────────────────────
// Private keys — NEVER exposed to the browser.
// Zod parse runs only on the server (typeof window === 'undefined').
// Throws a clear error on the server if any required key is missing.

const ServerSchema = z.object({
  OPENAI_API_KEY:            z.string().min(1, 'OPENAI_API_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_URL:              z.string().url('SUPABASE_URL must be a valid URL'),
  UPSTASH_REDIS_REST_URL:    z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL'),
  UPSTASH_REDIS_REST_TOKEN:  z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required'),
  // Optional server vars
  ANTHROPIC_API_KEY:         z.string().min(1).optional(),
  STRIPE_SECRET_KEY:         z.string().optional(),
  STRIPE_WEBHOOK_SECRET:     z.string().optional(),
  CRON_SECRET:               z.string().optional(),
  INTERNAL_API_KEY:          z.string().optional(),
});

type ServerEnv = z.infer<typeof ServerSchema>;

// Stub used in the browser bundle — accessing any key returns undefined.
// This prevents tree-shake from including secret values in the client chunk.
const serverEnvStub = new Proxy({} as ServerEnv, {
  get(_, key: string) {
    if (typeof window !== 'undefined') {
      console.error(
        `[serverEnv] Attempted to access server-only env var "${key}" in the browser. ` +
        `Import clientEnv instead.`
      );
    }
    return undefined;
  },
});

function buildServerEnv(): ServerEnv {
  // Guard: only validate on the server.
  if (typeof window !== 'undefined') {
    return serverEnvStub;
  }

  const result = ServerSchema.safeParse({
    OPENAI_API_KEY:            process.env.OPENAI_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL:              process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    UPSTASH_REDIS_REST_URL:    process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN:  process.env.UPSTASH_REDIS_REST_TOKEN,
    ANTHROPIC_API_KEY:         process.env.ANTHROPIC_API_KEY,
    STRIPE_SECRET_KEY:         process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET:     process.env.STRIPE_WEBHOOK_SECRET,
    CRON_SECRET:               process.env.CRON_SECRET,
    INTERNAL_API_KEY:          process.env.INTERNAL_API_KEY,
  });

  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ✗ ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `[serverEnv] Missing or invalid environment variables:\n${missing}\n` +
      `Check your .env.local file.`
    );
  }

  return result.data;
}

export const serverEnv = buildServerEnv();

// ─── 3. LEGACY COMPAT ──────────────────────────────────────────────────────────
// Files that import { env } from '@/src/config/env' keep working unchanged.
// Merges client (always safe) + server (server-only, stub in browser).
export const env = { ...clientEnv, ...serverEnv };
