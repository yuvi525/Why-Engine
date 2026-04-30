import { Redis } from '@upstash/redis'

export interface QualitySignal {
  signal: 'positive' | 'neutral' | 'negative'
  reason: string
}

/**
 * Derives a quality signal from the OpenAI finish_reason and token ratio.
 * Pure function — no I/O.
 */
export function computeQualitySignal(
  finishReason: string | undefined,
  inputTokens: number,
  outputTokens: number
): QualitySignal {
  if (!finishReason || finishReason === 'stop') {
    // Sanity check: output should be ≥5% of input for non-trivial tasks
    if (outputTokens < inputTokens * 0.05 && inputTokens > 50) {
      return { signal: 'negative', reason: 'low_output_ratio' }
    }
    return { signal: 'positive', reason: 'clean_stop' }
  }

  if (finishReason === 'length') {
    return { signal: 'neutral', reason: 'truncated' }
  }

  if (finishReason === 'content_filter') {
    return { signal: 'negative', reason: 'content_filter' }
  }

  return { signal: 'neutral', reason: 'unknown' }
}

/**
 * Detects if this request is a retry within a 30-second window.
 * Uses Redis NX (set if not exists) — returns true when the key already existed (retry).
 * Fails open: always returns false on Redis error.
 */
export async function detectRetry(
  redis: Redis,
  userId: string,
  cacheKeyPrefix: string
): Promise<boolean> {
  const retryKey = `retry:${userId}:${cacheKeyPrefix.slice(0, 20)}`
  try {
    // Returns 'OK' on first set, null if key already existed
    const result = await redis.set(retryKey, '1', { nx: true, ex: 30 })
    return result === null // null → key existed → this is a retry
  } catch {
    return false // fail open
  }
}
