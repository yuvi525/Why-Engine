import crypto from 'crypto';
import { NormalizedRequest, NormalizedResponse } from '../types/normalized';
import { CacheResult } from './types';
import { addVectorToIndex, searchNearest, rebuildIndex } from './hnsw-index';
// @ts-ignore
import redis from '@/src/lib/redis';

// Hydrate the HNSW index from Redis on service boot exactly once
let isRebuilding = false;
if (!isRebuilding) {
  isRebuilding = true;
  rebuildIndex().catch(console.error);
}

async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });
    const json = await res.json();
    return json?.data?.[0]?.embedding || null;
  } catch (err) {
    console.error('[SemanticCache] Embedding generation failed', err);
    return null;
  }
}

export async function get(request: NormalizedRequest): Promise<CacheResult | null> {
  const bypass = request.metadata?.bypassCache === true; // Usually driven by HTTP Header X-Autopilot-Cache
  if (bypass) {
    console.log('[SemanticCache] Bypass requested by client header');
    return null;
  }

  const orgId = request.metadata?.orgId || 'default_org';
  
  const lastMessage = request.messages.slice(-1)[0]?.content;
  if (!lastMessage) return null;

  const vector = await getEmbedding(lastMessage);
  if (!vector) return null;

  const nearest = searchNearest(orgId, vector, 1);
  if (!nearest) return null;

  // Threshold: Cosine similarity > 0.92 (Distance < 0.08)
  if (nearest.distance > 0.08) return null;

  if (redis) {
    const responseStr = await redis.hget(`cache:org:${orgId}:${nearest.hash}`, 'response');
    if (responseStr) {
      const response: NormalizedResponse = JSON.parse(responseStr as string);
      response.cache_hit = true;
      console.log(`[SemanticCache] HIT! Similarity: ${1 - nearest.distance}`);
      return {
        hit: true,
        response,
        similarity: 1 - nearest.distance
      };
    }
  }

  return null;
}

export async function set(request: NormalizedRequest, response: NormalizedResponse): Promise<void> {
  try {
    const orgId = request.metadata?.orgId || 'default_org';
    const lastMessage = request.messages.slice(-1)[0]?.content;
    if (!lastMessage || !redis) return;

    // Secure SHA-256 Hash for Redis mapping
    const hash = crypto.createHash('sha256').update(lastMessage).digest('hex');
    
    const exists = await redis.exists(`cache:org:${orgId}:${hash}`);
    if (exists) return; // Prevent duplicative embedding cost

    const vector = await getEmbedding(lastMessage);
    if (!vector) return;

    const key = `cache:org:${orgId}:${hash}`;
    await redis.hset(key, {
      vector: JSON.stringify(vector),
      response: JSON.stringify(response)
    });
    // 24 Hour TTL
    await redis.expire(key, 86400);

    // Sync to memory index instantly
    addVectorToIndex(orgId, hash, vector);

  } catch (err) {
    console.error('[SemanticCache] Set failed', err);
  }
}
