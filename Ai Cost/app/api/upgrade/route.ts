import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'

/**
 * /api/upgrade — handles plan changes.
 *
 * ALLOWED actions:
 *   - start_trial   → sets plan to 'pro_trial' with 14-day expiry
 *
 * REMOVED (security):
 *   - upgrade_pro    → was a payment bypass. Plan upgrades ONLY via Razorpay webhook.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action } = body

  // ── Trial Activation ──────────────────────────────────────────────
  if (action === 'start_trial') {
    // Prevent re-activating trial if user already used one
    const userRow = await prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, trialEndsAt: true },
    })

    if (userRow?.plan === 'pro' || userRow?.plan === 'scale') {
      return NextResponse.json({ error: 'Already on a paid plan' }, { status: 400 })
    }

    if (userRow?.plan === 'pro_trial') {
      return NextResponse.json({ error: 'Trial already active' }, { status: 400 })
    }

    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14) // 14 day trial

    await prisma.user.update({
      where: { id: user.id },
      data: { plan: 'pro_trial', trialEndsAt },
    })

    return NextResponse.json({ success: true, plan: 'pro_trial', trialEndsAt })
  }

  // ── All other actions are invalid ─────────────────────────────────
  // Plan upgrades to 'pro' or 'scale' ONLY happen via /api/razorpay-webhook
  // after verified payment. No client-side upgrade path exists.
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
