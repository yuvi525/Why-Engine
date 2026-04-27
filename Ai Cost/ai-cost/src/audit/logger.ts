// @ts-ignore
import { getSupabase } from '@/src/lib/db';

export interface AuditLogEvent {
  orgId: string;
  userId?: string;
  action: string;
  resource: string;
  metadata?: any;
}

export async function logAudit(event: AuditLogEvent) {
  const sb = getSupabase();
  if (!sb) return;

  try {
    await sb.from('audit_logs').insert([{
      org_id: event.orgId,
      user_id: event.userId,
      action: event.action,
      resource: event.resource,
      metadata: event.metadata || {},
      timestamp: new Date().toISOString()
    }]);
  } catch (e) {
    console.error('[AuditLogger] Failed to persist audit event', e);
  }
}
