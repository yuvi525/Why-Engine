import redis from '../state/redis-client';
import { providerRegistry } from '../providers/registry';

export async function recordProviderFailure(provider: string) {
  if (!redis) return;
  const key = `provider:fail:${provider}`;
  
  try {
    const fails = await redis.incr(key);
    if (fails === 1) {
      await redis.expire(key, 60); // 1 min rolling window
    }

    if (fails > 10) {
      // Hard offline protection
      await redis.set(`provider:health:${provider}`, 'offline', { ex: 300 }); // 5 min cooldown
      const provInst = providerRegistry.getProvider(provider);
      if (provInst) provInst.setHealth('offline');
    } else if (fails > 5) {
      // Degraded warning
      await redis.set(`provider:health:${provider}`, 'degraded', { ex: 60 });
      const provInst = providerRegistry.getProvider(provider);
      if (provInst) provInst.setHealth('degraded');
    }
  } catch (e) {
    console.error('[CircuitBreaker] Failed to record failure', e);
  }
}

export async function recordProviderSuccess(provider: string) {
  if (!redis) return;
  try {
    // Reset counters and restore health instantaneously on success
    await redis.del(`provider:fail:${provider}`);
    const provInst = providerRegistry.getProvider(provider);
    if (provInst && (await provInst.getHealth()) !== 'healthy') {
      provInst.setHealth('healthy');
      await redis.del(`provider:health:${provider}`);
    }
  } catch (e) {
    // silent fallback
  }
}
