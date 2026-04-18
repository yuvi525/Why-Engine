import { NextResponse } from "next/server";
import { buildCostIntelligence } from "@/lib/cost-engine";
import { detectCostAnomaly }    from "@/lib/detection-engine";
import { buildContext }          from "@/lib/context-builder";
import { generateWhyDecision }   from "@/lib/why-engine";
import { formatDecisionOutput }  from "@/lib/output-formatter";

/**
 * Vercel Cron — runs every 5 minutes.
 *
 * Add to vercel.json:
 * {
 *   "crons": [{ "path": "/api/cron/monitor", "schedule": "*/5 * * * *" }]
 * }
 *
 * Behavior:
 *  1. Fetch ai_usage_logs from last 24 hours
 *  2. Group by session_id
 *  3. Find sessions that have NO row in analysis_results (unprocessed)
 *  4. For each unprocessed session with ≥ 3 records:
 *     → run cost intelligence + anomaly detection + WHY pipeline
 *     → store result in analysis_results
 *  5. Return a processing summary (idempotent — safe to re-run)
 *
 * Security: Vercel automatically adds "Authorization: Bearer <CRON_SECRET>"
 * when invoking cron routes. Validate it here to block external callers.
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

const MIN_RECORDS = 3;

// ── Fetch recent usage logs (last 24 h) ───────────────────────────────────
async function fetchRecentLogs(sb) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("ai_usage_logs")
    .select("session_id, model, tokens, cost, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`fetch logs failed: ${error.message}`);
  return data || [];
}

// ── Fetch session IDs already in analysis_results ────────────────────────
async function fetchProcessedSessions(sb, sessionIds) {
  if (!sessionIds.length) return new Set();
  const { data, error } = await sb
    .from("analysis_results")
    .select("session_id")
    .in("session_id", sessionIds);

  if (error) throw new Error(`fetch results failed: ${error.message}`);
  return new Set((data || []).map((r) => r.session_id));
}

// ── Group logs by session_id ──────────────────────────────────────────────
function groupBySession(logs) {
  const map = new Map();
  for (const row of logs) {
    if (!map.has(row.session_id)) map.set(row.session_id, []);
    map.get(row.session_id).push({ model: row.model, tokens: Number(row.tokens), cost: Number(row.cost) });
  }
  return map;
}

// ── Run pipeline for one session ─────────────────────────────────────────
async function processSession(sb, sessionId, records) {
  const costIntelligence = buildCostIntelligence(records);
  const anomaly = detectCostAnomaly({
    usage:        records,
    currentCost:  costIntelligence.latestCost,
    previousCost: costIntelligence.previousCost,
    costByModel:  costIntelligence.costByModel,
    totalCost:    costIntelligence.totalCost,
  });

  if (!anomaly.isAnomaly) return { skipped: true, reason: "no_anomaly" };

  const ctx      = buildContext(costIntelligence, anomaly, records);
  const why      = await generateWhyDecision(ctx);
  const formatted = formatDecisionOutput({ ...costIntelligence, ...why }, anomaly);

  // Fire-and-forget persist
  sb.from("analysis_results").insert([{
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
  }]).then(({ error }) => {
    if (error) console.error(`[cron/monitor] insert failed for ${sessionId}:`, error.message);
  });

  return { skipped: false, priority: formatted.priority, anomalyType: anomaly.type };
}

// ── Handler ───────────────────────────────────────────────────────────────
export async function GET(request) {
  // Validate cron secret (Vercel sets this automatically; block external calls)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const startedAt = Date.now();
  const summary = { processed: 0, skipped: 0, failed: 0, sessions: [] };

  try {
    const logs            = await fetchRecentLogs(sb);
    const sessionMap      = groupBySession(logs);
    const allIds          = [...sessionMap.keys()];
    const processedIds    = await fetchProcessedSessions(sb, allIds);

    // Only sessions not yet in analysis_results with enough records
    const unprocessed = allIds.filter(
      (id) => !processedIds.has(id) && sessionMap.get(id).length >= MIN_RECORDS
    );

    console.log(`[cron/monitor] ${logs.length} logs → ${allIds.length} sessions → ${unprocessed.length} to process`);

    for (const sessionId of unprocessed) {
      try {
        const result = await processSession(sb, sessionId, sessionMap.get(sessionId));
        if (result.skipped) {
          summary.skipped++;
        } else {
          summary.processed++;
          summary.sessions.push({ sessionId, priority: result.priority, anomalyType: result.anomalyType });
        }
      } catch (err) {
        console.error(`[cron/monitor] session ${sessionId} failed:`, err.message);
        summary.failed++;
      }
    }
  } catch (err) {
    console.error("[cron/monitor] fatal error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - startedAt,
    ...summary,
  });
}
