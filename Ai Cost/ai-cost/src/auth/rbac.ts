// @ts-ignore
import { getSupabase } from '@/src/lib/db';

export async function hasPermission(userId: string, action: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { data: user } = await sb.from('users').select('role').eq('id', userId).single();
  if (!user) return false;

  const { data: permission } = await sb.from('roles_permissions')
    .select('*')
    .eq('role', user.role)
    .eq('permission', action)
    .single();

  return !!permission;
}
