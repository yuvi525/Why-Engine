export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/src/lib/supabase/server';
import { DEFAULT_RULES, seedDefaultRules } from '@/lib/autopilot-engine';

/**
 * GET /api/autopilot/rules
 * Returns all autopilot rules for the authenticated org.
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      // Return default rules for demo/unauthenticated
      return NextResponse.json({
        rules: DEFAULT_RULES.map((r, i) => ({ ...r, id: `default-${i}`, org_id: null })),
        demo: true,
      });
    }

    const { data, error } = await supabase
      .from('autopilot_rules')
      .select('*')
      .eq('org_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rules: data || [], demo: false });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/autopilot/rules
 * Body: { seed_defaults: true } → seeds default rules for the org
 * Body: { name, trigger_type, action_type, config, enabled } → create rule
 */
export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    if (body.seed_defaults) {
      await seedDefaultRules(user.id);
      const { data } = await supabase
        .from('autopilot_rules')
        .select('*')
        .eq('org_id', user.id)
        .order('created_at', { ascending: true });
      return NextResponse.json({ seeded: true, rules: data || [] });
    }

    // Create a new custom rule
    const { name, trigger_type, action_type, config = {}, enabled = false } = body;
    const { data, error } = await supabase
      .from('autopilot_rules')
      .insert([{ org_id: user.id, name, trigger_type, action_type, config, enabled }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
