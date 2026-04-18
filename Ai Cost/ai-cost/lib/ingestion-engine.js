import { buildCostIntelligence } from "@/lib/cost-engine";
import { detectCostAnomaly }    from "@/lib/detection-engine";
import { buildContext }          from "@/lib/context-builder";
import { generateWhyDecision }   from "@/lib/why-engine";
import { formatDecisionOutput }  from "@/lib/output-formatter";
import { getPricePerThousand }   from "@/lib/model-pricing";
import { evaluateRules, generateSuggestions, applyAction } from "@/lib/autopilot-engine";

// ─── Supabase (lazy, never throws) ───────────────────────────────────────
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

// ─── Constants ────────────────────────────────────────────────────────────
// Minimum records before pipeline runs (prevents single-point noise).
const MIN_RECORDS = 3;

// If total session cost exceeds this threshold, run WHY even without an anomaly.
const WHY_COST_THRESHOLD = 0.5; // USD

// ─── Step A: Normalize raw input ─────────────────────────────────────────
/**
 * Accepts the full Claude-aligned body and returns a clean internal record.
 * Handles:
 *   • input_tokens + output_tokens → tokens
 *   • auto cost calculation if cost is missing/zero
 *   • pass-through of future-ready fields (agent_id, run_id, etc.)
 *
 * @throws {Error} if model or final token count is invalid
 */
function normalizeInput(raw) {
  // ── model ──────────────────────────────────────────────────────────────
  const model = String(raw?.model || "").trim();
  if (!model) throw new Error("Field 'model' is required.");

  // ── tokens ─────────────────────────────────────────────────────────────
  const inputTok  = Number(raw?.input_tokens  ?? NaN);
  const outputTok = Number(raw?.output_tokens ?? NaN);
  let tokens;

  if (Number.isFinite(inputTok) && Number.isFinite(outputTok)) {
    tokens = inputTok + outputTok; // preferred: split counts provided
  } else {
    tokens = Number(raw?.tokens ?? NaN);
  }

  if (!Number.isFinite(tokens) || tokens < 0) {
    throw new Error(
      "Provide 'tokens' (total) OR both 'input_tokens' and 'output_tokens' as non-negative numbers."
    );
  }

  // ── cost ───────────────────────────────────────────────────────────────
  const rawCost = Number(raw?.cost ?? NaN);
  const cost = Number.isFinite(rawCost) && rawCost > 0
    ? rawCost
    : parseFloat(((tokens / 1000) * getPricePerThousand(model)).toFixed(6));

  // ── session + metadata ─────────────────────────────────────────────────
  const sessionId = String(raw?.session_id || crypto.randomUUID());

  return {
    // core pipeline fields
    model,
    tokens,
    cost,
    sessionId,
    timestamp: Number(raw?.timestamp) || Date.now(),

    // future-ready — stored as placeholders, not yet used in pipeline
    agentId:    raw?.agent_id    ?? null,
    runId:      raw?.run_id      ?? null,
    userId:     raw?.user_id     ?? null,
    latencyMs:  Number(raw?.latency_ms ?? NaN) || null,
    metadata:   raw?.metadata    ?? null,
    source:     String(raw?.source || "ingest"),
  };
}

// ─── Step B: Store single record in ai_usage_logs ────────────────────────
// Includes org_id when available (column added via ALTER TABLE IF NOT EXISTS).
async function storeRecord(rec, orgId = null) {
  const sb = getSupabase();
  if (!sb) {
    console.log("[ingestion-engine] DB not configured — skipping persist");
    return;
  }

  const row = {
    session_id: rec.sessionId,
    model:      rec.model,
    tokens:     rec.tokens,
    cost:       rec.cost,
    source:     rec.source,
    created_at: new Date(rec.timestamp).toISOString(),
  };
  if (orgId) row.org_id = orgId;

  const { error } = await sb.from("ai_usage_logs").insert([row]);

  if (error) {
    console.error("[ingestion-engine] ai_usage_logs insert failed:", error.message);
  }

  // Future-ready: log placeholders (will write to DB when schema is extended)
  if (rec.agentId || rec.runId || rec.userId || rec.metadata) {
    console.log("[ingestion-engine] future fields (not yet persisted):", {
      agent_id:   rec.agentId,
      run_id:     rec.runId,
      user_id:    rec.userId,
      latency_ms: rec.latencyMs,
      metadata:   rec.metadata,
    });
  }
}

// ─── Step C: Fetch all logs for session ──────────────────────────────────
async function fetchSessionRecords(sessionId) {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("ai_usage_logs")
    .select("model, tokens, cost, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[ingestion-engine] fetch session records failed:", error.message);
    return [];
  }

  return (data || []).map((r) => ({
    model:  r.model,
    tokens: Number(r.tokens),
    cost:   Number(r.cost),
  }));
}

// ─── Aggregate helper: sum tokens+cost per model ─────────────────────────
// Groups session records by model so the pipeline sees one row per model
// when the same model appears multiple times in a session.
function aggregateByModel(records) {
  const map = new Map();
  for (const r of records) {
    const key = r.model;
    if (!map.has(key)) {
      map.set(key, { model: r.model, tokens: 0, cost: 0 });
    }
    const entry = map.get(key);
    entry.tokens += r.tokens;
    entry.cost   += r.cost;
  }
  return Array.from(map.values());
}

// ─── Step G: Persist analysis result ─────────────────────────────────────
function storeAnalysisResult(sessionId, formatted, costIntelligence, anomaly, orgId = null) {
  const sb = getSupabase();
  if (!sb) return;

  const row = {
    session_id:        sessionId,
    anomaly_type:      anomaly.type,
    priority:          formatted.priority,
    why:               formatted.why,
    impact:            formatted.impact,
    action:            formatted.action,
    decision:          formatted.decision,
    confidence:        formatted.confidence,
    total_cost:        costIntelligence.totalCost,
    estimated_savings: costIntelligence.estimatedSavings,
  };
  if (orgId) row.org_id = orgId;

  sb.from("analysis_results").insert([row])
  .then(({ error }) => {
    if (error) console.error("[ingestion-engine] analysis_results insert failed:", error.message);
  })
  .catch((err) => {
    console.error("[ingestion-engine] analysis_results unexpected error:", err);
  });
}

// ─── WHY engine — isolated, never throws to caller ───────────────────────
async function safeGenerateDecision(costIntelligence, anomaly, usageArray) {
  try {
    const ctx      = buildContext(costIntelligence, anomaly, usageArray);
    const why      = await generateWhyDecision(ctx);
    const formatted = formatDecisionOutput(
      { ...costIntelligence, ...why },
      anomaly
    );
    return { ok: true, formatted };
  } catch (err) {
    console.error("[ingestion-engine] WHY engine failed (non-fatal):", err?.message);
    return { ok: false, error: err?.message || "WHY engine error" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// processIngestion — main export
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Full Claude-aligned ingestion pipeline.
 *
 * Flow:
 *   A. Normalize + validate input
 *   B. Store in ai_usage_logs
 *   C. Fetch all session records
 *   D. Aggregate by model (sum tokens + cost)
 *   E. Run buildCostIntelligence + detectCostAnomaly
 *   F. Decide whether to run WHY (anomaly OR total > threshold)
 *   G. Run WHY pipeline (isolated — ingest never fails because of it)
 *   H. Store result in analysis_results
 *   I. Return { session_id, anomaly_detected, decision, status }
 *
 * @param {object} data           - Raw request body (Claude-aligned schema)
 * @param {object} [opts]
 * @param {string|null} [opts.orgId] - org_id from auth context (null = anonymous)
 * @returns {Promise<object>}
 */
export async function processIngestion(data, { orgId = null } = {}) {
  // ── A: Normalize ───────────────────────────────────────────────────────
  // Throws only on hard validation failures (missing model / bad tokens).
  const rec = normalizeInput(data);

  console.log(`[ingestion-engine] session=${rec.sessionId} model=${rec.model} tokens=${rec.tokens} cost=${rec.cost} org=${orgId || "anon"}`);

  // ── B: Persist record ─────────────────────────────────────────────────
  await storeRecord(rec, orgId);

  // ── C: Fetch full session history ─────────────────────────────────────
  const sessionRecords = await fetchSessionRecords(rec.sessionId);

  // If DB is not configured, work with just this record
  const rawUsage    = sessionRecords.length > 0 ? sessionRecords : [rec];
  const recordCount = rawUsage.length;

  // ── D: Aggregate tokens + cost by model ───────────────────────────────
  const usageArray = aggregateByModel(rawUsage);

  // ── E: Cost intelligence + anomaly detection ──────────────────────────
  const costIntelligence = buildCostIntelligence(usageArray);

  const anomaly = detectCostAnomaly({
    usage:        usageArray,
    currentCost:  costIntelligence.latestCost,
    previousCost: costIntelligence.previousCost,
    costByModel:  costIntelligence.costByModel,
    totalCost:    costIntelligence.totalCost,
  });

  const totalCost       = Number(costIntelligence.totalCost || 0);
  const anomalyDetected = anomaly.isAnomaly;

  // ── Early exit: not enough data and cost is low ───────────────────────
  // Collect more records before running the full pipeline.
  const exceedsCostThreshold = totalCost > WHY_COST_THRESHOLD;
  const hasEnoughRecords     = recordCount >= MIN_RECORDS;

  if (!hasEnoughRecords && !exceedsCostThreshold) {
    return {
      status:           "collecting",
      session_id:       rec.sessionId,
      anomaly_detected: anomalyDetected,
      record_count:     recordCount,
      total_cost:       totalCost,
      decision:         null,
      message:          `Collecting data — ${recordCount}/${MIN_RECORDS} records. Send more data or increase cost volume.`,
    };
  }

  // ── F: Decide whether to run WHY engine ───────────────────────────────
  const shouldRunWhy = anomalyDetected || exceedsCostThreshold;

  if (!shouldRunWhy) {
    return {
      status:           "ok",
      session_id:       rec.sessionId,
      anomaly_detected: false,
      record_count:     recordCount,
      total_cost:       totalCost,
      decision:         null,
      message:          "No anomaly detected and cost is below threshold. Pipeline healthy.",
    };
  }

  // ── G: WHY pipeline (isolated — never crashes ingest) ─────────────────
  const whyResult = await safeGenerateDecision(costIntelligence, anomaly, usageArray);

  if (!whyResult.ok) {
    // WHY engine failed — return partial result, do not surface 500 to caller
    return {
      status:           "partial",
      session_id:       rec.sessionId,
      anomaly_detected: anomalyDetected,
      record_count:     recordCount,
      total_cost:       totalCost,
      decision:         null,
      why_error:        whyResult.error,
      message:          "Anomaly detected but WHY generation failed. Check OpenAI configuration.",
    };
  }

  const { formatted } = whyResult;

  // ── H: Persist analysis result (fire-and-forget) ─────────────────────
  storeAnalysisResult(rec.sessionId, formatted, costIntelligence, anomaly, orgId);

  const decisionPayload = {
    ...formatted,
    totalCost:        totalCost,
    estimatedSavings: costIntelligence.estimatedSavings,
    anomalyType:      anomaly.type,
  };

  // ── I: Autopilot advisory layer (fire-and-forget) ───────────────────────
  // Runs in background — never blocks or throws to caller.
  let autopilotResult = null;
  try {
    const [matchedRules, suggestions] = await Promise.all([
      evaluateRules(decisionPayload, orgId),
      Promise.resolve(generateSuggestions(decisionPayload)),
    ]);
    for (const rule of matchedRules) {
      await applyAction(rule, decisionPayload, orgId).catch(() => {});
    }
    autopilotResult = {
      suggestions,
      rules_triggered: matchedRules.length,
      note: "Advisory mode — no automatic changes applied.",
    };
  } catch (err) {
    console.error("[ingestion-engine] autopilot failed (non-fatal):", err?.message);
  }

  // ── J: Return spec-aligned response ──────────────────────────────────
  return {
    status:           "decision",
    session_id:       rec.sessionId,
    anomaly_detected: anomalyDetected,
    record_count:     recordCount,
    total_cost:       totalCost,
    decision:         decisionPayload,
    autopilot:        autopilotResult,
  };
}
