export type AutopilotAction =
  | { action: 'FORCE_MINI'; reason: 'BUDGET_GUARD' }
  | { action: 'REJECT'; reason: 'BUDGET_EXHAUSTED' }
  | { action: 'PASS'; reason: null }

export interface BudgetState {
  spentTodayMicro: number
  dailyLimitMicro: number
  requestsToday: number
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

  // Guard: Only trigger if condition is stable (e.g., more than just 1 or 2 expensive requests)
  // Ensure we have at least 5 requests today to avoid false positives on a single massive payload.
  if (pct >= threshold && budget.requestsToday >= 5) {
    return { action: 'FORCE_MINI', reason: 'BUDGET_GUARD' }
  }

  return { action: 'PASS', reason: null }
}
