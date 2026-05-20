/**
 * GET /api/admin/users
 * Returns all users with aggregated spend + today's Redis request count.
 * OWNER ONLY — guarded by requireOwner().
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { requireOwner, resolveSessionUserId } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  // ── Auth guard ──────────────────────────────────────────────────
  const userId = await resolveSessionUserId()
  try {
    await requireOwner(userId ?? '')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Efficient aggregate queries — NO N+1 ───────────────────────
  const [users, budgetRows] = await Promise.all([
    prisma.user.findMany({
      select: {
        id:        true,
        email:     true,
        plan:      true,
        role:      true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.budgetState.findMany({
      select: {
        userId:          true,
        requestsToday:   true,
        totalSpentMicro: true,
      },
    }),
  ])

  // Index budget rows by userId for O(1) lookup
  const budgetMap = new Map(budgetRows.map(b => [b.userId, b]))

  // Batch-fetch requestsToday from Redis for all users
  // Use pipelining-style parallel fetches — fail gracefully per key
  const redisResults = await Promise.allSettled(
    users.map(u => redis.get<number>(`budget:${u.id}`))
  )

  const result = users.map((u, idx) => {
    const budget = budgetMap.get(u.id)

    // Redis requestsToday (can override DB value if available)
    let requestsToday = budget?.requestsToday ?? 0
    const redisVal = redisResults[idx]
    if (redisVal.status === 'fulfilled' && typeof redisVal.value === 'number') {
      requestsToday = redisVal.value
    }

    return {
      id:              u.id,
      email:           u.email,
      plan:            u.plan,
      role:            u.role,
      createdAt:       u.createdAt,
      requestsToday,
      totalSpendMicro: budget?.totalSpentMicro ?? 0,
    }
  })

  return NextResponse.json(result)
}
