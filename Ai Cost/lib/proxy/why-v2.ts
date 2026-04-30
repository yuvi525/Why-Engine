import { ReasonCode } from './decide'
import { formatMicro } from './cost'
import { UserContext } from './context'
import { WHYExplanation } from './why'
import { generateWHY } from './why'

/**
 * WHY Engine V2 — personalized explanations using per-user Redis context.
 *
 * Falls back to WHY V1 templates for any reason code that doesn't have
 * a personalized variant, or when context data is thin (< 5 requests).
 *
 * CONTRACT: returns the same WHYExplanation shape — no breaking changes.
 */
export function generateWHY_v2(
  reason: ReasonCode,
  ctx: {
    model: string
    savingsMicro: number
    actualCostMicro: number
    baselineCostMicro: number
    budgetPct?: number
    spentTodayMicro?: number
    dailyLimitMicro?: number
  },
  userContext: UserContext
): WHYExplanation {
  const savingsUsd    = formatMicro(ctx.savingsMicro)
  const actualUsd     = formatMicro(ctx.actualCostMicro)
  const baselineUsd   = formatMicro(ctx.baselineCostMicro)
  const pct           = ctx.baselineCostMicro > 0
    ? Math.round((ctx.savingsMicro / ctx.baselineCostMicro) * 100)
    : 0

  // Only personalise once we have meaningful history (≥ 5 requests)
  const hasHistory = userContext.totalRequests >= 5

  // Per-model quality rate (% positive) — shown when we have ≥ 10 samples for this model
  const modelQuality = userContext.modelQuality[ctx.model]
  const qualityRate   =
    modelQuality && modelQuality.total >= 10
      ? Math.round((modelQuality.positive / modelQuality.total) * 100)
      : null

  const totalSavingsUsd  = (userContext.totalSavingsMicro / 1_000_000).toFixed(2)
  const avgComplexityPct = (userContext.avgComplexityScore * 100).toFixed(0)

  // ── COMPLEXITY_LOW ─────────────────────────────────────────────────
  if (reason === 'COMPLEXITY_LOW') {
    if (!hasHistory) {
      // Not enough history yet — use V1 template verbatim
      return generateWHY(reason, ctx)
    }

    return {
      why: `Task scored low on complexity — short context, straightforward task, no code or multi-step reasoning detected. Your last ${userContext.totalRequests} requests averaged ${avgComplexityPct}% complex.`,
      impact: `GPT-4o costs 16× more with no quality gain here.${
        qualityRate !== null
          ? ` Your history shows ${qualityRate}% positive quality rate on this model for similar tasks.`
          : ''
      }`,
      action: `Routed to GPT-4o-mini. Paid ${actualUsd} vs ${baselineUsd} baseline. Saved ${savingsUsd} (${pct}%). Total saved so far: $${totalSavingsUsd}.`,
    }
  }

  // ── COMPLEXITY_HIGH ────────────────────────────────────────────────
  if (reason === 'COMPLEXITY_HIGH') {
    if (!hasHistory) {
      return generateWHY(reason, ctx)
    }

    return {
      why: `Complexity scored high — code, reasoning, or extended context detected. Your profile shows ${avgComplexityPct}% of your last ${userContext.totalRequests} requests required this tier.`,
      impact: `GPT-4o-mini produces measurably lower quality on complex tasks.${
        qualityRate !== null
          ? ` Your GPT-4o quality rate is ${qualityRate}% positive — consistent with expectations.`
          : ''
      }`,
      action: `Routed to GPT-4o. Quality protected. Cost: ${actualUsd}.`,
    }
  }

  // ── BUDGET_GUARD ───────────────────────────────────────────────────
  if (reason === 'BUDGET_GUARD') {
    const spentUsd = ctx.spentTodayMicro !== undefined
      ? `$${(ctx.spentTodayMicro / 1_000_000).toFixed(4)}`
      : undefined
    const limitUsd = ctx.dailyLimitMicro !== undefined
      ? `$${(ctx.dailyLimitMicro / 1_000_000).toFixed(2)}`
      : undefined

    return {
      why: spentUsd && limitUsd
        ? `You have used ${spentUsd} of your ${limitUsd} daily budget (${ctx.budgetPct ?? '80'}%). Autopilot activated.${
            hasHistory ? ` You've saved $${totalSavingsUsd} in total with Vela.` : ''
          }`
        : `You have used ${ctx.budgetPct ?? '80'}% of your daily budget. Autopilot activated.`,
      impact: 'Continuing on GPT-4o would exhaust your budget before midnight and block remaining requests.',
      action: `Forced to GPT-4o-mini to protect remaining budget. Saved ${savingsUsd}.`,
    }
  }

  // ── All other reason codes — fall through to V1 ───────────────────
  return generateWHY(reason, ctx)
}
