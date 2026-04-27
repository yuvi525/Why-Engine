import { NextResponse } from 'next/server';
import { generateInvite, acceptInvite } from './service';
import { hasPermission } from '../auth/rbac';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';

export async function inviteUser(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId || !(await hasPermission(userId, 'manage_org'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { orgId, role } = await request.json();
  const token = await generateInvite(orgId, role, userId);
  return NextResponse.json({ token });
}

export async function acceptUserInvite(request: Request) {
  const { token, email, name } = await request.json();
  try {
    const user = await acceptInvite(token, email, name);
    return NextResponse.json(user);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function listUsers(request: Request, { params }: { params: { orgId: string } }) {
  const userId = request.headers.get('x-user-id');
  if (!userId || !(await hasPermission(userId, 'view_usage'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const sb = getSupabase();
  const { data } = await sb.from('users').select('id, email, name, role, created_at').eq('org_id', params.orgId);
  return NextResponse.json(data);
}
