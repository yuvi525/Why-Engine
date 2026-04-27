import { NormalizedRequest } from '../types/normalized';
import { AnomalyResult, OrgUsage } from './types';
import { detectLoop } from './detectors/loop';
import { detectBudget } from './detectors/budget';
import { detectSpike } from './detectors/spike';
import { detectProviderError } from './detectors/provider-error';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';
// Bull queue removed for Next.js compatibility
let anomalyQueue: any = null;

export async function check(request: NormalizedRequest, orgUsage: OrgUsage): Promise<AnomalyResult[]> {
  const anomalies: AnomalyResult[] = [];

  // 1. Run all Redis-backed detectors concurrently for minimum latency
  const [loopRes, spikeRes, providerRes] = await Promise.all([
    detectLoop(request),
    detectSpike(request),
    detectProviderError(request)
  ]);

  // 2. Budget check is instantaneous (data provided via Prompt 9 metadata)
  const budgetRes = detectBudget(orgUsage);

  if (loopRes) anomalies.push(loopRes);
  if (spikeRes) anomalies.push(spikeRes);
  if (providerRes) anomalies.push(providerRes);
  if (budgetRes) anomalies.push(budgetRes);

  if (anomalies.length > 0) {
    const orgId = orgUsage.orgId;
    
    // 3. Process persistence async so we don't block the API path
    setImmediate(async () => {
      try {
        const sb = getSupabase();
        
        for (const anomaly of anomalies) {
          // A. Write to Supabase DB for audit trail
          if (sb) {
            await sb.from('anomaly_events').insert([{
              org_id: orgId,
              type: anomaly.type,
              message: anomaly.message,
              metadata: anomaly.metadata,
              timestamp: new Date().toISOString()
            }]);
          }

          // B. Enqueue for Prompt 8 (Autopilot Worker) to take automated action
          if (anomalyQueue) {
            await anomalyQueue.add({
              orgId,
              anomaly,
              timestamp: Date.now()
            }, {
              attempts: 3,
              backoff: { type: 'exponential', delay: 1000 }
            });
          }
        }
      } catch (err) {
        console.error('[AnomalyDetector] Async logging failed:', err);
      }
    });
  }

  return anomalies;
}
