import { NormalizedRequest } from '../types/normalized';
import { RouteDecision } from './types';
import { scorePrompt } from './ai-scorer';
import { applyRules } from './rules';
import { providerRegistry } from '../providers/registry';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';

export async function route(request: NormalizedRequest): Promise<RouteDecision> {
  // Approximate tokens
  const text = request.messages.map(m => m.content).join(' ');
  const inputTokens = Math.ceil(text.length / 4);

  // 1. Run AI scoring tier (cached via Redis)
  const score = await scorePrompt(request);

  // 2. Apply fast-path rules
  let decision = await applyRules(request, score, inputTokens);

  // 3. Fallback to AI Scored model
  if (!decision) {
    const model = score.recommended_model || request.model || 'gpt-4o';
    const provider = providerRegistry.getProvider(model);
    
    // Check Budget Downgrade Rule
    const estCost = provider.estimateCost(model, { input_tokens: inputTokens, output_tokens: 500 });
    const budgetRemaining = request.metadata.budget !== null && request.metadata.budget !== undefined 
      ? request.metadata.budget 
      : 9999;
    
    let finalModel = model;
    let ruleMatched = 'ai_scorer_fallback';
    
    if (budgetRemaining < estCost) {
      finalModel = 'gpt-4o-mini'; // Downgrade one tier to preserve budget
      ruleMatched = 'budget_downgrade';
    }

    const finalProvider = providerRegistry.getProvider(finalModel);
    
    decision = {
      provider: finalProvider.name,
      model: finalModel,
      reason: 'AI Scored decision + Budget check',
      estimated_cost_usd: finalProvider.estimateCost(finalModel, { input_tokens: inputTokens, output_tokens: 500 }),
      rule_matched: ruleMatched,
      task_type: score.task_type,
      complexity: score.complexity
    };
  }

  // 4. Async Log to DB
  logDecision(request.metadata.requestId, decision);

  // 5. Attach to request metadata
  request.metadata.route_decision = decision;

  return decision;
}

async function logDecision(requestId: string | undefined, decision: RouteDecision) {
  try {
    const sb = getSupabase();
    if (!sb) return;
    
    await sb.from('route_decisions').insert([{
      request_id: requestId || 'unknown',
      rule_matched: decision.rule_matched,
      model_chosen: decision.model,
      estimated_cost: decision.estimated_cost_usd,
      timestamp: new Date().toISOString()
    }]);
  } catch (err) {
    console.error('[Router] DB logging failed:', err?.message);
  }
}
