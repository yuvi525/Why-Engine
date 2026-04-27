import { NormalizedRequest } from '../../types/normalized';
import { AnomalyResult } from '../types';
// @ts-ignore
import redis from '@/src/lib/redis';

export async function detectProviderError(request: NormalizedRequest): Promise<AnomalyResult | null> {
  const provider = request.model?.startsWith('claude') ? 'anthropic' : 'openai';
  
  if (!redis) return null;

  try {
    const errorKey = `provider:errors:${provider}`;
    const totalKey = `provider:total:${provider}`;

    const [errorsStr, totalStr] = await Promise.all([
      redis.get(errorKey),
      redis.get(totalKey)
    ]);

    const errors = parseInt((errorsStr as string) || '0', 10);
    const total = parseInt((totalStr as string) || '0', 10);

    // Only calculate anomaly if we have a statistically significant volume in the time window
    if (total > 10) {
      const errorRate = errors / total;
      if (errorRate > 0.20) { // 20% error rate threshold
        return {
          type: 'PROVIDER_DEGRADED',
          message: `${provider} error rate at ${(errorRate * 100).toFixed(1)}%`,
          isBlocking: false,
          metadata: { provider, errorRate, errors, total }
        };
      }
    }
  } catch (err) {
    console.error('[ProviderErrorDetector] Failed:', err);
  }

  return null;
}
