import { NextResponse } from "next/server";
import { getUser, getUserOrg } from "@/lib/auth";
import { evaluateRules, generateSuggestions, applyAction } from "@/lib/autopilot-engine";

/**
 * POST /api/autopilot
 *
 * Runs the autopilot advisory layer against a WHY Engine decision.
 * Safe to call without auth — org context is optional.
 *
 * Body: WHY Engine decision object (same shape as /api/analyze response)
 *
 * Response:
 * {
 *   suggestions:      SuggestionObject[]
 *   rules_triggered:  number
 *   rule_results:     { rule_id, rule_name, triggered }[]
 * }
 */
export async function POST(request) {
  let decision;
  try {
    const body = await request.json();
    // Accept both a wrapped { decision } and a bare decision object
    decision = body?.decision ?? body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!decision || typeof decision !== "object") {
    return NextResponse.json({ error: "A decision object is required." }, { status: 400 });
  }

  // ── Optional auth for org-scoped rules ───────────────────────────────
  const user  = await getUser(request);
  const orgId = user ? await getUserOrg(user.id) : null;

  // ── Evaluate rules ───────────────────────────────────────────────────
  const matchedRules = await evaluateRules(decision, orgId);

  // ── Generate suggestions (from decision content) ─────────────────────
  const suggestions = generateSuggestions(decision);

  // ── Apply actions (log each matched rule — advisory only) ────────────
  const ruleResults = [];
  for (const rule of matchedRules) {
    try {
      const result = await applyAction(rule, decision, orgId);
      ruleResults.push({ rule_id: result.rule_id, rule_name: result.rule_name, triggered: true });
    } catch (err) {
      console.error(`[autopilot] rule "${rule.name}" failed:`, err.message);
      ruleResults.push({ rule_id: rule.id, rule_name: rule.name, triggered: false, error: err.message });
    }
  }

  return NextResponse.json({
    suggestions,
    rules_triggered: ruleResults.filter(r => r.triggered).length,
    rule_results:    ruleResults,
    note:            "Autopilot (Advisory Mode) — no automatic changes applied.",
  });
}
