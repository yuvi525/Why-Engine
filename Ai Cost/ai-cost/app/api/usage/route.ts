export const dynamic = 'force-dynamic';

import { createServerSupabaseClient } from '@/src/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const range = url.searchParams.get('range') || '30d'; // 7d, 30d, month
    const format = url.searchParams.get('format') || 'json';
    
    const supabase = createServerSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = user.id;

    // Date range filter
    const days = range === '7d' ? 7 : range === 'month' ? 30 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('usage_records')
      .select('*')
      .eq('org_id', orgId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (format === 'csv') {
      const csv = [
        ['ID', 'Model', 'Cost', 'Tokens', 'Created At'].join(','),
        ...(data || []).map(r => [r.id, r.model, r.cost_usd, r.total_tokens, r.created_at].join(','))
      ].join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="usage.csv"'
        }
      });
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
