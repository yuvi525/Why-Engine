/**
 * src/lib/redis.ts
 *
 * Server-only Redis client via Upstash.
 * Import ONLY in API routes and server-side code.
 */

import { Redis } from '@upstash/redis';
import { serverEnv } from '@/src/config/env';

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (redisClient) return redisClient;

  const url   = serverEnv.UPSTASH_REDIS_REST_URL;
  const token = serverEnv.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      '[redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing. ' +
      'Check your .env.local file.'
    );
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

// Lazy proxy — import-time evaluation never crashes if env vars are missing.
// Actual connection only happens when a Redis method is first called.
const redisProxy = new Proxy({} as Redis, {
  get: (_, prop) => {
    const client = getRedis();
    return (client as any)[prop];
  },
}) as Redis;

export default redisProxy;
