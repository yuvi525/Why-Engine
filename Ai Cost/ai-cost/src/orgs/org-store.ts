import crypto from 'crypto';
import { Organization, ApiKey, OrgUsage } from './org.model';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';
// @ts-ignore
import redis from '@/src/lib/redis';

export async function getOrgByApiKey(rawKey: string): Promise<Organization | null> {
  // Secure SHA-256 hash comparison (no raw keys stored in DB)
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const cacheKey = `org:key:${hash}`;

  // 1. Extreme Fast Path: Redis Cache
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached as string);
  }

  // 2. Slow Path: DB Verification
  const sb = getSupabase();
  if (!sb) return null;

  const { data: keyData } = await sb.from('api_keys').select('org_id, is_active').eq('key_hash', hash).single();
  if (!keyData || !keyData.is_active) return null;

  const { data: orgData } = await sb.from('organizations').select('*').eq('id', keyData.org_id).single();
  if (!orgData) return null;

  // 3. Cache Hydration (5min TTL)
  if (redis) {
    await redis.set(cacheKey, JSON.stringify(orgData), { ex: 300 });
  }

  return orgData;
}

export async function getOrgUsage(orgId: string): Promise<OrgUsage> {
  let spendToday = 0;
  let spendMonth = 0;

  // Usage counters are strictly maintained in Redis for instantaneous guardrail checks
  if (redis) {
    const [todayStr, monthStr] = await Promise.all([
      redis.get(`usage:org:${orgId}:day`),
      redis.get(`usage:org:${orgId}:month`)
    ]);
    spendToday = parseFloat((todayStr as string) || '0');
    spendMonth = parseFloat((monthStr as string) || '0');
  }

  const sb = getSupabase();
  let dailyBudget = null;
  if (sb) {
    const { data } = await sb.from('organizations').select('daily_budget_usd').eq('id', orgId).single();
    if (data) dailyBudget = data.daily_budget_usd;
  }

  return {
    orgId,
    spend_today_usd: spendToday,
    spend_month_usd: spendMonth,
    daily_budget_usd: dailyBudget
  };
}

// Fire and forget function called at the very end of the proxy pipeline
export async function incrementUsage(orgId: string, costUsd: number, tokens: number): Promise<void> {
  if (!redis || costUsd <= 0) return;

  try {
    await Promise.all([
      redis.incrbyfloat(`usage:org:${orgId}:day`, costUsd),
      redis.incrbyfloat(`usage:org:${orgId}:month`, costUsd),
      redis.incrby(`usage:org:${orgId}:tokens:day`, tokens)
    ]);
  } catch (err) {
    console.error('[OrgStore] Failed to increment usage:', err);
  }
}
