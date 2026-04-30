import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { redis } from '@/lib/redis'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const budget = await prisma.budgetState.findUnique({
    where: { userId: user.id },
    select: { dailyLimitMicro: true, autoDowngradeAt: true },
  })

  const hasApiKey = !!(await prisma.user.findUnique({
    where: { id: user.id },
    select: { encryptedApiKey: true },
  }))?.encryptedApiKey

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
    dailyLimitUsd:    (budget?.dailyLimitMicro ?? 5_000_000) / 1_000_000,
    autoDowngradeAt:  budget?.autoDowngradeAt ?? 0.8,
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
    if (!body.openAiKey.startsWith('sk-')) {
      return NextResponse.json({ error: 'Invalid OpenAI API key format' }, { status: 400 })
    }
    const encryptedApiKey = encrypt(body.openAiKey)
    await prisma.user.update({ where: { id: user.id }, data: { encryptedApiKey } })
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

  // ── Feature flags ────────────────────────────────────────────────
  // enableV2Routing: boolean — activates 5-tier decideV2() for this user
  // enableV2Why:     boolean — activates personalized WHY v2 explanations
  const flagUpdates: Record<string, string> = {}
  if (body.enableV2Routing !== undefined) {
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
