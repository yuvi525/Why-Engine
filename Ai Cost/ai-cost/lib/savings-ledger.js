/**
 * lib/savings-ledger.js
 *
 * SAVINGS LEDGER — Source of Truth for Real Savings
 * ──────────────────────────────────────────────────
 * Every dollar saved by routing, guardrails, or autopilot is recorded here.
 *
 * MATH RULES (non-negotiable):
 *   original_cost  = calculateCost(original_model, input_tokens, output_tokens)
 *   optimized_cost = calculateCost(routed_model,   input_tokens, output_tokens)
 *   savings_usd    = original_cost − optimized_cost
 *
 *   If original_model === routed_model → savings = 0, NO row inserted.
 *   Never insert fake or estimated savings — only insert after real token counts.
 *
 * SOURCE VALUES:
 *   "routing"   — model was downgraded by model-router.js
 *   "guardrail" — request was modified (token clamped) by guardrail
 *   "autopilot" — autopilot applied a config change that reduced spend
 *
 * DB SCHEMA: see SQL block at bottom of this file.
 */

import { calculateCost } from "@/lib/model-pricing";
import { getSupabase }   from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// CORE MATH — pure, no side effects, fully tested
// ─────────────────────────────────────────────────────────────────────────────

/**
 * computeSavings(originalModel, routedModel, inputTokens, outputTokens)
 *
 * Returns exact savings in USD using split input/output pricing.
 * Returns 0 when no routing occurred (originalModel === routedModel).
 * Never throws — returns 0 on any error.
 *
 * @param {string} originalModel  - Model the caller requested
 * @param {string} routedModel    - Model actually used (after routing)
 * @param {number} inputTokens    - Real input token count from upstream response
 * @param {number} outputTokens   - Real output token count from upstream response
 * @returns {number}              - Savings in USD (≥ 0, 8dp precision)
 */
export function computeSavings(originalModel, routedModel, inputTokens, outputTokens) {
  try {
    // No routing occurred → savings = 0, no rounding error, no insert
    if (!originalModel || !routedModel || originalModel === routedModel) return 0;

    // Both token counts must be non-negative integers
    const inp = Math.max(0, Number(inputTokens)  || 0);
    const out = Math.max(0, Number(outputTokens) || 0);

    // No tokens → no cost → no savings
    if (inp === 0 && out === 0) return 0;

    const originalCost  = calculateCost(originalModel, inp, out);
    const optimizedCost = calculateCost(routedModel,   inp, out);

    // Savings can only be ≥ 0 — if for some reason the routed model is more
    // expensive (should not happen with a correct downgrade map), clamp to 0.
    const savings = Math.max(0, Math.round((originalCost - optimizedCost) * 1e8) / 1e8);
    return savings;
  } catch (err) {
    console.error("[savings-ledger] computeSavings error:", err?.message);
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEDGER WRITER — fire-and-forget, never throws
// ─────────────────────────────────────────────────────────────────────────────

/**
 * recordSaving(entry)
 *
 * Inserts one row into savings_logs.
 * Silently skips if savings_usd === 0 (no real saving → no record).
 * Fire-and-forget — never throws, never blocks the caller.
 *
 * @param {object} entry
 * @param {string}  entry.run_id         - FK → ai_usage_logs.id
 * @param {string}  [entry.project_id]
 * @param {string}  [entry.user_id]
 * @param {string}  [entry.feature]
 * @param {string}  entry.original_model
 * @param {string}  entry.routed_model
 * @param {number}  entry.input_tokens
 * @param {number}  entry.output_tokens
 * @param {number}  entry.original_cost   - Cost at original_model rates
 * @param {number}  entry.optimized_cost  - Cost at routed_model rates
 * @param {number}  entry.savings_usd     - original_cost − optimized_cost
 * @param {"routing"|"guardrail"|"autopilot"} entry.source
 */
export async function recordSaving(entry) {
  try {
    // Hard rule: never insert a zero-saving row
    const savings = Number(entry.savings_usd ?? 0);
    if (savings <= 0) return;

    const sb = getSupabase();
    if (!sb) {
      // Demo / local dev without Supabase — log to console only
      console.info(`[savings-ledger] demo_mode | $${savings.toFixed(6)} saved | ${entry.original_model} → ${entry.routed_model} | source=${entry.source}`);
      return;
    }

    const record = {
      run_id:         entry.run_id         || null,
      project_id:     entry.project_id     || null,
      user_id:        entry.user_id        || null,
      feature:        entry.feature        || null,
      original_model: entry.original_model,
      routed_model:   entry.routed_model,
      input_tokens:   Math.max(0, Number(entry.input_tokens)  || 0),
      output_tokens:  Math.max(0, Number(entry.output_tokens) || 0),
      original_cost:  Number(entry.original_cost)  || 0,
      optimized_cost: Number(entry.optimized_cost) || 0,
      savings_usd:    savings,
      source:         ["routing", "guardrail", "autopilot"].includes(entry.source)
                        ? entry.source : "routing",
      // created_at → DEFAULT now()
    };

    const { error } = await sb.from("savings_logs").insert([record]);
    if (error) {
      console.error("[savings-ledger] insert failed:", error.message);
    } else {
      console.info(`[savings-ledger] ✓ saved $${savings.toFixed(6)} | run_id=${entry.run_id} | ${entry.original_model} → ${entry.routed_model}`);
    }
  } catch (err) {
    console.error("[savings-ledger] recordSaving exception:", err?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATION QUERIES
// All return { total, by_source } — never throw, return zeros on error.
// ─────────────────────────────────────────────────────────────────────────────

const ZERO_RESULT = () => ({
  total:      0,
  by_source:  { routing: 0, guardrail: 0, autopilot: 0 },
  call_count: 0,
});

/**
 * _aggregate(filter)
 * Internal helper — runs the Supabase query with optional date/project filters.
 */
async function _aggregate({ project_id = null, from_date = null, to_date = null } = {}) {
  try {
    const sb = getSupabase();
    if (!sb) return ZERO_RESULT();

    let q = sb.from("savings_logs").select("savings_usd, source");

    if (project_id) q = q.eq("project_id", project_id);
    if (from_date)  q = q.gte("created_at", from_date);
    if (to_date)    q = q.lte("created_at", to_date);

    const { data, error } = await q;
    if (error) {
      console.error("[savings-ledger] aggregate query error:", error.message);
      return ZERO_RESULT();
    }
    if (!data?.length) return ZERO_RESULT();

    const by_source = { routing: 0, guardrail: 0, autopilot: 0 };
    let total = 0;

    for (const row of data) {
      const s = Math.max(0, Number(row.savings_usd) || 0);
      total += s;
      if (by_source[row.source] !== undefined) by_source[row.source] += s;
    }

    // Round to 6dp for display — internal precision is 8dp in DB
    total              = Math.round(total              * 1e6) / 1e6;
    by_source.routing  = Math.round(by_source.routing  * 1e6) / 1e6;
    by_source.guardrail = Math.round(by_source.guardrail * 1e6) / 1e6;
    by_source.autopilot = Math.round(by_source.autopilot * 1e6) / 1e6;

    return { total, by_source, call_count: data.length };
  } catch (err) {
    console.error("[savings-ledger] _aggregate exception:", err?.message);
    return ZERO_RESULT();
  }
}

/**
 * getDailySavings(project_id?)
 * Savings since midnight UTC today.
 */
export async function getDailySavings(project_id = null) {
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  return _aggregate({ project_id, from_date: from.toISOString() });
}

/**
 * getMonthlySavings(project_id?)
 * Savings since the 1st of the current UTC month.
 */
export async function getMonthlySavings(project_id = null) {
  const from = new Date();
  from.setUTCDate(1);
  from.setUTCHours(0, 0, 0, 0);
  return _aggregate({ project_id, from_date: from.toISOString() });
}

/**
 * getTotalSavings(project_id?)
 * All-time savings for the project (or global).
 */
export async function getTotalSavings(project_id = null) {
  return _aggregate({ project_id });
}

/**
 * getSavingsSummary(project_id?)
 *
 * Convenience wrapper — returns daily, monthly, and total in one call.
 * Used by the dashboard API endpoint.
 *
 * @returns {{ daily, monthly, total }}
 */
export async function getSavingsSummary(project_id = null) {
  const [daily, monthly, total] = await Promise.all([
    getDailySavings(project_id),
    getMonthlySavings(project_id),
    getTotalSavings(project_id),
  ]);
  return { daily, monthly, total };
}

/*
 * ═══════════════════════════════════════════════════════════════════
 * SUPABASE MIGRATION — run once
 * ═══════════════════════════════════════════════════════════════════
 *
 * CREATE TABLE IF NOT EXISTS savings_logs (
 *   id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *
 *   -- Traceability
 *   run_id          uuid REFERENCES ai_usage_logs(id) ON DELETE SET NULL,
 *   project_id      text,
 *   user_id         text,
 *   feature         text,
 *
 *   -- Exact model identifiers
 *   original_model  text NOT NULL,
 *   routed_model    text NOT NULL,
 *
 *   -- Token counts (from real upstream response, never estimated)
 *   input_tokens    integer NOT NULL DEFAULT 0,
 *   output_tokens   integer NOT NULL DEFAULT 0,
 *
 *   -- Cost math (USD, 8dp)
 *   original_cost   numeric(14,8) NOT NULL DEFAULT 0,
 *   optimized_cost  numeric(14,8) NOT NULL DEFAULT 0,
 *   savings_usd     numeric(14,8) NOT NULL DEFAULT 0,
 *
 *   -- Source classification
 *   source          text NOT NULL
 *                   CHECK (source IN ('routing','guardrail','autopilot')),
 *
 *   created_at      timestamptz DEFAULT now()
 * );
 *
 * -- Fast aggregation queries
 * CREATE INDEX ON savings_logs (project_id, created_at DESC);
 * CREATE INDEX ON savings_logs (user_id,    created_at DESC);
 * CREATE INDEX ON savings_logs (source,     created_at DESC);
 * CREATE INDEX ON savings_logs (run_id);
 *
 * -- Partial index: only rows with positive savings (all rows, by design)
 * CREATE INDEX ON savings_logs (created_at DESC) WHERE savings_usd > 0;
 *
 * ═══════════════════════════════════════════════════════════════════
 */
