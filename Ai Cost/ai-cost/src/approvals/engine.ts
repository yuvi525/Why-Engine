// @ts-ignore
import { getSupabase } from '@/src/lib/db';
import { logAudit } from '../audit/logger';

export async function createApproval(orgId: string, type: string, payload: any) {
  const sb = getSupabase();
  if (!sb) return;

  const { data, error } = await sb.from('approvals').insert([{
    org_id: orgId,
    type,
    payload,
    status: 'pending'
  }]).select().single();

  if (error) throw error;
  
  await logAudit({
    orgId,
    action: 'approval_created',
    resource: 'approvals',
    metadata: { approvalId: data.id, type }
  });

  return data;
}

export async function approve(approvalId: string, userId: string) {
  const sb = getSupabase();
  if (!sb) return;

  const { data, error } = await sb.from('approvals')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: userId })
    .eq('id', approvalId)
    .select().single();

  if (error) throw error;

  await logAudit({
    orgId: data.org_id,
    userId,
    action: 'approval_granted',
    resource: 'approvals',
    metadata: { approvalId, type: data.type }
  });

  return data;
}

export async function reject(approvalId: string, userId: string) {
  const sb = getSupabase();
  if (!sb) return;

  const { data, error } = await sb.from('approvals')
    .update({ status: 'rejected' })
    .eq('id', approvalId)
    .select().single();

  if (error) throw error;

  await logAudit({
    orgId: data.org_id,
    userId,
    action: 'approval_rejected',
    resource: 'approvals',
    metadata: { approvalId, type: data.type }
  });

  return data;
}
