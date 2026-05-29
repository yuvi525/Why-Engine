import { NextRequest, NextResponse } from 'next/server'
import { resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { redis } from '@/lib/redis'
import { PLAN_LIMITS, Plan, resolvePlan } from '@/lib/plans'

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? ''

export async function GET(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [budget, userRow] = await Promise.all([
    prisma.budgetState.findUnique({
      where: { userId },
      select: { dailyLimitMicro: true, autoDowngradeAt: true, requestsToday: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { encryptedApiKey: true, plan: true, role: true, email: true, trialEndsAt: true },
    }),
  ])

  const hasApiKey = !!userRow?.encryptedApiKey
  const userPlan  = resolvePlan(userRow as any)

  // Masked key for display
  let keyMask: string | null = null
  let provider: string | null = null
  if (userRow?.encryptedApiKey) {
    try {
      const { decrypt } = await import('@/lib/crypto')
      const raw = decrypt(userRow.encryptedApiKey)
      keyMask  = raw.slice(0, 8) + '…' + raw.slice(-4)
      provider = raw.startsWith('sk-ant-') ? 'claude' : 'openai'
    } catch { keyMask = 'sk-****' }
  }

  // Feature flags
  let v2RoutingEnabled = false
  let v2WhyEnabled     = false
  try {
    const flags      = await redis.hgetall<Record<string, string>>(`flags:${userId}`)
    v2RoutingEnabled = flags?.use_v2_routing === '1'
    v2WhyEnabled     = flags?.use_v2_why     === '1'
  } catch { /* non-critical */ }

  // Owner check — use role field + env var (no hardcoded email)
  const role = (userRow?.role === 'owner' || (OWNER_EMAIL && userRow?.email === OWNER_EMAIL))
    ? 'owner'
    : 'customer'

  const planConfig = { ...PLAN_LIMITS[userPlan] }
  if (role === 'owner') {
    planConfig.v2RoutingAllowed = true
    planConfig.shadowAnalytics  = true
    planConfig.requestsPerDay   = -1
  }

  const isStripeConfigured = !!(process.env.STRIPE_SECRET_KEY && (process.env.STRIPE_PRICE_PRO_ID || process.env.STRIPE_PRICE_GROWTH_ID))
  const isRazorpayConfigured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  const billingConfigured = isStripeConfigured || isRazorpayConfigured

  return NextResponse.json({
    hasApiKey,
    keyMask,
    provider,
    email:           userRow?.email,
    plan:            userPlan,
    trialEndsAt:     userRow?.trialEndsAt,
    role,
    planConfig,
    requestsToday:   budget?.requestsToday    ?? 0,
    dailyLimitUsd:   (budget?.dailyLimitMicro ?? 5_000_000) / 1_000_000,
    autoDowngradeAt: budget?.autoDowngradeAt  ?? 0.8,
    v2RoutingEnabled,
    v2WhyEnabled,
    billingConfigured,
  })
}

export async function POST(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  // Ensure user row
  const userEmail = (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email ?? ''
  await prisma.user.upsert({
    where:  { id: userId },
    update: { email: userEmail },
    create: { id: userId, email: userEmail },
  })

  // Save OpenAI/Claude key
  if (body.openAiKey) {
    const key = body.openAiKey.trim()
    if ((!key.startsWith('sk-') && !key.startsWith('sk-ant-')) || key.length < 20) {
      return NextResponse.json({ error: 'Invalid API key — must start with sk- or sk-ant- and be at least 20 characters.' }, { status: 400 })
    }
    await prisma.user.update({ where: { id: userId }, data: { encryptedApiKey: encrypt(key) } })
  }

  // Remove key
  if (body.removeOpenAiKey === true) {
    await prisma.user.update({ where: { id: userId }, data: { encryptedApiKey: null } })
  }

  // Budget settings
  if (body.dailyLimitUsd !== undefined || body.autoDowngradeAt !== undefined) {
    const dailyLimitMicro = body.dailyLimitUsd
      ? Math.min(Math.round(body.dailyLimitUsd * 1_000_000), 50_000_000)
      : undefined
    const autoDowngradeAt = body.autoDowngradeAt
      ? Math.min(Math.max(body.autoDowngradeAt, 0.5), 0.99)
      : undefined

    await prisma.budgetState.upsert({
      where:  { userId },
      update: {
        ...(dailyLimitMicro !== undefined ? { dailyLimitMicro }  : {}),
        ...(autoDowngradeAt !== undefined ? { autoDowngradeAt }  : {}),
      },
      create: {
        userId,
        dailyLimitMicro:  dailyLimitMicro ?? 5_000_000,
        autoDowngradeAt:  autoDowngradeAt  ?? 0.8,
      },
    })
  }

  // Feature flags
  const flagUpdates: Record<string, string> = {}
  if (body.enableV2Routing !== undefined) {
    const currentPlan = (await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }))?.plan ?? 'free'
    if (body.enableV2Routing === true && !PLAN_LIMITS[currentPlan as Plan]?.v2RoutingAllowed) {
      // Check owner bypass
      const userRow = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, email: true } })
      const isOwner = userRow?.role === 'owner' || (OWNER_EMAIL && userRow?.email === OWNER_EMAIL)
      if (!isOwner) {
        return NextResponse.json({ error: 'V2 Routing requires a Pro or Scale plan.' }, { status: 403 })
      }
    }
    flagUpdates['use_v2_routing'] = body.enableV2Routing ? '1' : '0'
  }
  if (body.enableV2Why !== undefined) {
    flagUpdates['use_v2_why'] = body.enableV2Why ? '1' : '0'
  }
  if (Object.keys(flagUpdates).length > 0) {
    try { await redis.hset(`flags:${userId}`, flagUpdates) }
    catch (err) { console.error('[settings] Redis flag write failed:', err) }
  }

  return NextResponse.json({ success: true })
}
