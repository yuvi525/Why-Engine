import { OrgUsage, AnomalyResult } from '../types';

export function detectBudget(orgUsage: OrgUsage): AnomalyResult | null {
  if (!orgUsage.daily_budget_usd) return null;

  const ratio = orgUsage.spend_today_usd / orgUsage.daily_budget_usd;

  if (ratio >= 1.0) {
    return {
      type: 'BUDGET_EXCEEDED',
      message: `Daily budget exceeded: $${orgUsage.spend_today_usd} / $${orgUsage.daily_budget_usd}`,
      isBlocking: true,
      metadata: { spend: orgUsage.spend_today_usd, budget: orgUsage.daily_budget_usd }
    };
  }

  if (ratio >= 0.9) {
    return {
      type: 'BUDGET_WARNING',
      message: `Daily budget at ${(ratio * 100).toFixed(1)}%`,
      isBlocking: false,
      metadata: { spend: orgUsage.spend_today_usd, budget: orgUsage.daily_budget_usd }
    };
  }

  return null;
}
