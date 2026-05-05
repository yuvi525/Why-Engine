import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action } = await req.json()

  if (action === 'start_trial') {
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14) // 14 day trial
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: 'pro_trial', trialEndsAt }
    })
    return NextResponse.json({ success: true, plan: 'pro_trial', trialEndsAt })
  }

  if (action === 'upgrade_pro') {
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: 'pro', trialEndsAt: null }
    })
    return NextResponse.json({ success: true, plan: 'pro' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
