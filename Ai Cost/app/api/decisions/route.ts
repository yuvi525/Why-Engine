import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { generateWHY } from '@/lib/proxy/why'
import { ReasonCode } from '@/lib/proxy/decide'
import { resolvePlan, getMonthlyRevenueMicro } from '@/lib/plans'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const cursor = searchParams.get('cursor')

  const logs = await prisma.decisionLog.findMany({
    where: {
      userId: user.id,
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

  // Also fetch today's and this month's stats
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [budget, todayStats, monthStats, allDates] = await Promise.all([
    prisma.budgetState.findUnique({ where: { userId: user.id } }),
    prisma.decisionLog.aggregate({
      where: { userId: user.id, createdAt: { gte: today } },
      _sum: { savingsMicro: true, actualCostMicro: true, baselineCostMicro: true },
      _count: { id: true },
    }),
    prisma.decisionLog.aggregate({
      where: { userId: user.id, createdAt: { gte: firstDayOfMonth } },
      _sum: { savingsMicro: true },
    }),
    prisma.decisionLog.findMany({
      where: { userId: user.id },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' }
    })
  ])

  // Calculate Streak
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0,0,0,0);
  const daysWithRequests = new Set(allDates.map(l => {
    const d = new Date(l.createdAt);
    d.setHours(0,0,0,0);
    return d.getTime();
  }));

  let checkDate = new Date(currentDate);
  if (daysWithRequests.has(checkDate.getTime())) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
    while (daysWithRequests.has(checkDate.getTime())) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  } else {
    // Check if streak ended yesterday
    checkDate.setDate(checkDate.getDate() - 1);
    if (daysWithRequests.has(checkDate.getTime())) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      while (daysWithRequests.has(checkDate.getTime())) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }
  }

  // Phase 11: Margin calculation
  const userRow = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, role: true, plan: true, trialEndsAt: true } })
  const effectivePlan = userRow ? resolvePlan(userRow) : 'free'
  const monthlyRevenueMicro = getMonthlyRevenueMicro(effectivePlan)
  // Pro-rate revenue: (days elapsed / days in month) * monthly revenue
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = now.getDate()
  const proratedRevenueMicro = Math.round((daysElapsed / daysInMonth) * monthlyRevenueMicro)
  const totalCostMicro = budget?.totalSpentMicro ?? 0
  const marginMicroCalc = proratedRevenueMicro - totalCostMicro

  const responsePayload = {
    logs: logs.map(log => ({
      ...log,
      why: generateWHY(log.reasonCode as ReasonCode, {
        model: log.model,
        savingsMicro: log.savingsMicro,
        actualCostMicro: log.actualCostMicro,
        baselineCostMicro: log.baselineCostMicro,
        budgetPct: budget
          ? Math.round((budget.spentTodayMicro / budget.dailyLimitMicro) * 100)
          : undefined,
        spentTodayMicro: budget?.spentTodayMicro,
        dailyLimitMicro: budget?.dailyLimitMicro,
      }),
      createdAt: log.createdAt.toISOString(),
    })),
    stats: {
      savingsTodayMicro:  todayStats._sum.savingsMicro      ?? 0,
      savingsThisMonthMicro: monthStats._sum.savingsMicro   ?? 0,
      spentTodayMicro:    todayStats._sum.actualCostMicro   ?? 0,
      baselineTodayMicro: todayStats._sum.baselineCostMicro ?? 0,
      requestsToday:      todayStats._count.id              ?? 0,
      streakDays:         streak,
      savingsTotalMicro:  budget?.totalBaselineMicro != null
        ? budget.totalBaselineMicro - budget.totalSpentMicro
        : 0,
      totalCostMicro:    budget?.totalSpentMicro    ?? 0,
      dailyLimitMicro:   budget?.dailyLimitMicro    ?? 5_000_000,
      spentBudgetMicro:  budget?.spentTodayMicro    ?? 0,
      // Phase 11: Margin fields
      totalRevenueMicro: proratedRevenueMicro,
      marginMicro:       marginMicroCalc,
      marginStatus:      marginMicroCalc > 0 ? 'profit' : marginMicroCalc < 0 ? 'loss' : 'break_even',
    },
    nextCursor: logs.length === limit ? logs.at(-1)!.createdAt.toISOString() : null,
  }

  console.log(`[API /decisions] Fetched data for userId: ${user.id} | Records returned: ${responsePayload.logs.length}`);

  return NextResponse.json(responsePayload)
}
