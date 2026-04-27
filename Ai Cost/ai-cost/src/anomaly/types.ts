import { NormalizedRequest } from '../types/normalized';

export type AnomalyType = 'LOOP' | 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'SPIKE' | 'PROVIDER_DEGRADED';

export interface AnomalyResult {
  type: AnomalyType;
  message: string;
  isBlocking: boolean;
  metadata?: any;
}

export interface OrgUsage {
  orgId: string;
  spend_today_usd: number;
  daily_budget_usd: number | null;
}
