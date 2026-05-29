import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

/**
 * Alert Evaluation Cron — runs every 15 minutes via Vercel cron.
 * Evaluates all users' alert rules against their current spend state.
 * Persists newly fired alerts to Redis.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Load all users with active budget states
  const budgetStates = await prisma.budgetState.findMany({
    select: { userId: true, spentTodayMicro: true, dailyLimitMicro: true, requestsToday: true },
  })

  let alertsFired = 0

  for (const bs of budgetStates) {
    // Read this user's alert rules from Redis
    let rules: any[] = []
    try {
      const raw = await redis.get<any[]>(`alert_rules:${bs.userId}`)
      rules = Array.isArray(raw) ? raw.filter((r: any) => r.enabled) : []
    } catch { continue }

    if (rules.length === 0) continue

    // Check 30-day spend for anomaly detection ONLY if rule exists
    const hasAnomalyRule = rules.some((r: any) => r.type === 'anomaly')
    let avgDailySpendMicro = 0

    if (hasAnomalyRule) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
      let recentLogs: { actualCostMicro: number }[] = []
      try {
        recentLogs = await prisma.decisionLog.findMany({
          where: { userId: bs.userId, createdAt: { gte: thirtyDaysAgo }, isCacheHit: false },
          select: { actualCostMicro: true },
        })
      } catch { /* skip anomaly for this user */ }

      avgDailySpendMicro = recentLogs.length > 0
        ? recentLogs.reduce((a, l) => a + l.actualCostMicro, 0) / 30
        : 0
    }

    for (const rule of rules) {
      let triggered = false
      let triggerMsg = ''
      const spentUsd = (bs.spentTodayMicro / 1_000_000).toFixed(4)
      const limitUsd  = (bs.dailyLimitMicro / 1_000_000).toFixed(2)
      const pct       = bs.dailyLimitMicro > 0
        ? Math.round((bs.spentTodayMicro / bs.dailyLimitMicro) * 100)
        : 0

      if (rule.type === 'spend_spike') {
        const threshold = (rule.threshold ?? 90) / 100
        if (bs.dailyLimitMicro > 0 && bs.spentTodayMicro / bs.dailyLimitMicro >= threshold) {
          triggered = true
          triggerMsg = `Daily spend reached ${pct}% of limit ($${spentUsd} / $${limitUsd}).`
        }
      } else if (rule.type === 'daily_limit') {
        const limitUsdThreshold = (rule.limitUsd ?? 10) * 1_000_000
        if (bs.spentTodayMicro >= limitUsdThreshold) {
          triggered = true
          triggerMsg = `Daily spend exceeded $${rule.limitUsd ?? 10} (actual: $${spentUsd}).`
        }
      } else if (rule.type === 'anomaly') {
        const multiplier = rule.multiplier ?? 2
        if (avgDailySpendMicro > 0 && bs.spentTodayMicro >= avgDailySpendMicro * multiplier) {
          triggered = true
          const avgUsd = (avgDailySpendMicro / 1_000_000).toFixed(4)
          triggerMsg = `Spend anomaly: today $${spentUsd} is ${multiplier}× the 30-day avg ($${avgUsd}/day).`
        }
      }

      if (!triggered) continue

      // Dedup: only fire once per rule per day
      const dedupKey = `alert:fired:dedup:${bs.userId}:${rule.id}:${new Date().toISOString().split('T')[0]}`
      try {
        const alreadyFired = await redis.set(dedupKey, '1', { nx: true, ex: 86400 })
        if (alreadyFired === null) continue // null = key already existed = already fired today
      } catch { continue }

      // Persist fired alert to Redis list
      const firedAlert = {
        id:          crypto.randomUUID(),
        ruleId:      rule.id,
        ruleName:    rule.name,
        type:        rule.type,
        severity:    rule.severity ?? 'warning',
        message:     triggerMsg,
        acknowledged: false,
        firedAt:     new Date().toISOString(),
      }

      try {
        const existing = await redis.get<any[]>(`alerts:fired:${bs.userId}`) ?? []
        const updated  = [firedAlert, ...existing].slice(0, 100) // cap at 100 per user
        await redis.setex(`alerts:fired:${bs.userId}`, 86400 * 7, JSON.stringify(updated))
        alertsFired++
      } catch { /* non-critical */ }
    }
  }

  return NextResponse.json({ success: true, alertsFired, usersChecked: budgetStates.length })
}
