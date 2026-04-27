import { NextResponse } from 'next/server';
import { approve, reject } from './engine';
import { hasPermission } from '../auth/rbac';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';

export async function getApprovals(request: Request, { params }: { params: { orgId: string } }) {
  const userId = request.headers.get('x-user-id');
  if (!userId || !(await hasPermission(userId, 'manage_org'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const sb = getSupabase();
  const { data, error } = await sb.from('approvals')
    .select('*')
    .eq('org_id', params.orgId)
    .eq('status', 'pending');

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function approveAction(request: Request, { params }: { params: { id: string } }) {
  const userId = request.headers.get('x-user-id');
  if (!userId || !(await hasPermission(userId, 'manage_org'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const data = await approve(params.id, userId);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
