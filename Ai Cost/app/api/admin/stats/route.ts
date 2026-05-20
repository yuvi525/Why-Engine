/**
 * GET /api/admin/stats
 * Returns system-wide aggregates via efficient DB queries.
 * OWNER ONLY — guarded by requireOwner().
 *
 * All values computed via DB aggregation — NO full dataset loading.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

  // ── Parallel aggregate queries — NO full dataset load ───────────
  const [totalUsers, totalRequestsAgg, totalSpendAgg] = await Promise.all([
    // COUNT(*) — users
    prisma.user.count(),

    // COUNT(*) — decision logs
    prisma.decisionLog.count(),

    // SUM(actualCostMicro) — total spend
    prisma.decisionLog.aggregate({
      _sum: { actualCostMicro: true },
    }),
  ])

  return NextResponse.json({
    totalUsers,
    totalRequests:   totalRequestsAgg,
    totalSpendMicro: totalSpendAgg._sum.actualCostMicro ?? 0,
    // Convenience: USD value for display
    totalSpendUsd:   ((totalSpendAgg._sum.actualCostMicro ?? 0) / 1_000_000).toFixed(4),
  })
}
