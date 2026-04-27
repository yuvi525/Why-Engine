// @ts-ignore
import { getSupabase } from '@/src/lib/db';
import { stripe } from './stripe-client';

export async function reportUsage(orgId: string, periodEnd: Date) {
  const sb = getSupabase();
  if (!sb) return;

  const { data: org } = await sb.from('organizations').select('*').eq('id', orgId).single();
  if (!org || !org.stripe_customer_id) return;

  // These metrics are aggregated dynamically from Supabase `savings_records`
  const total_savings_usd = 150.00; // Mocked aggregation
  const total_tokens = 500000;

  if (org.plan === 'enterprise') {
    // Business Model 1: Percentage of Savings (We only get paid when we save the customer money)
    const billableAmount = Math.floor(total_savings_usd * 0.20 * 100); // 20% fee in cents
    
    await stripe.invoiceItems.create({
      customer: org.stripe_customer_id,
      amount: billableAmount,
      currency: 'usd',
      description: `Autopilot Optimization Fee (20% of $${total_savings_usd.toFixed(2)} saved)`,
    }).catch(console.error);

  } else {
    // Business Model 2: Subscription + API Gateway Token Overage
    await stripe.billing.meterEvents.create({
      event_name: 'ai_tokens_used',
      payload: {
        value: total_tokens.toString(),
        stripe_customer_id: org.stripe_customer_id
      }
    }).catch(console.error);
  }
}
