import { createServerSupabaseClient } from '../lib/supabase/server';

export interface WhyContext {
  route_decision?: any;
  savings_record?: any;
  anomalies?: any[];
  compression_result?: any;
  org_id: string;
}

export async function enqueueWhy(requestId: string, context: WhyContext) {
  if (!requestId) return;
  // Deeply non-blocking mock for Bull queue that writes directly to DB asynchronously
  try {
    const supabase = createServerSupabaseClient();
    // Provide an immediate pending state
    await supabase.from('why_records').insert({
      request_id: requestId,
      org_id: context.org_id,
      routing_reason: 'Pending analysis...',
      cost_reason: null,
      anomaly_reason: null,
      status: 'pending'
    });

    // Simulate async worker processing
    setTimeout(async () => {
      let routingReason = "Default routing to requested model.";
      if (context.route_decision?.routedModel && context.route_decision?.routedModel !== context.route_decision?.originalModel) {
        routingReason = `Autopilot intervened: Down-routed from ${context.route_decision.originalModel} to ${context.route_decision.routedModel} to maximize cost-efficiency while preserving task capability.`;
      }

      await supabase.from('why_records').update({
        routing_reason: routingReason,
        cost_reason: context.savings_record ? `Saved $${context.savings_record.savings_usd} by applying ${context.savings_record.saving_reason} optimization.` : 'Standard cost applied.',
        anomaly_reason: context.anomalies?.length ? `Detected anomalies: ${context.anomalies.map(a => a.type).join(', ')}` : 'No anomalies detected.',
        status: 'completed'
      }).eq('request_id', requestId);
    }, 2000);

  } catch (err) {
    console.error('[WhyProducer] Enqueue failed:', err);
  }
}
