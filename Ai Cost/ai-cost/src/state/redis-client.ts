import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

try {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || ''
  });
} catch (e) {
  console.warn('[Redis] Client initialization failed. System will operate in degraded fail-open mode.');
}

export default redis;
