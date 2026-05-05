import { ComplexityScore } from './classify'
import { AutopilotAction } from './autopilot'

export type ModelAlias = 'vela-mini' | 'vela-pro'

export type ReasonCode =
  | 'COMPLEXITY_LOW'
  | 'COMPLEXITY_HIGH'
  | 'BUDGET_GUARD'
  | 'BUDGET_EXHAUSTED'
  | 'CACHE_HIT'

export interface RoutingDecision {
  model: ModelAlias
  reasonCode: ReasonCode
}

export function decide(
  complexity: ComplexityScore,
  autopilotAction: AutopilotAction
): RoutingDecision {
  if (autopilotAction.action === 'FORCE_MINI') {
    return { model: 'vela-mini', reasonCode: 'BUDGET_GUARD' }
  }
  if (complexity === 1) {
    return { model: 'vela-pro', reasonCode: 'COMPLEXITY_HIGH' }
  }
  return { model: 'vela-mini', reasonCode: 'COMPLEXITY_LOW' }
}

/**
 * Phase 6: Margin-aware routing override.
 * Applied AFTER decide() but BEFORE provider call.
 * Does NOT replace decide() — only overrides when margin protection is needed.
 */
export function applyMarginOverride(
  routing: RoutingDecision,
  userPlan: string,
  budgetPct: number,
  autoDowngradeAt: number
): RoutingDecision {
  // Rule 1: Free users always get mini (explicit enforcement beyond plan limits)
  if (userPlan === 'free' && routing.model === 'vela-pro') {
    return { model: 'vela-mini', reasonCode: 'BUDGET_GUARD' }
  }

  // Rule 2: If budget % exceeds autoDowngrade threshold, force mini
  if (budgetPct >= autoDowngradeAt * 100 && routing.model === 'vela-pro') {
    return { model: 'vela-mini', reasonCode: 'BUDGET_GUARD' }
  }

  // Rule 3: Pro/Scale users with vela-pro → allow (margin can absorb it)
  // Rule 4: Default → return routing unchanged
  return routing
}
