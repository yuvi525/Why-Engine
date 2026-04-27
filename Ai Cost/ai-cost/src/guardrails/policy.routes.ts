import { NextResponse } from 'next/server';
import { hasPermission } from '../auth/rbac';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';
import { logAudit } from '../audit/logger';

export async function getPolicy(request: Request, { params }: { params: { orgId: string } }) {
  const userId = request.headers.get('x-user-id');
  if (!userId || !(await hasPermission(userId, 'manage_policies'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const sb = getSupabase();
  const { data, error } = await sb.from('org_policies').select('*').eq('org_id', params.orgId).single();
  
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function updatePolicy(request: Request, { params }: { params: { orgId: string } }) {
  const userId = request.headers.get('x-user-id') as string;
  if (!userId || !(await hasPermission(userId, 'manage_policies'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const payload = await request.json();
  const sb = getSupabase();

  const { data, error } = await sb.from('org_policies')
    .upsert({ org_id: params.orgId, ...payload, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Native integration with Audit Tracker (Prompt 22)
  await logAudit({
    orgId: params.orgId,
    userId,
    action: 'policy_updated',
    resource: 'org_policies',
    metadata: { updates: payload }
  });

  return NextResponse.json(data);
}
