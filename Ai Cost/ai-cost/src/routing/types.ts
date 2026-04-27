export interface RouteDecision {
  provider: string;
  model: string;
  reason: string;
  estimated_cost_usd: number;
  rule_matched: string | null;
  task_type?: string;
  complexity?: number;
}

export interface AIScore {
  complexity: number;
  task_type: string;
  recommended_model: string;
}
