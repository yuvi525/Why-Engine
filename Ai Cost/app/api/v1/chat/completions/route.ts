import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { redis, ratelimit } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { validateApiKey } from '@/lib/auth'
import { decrypt } from '@/lib/crypto'
import { classify, ClassifierInput } from '@/lib/proxy/classify'
import { autopilot } from '@/lib/proxy/autopilot'
import { decide, ReasonCode } from '@/lib/proxy/decide'
import { computeCost, estimateTokens, PRICING } from '@/lib/proxy/cost'
import { generateWHY } from '@/lib/proxy/why'

export const runtime = 'nodejs'
export const maxDuration = 60

const LITELLM_BASE = process.env.LITELLM_BASE_URL!
const MODEL_MAP = {
  'vela-mini': 'gpt-4o-mini',
  'vela-pro':  'gpt-4o',
} as const

type RealModel = keyof typeof PRICING

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()

  // ── 1. AUTH ─────────────────────────────────────────────────────────
  const authResult = await validateApiKey(req.headers.get('Authorization'))
  if (!authResult.valid) {
    return NextResponse.json(
      { error: { message: 'Invalid or missing API key', type: 'auth_error', code: 401 } },
      { status: 401 }
    )
  }
  const { userId } = authResult
  if (!userId) {
    return NextResponse.json(
      { error: { message: 'Invalid or missing API key', type: 'auth_error', code: 401 } },
      { status: 401 }
    )
  }

  // ── 2. RATE LIMIT ────────────────────────────────────────────────────
  const { success: ratePassed } = await ratelimit.limit(userId!)
  if (!ratePassed) {
    return NextResponse.json(
      { error: { message: 'Rate limit exceeded', type: 'rate_limit_error', code: 429 } },
      { status: 429 }
    )
  }

  // ── 3. PARSE BODY ────────────────────────────────────────────────────
  let body: any
  try { body = await req.json() }
  catch {
    return NextResponse.json(
      { error: { message: 'Invalid JSON body', type: 'invalid_request_error', code: 400 } },
      { status: 400 }
    )
  }

  const { messages = [], stream = false, ...rest } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: { message: 'messages array is required', type: 'invalid_request_error', code: 400 } },
      { status: 400 }
    )
  }

  // ── 4. LOAD USER STATE ───────────────────────────────────────────────
  const [user, budgetState] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { encryptedApiKey: true },
    }),
    prisma.budgetState.upsert({
      where: { userId },
      update: {},
      create: { userId },
    }),
  ])

  if (!user?.encryptedApiKey) {
    return NextResponse.json(
      { error: { message: 'OpenAI API key not configured. Add it in Vela Settings.', type: 'config_error', code: 422 } },
      { status: 422 }
    )
  }

  const openAiKey = decrypt(user.encryptedApiKey)

  // ── 5. BUDGET GATE (synchronous) ─────────────────────────────────────
  let redisSpent = 0
  try {
    const raw = await redis.hget<number>(`budget:${userId}:today`, 'spentMicro')
    redisSpent = raw ?? budgetState.spentTodayMicro
  } catch {
    // Redis failure → fail open, log and continue
    console.error('[vela] Redis read failed — failing open for budget check')
    redisSpent = budgetState.spentTodayMicro
  }

  const apAction = autopilot(
    { spentTodayMicro: redisSpent, dailyLimitMicro: budgetState.dailyLimitMicro },
    { autoDowngradeAt: budgetState.autoDowngradeAt }
  )

  if (apAction.action === 'REJECT') {
    const budgetPct = 100
    const costResult = computeCost('gpt-4o-mini', 0, 0)
    const why = generateWHY('BUDGET_EXHAUSTED', { 
      model: 'none', 
      ...costResult, 
      budgetPct,
      spentTodayMicro: redisSpent,
      dailyLimitMicro: budgetState.dailyLimitMicro
    })
    return NextResponse.json(
      {
        error: { message: why.action, type: 'budget_exhausted', code: 429 },
        vela: { requestId, reasonCode: 'BUDGET_EXHAUSTED', why },
      },
      { status: 429 }
    )
  }

  // ── 6. EXACT MATCH CACHE ─────────────────────────────────────────────
  const cacheKey = `cache:${createHash('sha256')
    .update(JSON.stringify(messages))
    .digest('hex')}`

  try {
    const cached = await redis.get<string>(cacheKey)
    if (cached) {
      const cachedBody = JSON.parse(cached)
      const inputTokens = estimateTokens(messages.map((m: any) => m.content).join(' '))
      const costResult = computeCost('gpt-4o', inputTokens, cachedBody.usage?.completion_tokens ?? 0)
      const why = generateWHY('CACHE_HIT', { model: 'cached', ...costResult })

      void writeLog({ userId: userId!, requestId, model: 'gpt-4o-mini', reasonCode: 'CACHE_HIT',
        inputTokens, outputTokens: cachedBody.usage?.completion_tokens ?? 0, costResult,
        isCacheHit: true, promptPreview: getPromptPreview(messages) })

      return NextResponse.json({
        ...cachedBody,
        id: `chatcmpl-${requestId}`,
        vela: { requestId, reasonCode: 'CACHE_HIT', model: 'gpt-4o-mini (cached)',
          actualCostMicro: 0, baselineCostMicro: costResult.baselineCostMicro,
          savingsMicro: costResult.baselineCostMicro, savingsPct: 100, why },
      })
    }
  } catch { /* cache miss is fine */ }

  // ── 7. CLASSIFY + DECIDE ─────────────────────────────────────────────
  const inputText = messages.map((m: any) => m.content ?? '').join('\n')
  const inputTokens = estimateTokens(inputText)
  const classifierInput: ClassifierInput = { messages, totalInputTokens: inputTokens }
  const complexity = classify(classifierInput)
  const routing = decide(complexity, apAction)
  const realModel = MODEL_MAP[routing.model] as RealModel
  const budgetPct = Math.round((redisSpent / budgetState.dailyLimitMicro) * 100)

  // ── 8. EXECUTE via OpenAI directly (MVP MODE) ────────────────────────
  let openAiRes: Response
  try {
    openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Force actual execution to gpt-4o-mini
        messages,
        stream,
        ...rest,
      }),
    })
  } catch (err) {
    console.error('[vela] OpenAI fetch error:', err)
    return NextResponse.json(
      { error: { message: 'OpenAI API unavailable', type: 'proxy_error', code: 502 } },
      { status: 502 }
    )
  }

  if (!openAiRes.ok) {
    const errBody = await openAiRes.text()
    console.error('[vela] OpenAI error:', openAiRes.status, errBody)
    return NextResponse.json(
      { error: { message: 'Model request failed', type: 'upstream_error', code: openAiRes.status, detail: errBody } },
      { status: openAiRes.status }
    )
  }

  // ── 9. STREAMING PATH ────────────────────────────────────────────────
  if (stream) {
    const encoder = new TextEncoder()
    let outputTokens = 0

    const transformed = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk)
        // Count approximate output tokens from SSE deltas
        const deltaMatches = text.matchAll(/"content":"([^"]+)"/g)
        for (const match of deltaMatches) {
          outputTokens += estimateTokens(match[1])
        }
        controller.enqueue(chunk)
      },
      flush(controller) {
        const costResult = computeCost('gpt-4o-mini', inputTokens, outputTokens)
        const why = generateWHY(routing.reasonCode, { 
          model: realModel, 
          ...costResult, 
          budgetPct,
          spentTodayMicro: redisSpent,
          dailyLimitMicro: budgetState.dailyLimitMicro
        })

        // Inject vela metadata as a final SSE comment
        const metaChunk = `\n: vela ${JSON.stringify({
          requestId, 
          reasonCode: routing.reasonCode, 
          model: realModel,
          actualProvider: 'openai',
          actualModel: 'gpt-4o-mini',
          ...costResult, why,
        })}\n\n`
        controller.enqueue(encoder.encode(metaChunk))

        void writeLog({ userId: userId!, requestId, model: realModel, reasonCode: routing.reasonCode,
          inputTokens, outputTokens, costResult, isCacheHit: false,
          promptPreview: getPromptPreview(messages) })
      },
    })

    openAiRes.body!.pipeTo(transformed.writable)
    return new Response(transformed.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Vela-Request-Id': requestId,
        'X-Vela-Model': realModel,
        'X-Vela-Reason': routing.reasonCode,
      },
    })
  }

  // ── 10. NON-STREAMING PATH ───────────────────────────────────────────
  const responseBody = await openAiRes.json()
  const outputTokens = responseBody.usage?.completion_tokens ?? estimateTokens(
    responseBody.choices?.[0]?.message?.content ?? ''
  )
  const costResult = computeCost('gpt-4o-mini', inputTokens, outputTokens)
  const why = generateWHY(routing.reasonCode, { 
    model: realModel, 
    ...costResult, 
    budgetPct,
    spentTodayMicro: redisSpent,
    dailyLimitMicro: budgetState.dailyLimitMicro
  })

  // Cache the response (TTL: 1 hour)
  void redis.setex(cacheKey, 3600, JSON.stringify(responseBody))

  void writeLog({ userId: userId!, requestId, model: realModel, reasonCode: routing.reasonCode,
    inputTokens, outputTokens, costResult, isCacheHit: false,
    promptPreview: getPromptPreview(messages) })

  return NextResponse.json(
    {
      ...responseBody,
      vela: {
        requestId,
        reasonCode: routing.reasonCode,
        model: realModel,
        actualProvider: 'openai',
        actualModel: 'gpt-4o-mini',
        actualCostMicro:   costResult.actualCostMicro,
        baselineCostMicro: costResult.baselineCostMicro,
        savingsMicro:      costResult.savingsMicro,
        savingsPct:        costResult.savingsPct,
        why,
      },
    },
    {
      headers: {
        'X-Vela-Request-Id':  requestId,
        'X-Vela-Model':       realModel,
        'X-Vela-Reason':      routing.reasonCode,
        'X-Vela-Savings-Usd': String(costResult.savingsMicro / 1_000_000),
        'X-Vela-Savings-Pct': String(costResult.savingsPct),
      },
    }
  )
}

// ── HELPERS ────────────────────────────────────────────────────────────

function getPromptPreview(messages: any[]): string {
  const last = messages.filter((m: any) => m.role === 'user').at(-1)
  return (last?.content ?? '').slice(0, 100)
}

async function writeLog(params: {
  userId: string
  requestId: string
  model: string
  reasonCode: ReasonCode
  inputTokens: number
  outputTokens: number
  costResult: ReturnType<typeof computeCost>
  isCacheHit: boolean
  promptPreview: string
}) {
  const { userId, requestId, model, reasonCode, inputTokens, outputTokens,
    costResult, isCacheHit, promptPreview } = params

  try {
    // Atomic Redis budget update
    const pipeline = redis.pipeline()
    pipeline.hincrby(`budget:${userId}:today`, 'spentMicro',    costResult.actualCostMicro)
    pipeline.hincrby(`budget:${userId}:today`, 'baselineMicro', costResult.baselineCostMicro)
    pipeline.hincrby(`budget:${userId}:today`, 'requestCount',  1)
    if (isCacheHit) pipeline.hincrby(`budget:${userId}:today`, 'cacheHits', 1)
    pipeline.expire(`budget:${userId}:today`, 86400)
    await pipeline.exec()
  } catch (err) {
    console.error('[vela] Redis write failed:', err)
  }

  try {
    // Postgres write — fire and forget
    await Promise.all([
      prisma.decisionLog.create({
        data: {
          userId, requestId, model, reasonCode,
          inputTokens, outputTokens,
          actualCostMicro:   costResult.actualCostMicro,
          baselineCostMicro: costResult.baselineCostMicro,
          savingsMicro:      costResult.savingsMicro,
          savingsPct:        costResult.savingsPct,
          isCacheHit, promptPreview,
        },
      }),
      prisma.budgetState.update({
        where: { userId },
        data: {
          spentTodayMicro:    { increment: costResult.actualCostMicro },
          baselineTodayMicro: { increment: costResult.baselineCostMicro },
          totalSpentMicro:    { increment: costResult.actualCostMicro },
          totalBaselineMicro: { increment: costResult.baselineCostMicro },
          requestsToday:      { increment: 1 },
          ...(isCacheHit ? { cacheHitsToday: { increment: 1 } } : {}),
        },
      }),
    ])
  } catch (err) {
    console.error('[vela] Postgres write failed:', err)
  }
}
