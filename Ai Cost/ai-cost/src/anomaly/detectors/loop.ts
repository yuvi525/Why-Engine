import crypto from 'crypto';
import { NormalizedRequest } from '../../types/normalized';
import { AnomalyResult } from '../types';
// @ts-ignore
import redis from '@/src/lib/redis';

export async function detectLoop(request: NormalizedRequest): Promise<AnomalyResult | null> {
  const orgId = request.metadata?.orgId || 'default_org';
  const text = request.messages.map(m => m.content).join('\n');
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  
  const key = `anomaly:loop:${orgId}:${hash}`;
  
  if (!redis) return null;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60); // 60s rolling window
    }

    if (count > 5) {
      return {
        type: 'LOOP',
        message: `Identical prompt detected ${count} times in 60s`,
        isBlocking: true,
        metadata: { hash, count }
      };
    }
  } catch (err) {
    console.error('[LoopDetector] Failed:', err);
  }

  return null;
}
