import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { generateApiKey } from '@/lib/auth'

export async function POST(req: Request) {
  const auth = req.headers.get('x-seed-key')
  if (auth !== 'your-secret-key') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const email = 'yuvrajsingh2351@gmail.com'
  const password = '1234'

  // 1. Ensure Supabase user
  let userId: string
  const { data: listData } = await supabase.auth.admin.listUsers()
  const existing = listData?.users.find(u => u.email === email)

  if (existing) {
    userId = existing.id
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    userId = data.user.id
  }

  // 2. Ensure Prisma user + budget
  await prisma.user.upsert({
    where: { id: userId },
    update: { email },
    create: { id: userId, email },
  })

  await prisma.budgetState.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      dailyLimitMicro: 5_000_000,
      spentTodayMicro: 0,
      totalSpentMicro: 0,
      totalBaselineMicro: 0,
    },
  })

  // 3. Ensure API key
  const existingKey = await prisma.apiKey.findFirst({ where: { userId, isActive: true } })
  let newApiKey: string | null = null
  if (!existingKey) {
    const { key, hash, prefix } = generateApiKey()
    await prisma.apiKey.create({
      data: { userId, keyHash: hash, keyPrefix: prefix, label: 'Default Key' },
    })
    newApiKey = key
  }

  // 4. Seed decision logs if empty
  const existingLogs = await prisma.decisionLog.count({ where: { userId } })
  let logsSeeded = 0

  if (existingLogs === 0) {
    const now = Date.now()
    const scenarios = [
      { model: 'gpt-4o-mini', reasonCode: 'COMPLEXITY_LOW',  inputTokens: 45,  outputTokens: 82,   actualCostMicro: 18,   baselineCostMicro: 360,  prompt: 'Summarize this paragraph in one sentence.' },
      { model: 'gpt-4o',      reasonCode: 'COMPLEXITY_HIGH', inputTokens: 512, outputTokens: 890,  actualCostMicro: 892,  baselineCostMicro: 892,  prompt: 'Analyze the Q3 financial report and identify cost drivers.' },
      { model: 'gpt-4o-mini', reasonCode: 'COMPLEXITY_LOW',  inputTokens: 30,  outputTokens: 55,   actualCostMicro: 12,   baselineCostMicro: 240,  prompt: 'What is the capital of France?' },
      { model: 'gpt-4o-mini', reasonCode: 'BUDGET_GUARD',    inputTokens: 88,  outputTokens: 140,  actualCostMicro: 29,   baselineCostMicro: 580,  prompt: 'Draft a short email response to this customer query.' },
      { model: 'gpt-4o',      reasonCode: 'COMPLEXITY_HIGH', inputTokens: 380, outputTokens: 620,  actualCostMicro: 625,  baselineCostMicro: 625,  prompt: 'Refactor this legacy Python codebase to use async/await.' },
      { model: 'gpt-4o-mini', reasonCode: 'COMPLEXITY_LOW',  inputTokens: 22,  outputTokens: 40,   actualCostMicro: 9,    baselineCostMicro: 180,  prompt: 'Translate "hello world" to Spanish.' },
      { model: 'gpt-4o-mini', reasonCode: 'CACHE_HIT',       inputTokens: 45,  outputTokens: 82,   actualCostMicro: 0,    baselineCostMicro: 360,  prompt: 'Summarize this paragraph in one sentence.' },
      { model: 'gpt-4o-mini', reasonCode: 'COMPLEXITY_LOW',  inputTokens: 60,  outputTokens: 110,  actualCostMicro: 22,   baselineCostMicro: 440,  prompt: 'List the top 5 benefits of machine learning.' },
      { model: 'gpt-4o',      reasonCode: 'COMPLEXITY_HIGH', inputTokens: 700, outputTokens: 1200, actualCostMicro: 1210, baselineCostMicro: 1210, prompt: 'Design a microservices architecture for a fintech startup.' },
      { model: 'gpt-4o-mini', reasonCode: 'COMPLEXITY_LOW',  inputTokens: 35,  outputTokens: 60,   actualCostMicro: 14,   baselineCostMicro: 280,  prompt: 'Write a haiku about AI.' },
    ]

    let totalSpent = 0
    let totalBaseline = 0

    for (let i = 0; i < scenarios.length; i++) {
      const s = scenarios[i]
      const savingsMicro = Math.max(s.baselineCostMicro - s.actualCostMicro, 0)
      const savingsPct = s.baselineCostMicro > 0
        ? Math.round((savingsMicro / s.baselineCostMicro) * 100)
        : 0

      totalSpent += s.actualCostMicro
      totalBaseline += s.baselineCostMicro

      await prisma.decisionLog.create({
        data: {
          userId,
          requestId: `seed-${i}-${now}`,
          model: s.model,
          reasonCode: s.reasonCode,
          inputTokens: s.inputTokens,
          outputTokens: s.outputTokens,
          actualCostMicro: s.actualCostMicro,
          baselineCostMicro: s.baselineCostMicro,
          savingsMicro,
          savingsPct,
          isCacheHit: s.reasonCode === 'CACHE_HIT',
          promptPreview: s.prompt,
          createdAt: new Date(now - (scenarios.length - i) * 5 * 60 * 1000),
        },
      })
      logsSeeded++
    }

    await prisma.budgetState.update({
      where: { userId },
      data: {
        spentTodayMicro: totalSpent,
        totalSpentMicro: totalSpent,
        totalBaselineMicro: totalBaseline,
      },
    })
  }

  return NextResponse.json({ success: true, userId, email, newApiKey, logsSeeded })
}
