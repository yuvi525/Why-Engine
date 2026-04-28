import { RoutingContext, RoutingDecision, RoutingReasonCode } from '@vela/types';
import * as costEngine from './cost-engine';
import { generateWHY } from './why-engine';

export function decide(ctx: RoutingContext): RoutingDecision {
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
  // 2. Budget Guard
  else if (ctx.budgetRemainingUSD < ctx.dailyBudgetUSD * 0.10) {
    provider = 'vertex';
    model = 'gemini-1.5-flash-002';
    reasonCode = 'BUDGET_GUARD';
  }
  // 3. Sensitivity Flags + Complexity Matrix
  else {
    // Default matrix
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

    // Apply sensitivity override
    if (ctx.sensitivityFlags.includes('pii') && provider === 'vertex') {
      provider = 'bedrock';
      model = 'anthropic.claude-3-haiku-20240307';
      reasonCode = 'SENSITIVITY_PII';
    }
  }

  // 4. Provider Down Fallback
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

  const baselineCostUSD = costEngine.estimateCost('gpt-4o', ctx.estimatedInputTokens, ctx.estimatedOutputTokens);
  const estimatedCostUSD = costEngine.estimateCost(model, ctx.estimatedInputTokens, ctx.estimatedOutputTokens);
  const estimatedSavingsUSD = baselineCostUSD - estimatedCostUSD;

  const fallbackChain = ['anthropic.claude-3-haiku-20240307', 'gemini-1.5-flash-002', 'gpt-4o-mini'].filter(m => m !== model);

  const partialDecision = {
    provider,
    model,
    reasonCode,
    estimatedCostUSD,
    baselineCostUSD,
    estimatedSavingsUSD,
    fallbackChain,
  };

  const why = generateWHY(partialDecision as any, ctx);

  return {
    ...partialDecision,
    why
  };
}
