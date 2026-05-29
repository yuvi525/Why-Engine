import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { redis, ratelimit } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { validateApiKey } from '@/lib/auth'
import { decrypt } from '@/lib/crypto'
import { classify, ClassifierInput } from '@/lib/proxy/classify'
import { autopilot } from '@/lib/proxy/autopilot'
import { decide, applyMarginOverride, ReasonCode } from '@/lib/proxy/decide'
import { decideV2, runShadowDecision } from '@/lib/proxy/decideV2'
import { computeCost, estimateTokens, PRICING } from '@/lib/proxy/cost'
import { generateWHY } from '@/lib/proxy/why'
import { generateWHY_v2 } from '@/lib/proxy/why-v2'
import { computeQualitySignal, detectRetry } from '@/lib/proxy/feedback'
import { updateUserContext, getUserContext } from '@/lib/proxy/context'
import { PLAN_LIMITS, isOverRequestLimit, Plan, resolvePlan, getMonthlyRevenueMicro } from '@/lib/plans'
import { detectProvider } from '@/lib/providers/detect'
import { callClaudeAdapter } from '@/lib/providers/claude'
import { enforceGovernancePolicies, resolveEffectiveDailyLimit } from '@/lib/proxy/governance'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL_MAP_OPENAI = {
  'vela-mini': 'gpt-4o-mini',
  'vela-pro':  'gpt-4o',
} as const

const MODEL_MAP_CLAUDE = {
  'vela-mini': 'claude-3-5-haiku-20241022',
  'vela-pro':  'claude-3-5-sonnet-20241022',
} as const

type RealModel = keyof typeof PRICING

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  const reqStartMs = Date.now()

  // ── 1. AUTH ─────────────────────────────────────────────────────────
  const authResult = await validateApiKey(req.headers.get('Authorization'))
  if (!authResult.valid) {
    return NextResponse.json(
      { error: { message: 'Invalid or missing API key', type: 'auth_error', code: 401 } },
      { status: 401 }
    )
  }
  const { userId, keyId: apiKeyId } = authResult
  if (!userId) {
    return NextResponse.json(
      { error: { message: 'Invalid or missing API key', type: 'auth_error', code: 401 } },
      { status: 401 }
    )
  }

  // ── 2. RATE LIMIT ────────────────────────────────────────────────────
  const { success: ratePassed } = await ratelimit.limit(userId)
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

  // ── 3b. OPTIONAL REQUEST CONTEXT (backward compatible) ──────────────
  // Callers MAY pass these fields to enable per-customer / per-feature margin tracking.
  // If missing → null. Never used for routing — only stored in DecisionLog.
  const customerId: string | null = typeof body.customer_id === 'string' ? body.customer_id : null
  const featureId:  string | null = typeof body.feature_id  === 'string' ? body.feature_id  : null
  const userTier:   string | null = typeof body.user_tier   === 'string' ? body.user_tier   : null
  const revenueMicro: number | null = typeof body.revenue_micro === 'number' ? body.revenue_micro : (typeof body.revenueMicro === 'number' ? body.revenueMicro : null)

  // ── 4. LOAD USER STATE ───────────────────────────────────────────────
  let user, budgetState
  try {
    const dbResult = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { encryptedApiKey: true, plan: true, role: true, email: true, trialEndsAt: true },
      }),
      prisma.budgetState.upsert({
        where: { userId },
        update: {},
        create: { userId },
      }),
    ])
    user = dbResult[0]
    budgetState = dbResult[1]
  } catch (dbError) {
    console.error('[vela] Database connection failed:', dbError)
    return NextResponse.json(
      { error: { message: 'Service unavailable: Database connection failed.', type: 'service_unavailable', code: 503 } },
      { status: 503 }
    )
  }

  if (!user?.encryptedApiKey) {
    return NextResponse.json(
      { error: { message: 'OpenAI API key not configured. Add it in Vela Settings.', type: 'config_error', code: 422 } },
      { status: 422 }
    )
  }

  // ── 4b. DATE-DRIFT GUARD ───────────────────────────────────────────
  // If the reset cron fails, requestsToday stays stale and permanently blocks
  // free users. This guard detects a missed reset and fixes it inline.
  const midnightToday = new Date()
  midnightToday.setUTCHours(0, 0, 0, 0)
  if (budgetState.lastResetAt < midnightToday) {
    try {
      await prisma.budgetState.update({
        where: { userId },
        data: {
          requestsToday:      0,
          spentTodayMicro:    0,
          baselineTodayMicro: 0,
          cacheHitsToday:     0,
          lastResetAt:        new Date(),
        },
      })
      // Update in-memory reference so plan check below uses fresh count
      budgetState.requestsToday   = 0
      budgetState.spentTodayMicro = 0
      console.log(`[vela] Date-drift reset for userId: ${userId}`)
    } catch (err) {
      console.error('[vela] Date-drift reset failed:', err)
      // Fail open — don't block the user, just log
    }
  }

  // ── 4c. PLAN LIMIT ENFORCEMENT ────────────────────────────────────
  const userPlan = resolvePlan(user)
  const isOwner = userPlan === 'scale' // scale is returned for owner

  // ── 4d. TRIAL EXPIRY CLEANUP (fire-and-forget) ─────────────────────
  // If resolvePlan returned 'free' but DB still says 'pro_trial', the trial expired.
  // Clean up the DB asynchronously so subsequent checks don't re-evaluate.
  if (userPlan === 'free' && user.plan === 'pro_trial') {
    void prisma.user.update({
      where: { id: userId },
      data: { plan: 'free', trialEndsAt: null },
    }).catch(err => console.error('[vela] Trial expiry cleanup failed:', err))
  }

  if (!isOwner && isOverRequestLimit(userPlan, budgetState.requestsToday)) {
    const limit = PLAN_LIMITS[userPlan].requestsPerDay
    return NextResponse.json(
      {
        error: {
          message: `Daily request limit reached (${limit} requests/${userPlan} plan). Upgrade your plan to continue.`,
          type:    'plan_limit_exceeded',
          code:    429,
          plan:    userPlan,
          limit,
        },
        vela: { requestId, reasonCode: 'PLAN_LIMIT' },
      },
      { status: 429 }
    )
  }

  // ── 4e. GOVERNANCE ENFORCEMENT ────────────────────────────────────────────
  // Run BEFORE routing so we can report the intended model in the block message.
  // Governance is evaluated against the ROUTING decision, not the raw request model.
  // (Governance runs here after plan enforcement but before budget gate for fast rejection)
  if (!isOwner) {
    // Quick classify to get routing intent for governance check
    const govInputTokens = estimateTokens(messages.map((m: any) => m.content ?? '').join('\n'))
    const govComplexity = classify({ messages, totalInputTokens: govInputTokens })
    const govModel = govComplexity === 1 ? 'vela-pro' : 'vela-mini'

    const govResult = await enforceGovernancePolicies(userId, govModel)
    if (govResult.blocked) {
      return NextResponse.json(
        {
          error: {
            message: govResult.reason ?? 'Request blocked by governance policy',
            type: 'governance_error',
            code: 403,
            policyId:   govResult.policyId,
            policyName: govResult.policyName,
          },
          vela: { requestId, reasonCode: 'GOVERNANCE_BLOCK' },
        },
        { status: 403 }
      )
    }
  }

  let openAiKey: string
  try {
    openAiKey = decrypt(user.encryptedApiKey)
  } catch (err) {
    console.error('[vela] Decryption of API key failed:', err)
    return NextResponse.json(
      {
        error: {
          message: 'Decryption of configured provider API key failed. Please update/re-save your API key in Settings.',
          type: 'decryption_error',
          code: 422,
        },
        vela: { requestId, reasonCode: 'DECRYPTION_ERROR' }
      },
      { status: 422 }
    )
  }
  const provider = detectProvider(openAiKey)
  const providerModelMap = provider === 'claude' ? MODEL_MAP_CLAUDE : MODEL_MAP_OPENAI

  // ── 5. BUDGET GATE (synchronous) ─────────────────────────────────────
  let redisSpent = 0
  try {
    const todayDateStr = new Date().toISOString().split('T')[0]
    const raw = await redis.hget<number>(`budget:${userId}:${todayDateStr}`, 'spentMicro')
    redisSpent = raw ?? budgetState.spentTodayMicro
  } catch {
    console.error('[vela] Redis read failed — failing open for budget check')
    redisSpent = budgetState.spentTodayMicro
  }

  // ── 5a. PLAN BUDGET CAP (hard ceiling per plan) ──────────────────────
  // Free plan: max $5/day | Pro: $50/day | Scale: $500/day
  // This enforces the plan limit regardless of the user's own dailyLimit setting.
  if (!isOwner) {
    const planCap = PLAN_LIMITS[userPlan]?.dailyBudgetCapUsd ?? 5
    const planCapMicro = planCap * 1_000_000
    if (redisSpent >= planCapMicro) {
      return NextResponse.json(
        {
          error: {
            message: `Daily budget cap reached for your ${PLAN_LIMITS[userPlan]?.name ?? userPlan} plan ($${planCap}/day). Upgrade to continue.`,
            type: 'plan_budget_exceeded',
            code: 429,
            plan: userPlan,
            budgetCapUsd: planCap,
          },
          vela: { requestId, reasonCode: 'PLAN_BUDGET_CAP' },
        },
        { status: 429 }
      )
    }
  }

  // ── 5b. CUSTOMER BUDGET RULES ─────────────────────────────────────────────
  // Override dailyLimitMicro with the smallest customer-defined hard limit if present.
  const effectiveBudget = isOwner
    ? { dailyLimitMicro: budgetState.dailyLimitMicro, softLimitPct: 80 }
    : await resolveEffectiveDailyLimit(userId, budgetState.dailyLimitMicro)

  const effectiveDailyLimitMicro = effectiveBudget.dailyLimitMicro
  const effectiveAutoDowngradeAt = (effectiveBudget.softLimitPct / 100) || budgetState.autoDowngradeAt

  const apAction = autopilot(
    { spentTodayMicro: redisSpent, dailyLimitMicro: effectiveDailyLimitMicro, requestsToday: budgetState.requestsToday },
    { autoDowngradeAt: effectiveAutoDowngradeAt }
  )

  if (!isOwner && apAction.action === 'REJECT') {
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

  // ── 6. IDEMPOTENCY WINDOW (5s) ───────────────────────────────────────
  // Phase 0 fix: deduplicates identical requests within 5 seconds.
  const bodyHash = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16)
  const idemKey = `idem:${userId}:${bodyHash}`
  try {
    const idemResult = await redis.set(idemKey, requestId, { nx: true, ex: 5 })
    if (idemResult === null) {
      // Key already existed — this is a duplicate request within 5s
      return NextResponse.json(
        { error: { message: 'Duplicate request — identical request received within 5 seconds', type: 'idempotency_error', code: 429 } },
        { status: 429 }
      )
    }
  } catch {
    // Fail open: idempotency is a nicety, not a hard gate
  }

  // ── 7. EXACT MATCH CACHE ─────────────────────────────────────────────
  const promptHash = createHash('sha256')
    .update(JSON.stringify(messages))
    .digest('hex')
  const cacheKey = `cache:${userId}:${promptHash}`

  try {
    const cachedRaw = await redis.get<any>(cacheKey)
    console.log('[vela] Cache lookup:', { cacheKey, found: !!cachedRaw })
    if (cachedRaw) {
      const cachedBody = typeof cachedRaw === 'string' ? JSON.parse(cachedRaw) : cachedRaw
      const inputTokens = cachedBody.usage?.prompt_tokens ?? estimateTokens(messages.map((m: any) => m.content).join(' '))
      const rawCost = computeCost('gpt-4o', inputTokens, cachedBody.usage?.completion_tokens ?? 0)
      const costResult = {
        actualCostMicro: 0,
        baselineCostMicro: rawCost.baselineCostMicro,
        savingsMicro: rawCost.baselineCostMicro,
        savingsPct: 100
      }
      const why = generateWHY('CACHE_HIT', { model: 'cached', ...costResult })

      // Phase 5: Margin for cache hits
      const cacheRevenueMicro = revenueMicro
      const cacheMarginMicro = cacheRevenueMicro !== null ? cacheRevenueMicro : null
      const cacheMarginStatus = cacheRevenueMicro !== null ? (cacheMarginMicro! > 0 ? 'profit' : 'break_even') : null

      void writeLog({
        userId, requestId, model: 'gpt-4o-mini', reasonCode: 'CACHE_HIT',
        inputTokens, outputTokens: cachedBody.usage?.completion_tokens ?? 0,
        costResult, isCacheHit: true, promptPreview: getPromptPreview(messages),
        finishReason: 'cache', latencyMs: Date.now() - reqStartMs,
        cacheKeyPrefix: promptHash.slice(0, 20),
        customerId, featureId, userTier,
        revenueMicro: cacheRevenueMicro,
        marginMicro: cacheMarginMicro,
        marginStatus: cacheMarginStatus,
        apiKeyId,
      })

      return NextResponse.json({
        ...cachedBody,
        id: `chatcmpl-${requestId}`,
        vela: {
          requestId, reasonCode: 'CACHE_HIT', model: 'gpt-4o-mini (cached)',
          actualCostMicro: 0, baselineCostMicro: costResult.baselineCostMicro,
          savingsMicro: costResult.baselineCostMicro, savingsPct: 100,
          cost: 0, baselineCost: costResult.baselineCostMicro / 1e6, savings: costResult.baselineCostMicro / 1e6,
          why,
        },
      })
    }
  } catch (err) { console.error('[vela] Cache error:', err) }

  // ── 8. CLASSIFY + DECIDE ─────────────────────────────────────────────
  const inputText = messages.map((m: any) => m.content ?? '').join('\n')
  const inputTokens = estimateTokens(inputText)
  const classifierInput: ClassifierInput = { messages, totalInputTokens: inputTokens }
  // Use effective budget limit for % calculation
  const effectiveDailyLimitForPct = effectiveDailyLimitMicro
  const complexity = classify(classifierInput)
  const budgetPct  = Math.round((redisSpent / effectiveDailyLimitForPct) * 100)

  // ── Read feature flags + provider health in parallel (non-blocking) ──
  // All fail open — a Redis error here never stops a request.
  const [flags, providerHealth] = await Promise.all([
    redis.hgetall<Record<string, string>>(`flags:${userId}`).catch(() => null),
    redis.get<{ degraded: boolean }>('health:openai').catch(() => null),
  ])

  const useV2Routing = flags?.use_v2_routing === '1'
  const useV2Why     = flags?.use_v2_why     === '1'

  if (providerHealth?.degraded) {
    // Log degradation — proxy still attempts the request (fail open by design)
    console.warn('[vela] Provider health: openai degraded — attempting request anyway')
  }

  // ── V1 routing (always runs as ground truth) ──────────────────────
  const routing = decide(complexity, isOwner ? { action: 'PASS', reason: null } : apAction)

  // ── V2 routing: active mode if flag set, shadow mode otherwise ────
  let realModel = providerModelMap[routing.model] as RealModel

  if (useV2Routing) {
    // V2 is active for this user — use V2 decision directly
    const v2Decision = await decideV2(
      { messages, totalInputTokens: inputTokens },
      apAction,
      false // shadowOnly = false: V2 is active
    ).catch(() => null)

    if (v2Decision) {
      realModel = providerModelMap[v2Decision.model] as RealModel
      // Still log shadow record so we can track V1 vs V2 divergence
      void runShadowDecision(prisma, requestId, userId, routing, v2Decision)
    }
  } else {
    // Shadow mode: V2 decision is computed but V1 routing executes
    void (async () => {
      try {
        const v2Decision = await decideV2(
          { messages, totalInputTokens: inputTokens },
          apAction,
          true // shadowOnly = true
        )
        await runShadowDecision(prisma, requestId, userId, routing, v2Decision)
      } catch {
        // Shadow errors are always swallowed
      }
    })()
  }

  // ── Phase 6: Margin-aware routing override ───────────────────────────
  // Applied AFTER decide()/V2 but BEFORE provider call.
  // Enforces free-plan-always-mini and budget guard visibility.
  if (!isOwner) {
    const preModel = routing.model
    const finalRouting = applyMarginOverride(routing, userPlan, budgetPct, budgetState.autoDowngradeAt)
    if (finalRouting.model !== preModel) {
      // Margin override changed the model — update realModel
      realModel = providerModelMap[finalRouting.model] as RealModel
      // Mutate routing so downstream (writeLog, response) uses the overridden reasonCode
      ;(routing as any).model = finalRouting.model
      ;(routing as any).reasonCode = finalRouting.reasonCode
    }
    console.log(`[vela/routing] ${preModel} → ${routing.model} (${routing.reasonCode})`)
  }

  // ── 9. EXECUTE via OpenAI or Claude ─────────────────────────────────────────────
  // Uses realModel (from routing decision)
  let openAiRes: Response
  try {
    if (provider === 'claude') {
      openAiRes = await callClaudeAdapter(openAiKey, realModel, messages, stream, rest)
    } else {
      openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: realModel,
          messages,
          stream,
          ...rest,
        }),
      })
    }
  } catch (err) {
    console.error('[vela] Provider fetch error:', err)
    return NextResponse.json(
      { error: { message: 'Provider API unavailable', type: 'proxy_error', code: 502 } },
      { status: 502 }
    )
  }

  if (!openAiRes.ok) {
    const errBody = await openAiRes.text()
    console.error('[vela] Provider error:', openAiRes.status, errBody)
    return NextResponse.json(
      { error: { message: 'Model request failed', type: 'upstream_error', code: openAiRes.status, detail: errBody } },
      { status: openAiRes.status }
    )
  }

  // ── 10. STREAMING PATH ────────────────────────────────────────────────
  if (stream) {
    const encoder = new TextEncoder()
    let outputTokens = 0
    let streamFinishReason: string | undefined
    let usageChunkFound = false

    const transformed = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk)

        // Bug 3 fix: try to parse the usage chunk from the final SSE delta.
        // OpenAI sends `data: {"usage": {...}}` as a final chunk when stream_options.include_usage=true.
        // Fall back to regex estimation if not found.
        const lines = text.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
          try {
            const parsed = JSON.parse(line.slice(6))
            // Capture finish_reason from any choice delta
            const fr = parsed.choices?.[0]?.finish_reason
            if (fr) streamFinishReason = fr
            // Capture actual token counts from usage field (present when include_usage=true)
            if (parsed.usage?.completion_tokens) {
              outputTokens = parsed.usage.completion_tokens
              usageChunkFound = true
            }
          } catch { /* malformed chunk — skip */ }
        }

        // If no usage chunk, fall back to regex token estimation
        if (!usageChunkFound) {
          const deltaMatches = text.matchAll(/"content":"([^"\\]*(\\.[^"\\]*)*)"/g)
          for (const match of deltaMatches) {
            outputTokens += estimateTokens(match[1])
          }
        }

        controller.enqueue(chunk)
      },
      flush(controller) {
        const costResult = computeCost(realModel, inputTokens, outputTokens)

        // WHY V2 if flag set and context is available, else V1 fallback
        let why
        if (useV2Why) {
          const userCtx = getUserContext(redis, userId).catch(() => null)
          // In flush we can't await, so we use V1 for streaming (context available next request)
          why = generateWHY(routing.reasonCode, {
            model: realModel, ...costResult, budgetPct,
            spentTodayMicro: redisSpent, dailyLimitMicro: budgetState.dailyLimitMicro,
          })
        } else {
          why = generateWHY(routing.reasonCode, {
            model: realModel, ...costResult, budgetPct,
            spentTodayMicro: redisSpent, dailyLimitMicro: budgetState.dailyLimitMicro,
          })
        }

        const metaChunk = `\n: vela ${JSON.stringify({
          requestId,
          reasonCode: routing.reasonCode,
          model: realModel,
          actualProvider: provider,
          cost: costResult.actualCostMicro / 1e6,
          baselineCost: costResult.baselineCostMicro / 1e6,
          savings: costResult.savingsMicro / 1e6,
          ...costResult, why,
        })}\n\n`
        controller.enqueue(encoder.encode(metaChunk))

        // Phase 5: Margin for streaming
        const streamRevenueMicro = revenueMicro
        const streamMarginMicro = streamRevenueMicro !== null ? (streamRevenueMicro - costResult.actualCostMicro) : null
        const streamMarginStatus = streamRevenueMicro !== null ? (streamMarginMicro! > 0 ? 'profit' : streamMarginMicro! < 0 ? 'loss' : 'break_even') : null

        void writeLog({
          userId, requestId, model: realModel, reasonCode: routing.reasonCode,
          inputTokens, outputTokens, costResult, isCacheHit: false,
          promptPreview: getPromptPreview(messages),
          finishReason: streamFinishReason,
          latencyMs: Date.now() - reqStartMs,
          cacheKeyPrefix: promptHash.slice(0, 20),
          customerId, featureId, userTier,
          revenueMicro: streamRevenueMicro,
          marginMicro: streamMarginMicro,
          marginStatus: streamMarginStatus,
          apiKeyId,
        })
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

  // ── 11. NON-STREAMING PATH ────────────────────────────────────────────
  let responseBody: any
  try {
    responseBody = await openAiRes.json()
  } catch (err) {
    console.error('[vela] Failed to parse provider response JSON:', err)
    return NextResponse.json(
      { error: { message: 'Invalid response from provider', type: 'proxy_error', code: 502 } },
      { status: 502 }
    )
  }

  const outputTokens = responseBody.usage?.completion_tokens ?? estimateTokens(
    responseBody.choices?.[0]?.message?.content ?? ''
  )
  const actualInputTokens = responseBody.usage?.prompt_tokens ?? inputTokens
  const finishReason: string | undefined = responseBody.choices?.[0]?.finish_reason
  const latencyMs = Date.now() - reqStartMs
  const costResult = computeCost(realModel, actualInputTokens, outputTokens)

  // WHY V2 if flag set, with graceful fallback to V1
  const whyCtx = {
    model: realModel, ...costResult, budgetPct,
    spentTodayMicro: redisSpent, dailyLimitMicro: budgetState.dailyLimitMicro,
  }
  let why
  if (useV2Why) {
    const userCtx = await getUserContext(redis, userId).catch(() => null)
    why = userCtx
      ? generateWHY_v2(routing.reasonCode, whyCtx, userCtx)
      : generateWHY(routing.reasonCode, whyCtx)
  } else {
    why = generateWHY(routing.reasonCode, whyCtx)
  }

  // Cache the response (TTL: 1 hour)
  void redis.setex(cacheKey, 3600, JSON.stringify(responseBody))

  // Phase 5: Margin calculation
  const requestRevenueMicro = revenueMicro
  const marginMicro = requestRevenueMicro !== null ? (requestRevenueMicro - costResult.actualCostMicro) : null
  const marginStatus = requestRevenueMicro !== null ? (marginMicro! > 0 ? 'profit' : marginMicro! < 0 ? 'loss' : 'break_even') : null

  void writeLog({
    userId, requestId, model: realModel, reasonCode: routing.reasonCode,
    inputTokens: actualInputTokens, outputTokens, costResult, isCacheHit: false,
    promptPreview: getPromptPreview(messages),
    finishReason,
    latencyMs,
    cacheKeyPrefix: promptHash.slice(0, 20),
    customerId, featureId, userTier,
    revenueMicro: requestRevenueMicro,
    marginMicro,
    marginStatus,
    apiKeyId,
  })

  return NextResponse.json(
    {
      ...responseBody,
      vela: {
        requestId,
        reasonCode: routing.reasonCode,
        model: realModel,
        actualProvider: provider,
        actualCostMicro:   costResult.actualCostMicro,
        baselineCostMicro: costResult.baselineCostMicro,
        savingsMicro:      costResult.savingsMicro,
        savingsPct:        costResult.savingsPct,
        cost:              costResult.actualCostMicro / 1e6,
        baselineCost:      costResult.baselineCostMicro / 1e6,
        savings:           costResult.savingsMicro / 1e6,
        // Phase 5/8: Margin fields
        revenueMicro:      requestRevenueMicro,
        marginMicro,
        marginStatus,
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

interface WriteLogParams {
  userId: string
  requestId: string
  model: string
  reasonCode: ReasonCode
  inputTokens: number
  outputTokens: number
  costResult: ReturnType<typeof computeCost>
  isCacheHit: boolean
  promptPreview: string
  // Phase 1 additions (optional — backward compatible with all existing callers)
  finishReason?: string
  latencyMs?: number
  cacheKeyPrefix?: string
  // Phase 3/5 additions: margin + request context
  customerId?: string | null
  featureId?: string | null
  userTier?: string | null
  revenueMicro?: number | null
  marginMicro?: number | null
  marginStatus?: string | null
  // Phase 4: API key attribution
  apiKeyId?: string | null
}

async function writeLog(params: WriteLogParams) {
  const {
    userId, requestId, model, reasonCode, inputTokens, outputTokens,
    costResult, isCacheHit, promptPreview,
    finishReason, latencyMs, cacheKeyPrefix,
    customerId, featureId, userTier, revenueMicro, marginMicro, marginStatus,
    apiKeyId,
  } = params

  // ── Redis budget update (atomic pipeline) ──────────────────────────
  try {
    const todayDateStr = new Date().toISOString().split('T')[0]
    const budgetKey = `budget:${userId}:${todayDateStr}`
    const pipeline = redis.pipeline()
    pipeline.hincrby(budgetKey, 'spentMicro',    costResult.actualCostMicro)
    pipeline.hincrby(budgetKey, 'baselineMicro', costResult.baselineCostMicro)
    pipeline.hincrby(budgetKey, 'requestCount',  1)
    if (isCacheHit) pipeline.hincrby(budgetKey, 'cacheHits', 1)
    pipeline.expire(budgetKey, 86400)
    await pipeline.exec()
  } catch (err) {
    console.error('[vela] Redis write failed:', err)
  }

  // ── Phase 1: Retry detection ───────────────────────────────────────
  let isRetry = false
  if (cacheKeyPrefix && !isCacheHit) {
    isRetry = await detectRetry(redis, userId, cacheKeyPrefix)
  }

  // ── Phase 1: Quality signal ────────────────────────────────────────
  const qualitySignal = computeQualitySignal(finishReason, inputTokens, outputTokens)

  // ── Phase 1: User context update (async, fire-and-forget) ──────────
  void updateUserContext(redis, userId, {
    complexity: reasonCode === 'COMPLEXITY_HIGH' ? 1 : 0,
    model,
    savingsMicro: costResult.savingsMicro,
    qualitySignal: qualitySignal.signal,
  })

  // ── Postgres writes ────────────────────────────────────────────────
  try {
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
          // Phase 1 fields (nullable):
          finishReason:  finishReason ?? null,
          latencyMs:     latencyMs    ?? null,
          qualitySignal: qualitySignal.signal,
          isRetry,
          // Phase 3/5 fields: margin + request context (nullable):
          customerId:    customerId   ?? null,
          featureId:     featureId    ?? null,
          userTier:      userTier     ?? null,
          revenueMicro:  revenueMicro ?? null,
          marginMicro:   marginMicro  ?? null,
          marginStatus:  marginStatus ?? null,
          // Phase 4: API key attribution
          apiKeyId:      apiKeyId     ?? null,
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
