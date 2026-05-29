import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveSessionUserId } from '@/lib/auth'

// GET  /api/analytics/why  — generate WHY insights from DecisionLog
export async function GET(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const d7  = new Date(now.getTime() - 7  * 86400000)
  const d14 = new Date(now.getTime() - 14 * 86400000)

  const [recentLogs, priorLogs, allLogs] = await Promise.all([
    prisma.decisionLog.findMany({
      where: { userId, createdAt: { gte: d7  } },
      select: { model: true, reasonCode: true, actualCostMicro: true, savingsMicro: true,
                baselineCostMicro: true, featureId: true, customerId: true, createdAt: true, latencyMs: true },
    }),
    prisma.decisionLog.findMany({
      where: { userId, createdAt: { gte: d14, lt: d7 } },
      select: { model: true, actualCostMicro: true, savingsMicro: true },
    }),
    prisma.decisionLog.findMany({
      where: { userId },
      select: { actualCostMicro: true, savingsMicro: true, isCacheHit: true },
    }),
  ])

  const insights: {
    id: string; type: string; severity: string; title: string;
    why: string; impact: string; action: string;
    potentialSavingsMicro?: number; affectedRequests?: number;
    metric?: number; metricLabel?: string; createdAt: string;
  }[] = []

  const recentCost = recentLogs.reduce((a, l) => a + l.actualCostMicro, 0)
  const priorCost  = priorLogs.reduce((a, l)  => a + l.actualCostMicro, 0)
  const spendChange = priorCost > 0 ? ((recentCost - priorCost) / priorCost) * 100 : 0

  // ── Insight 1: Spend spike ──
  if (spendChange > 30 && recentLogs.length > 5) {
    insights.push({
      id: 'spend-spike',
      type: 'cost_spike',
      severity: 'critical',
      title: `AI spend increased ${spendChange.toFixed(0)}% this week`,
      why: `Spend rose from $${(priorCost/1e6).toFixed(2)} to $${(recentCost/1e6).toFixed(2)} week-over-week.`,
      impact: `At this rate, monthly spend will be $${((recentCost / 7) * 30 / 1e6).toFixed(2)} — ${spendChange.toFixed(0)}% above last month.`,
      action: 'Review which features or customers drove the increase using the Attribution tab.',
      metric: spendChange,
      metricLabel: 'spend increase',
      createdAt: now.toISOString(),
    })
  }

  // ── Insight 2: Model inefficiency ──
  const gpt4Logs    = recentLogs.filter(l => l.model === 'gpt-4o')
  const simpleGpt4  = gpt4Logs.filter(l => l.reasonCode === 'COMPLEXITY_LOW')
  if (simpleGpt4.length > 10) {
    const wastedMicro = simpleGpt4.reduce((a, l) => a + l.savingsMicro, 0)
    const potentialSavings = simpleGpt4.reduce((a, l) => a + (l.baselineCostMicro - l.actualCostMicro), 0)
    insights.push({
      id: 'model-inefficiency',
      type: 'model_inefficiency',
      severity: 'warning',
      title: `${simpleGpt4.length} simple requests used GPT-4o unnecessarily`,
      why: `${simpleGpt4.length} low-complexity prompts were routed to GPT-4o instead of GPT-4o Mini.`,
      impact: `You could save $${(Math.abs(potentialSavings)/1e6).toFixed(2)} by routing these to GPT-4o Mini.`,
      action: 'Enable V2 routing in Settings → Advanced, or lower your complexity threshold.',
      potentialSavingsMicro: Math.abs(potentialSavings),
      affectedRequests: simpleGpt4.length,
      createdAt: now.toISOString(),
    })
  }

  // ── Insight 3: Cache opportunity ──
  const cacheHits = allLogs.filter(l => l.isCacheHit).length
  const cacheRate = allLogs.length > 0 ? (cacheHits / allLogs.length) * 100 : 0
  if (cacheRate < 10 && allLogs.length > 20) {
    const avgCost = recentCost / Math.max(recentLogs.length, 1)
    const potentialCache = avgCost * recentLogs.length * 0.15
    insights.push({
      id: 'cache-opportunity',
      type: 'cache_opportunity',
      severity: 'info',
      title: `Cache hit rate is only ${cacheRate.toFixed(0)}%`,
      why: `Only ${cacheHits} of ${allLogs.length} requests hit the cache. Repeated or similar prompts are being re-processed.`,
      impact: `A 15% cache rate could save approximately $${(potentialCache/1e6).toFixed(2)}/week.`,
      action: 'Deduplicate similar prompts on your application side, or use consistent prompt templates.',
      potentialSavingsMicro: potentialCache,
      metric: cacheRate,
      metricLabel: 'cache hit rate',
      createdAt: now.toISOString(),
    })
  }

  // ── Insight 4: Feature concentration ──
  const featMap = new Map<string, number>()
  for (const l of recentLogs) {
    if (l.featureId) {
      featMap.set(l.featureId, (featMap.get(l.featureId) ?? 0) + l.actualCostMicro)
    }
  }
  if (featMap.size > 0) {
    const topFeature = Array.from(featMap.entries()).sort((a, b) => b[1] - a[1])[0]
    const topPct = recentCost > 0 ? (topFeature[1] / recentCost) * 100 : 0
    if (topPct > 50) {
      insights.push({
        id: 'feature-concentration',
        type: 'cost_spike',
        severity: 'warning',
        title: `Feature "${topFeature[0]}" drives ${topPct.toFixed(0)}% of spend`,
        why: `A single feature accounts for more than half of your AI spend this week.`,
        impact: `If this feature scales 2×, your total bill doubles. Concentration risk is high.`,
        action: 'Add a budget cap for this feature in Budget Center, or optimize its prompts.',
        metric: topPct,
        metricLabel: 'spend share',
        createdAt: now.toISOString(),
      })
    }
  }

  // ── Insight 5: Savings opportunity if no V2 ──
  const totalSavings = allLogs.reduce((a, l) => a + l.savingsMicro, 0)
  const totalCost    = allLogs.reduce((a, l) => a + l.actualCostMicro, 0)
  if (totalSavings === 0 && totalCost > 0 && allLogs.length > 10) {
    const potentialSavings = totalCost * 0.40
    insights.push({
      id: 'no-routing',
      type: 'savings_opportunity',
      severity: 'warning',
      title: 'Smart routing is not active',
      why: `All ${allLogs.length} requests used the same model with no cost optimization.`,
      impact: `Enabling intelligent routing could reduce your bill by up to 40% ($${(potentialSavings/1e6).toFixed(2)}).`,
      action: 'Add your API key in Settings and enable routing to start saving immediately.',
      potentialSavingsMicro: potentialSavings,
      createdAt: now.toISOString(),
    })
  }

  // Build summary
  const byModel = new Map<string, number>()
  for (const l of recentLogs) {
    byModel.set(l.model, (byModel.get(l.model) ?? 0) + l.actualCostMicro)
  }
  const topModel = Array.from(byModel.entries()).sort((a, b) => b[1] - a[1])[0]
  const topModelPct = topModel && recentCost > 0 ? Math.round((topModel[1] / recentCost) * 100) : 0
  const savingsOpportunity = insights.reduce((a, i) => a + (i.potentialSavingsMicro ?? 0), 0)

  return NextResponse.json({
    spendChange,
    topDriver: topModel?.[0] ?? 'N/A',
    topDriverPct: topModelPct,
    savingsOpportunityMicro: savingsOpportunity,
    insightCount: insights.length,
    insights,
  })
}
