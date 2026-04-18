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
