import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { prisma } from '@/lib/prisma'

/**
 * Razorpay Webhook Handler
 * Set this URL in your Razorpay dashboard:
 *   https://yourdomain.com/api/razorpay-webhook
 *
 * Required env vars:
 *   RAZORPAY_WEBHOOK_SECRET — from Razorpay dashboard → Webhooks
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[razorpay-webhook] Missing RAZORPAY_WEBHOOK_SECRET')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
  }

  const body = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''

  // Verify HMAC SHA256 signature
  const expected = createHmac('sha256', webhookSecret).update(body).digest('hex')
  if (expected !== signature) {
    console.warn('[razorpay-webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Bad payload' }, { status: 400 })
  }

  const eventType: string = event.event ?? ''

  // Handle successful payment
  if (eventType === 'payment.captured' || eventType === 'subscription.activated') {
    const payload = event.payload?.payment?.entity ?? event.payload?.subscription?.entity ?? {}
    
    // We store the user email in Razorpay's `notes.email` field
    // Make sure to pass `notes: { email: user.email }` when creating the Razorpay order
    const email: string | undefined = payload.notes?.email ?? payload.email

    if (!email) {
      console.warn('[razorpay-webhook] No email in payload notes', payload)
      return NextResponse.json({ received: true })
    }

    try {
      await prisma.user.update({
        where: { email },
        data: { plan: 'pro', trialEndsAt: null },
      })
      console.log(`[razorpay-webhook] Upgraded ${email} → pro`)
    } catch (err) {
      console.error('[razorpay-webhook] DB update failed:', err)
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
    }
  }

  // Handle subscription cancellation / payment failed → revert to free
  if (eventType === 'subscription.cancelled' || eventType === 'payment.failed') {
    const payload = event.payload?.subscription?.entity ?? event.payload?.payment?.entity ?? {}
    const email: string | undefined = payload.notes?.email ?? payload.email

    if (email) {
      try {
        await prisma.user.update({
          where: { email },
          data: { plan: 'free', trialEndsAt: null },
        })
        console.log(`[razorpay-webhook] Reverted ${email} → free`)
      } catch (err) {
        console.error('[razorpay-webhook] DB revert failed:', err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
