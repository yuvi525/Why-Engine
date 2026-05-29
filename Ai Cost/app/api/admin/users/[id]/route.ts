import { NextRequest, NextResponse } from 'next/server'
import { resolveSessionUserId, isOwner } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminId = await resolveSessionUserId(req)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isOwner(adminId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))

  const allowed: Record<string, unknown> = {}
  if (body.plan && ['free','pro','pro_trial','scale'].includes(body.plan)) {
    allowed.plan = body.plan
  }
  if (body.role && ['customer','owner'].includes(body.role)) {
    allowed.role = body.role
  }
  if (body.trialEndsAt) {
    allowed.trialEndsAt = new Date(body.trialEndsAt)
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data:  allowed,
    select: { id: true, email: true, plan: true, role: true },
  })

  return NextResponse.json({ user: updated })
}
