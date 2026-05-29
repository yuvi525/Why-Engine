import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { resolveSessionUserId } from '@/lib/auth'
import { randomUUID } from 'crypto'

// Budgets stored in Redis as JSON lists per user
// Key: budgets:{userId}
// Value: JSON array of Budget objects

async function getBudgets(userId: string) {
  try {
    const raw = await redis.get(`budgets:${userId}`)
    if (!raw) return []
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

async function saveBudgets(userId: string, budgets: unknown[]) {
  await redis.set(`budgets:${userId}`, JSON.stringify(budgets))
}

export async function GET(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const budgets = await getBudgets(userId)
  return NextResponse.json({ budgets })
}

export async function POST(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const budgets = await getBudgets(userId)

  const newBudget = {
    id:           randomUUID(),
    name:         body.name ?? 'Unnamed Budget',
    scope:        body.scope ?? 'daily',
    scopeValue:   body.scopeValue ?? '',
    limitMicro:   body.limitMicro ?? 10_000_000,
    softLimitPct: body.softLimitPct ?? 80,
    hardLimit:    body.hardLimit ?? false,
    enabled:      body.enabled ?? true,
    action:       body.action ?? 'alert',
    spentMicro:   0,
    createdAt:    new Date().toISOString(),
  }

  budgets.push(newBudget)
  await saveBudgets(userId, budgets)
  return NextResponse.json({ budget: newBudget }, { status: 201 })
}
