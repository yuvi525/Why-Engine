/**
 * lib/decision-engine.js
 *
 * Pure deterministic decision engine — no AI, no DB, no external calls.
 *
 * Converts a formatted WHY output + optional detection event into a
 * structured, actionable decision record.
 *
 * ─────────────────────────────────────────────────────────────────────
 * INPUT
 * ─────────────────────────────────────────────────────────────────────
 *
 * whyOutput  (from output-formatter.js → formatDecisionOutput)
 * {
 *   priority:   "HIGH" | "MEDIUM" | "LOW"
 *   why:        string
 *   impact:     string
 *   action:     string[]
 *   decision:   string
 *   confidence: string   // e.g. "88%" or "0.88"
 * }
 *
 * detectionEvent  (from detection-engine / aws-detector / stripe-detector)
 * {
 *   isAnomaly:  boolean
 *   type:       string   // "cost_spike" | "model_overuse" | "loop_detected" |
 *                        // "token_spike" | "idle_resource" | "revenue_drop" |
 *                        // "failed_payment_spike" | "mix_change"
 *   severity:   "low" | "medium" | "high" | "critical"
 *   domain:     "ai_cost" | "aws_cost" | "stripe_revenue"
 *   details?:   string | object
 * }
 *
 * ─────────────────────────────────────────────────────────────────────
 * OUTPUT  (makeDecision return value)
 * ─────────────────────────────────────────────────────────────────────
 *
 * {
 *   priority:          "HIGH" | "MEDIUM" | "LOW"
 *   auto_executable:   boolean
 *   requires_approval: boolean
 *   domain:            "ai_cost" | "aws_cost" | "stripe_revenue"
 *   action_type:       string    // classified action category
 *   confidence_pct:    number    // 0–100 numeric, parsed from string
 *   reasoning:         string    // human-readable decision rationale
 *   created_at:        string    // ISO timestamp
 * }
 */

import { DOMAINS, normaliseDomain } from "@/lib/domains";

// ── Constants ─────────────────────────────────────────────────────────────

/** Confidence threshold below which human approval is always required. */
const APPROVAL_CONFIDENCE_THRESHOLD = 70; // percent

/** Severity levels that force approval regardless of other factors. */
const DESTRUCTIVE_SEVERITIES = new Set(["high", "critical"]);

/**
 * Action keyword sets — used to classify the action_type from action[].
 * Checked in order; first match wins.
 */
const ACTION_CLASSIFIERS = [
  {
    type:     "model_downgrade",
    keywords: ["downgrade", "gpt-4o-mini", "haiku", "flash", "smaller model",
               "lower-cost model", "switch model", "model switch"],
  },
  {
    type:     "prompt_optimization",
    keywords: ["prompt", "system prompt", "max_tokens", "token limit",
               "output length", "chunk", "compress"],
  },
  {
    type:     "retry_fix",
    keywords: ["retry", "backoff", "exponential", "loop", "max retries"],
  },
  {
    type:     "resource_resize",
    keywords: ["resize", "rightsize", "right-size", "scale down",
               "idle", "terminate", "shutdown"],
  },
  {
    type:     "budget_cap",
    keywords: ["budget", "cap", "limit", "halt", "cost limit"],
  },
  {
    type:     "monitoring",
    keywords: ["monitor", "alert", "notify", "watch", "threshold"],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * parseConfidence(raw)
 *
 * Converts "88%", "0.88", 88, or "" into a 0–100 number.
 * Returns 0 on any failure — safe default that triggers approval.
 */
function parseConfidence(raw) {
  if (raw == null || raw === "") return 0;

  const str = String(raw).trim();

  // "88%" → 88
  if (str.endsWith("%")) {
    const n = parseFloat(str);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  }

  // "0.88" → 88 | "88" → 88
  const n = parseFloat(str);
  if (!Number.isFinite(n)) return 0;
  // If the parsed value is in [0,1] range it's a ratio — multiply by 100
  return n <= 1 ? Math.round(n * 100) : Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * classifyActionType(actions, anomalyType)
 *
 * Scans action strings for known keywords to produce a stable action_type.
 * Falls back to the anomaly type, then "generic_optimization".
 */
function classifyActionType(actions, anomalyType) {
  const haystack = Array.isArray(actions)
    ? actions.join(" ").toLowerCase()
    : "";

  for (const { type, keywords } of ACTION_CLASSIFIERS) {
    if (keywords.some(kw => haystack.includes(kw))) return type;
  }

  // Fallback: map anomaly type to a sensible label
  const ANOMALY_TYPE_MAP = {
    cost_spike:           "cost_reduction",
    model_overuse:        "model_downgrade",
    loop_detected:        "retry_fix",
    token_spike:          "prompt_optimization",
    mix_change:           "model_downgrade",
    idle_resource:        "resource_resize",
    revenue_drop:         "revenue_recovery",
    failed_payment_spike: "payment_remediation",
  };

  return ANOMALY_TYPE_MAP[anomalyType] || "generic_optimization";
}

// ── Priority resolution ───────────────────────────────────────────────────

/**
 * resolvePriority(whyOutput, detectionEvent)
 *
 * Decision engine's own priority pass — cross-checks the formatter's
 * priority with detection severity to ensure HIGH is never missed.
 *
 * Rules (in order):
 *   1. If formatter already said HIGH → keep HIGH
 *   2. If detection severity is "critical" or "high" → HIGH
 *   3. If impact mentions dollar figure > $10 or formatter said MEDIUM → MEDIUM
 *   4. Else → LOW
 */
function resolvePriority(whyOutput, detectionEvent) {
  const formatterPriority = String(whyOutput?.priority || "LOW").toUpperCase();
  const severity          = String(detectionEvent?.severity || "low").toLowerCase();

  if (formatterPriority === "HIGH") return "HIGH";
  if (severity === "critical" || severity === "high") return "HIGH";

  // Extract dollar amount from impact string as a secondary signal
  const impactStr = String(whyOutput?.impact || "");
  const dollarMatch = impactStr.match(/\$([0-9,]+(?:\.[0-9]+)?)/);
  if (dollarMatch) {
    const amount = parseFloat(dollarMatch[1].replace(",", ""));
    if (Number.isFinite(amount) && amount >= 10) return "HIGH";
    if (Number.isFinite(amount) && amount >= 1) return "MEDIUM";
  }

  if (formatterPriority === "MEDIUM") return "MEDIUM";
  if (severity === "medium") return "MEDIUM";

  return "LOW";
}

// ── Auto-execution rules ──────────────────────────────────────────────────

/**
 * resolveAutoExecutable(domain, actionType, detectionEvent)
 *
 * Determines whether the action can be executed without user interaction.
 *
 * Rules:
 *   AI domain:
 *     - model_downgrade → true  (safe, reversible, high confidence)
 *     - all others      → false (prompt changes need review)
 *
 *   AWS domain:
 *     - resource_resize → false (destructive — could cause downtime)
 *     - all others      → false (conservative default)
 *
 *   Stripe domain:
 *     - always false    (financial operations always need human approval)
 *
 *   Unknown domain → false (safe default)
 */
function resolveAutoExecutable(domain, actionType) {
  switch (domain) {
    case DOMAINS.AI:
      return actionType === "model_downgrade";

    case DOMAINS.AWS:
      return false; // resource operations are destructive

    case DOMAINS.STRIPE:
      return false; // financial operations always require approval

    default:
      return false; // unknown domain → safe fallback
  }
}

// ── Approval rules ────────────────────────────────────────────────────────

/**
 * resolveRequiresApproval(domain, actionType, confidencePct, detectionEvent)
 *
 * Determines whether human approval is required before execution.
 *
 * Rules (any one being true → requires approval):
 *   1. Confidence < 70%                                (uncertain recommendation)
 *   2. AWS domain + destructive severity (high/crit)  (infra changes need sign-off)
 *   3. Stripe domain                                   (always — financial safety)
 *   4. action_type === "resource_resize"               (cross-domain safety net)
 */
function resolveRequiresApproval(domain, actionType, confidencePct, detectionEvent) {
  // Rule 1: low confidence
  if (confidencePct < APPROVAL_CONFIDENCE_THRESHOLD) return true;

  // Rule 2: AWS + destructive severity
  if (
    domain === DOMAINS.AWS &&
    DESTRUCTIVE_SEVERITIES.has(String(detectionEvent?.severity || "").toLowerCase())
  ) return true;

  // Rule 3: Stripe — always
  if (domain === DOMAINS.STRIPE) return true;

  // Rule 4: resource resize across any domain
  if (actionType === "resource_resize") return true;

  return false;
}

// ── Reasoning builder ─────────────────────────────────────────────────────

/**
 * buildReasoning(priority, autoExec, requiresApproval, domain, actionType, confidencePct)
 *
 * Produces a single human-readable sentence explaining the decision outcome.
 * Used for audit logs and UI tooltips.
 */
function buildReasoning(priority, autoExec, requiresApproval, domain, actionType, confidencePct) {
  const parts = [];

  parts.push(`Priority: ${priority}.`);

  if (autoExec) {
    parts.push(`Action (${actionType}) is auto-executable for domain "${domain}".`);
  } else {
    parts.push(`Action (${actionType}) requires manual execution.`);
  }

  if (requiresApproval) {
    const reasons = [];
    if (confidencePct < APPROVAL_CONFIDENCE_THRESHOLD) {
      reasons.push(`confidence ${confidencePct}% is below ${APPROVAL_CONFIDENCE_THRESHOLD}% threshold`);
    }
    if (domain === DOMAINS.STRIPE) {
      reasons.push("Stripe financial operations always require approval");
    }
    if (domain === DOMAINS.AWS) {
      reasons.push("AWS infrastructure changes require human sign-off");
    }
    if (actionType === "resource_resize") {
      reasons.push("resource resize is a destructive operation");
    }
    parts.push(`Approval required: ${reasons.join("; ") || "policy rule"}.`);
  } else {
    parts.push("No approval required.");
  }

  return parts.join(" ");
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * SAFE_DEFAULT
 *
 * Returned whenever makeDecision() receives completely invalid input.
 * Conservative: requires approval, not auto-executable, priority LOW.
 */
export const SAFE_DEFAULT = Object.freeze({
  priority:          "LOW",
  auto_executable:   false,
  requires_approval: true,
  domain:            DOMAINS.AI,
  action_type:       "generic_optimization",
  confidence_pct:    0,
  reasoning:         "Insufficient input — safe defaults applied. Review manually.",
  created_at:        "", // set dynamically in makeDecision
});

/**
 * makeDecision(whyOutput, detectionEvent?)
 *
 * Main entry point. Pure function — no side effects, no I/O, no throws.
 *
 * @param {object} whyOutput       - Formatted WHY output (from formatDecisionOutput)
 * @param {object} [detectionEvent] - Optional detection event (from any detector)
 * @returns {object}               - Structured decision record
 */
export function makeDecision(whyOutput, detectionEvent = {}) {
  try {
    // ── Resolve domain (safe fallback for missing/unknown) ──────────────
    const rawDomain = detectionEvent?.domain ?? whyOutput?.domain ?? null;
    const domain    = normaliseDomain(rawDomain);

    // ── Parse confidence ────────────────────────────────────────────────
    const confidencePct = parseConfidence(whyOutput?.confidence);

    // ── Classify action type ────────────────────────────────────────────
    const actionType = classifyActionType(
      whyOutput?.action,
      detectionEvent?.type
    );

    // ── Resolve priority ────────────────────────────────────────────────
    const priority = resolvePriority(whyOutput, detectionEvent);

    // ── Resolve auto-execution ──────────────────────────────────────────
    const autoExec = resolveAutoExecutable(domain, actionType);

    // ── Resolve approval requirement ────────────────────────────────────
    const requiresApproval = resolveRequiresApproval(
      domain,
      actionType,
      confidencePct,
      detectionEvent
    );

    // ── Build reasoning ─────────────────────────────────────────────────
    const reasoning = buildReasoning(
      priority,
      autoExec,
      requiresApproval,
      domain,
      actionType,
      confidencePct
    );

    return {
      priority,
      auto_executable:   autoExec,
      requires_approval: requiresApproval,
      domain,
      action_type:       actionType,
      confidence_pct:    confidencePct,
      reasoning,
      created_at:        new Date().toISOString(),
    };

  } catch (err) {
    // Never crash the caller — return safe defaults with error note
    console.error("[decision-engine] Unexpected error:", err?.message);
    return {
      ...SAFE_DEFAULT,
      reasoning:  `Error in decision engine: ${err?.message || "unknown"}. Safe defaults applied.`,
      created_at: new Date().toISOString(),
    };
  }
}
