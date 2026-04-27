import redis from '../state/redis-client';

export interface OrgFlags {
  enable_cache: boolean;
  enable_compression: boolean;
  enable_ai_routing: boolean;
}

const DEFAULT_FLAGS: OrgFlags = {
  enable_cache: true,
  enable_compression: true,
  enable_ai_routing: true
};

export async function getFeatureFlags(orgId: string): Promise<OrgFlags> {
  if (!redis) return DEFAULT_FLAGS;

  try {
    const cached = await redis.get(`flags:${orgId}`);
    if (cached) {
      return { ...DEFAULT_FLAGS, ...(typeof cached === 'string' ? JSON.parse(cached) : cached) };
    }
  } catch (e) {
    // Fail open safely on Redis outage
  }

  return DEFAULT_FLAGS;
}
