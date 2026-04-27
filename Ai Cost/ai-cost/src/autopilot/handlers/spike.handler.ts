// @ts-ignore
import redis from '@/src/lib/redis';

export async function handleSpike(orgId: string, metadata: any) {
  if (!redis) return;

  // Apply a strict rate limit ceiling (e.g. max 10 RPM) for 30 minutes
  await redis.set(`autopilot:rate-limit:${orgId}`, '10', { ex: 1800 });
}
