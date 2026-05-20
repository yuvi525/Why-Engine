/**
 * GET /api/admin/logs
 * Returns the last 50 decision logs across all users.
 * OWNER ONLY — guarded by requireOwner().
 *
 * Rules:
 *  - ORDER BY createdAt DESC, LIMIT 50
 *  - No heavy joins — select only what is needed for the UI
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

  // ── Fetch last 50 logs — lightweight select, no joins ──────────
  const logs = await prisma.decisionLog.findMany({
    select: {
      id:              true,
      userId:          true,
      model:           true,
      actualCostMicro: true,
      reasonCode:      true,
      isCacheHit:      true,
      createdAt:       true,
      user: {
        select: { email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take:    50,
  })

  return NextResponse.json(
    logs.map(l => ({
      id:           l.id,
      userId:       l.userId,
      email:        l.user.email,
      model:        l.model,
      costMicro:    l.actualCostMicro,
      costUsd:      (l.actualCostMicro / 1_000_000).toFixed(6),
      reasonCode:   l.reasonCode,
      isCacheHit:   l.isCacheHit,
      createdAt:    l.createdAt,
    }))
  )
}
