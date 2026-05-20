/**
 * Admin control-plane helpers.
 * NEVER import this from the execution path (proxy, routing, cost engine).
 * This is owner-only infrastructure.
 */

import { prisma } from './prisma'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  email: string
  plan: string
  role: string
  createdAt: Date
  requestsToday: number
  totalSpendMicro: number
}

export type AdminAction =
  | 'upgrade_pro'
  | 'downgrade_free'
  | 'reset_usage'
  | 'extend_trial'

// ─── requireOwner ────────────────────────────────────────────────────────────

/**
 * Asserts that the resolved user ID belongs to an owner.
 * Throws on any non-owner — API routes should catch and return 403.
 */
export async function requireOwner(userId: string): Promise<void> {
  if (!userId) throw new Error('Unauthorized')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  })

  const isOwner =
    user?.role === 'owner' ||
    user?.email === 'yuvrajsingh2351@gmail.com' // hard-coded owner fallback

  if (!isOwner) throw new Error('Unauthorized')
}

// ─── resolveSessionUserId ─────────────────────────────────────────────────────

/**
 * Resolves the user ID from the request session cookie.
 * Returns null if the session is missing or invalid.
 */
export async function resolveSessionUserId(): Promise<string | null> {
  try {
    const { createServerSupabase } = await import('./supabase-server')
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}
