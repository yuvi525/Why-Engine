import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { resolveSessionUserId } from '@/lib/auth'

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body  = await req.json().catch(() => ({}))
  const rules = await getRules(userId)
  const idx   = rules.findIndex((r: any) => r.id === id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  rules[idx] = { ...rules[idx], ...body, id }
  await saveRules(userId, rules)
  return NextResponse.json({ rule: rules[idx] })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rules = await getRules(userId)
  await saveRules(userId, rules.filter((r: any) => r.id !== id))
  return NextResponse.json({ success: true })
}
