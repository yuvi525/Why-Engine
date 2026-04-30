import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export async function POST(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // ── Aggregate routing outcomes across all users ────────────────────
  // Minimum 50 samples required for statistical significance.
  // Groups by complexity bucket (0 = simple, 1 = complex) and model.
  const aggregations = await prisma.$queryRaw<Array<{
    complexity_bucket: number
    model: string
    sample_count: bigint
    success_rate: number
    avg_latency_ms: number
    avg_savings_micro: number
  }>>`
    SELECT
      CASE WHEN "reasonCode" = 'COMPLEXITY_HIGH' THEN 1 ELSE 0 END AS complexity_bucket,
      model,
      COUNT(*)                                                                            AS sample_count,
      SUM(CASE WHEN "qualitySignal" = 'positive' THEN 1.0 ELSE 0.0 END) / COUNT(*)       AS success_rate,
      AVG(COALESCE("latencyMs", 0))                                                       AS avg_latency_ms,
      AVG("savingsMicro")                                                                  AS avg_savings_micro
    FROM "DecisionLog"
    WHERE "createdAt" > ${sevenDaysAgo}
      AND "qualitySignal" IS NOT NULL
      AND "isCacheHit" = false
    GROUP BY complexity_bucket, model
    HAVING COUNT(*) >= 50
  `

  let rowsProcessed = 0

  for (const row of aggregations) {
    const sampleCount = Number(row.sample_count)

    // ── Write to Postgres routing_confidence ─────────────────────────
    await prisma.routingConfidence.upsert({
      where: {
        complexityScore_model: {
          complexityScore: row.complexity_bucket,
          model: row.model,
        },
      },
      update: {
        successRate:     row.success_rate,
        sampleCount,
        avgLatencyMs:    Math.round(row.avg_latency_ms),
        avgSavingsMicro: Math.round(row.avg_savings_micro),
        computedAt:      new Date(),
      },
      create: {
        complexityScore: row.complexity_bucket,
        model:           row.model,
        successRate:     row.success_rate,
        sampleCount,
        avgLatencyMs:    Math.round(row.avg_latency_ms),
        avgSavingsMicro: Math.round(row.avg_savings_micro),
      },
    })

    // ── Cache in Redis for fast Decision Engine reads ─────────────────
    const redisKey = `routing:confidence:${row.complexity_bucket}:${row.model}`
    await redis.setex(redisKey, 86400, JSON.stringify({
      successRate:     row.success_rate,
      sampleCount,
      avgLatencyMs:    Math.round(row.avg_latency_ms),
      avgSavingsMicro: Math.round(row.avg_savings_micro),
      computedAt:      Date.now(),
    }))

    rowsProcessed++
  }

  console.log(`[cron/learning] Processed ${rowsProcessed} aggregation rows.`)
  return NextResponse.json({ success: true, rowsProcessed })
}
