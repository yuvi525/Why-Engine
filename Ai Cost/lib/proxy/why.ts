import { ReasonCode } from './decide'
import { formatMicro } from './cost'

export interface WHYExplanation {
  why: string
  impact: string
  action: string
}

export function generateWHY(
  reason: ReasonCode,
  ctx: {
    model: string
    savingsMicro: number
    budgetPct?: number
    spentTodayMicro?: number
    dailyLimitMicro?: number
    actualCostMicro: number
    baselineCostMicro: number
  }
): WHYExplanation {
  const savingsUsd = formatMicro(ctx.savingsMicro)
  const actualUsd  = formatMicro(ctx.actualCostMicro)
  const baselineUsd = formatMicro(ctx.baselineCostMicro)
    const pct = ctx.baselineCostMicro > 0
    ? Math.round((ctx.savingsMicro / ctx.baselineCostMicro) * 100)
    : 0

  let budgetWhy = `You have used ${ctx.budgetPct ?? '80'}% of your daily budget. Autopilot activated.`
  if (ctx.spentTodayMicro !== undefined && ctx.dailyLimitMicro !== undefined && ctx.dailyLimitMicro > 0) {
    const spent = (ctx.spentTodayMicro / 1_000_000).toFixed(4)
    const limit = (ctx.dailyLimitMicro / 1_000_000).toFixed(2)
    const pctValue = ((ctx.spentTodayMicro / ctx.dailyLimitMicro) * 100).toFixed(2)
    budgetWhy = `You have used $${spent} of your $${limit} daily budget (${pctValue}%). Autopilot activated.`
  }

  const templates: Record<ReasonCode, WHYExplanation> = {
    COMPLEXITY_LOW: {
      why: 'This request scored low on complexity — short context, straightforward task, no code or multi-step reasoning detected.',
      impact: `GPT-4o costs 16× more than GPT-4o-mini with no quality difference for this type of task.`,
      action: `Routed to GPT-4o-mini. You paid ${actualUsd}. Without Vela you would have paid ${baselineUsd}. Saved ${savingsUsd} (${pct}%).`,
    },
    COMPLEXITY_HIGH: {
      why: 'This request involves code, deep reasoning, or extended context — complexity scored high.',
      impact: 'GPT-4o-mini produces measurably lower quality on complex tasks. The cost of degraded output exceeds the price difference.',
      action: `Routed to GPT-4o. Quality protected. Cost: ${actualUsd}.`,
    },
    BUDGET_GUARD: {
      why: budgetWhy,
      impact: 'Continuing on GPT-4o would exhaust your budget before midnight and block remaining requests.',
      action: `Forced to GPT-4o-mini to protect remaining budget. Saved ${savingsUsd}.`,
    },
    BUDGET_EXHAUSTED: {
      why: 'Your daily budget has been fully consumed.',
      impact: 'No further requests will be processed until midnight UTC when the budget resets.',
      action: 'Request rejected (429). Increase your daily budget in Settings to continue.',
    },
    CACHE_HIT: {
      why: 'This exact request was made recently and the response was cached.',
      impact: 'Identical requests have identical optimal responses. No provider call needed.',
      action: `Returned cached response. Cost: $0.000000. Baseline: ${baselineUsd}. Saved 100%.`,
    },
  }

  return templates[reason]
}
