/**
 * lib/proxy-why-bridge.js
 *
 * PROXY → WHY ENGINE BRIDGE
 * ─────────────────────────
 * Connects the LLM proxy data plane to the WHY reasoning engine.
 *
 * DESIGN PRINCIPLES:
 *   • Completely isolated — does NOT modify why-engine.js or output-formatter.js
 *   • Called fire-and-forget from the proxy after every successful request
 *   • Only runs WHY analysis on IMPORTANT EVENTS (trigger gate)
 *   • DB failure or WHY failure never affects the caller's response
 *   • Minimal context construction — only what why-engine.js needs
 *
 * TRIGGER CONDITIONS (any one is sufficient):
 *   1. cost_spike     — this call cost > SPIKE_THRESHOLD × running average
 *   2. routing_event  — model was downgraded by the router (was_routed=true)
 *   3. budget_warning — cost_usd > BUDGET_WARNING_FRACTION of session budget
 *
 * WHY ENGINE CONTRACT (never change these):
 *   Input:  context object matching buildWhyPrompt() expectations
 *   Output: { why, impact, action, decision, confidence }
 *
 * DB SCHEMA (why_logs):
 *   See SQL comment at bottom of this file.
 */

import { generateWhyDecision }  from "@/lib/why-engine";
import { formatDecisionOutput } from "@/lib/output-formatter";
import { getSupabase }          from "@/lib/db";
import { runAutopilot, AUTOPILOT_MODES } from "@/lib/autopilot";

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum cost in USD for a call to be worth analysing. Below this = noise. */
const MIN_COST_USD = 0.001;

/**
 * A call is a spike when its cost is ≥ this multiple of the session average.
 * 2.0 = cost was at least 2× the average of prior calls in this session.
 */
const SPIKE_RATIO_THRESHOLD = 2.0;

/**
 * Trigger WHY when call_cost ≥ this fraction of the session's total budget.
 * 0.20 = call consumed ≥ 20% of the budget in a single request.
 */
const BUDGET_WARNING_FRACTION = 0.20;

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER GATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * shouldTriggerWhy(event)
 *
 * Pure function — determines whether a proxy call event warrants a WHY analysis.
 * Returns { triggered: boolean, reason: string|null }.
 *
 * @param {object} event
 * @param {number}  event.cost_usd          - This call's cost
 * @param {number}  [event.session_avg_cost] - Running avg cost per call in session
 * @param {boolean} [event.was_routed]       - Router downgraded the model
 * @param {number}  [event.session_budget]   - Optional per-session budget cap
 * @returns {{ triggered: boolean, reason: string|null }}
 */
export function shouldTriggerWhy(event = {}) {
  const {
    cost_usd         = 0,
    session_avg_cost = 0,
    was_routed       = false,
    session_budget   = null,
  } = event;

  // Never waste a WHY call on negligible spend
  if (cost_usd < MIN_COST_USD) {
    return { triggered: false, reason: null };
  }

  // Trigger 1 — ROUTING EVENT: router decided this model needed downgrading
  if (was_routed) {
    return { triggered: true, reason: "routing_event" };
  }

  // Trigger 2 — COST SPIKE: this call cost >> session average
  if (session_avg_cost > 0 && cost_usd >= session_avg_cost * SPIKE_RATIO_THRESHOLD) {
    return { triggered: true, reason: "cost_spike" };
  }

  // Trigger 3 — BUDGET WARNING: single call ate a large chunk of the budget
  if (session_budget > 0 && cost_usd >= session_budget * BUDGET_WARNING_FRACTION) {
    return { triggered: true, reason: "budget_warning" };
  }

  return { triggered: false, reason: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildWhyContext(proxyEvent)
 *
 * Converts a proxy event into the context shape that generateWhyDecision()
 * and formatDecisionOutput() expect. Values are derived from what the proxy
 * already has — no extra DB reads needed.
 *
 * Context shape is deliberately compatible with the existing WHY engine prompt
 * (see buildWhyPrompt in why-engine.js lines 70-214).
 *
 * @param {object} proxyEvent - Full proxy request/response telemetry
 * @returns {object} context
 */
function buildWhyContext(proxyEvent) {
  const {
    model,
    original_model,
    routed_model,
    input_tokens     = 0,
    output_tokens    = 0,
    total_tokens     = 0,
    cost_usd         = 0,
    savings_usd      = 0,
    session_avg_cost = 0,
    feature          = null,
    trigger_reason,
  } = proxyEvent;

  const effectiveModel = routed_model || model;
  const requestedModel = original_model || model;
  const pctChange = session_avg_cost > 0
    ? ((cost_usd - session_avg_cost) / session_avg_cost) * 100
    : 0;

  // Map trigger reason to anomaly type (matching detection-engine vocabulary)
  const anomalyTypeMap = {
    cost_spike:     "cost_spike",
    routing_event:  "model_overuse",
    budget_warning: "cost_spike",
  };
  const anomalyType = anomalyTypeMap[trigger_reason] || "model_overuse";

  return {
    // ── Anomaly classification ────────────────────────────────────────────
    anomalyType,

    // ── Top driver (the expensive model that was requested) ───────────────
    topDriver: {
      model:        requestedModel,
      reason:       `routed to ${effectiveModel} by proxy router`,
      share:        100, // single-call context — the requested model is 100% of this call
      totalTokens:  total_tokens,
      requestCount: 1,
    },

    // ── Suggested optimization ────────────────────────────────────────────
    suggestedOptimization: {
      from:    requestedModel,
      to:      effectiveModel !== requestedModel ? effectiveModel : "gpt-4o-mini",
      savings: savings_usd,
    },

    // ── Cost summary ──────────────────────────────────────────────────────
    summary: {
      currentCost:      cost_usd,
      previousCost:     session_avg_cost,
      percentageChange: pctChange,
    },

    // ── Ranked contributors (single-call — one entry) ─────────────────────
    rankedContributors: [{
      model:           requestedModel,
      percentage:      100,
      totalTokens:     total_tokens,
      requestCount:    1,
      estimatedSavings: savings_usd,
      suggestedModel:  effectiveModel !== requestedModel ? effectiveModel : "gpt-4o-mini",
    }],

    // ── Cost engine fields (used by formatDecisionOutput) ─────────────────
    latestCost:       cost_usd,
    previousCost:     session_avg_cost,
    estimatedSavings: savings_usd,
    growthPercentage: pctChange,
    highestCostModel: { model: requestedModel },
    suggestedModel:   effectiveModel !== requestedModel ? effectiveModel : "gpt-4o-mini",

    // ── Spike context (for cost_spike anomaly type) ───────────────────────
    spike: trigger_reason === "cost_spike" ? {
      ratio:         session_avg_cost > 0 ? cost_usd / session_avg_cost : 1,
      historicalAvg: session_avg_cost,
    } : null,

    // ── Raw telemetry (for audit trail) ──────────────────────────────────
    _meta: {
      trigger_reason,
      feature,
      input_tokens,
      output_tokens,
      total_tokens,
      cost_usd,
      savings_usd,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DB WRITER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * persistWhyLog(runId, proxyEvent, whyOutput, formattedOutput)
 *
 * Writes the WHY analysis result to why_logs, linked to ai_usage_logs via run_id.
 * Fire-and-forget — never throws.
 */
async function persistWhyLog(runId, proxyEvent, whyOutput, formattedOutput) {
  try {
    const sb = getSupabase();
    if (!sb) return; // demo mode

    const record = {
      run_id:         runId,                                        // FK → ai_usage_logs.id
      user_id:        proxyEvent.user_id    || null,
      project_id:     proxyEvent.project_id || null,
      feature:        proxyEvent.feature    || null,
      model:          proxyEvent.model,
      original_model: proxyEvent.original_model || proxyEvent.model,
      trigger_reason: proxyEvent.trigger_reason,
      // ── WHY engine raw output ──────────────────────────────────────────
      why:            whyOutput.why        || null,
      impact:         whyOutput.impact     || null,
      action:         whyOutput.action     || [],       // stored as jsonb
      decision:       whyOutput.decision   || null,
      confidence:     whyOutput.confidence || null,
      // ── Formatter-enriched output ─────────────────────────────────────
      priority:       formattedOutput.priority   || null,
      change_summary: formattedOutput.change     || null,
      // ── Cost telemetry snapshot ───────────────────────────────────────
      cost_usd:       proxyEvent.cost_usd    || 0,
      savings_usd:    proxyEvent.savings_usd || 0,
      input_tokens:   proxyEvent.input_tokens  || 0,
      output_tokens:  proxyEvent.output_tokens || 0,
      // created_at → DEFAULT now()
    };

    const { error } = await sb.from("why_logs").insert([record]);
    if (error) console.error("[proxy-why-bridge] why_logs insert failed:", error.message);
    else       console.info(`[proxy-why-bridge] WHY logged | run_id=${runId} | trigger=${proxyEvent.trigger_reason} | priority=${formattedOutput.priority}`);
  } catch (err) {
    console.error("[proxy-why-bridge] persistWhyLog exception:", err?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN BRIDGE — called from proxy, fire-and-forget
// ─────────────────────────────────────────────────────────────────────────────

/**
 * maybeRunWhy(runId, proxyEvent)
 *
 * THE ONLY FUNCTION THE PROXY CALLS.
 *
 * 1. Checks trigger gate — exits immediately if not triggered
 * 2. Builds context from proxy telemetry
 * 3. Calls generateWhyDecision() — the unmodified WHY engine
 * 4. Calls formatDecisionOutput() — the unmodified formatter
 * 5. Persists to why_logs with run_id linking to ai_usage_logs
 *
 * Completely fire-and-forget — catches all errors, never throws.
 *
 * @param {string} runId       - The ai_usage_logs row ID for this call
 * @param {object} proxyEvent  - Full proxy telemetry (see below)
 *
 * proxyEvent fields:
 *   model, original_model, routed_model,
 *   input_tokens, output_tokens, total_tokens,
 *   cost_usd, savings_usd,
 *   session_avg_cost, session_budget,
 *   was_routed, feature, user_id, project_id
 */
export async function maybeRunWhy(runId, proxyEvent = {}) {
  try {
    // ── 1. Trigger gate ───────────────────────────────────────────────────
    const { triggered, reason } = shouldTriggerWhy(proxyEvent);
    if (!triggered) return;

    const event = { ...proxyEvent, trigger_reason: reason };

    console.info(`[proxy-why-bridge] WHY triggered | run_id=${runId} | reason=${reason}`);

    // ── 2. Build context ──────────────────────────────────────────────────
    const context = buildWhyContext(event);

    // ── 3. Call WHY engine (unmodified) ──────────────────────────────────
    const whyOutput = await generateWhyDecision(context);

    // ── 4. Format output (unmodified formatter) ───────────────────────────
    // Construct a minimal anomaly object matching formatDecisionOutput() contract
    const anomaly = {
      type:     context.anomalyType,
      ratio:    context.spike?.ratio    ?? 1,
      severity: reason === "cost_spike" ? "high" : "medium",
    };
    const formattedOutput = formatDecisionOutput(
      { ...context, ...whyOutput },
      anomaly
    );

    // ── 5. Persist WHY to DB ──────────────────────────────────────────────
    await persistWhyLog(runId, event, whyOutput, formattedOutput);

    // ── 6. AUTOPILOT — fire-and-forget, reads mode from env ───────────────
    // Default: "recommend" — logs what it would do, never executes.
    // Set AUTOPILOT_MODE="auto_safe" in .env.local to enable execution.
    // Set AUTOPILOT_MODE="off"       to disable completely.
    const autopilotMode = process.env.AUTOPILOT_MODE ?? AUTOPILOT_MODES.RECOMMEND;
    runAutopilot(
      runId,                  // reused as why_log_id link key
      {                       // merged WHY output: formatter fields + raw confidence
        ...formattedOutput,
        confidence: whyOutput.confidence ?? formattedOutput.confidence,
      },
      { ...event, run_id: runId },
      { mode: autopilotMode },
    );

  } catch (err) {
    // Never crash the proxy — WHY analysis is best-effort
    console.error("[proxy-why-bridge] maybeRunWhy exception:", err?.message);
  }
}

/*
 * ═══════════════════════════════════════════════════════════════════
 * SUPABASE MIGRATION — run once
 * ═══════════════════════════════════════════════════════════════════
 *
 * -- why_logs: stores WHY engine output linked to each proxy call
 * CREATE TABLE IF NOT EXISTS why_logs (
 *   id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *
 *   -- Link to the originating proxy call
 *   run_id         uuid REFERENCES ai_usage_logs(id) ON DELETE SET NULL,
 *
 *   -- Request metadata
 *   user_id        text,
 *   project_id     text,
 *   feature        text,
 *   model          text NOT NULL,           -- effective (routed) model
 *   original_model text,                    -- what the caller asked for
 *   trigger_reason text,                    -- "cost_spike" | "routing_event" | "budget_warning"
 *
 *   -- WHY engine output
 *   why            text,
 *   impact         text,
 *   action         jsonb DEFAULT '[]',      -- string[]
 *   decision       text,
 *   confidence     text,
 *
 *   -- Formatter output
 *   priority       text,                    -- "HIGH" | "MEDIUM" | "LOW"
 *   change_summary text,
 *
 *   -- Cost snapshot at time of analysis
 *   cost_usd       numeric(12,8) DEFAULT 0,
 *   savings_usd    numeric(12,8) DEFAULT 0,
 *   input_tokens   integer DEFAULT 0,
 *   output_tokens  integer DEFAULT 0,
 *
 *   created_at     timestamptz DEFAULT now()
 * );
 *
 * CREATE INDEX ON why_logs (run_id);
 * CREATE INDEX ON why_logs (user_id, created_at DESC);
 * CREATE INDEX ON why_logs (project_id, created_at DESC);
 * CREATE INDEX ON why_logs (trigger_reason, created_at DESC);
 * CREATE INDEX ON why_logs (priority, created_at DESC);
 *
 * -- Allow ai_usage_logs.id to be referenced:
 * -- (only needed if ai_usage_logs.id is not already a PK with gen_random_uuid)
 * -- ALTER TABLE ai_usage_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
 *
 * ═══════════════════════════════════════════════════════════════════
 */
