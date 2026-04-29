import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { generateApiKey } from '@/lib/auth'

// GET: List user's API keys
export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id, isActive: true },
    select: { id: true, keyPrefix: true, label: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ keys })
}

// POST: Create new API key
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { label } = await req.json().catch(() => ({}))

  // Ensure user row exists
  await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email! },
    create: { id: user.id, email: user.email! },
  })

  const { key, hash, prefix } = generateApiKey()

  await prisma.apiKey.create({
    data: { userId: user.id, keyHash: hash, keyPrefix: prefix, label: label ?? null },
  })

  // Return full key only once — never stored
  return NextResponse.json({ key, prefix, label })
}
