/**
 * lib/autopilot-engine.js
 *
 * Advisory autopilot for WHY Engine.
 *
 * SAFETY GUARANTEE: This engine NEVER executes changes automatically.
 * Every action is logged and returned as a suggestion for human review.
 *
 * SQL (run once in Supabase):
 * ─────────────────────────────────────────────────────────────────
 * CREATE TABLE IF NOT EXISTS autopilot_rules (
 *   id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   org_id       uuid,
 *   name         text NOT NULL,
 *   trigger_type text NOT NULL,  -- 'anomaly' | 'cost_threshold'
 *   action_type  text NOT NULL,  -- 'notify' | 'suggest_optimization'
 *   config       jsonb DEFAULT '{}',
 *   enabled      boolean DEFAULT false,
 *   created_at   timestamptz DEFAULT now()
 * );
 *
 * CREATE TABLE IF NOT EXISTS autopilot_log (
 *   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   org_id     uuid,
 *   action     text NOT NULL,
 *   details    jsonb DEFAULT '{}',
 *   created_at timestamptz DEFAULT now()
 * );
 *
 * CREATE INDEX ON autopilot_rules (org_id, enabled);
 * CREATE INDEX ON autopilot_log   (org_id, created_at DESC);
 * ─────────────────────────────────────────────────────────────────
 */

import { DOMAINS } from "@/lib/domains";

// ── Lazy Supabase ─────────────────────────────────────────────────────────
let _sb = null;
function getSupabase() {
  if (_sb) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require("@supabase/supabase-js");
  _sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return _sb;
}

// ── Suggestion types ──────────────────────────────────────────────────────
export const SUGGESTION_TYPES = {
  MODEL_MIGRATION:       "model_migration",
  PROMPT_OPTIMIZATION:   "prompt_optimization",
  WORKFLOW_REVIEW:       "workflow_review",
  ROUTING_OPTIMIZATION:  "routing_optimization",
  COST_MONITORING:       "cost_monitoring",
};

// ── Default rules seeded for new orgs ────────────────────────────────────
export const DEFAULT_RULES = [
  {
    name:         "Cost Spike Alert",
    trigger_type: "anomaly",
    action_type:  "suggest_optimization",
    config:       { anomaly_type: "cost_spike" },
    enabled:      true,
  },
  {
    name:         "Model Overuse Detection",
    trigger_type: "anomaly",
    action_type:  "suggest_optimization",
    config:       { anomaly_type: "model_overuse" },
    enabled:      true,
  },
  {
    name:         "High Cost Threshold",
    trigger_type: "cost_threshold",
    action_type:  "suggest_optimization",
    config:       { threshold: 0.5 },
    enabled:      true,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// generateSuggestions(decision)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Converts a WHY Engine decision into structured optimization suggestions.
 * Parses action strings, anomaly type, and cost data.
 *
 * @param {object} decision - Formatted decision from formatDecisionOutput + pipeline meta
 * @returns {Array<object>} Structured suggestion objects
 */
export function generateSuggestions(decision) {
  const {
    priority, action = [], anomalyType,
    totalCost = 0, estimatedSavings = 0, confidence = "72%",
  } = decision || {};

  const suggestions = [];

  // ── 1. Parse action strings for model migration suggestions ───────────
  const migrationRegex = /switch\s+(\S+)\s*[→\->]+\s*(\S+)/i;
  const savingsRegex   = /~?\$(\d+(?:\.\d+)?)/;

  for (const act of (Array.isArray(action) ? action : [])) {
    const migMatch = String(act).match(migrationRegex);
    if (migMatch) {
      const [, modelFrom, modelTo] = migMatch;
      const savingsMatch   = String(act).match(savingsRegex);
      const monthlySavings = savingsMatch ? parseFloat(savingsMatch[1]) : estimatedSavings;

      suggestions.push({
        id:                    `migration-${modelFrom}-${modelTo}`,
        type:                  SUGGESTION_TYPES.MODEL_MIGRATION,
        priority:              "HIGH",
        title:                 `Switch ${modelFrom} → ${modelTo}`,
        detail:                String(act),
        estimatedMonthlySavings: monthlySavings,
        confidence,
        model_from:            modelFrom,
        model_to:              modelTo,
        manual_action:         `Update your model config from "${modelFrom}" to "${modelTo}" for non-critical tasks.`,
      });
    }
  }

  // ── 2. Anomaly-specific insights ──────────────────────────────────────
  if (anomalyType === "cost_spike") {
    suggestions.push({
      id:                    "cost-spike-review",
      type:                  SUGGESTION_TYPES.WORKFLOW_REVIEW,
      priority:              "MEDIUM",
      title:                 "Audit recent prompt template changes",
      detail:                "A cost spike was detected. Review prompt templates, input data size, or system prompt updates that may have increased token count unexpectedly.",
      estimatedMonthlySavings: null,
      confidence,
      manual_action:         "Compare your last 5 prompt versions and identify which change caused the spike.",
    });
  }

  if (anomalyType === "model_overuse") {
    suggestions.push({
      id:                    "model-overuse-routing",
      type:                  SUGGESTION_TYPES.ROUTING_OPTIMIZATION,
      priority:              priority || "HIGH",
      title:                 "Implement task-based model routing",
      detail:                "One model dominates spend. Route simple/repetitive tasks to a cheaper model and reserve the expensive model for complex reasoning only.",
      estimatedMonthlySavings: estimatedSavings > 0 ? estimatedSavings * 300 : null,
      confidence,
      manual_action:         "Add a routing layer: classify task complexity before sending to an LLM, then route accordingly.",
    });
  }

  if (anomalyType === "mix_change") {
    suggestions.push({
      id:                    "mix-change-audit",
      type:                  SUGGESTION_TYPES.COST_MONITORING,
      priority:              "MEDIUM",
      title:                 "Review model mix shift",
      detail:                "Your usage pattern shifted to higher-cost models. Confirm this change was intentional and set up budget alerts.",
      estimatedMonthlySavings: null,
      confidence,
      manual_action:         "Set a monthly cost alert in your AI provider dashboard for early detection.",
    });
  }

  // ── 3. Prompt optimization for high token usage ───────────────────────
  if (totalCost > 0.5 && !suggestions.find(s => s.type === SUGGESTION_TYPES.PROMPT_OPTIMIZATION)) {
    const promptSavingsEstimate = parseFloat((totalCost * 0.15 * 300).toFixed(2));
    suggestions.push({
      id:                    "prompt-optimization",
      type:                  SUGGESTION_TYPES.PROMPT_OPTIMIZATION,
      priority:              "LOW",
      title:                 "Reduce token count via prompt compression",
      detail:                "High total spend detected. Optimizing prompt templates to remove redundancy typically reduces token usage by 10–20%, with no quality impact.",
      estimatedMonthlySavings: promptSavingsEstimate,
      confidence:            "65%",
      manual_action:         "Use a prompt compression library (e.g. LLMLingua) or manually audit system prompts for repetition.",
    });
  }

  return suggestions;
}

// ─────────────────────────────────────────────────────────────────────────
// evaluateRules(decision, orgId)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Fetches enabled rules for the org and matches them against the decision.
 * Falls back to default rules if DB is not configured.
 *
 * @param {object} decision - WHY Engine decision
 * @param {string|null} orgId
 * @returns {Promise<Array>} Matched rule objects
 */
export async function evaluateRules(decision, orgId) {
  let rules = [];

  const sb = getSupabase();
  if (sb && orgId) {
    const { data, error } = await sb
      .from("autopilot_rules")
      .select("*")
      .eq("org_id", orgId)
      .eq("enabled", true);

    if (error) console.error("[autopilot-engine] fetch rules failed:", error.message);
    rules = data || [];
  }

  // No DB / no org → use default rules as a baseline
  if (!rules.length) {
    rules = DEFAULT_RULES.map((r, i) => ({ ...r, id: `default-${i}` }));
  }

  // Match rules against decision
  const totalCost   = Number(decision?.totalCost   || 0);
  const anomalyType = String(decision?.anomalyType || "");

  return rules.filter(rule => {
    const config = rule.config || {};

    if (rule.trigger_type === "anomaly") {
      // Matches if any anomaly exists, or specific type if configured
      if (!anomalyType) return false;
      if (config.anomaly_type && config.anomaly_type !== anomalyType) return false;
      return true;
    }

    if (rule.trigger_type === "cost_threshold") {
      const threshold = Number(config.threshold ?? 0.5);
      return totalCost >= threshold;
    }

    return false;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// applyAction(rule, decision, orgId)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Logs that a rule triggered and returns the generated suggestions.
 * NEVER modifies external systems — advisory only.
 *
 * @param {object} rule      - Matched rule object
 * @param {object} decision  - WHY Engine decision
 * @param {string|null} orgId
 * @returns {object}         - { rule_id, rule_name, triggered, suggestions }
 */
export async function applyAction(rule, decision, orgId) {
  const suggestions = generateSuggestions(decision);

  // Fire-and-forget log
  logAction(orgId, `rule_triggered:${rule.name}`, {
    rule_id:           rule.id,
    trigger_type:      rule.trigger_type,
    action_type:       rule.action_type,
    decision_priority: decision?.priority,
    anomaly_type:      decision?.anomalyType,
    total_cost:        decision?.totalCost,
    suggestions_count: suggestions.length,
  });

  return {
    rule_id:     rule.id,
    rule_name:   rule.name,
    triggered:   true,
    suggestions,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// logAction(orgId, action, details) — fire-and-forget
// ─────────────────────────────────────────────────────────────────────────
export function logAction(orgId, action, details = {}) {
  const sb = getSupabase();
  if (!sb) return;

  sb.from("autopilot_log")
    .insert([{ org_id: orgId || null, action, details }])
    .then(({ error }) => {
      if (error) console.error("[autopilot-engine] logAction failed:", error.message);
    });
}

// ─────────────────────────────────────────────────────────────────────────
// seedDefaultRules(orgId) — called on first org setup
// ─────────────────────────────────────────────────────────────────────────
/**
 * Inserts default rules for a new org (idempotent via unique constraint).
 * @param {string} orgId
 */
export async function seedDefaultRules(orgId) {
  const sb = getSupabase();
  if (!sb || !orgId) return;

  const rows = DEFAULT_RULES.map(r => ({ ...r, org_id: orgId }));
  const { error } = await sb.from("autopilot_rules").upsert(rows, { onConflict: "org_id,name" });
  if (error) console.error("[autopilot-engine] seedDefaultRules failed:", error.message);
}

// ─────────────────────────────────────────────────────────────────────────
// EXECUTION LAYER — driven by decision-engine.js output
// ─────────────────────────────────────────────────────────────────────────
//
// runDecision(decision) is the bridge between decision-engine.js and the
// autopilot engine.
//
// SAFETY CONTRACT:
//   - AWS and Stripe decisions are NEVER executed — always pending approval.
//   - All AI execution is SIMULATED (console log only, no real API call).
//   - No external writes happen inside this function.
//   - Never throws — all errors produce a "failed" status log entry.
//
// INPUT  (from makeDecision() in lib/decision-engine.js):
// {
//   auto_executable:   boolean
//   requires_approval: boolean
//   domain:            "ai_cost" | "aws_cost" | "stripe_revenue"
//   action_type:       string
//   priority:          "HIGH" | "MEDIUM" | "LOW"
//   confidence_pct:    number
//   reasoning:         string
// }
//
// OUTPUT (log record):
// {
//   action:      string   — human-readable description of what happened
//   status:      "executed" | "pending" | "failed"
//   timestamp:   string   — ISO-8601
//   domain:      string
//   action_type: string
//   details:     object   — simulation output or approval context
// }
// ─────────────────────────────────────────────────────────────────────────

/**
 * BLOCKED_DOMAINS
 *
 * These domains must NEVER reach the execution path.
 * Any decision with these domains is immediately marked pending.
 */
const BLOCKED_DOMAINS = new Set([DOMAINS.AWS, DOMAINS.STRIPE]);

// ── Simulation handlers ───────────────────────────────────────────────────
// Each handler receives the decision object and returns a details object
// describing what the simulated execution would do.

/**
 * simulateModelDowngrade(decision)
 *
 * Simulates routing cheaper model for non-critical tasks.
 * Extracts model names from reasoning/action strings — purely in-memory.
 */
function simulateModelDowngrade(decision) {
  // Extract candidate model names from reasoning text
  const text       = String(decision?.reasoning || "");
  const modelRegex = /gpt-4o(?:-mini)?|claude-[\w.-]+|gemini-[\w.-]+|llama-[\w.-]+/gi;
  const found      = text.match(modelRegex) || [];

  const fromModel = found.find(m => !m.includes("mini") && !m.includes("haiku") && !m.includes("flash"))
    || "gpt-4o";
  const toModel   = found.find(m => m.includes("mini") || m.includes("haiku") || m.includes("flash"))
    || "gpt-4o-mini";

  const simulatedResult = {
    simulated:         true,
    from_model:        fromModel,
    to_model:          toModel,
    confidence_pct:    decision?.confidence_pct ?? 0,
    note:              `[SIMULATED] Model routing updated: ${fromModel} → ${toModel} for tasks with complexity_score < 0.7.`,
    real_action_required: `Update model config in your codebase: set model="${toModel}" for low-complexity task paths.`,
  };

  console.info("[autopilot-engine] SIMULATED model downgrade:", simulatedResult.note);
  return simulatedResult;
}

/**
 * simulateBudgetCap(decision)
 *
 * Logs a budget cap advisory — no external system modified.
 */
function simulateBudgetCap(decision) {
  const simulatedResult = {
    simulated:            true,
    cap_usd:              0.50,   // default advisory cap
    priority:             decision?.priority || "LOW",
    note:                 "[SIMULATED] Budget cap advisory logged: alert will fire when per-run cost exceeds $0.50.",
    real_action_required: "Set a cost alert in your AI provider dashboard or add a pre-flight cost check in your ingestion pipeline.",
  };

  console.info("[autopilot-engine] SIMULATED budget cap advisory:", simulatedResult.note);
  return simulatedResult;
}

/**
 * EXECUTION_HANDLERS
 *
 * Maps action_type → simulation function.
 * Only action types explicitly listed here are eligible for execution.
 * All others fall through to the pending path.
 */
const EXECUTION_HANDLERS = {
  model_downgrade:    simulateModelDowngrade,
  budget_cap:         simulateBudgetCap,
  cost_reduction:     simulateBudgetCap,   // cost_reduction maps to budget advisory
};

// ── Public API ────────────────────────────────────────────────────────────

/**
 * runDecision(decision)
 *
 * Main execution entry point. Reads a decision from makeDecision() and
 * either simulates execution (safe AI actions) or marks pending (everything else).
 *
 * @param   {object} decision  - Output from makeDecision() in decision-engine.js
 * @returns {object}           - Log record { action, status, timestamp, domain, action_type, details }
 */
export function runDecision(decision) {
  const timestamp   = new Date().toISOString();
  const domain      = String(decision?.domain      || DOMAINS.AI);
  const actionType  = String(decision?.action_type || "generic_optimization");
  const autoExec    = Boolean(decision?.auto_executable);
  const reqApproval = Boolean(decision?.requires_approval);

  try {
    // ── Safety gate 1: blocked domains ──────────────────────────────────
    if (BLOCKED_DOMAINS.has(domain)) {
      const log = {
        action:      `${domain}:${actionType} — blocked; requires human review`,
        status:      "pending",
        timestamp,
        domain,
        action_type: actionType,
        details: {
          reason:        `Domain "${domain}" is not eligible for auto-execution.`,
          requires_approval: true,
          decision_priority: decision?.priority || "LOW",
        },
      };
      console.info(`[autopilot-engine] PENDING (blocked domain): ${domain}:${actionType}`);
      logAction(null, `autopilot:pending:${actionType}`, log.details);
      return log;
    }

    // ── Safety gate 2: not auto-executable or approval needed ───────────
    if (!autoExec || reqApproval) {
      const log = {
        action:      `${domain}:${actionType} — awaiting approval`,
        status:      "pending",
        timestamp,
        domain,
        action_type: actionType,
        details: {
          reason:            !autoExec
            ? "Decision is not marked auto_executable."
            : "Decision requires human approval.",
          requires_approval: true,
          confidence_pct:    decision?.confidence_pct ?? 0,
          reasoning:         decision?.reasoning || "",
        },
      };
      console.info(`[autopilot-engine] PENDING: ${domain}:${actionType} — ${log.details.reason}`);
      logAction(null, `autopilot:pending:${actionType}`, log.details);
      return log;
    }

    // ── Execute (simulation only) ────────────────────────────────────────
    const handler = EXECUTION_HANDLERS[actionType];
    if (!handler) {
      // Known AI domain but no handler registered — still safe to pend
      const log = {
        action:      `${domain}:${actionType} — no handler registered`,
        status:      "pending",
        timestamp,
        domain,
        action_type: actionType,
        details: {
          reason: `No simulation handler for action_type "${actionType}". Add to EXECUTION_HANDLERS to enable.`,
          requires_approval: true,
        },
      };
      console.warn(`[autopilot-engine] No handler for action_type="${actionType}" — marked pending`);
      logAction(null, `autopilot:pending:${actionType}`, log.details);
      return log;
    }

    // Run the simulation
    const simulationDetails = handler(decision);

    const log = {
      action:      `${domain}:${actionType} — executed (simulated)`,
      status:      "executed",
      timestamp,
      domain,
      action_type: actionType,
      details:     simulationDetails,
    };

    console.info(`[autopilot-engine] EXECUTED (simulated): ${domain}:${actionType}`);
    logAction(null, `autopilot:executed:${actionType}`, simulationDetails);
    return log;

  } catch (err) {
    // Never crash the caller
    console.error("[autopilot-engine] runDecision error:", err?.message);
    return {
      action:      `${domain}:${actionType} — execution error`,
      status:      "failed",
      timestamp,
      domain,
      action_type: actionType,
      details: {
        error:   err?.message || "unknown error",
        note:    "Safe fallback applied — no changes made.",
      },
    };
  }
}
