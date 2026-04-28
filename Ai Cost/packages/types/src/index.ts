export interface RoutingContext {
  requestId: string;
  complexity: 1 | 2 | 3 | 4 | 5;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  budgetRemainingUSD: number;
  dailyBudgetUSD: number;
  forcedModel?: string;
  providerHealth: Record<'bedrock' | 'vertex' | 'openai', boolean>;
  sensitivityFlags: Array<'pii' | 'financial' | 'legal' | 'none'>;
  userId?: string;
}

export type RoutingReasonCode =
  | 'COMPLEXITY_LOW' | 'COMPLEXITY_MED' | 'COMPLEXITY_HIGH'
  | 'BUDGET_GUARD' | 'SENSITIVITY_PII' | 'FORCED_MODEL'
  | 'PROVIDER_DOWN' | 'CACHE_HIT' | 'BATCH_ELIGIBLE';

export interface WHYExplanation {
  why: string;
  impact: string;
  action: string;
  decision: string;
}

export interface RoutingDecision {
  provider: 'bedrock' | 'vertex' | 'openai'; // simulated provider
  model: string;                               // simulated model
  actualProvider: 'openai';                   // MVP: always openai
  actualModel: 'gpt-4o-mini';                 // MVP: always gpt-4o-mini
  reasonCode: RoutingReasonCode;
  estimatedCostUSD: number;
  baselineCostUSD: number;
  estimatedSavingsUSD: number;
  fallbackChain: string[];
  why: WHYExplanation;
}

export interface ProxyRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  vela_budget_override?: number;
  vela_force_model?: string;
  vela_sensitivity?: string[];
}

export interface DecisionLog {
  id: string;
  requestId: string;
  userId: string;
  timestamp: Date;
  originalModel: string;
  routedModel: string;
  provider: string;
  reasonCode: string;
  inputTokens: number;
  outputTokens: number;
  actualCostUSD: number;
  baselineCostUSD: number;
  savingsUSD: number;
  latencyMs: number;
  why: string;
}
