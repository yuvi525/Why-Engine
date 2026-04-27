import { NormalizedResponse } from '../types/normalized';
import { RouteDecision } from '../routing/types';
import { SavingsRecord } from './types';
import { calculateCostForModel, BASELINE_MODEL } from './pricing';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';
// @ts-ignore
import redis from '@/src/lib/redis';

export async function calculateSavings(
  response: NormalizedResponse, 
  routeDecision?: RouteDecision | null
): Promise<SavingsRecord> {
  const requestId = response.metadata?.requestId || 'unknown';
  const orgId = response.metadata?.orgId || 'default_org';

  // 1. Calculate Universal Baseline Cost (What it WOULD have cost without AI proxy)
  const baselineCost = calculateCostForModel(BASELINE_MODEL, response.input_tokens, response.output_tokens);

  let actualCost = 0;
  let savingReason: SavingsRecord['saving_reason'] = 'none';

  // 2. Determine actual cost and categorization
  if (response.cache_hit) {
    actualCost = 0;
    savingReason = 'cache';
  } else {
    actualCost = calculateCostForModel(response.model_used, response.input_tokens, response.output_tokens);
    
    const isRouted = routeDecision && routeDecision.model !== BASELINE_MODEL;
    // We will support compression tracking fully in Prompt 6, but we check metadata preemptively
    const isCompressed = response.metadata?.compressed === true;

    if (isRouted && isCompressed) {
      savingReason = 'combined';
    } else if (isRouted) {
      savingReason = 'routing';
    } else if (isCompressed) {
      savingReason = 'compression';
    }
  }

  // 3. Compute Savings Dollars and Percentages
  const savingsUsd = Math.max(0, baselineCost - actualCost);
  let savingsPct = 0;
  if (baselineCost > 0) {
    savingsPct = (savingsUsd / baselineCost) * 100;
  }

  const record: SavingsRecord = {
    requestId,
    orgId,
    baseline_cost_usd: baselineCost,
    actual_cost_usd: actualCost,
    savings_usd: savingsUsd,
    savings_pct: savingsPct,
    saving_reason: savingReason,
    timestamp: new Date().toISOString()
  };

  // 4. Fire-and-Forget Persistence
  setImmediate(() => {
    persistSavings(record);
  });

  return record;
}

async function persistSavings(record: SavingsRecord) {
  try {
    // 1. Fast Redis Aggregation (Atomic INCRBYFLOAT) for real-time dashboards
    if (redis && record.savings_usd > 0) {
      await redis.incrbyfloat(`savings:org:${record.orgId}`, record.savings_usd);
    }

    // 2. Long-term Supabase DB log
    const sb = getSupabase();
    if (!sb) return;

    await sb.from('savings_records').insert([{
      request_id: record.requestId,
      org_id: record.orgId,
      baseline_cost_usd: record.baseline_cost_usd,
      actual_cost_usd: record.actual_cost_usd,
      savings_usd: record.savings_usd,
      savings_pct: record.savings_pct,
      saving_reason: record.saving_reason,
      timestamp: record.timestamp
    }]);

  } catch (err) {
    console.error('[SavingsCalculator] Failed to persist savings:', err);
  }
}
