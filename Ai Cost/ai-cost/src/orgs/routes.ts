import { NextResponse } from 'next/server';
import crypto from 'crypto';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';
import { getOrgUsage } from './org-store';

function verifyAdmin(request: Request) {
  return request.headers.get('x-admin-secret') === process.env.ADMIN_SECRET;
}

// POST /admin/orgs
export async function createOrg(request: Request) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const body = await request.json();
  const sb = getSupabase();
  const { data, error } = await sb.from('organizations').insert([body]).select().single();
  
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

// POST /admin/orgs/:id/keys
export async function createApiKey(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  // Secure generation
  const rawKey = `sk_ap_${crypto.randomBytes(32).toString('hex')}`;
  const key_hash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const sb = getSupabase();
  const { data, error } = await sb.from('api_keys').insert([{
    org_id: params.id,
    key_hash,
    label: body.label || 'Default API Key',
    rate_limit_rpm: body.rate_limit_rpm || 60
  }]).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  
  // Return the raw key ONLY ONCE. It is never retrievable again.
  return NextResponse.json({ ...data, raw_key: rawKey }); 
}

// GET /admin/orgs/:id/usage
export async function getUsage(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const usage = await getOrgUsage(params.id);
  
  // Requires an RPC function in Supabase joining route_decisions
  const sb = getSupabase();
  const { data: topModels } = await sb.rpc('get_top_models_by_cost', { p_org_id: params.id });

  return NextResponse.json({
    spend_today: usage.spend_today_usd,
    spend_month: usage.spend_month_usd,
    budget_remaining: usage.daily_budget_usd ? Math.max(0, usage.daily_budget_usd - usage.spend_today_usd) : null,
    top_models: topModels || []
  });
}
