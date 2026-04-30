import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

/**
 * Provider health monitor.
 * Runs every 5 minutes via Vercel cron.
 * Writes health:{provider} to Redis (TTL 600s).
 *
 * Fail-open by design: if this cron fails, the proxy is unaffected.
 * The proxy reads the health key before each request and logs a warning
 * when degraded, but never blocks traffic based on it.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const providers = [
    {
      name:    'openai',
      url:     'https://api.openai.com/v1/models',
      checkMs: 5000,
      // Use a dedicated low-cost health key, or fall back to any configured key
      apiKey:  process.env.OPENAI_HEALTH_KEY ?? process.env.OPENAI_API_KEY ?? '',
    },
  ]

  const results: Record<string, object> = {}

  for (const provider of providers) {
    const start     = Date.now()
    let degraded    = false
    let errorRate   = 0.0

    try {
      const res = await fetch(provider.url, {
        method:  'GET',
        headers: { Authorization: `Bearer ${provider.apiKey}` },
        signal:  AbortSignal.timeout(provider.checkMs),
      })
      degraded  = !res.ok
      errorRate = degraded ? 1.0 : 0.0
    } catch {
      degraded  = true
      errorRate = 1.0
    }

    const latencyMs = Date.now() - start

    const healthPayload = {
      degraded,
      errorRate,
      latencyMs,
      lastCheckedAt: Date.now(),
    }

    // TTL 600s — slightly above the 5-minute cron interval so the key
    // never goes missing between runs.
    await redis.setex(`health:${provider.name}`, 600, JSON.stringify(healthPayload))
    results[provider.name] = healthPayload

    if (degraded) {
      console.warn(`[vela/health] ${provider.name} is degraded (latency: ${latencyMs}ms)`)
    }
  }

  return NextResponse.json({ success: true, results })
}
