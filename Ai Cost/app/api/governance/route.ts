import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { resolveSessionUserId } from '@/lib/auth'
import { randomUUID } from 'crypto'

async function getPolicies(userId: string): Promise<any[]> {
  try {
    const raw = await redis.get(`governance:${userId}`)
    if (!raw) return []
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

async function savePolicies(userId: string, policies: any[]) {
  await redis.set(`governance:${userId}`, JSON.stringify(policies))
}

export async function GET(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const policies = await getPolicies(userId)
  return NextResponse.json({ policies })
}

export async function POST(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const policies = await getPolicies(userId)

  const policy = {
    id:          randomUUID(),
    name:        body.name ?? 'Unnamed Policy',
    type:        body.type ?? 'model_restriction',
    description: body.description ?? '',
    enabled:     body.enabled ?? true,
    config:      body.config ?? {},
    createdAt:   new Date().toISOString(),
  }

  policies.push(policy)
  await savePolicies(userId, policies)
  return NextResponse.json({ policy }, { status: 201 })
}
