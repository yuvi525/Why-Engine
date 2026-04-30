import { Redis } from '@upstash/redis'

export interface ModelQualityRecord {
  positive: number
  neutral: number
  negative: number
  total: number
}

export interface UserContext {
  totalRequests: number
  avgComplexityScore: number
  recentComplexity: number[]   // rolling last 100
  totalSavingsMicro: number
  modelQuality: Record<string, ModelQualityRecord>
  lastUpdatedAt: number
}

export interface ContextEvent {
  complexity: 0 | 1
  model: string
  savingsMicro: number
  qualitySignal: 'positive' | 'neutral' | 'negative'
}

/**
 * Writes a new context event for a user.
 * Async void — never throws, never blocks the critical path.
 */
export async function updateUserContext(
  redis: Redis,
  userId: string,
  event: ContextEvent
): Promise<void> {
  try {
    const key = `user_context:${userId}`
    const existing = await redis.get<UserContext>(key)

    const ctx: UserContext = existing ?? {
      totalRequests: 0,
      avgComplexityScore: 0,
      recentComplexity: [],
      totalSavingsMicro: 0,
      modelQuality: {},
      lastUpdatedAt: Date.now(),
    }

    // Rolling complexity window — keep last 100
    const recent = [...ctx.recentComplexity, event.complexity].slice(-100)
    const avgComplexity = recent.reduce((a, b) => a + b, 0) / recent.length

    // Update model quality record
    const mq: ModelQualityRecord = ctx.modelQuality[event.model] ?? {
      positive: 0, neutral: 0, negative: 0, total: 0,
    }
    mq[event.qualitySignal]++
    mq.total++

    const updated: UserContext = {
      totalRequests: ctx.totalRequests + 1,
      avgComplexityScore: avgComplexity,
      recentComplexity: recent,
      totalSavingsMicro: ctx.totalSavingsMicro + event.savingsMicro,
      modelQuality: { ...ctx.modelQuality, [event.model]: mq },
      lastUpdatedAt: Date.now(),
    }

    await redis.setex(key, 86400, JSON.stringify(updated))
  } catch {
    // Never throw — context is enhancement data, not critical path
  }
}

/**
 * Reads the user context. Returns null on any error (fail open).
 */
export async function getUserContext(
  redis: Redis,
  userId: string
): Promise<UserContext | null> {
  try {
    return await redis.get<UserContext>(`user_context:${userId}`)
  } catch {
    return null
  }
}
