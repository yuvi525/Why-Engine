// @ts-ignore
import { getSupabase } from '@/src/lib/db';

export async function checkGuarantee(orgId: string, guaranteedAmount: number) {
  const sb = getSupabase();
  if (!sb) return;

  // Mock aggregated savings for the month
  const actualSavings = 1200.50; 
  const status = actualSavings >= guaranteedAmount ? 'met' : 'underperforming';

  await sb.from('savings_guarantees').insert([{
    org_id: orgId,
    month: new Date().toISOString().split('T')[0],
    guaranteed_savings_usd: guaranteedAmount,
    actual_savings_usd: actualSavings,
    status
  }]);

  if (status === 'underperforming') {
    // Triggers internal alerts for the operations team to manually tune the org's routing logic
    console.warn(`[SavingsGuarantee] Org ${orgId} is underperforming against ROI guarantee!`);
  }
}
