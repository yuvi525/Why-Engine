import { NextResponse } from "next/server";
import { processIngestion } from "@/lib/ingestion-engine";
import { getUser, getUserOrg } from "@/lib/auth";
import { validateKey, trackUsage } from "@/lib/api-key-manager";

/**
 * POST /api/ingest
 *
 * Claude-aligned ingestion endpoint. Accepts a single usage event,
 * normalizes it, runs the full pipeline, and returns a decision.
 *
 * Auth priority (highest wins, all optional — backward compatible):
 *   1. API Key  (Authorization: Bearer whe_xxx) → org_id from api_keys table
 *   2. JWT      (Authorization: Bearer eyJ...) → org_id via Supabase auth
 *   3. Anonymous → org_id = null (legacy / demo mode)
 *
 * Body (all optional except model + tokens):
 * {
 *   model:          string   — required
 *   tokens?:        number   — total tokens (fallback if split not provided)
 *   input_tokens?:  number   — input token count
 *   output_tokens?: number   — output token count
 *   cost?:          number   — if omitted, auto-calculated from model pricing
 *   session_id?:    string   — groups records; auto-generated if missing
 *   agent_id?:      string   — future: agent identifier
 *   run_id?:        string   — future: run identifier
 *   user_id?:       string   — future: user identifier
 *   latency_ms?:    number   — response latency
 *   metadata?:      object   — arbitrary payload
 *   timestamp?:     number   — epoch ms; defaults to now
 * }
 *
 * Response:
 * {
 *   status:           "collecting" | "ok" | "partial" | "decision"
 *   session_id:       string
 *   anomaly_detected: boolean
 *   record_count:     number
 *   total_cost:       number
 *   decision?:        object
 *   message?:         string
 *   why_error?:       string
 * }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // ── Resolve org context (priority chain, all non-blocking) ────────────
  let orgId = null;
  let keyId = null;

  const authHeader = request.headers.get("authorization") || "";

  // Priority 1: WHY Engine API key (starts with "whe_" after stripping "Bearer ")
  if (authHeader) {
    const bareToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (bareToken.startsWith("whe_")) {
      const keyResult = await validateKey(authHeader);
      if (keyResult.valid) {
        orgId = keyResult.orgId;
        keyId = keyResult.keyId;
      }
      // Invalid API key is NOT a hard error — falls through to anonymous mode
    }
  }

  // Priority 2: Supabase JWT (only if no API key resolved an org)
  if (!orgId && authHeader && !authHeader.replace(/^Bearer\s+/i, "").trim().startsWith("whe_")) {
    const user = await getUser(request);
    if (user) orgId = await getUserOrg(user.id);
  }

  // Priority 3: Anonymous — orgId stays null (backward compatible)

  // ── Run ingestion pipeline ────────────────────────────────────────────
  let result;
  try {
    result = await processIngestion(body, { orgId });
  } catch (err) {
    const msg = err?.message || "Ingestion failed.";
    const isValidation = /required|non-negative|Provide/.test(msg);
    return NextResponse.json({ error: msg }, { status: isValidation ? 400 : 500 });
  }

  // ── Track API key usage (fire-and-forget) ────────────────────────────
  // Only tracked when request came in via an API key.
  if (keyId) {
    const tokensUsed = Number(body?.tokens ?? (Number(body?.input_tokens ?? 0) + Number(body?.output_tokens ?? 0)));
    const costUsd    = result?.total_cost ?? result?.decision?.totalCost ?? 0;
    trackUsage(keyId, orgId, "ingest", tokensUsed, costUsd);
  }

  return NextResponse.json(result, { status: 200 });
}
