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
