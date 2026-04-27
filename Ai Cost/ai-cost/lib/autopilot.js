/**
 * lib/autopilot.js
 *
 * SAFE AUTOPILOT — v1
 * ───────────────────
 * Reads WHY engine output and takes SAFE, REVERSIBLE cost-reduction actions.
 *
 * DESIGN PRINCIPLES:
 *   • Pure action logic — no DB calls in the decision functions
 *   • Every action is reversible — no destructive changes ever
 *   • Confidence gate: WHY confidence must be > 80% to act in auto_safe mode
 *   • Three modes: off | recommend | auto_safe
 *   • All decisions (execute or recommend) are logged to autopilot_actions
 *   • Never throws — SAFE_NOOP fallback on any error
 *
 * ALLOWED ACTIONS (exhaustive — this list never grows without code review):
 *   1. switch_model     — override model selection for future requests
 *   2. clamp_tokens     — set a max_tokens cap on the project/user
 *   3. enable_routing   — force routing_mode="smart" for this project
 *
 * INTEGRATION:
 *   Called from proxy-why-bridge.js AFTER WHY analysis completes.
 *   The only entry point: runAutopilot(whyLogId, whyOutput, proxyEvent, config)
 *
 * DB SCHEMA: see SQL comment at bottom.
 */

import { getSupabase } from "@/lib/db";
import { ROUTING_MODES } from "@/lib/model-router";

// ─────────────────────────────────────────────────────────────────────────────
// MODES
// ─────────────────────────────────────────────────────────────────────────────
export const AUTOPILOT_MODES = {
  OFF:         "off",          // no analysis, no action, no log
  RECOMMEND:   "recommend",    // analyse, log recommendation, do NOT execute
  AUTO_SAFE:   "auto_safe",    // analyse, execute if confidence > threshold
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE GATE
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum confidence % (integer) required to auto-execute in auto_safe mode. */
const CONFIDENCE_THRESHOLD = 80;

/**
 * parseConfidence(str)
 * Converts WHY engine confidence string ("84%") to integer (84).
 * Returns 0 on parse failure so auto-execution is safely blocked.
 */
function parseConfidence(str) {
  const n = parseInt(String(str || "0").replace("%", "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION CATALOGUE
// Every possible action the autopilot can take is defined here.
// NEVER add irreversible actions (delete, disable, terminate) to this list.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SAFE_ACTIONS
 *
 * Each entry defines:
 *   id          — unique stable identifier stored in DB
 *   label       — human-readable name
 *   reversible  — must always be true; guard for future safety audit
 *   shouldRun   — pure predicate: (whyOutput, proxyEvent) → boolean
 *   describe    — returns human-readable description of what will happen
 *   execute     — performs the actual change; returns { ok, detail }
 */
const SAFE_ACTIONS = [

  // ── Action 1: SWITCH MODEL ────────────────────────────────────────────────
  // Writes a routing override to autopilot_configs so the proxy router
  // uses the cheaper model for this project going forward.
  // Reversible: yes — delete the config row to revert.
  {
    id:         "switch_model",
    label:      "Switch to cheaper model",
    reversible: true,

    shouldRun: (whyOutput, proxyEvent) => {
      // Only act when original and routed models differ (routing was triggered)
      const originalModel = proxyEvent.original_model || proxyEvent.model;
      const routedModel   = proxyEvent.routed_model   || proxyEvent.model;
      return (
        Boolean(originalModel) &&
        Boolean(routedModel) &&
        originalModel !== routedModel &&
        Boolean(proxyEvent.savings_usd > 0)
      );
    },

    describe: (whyOutput, proxyEvent) => {
      const from = proxyEvent.original_model || proxyEvent.model;
      const to   = proxyEvent.routed_model   || "gpt-4o-mini";
      return `Override model: ${from} → ${to} for project ${proxyEvent.project_id || "default"}. Est. savings: $${Number(proxyEvent.savings_usd || 0).toFixed(4)}/call.`;
    },

    execute: async (whyOutput, proxyEvent, sb) => {
      const from      = proxyEvent.original_model || proxyEvent.model;
      const to        = proxyEvent.routed_model   || "gpt-4o-mini";
      const projectId = proxyEvent.project_id     || null;
      const userId    = proxyEvent.user_id        || null;

      if (!sb) return { ok: true, detail: "demo_mode — config write skipped", simulated: true };

      // Upsert into autopilot_configs — the proxy reads this table on each request
      const { error } = await sb.from("autopilot_configs").upsert([{
        project_id:       projectId,
        user_id:          userId,
        config_key:       "model_override",
        config_value:     JSON.stringify({ from, to, enabled: true }),
        applied_by:       "autopilot_v1",
        updated_at:       new Date().toISOString(),
      }], { onConflict: "project_id,config_key" });

      if (error) return { ok: false, detail: error.message };
      return { ok: true, detail: `Model override set: ${from} → ${to}` };
    },
  },

  // ── Action 2: CLAMP TOKENS ────────────────────────────────────────────────
  // Sets a max_tokens cap for the project to prevent runaway token usage.
  // Reversible: yes — update config_value to remove cap.
  {
    id:         "clamp_tokens",
    label:      "Apply max_tokens cap",
    reversible: true,

    shouldRun: (whyOutput, proxyEvent) => {
      // Only clamp when total_tokens is unusually high for a single call
      const CLAMP_TOKEN_THRESHOLD = 4000;
      return Number(proxyEvent.total_tokens || 0) > CLAMP_TOKEN_THRESHOLD;
    },

    describe: (whyOutput, proxyEvent) => {
      const currentTokens = proxyEvent.total_tokens || 0;
      const cap = Math.ceil(currentTokens * 0.6); // cap at 60% of current peak
      return `Apply max_tokens=${cap} cap for project ${proxyEvent.project_id || "default"} (current peak: ${currentTokens} tokens).`;
    },

    execute: async (whyOutput, proxyEvent, sb) => {
      const currentTokens = Number(proxyEvent.total_tokens || 0);
      const cap           = Math.ceil(currentTokens * 0.6);
      const projectId     = proxyEvent.project_id || null;
      const userId        = proxyEvent.user_id    || null;

      if (!sb) return { ok: true, detail: `demo_mode — token cap ${cap} not persisted`, simulated: true };

      const { error } = await sb.from("autopilot_configs").upsert([{
        project_id:   projectId,
        user_id:      userId,
        config_key:   "max_tokens",
        config_value: JSON.stringify({ cap, enabled: true }),
        applied_by:   "autopilot_v1",
        updated_at:   new Date().toISOString(),
      }], { onConflict: "project_id,config_key" });

      if (error) return { ok: false, detail: error.message };
      return { ok: true, detail: `Token cap applied: max_tokens=${cap}` };
    },
  },

  // ── Action 3: ENABLE ROUTING ──────────────────────────────────────────────
  // Forces routing_mode="smart" for this project so all future requests
  // through the proxy go through the routing engine.
  // Reversible: yes — set routing_mode="off" in config.
  {
    id:         "enable_routing",
    label:      "Enable smart routing",
    reversible: true,

    shouldRun: (whyOutput, proxyEvent) => {
      // Enable routing when it wasn't already on for this call
      return proxyEvent.routing_mode !== ROUTING_MODES.SMART;
    },

    describe: (whyOutput, proxyEvent) => {
      return `Enable smart routing (routing_mode="smart") for project ${proxyEvent.project_id || "default"} — model downgrade rules will apply to all future requests.`;
    },

    execute: async (whyOutput, proxyEvent, sb) => {
      const projectId = proxyEvent.project_id || null;
      const userId    = proxyEvent.user_id    || null;

      if (!sb) return { ok: true, detail: "demo_mode — routing config not persisted", simulated: true };

      const { error } = await sb.from("autopilot_configs").upsert([{
        project_id:   projectId,
        user_id:      userId,
        config_key:   "routing_mode",
        config_value: JSON.stringify({ mode: "smart", enabled: true }),
        applied_by:   "autopilot_v1",
        updated_at:   new Date().toISOString(),
      }], { onConflict: "project_id,config_key" });

      if (error) return { ok: false, detail: error.message };
      return { ok: true, detail: "Smart routing enabled for project" };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DB WRITER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * logAutopilotAction(record)
 * Inserts one row into autopilot_actions. Fire-and-forget — never throws.
 */
async function logAutopilotAction(record) {
  try {
    const sb = getSupabase();
    if (!sb) {
      console.info(`[autopilot] demo_mode — action logged locally: ${record.action_id} | ${record.status}`);
      return null;
    }

    const { data, error } = await sb.from("autopilot_actions").insert([record]).select("id").single();
    if (error) {
      console.error("[autopilot] autopilot_actions insert failed:", error.message);
      return null;
    }
    console.info(`[autopilot] action logged | id=${data?.id} | ${record.action_id} | status=${record.status}`);
    return data?.id || null;
  } catch (err) {
    console.error("[autopilot] logAutopilotAction exception:", err?.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE AUTOPILOT RUNNER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * runAutopilot(whyLogId, whyOutput, proxyEvent, config)
 *
 * THE ONLY ENTRY POINT called by the proxy-why-bridge after WHY analysis.
 *
 * Flow:
 *   1. Mode gate — exit immediately if mode is "off"
 *   2. Confidence gate — extract confidence from WHY output
 *   3. For each SAFE_ACTION: check shouldRun()
 *   4. In "recommend" mode: log as "recommended", no execution
 *   5. In "auto_safe" mode + confidence > 80%: execute + log result
 *   6. In "auto_safe" mode + confidence ≤ 80%: log as "blocked_low_confidence"
 *
 * Fire-and-forget — never throws, never affects response latency.
 *
 * @param {string} whyLogId     - FK → why_logs.id
 * @param {object} whyOutput    - { why, impact, action, decision, confidence, priority }
 * @param {object} proxyEvent   - Full proxy telemetry
 * @param {object} [config]     - { mode: "off"|"recommend"|"auto_safe" }
 */
export async function runAutopilot(whyLogId, whyOutput, proxyEvent, config = {}) {
  try {
    const mode = config?.mode ?? AUTOPILOT_MODES.RECOMMEND; // default: recommend only

    // ── 1. Mode gate ──────────────────────────────────────────────────────────
    if (mode === AUTOPILOT_MODES.OFF) return;

    // ── 2. Confidence gate ────────────────────────────────────────────────────
    const confidence   = parseConfidence(whyOutput?.confidence);
    const canAutoAct   = mode === AUTOPILOT_MODES.AUTO_SAFE && confidence > CONFIDENCE_THRESHOLD;

    console.info(
      `[autopilot] mode=${mode} | confidence=${confidence}% | canAutoAct=${canAutoAct} | why_log=${whyLogId}`
    );

    const sb = getSupabase(); // may be null in demo mode

    // ── 3. Evaluate each allowed action ───────────────────────────────────────
    for (const action of SAFE_ACTIONS) {

      let shouldRun = false;
      try {
        shouldRun = action.shouldRun(whyOutput, proxyEvent);
      } catch (err) {
        console.warn(`[autopilot] shouldRun error for ${action.id}:`, err?.message);
        continue;
      }

      if (!shouldRun) continue;

      const description = (() => {
        try { return action.describe(whyOutput, proxyEvent); }
        catch { return action.label; }
      })();

      // ── 4. RECOMMEND mode — log without executing ──────────────────────────
      if (mode === AUTOPILOT_MODES.RECOMMEND) {
        await logAutopilotAction({
          why_log_id:    whyLogId,
          run_id:        proxyEvent.run_id        || null,
          user_id:       proxyEvent.user_id       || null,
          project_id:    proxyEvent.project_id    || null,
          action_id:     action.id,
          action_label:  action.label,
          description,
          status:        "recommended",
          confidence_pct: confidence,
          mode,
          reversible:    action.reversible,
          result:        null,
          error_msg:     null,
        });
        continue;
      }

      // ── 5. AUTO_SAFE mode — check confidence, then execute ─────────────────
      if (!canAutoAct) {
        // confidence ≤ 80% — block execution, log the block
        await logAutopilotAction({
          why_log_id:    whyLogId,
          run_id:        proxyEvent.run_id     || null,
          user_id:       proxyEvent.user_id    || null,
          project_id:    proxyEvent.project_id || null,
          action_id:     action.id,
          action_label:  action.label,
          description,
          status:        "blocked_low_confidence",
          confidence_pct: confidence,
          mode,
          reversible:    action.reversible,
          result:        null,
          error_msg:     `Confidence ${confidence}% ≤ ${CONFIDENCE_THRESHOLD}% threshold`,
        });
        continue;
      }

      // ── Execute ──────────────────────────────────────────────────────────────
      let execResult = { ok: false, detail: "not_run" };
      try {
        execResult = await action.execute(whyOutput, proxyEvent, sb);
      } catch (err) {
        execResult = { ok: false, detail: err?.message || "execution_error" };
      }

      await logAutopilotAction({
        why_log_id:    whyLogId,
        run_id:        proxyEvent.run_id     || null,
        user_id:       proxyEvent.user_id    || null,
        project_id:    proxyEvent.project_id || null,
        action_id:     action.id,
        action_label:  action.label,
        description,
        status:        execResult.ok ? "executed" : "failed",
        confidence_pct: confidence,
        mode,
        reversible:    action.reversible,
        result:        execResult.detail || null,
        error_msg:     execResult.ok ? null : execResult.detail,
      });

      if (execResult.ok) {
        console.info(`[autopilot] ✓ executed: ${action.id} | ${execResult.detail}`);
      } else {
        console.error(`[autopilot] ✗ failed: ${action.id} | ${execResult.detail}`);
      }
    }

  } catch (err) {
    // Never crash anything upstream — autopilot is best-effort
    console.error("[autopilot] runAutopilot exception:", err?.message);
  }
}

/**
 * getAutopilotConfig(projectId)
 *
 * Reads the current autopilot mode + all active configs for a project.
 * Used by the proxy to check token caps and routing overrides.
 * Returns null (safe) on DB error or missing config.
 *
 * @param {string} projectId
 * @returns {Promise<object|null>}
 */
export async function getAutopilotConfig(projectId) {
  try {
    const sb = getSupabase();
    if (!sb || !projectId) return null;

    const { data, error } = await sb
      .from("autopilot_configs")
      .select("config_key, config_value")
      .eq("project_id", projectId);

    if (error || !data?.length) return null;

    // Materialise into a flat object: { model_override: {...}, max_tokens: {...}, routing_mode: {...} }
    return data.reduce((acc, row) => {
      try { acc[row.config_key] = JSON.parse(row.config_value); }
      catch { acc[row.config_key] = row.config_value; }
      return acc;
    }, {});
  } catch {
    return null;
  }
}

/*
 * ═══════════════════════════════════════════════════════════════════
 * SUPABASE MIGRATION — run once
 * ═══════════════════════════════════════════════════════════════════
 *
 * -- autopilot_actions: full audit log of every decision made
 * CREATE TABLE IF NOT EXISTS autopilot_actions (
 *   id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *
 *   -- Links
 *   why_log_id      uuid REFERENCES why_logs(id)      ON DELETE SET NULL,
 *   run_id          uuid REFERENCES ai_usage_logs(id)  ON DELETE SET NULL,
 *   user_id         text,
 *   project_id      text,
 *
 *   -- Action identity
 *   action_id       text NOT NULL,    -- "switch_model" | "clamp_tokens" | "enable_routing"
 *   action_label    text,
 *   description     text,             -- human-readable summary of what was/would be done
 *
 *   -- Decision outcome
 *   status          text NOT NULL,    -- "recommended" | "executed" | "blocked_low_confidence" | "failed"
 *   confidence_pct  integer DEFAULT 0,
 *   mode            text NOT NULL,    -- "recommend" | "auto_safe"
 *   reversible      boolean DEFAULT true,
 *
 *   -- Execution result
 *   result          text,             -- detail string from execute()
 *   error_msg       text,             -- non-null when status="failed"
 *
 *   created_at      timestamptz DEFAULT now()
 * );
 *
 * CREATE INDEX ON autopilot_actions (why_log_id);
 * CREATE INDEX ON autopilot_actions (run_id);
 * CREATE INDEX ON autopilot_actions (project_id, created_at DESC);
 * CREATE INDEX ON autopilot_actions (status, created_at DESC);
 * CREATE INDEX ON autopilot_actions (action_id, created_at DESC);
 *
 *
 * -- autopilot_configs: active config overrides applied by the autopilot
 * CREATE TABLE IF NOT EXISTS autopilot_configs (
 *   id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   project_id      text,
 *   user_id         text,
 *   config_key      text NOT NULL,    -- "model_override" | "max_tokens" | "routing_mode"
 *   config_value    jsonb NOT NULL,   -- { from, to, enabled } | { cap, enabled } | { mode, enabled }
 *   applied_by      text DEFAULT 'autopilot_v1',
 *   updated_at      timestamptz DEFAULT now(),
 *
 *   UNIQUE (project_id, config_key)   -- one config per project per key
 * );
 *
 * CREATE INDEX ON autopilot_configs (project_id);
 *
 * ═══════════════════════════════════════════════════════════════════
 */
