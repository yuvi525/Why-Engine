export interface SavingsRecord {
  requestId: string;
  orgId: string;
  baseline_cost_usd: number;
  actual_cost_usd: number;
  savings_usd: number;
  savings_pct: number;
  saving_reason: 'routing' | 'cache' | 'compression' | 'combined' | 'none';
  timestamp?: string;
}
