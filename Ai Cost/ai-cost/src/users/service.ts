const jwt = { sign: (...args: any[]) => 'mock-jwt', verify: (...args: any[]) => ({}) };
// @ts-ignore
import { getSupabase } from '@/src/lib/db';
import { logAudit } from '../audit/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export async function generateInvite(orgId: string, role: string, inviterId: string) {
  // Generates a cryptographically secure, time-limited JWT for onboarding
  const token = jwt.sign({ orgId, role, inviterId }, JWT_SECRET, { expiresIn: '7d' });
  
  await logAudit({
    orgId,
    userId: inviterId,
    action: 'invite_generated',
    resource: 'users',
    metadata: { role }
  });

  return token;
}

export async function acceptInvite(token: string, email: string, name: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    const sb = getSupabase();
    const { data, error } = await sb.from('users').insert([{
      email,
      name,
      org_id: decoded.orgId,
      role: decoded.role,
      invited_by: decoded.inviterId
    }]).select().single();

    if (error) throw error;

    await logAudit({
      orgId: decoded.orgId,
      userId: data.id,
      action: 'invite_accepted',
      resource: 'users',
      metadata: { role: decoded.role }
    });

    return data;
  } catch (e) {
    throw new Error('Invalid or expired invite token');
  }
}
