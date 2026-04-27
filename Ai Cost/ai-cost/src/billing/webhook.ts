import { NextResponse } from 'next/server';
import { stripe } from './stripe-client';
// @ts-ignore
import redis from '@/src/lib/redis';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';

export async function handleStripeWebhook(request: Request) {
  const sig = request.headers.get('stripe-signature') as string;
  const body = await request.text();

  try {
    const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET || 'mock');

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as any;
      const customerId = invoice.customer as string;

      const sb = getSupabase();
      const { data: org } = await sb.from('organizations').select('id').eq('stripe_customer_id', customerId).single();

      if (org && redis) {
        // Tightly integrated with the Prompt 8 Autopilot Remediation Engine
        await redis.set(`autopilot:locked:${org.id}`, 'true');
        console.log(`[Billing] Autopilot strictly locked org ${org.id} due to Stripe payment failure.`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json({ error: 'Webhook Signature Error' }, { status: 400 });
  }
}
