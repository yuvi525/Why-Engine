import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { resolveSessionUserId } from '@/lib/auth'

async function getBudgets(userId: string): Promise<any[]> {
  try {
    const raw = await redis.get(`budgets:${userId}`)
    if (!raw) return []
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

async function saveBudgets(userId: string, budgets: any[]) {
  await redis.set(`budgets:${userId}`, JSON.stringify(budgets))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body    = await req.json().catch(() => ({}))
  const budgets = await getBudgets(userId)
  const idx     = budgets.findIndex((b: any) => b.id === id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  budgets[idx] = { ...budgets[idx], ...body, id }
  await saveBudgets(userId, budgets)
  return NextResponse.json({ budget: budgets[idx] })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const budgets  = await getBudgets(userId)
  const filtered = budgets.filter((b: any) => b.id !== id)
  await saveBudgets(userId, filtered)
  return NextResponse.json({ success: true })
}
