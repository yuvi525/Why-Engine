/**
 * lib/system-validator.js
 *
 * runSystemValidation() — runs all 7 checks, never throws.
 * All errors are caught and surfaced in the report.
 */

import { supabase } from "@/lib/supabase-browser";
import { DEMO_ANALYSIS_RESULTS, generateDemoRun, DEMO_AGENTS } from "@/lib/demo-data";
import { COPY_MAP } from "@/lib/brand-constants";

const ALL_TABLES = [
  "ai_usage_logs", "analysis_results", "anomaly_events",
  "orgs", "org_members", "api_keys", "usage_events",
  "autopilot_rules", "autopilot_log", "alert_log",
  "user_settings", "cron_logs",
];

const BANNED_WORDS = ["Analyze", "Dashboard", "Result", "Cost "];

// ── Check A — Pipeline connectivity ──────────────────────────────────────
async function checkPipeline() {
  const details = [];
  let status = "pass";
  try {
    // canReachIngest: expect 4xx (not 5xx)
    const r1 = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bad: "payload" }),
    }).catch(() => null);
    if (!r1) { details.push("ingest: unreachable"); status = "fail"; }
    else if (r1.status >= 500) { details.push(`ingest: returned ${r1.status} (expected 4xx)`); status = "fail"; }
    else details.push(`ingest: ${r1.status} ✓`);

    // canReachAnalyze: expect 4xx
    const r2 = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => null);
    if (!r2) { details.push("analyze: unreachable"); status = "fail"; }
    else if (r2.status >= 500) { details.push(`analyze: returned ${r2.status} (expected 4xx)`); status = "fail"; }
    else details.push(`analyze: ${r2.status} ✓`);

    // canReachCron: expect 401 (wrong secret)
    const r3 = await fetch("/api/cron/monitor", {
      headers: { "x-cron-secret": "wrong-secret" },
    }).catch(() => null);
    if (!r3) { details.push("cron/monitor: unreachable"); status = "warn"; }
    else if (r3.status === 401) details.push("cron/monitor: 401 ✓ (auth works)");
    else { details.push(`cron/monitor: ${r3.status} (expected 401)`); if (status !== "fail") status = "warn"; }

  } catch (err) {
    details.push(`Error: ${err.message}`);
    status = "fail";
  }
  return { status, details: details.join(" | ") };
}

// ── Check B — Database tables ─────────────────────────────────────────────
async function checkDatabase() {
  const missing = [];
  const checked = [];
  try {
    await Promise.all(ALL_TABLES.map(async (table) => {
      try {
        const { error } = await supabase.from(table).select("id").limit(1);
        if (error?.code === "42P01") missing.push(table);
        else checked.push(table);
      } catch {
        missing.push(table);
      }
    }));
  } catch (err) {
    return { status: "fail", missing_tables: ALL_TABLES, details: `DB check failed: ${err.message}` };
  }

  const status = missing.length === 0 ? "pass"
    : missing.length <= 3 ? "warn"
    : "fail";
  return {
    status,
    missing_tables: missing,
    details: missing.length === 0
      ? `All ${ALL_TABLES.length} tables verified.`
      : `${missing.length} tables missing: ${missing.join(", ")}`,
  };
}

// ── Check C — Auth ────────────────────────────────────────────────────────
async function checkAuth() {
  try {
    await supabase.auth.getSession();
    return { status: "pass", details: "supabase.auth.getSession() resolved without error." };
  } catch (err) {
    return { status: "fail", details: `Auth check failed: ${err.message}` };
  }
}

// ── Check D — Stripe config ───────────────────────────────────────────────
function checkStripe() {
  const required = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_GROWTH_ID",
    "STRIPE_PRICE_SCALE_ID",
  ];
  // On client, only NEXT_PUBLIC_ vars are available. Check what we can.
  const missing = [];
  // We test via /api/validate which has server-side access
  return fetch("/api/validate").then(r => r.json()).then(d => {
    const vars = [];
    if (!d?.checks?.stripe) missing.push("STRIPE_SECRET_KEY");
    const status = missing.length === 0 ? "pass" : missing.length < 3 ? "warn" : "fail";
    return {
      status,
      missing_vars: missing,
      details: missing.length === 0
        ? "Stripe environment variables detected."
        : `Missing: ${missing.join(", ")}`,
    };
  }).catch(() => ({
    status: "warn",
    missing_vars: [],
    details: "Could not reach /api/validate to check Stripe config.",
  }));
}

// ── Check E — Demo mode ───────────────────────────────────────────────────
function checkDemo() {
  try {
    // Verify demo data length
    if (DEMO_ANALYSIS_RESULTS.length < 6) {
      return { status: "fail", details: `DEMO_ANALYSIS_RESULTS has ${DEMO_ANALYSIS_RESULTS.length} items (need >= 6)` };
    }
    // Verify each has root_causes
    const missing = DEMO_ANALYSIS_RESULTS.filter(r => !Array.isArray(r?.why_output?.root_causes));
    if (missing.length > 0) {
      return { status: "fail", details: `${missing.length} results missing why_output.root_causes` };
    }
    // Verify generateDemoRun returns required fields
    const run = generateDemoRun(DEMO_AGENTS[0]);
    const required = ["run_id", "session_id", "agent_id", "model", "tokens", "cost"];
    const missingFields = required.filter(f => !(f in run));
    if (missingFields.length > 0) {
      return { status: "fail", details: `generateDemoRun missing fields: ${missingFields.join(", ")}` };
    }
    return { status: "pass", details: `${DEMO_ANALYSIS_RESULTS.length} analysis results, generateDemoRun() verified.` };
  } catch (err) {
    return { status: "fail", details: `Demo check error: ${err.message}` };
  }
}

// ── Check F — Brand copy ──────────────────────────────────────────────────
function checkBrandCopy() {
  const REQUIRED_KEYS = [
    "analyze_button", "analyze_loading", "dashboard_title", "result_label",
    "cost_label", "anomaly_label", "cta_connect", "badge_active",
    "nav_dashboard", "nav_analyze", "nav_autopilot", "nav_usage",
    "empty_state", "severity_critical", "severity_high",
  ];
  const violations = [];
  const missingKeys = REQUIRED_KEYS.filter(k => !(k in COPY_MAP));
  if (missingKeys.length > 0) {
    violations.push(`Missing keys: ${missingKeys.join(", ")}`);
  }
  // Check no banned words in values
  Object.entries(COPY_MAP).forEach(([key, val]) => {
    BANNED_WORDS.forEach(word => {
      if (String(val).includes(word)) violations.push(`"${key}" contains banned word: "${word}"`);
    });
  });
  return {
    status: violations.length === 0 ? "pass" : "fail",
    violations,
    details: violations.length === 0
      ? `All ${REQUIRED_KEYS.length} keys present, no banned words found.`
      : violations.join(" | "),
  };
}

// ── Check G — Performance ─────────────────────────────────────────────────
function checkPerformance() {
  try {
    const agent = DEMO_AGENTS[0];
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) generateDemoRun(agent);
    const generate100ms = parseFloat((performance.now() - t0).toFixed(2));

    const status = generate100ms < 200 ? "pass" : "warn";
    return {
      status,
      generate_100_ms: generate100ms,
      details: `generateDemoRun × 100: ${generate100ms}ms (threshold: 200ms)`,
    };
  } catch (err) {
    return { status: "fail", generate_100_ms: -1, details: `Performance check error: ${err.message}` };
  }
}

// ── Score formula ─────────────────────────────────────────────────────────
function computeScore(checks) {
  let score = 100;
  if (checks.pipeline.status    === "fail") score -= 25;
  if (checks.database.status    === "fail") {
    const missing = (checks.database.missing_tables || []).length;
    score -= Math.min(20, missing * 2);
  }
  if (checks.auth.status        === "fail") score -= 15;
  if (checks.stripe.status      === "fail") {
    const missing = (checks.stripe.missing_vars || []).length;
    score -= Math.min(10, missing * 2.5);
  }
  if (checks.demo.status        === "fail") score -= 10;
  if (checks.brand_copy.status  === "fail") score -= 5;
  if (checks.performance.status === "warn" || checks.performance.status === "fail") score -= 5;
  return Math.max(0, Math.round(score));
}

// ── Main export ───────────────────────────────────────────────────────────
export async function runSystemValidation() {
  const timestamp = new Date().toISOString();

  const [pipeline, database, auth, stripe, performance_] = await Promise.all([
    checkPipeline().catch(e => ({ status: "fail", details: e.message })),
    checkDatabase().catch(e => ({ status: "fail", missing_tables: [], details: e.message })),
    checkAuth().catch(e => ({ status: "fail", details: e.message })),
    checkStripe().catch(e => ({ status: "fail", missing_vars: [], details: e.message })),
    Promise.resolve(checkPerformance()),
  ]);

  const demo       = checkDemo();
  const brand_copy = checkBrandCopy();

  const checks = { pipeline, database, auth, stripe, demo, brand_copy, performance: performance_ };
  const statuses = Object.values(checks).map(c => c.status);
  const passed   = statuses.filter(s => s === "pass").length;
  const failed   = statuses.filter(s => s === "fail").length;
  const warnings = statuses.filter(s => s === "warn").length;

  const readiness_score = computeScore(checks);

  return {
    timestamp,
    checks,
    summary: { total_checks: 7, passed, failed, warnings },
    readiness_score,
    production_ready: readiness_score >= 85,
  };
}
