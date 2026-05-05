import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const email = body.email || user.email

    let role = 'customer'
    if (email === 'yuvrajsingh2351@gmail.com') {
      role = 'owner'
    }

    await prisma.user.upsert({
      where: { id: user.id },
      update: { email: email!, role },
      create: { id: user.id, email: email!, role },
    })

    return NextResponse.json({ success: true, role })
  } catch (error) {
    console.error('[vela] auth sync error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
