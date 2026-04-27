// @ts-ignore
import { getSupabase } from '@/src/lib/db';

export async function computeEfficiencyScore(orgId: string, cacheHitRate: number, wasteScore: number) {
  const sb = getSupabase();
  if (!sb) return;

  // Mathematical Rubric: Scale 0 to 100
  const baseScore = 50;
  const cacheBonus = cacheHitRate * 50; // High hit rate adds points
  const wastePenalty = Math.min(wasteScore, 50); // High waste subtracts points

  const score = Math.max(0, Math.min(100, Math.floor(baseScore + cacheBonus - wastePenalty)));

  await sb.from('efficiency_scores').insert([{
    org_id: orgId,
    score,
    date: new Date().toISOString().split('T')[0],
    factors: { cacheHitRate, wasteScore }
  }]);

  return score;
}
