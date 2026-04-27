export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/src/lib/supabase/server';

/**
 * GET /api/auth/me
 * Returns current user info including plan.
 * Response: { authenticated, userId, email, orgId, plan: "free" | "growth" | "scale" }
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ authenticated: false, plan: 'free' });
    }

    // Try to fetch org plan from orgs table
    const { data: org } = await supabase
      .from('orgs')
      .select('plan')
      .eq('owner_id', user.id)
      .maybeSingle();

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      email:  user.email,
      orgId:  user.id,
      plan:   org?.plan ?? 'free',
    });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, plan: 'free' });
  }
}
