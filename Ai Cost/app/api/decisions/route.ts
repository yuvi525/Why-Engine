import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { generateWHY } from '@/lib/proxy/why'
import { ReasonCode } from '@/lib/proxy/decide'

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
      isCacheHit: true, promptPreview: true, createdAt: true,
    },
  })

  // Also fetch today's stats
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [budget, todayStats] = await Promise.all([
    prisma.budgetState.findUnique({ where: { userId: user.id } }),
    prisma.decisionLog.aggregate({
      where: { userId: user.id, createdAt: { gte: today } },
      _sum: { savingsMicro: true, actualCostMicro: true, baselineCostMicro: true },
      _count: { id: true },
    }),
  ])

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
      spentTodayMicro:    todayStats._sum.actualCostMicro   ?? 0,
      baselineTodayMicro: todayStats._sum.baselineCostMicro ?? 0,
      requestsToday:      todayStats._count.id              ?? 0,
      savingsTotalMicro:  budget?.totalBaselineMicro != null
        ? budget.totalBaselineMicro - budget.totalSpentMicro
        : 0,
      dailyLimitMicro:   budget?.dailyLimitMicro    ?? 5_000_000,
      spentBudgetMicro:  budget?.spentTodayMicro    ?? 0,
    },
    nextCursor: logs.length === limit ? logs.at(-1)!.createdAt.toISOString() : null,
  }

  console.log(`[API /decisions] Fetched data for userId: ${user.id} | Records returned: ${responsePayload.logs.length}`);

  return NextResponse.json(responsePayload)
}
