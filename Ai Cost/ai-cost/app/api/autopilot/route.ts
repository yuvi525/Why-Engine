export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { generateSuggestions, evaluateRules, applyAction } from '@/lib/autopilot-engine';

/**
 * POST /api/autopilot
 * Body: { decision: object, orgId?: string }
 * Returns: { suggestions[], rules_triggered, rule_results[], note }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { decision, orgId = null } = body || {};

    if (!decision) {
      return NextResponse.json({ error: 'Missing decision payload' }, { status: 400 });
    }

    // 1 — Generate suggestions from the WHY Engine decision
    const suggestions = generateSuggestions(decision);

    // 2 — Evaluate rules (falls back to default rules when no DB / org)
    const matchedRules = await evaluateRules(decision, orgId);

    // 3 — Apply each matched rule (advisory only — no external mutations)
    const rule_results = await Promise.all(
      matchedRules.map((rule) => applyAction(rule, decision, orgId))
    );

    return NextResponse.json({
      suggestions,
      rules_triggered: matchedRules.length,
      rule_results,
      note: 'Advisory mode — no changes applied automatically.',
    });
  } catch (err: any) {
    console.error('[/api/autopilot] error:', err?.message);
    return NextResponse.json({ error: 'Internal error', suggestions: [], rules_triggered: 0, rule_results: [] }, { status: 500 });
  }
}
