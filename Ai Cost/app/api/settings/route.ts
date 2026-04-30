import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'
import { redis } from '@/lib/redis'
import { PLAN_LIMITS, Plan } from '@/lib/plans'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [budget, userRow] = await Promise.all([
    prisma.budgetState.findUnique({
      where: { userId: user.id },
      select: { dailyLimitMicro: true, autoDowngradeAt: true, requestsToday: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { encryptedApiKey: true, plan: true },
    }),
  ])

  const hasApiKey = !!userRow?.encryptedApiKey
  const userPlan  = (userRow?.plan ?? 'free') as Plan

  // Derive masked key prefix for display (e.g. "sk-proj-...")
  let keyMask: string | null = null
  if (userRow?.encryptedApiKey) {
    try {
      const { decrypt: dec } = await import('@/lib/crypto')
      const raw = dec(userRow.encryptedApiKey)
      keyMask = raw.slice(0, 8) + '…' + raw.slice(-4)
    } catch { keyMask = 'sk-****' }
  }

  // Read feature flags (fail open — defaults to off)
  let v2RoutingEnabled = false
  let v2WhyEnabled = false
  try {
    const flags = await redis.hgetall<Record<string, string>>(`flags:${user.id}`)
    v2RoutingEnabled = flags?.use_v2_routing === '1'
    v2WhyEnabled     = flags?.use_v2_why === '1'
  } catch { /* flags are non-critical — default to off */ }

  return NextResponse.json({
    hasApiKey,
    keyMask,
    plan:           userPlan,
    planConfig:     PLAN_LIMITS[userPlan],
    requestsToday:  budget?.requestsToday    ?? 0,
    dailyLimitUsd:  (budget?.dailyLimitMicro ?? 5_000_000) / 1_000_000,
    autoDowngradeAt: budget?.autoDowngradeAt ?? 0.8,
    v2RoutingEnabled,
    v2WhyEnabled,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Ensure user row exists
  await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email! },
    create: { id: user.id, email: user.email! },
  })

  // Update OpenAI key if provided
  if (body.openAiKey) {
    const key = body.openAiKey.trim()
    if (!key.startsWith('sk-') || key.length < 20) {
      return NextResponse.json({ error: 'Invalid OpenAI API key — must start with sk- and be at least 20 characters.' }, { status: 400 })
    }
    const encryptedApiKey = encrypt(key)
    await prisma.user.update({ where: { id: user.id }, data: { encryptedApiKey } })
  }

  // Remove OpenAI key
  if (body.removeOpenAiKey === true) {
    await prisma.user.update({ where: { id: user.id }, data: { encryptedApiKey: null } })
  }

  // Update budget settings if provided
  if (body.dailyLimitUsd !== undefined || body.autoDowngradeAt !== undefined) {
    const dailyLimitMicro = body.dailyLimitUsd
      ? Math.min(Math.round(body.dailyLimitUsd * 1_000_000), 50_000_000)
      : undefined
    const autoDowngradeAt = body.autoDowngradeAt
      ? Math.min(Math.max(body.autoDowngradeAt, 0.5), 0.99)
      : undefined

    await prisma.budgetState.upsert({
      where: { userId: user.id },
      update: { ...(dailyLimitMicro !== undefined ? { dailyLimitMicro } : {}),
                ...(autoDowngradeAt !== undefined ? { autoDowngradeAt } : {}) },
      create: { userId: user.id, dailyLimitMicro: dailyLimitMicro ?? 5_000_000,
                autoDowngradeAt: autoDowngradeAt ?? 0.8 },
    })
  }

  // ── Feature flags ───────────────────────────────────────────────
  // enableV2Routing: requires pro+ plan — validate plan server-side
  // enableV2Why:     available to all plans
  const flagUpdates: Record<string, string> = {}
  if (body.enableV2Routing !== undefined) {
    const currentPlan = (await prisma.user.findUnique({
      where: { id: user.id }, select: { plan: true },
    }))?.plan ?? 'free'
    if (body.enableV2Routing === true && !PLAN_LIMITS[currentPlan as Plan]?.v2RoutingAllowed) {
      return NextResponse.json(
        { error: 'V2 Routing requires a Pro or Scale plan.' },
        { status: 403 }
      )
    }
    flagUpdates['use_v2_routing'] = body.enableV2Routing ? '1' : '0'
  }
  if (body.enableV2Why !== undefined) {
    flagUpdates['use_v2_why'] = body.enableV2Why ? '1' : '0'
  }
  if (Object.keys(flagUpdates).length > 0) {
    try {
      await redis.hset(`flags:${user.id}`, flagUpdates)
    } catch (err) {
      console.error('[vela] Redis flag write failed:', err)
      // Non-critical — don't fail the request
    }
  }

  return NextResponse.json({ success: true })
}
