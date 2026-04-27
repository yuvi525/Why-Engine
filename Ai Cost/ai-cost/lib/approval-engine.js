/**
 * lib/approval-engine.js
 *
 * APPROVAL ENGINE — Human-in-the-loop gate for low-confidence actions
 * ───────────────────────────────────────────────────────────────────
 * When autopilot confidence < APPROVAL_THRESHOLD (default 90%), the action
 * is NOT executed immediately. Instead, it is queued as a pending approval.
 *
 * Flow:
 *   1. Autopilot scores an action → confidence = 78%
 *   2. createApproval() → row inserted with status="pending"
 *   3. Dashboard shows pending actions
 *   4. Human clicks Approve → approveAction() → action executes
 *   5. Human clicks Reject  → rejectAction()  → action discarded
 *
 * CONFIDENCE THRESHOLD:
 *   < APPROVAL_THRESHOLD → requires human approval
 *   ≥ APPROVAL_THRESHOLD → autopilot executes immediately (no approval)
 *
 * DB SCHEMA: see SQL block at bottom.
 */

import { getSupabase }        from "@/lib/db";
import { AUDIT_ACTIONS, auditLog } from "@/lib/audit-logger";

/** Actions with confidence below this threshold require human approval. */
export const APPROVAL_THRESHOLD = 90; // percent

export const APPROVAL_STATUS = {
  PENDING:  "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED:  "expired",
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE — queue an action for approval
// ─────────────────────────────────────────────────────────────────────────────

/**
 * createApproval(entry)
 *
 * Inserts a pending approval row and fires an audit log entry.
 * Called by the autopilot when confidence < APPROVAL_THRESHOLD.
 *
 * @param {object} entry
 * @param {string}  entry.project_id
 * @param {string}  [entry.user_id]
 * @param {string}  [entry.run_id]       - FK → ai_usage_logs.id
 * @param {string}  entry.action_type    - e.g. "switch_model", "clamp_tokens"
 * @param {string}  entry.action_label   - Human readable
 * @param {string}  entry.recommendation - Why this action is suggested
 * @param {object}  entry.proposed_change - { from, to } snapshot of the change
 * @param {number}  entry.confidence_pct
 * @param {number}  [entry.estimated_savings_usd]
 * @returns {{ data: object|null, error: string|null }}
 */
export async function createApproval(entry) {
  try {
    const sb = getSupabase();
    if (!sb) {
      console.info(`[approval] demo_mode | ${entry.action_type} | confidence=${entry.confidence_pct}%`);
      return { data: { id: "demo", status: APPROVAL_STATUS.PENDING }, error: null };
    }

    const record = {
      project_id:             entry.project_id,
      user_id:                entry.user_id                || null,
      run_id:                 entry.run_id                 || null,
      action_type:            entry.action_type,
      action_label:           entry.action_label           || entry.action_type,
      recommendation:         entry.recommendation         || null,
      proposed_change:        entry.proposed_change        || null,
      confidence_pct:         Math.round(Number(entry.confidence_pct) || 0),
      estimated_savings_usd:  Number(entry.estimated_savings_usd) || 0,
      status:                 APPROVAL_STATUS.PENDING,
      expires_at:             new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(), // 7 days
    };

    const { data, error } = await sb
      .from("approvals")
      .insert([record])
      .select()
      .single();

    if (error) {
      console.error("[approval] createApproval insert error:", error.message);
      return { data: null, error: error.message };
    }

    // Audit trail
    auditLog({
      action_type: AUDIT_ACTIONS.APPROVAL_REQUESTED,
      run_id:      entry.run_id,
      project_id:  entry.project_id,
      user_id:     entry.user_id,
      meta: {
        approval_id:    data.id,
        action_type:    entry.action_type,
        confidence_pct: entry.confidence_pct,
        reason:         "confidence_below_threshold",
        threshold:      APPROVAL_THRESHOLD,
      },
    });

    console.info(`[approval] queued | id=${data.id} | ${entry.action_type} | confidence=${entry.confidence_pct}%`);
    return { data, error: null };

  } catch (err) {
    console.error("[approval] createApproval exception:", err?.message);
    return { data: null, error: err?.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// shouldRequireApproval — called by autopilot to decide gate or execute
// ─────────────────────────────────────────────────────────────────────────────

/**
 * shouldRequireApproval(confidencePct)
 * @param {number} confidencePct - 0-100
 * @returns {boolean}
 */
export function shouldRequireApproval(confidencePct) {
  return Number(confidencePct) < APPROVAL_THRESHOLD;
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE — human grants the action
// ─────────────────────────────────────────────────────────────────────────────

/**
 * approveAction(approvalId, reviewedByUserId)
 *
 * Marks the approval as approved and returns the full row so the caller
 * can execute the proposed_change.
 *
 * @returns {{ data: object|null, error: string|null }}
 */
export async function approveAction(approvalId, reviewedByUserId = null) {
  return _updateApprovalStatus(approvalId, APPROVAL_STATUS.APPROVED, reviewedByUserId);
}

// ─────────────────────────────────────────────────────────────────────────────
// REJECT — human denies the action
// ─────────────────────────────────────────────────────────────────────────────

/**
 * rejectAction(approvalId, reviewedByUserId, reason?)
 *
 * Marks the approval as rejected. The proposed action is discarded.
 */
export async function rejectAction(approvalId, reviewedByUserId = null, reason = null) {
  return _updateApprovalStatus(approvalId, APPROVAL_STATUS.REJECTED, reviewedByUserId, reason);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal status updater
// ─────────────────────────────────────────────────────────────────────────────

async function _updateApprovalStatus(approvalId, newStatus, reviewedByUserId, reason = null) {
  try {
    const sb = getSupabase();
    if (!sb) return { data: null, error: "Demo mode" };

    // Fetch current row first (need project_id for audit + to check status)
    const { data: current, error: fetchErr } = await sb
      .from("approvals")
      .select("*")
      .eq("id", approvalId)
      .single();

    if (fetchErr || !current) {
      return { data: null, error: fetchErr?.message || "Approval not found" };
    }

    if (current.status !== APPROVAL_STATUS.PENDING) {
      return { data: null, error: `Approval is already "${current.status}" — cannot update.` };
    }

    // Check expiry
    if (current.expires_at && new Date(current.expires_at) < new Date()) {
      await sb.from("approvals").update({ status: APPROVAL_STATUS.EXPIRED }).eq("id", approvalId);
      return { data: null, error: "Approval has expired." };
    }

    const updates = {
      status:             newStatus,
      reviewed_by:        reviewedByUserId || null,
      reviewed_at:        new Date().toISOString(),
      rejection_reason:   reason || null,
    };

    const { data, error } = await sb
      .from("approvals")
      .update(updates)
      .eq("id", approvalId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    // Audit trail
    const auditAction = newStatus === APPROVAL_STATUS.APPROVED
      ? AUDIT_ACTIONS.APPROVAL_GRANTED
      : AUDIT_ACTIONS.APPROVAL_REJECTED;

    auditLog({
      action_type: auditAction,
      project_id:  current.project_id,
      user_id:     reviewedByUserId,
      meta: {
        approval_id:  approvalId,
        action_type:  current.action_type,
        reason,
      },
    });

    console.info(`[approval] ${newStatus} | id=${approvalId} | by=${reviewedByUserId}`);
    return { data, error: null };

  } catch (err) {
    console.error("[approval] _updateApprovalStatus exception:", err?.message);
    return { data: null, error: err?.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getPendingApprovals(project_id)
 * Returns all pending, non-expired approvals for a project.
 * Used by the dashboard to show the approval queue.
 */
export async function getPendingApprovals(project_id = null) {
  try {
    const sb = getSupabase();
    if (!sb) return [];

    let q = sb
      .from("approvals")
      .select("id, action_type, action_label, recommendation, proposed_change, confidence_pct, estimated_savings_usd, status, expires_at, created_at")
      .eq("status", APPROVAL_STATUS.PENDING)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(50);

    if (project_id) q = q.eq("project_id", project_id);

    const { data, error } = await q;
    if (error) { console.error("[approval] getPendingApprovals error:", error.message); return []; }
    return data || [];
  } catch { return []; }
}

/**
 * getApprovalHistory(project_id, limit)
 * Returns all approvals (all statuses) for audit UI.
 */
export async function getApprovalHistory(project_id = null, limit = 50) {
  try {
    const sb = getSupabase();
    if (!sb) return [];

    let q = sb
      .from("approvals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(200, limit));

    if (project_id) q = q.eq("project_id", project_id);

    const { data, error } = await q;
    if (error) { console.error("[approval] getApprovalHistory error:", error.message); return []; }
    return data || [];
  } catch { return []; }
}

/*
 * ═══════════════════════════════════════════════════════════════════
 * SUPABASE MIGRATION — run once
 * ═══════════════════════════════════════════════════════════════════
 *
 * CREATE TABLE IF NOT EXISTS approvals (
 *   id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *
 *   project_id            text NOT NULL,
 *   user_id               text,
 *   run_id                uuid REFERENCES ai_usage_logs(id) ON DELETE SET NULL,
 *
 *   -- What action is being requested
 *   action_type           text NOT NULL,
 *   action_label          text,
 *   recommendation        text,
 *   proposed_change       jsonb,
 *   confidence_pct        integer NOT NULL DEFAULT 0,
 *   estimated_savings_usd numeric(12,4) NOT NULL DEFAULT 0,
 *
 *   -- Status lifecycle
 *   status                text NOT NULL DEFAULT 'pending'
 *                         CHECK (status IN ('pending','approved','rejected','expired')),
 *
 *   -- Review
 *   reviewed_by           text,
 *   reviewed_at           timestamptz,
 *   rejection_reason      text,
 *
 *   -- Expiry
 *   expires_at            timestamptz NOT NULL,
 *   created_at            timestamptz DEFAULT now() NOT NULL
 * );
 *
 * CREATE INDEX ON approvals (project_id, status, created_at DESC);
 * CREATE INDEX ON approvals (status, expires_at) WHERE status = 'pending';
 *
 * ═══════════════════════════════════════════════════════════════════
 */
