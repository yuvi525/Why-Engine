import { NextResponse } from 'next/server';
import { hasPermission } from '../auth/rbac';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';

export async function getAuditLogs(request: Request, { params }: { params: { orgId: string } }) {
  const userId = request.headers.get('x-user-id');
  if (!userId || !(await hasPermission(userId, 'view_audit'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const sb = getSupabase();
  let query = sb.from('audit_logs').select('*').eq('org_id', params.orgId);
  
  if (action) {
    query = query.eq('action', action);
  }

  query = query.order('timestamp', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(data);
}
