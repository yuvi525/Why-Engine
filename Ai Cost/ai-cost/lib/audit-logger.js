/**
 * lib/audit-logger.js
 *
 * AUDIT LOGGER — Immutable record of every critical system action
 * ───────────────────────────────────────────────────────────────
 * Records routing decisions, budget blocks, autopilot executions,
 * approvals, and WHY engine triggers. Every row is append-only.
 *
 * ACTION TYPES:
 *   routing_applied    — model was downgraded
 *   budget_blocked     — request blocked by guardrail
 *   budget_warned      — request allowed but near limit
 *   autopilot_action   — autopilot applied a config change
 *   autopilot_reverted — autopilot action was reversed
 *   approval_requested — action queued pending human approval
 *   approval_granted   — human approved a pending action
 *   approval_rejected  — human rejected a pending action
 *   why_triggered      — WHY engine ran on a cost event
 *
 * DB SCHEMA: see SQL block at bottom.
 */

import { getSupabase } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// ACTION TYPE CONSTANTS — import these, never use raw strings
// ─────────────────────────────────────────────────────────────────────────────
export const AUDIT_ACTIONS = {
  ROUTING_APPLIED:    "routing_applied",
  BUDGET_BLOCKED:     "budget_blocked",
  BUDGET_WARNED:      "budget_warned",
  AUTOPILOT_ACTION:   "autopilot_action",
  AUTOPILOT_REVERTED: "autopilot_reverted",
  APPROVAL_REQUESTED: "approval_requested",
  APPROVAL_GRANTED:   "approval_granted",
  APPROVAL_REJECTED:  "approval_rejected",
  WHY_TRIGGERED:      "why_triggered",
};

const VALID_ACTIONS = new Set(Object.values(AUDIT_ACTIONS));

// ─────────────────────────────────────────────────────────────────────────────
// CORE WRITER — fire-and-forget, never throws, never blocks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * auditLog(entry)
 *
 * Appends one immutable row to audit_logs.
 * Safe to call anywhere — never throws, never blocks the caller.
 *
 * @param {object} entry
 * @param {string}  entry.action_type    - One of AUDIT_ACTIONS values
 * @param {string}  [entry.run_id]       - FK → ai_usage_logs.id
 * @param {string}  [entry.project_id]
 * @param {string}  [entry.user_id]
 * @param {object}  [entry.before_state] - Snapshot before the action
 * @param {object}  [entry.after_state]  - Snapshot after the action
 * @param {object}  [entry.meta]         - Additional context (reason, savings, etc.)
 * @param {string}  [entry.actor]        - "system" | "user" | "autopilot"
 */
export async function auditLog(entry) {
  // Fire-and-forget — wrap everything
  Promise.resolve().then(async () => {
    try {
      const sb = getSupabase();
      if (!sb) {
        // Demo mode — log to console only
        console.info(`[audit] ${entry.action_type} | project=${entry.project_id} | actor=${entry.actor || "system"}`);
        return;
      }

      if (!VALID_ACTIONS.has(entry.action_type)) {
        console.warn(`[audit] unknown action_type: "${entry.action_type}" — skipping`);
        return;
      }

      const record = {
        action_type:  entry.action_type,
        run_id:       entry.run_id       || null,
        project_id:   entry.project_id   || null,
        user_id:      entry.user_id       || null,
        actor:        entry.actor         || "system",
        before_state: entry.before_state  || null,
        after_state:  entry.after_state   || null,
        meta:         entry.meta          || null,
        // created_at → DEFAULT now()
      };

      const { error } = await sb.from("audit_logs").insert([record]);
      if (error) {
        console.error("[audit] insert failed:", error.message);
      }
    } catch (err) {
      console.error("[audit] auditLog exception:", err?.message);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENCE WRAPPERS — pre-shaped for each action type
// ─────────────────────────────────────────────────────────────────────────────

/** Log a routing decision. */
export function auditRouting({ run_id, project_id, user_id, original_model, routed_model, rule, savings_usd }) {
  return auditLog({
    action_type:  AUDIT_ACTIONS.ROUTING_APPLIED,
    run_id, project_id, user_id,
    before_state: { model: original_model },
    after_state:  { model: routed_model },
    meta:         { rule_matched: rule, savings_usd },
  });
}

/** Log a budget block. */
export function auditBudgetBlock({ run_id, project_id, user_id, reason, daily_spend, daily_limit, monthly_spend, monthly_limit }) {
  return auditLog({
    action_type:  AUDIT_ACTIONS.BUDGET_BLOCKED,
    run_id, project_id, user_id,
    before_state: { daily_spend, monthly_spend },
    after_state:  null,
    meta:         { reason, daily_limit, monthly_limit },
  });
}

/** Log a budget warning. */
export function auditBudgetWarn({ run_id, project_id, user_id, reason, daily_spend, daily_limit }) {
  return auditLog({
    action_type:  AUDIT_ACTIONS.BUDGET_WARNED,
    run_id, project_id, user_id,
    meta:         { reason, daily_spend, daily_limit },
  });
}

/** Log an autopilot action execution. */
export function auditAutopilot({ run_id, project_id, action_id, action_label, before_state, after_state, confidence_pct }) {
  return auditLog({
    action_type:  AUDIT_ACTIONS.AUTOPILOT_ACTION,
    run_id, project_id,
    actor:        "autopilot",
    before_state,
    after_state,
    meta:         { action_id, action_label, confidence_pct },
  });
}

/** Log a WHY engine trigger. */
export function auditWhyTrigger({ run_id, project_id, trigger_reason, confidence }) {
  return auditLog({
    action_type:  AUDIT_ACTIONS.WHY_TRIGGERED,
    run_id, project_id,
    meta:         { trigger_reason, confidence },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getAuditLogs({ project_id, action_type, limit })
 * Returns recent audit entries for a project, newest first.
 */
export async function getAuditLogs({ project_id = null, action_type = null, limit = 50 } = {}) {
  try {
    const sb = getSupabase();
    if (!sb) return [];

    let q = sb
      .from("audit_logs")
      .select("id, action_type, run_id, project_id, user_id, actor, before_state, after_state, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(200, limit));

    if (project_id)  q = q.eq("project_id", project_id);
    if (action_type) q = q.eq("action_type", action_type);

    const { data, error } = await q;
    if (error) { console.error("[audit] getAuditLogs error:", error.message); return []; }
    return data || [];
  } catch (err) {
    console.error("[audit] getAuditLogs exception:", err?.message);
    return [];
  }
}

/*
 * ═══════════════════════════════════════════════════════════════════
 * SUPABASE MIGRATION — run once
 * ═══════════════════════════════════════════════════════════════════
 *
 * CREATE TABLE IF NOT EXISTS audit_logs (
 *   id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *
 *   -- Action classification
 *   action_type  text NOT NULL,
 *   actor        text NOT NULL DEFAULT 'system',
 *
 *   -- Traceability
 *   run_id       uuid REFERENCES ai_usage_logs(id) ON DELETE SET NULL,
 *   project_id   text,
 *   user_id      text,
 *
 *   -- State snapshots (JSONB — flexible per action type)
 *   before_state jsonb,
 *   after_state  jsonb,
 *   meta         jsonb,
 *
 *   -- Immutable timestamp — no updated_at
 *   created_at   timestamptz DEFAULT now() NOT NULL
 * );
 *
 * -- Append-only enforcement (optional but recommended)
 * CREATE RULE no_update_audit AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
 * CREATE RULE no_delete_audit AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
 *
 * CREATE INDEX ON audit_logs (project_id, created_at DESC);
 * CREATE INDEX ON audit_logs (action_type, created_at DESC);
 * CREATE INDEX ON audit_logs (run_id);
 *
 * ═══════════════════════════════════════════════════════════════════
 */
