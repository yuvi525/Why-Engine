/**
 * Vela Plan Limits — single source of truth.
 * All enforcement (proxy, UI, API) reads from here.
 */

export type Plan = 'free' | 'pro' | 'scale'

export interface PlanConfig {
  name: string
  priceUsd: number          // monthly price
  requestsPerDay: number    // -1 = unlimited
  dailyBudgetCapUsd: number // max daily budget allowed
  byokAllowed: boolean      // bring your own OpenAI key
  v2RoutingAllowed: boolean // access to 5-tier routing
  shadowAnalytics: boolean  // shadow decision table access
  learningEngine: boolean   // routing confidence table access
  supportLevel: string
}

export const PLAN_LIMITS: Record<Plan, PlanConfig> = {
  free: {
    name:               'Free',
    priceUsd:           0,
    requestsPerDay:     50,
    dailyBudgetCapUsd:  5,
    byokAllowed:        true,   // BYOK required — no platform key on free
    v2RoutingAllowed:   false,
    shadowAnalytics:    false,
    learningEngine:     false,
    supportLevel:       'Community',
  },
  pro: {
    name:               'Pro',
    priceUsd:           29,
    requestsPerDay:     2000,
    dailyBudgetCapUsd:  50,
    byokAllowed:        true,
    v2RoutingAllowed:   true,
    shadowAnalytics:    true,
    learningEngine:     false,
    supportLevel:       'Email',
  },
  scale: {
    name:               'Scale',
    priceUsd:           99,
    requestsPerDay:     -1,       // unlimited
    dailyBudgetCapUsd:  500,
    byokAllowed:        true,
    v2RoutingAllowed:   true,
    shadowAnalytics:    true,
    learningEngine:     true,
    supportLevel:       'Priority',
  },
}

/**
 * Returns true if the request count exceeds the plan's daily limit.
 * Always returns false for unlimited plans.
 */
export function isOverRequestLimit(plan: Plan, requestsToday: number): boolean {
  const limit = PLAN_LIMITS[plan].requestsPerDay
  if (limit === -1) return false
  return requestsToday >= limit
}

/**
 * Returns the usage percentage (0–100) for requests today.
 * Returns 0 for unlimited plans.
 */
export function requestUsagePct(plan: Plan, requestsToday: number): number {
  const limit = PLAN_LIMITS[plan].requestsPerDay
  if (limit === -1) return 0
  return Math.min(Math.round((requestsToday / limit) * 100), 100)
}
