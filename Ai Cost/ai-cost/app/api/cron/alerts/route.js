import { NextResponse } from "next/server";
import { shouldAlert, sendSlackAlert, sendEmailAlert, logAlert } from "@/lib/alert-engine";

/**
 * Vercel Cron — alerts for high-priority unalerted analysis results.
 *
 * Add to vercel.json:
 * {
 *   "crons": [{ "path": "/api/cron/alerts", "schedule": "*/5 * * * *" }]
 * }
 *
 * Behavior:
 *  1. Fetch analysis_results rows not yet in alert_log
 *  2. Filter by shouldAlert() (priority + cost threshold)
 *  3. Send Slack / email alerts for each
 *  4. Write to alert_log (idempotent via session_id dedup)
 *
 * Env vars required:
 *   SLACK_WEBHOOK_URL     — Slack incoming webhook
 *   ALERT_EMAIL           — recipient email address (placeholder)
 *   CRON_SECRET           — blocks external callers
 */

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

// ── Fetch unalerted analysis results (last 24h) ───────────────────────────
async function fetchUnalertedResults(sb) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Get all results from last 24h
  const { data: results, error: rErr } = await sb
    .from("analysis_results")
    .select("session_id, priority, why, impact, decision, confidence, anomaly_type, total_cost, estimated_savings, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (rErr) throw new Error(`fetch analysis_results failed: ${rErr.message}`);
  if (!results?.length) return [];

  // Get session IDs that already have an alert_log entry
  const ids = results.map((r) => r.session_id);
  const { data: alerted, error: aErr } = await sb
    .from("alert_log")
    .select("session_id")
    .in("session_id", ids);

  if (aErr) {
    // Non-fatal — alert_log may not exist yet. Log and continue.
    console.warn("[cron/alerts] alert_log fetch failed (table may not exist yet):", aErr.message);
    return results; // treat all as unalerted
  }

  const alertedIds = new Set((alerted || []).map((a) => a.session_id));
  return results.filter((r) => !alertedIds.has(r.session_id));
}

export async function GET(request) {
  // Validate cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL || "";
  const alertEmail = process.env.ALERT_EMAIL || "";
  const startedAt  = Date.now();
  const summary    = { checked: 0, alerted: 0, skipped: 0, failed: 0 };

  try {
    const candidates = await fetchUnalertedResults(sb);
    summary.checked  = candidates.length;

    for (const result of candidates) {
      if (!shouldAlert(result)) {
        summary.skipped++;
        continue;
      }

      let alertOk = false;

      // ── Slack ─────────────────────────────────────────────────────────
      if (webhookUrl) {
        const slackResult = await sendSlackAlert(result, webhookUrl);
        if (slackResult.ok) {
          alertOk = true;
          await logAlert(sb, { sessionId: result.session_id, channel: "slack", destination: webhookUrl, result, success: true });
        } else {
          console.error(`[cron/alerts] Slack failed for ${result.session_id}:`, slackResult.error);
          await logAlert(sb, { sessionId: result.session_id, channel: "slack", destination: webhookUrl, result, success: false, errorMsg: slackResult.error });
        }
      }

      // ── Email (placeholder) ───────────────────────────────────────────
      if (alertEmail) {
        const emailResult = await sendEmailAlert(result, alertEmail);
        if (emailResult.ok) {
          alertOk = true;
          await logAlert(sb, { sessionId: result.session_id, channel: "email", destination: alertEmail, result, success: true });
        } else {
          console.error(`[cron/alerts] email failed for ${result.session_id}:`, emailResult.error);
          await logAlert(sb, { sessionId: result.session_id, channel: "email", destination: alertEmail, result, success: false, errorMsg: emailResult.error });
        }
      }

      if (!webhookUrl && !alertEmail) {
        console.warn(`[cron/alerts] No alert channels configured. Set SLACK_WEBHOOK_URL or ALERT_EMAIL.`);
      }

      if (alertOk) summary.alerted++;
      else summary.failed++;
    }
  } catch (err) {
    console.error("[cron/alerts] fatal error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, duration_ms: Date.now() - startedAt, ...summary });
}
