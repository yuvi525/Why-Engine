import { NextResponse } from "next/server";

// Lazy Supabase — same pattern as ingestion-engine
let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = require("@supabase/supabase-js");
  _supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return _supabase;
}

/**
 * GET /api/latest-analysis
 *
 * Returns the most recent row from analysis_results.
 * Dashboard polls this every 8 seconds.
 *
 * Response (success):
 * {
 *   found: true,
 *   analysis: { priority, why, impact, action, decision, confidence,
 *               totalCost, estimatedSavings, anomalyType, createdAt }
 * }
 *
 * Response (none found / DB not configured):
 * { found: false, reason: string }
 */
export async function GET() {
  const sb = getSupabase();

  if (!sb) {
    return NextResponse.json(
      { found: false, reason: "Database not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 200 }
    );
  }

  const { data, error } = await sb
    .from("analysis_results")
    .select(
      "session_id, anomaly_type, priority, why, impact, action, decision, confidence, total_cost, estimated_savings, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[/api/latest-analysis] Supabase error:", error.message);
    return NextResponse.json({ found: false, reason: error.message }, { status: 200 });
  }

  if (!data) {
    return NextResponse.json({ found: false, reason: "No analysis results yet." }, { status: 200 });
  }

  return NextResponse.json({
    found: true,
    analysis: {
      // Shape matches formatDecisionOutput output + extra fields
      priority:         data.priority,
      why:              data.why,
      impact:           data.impact,
      action:           Array.isArray(data.action) ? data.action : [],
      decision:         data.decision,
      confidence:       data.confidence,
      totalCost:        data.total_cost,
      estimatedSavings: data.estimated_savings,
      anomalyType:      data.anomaly_type,
      sessionId:        data.session_id,
      createdAt:        data.created_at,
    },
  });
}
