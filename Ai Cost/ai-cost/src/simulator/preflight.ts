import { NormalizedRequest } from '../types/normalized';
import { route } from '../routing/router';
import { calculateCostForModel, BASELINE_MODEL } from '../savings/pricing';

export interface SimulationResult {
  model: string;
  estimated_cost_usd: number;
  estimated_savings_usd: number;
  confidence: number;
}

export async function simulate(request: NormalizedRequest): Promise<SimulationResult> {
  // 1. Run routing engine heuristically (No LLM API call is dispatched)
  const routeDecision = await route(request);
  const selectedModel = routeDecision.model;

  // 2. Estimate token volume (Heuristic: ~4 chars = 1 token + output assumption)
  const textLength = request.messages.map(m => m.content || '').join(' ').length;
  const inputTokens = Math.ceil(textLength / 4);
  const estimatedOutputTokens = 500; // Configurable heuristic default

  // 3. Compression Estimation (Assume 20% savings if compression is enabled)
  let effectiveInputTokens = inputTokens;
  if (!request.metadata?.bypassCompression) {
    effectiveInputTokens = Math.floor(inputTokens * 0.8);
  }

  // 4. Financial Forecasting
  const baselineCost = calculateCostForModel(BASELINE_MODEL, inputTokens, estimatedOutputTokens);
  const actualEstimatedCost = calculateCostForModel(selectedModel, effectiveInputTokens, estimatedOutputTokens);
  
  const estimatedSavings = Math.max(0, baselineCost - actualEstimatedCost);

  return {
    model: selectedModel,
    estimated_cost_usd: actualEstimatedCost,
    estimated_savings_usd: estimatedSavings,
    confidence: 0.85 // Heuristic confidence based on static routing vs dynamic variables
  };
}
