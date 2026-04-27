/**
 * lib/budget-guardrails.js
 *
 * BUDGET GUARDRAILS
 * ─────────────────
 * Pre-call gate: checks spend + estimated cost BEFORE forwarding to upstream.
 * Post-call update: increments spend counters after real cost is known.
 * Reset: automatic daily/monthly resets on first check after rollover.
 *
 * DESIGN:
 *   • Pure DB-driven — policies live in budget_policies table
 *   • checkBudget() is called PRE-CALL — blocks expensive requests early
 *   • updateSpend() is called POST-CALL — increments with real cost
 *   • resetIfNeeded() runs inside checkBudget on every call — zero cron needed
 *   • null policy → allow (no configured budget = no blocking)
 *   • Modes: "block" (return 429) | "warn" (allow + flag in response headers)
 *
 * DB SCHEMA: see SQL block at bottom.
 */

import { getSupabase }   from "@/lib/db";
import { calculateCost } from "@/lib/model-pricing";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Default guardrail mode when policy.mode is not set. */
const DEFAULT_MODE = "block";

/**
 * Warning threshold — trigger a "warn" response when spend reaches this
 * fraction of the limit, even in block mode.
 * 0.80 = warn when 80% of budget is consumed.
 */
const WARN_THRESHOLD = 0.80;

// ─────────────────────────────────────────────────────────────────────────────
// RESET LOGIC — automatic, no cron required
// ─────────────────────────────────────────────────────────────────────────────

/**
 * needsDailyReset(lastResetAt)
 * Returns true when last_reset_at is before the start of today UTC.
 */
function needsDailyReset(lastResetAt) {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  return !lastResetAt || new Date(lastResetAt) < todayStart;
}

/**
 * needsMonthlyReset(lastResetAt)
 * Returns true when last_reset_at is before the 1st of the current UTC month.
 */
function needsMonthlyReset(lastResetAt) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  return !lastResetAt || new Date(lastResetAt) < monthStart;
}

/**
 * resetIfNeeded(sb, policy)
 *
 * Checks whether daily and/or monthly counters need resetting.
 * If so, updates the row in-place and returns the updated policy object.
 * Safe to call on every request — only writes when a reset is actually needed.
 *
 * @param {object} sb     - Supabase server client
 * @param {object} policy - Row from budget_policies
 * @returns {object}      - Updated policy (same object if no reset needed)
 */
async function resetIfNeeded(sb, policy) {
  const updates = {};
  const now     = new Date().toISOString();

  const monthly = needsMonthlyReset(policy.last_reset_at);
  const daily   = needsDailyReset(policy.last_reset_at);

  if (monthly) {
    updates.current_monthly_spend = 0;
    updates.current_daily_spend   = 0;
    updates.last_reset_at         = now;
  } else if (daily) {
    updates.current_daily_spend = 0;
    updates.last_reset_at       = now;
  }

  if (Object.keys(updates).length === 0) return policy; // nothing to reset

  const { data, error } = await sb
    .from("budget_policies")
    .update(updates)
    .eq("id", policy.id)
    .select()
    .single();

  if (error) {
    console.error("[budget-guardrails] reset failed:", error.message);
    return policy; // use stale policy — safe, just slightly inaccurate
  }

  console.info(`[budget-guardrails] reset | project=${policy.project_id} | monthly=${monthly} | daily=${daily}`);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// POLICY LOADER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * loadPolicy(project_id)
 *
 * Fetches the active budget policy for a project.
 * Returns null when no policy exists — caller must treat null as "allow".
 * Triggers automatic resets before returning.
 *
 * @param {string} project_id
 * @returns {object|null}
 */
async function loadPolicy(project_id) {
  try {
    if (!project_id) return null;
    const sb = getSupabase();
    if (!sb)         return null; // demo mode — no blocking

    const { data, error } = await sb
      .from("budget_policies")
      .select("*")
      .eq("project_id", project_id)
      .eq("enabled", true)
      .maybeSingle();

    if (error) {
      console.error("[budget-guardrails] loadPolicy error:", error.message);
      return null;
    }
    if (!data) return null;

    // Always check for reset before returning — no cron needed
    return resetIfNeeded(sb, data);
  } catch (err) {
    console.error("[budget-guardrails] loadPolicy exception:", err?.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-CALL CHECK — called BEFORE upstream LLM request
// ─────────────────────────────────────────────────────────────────────────────

/**
 * checkBudget(project_id, model, messages)
 *
 * THE ONLY FUNCTION THE PROXY CALLS BEFORE FORWARDING.
 *
 * Returns a result object — caller decides what to do with it:
 *   { allowed: true,  warn: false, policy: null }  → no policy, proceed
 *   { allowed: true,  warn: true,  ... }           → approaching limit, proceed + warn
 *   { allowed: false, warn: false, ... }           → over limit, block (mode="block")
 *   { allowed: true,  warn: true,  ... }           → over limit, warn only (mode="warn")
 *
 * @param {string} project_id
 * @param {string} model       - Effective (routed) model — for cost estimate
 * @param {Array}  messages    - For token count estimation
 * @returns {object}
 */
export async function checkBudget(project_id, model, messages = []) {
  try {
    const policy = await loadPolicy(project_id);

    // No policy → allow unconditionally
    if (!policy) {
      return { allowed: true, warn: false, policy: null };
    }

    // Estimate cost of this call (input-only estimate — worst case heuristic)
    const estimatedInputTokens  = estimateTokens(messages);
    const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.4);
    const estimatedCost         = calculateCost(model, estimatedInputTokens, estimatedOutputTokens);

    const mode         = policy.mode || DEFAULT_MODE;
    const dailyLimit   = Number(policy.daily_limit_usd   || 0);
    const monthlyLimit = Number(policy.monthly_limit_usd  || 0);
    const dailySpend   = Number(policy.current_daily_spend   || 0);
    const monthlySpend = Number(policy.current_monthly_spend  || 0);

    // Project spend AFTER this call
    const projectedDaily   = dailySpend   + estimatedCost;
    const projectedMonthly = monthlySpend + estimatedCost;

    // Check if over limit
    const dailyExceeded   = dailyLimit   > 0 && projectedDaily   > dailyLimit;
    const monthlyExceeded = monthlyLimit > 0 && projectedMonthly > monthlyLimit;
    const exceeded        = dailyExceeded || monthlyExceeded;

    // Check if approaching limit (warn threshold)
    const dailyWarning   = dailyLimit   > 0 && projectedDaily   >= dailyLimit   * WARN_THRESHOLD;
    const monthlyWarning = monthlyLimit > 0 && projectedMonthly >= monthlyLimit * WARN_THRESHOLD;
    const nearLimit      = dailyWarning || monthlyWarning;

    if (exceeded) {
      const reason = dailyExceeded
        ? `Daily budget exceeded: $${dailySpend.toFixed(4)} spent of $${dailyLimit} limit`
        : `Monthly budget exceeded: $${monthlySpend.toFixed(4)} spent of $${monthlyLimit} limit`;

      if (mode === "block") {
        console.warn(`[budget-guardrails] BLOCKED | project=${project_id} | ${reason}`);
        return {
          allowed:           false,
          warn:              false,
          mode,
          reason,
          daily_spend:       dailySpend,
          monthly_spend:     monthlySpend,
          daily_limit:       dailyLimit,
          monthly_limit:     monthlyLimit,
          estimated_cost:    estimatedCost,
          policy,
        };
      }

      // warn mode — allow through but flag
      console.warn(`[budget-guardrails] WARN (over limit, allow) | project=${project_id} | ${reason}`);
      return {
        allowed:           true,
        warn:              true,
        mode,
        reason,
        daily_spend:       dailySpend,
        monthly_spend:     monthlySpend,
        daily_limit:       dailyLimit,
        monthly_limit:     monthlyLimit,
        estimated_cost:    estimatedCost,
        policy,
      };
    }

    return {
      allowed:        true,
      warn:           nearLimit,
      mode,
      reason:         nearLimit ? "Approaching budget limit" : null,
      daily_spend:    dailySpend,
      monthly_spend:  monthlySpend,
      daily_limit:    dailyLimit,
      monthly_limit:  monthlyLimit,
      estimated_cost: estimatedCost,
      policy,
    };

  } catch (err) {
    // On any error → ALLOW (fail open, never break production traffic)
    console.error("[budget-guardrails] checkBudget exception:", err?.message);
    return { allowed: true, warn: false, policy: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST-CALL SPEND UPDATE — called AFTER real cost is known
// ─────────────────────────────────────────────────────────────────────────────

/**
 * updateSpend(project_id, actualCost)
 *
 * Increments current_daily_spend and current_monthly_spend with the REAL cost
 * from the upstream LLM response. Called fire-and-forget after every call.
 *
 * Uses a Postgres atomic increment (no read-modify-write race condition).
 *
 * @param {string} project_id
 * @param {number} actualCost - Real cost in USD from calculateCost()
 */
export async function updateSpend(project_id, actualCost) {
  try {
    if (!project_id) return;
    const cost = Number(actualCost) || 0;
    if (cost <= 0) return;

    const sb = getSupabase();
    if (!sb) return; // demo mode

    // Atomic RPC increment to avoid race conditions between concurrent calls.
    // Falls back to a regular update if the RPC doesn't exist yet.
    const { error } = await sb.rpc("increment_budget_spend", {
      p_project_id: project_id,
      p_amount:     cost,
    });

    if (error) {
      // Fallback: non-atomic update (fine for low-concurrency projects)
      console.warn("[budget-guardrails] rpc increment failed, using fallback:", error.message);
      await _fallbackUpdateSpend(sb, project_id, cost);
    }
  } catch (err) {
    console.error("[budget-guardrails] updateSpend exception:", err?.message);
  }
}

/** Fallback read-modify-write when RPC is not installed. */
async function _fallbackUpdateSpend(sb, project_id, cost) {
  try {
    const { data } = await sb
      .from("budget_policies")
      .select("current_daily_spend, current_monthly_spend")
      .eq("project_id", project_id)
      .eq("enabled", true)
      .maybeSingle();

    if (!data) return;

    await sb
      .from("budget_policies")
      .update({
        current_daily_spend:   (Number(data.current_daily_spend)   || 0) + cost,
        current_monthly_spend: (Number(data.current_monthly_spend) || 0) + cost,
      })
      .eq("project_id", project_id)
      .eq("enabled", true);
  } catch (err) {
    console.error("[budget-guardrails] _fallbackUpdateSpend exception:", err?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN ESTIMATOR (pre-call, no real count yet)
// ─────────────────────────────────────────────────────────────────────────────

/** Rough char/4 heuristic — good enough for pre-call budget check. */
function estimateTokens(messages = []) {
  const chars = messages.reduce((sum, m) => {
    const c = typeof m.content === "string" ? m.content : JSON.stringify(m.content || "");
    return sum + c.length;
  }, 0);
  return Math.ceil(chars / 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// POLICY MANAGEMENT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getPolicy(project_id)
 * Returns the raw policy row for a project (for API/dashboard reads).
 */
export async function getPolicy(project_id) {
  try {
    const sb = getSupabase();
    if (!sb || !project_id) return null;

    const { data, error } = await sb
      .from("budget_policies")
      .select("*")
      .eq("project_id", project_id)
      .maybeSingle();

    if (error) { console.error("[budget-guardrails] getPolicy error:", error.message); return null; }
    return data;
  } catch { return null; }
}

/**
 * upsertPolicy(policy)
 * Creates or updates a budget policy. Used by the settings API.
 *
 * @param {object} policy - { project_id, daily_limit_usd, monthly_limit_usd, mode }
 * @returns {{ data, error }}
 */
export async function upsertPolicy(policy) {
  try {
    const sb = getSupabase();
    if (!sb) return { data: null, error: "Demo mode — DB not configured" };

    const record = {
      project_id:           policy.project_id,
      daily_limit_usd:      Number(policy.daily_limit_usd   || 0),
      monthly_limit_usd:    Number(policy.monthly_limit_usd  || 0),
      mode:                 ["block", "warn"].includes(policy.mode) ? policy.mode : DEFAULT_MODE,
      enabled:              policy.enabled !== false, // default true
      current_daily_spend:   0,
      current_monthly_spend: 0,
      last_reset_at:         new Date().toISOString(),
    };

    const { data, error } = await sb
      .from("budget_policies")
      .upsert([record], { onConflict: "project_id" })
      .select()
      .single();

    return { data, error: error?.message || null };
  } catch (err) {
    return { data: null, error: err?.message };
  }
}

/**
 * manualReset(project_id, scope)
 * Manually resets daily and/or monthly spend counters.
 * @param {"daily"|"monthly"|"both"} scope
 */
export async function manualReset(project_id, scope = "both") {
  try {
    const sb = getSupabase();
    if (!sb || !project_id) return { ok: false, error: "Not configured" };

    const updates = { last_reset_at: new Date().toISOString() };
    if (scope === "daily"   || scope === "both") updates.current_daily_spend   = 0;
    if (scope === "monthly" || scope === "both") updates.current_monthly_spend = 0;

    const { error } = await sb
      .from("budget_policies")
      .update(updates)
      .eq("project_id", project_id);

    if (error) return { ok: false, error: error.message };
    console.info(`[budget-guardrails] manual reset | project=${project_id} | scope=${scope}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message };
  }
}

/*
 * ═══════════════════════════════════════════════════════════════════
 * SUPABASE MIGRATION — run once
 * ═══════════════════════════════════════════════════════════════════
 *
 * -- Budget policies table
 * CREATE TABLE IF NOT EXISTS budget_policies (
 *   id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   project_id           text NOT NULL UNIQUE,
 *   daily_limit_usd      numeric(12,4) NOT NULL DEFAULT 0,
 *   monthly_limit_usd    numeric(12,4) NOT NULL DEFAULT 0,
 *   current_daily_spend  numeric(14,8) NOT NULL DEFAULT 0,
 *   current_monthly_spend numeric(14,8) NOT NULL DEFAULT 0,
 *   mode                 text NOT NULL DEFAULT 'block'
 *                        CHECK (mode IN ('block','warn')),
 *   enabled              boolean NOT NULL DEFAULT true,
 *   last_reset_at        timestamptz DEFAULT now(),
 *   created_at           timestamptz DEFAULT now(),
 *   updated_at           timestamptz DEFAULT now()
 * );
 *
 * CREATE INDEX ON budget_policies (project_id) WHERE enabled = true;
 *
 *
 * -- Atomic increment RPC (avoids race conditions on concurrent calls)
 * CREATE OR REPLACE FUNCTION increment_budget_spend(
 *   p_project_id text,
 *   p_amount     numeric
 * )
 * RETURNS void LANGUAGE sql AS $$
 *   UPDATE budget_policies
 *   SET
 *     current_daily_spend   = current_daily_spend   + p_amount,
 *     current_monthly_spend = current_monthly_spend + p_amount,
 *     updated_at            = now()
 *   WHERE project_id = p_project_id
 *     AND enabled    = true;
 * $$;
 *
 * ═══════════════════════════════════════════════════════════════════
 */
