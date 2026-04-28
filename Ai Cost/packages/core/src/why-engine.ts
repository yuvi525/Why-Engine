import { RoutingContext, WHYExplanation } from '@vela/types';

interface PartialDecision {
  provider: string;
  model: string;
  reasonCode: string;
  estimatedCostUSD: number;
  baselineCostUSD: number;
  estimatedSavingsUSD: number;
}

export function generateWHY(decision: PartialDecision, ctx: RoutingContext): WHYExplanation {
  const savings = decision.estimatedSavingsUSD.toFixed(6);
  const cost = decision.estimatedCostUSD.toFixed(6);

  let why = '';
  let impact = '';
  let action = '';
  let decisionText = '';

  switch (decision.reasonCode) {
    case 'COMPLEXITY_LOW':
      why = 'Request complexity scored 1/5 — short, single-turn, no specialized content.';
      impact = 'Premium models would cost ~10x more without adding value.';
      action = `Routed to ${decision.model} on ${decision.provider}, the most cost-efficient option for this task.`;
      decisionText = `Saved $${savings} vs GPT-4o baseline.`;
      break;

    case 'COMPLEXITY_MED':
      why = `Request complexity scored ${ctx.complexity}/5 — moderate length or contains code.`;
      impact = 'Task requires capable model but not frontier-level reasoning.';
      action = `Routed to ${decision.model} on ${decision.provider} — strong capability at low cost.`;
      decisionText = `Saved $${savings} vs GPT-4o baseline.`;
      break;

    case 'COMPLEXITY_HIGH':
      why = `Request complexity scored ${ctx.complexity}/5 — long context or complex reasoning required.`;
      impact = 'Task requires frontier-level capability to avoid quality degradation.';
      action = `Routed to ${decision.model} on ${decision.provider} — optimal for high complexity.`;
      decisionText = `Saved $${savings} vs GPT-4o baseline.`;
      break;

    case 'BUDGET_GUARD':
      why = 'Daily budget utilization exceeded 90%. Budget protection activated.';
      impact = 'Continuing at current spend rate would exhaust budget in <1h.';
      action = `Forced cheapest available model: ${decision.model}.`;
      decisionText = `Saved $${savings}. Budget guard prevented overage.`;
      break;

    case 'SENSITIVITY_PII':
      why = 'Request contains personal data indicators. Google Vertex AI excluded.';
      impact = 'Routing to Google would expose PII to a third-party training pipeline.';
      action = 'Routed to AWS Bedrock — data stays in your AWS account.';
      decisionText = `Saved $${savings} while maintaining data residency compliance.`;
      break;

    case 'FORCED_MODEL':
      why = `Policy or request explicitly required model: ${decision.model}.`;
      impact = 'Override bypassed automatic optimization.';
      action = 'Honored forced model selection.';
      decisionText = `Cost: $${cost}. No savings applied due to override.`;
      break;

    case 'PROVIDER_DOWN':
      why = 'Primary provider returned health check failure.';
      impact = 'Requests to unhealthy provider would fail or timeout.';
      action = `Automatically failed over to ${decision.model} on ${decision.provider}.`;
      decisionText = `Prevented failure. Saved $${savings} vs GPT-4o.`;
      break;

    default:
      // ─── Guaranteed fallback — never returns empty strings ────────────────
      why = 'Standard routing applied.';
      impact = 'Optimized for cost-performance balance.';
      action = 'Used best available model.';
      decisionText = 'Cost optimized.';
      break;
  }

  return { why, impact, action, decision: decisionText };
}
