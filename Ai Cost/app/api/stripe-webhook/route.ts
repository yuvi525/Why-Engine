import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? ''
  if (!secret) {
    console.error('[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
  }

  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  // Verify Stripe webhook signature (t=timestamp,v1=hash)
  let event: any
  try {
    const parts     = sig.split(',').reduce((acc: Record<string, string>, part) => {
      const [k, v] = part.split('='); acc[k] = v; return acc
    }, {})
    const timestamp = parts['t']
    const v1Sig     = parts['v1']
    if (!timestamp || !v1Sig) throw new Error('Missing timestamp or signature')

    // Reject requests with timestamp older than 5 minutes to prevent replay attacks
    const tsNumber = parseInt(timestamp, 10)
    if (isNaN(tsNumber) || Math.abs(Date.now() / 1000 - tsNumber) > 300) {
      throw new Error('Timestamp expired or invalid')
    }

    const signed    = `${timestamp}.${body}`
    const expected  = createHmac('sha256', secret).update(signed).digest('hex')

    // Timing-safe signature comparison
    const bufExpected = Buffer.from(expected, 'hex')
    const bufActual   = Buffer.from(v1Sig, 'hex')
    if (bufExpected.length !== bufActual.length || !timingSafeEqual(bufExpected, bufActual)) {
      throw new Error('Signature mismatch')
    }

    event = JSON.parse(body)
  } catch (err) {
    console.warn('[stripe-webhook] Invalid signature:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const type = event.type as string

  // ── checkout.session.completed → activate plan ───────────────────────────
  if (type === 'checkout.session.completed') {
    const session  = event.data.object
    const userId   = session.metadata?.userId as string | undefined
    const plan     = (session.metadata?.plan as 'pro' | 'scale') ?? 'pro'

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data:  { plan, trialEndsAt: null },
      }).catch(err => console.error('[stripe-webhook] plan upgrade failed:', err))
      console.log(`[stripe-webhook] Upgraded ${userId} → ${plan}`)
    } else {
      // Fallback: lookup by customer email
      const email = session.customer_details?.email as string | undefined
      if (email) {
        await prisma.user.update({ where: { email }, data: { plan, trialEndsAt: null } })
          .catch(err => console.error('[stripe-webhook] email fallback failed:', err))
      }
    }
  }

  // ── customer.subscription.deleted → downgrade to free ────────────────────
  if (type === 'customer.subscription.deleted') {
    const sub    = event.data.object
    const userId = sub.metadata?.userId as string | undefined
    if (userId) {
      await prisma.user.update({ where: { id: userId }, data: { plan: 'free' } })
        .catch(err => console.error('[stripe-webhook] downgrade failed:', err))
    } else {
      const customerId = sub.customer as string | undefined
      const stripeSecret = process.env.STRIPE_SECRET_KEY
      if (customerId && stripeSecret) {
        try {
          const customerRes = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
            headers: { 'Authorization': `Bearer ${stripeSecret}` }
          })
          if (customerRes.ok) {
            const customer = await customerRes.json()
            const email = customer.email as string | undefined
            if (email) {
              await prisma.user.update({ where: { email }, data: { plan: 'free' } })
              console.log(`[stripe-webhook] Downgraded subscription by email fallback: ${email}`)
            }
          }
        } catch (err) {
          console.error('[stripe-webhook] Downgrade fallback email lookup failed:', err)
        }
      }
    }
  }

  // ── invoice.payment_failed → notify (future: send email) ─────────────────
  if (type === 'invoice.payment_failed') {
    console.warn('[stripe-webhook] Payment failed for:', event.data.object?.customer_email)
  }

  return NextResponse.json({ received: true })
}
