import { NextRequest, NextResponse } from 'next/server'
import { resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY ?? ''
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const PRICE_IDS: Record<string, string> = {
  pro:   process.env.STRIPE_PRICE_PRO_ID   ?? process.env.STRIPE_PRICE_GROWTH_ID ?? '',
  scale: process.env.STRIPE_PRICE_SCALE_ID ?? '',
}

export async function POST(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const plan  = body.plan as 'pro' | 'scale'

  if (!['pro', 'scale'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const priceId = PRICE_IDS[plan]
  if (!priceId || priceId.startsWith('price_') === false) {
    // Stripe not configured — return instructions
    return NextResponse.json({
      error:   'stripe_not_configured',
      message: 'Add STRIPE_SECRET_KEY and STRIPE_PRICE_PRO_ID / STRIPE_PRICE_SCALE_ID to your .env',
    }, { status: 503 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, plan: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Create Stripe checkout session via REST API (no SDK needed)
  const params = new URLSearchParams({
    'mode':                               'subscription',
    'line_items[0][price]':               priceId,
    'line_items[0][quantity]':            '1',
    'customer_email':                     user.email,
    'metadata[userId]':                   userId,
    'metadata[plan]':                     plan,
    'success_url':                        `${APP_URL}/dashboard?upgraded=true&plan=${plan}`,
    'cancel_url':                         `${APP_URL}/pricing`,
    'subscription_data[metadata][userId]': userId,
    'subscription_data[metadata][plan]':   plan,
  })

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method:  'POST',
    headers: {
      'Authorization':  `Bearer ${STRIPE_SECRET}`,
      'Content-Type':   'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('[stripe] checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session', detail: err }, { status: 502 })
  }

  const session = await res.json()
  return NextResponse.json({ url: session.url })
}
