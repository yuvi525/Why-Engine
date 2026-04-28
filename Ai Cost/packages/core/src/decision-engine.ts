import { RoutingContext, RoutingDecision, RoutingReasonCode } from '@vela/types';
import * as costEngine from './cost-engine';
import { generateWHY } from './why-engine';

export function decide(ctx: RoutingContext): RoutingDecision {
  // ─── Simulated routing logic (unchanged) ────────────────────────────────────
  let provider: 'bedrock' | 'vertex' | 'openai' = 'vertex';
  let model: string = 'gemini-1.5-flash-002';
  let reasonCode: RoutingReasonCode = 'COMPLEXITY_LOW';

  // 1. Forced Model
  if (ctx.forcedModel) {
    reasonCode = 'FORCED_MODEL';
    model = ctx.forcedModel;
    if (model.includes('claude')) provider = 'bedrock';
    else if (model.includes('gpt')) provider = 'openai';
    else provider = 'vertex';
  }
  // 2. Budget Guard (< 10% remaining)
  else if (ctx.budgetRemainingUSD < ctx.dailyBudgetUSD * 0.10) {
    provider = 'vertex';
    model = 'gemini-1.5-flash-002';
    reasonCode = 'BUDGET_GUARD';
  }
  // 3. Complexity + Sensitivity Matrix
  else {
    switch (ctx.complexity) {
      case 1:
        provider = 'vertex';
        model = 'gemini-1.5-flash-002';
        reasonCode = 'COMPLEXITY_LOW';
        break;
      case 2:
        provider = 'bedrock';
        model = 'anthropic.claude-3-haiku-20240307';
        reasonCode = 'COMPLEXITY_MED';
        break;
      case 3:
        provider = 'bedrock';
        model = 'anthropic.claude-3-5-haiku-20241022';
        reasonCode = 'COMPLEXITY_MED';
        break;
      case 4:
        provider = 'vertex';
        model = 'gemini-1.5-pro-002';
        reasonCode = 'COMPLEXITY_HIGH';
        break;
      case 5:
        provider = 'openai';
        model = 'gpt-4o-mini';
        reasonCode = 'COMPLEXITY_HIGH';
        break;
    }

    // PII override: move from Vertex → Bedrock
    if (ctx.sensitivityFlags.includes('pii') && provider === 'vertex') {
      provider = 'bedrock';
      model = 'anthropic.claude-3-haiku-20240307';
      reasonCode = 'SENSITIVITY_PII';
    }
  }

  // 4. Provider health failover
  if (ctx.providerHealth[provider] === false) {
    reasonCode = 'PROVIDER_DOWN';
    if (provider === 'vertex') {
      provider = 'bedrock';
      model = 'anthropic.claude-3-haiku-20240307';
    } else if (provider === 'bedrock') {
      provider = 'openai';
      model = 'gpt-4o-mini';
    } else {
      provider = 'vertex';
      model = 'gemini-1.5-flash-002';
    }
  }

  // ─── Cost estimates ──────────────────────────────────────────────────────────
  const baselineCostUSD = costEngine.estimateCost('gpt-4o', ctx.estimatedInputTokens, ctx.estimatedOutputTokens);
  const estimatedCostUSD = costEngine.estimateCost(model, ctx.estimatedInputTokens, ctx.estimatedOutputTokens);
  const estimatedSavingsUSD = baselineCostUSD - estimatedCostUSD;

  const fallbackChain = ['anthropic.claude-3-haiku-20240307', 'gemini-1.5-flash-002', 'gpt-4o-mini'].filter(m => m !== model);

  const partialDecision = {
    provider,
    model,
    // ─── MVP: always execute via OpenAI ─────────────────────────────────────
    actualProvider: 'openai' as const,
    actualModel: 'gpt-4o-mini' as const,
    reasonCode,
    estimatedCostUSD,
    baselineCostUSD,
    estimatedSavingsUSD,
    fallbackChain,
  };

  const why = generateWHY(partialDecision, ctx);

  return { ...partialDecision, why };
}
