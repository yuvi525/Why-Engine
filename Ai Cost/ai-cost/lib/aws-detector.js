/**
 * lib/aws-detector.js
 *
 * AWS cost anomaly detector — same output contract as detection-engine.js.
 *
 * Detects:
 *   1. idle_resource  — CPU utilisation < 5% on a billed resource
 *   2. cost_spike     — AWS service cost increased >50% vs historical average
 *
 * Output shape per anomaly (mirrors AI detection-engine output):
 * {
 *   isAnomaly:  boolean,
 *   type:       string,
 *   severity:   "low" | "medium" | "high" | "critical",
 *   domain:     "aws_cost",
 *   details:    string | object,
 *   ...type-specific fields
 * }
 *
 * detectAWSAnomaly(data) — public API, never throws.
 *
 * data shape:
 * {
 *   resources?:    [{ id, service, cpu_pct, cost_usd }]
 *   history?:      [{ period, cost_usd }]    (oldest → newest)
 *   currentCost?:  number
 *   previousCost?: number
 * }
 */

import { DOMAINS } from "@/lib/domains";

const DOMAIN = DOMAINS.AWS;

// ── Internal helpers ──────────────────────────────────────────────────────

function detectIdleResources(resources) {
  if (!Array.isArray(resources) || resources.length === 0) return null;

  const idle = resources.filter(r => {
    const cpu = Number(r?.cpu_pct ?? r?.cpu ?? 100); // default to healthy if missing
    return cpu < 5;
  });

  if (idle.length === 0) return null;

  const totalIdleCost = idle.reduce((s, r) => s + Number(r?.cost_usd || 0), 0);

  return {
    isAnomaly:     true,
    type:          "idle_resource",
    severity:      idle.length >= 3 ? "high" : "medium",
    domain:        DOMAIN,
    idleCount:     idle.length,
    totalIdleCost: Number(totalIdleCost.toFixed(4)),
    resources:     idle.map(r => ({
      id:      r?.id      || "unknown",
      service: r?.service || "unknown",
      cpu_pct: Number(r?.cpu_pct ?? r?.cpu ?? 0).toFixed(1),
      cost_usd: Number(r?.cost_usd || 0).toFixed(4),
    })),
    details: `${idle.length} idle resource(s) with CPU <5% costing $${totalIdleCost.toFixed(2)} — consider rightsizing or shutdown`,
  };
}

function detectAWSCostSpike(history) {
  if (!Array.isArray(history) || history.length < 2) return null;

  const periods  = history.map(h => Number(h?.cost_usd || h?.cost || 0));
  const latest   = periods[periods.length - 1];
  const previous = periods.slice(0, -1);
  const avg      = previous.reduce((s, v) => s + v, 0) / previous.length;

  if (avg <= 0) return null;

  const ratio = latest / avg;
  if (ratio <= 1.5) return null; // threshold: >50% increase

  return {
    isAnomaly:     true,
    type:          "cost_spike",
    severity:      "high",
    domain:        DOMAIN,
    historicalAvg: Number(avg.toFixed(4)),
    latestCost:    Number(latest.toFixed(4)),
    ratio:         Number(ratio.toFixed(2)),
    details:       `AWS spend is ${((ratio - 1) * 100).toFixed(0)}% above historical average ($${avg.toFixed(2)} → $${latest.toFixed(2)})`,
  };
}

// ── Public API ────────────────────────────────────────────────────────────

const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

/**
 * detectAWSAnomaly(data)
 *
 * Runs all AWS checks and returns the highest-severity anomaly,
 * or a clean no-anomaly result. Never throws.
 */
export function detectAWSAnomaly(data) {
  try {
    const resources = data?.resources ?? [];
    const history   = data?.history   ?? [];

    const checks = [
      detectIdleResources(resources),
      detectAWSCostSpike(history),
    ].filter(Boolean);

    if (checks.length === 0) {
      return { isAnomaly: false, type: null, severity: "low", domain: DOMAIN };
    }

    const top = checks.sort(
      (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    )[0];

    return top;
  } catch (err) {
    // Never propagate — safe fallback
    console.error("[aws-detector] Unexpected error:", err?.message);
    return { isAnomaly: false, type: null, severity: "low", domain: DOMAIN };
  }
}
