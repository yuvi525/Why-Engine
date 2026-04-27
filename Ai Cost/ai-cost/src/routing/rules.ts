import { NormalizedRequest } from '../types/normalized';
import { AIScore, RouteDecision } from './types';
import { providerRegistry } from '../providers/registry';

export async function applyRules(
  request: NormalizedRequest, 
  score: AIScore, 
  inputTokens: number
): Promise<RouteDecision | null> {
  const metadata = request.metadata || {};
  const preferredProvider = metadata.preferred_provider;

  // 1. Long context rule
  if (inputTokens > 8000) {
    const model = 'claude-3-5-sonnet-20241022';
    const provider = providerRegistry.getProvider(model);
    return {
      provider: provider.name,
      model,
      reason: 'Input exceeds 8k tokens, routing to long-context model',
      estimated_cost_usd: provider.estimateCost(model, { input_tokens: inputTokens, output_tokens: 500 }),
      rule_matched: 'long_context_>8k'
    };
  }

  // 2. Classification fast-path
  if (inputTokens < 500 && score.task_type === 'classification') {
    const model = 'gpt-4o-mini';
    const provider = providerRegistry.getProvider(model);
    return {
      provider: provider.name,
      model,
      reason: 'Low token classification task',
      estimated_cost_usd: provider.estimateCost(model, { input_tokens: inputTokens, output_tokens: 100 }),
      rule_matched: 'classification_fast_path'
    };
  }

  // 3. Preferred provider honor rule
  if (preferredProvider) {
    try {
      let targetModel = preferredProvider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o';
      const provider = providerRegistry.getProvider(targetModel);
      
      const health = await provider.getHealth();
      if (health !== 'degraded' && health !== 'offline') {
        return {
          provider: provider.name,
          model: targetModel,
          reason: 'Honoring org preferred provider',
          estimated_cost_usd: provider.estimateCost(targetModel, { input_tokens: inputTokens, output_tokens: 500 }),
          rule_matched: 'preferred_provider'
        };
      }
    } catch (e) {
      // Fall through to scorer if provider is offline or missing
    }
  }

  return null; 
}
