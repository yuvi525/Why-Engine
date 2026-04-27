import { NormalizedRequest } from '../../types/normalized';
import { AnomalyResult } from '../types';
// @ts-ignore
import redis from '@/src/lib/redis';

export async function detectSpike(request: NormalizedRequest): Promise<AnomalyResult | null> {
  const orgId = request.metadata?.orgId || 'default_org';
  const currentMin = Math.floor(Date.now() / 60000);
  const minKey = `usage:rpm:${orgId}:${currentMin}`;
  const avgKey = `usage:avg_rpm:${orgId}`;

  if (!redis) return null;

  try {
    const currentRpm = await redis.incr(minKey);
    if (currentRpm === 1) {
      await redis.expire(minKey, 120); // 2 min TTL
    }

    const avgStr = await redis.get(avgKey);
    const avgRpm = avgStr ? parseFloat(avgStr as string) : 10; // default safe baseline

    if (currentRpm > (avgRpm * 3) && currentRpm > 20) { // Threshold rule: > 3x avg AND > 20 req
      return {
        type: 'SPIKE',
        message: `Traffic spike detected: ${currentRpm} RPM vs avg ${avgRpm.toFixed(1)} RPM`,
        isBlocking: false,
        metadata: { currentRpm, avgRpm }
      };
    }
  } catch (err) {
    console.error('[SpikeDetector] Failed:', err);
  }

  return null;
}
