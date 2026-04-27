// @ts-ignore
import redis from '@/src/lib/redis';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';

export async function handleBudgetWarning(orgId: string, metadata: any) {
  // 1. Send webhook alert
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from('organizations').select('alert_webhook_url').eq('id', orgId).single();
    if (data?.alert_webhook_url) {
      await fetch(data.alert_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          type: 'BUDGET_WARNING',
          spend: metadata.spend,
          budget: metadata.budget,
          timestamp: new Date().toISOString()
        })
      }).catch(console.error);
    }
  }

  // 2. Set downgrade flag for Prompt 3 Router
  if (redis) {
    // Router will read this and automatically force the cheapest model for 1 hour
    await redis.set(`autopilot:downgrade:${orgId}`, 'true', { ex: 3600 });
  }
}

export async function handleBudgetExceeded(orgId: string) {
  // Hard lock the org
  if (redis) {
    // Calculate seconds until midnight UTC
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    if (midnight <= now) {
      midnight.setUTCDate(midnight.getUTCDate() + 1);
    }
    const ttlSeconds = Math.floor((midnight.getTime() - now.getTime()) / 1000);
    
    // Set hard lock. All proxy endpoints check this and return 429 immediately.
    await redis.set(`autopilot:locked:${orgId}`, 'true', { ex: ttlSeconds });
  }
}
