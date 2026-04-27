export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/src/lib/supabase/server';

/**
 * GET /api/latest-analysis
 * Returns the most recent WHY Engine analysis for the authenticated user.
 *
 * Response shape:
 *   { found: true,  analysis: { priority, why, impact, action, decision, confidence, totalCost, estimatedSavings, anomalyType, sessionId, createdAt } }
 *   { found: false, analysis: null }
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ found: false, analysis: null }, { status: 401 });
    }

    // Query the why_logs table (most recent entry for this user)
    const { data, error } = await supabase
      .from('why_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[/api/latest-analysis] query error:', error.message);
      return NextResponse.json({ found: false, analysis: null, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ found: false, analysis: null });
    }

    // Normalise the DB row to the standard analysis shape
    const analysis = {
      priority:         data.priority         || 'LOW',
      why:              data.why              || data.summary || '',
      impact:           data.impact           || '',
      action:           Array.isArray(data.action) ? data.action : (data.recommendations || []),
      decision:         data.decision         || '',
      confidence:       data.confidence       || '0%',
      totalCost:        Number(data.total_cost_usd     || data.totalCost    || 0),
      estimatedSavings: Number(data.estimated_savings  || data.estimatedSavings || 0),
      anomalyType:      data.anomaly_type     || data.anomalyType || null,
      anomaly_detected: Boolean(data.anomaly_detected),
      sessionId:        data.session_id       || data.id || null,
      createdAt:        data.created_at       || new Date().toISOString(),
      // pass through any extra fields (rankedContributors, node_breakdown, etc.)
      ...(data.output_json ? data.output_json : {}),
    };

    return NextResponse.json({ found: true, analysis });
  } catch (err: any) {
    console.error('[/api/latest-analysis] error:', err?.message);
    return NextResponse.json({ found: false, analysis: null, error: err.message }, { status: 500 });
  }
}
