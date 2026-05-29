import { NextRequest, NextResponse } from 'next/server'
import { resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateWHY } from '@/lib/proxy/why'
import { ReasonCode } from '@/lib/proxy/decide'
import { resolvePlan, getMonthlyRevenueMicro } from '@/lib/plans'

export async function GET(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const cursor = searchParams.get('cursor')

  const logs = await prisma.decisionLog.findMany({
    where: {
      userId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, requestId: true, model: true, reasonCode: true,
      inputTokens: true, outputTokens: true, actualCostMicro: true,
      baselineCostMicro: true, savingsMicro: true, savingsPct: true,
      isCacheHit: true, promptPreview: true, createdAt: true, latencyMs: true,
    },
  })

  const today          = new Date(); today.setHours(0, 0, 0, 0)
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  // ── Bounded streak calculation — only look back 90 days ───────────────
  const d90 = new Date(Date.now() - 90 * 86400000)
  const recentDates = await prisma.$queryRaw<{ day: Date | string }[]>`
    SELECT DISTINCT DATE_TRUNC('day', "createdAt") as day
    FROM "DecisionLog"
    WHERE "userId" = ${userId} AND "createdAt" >= ${d90}
  `

  const daysWithRequests = new Set(
    recentDates.map(l => {
      const d = new Date(l.day)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    })
  )

  let streak = 0
  let checkDate = new Date(today)
  // Start from today or yesterday
  if (!daysWithRequests.has(checkDate.getTime())) {
    checkDate.setDate(checkDate.getDate() - 1)
  }
  while (daysWithRequests.has(checkDate.getTime())) {
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  const [budget, todayStats, monthStats, userRow] = await Promise.all([
    prisma.budgetState.findUnique({ where: { userId } }),
    prisma.decisionLog.aggregate({
      where: { userId, createdAt: { gte: today } },
      _sum: { savingsMicro: true, actualCostMicro: true, baselineCostMicro: true },
      _count: { id: true },
    }),
    prisma.decisionLog.aggregate({
      where: { userId, createdAt: { gte: firstDayOfMonth } },
      _sum: { savingsMicro: true, actualCostMicro: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true, plan: true, trialEndsAt: true },
    }),
  ])

  // Margin calculation
  const effectivePlan        = userRow ? resolvePlan(userRow) : 'free'
  const monthlyRevenueMicro  = getMonthlyRevenueMicro(effectivePlan)
  const now                  = new Date()
  const daysInMonth          = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed          = now.getDate()
  const proratedRevenueMicro = Math.round((daysElapsed / daysInMonth) * monthlyRevenueMicro)
  const monthCostMicro       = monthStats._sum.actualCostMicro ?? 0
  const marginMicro          = proratedRevenueMicro - monthCostMicro

  return NextResponse.json({
    logs: logs.map(log => ({
      ...log,
      why: generateWHY(log.reasonCode as ReasonCode, {
        model: log.model,
        savingsMicro: log.savingsMicro,
        actualCostMicro: log.actualCostMicro,
        baselineCostMicro: log.baselineCostMicro,
        budgetPct: budget ? Math.round((budget.spentTodayMicro / budget.dailyLimitMicro) * 100) : undefined,
        spentTodayMicro: budget?.spentTodayMicro,
        dailyLimitMicro: budget?.dailyLimitMicro,
      }),
      createdAt: log.createdAt.toISOString(),
    })),
    stats: {
      savingsTodayMicro:     todayStats._sum.savingsMicro      ?? 0,
      savingsThisMonthMicro: monthStats._sum.savingsMicro      ?? 0,
      spentTodayMicro:       todayStats._sum.actualCostMicro   ?? 0,
      baselineTodayMicro:    todayStats._sum.baselineCostMicro ?? 0,
      requestsToday:         todayStats._count.id              ?? 0,
      streakDays:            streak,
      savingsTotalMicro: budget?.totalBaselineMicro != null
        ? budget.totalBaselineMicro - budget.totalSpentMicro
        : 0,
      totalCostMicro:      budget?.totalSpentMicro  ?? 0,
      dailyLimitMicro:     budget?.dailyLimitMicro  ?? 5_000_000,
      spentBudgetMicro:    budget?.spentTodayMicro  ?? 0,
      totalRevenueMicro:   proratedRevenueMicro,
      marginMicro,
      marginStatus: marginMicro > 0 ? 'profit' : marginMicro < 0 ? 'loss' : 'break_even',
    },
    nextCursor: logs.length === limit ? logs.at(-1)!.createdAt.toISOString() : null,
  })
}
