import { NextRequest, NextResponse } from 'next/server'
import { resolveSessionUserId, isOwner } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [users, budgets] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, plan: true, role: true, createdAt: true, encryptedApiKey: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.budgetState.findMany({
      select: { userId: true, requestsToday: true, totalSpentMicro: true, totalBaselineMicro: true },
    }),
  ])

  const budgetMap = new Map(budgets.map(b => [b.userId, b]))

  const userRows = users.map(u => {
    const b = budgetMap.get(u.id)
    const totalSavedMicro = b ? Math.max(b.totalBaselineMicro - b.totalSpentMicro, 0) : 0
    return {
      id: u.id, email: u.email, plan: u.plan, role: u.role,
      createdAt:       u.createdAt.toISOString(),
      requestsToday:   b?.requestsToday   ?? 0,
      totalSpentMicro: b?.totalSpentMicro ?? 0,
      totalSavedMicro,
      hasApiKey:       !!u.encryptedApiKey,
    }
  })

  return NextResponse.json({
    users: userRows,
    stats: {
      totalUsers:  users.length,
      activeToday: budgets.filter(b => b.requestsToday > 0).length,
      totalSpend:  budgets.reduce((a, b) => a + b.totalSpentMicro, 0),
      totalSaved:  budgets.reduce((a, b) => a + Math.max(b.totalBaselineMicro - b.totalSpentMicro, 0), 0),
    },
  })
}
