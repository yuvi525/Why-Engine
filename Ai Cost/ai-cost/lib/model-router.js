/**
 * lib/model-router.js
 *
 * MODEL ROUTING ENGINE — v1
 * ─────────────────────────
 * Deterministic, zero-dependency routing logic.
 * Decides which model should actually serve a request — independently
 * of what the caller originally asked for.
 *
 * DESIGN PRINCIPLES:
 *   • Pure function — no DB calls, no side effects
 *   • Always returns a safe result (never throws)
 *   • routing_mode "off" → passthrough, zero behaviour change
 *   • routing_mode "smart" (default) → apply routing rules
 *
 * INTEGRATION:
 *   Called by /api/proxy/llm BEFORE forwarding to upstream.
 *   The routed model replaces the original in the upstream request.
 *   original_model + routed_model + savings_usd are logged to DB.
 *
 * FUTURE EXTENSION:
 *   Add new rules to ROUTING_RULES array — no other code changes needed.
 *   Rules are evaluated in order; first match wins.
 */

import { calculateCost } from "@/lib/model-pricing";

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING MODES
// ─────────────────────────────────────────────────────────────────────────────
export const ROUTING_MODES = {
  OFF:   "off",    // passthrough — caller's model used verbatim
  SMART: "smart",  // apply routing rules (default)
};

// ─────────────────────────────────────────────────────────────────────────────
// DOWNGRADE MAP
// Maps expensive models → their cheap equivalent within the same family.
// Only models listed here can be downgraded — unknown models are left alone.
// ─────────────────────────────────────────────────────────────────────────────
const DOWNGRADE_MAP = {
  // OpenAI
  "gpt-4o":        "gpt-4o-mini",
  "gpt-4.1":       "gpt-4.1-mini",
  "gpt-4-turbo":   "gpt-4o-mini",
  "o1":            "gpt-4o-mini",
  "o3":            "gpt-4o-mini",
  // Anthropic
  "claude-3-5-sonnet-20241022": "claude-3-5-haiku-20241022",
  "claude-sonnet":              "claude-haiku",
  // Google (future)
  "gemini-1.5-pro": "gemini-1.5-flash",
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING RULES — v1
// Each rule is a predicate. First rule that returns true → use cheap model.
// Evaluated in order; stop at first match.
// ─────────────────────────────────────────────────────────────────────────────

/** Features that never need a frontier model */
const CHEAP_FEATURES = new Set([
  "classification",
  "summary",
  "summarization",
  "tagging",
  "extraction",
  "embedding",
  "moderation",
  "intent",
  "routing",   // ironic, but true
]);

/** Estimate input tokens from messages array (rough char/4 heuristic). */
function estimateInputTokens(messages = []) {
  const totalChars = messages.reduce((sum, m) => {
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content || "");
    return sum + content.length;
  }, 0);
  // 1 token ≈ 4 chars (English). Good enough for routing decisions.
  return Math.ceil(totalChars / 4);
}

/**
 * ROUTING_RULES
 *
 * Each entry: { name, description, test(ctx) → boolean }
 * ctx = { model, messages, feature, estimated_input_tokens }
 *
 * true  → route to cheap model
 * false → keep original model
 */
const ROUTING_RULES = [
  {
    name:        "cheap_feature",
    description: "Feature tag explicitly marks low-complexity work",
    test: ({ feature }) =>
      typeof feature === "string" && CHEAP_FEATURES.has(feature.toLowerCase().trim()),
  },
  {
    name:        "short_prompt",
    description: "Prompt is short — frontier model adds no value for <1000 tokens",
    test: ({ estimated_input_tokens }) => estimated_input_tokens < 1000,
  },
  {
    name:        "single_turn",
    description: "Single-turn request with no system context — likely simple Q&A",
    test: ({ messages }) =>
      Array.isArray(messages) &&
      messages.length === 1 &&
      messages[0]?.role === "user",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CORE ROUTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * routeModel(params)
 *
 * Main entry point. Called by the proxy before every upstream request.
 *
 * @param {object} params
 * @param {string}   params.model          - Original model from caller
 * @param {Array}    params.messages       - Standard messages array
 * @param {string}   [params.feature]      - Feature tag from caller
 * @param {string}   [params.routing_mode] - "smart" | "off" (default: "smart")
 * @param {number}   [params.input_tokens] - Actual token count (post-call), or
 *                                           undefined (pre-call estimation used)
 *
 * @returns {{
 *   original_model:  string,
 *   routed_model:    string,
 *   routing_mode:    string,
 *   was_routed:      boolean,
 *   rule_matched:    string|null,
 *   savings_usd:     number,
 *   estimated_input_tokens: number,
 * }}
 */
export function routeModel({
  model,
  messages     = [],
  feature      = null,
  routing_mode = ROUTING_MODES.SMART,
  input_tokens = null,   // pass actual count post-call for accurate savings
}) {
  const SAFE_DEFAULT = {
    original_model:  model,
    routed_model:    model,
    routing_mode,
    was_routed:      false,
    rule_matched:    null,
    savings_usd:     0,
    estimated_input_tokens: 0,
  };

  try {
    // ── Mode: off → passthrough, no routing ──────────────────────────────────
    if (routing_mode === ROUTING_MODES.OFF) return SAFE_DEFAULT;

    // ── No downgrade path for this model → passthrough ───────────────────────
    const cheapModel = DOWNGRADE_MAP[model];
    if (!cheapModel) return SAFE_DEFAULT;

    // ── Already on cheap model → nothing to do ───────────────────────────────
    if (model === cheapModel) return SAFE_DEFAULT;

    // ── Evaluate rules ────────────────────────────────────────────────────────
    const estimated_input_tokens =
      input_tokens !== null ? input_tokens : estimateInputTokens(messages);

    const ctx = { model, messages, feature, estimated_input_tokens };

    let matched_rule = null;
    for (const rule of ROUTING_RULES) {
      if (rule.test(ctx)) {
        matched_rule = rule.name;
        break;
      }
    }

    // No rule matched → keep original model
    if (!matched_rule) return { ...SAFE_DEFAULT, estimated_input_tokens };

    // ── Calculate savings using 100-token estimate for pre-call routing ───────
    // We use estimated tokens here. After the call completes, the proxy
    // recalculates with actual tokens and stores the accurate savings_usd.
    const tokens   = estimated_input_tokens;
    const outEst   = Math.ceil(tokens * 0.4); // output ≈ 40% of input (heuristic)
    const costOrig = calculateCost(model,      tokens, outEst);
    const costNew  = calculateCost(cheapModel, tokens, outEst);
    const savings  = Math.max(0, Math.round((costOrig - costNew) * 1e8) / 1e8);

    return {
      original_model:         model,
      routed_model:           cheapModel,
      routing_mode,
      was_routed:             true,
      rule_matched:           matched_rule,
      savings_usd:            savings,
      estimated_input_tokens,
    };
  } catch (err) {
    // Never crash the proxy
    console.error("[model-router] routeModel error:", err?.message);
    return SAFE_DEFAULT;
  }
}

/**
 * calculateActualSavings(originalModel, routedModel, inputTokens, outputTokens)
 *
 * Called AFTER the LLM response returns with real token counts.
 * This is the accurate savings figure stored in ai_usage_logs.
 *
 * @returns {number} savings in USD (0 if no routing occurred)
 */
export function calculateActualSavings(originalModel, routedModel, inputTokens, outputTokens) {
  try {
    if (originalModel === routedModel) return 0;
    const costOrig   = calculateCost(originalModel, inputTokens, outputTokens);
    const costActual = calculateCost(routedModel,   inputTokens, outputTokens);
    return Math.max(0, Math.round((costOrig - costActual) * 1e8) / 1e8);
  } catch {
    return 0;
  }
}

/**
 * getRoutingInfo()
 *
 * Returns metadata about the current routing configuration.
 * Used by the GET /api/proxy/llm health endpoint.
 */
export function getRoutingInfo() {
  return {
    mode_default:   ROUTING_MODES.SMART,
    rules:          ROUTING_RULES.map(r => ({ name: r.name, description: r.description })),
    downgrade_map:  DOWNGRADE_MAP,
    cheap_features: [...CHEAP_FEATURES],
  };
}
