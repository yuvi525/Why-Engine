import { NextResponse } from 'next/server';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';

// GET /v1/orgs/:id/cost-dna
export async function getCostDNA(request: Request, { params }: { params: { id: string } }) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('cost_dna_snapshots')
    .select('*')
    .eq('org_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return NextResponse.json({ error: 'DNA Snapshot not found' }, { status: 404 });
  return NextResponse.json(data);
}
