import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveSessionUserId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url    = new URL(req.url)
  const period = url.searchParams.get('period') ?? '30d'

  // Determine date range
  const now   = new Date()
  let fromDate: Date
  if (period === '7d')   fromDate = new Date(now.getTime() - 7  * 86400000)
  else if (period === '30d') fromDate = new Date(now.getTime() - 30 * 86400000)
  else fromDate = new Date('2000-01-01')

  const [logs, savingsAgg] = await Promise.all([
    prisma.decisionLog.findMany({
      where: { userId, createdAt: { gte: fromDate } },
      select: { model: true, reasonCode: true, actualCostMicro: true, baselineCostMicro: true,
                savingsMicro: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.decisionLog.aggregate({
      where: { userId },
      _sum: { savingsMicro: true },
    }),
  ])

  // Aggregate by model
  const byModelMap = new Map<string, { costMicro: number; requests: number; savingsMicro: number }>()
  for (const l of logs) {
    const cur = byModelMap.get(l.model) ?? { costMicro: 0, requests: 0, savingsMicro: 0 }
    cur.costMicro    += l.actualCostMicro
    cur.requests     += 1
    cur.savingsMicro += l.savingsMicro
    byModelMap.set(l.model, cur)
  }

  // Aggregate by reason
  const byReasonMap = new Map<string, { count: number; costMicro: number }>()
  for (const l of logs) {
    const cur = byReasonMap.get(l.reasonCode) ?? { count: 0, costMicro: 0 }
    cur.count    += 1
    cur.costMicro += l.actualCostMicro
    byReasonMap.set(l.reasonCode, cur)
  }

  // Aggregate by day
  const byDayMap = new Map<string, { costMicro: number; savingsMicro: number; requests: number }>()
  for (const l of logs) {
    const day = l.createdAt.toISOString().split('T')[0]
    const cur = byDayMap.get(day) ?? { costMicro: 0, savingsMicro: 0, requests: 0 }
    cur.costMicro    += l.actualCostMicro
    cur.savingsMicro += l.savingsMicro
    cur.requests     += 1
    byDayMap.set(day, cur)
  }

  const totalCostMicro    = logs.reduce((a, l) => a + l.actualCostMicro, 0)
  const savingsTotalMicro = savingsAgg._sum.savingsMicro ?? 0

  return NextResponse.json({
    totalCostMicro,
    spentTodayMicro: logs.filter(l => l.createdAt >= new Date(now.toISOString().split('T')[0])).reduce((a, l) => a + l.actualCostMicro, 0),
    savingsTotalMicro,
    requestsTotal: logs.length,
    byModel:  Array.from(byModelMap.entries()).map(([model, v]) => ({ model, ...v })),
    byReason: Array.from(byReasonMap.entries()).map(([reason, v]) => ({ reason, ...v })),
    byDay:    Array.from(byDayMap.entries()).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
  })
}
