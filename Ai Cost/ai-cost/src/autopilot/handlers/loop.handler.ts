// @ts-ignore
import redis from '@/src/lib/redis';

export async function handleLoop(orgId: string, metadata: any) {
  const { hash } = metadata;
  if (!hash || !redis) return;

  // Block exactly this prompt hash for this org for 10 minutes
  await redis.set(`autopilot:loop-block:${orgId}:${hash}`, 'true', { ex: 600 });
}
