export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { processIngestion } from '@/lib/ingestion-engine';
import { createServerSupabaseClient } from '@/src/lib/supabase/server';

/**
 * POST /api/ingest
 *
 * Body (Claude-aligned schema):
 *   { model, input_tokens, output_tokens, session_id, agent_id?, run_id?, user_id? }
 *   OR legacy: { model, tokens, cost, session_id }
 *
 * Response shape (from processIngestion):
 *   {
 *     status: "collecting" | "ok" | "decision" | "partial",
 *     session_id, anomaly_detected, record_count, total_cost,
 *     decision?: { priority, why, impact, action[], decision, confidence, totalCost, estimatedSavings, anomalyType },
 *     autopilot?: { suggestions[], rules_triggered, note }
 *   }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body?.model) {
      return NextResponse.json(
        { error: "Field 'model' is required." },
        { status: 400 }
      );
    }

    // Try to resolve org_id from auth (anonymous fallback = null)
    let orgId: string | null = null;
    try {
      const supabase = createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) orgId = user.id;
    } catch {
      // auth failure is non-fatal — continue as anonymous
    }

    const result = await processIngestion(body, { orgId });
    return NextResponse.json(result);
  } catch (err: any) {
    // Hard validation errors (missing model, bad tokens) → 400
    const isValidation = err?.message?.includes("required") || err?.message?.includes("tokens");
    return NextResponse.json(
      { error: err?.message || 'Internal error' },
      { status: isValidation ? 400 : 500 }
    );
  }
}
