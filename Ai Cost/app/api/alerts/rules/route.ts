import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { resolveSessionUserId } from '@/lib/auth'
import { randomUUID } from 'crypto'

async function getRules(userId: string): Promise<any[]> {
  try {
    const raw = await redis.get(`alert_rules:${userId}`)
    if (!raw) return []
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

async function saveRules(userId: string, rules: any[]) {
  await redis.set(`alert_rules:${userId}`, JSON.stringify(rules))
}

export async function GET(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rules = await getRules(userId)
  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const rules = await getRules(userId)

  const rule = {
    id:             randomUUID(),
    name:           body.name ?? 'Unnamed Alert',
    type:           body.type ?? 'spend_spike',
    threshold:      body.threshold ?? 50,
    windowMinutes:  body.windowMinutes ?? 60,
    enabled:        body.enabled ?? true,
    channels:       body.channels ?? ['dashboard'],
    triggerCount:   0,
    lastTriggered:  null,
    createdAt:      new Date().toISOString(),
  }

  rules.push(rule)
  await saveRules(userId, rules)
  return NextResponse.json({ rule }, { status: 201 })
}
