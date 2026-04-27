export const dynamic = 'force-dynamic';

import { createServerSupabaseClient } from '@/src/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const supabase = createServerSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = user.id;

    const { data, error } = await supabase
      .from('cost_dna_snapshots')
      .select('*')
      .eq('org_id', orgId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is not found
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || { recommendations: [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
