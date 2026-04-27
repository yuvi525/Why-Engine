export const dynamic = 'force-dynamic';

import { createServerSupabaseClient } from '@/src/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(req: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates = await req.json();
    const orgId = user.id;

    // Filter allowed updates for org_policies table
    const allowed = {
      daily_budget_usd: updates.daily_budget_usd,
      monthly_budget_usd: updates.monthly_budget_usd,
      max_input_tokens: updates.max_input_tokens,
      max_output_tokens: updates.max_output_tokens,
      allowed_models: updates.allowed_models, // expecting string array
      autopilot_enabled: updates.autopilot_enabled,
    };

    const { error } = await supabase
      .from('org_policies')
      .upsert({ org_id: orgId, ...allowed })
      .eq('org_id', orgId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
