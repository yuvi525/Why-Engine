import hnswlib from 'hnswlib-node';
// @ts-ignore
import redis from '@/src/lib/redis';

const idToHash: Map<number, string> = new Map();
let currentIndexId = 0;

const numDimensions = 1536; // OpenAI text-embedding-3-small dimension
let index: hnswlib.HierarchicalNSW | null = null;

try {
  index = new hnswlib.HierarchicalNSW('cosine', numDimensions);
  index.initIndex(10000); // Max safe elements in memory before paging out
} catch (err) {
  console.warn('[HNSW] Failed to initialize hnswlib. Using in-memory fallback.', err);
}

// Fallback if native module fails compilation on deployment
const memoryVectors: { id: number, vector: number[], hash: string, orgId: string }[] = [];

// Rebuild index from Redis on boot
export async function rebuildIndex() {
  if (!redis) return;
  try {
    let cursor = '0';
    do {
      const result = await redis.scan(cursor, { match: 'cache:org:*', count: 100 });
      cursor = result[0];
      const keys = result[1];

      for (const key of keys) {
        const hash = key.split(':').pop() as string;
        const orgId = key.split(':')[2];
        const vectorStr = await redis.hget(key, 'vector');
        if (vectorStr) {
          const vector = JSON.parse(vectorStr as string);
          addVectorToIndex(orgId, hash, vector);
        }
      }
    } while (cursor !== '0');
    console.log('[HNSW] Index rebuilt from Redis successfully.');
  } catch (err) {
    console.error('[HNSW] Failed to rebuild index:', err);
  }
}

export function addVectorToIndex(orgId: string, hash: string, vector: number[]) {
  const id = ++currentIndexId;
  idToHash.set(id, `${orgId}:${hash}`); // Scoped by Org to ensure strict multi-tenant isolation
  
  if (index) {
    try {
      index.addPoint(vector, id);
    } catch (e) {
      console.warn('[HNSW] Add point failed', e);
    }
  } else {
    // Brute force fallback
    memoryVectors.push({ id, vector, hash, orgId });
  }
}

function cosineSimilarity(A: number[], B: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function searchNearest(orgId: string, vector: number[], k: number = 1): { hash: string, distance: number } | null {
  if (index) {
    try {
      // Overfetch to ensure we can filter by org
      const result = index.searchKnn(vector, 10);
      for (let i = 0; i < result.neighbors.length; i++) {
        const id = result.neighbors[i];
        const distance = result.distances[i];
        const mapped = idToHash.get(id);
        if (mapped && mapped.startsWith(`${orgId}:`)) {
          return { hash: mapped.split(':')[1], distance };
        }
      }
      return null;
    } catch (err) {
      return null;
    }
  } else {
    // Brute force fallback
    let bestDist = Infinity;
    let bestHash = null;
    for (const v of memoryVectors) {
      if (v.orgId === orgId) {
        const sim = cosineSimilarity(vector, v.vector);
        const dist = 1 - sim;
        if (dist < bestDist) {
          bestDist = dist;
          bestHash = v.hash;
        }
      }
    }
    // HNSW cosine distance threshold equivalent for 0.92 similarity
    if (bestHash && bestDist <= 0.08) {
      return { hash: bestHash, distance: bestDist };
    }
    return null;
  }
}
