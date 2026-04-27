export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { buildCostIntelligence } from '@/lib/cost-engine';
import { detectCostAnomaly }    from '@/lib/detection-engine';
import { buildContext }          from '@/lib/context-builder';
import { generateWhyDecision }   from '@/lib/why-engine';
import { formatDecisionOutput }  from '@/lib/output-formatter';

/**
 * POST /api/analyze
 *
 * Body: { usage: [{ model: string, tokens: number, cost: number }] }
 *
 * This endpoint is the batch-analysis counterpart to /api/ingest.
 * It runs the full WHY Engine pipeline synchronously on a supplied
 * usage array and returns the formatted decision.
 *
 * Response shape (same as DecisionCard expects):
 *   {
 *     priority, change, why, impact, action[], decision, confidence,
 *     totalCost, estimatedSavings, anomalyType
 *   }
 *
 * "No significant issue" case:
 *   { message: "No significant issue detected" }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const usage: any[] = body?.usage;

    if (!Array.isArray(usage) || usage.length === 0) {
      return NextResponse.json(
        { error: "'usage' must be a non-empty array of { model, tokens, cost } records." },
        { status: 400 }
      );
    }

    // ── 1. Validate each row ─────────────────────────────────────────────
    for (const row of usage) {
      if (!row?.model || typeof row.model !== 'string') {
        return NextResponse.json({ error: "Each row requires a 'model' string." }, { status: 400 });
      }
      const tokens = Number(row.tokens ?? row.input_tokens ?? 0);
      const cost   = Number(row.cost   ?? 0);
      if (!Number.isFinite(tokens) || tokens < 0) {
        return NextResponse.json({ error: `Row for '${row.model}' has invalid tokens.` }, { status: 400 });
      }
      // cost=0 is allowed — we don't auto-calculate here (client sends explicit cost)
      if (!Number.isFinite(cost) || cost < 0) {
        return NextResponse.json({ error: `Row for '${row.model}' has invalid cost.` }, { status: 400 });
      }
    }

    // ── 2. Cost intelligence ─────────────────────────────────────────────
    const costIntelligence = buildCostIntelligence(usage);

    // ── 3. Anomaly detection ─────────────────────────────────────────────
    const anomaly = detectCostAnomaly({
      usage,
      currentCost:  costIntelligence.latestCost,
      previousCost: costIntelligence.previousCost,
      costByModel:  costIntelligence.costByModel,
      totalCost:    costIntelligence.totalCost,
    });

    // ── 4. "No significant issue" early exit ─────────────────────────────
    const COST_THRESHOLD = 0.10; // USD — below this, don't run WHY
    if (!anomaly.isAnomaly && costIntelligence.totalCost < COST_THRESHOLD) {
      return NextResponse.json({ message: 'No significant issue detected' });
    }

    // ── 5. WHY Engine ────────────────────────────────────────────────────
    const ctx = buildContext(costIntelligence, anomaly, usage);
    let whyDecision: any;

    try {
      whyDecision = await generateWhyDecision(ctx);
    } catch (err: any) {
      // WHY engine failed (e.g. missing OPENAI_API_KEY) — use output-formatter
      // with empty why/impact so it builds fallback fields from cost data.
      whyDecision = {
        why:        '',
        impact:     '',
        action:     [],
        decision:   '',
        confidence: '',
      };
    }

    // ── 6. Format output ─────────────────────────────────────────────────
    const formatted = formatDecisionOutput(
      { ...costIntelligence, ...whyDecision },
      anomaly
    );

    return NextResponse.json({
      ...formatted,
      totalCost:        costIntelligence.totalCost,
      estimatedSavings: costIntelligence.estimatedSavings,
      anomalyType:      anomaly.type,
      rankedContributors: costIntelligence.rankedContributors,
    });

  } catch (err: any) {
    console.error('[/api/analyze] error:', err?.message);
    return NextResponse.json({ error: err?.message || 'Analysis failed' }, { status: 500 });
  }
}
