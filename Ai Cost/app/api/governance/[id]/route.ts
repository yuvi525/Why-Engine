import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { resolveSessionUserId } from '@/lib/auth'

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body     = await req.json().catch(() => ({}))
  const policies = await getPolicies(userId)
  const idx      = policies.findIndex((p: any) => p.id === id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  policies[idx] = { ...policies[idx], ...body, id }
  await savePolicies(userId, policies)
  return NextResponse.json({ policy: policies[idx] })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const policies = await getPolicies(userId)
  await savePolicies(userId, policies.filter((p: any) => p.id !== id))
  return NextResponse.json({ success: true })
}
