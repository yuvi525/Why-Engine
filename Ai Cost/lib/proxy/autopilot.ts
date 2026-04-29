export type AutopilotAction =
  | { action: 'FORCE_MINI'; reason: 'BUDGET_GUARD' }
  | { action: 'REJECT'; reason: 'BUDGET_EXHAUSTED' }
  | { action: 'PASS'; reason: null }

export interface BudgetState {
  spentTodayMicro: number
  dailyLimitMicro: number
}

export interface UserSettings {
  autoDowngradeAt: number // 0.50–0.99
}

export function autopilot(budget: BudgetState, settings: UserSettings): AutopilotAction {
  const hardCap = Math.min(budget.dailyLimitMicro, 50_000_000) // $50 max

  if (budget.spentTodayMicro >= hardCap) {
    return { action: 'REJECT', reason: 'BUDGET_EXHAUSTED' }
  }

  const pct = budget.spentTodayMicro / hardCap
  const threshold = Math.min(Math.max(settings.autoDowngradeAt, 0.5), 0.99)

  if (pct >= threshold) {
    return { action: 'FORCE_MINI', reason: 'BUDGET_GUARD' }
  }

  return { action: 'PASS', reason: null }
}
