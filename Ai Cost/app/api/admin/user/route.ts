/**
 * PATCH /api/admin/user
 * Performs safe, validated mutations on a user record.
 * OWNER ONLY — guarded by requireOwner().
 *
 * SAFETY RULES:
 *  - Never deletes users
 *  - Never touches payment records
 *  - Redis failures do not crash the request
 *  - All writes are validated before execution
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { requireOwner, resolveSessionUserId, AdminAction } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  // ── Auth guard ──────────────────────────────────────────────────
  const sessionUserId = await resolveSessionUserId()
  try {
    await requireOwner(sessionUserId ?? '')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Parse & validate body ────────────────────────────────────────
  let body: { userId?: string; action?: AdminAction }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { userId, action } = body

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const validActions: AdminAction[] = [
    'upgrade_pro',
    'downgrade_free',
    'reset_usage',
    'extend_trial',
  ]
  if (!action || !validActions.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${validActions.join(', ')}` },
      { status: 400 }
    )
  }

  // ── Confirm target user exists ───────────────────────────────────
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, plan: true, trialEndsAt: true },
  })
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // ── Execute action ───────────────────────────────────────────────
  switch (action) {
    // ── Upgrade to Pro for 30 days ───────────────────────────────
    case 'upgrade_pro': {
      const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      await prisma.user.update({
        where: { id: userId },
        data:  { plan: 'pro', trialEndsAt: planExpiresAt },
      })
      return NextResponse.json({
        success: true,
        message: `User ${targetUser.email} upgraded to Pro (expires ${planExpiresAt.toISOString()})`,
      })
    }

    // ── Downgrade to Free ─────────────────────────────────────────
    case 'downgrade_free': {
      await prisma.user.update({
        where: { id: userId },
        data:  { plan: 'free', trialEndsAt: null },
      })
      return NextResponse.json({
        success: true,
        message: `User ${targetUser.email} downgraded to Free`,
      })
    }

    // ── Reset daily usage counters (DB + Redis) ───────────────────
    case 'reset_usage': {
      // DB reset — safe upsert, never deletes
      await prisma.budgetState.upsert({
        where:  { userId },
        update: { requestsToday: 0, spentTodayMicro: 0, lastResetAt: new Date() },
        create: { userId, requestsToday: 0, spentTodayMicro: 0 },
      })

      // Redis reset — failures must not crash the API
      await Promise.allSettled([
        redis.del(`budget:${userId}`),
        redis.del(`usage:${userId}`),
      ])

      return NextResponse.json({
        success: true,
        message: `Usage reset for ${targetUser.email}`,
      })
    }

    // ── Extend trial by 7 days ────────────────────────────────────
    case 'extend_trial': {
      const currentExpiry = targetUser.trialEndsAt ?? new Date()
      const base = currentExpiry > new Date() ? currentExpiry : new Date()
      const newExpiry = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000)

      await prisma.user.update({
        where: { id: userId },
        data:  { trialEndsAt: newExpiry },
      })

      return NextResponse.json({
        success: true,
        message: `Trial extended for ${targetUser.email} until ${newExpiry.toISOString()}`,
      })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
