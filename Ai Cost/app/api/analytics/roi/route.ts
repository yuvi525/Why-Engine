import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveSessionUserId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Load logs with margin data (cap at 10k rows for performance)
  const logs = await prisma.decisionLog.findMany({
    where:   { userId, revenueMicro: { not: null } },
    select:  {
      customerId: true, featureId: true,
      actualCostMicro: true, revenueMicro: true,
      marginMicro: true, marginStatus: true,
      savingsMicro: true, createdAt: true,
      model: true, reasonCode: true,
    },
    orderBy: { createdAt: 'desc' },
    take:    10000,
  })

  // ── Totals ──────────────────────────────────────────────────────────────
  const totalRevenueMicro = logs.reduce((a, l) => a + (l.revenueMicro ?? 0), 0)
  const totalCostMicro    = logs.reduce((a, l) => a + l.actualCostMicro, 0)
  const totalMarginMicro  = logs.reduce((a, l) => a + (l.marginMicro ?? 0), 0)
  const totalSavingsMicro = logs.reduce((a, l) => a + l.savingsMicro, 0)
  const marginRate        = totalRevenueMicro > 0
    ? Math.round((totalMarginMicro / totalRevenueMicro) * 100) : 0

  // ── Margin distribution ──────────────────────────────────────────────────
  const dist = { profit: 0, loss: 0, break_even: 0 }
  for (const l of logs) {
    if (l.marginStatus === 'profit')     dist.profit++
    else if (l.marginStatus === 'loss')  dist.loss++
    else                                 dist.break_even++
  }

  // ── By customer ──────────────────────────────────────────────────────────
  const custMap = new Map<string, { revenue: number; cost: number; margin: number; requests: number }>()
  for (const l of logs) {
    const k   = l.customerId ?? '(untagged)'
    const cur = custMap.get(k) ?? { revenue: 0, cost: 0, margin: 0, requests: 0 }
    cur.revenue  += l.revenueMicro ?? 0
    cur.cost     += l.actualCostMicro
    cur.margin   += l.marginMicro ?? 0
    cur.requests += 1
    custMap.set(k, cur)
  }

  // ── By feature ───────────────────────────────────────────────────────────
  const featMap = new Map<string, { revenue: number; cost: number; margin: number; requests: number }>()
  for (const l of logs) {
    const k   = l.featureId ?? '(untagged)'
    const cur = featMap.get(k) ?? { revenue: 0, cost: 0, margin: 0, requests: 0 }
    cur.revenue  += l.revenueMicro ?? 0
    cur.cost     += l.actualCostMicro
    cur.margin   += l.marginMicro ?? 0
    cur.requests += 1
    featMap.set(k, cur)
  }

  // ── By day (last 30 days) ────────────────────────────────────────────────
  const cutoff = new Date(Date.now() - 30 * 86400000)
  const dayMap = new Map<string, { revenue: number; cost: number; margin: number; requests: number }>()
  for (const l of logs) {
    if (l.createdAt < cutoff) continue
    const day = l.createdAt.toISOString().split('T')[0]
    const cur = dayMap.get(day) ?? { revenue: 0, cost: 0, margin: 0, requests: 0 }
    cur.revenue  += l.revenueMicro ?? 0
    cur.cost     += l.actualCostMicro
    cur.margin   += l.marginMicro ?? 0
    cur.requests += 1
    dayMap.set(day, cur)
  }

  const mapToArray = (m: Map<string, any>) =>
    Array.from(m.entries())
      .map(([id, v]) => ({
        id,
        marginRatePct: v.revenue > 0 ? Math.round((v.margin / v.revenue) * 100) : 0,
        ...v,
      }))
      .sort((a, b) => b.margin - a.margin)

  const byCustomer = mapToArray(custMap)
  const byFeature  = mapToArray(featMap)
  const byDay      = Array.from(dayMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    hasData: logs.length > 0,
    totals: { totalRevenueMicro, totalCostMicro, totalMarginMicro, totalSavingsMicro, marginRate, requestCount: logs.length },
    distribution: dist,
    byCustomer,
    byFeature,
    byDay,
    topProfitable:    byCustomer.slice(0, 5),
    topUnprofitable:  [...byCustomer].sort((a, b) => a.margin - b.margin).slice(0, 5),
    topProfitableFeatures:   byFeature.slice(0, 5),
    topUnprofitableFeatures: [...byFeature].sort((a, b) => a.margin - b.margin).slice(0, 5),
  })
}
