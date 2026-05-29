import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export async function POST(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Reset all budget states in Postgres
  const result = await prisma.budgetState.updateMany({
    data: {
      spentTodayMicro:    0,
      baselineTodayMicro: 0,
      requestsToday:      0,
      cacheHitsToday:     0,
      lastResetAt:        new Date(),
    },
  })

  // Redis keys naturally expire after 24 hours (budget:userId:YYYY-MM-DD TTL is 86400)
  // No KEYS scan is required, preventing O(N) blocking Redis freezes.

  return NextResponse.json({ success: true, resetCount: result.count })
}
