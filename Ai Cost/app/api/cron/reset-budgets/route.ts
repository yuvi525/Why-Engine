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

  // Clear Redis budget keys (best effort)
  try {
    const keys = await redis.keys('budget:*:today')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (err) {
    console.error('[cron] Redis cleanup failed:', err)
  }

  return NextResponse.json({ success: true, resetCount: result.count })
}
