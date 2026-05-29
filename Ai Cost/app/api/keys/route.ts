import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateApiKey, resolveSessionUserId } from '@/lib/auth'

// GET: List user's API keys
export async function GET(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await prisma.apiKey.findMany({
    where: { userId, isActive: true },
    select: { id: true, keyPrefix: true, label: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ keys })
}

// POST: Create new API key
export async function POST(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { label } = await req.json().catch(() => ({}))

  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Ensure user row exists (upsert)
  await prisma.user.upsert({
    where: { id: userId },
    update: { email: userRow.email },
    create: { id: userId, email: userRow.email },
  })

  const { key, hash, prefix } = generateApiKey()

  await prisma.apiKey.create({
    data: { userId, keyHash: hash, keyPrefix: prefix, label: label ?? null },
  })

  // Return full key only once — never stored
  return NextResponse.json({ key, prefix, label })
}
