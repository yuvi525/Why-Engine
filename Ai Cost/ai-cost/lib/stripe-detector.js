/**
 * lib/stripe-detector.js
 *
 * Stripe revenue anomaly detector — same output contract as detection-engine.js.
 *
 * Detects:
 *   1. revenue_drop         — MRR / revenue dropped >30% vs previous period
 *   2. failed_payment_spike — failed payment rate spiked significantly
 *
 * Output shape per anomaly (mirrors AI detection-engine output):
 * {
 *   isAnomaly:  boolean,
 *   type:       string,
 *   severity:   "low" | "medium" | "high" | "critical",
 *   domain:     "stripe_revenue",
 *   details:    string | object,
 *   ...type-specific fields
 * }
 *
 * detectStripeAnomaly(data) — public API, never throws.
 *
 * data shape:
 * {
 *   revenue?:  [{ period, amount_usd }]   (oldest → newest, at least 2)
 *   payments?: {
 *     total:    number,
 *     failed:   number,
 *     history?: [{ period, failed_rate }]  // 0–1 floats, oldest → newest
 *   }
 *   churn_rate?:    number   // 0–1 float, current period
 *   prev_churn_rate?: number // 0–1 float, previous period
 * }
 */

import { DOMAINS } from "@/lib/domains";

const DOMAIN = DOMAINS.STRIPE;

// ── Internal helpers ──────────────────────────────────────────────────────

function detectRevenueDrop(revenue) {
  if (!Array.isArray(revenue) || revenue.length < 2) return null;

  const amounts  = revenue.map(r => Number(r?.amount_usd || r?.amount || 0));
  const latest   = amounts[amounts.length - 1];
  const previous = amounts.slice(0, -1);
  const avg      = previous.reduce((s, v) => s + v, 0) / previous.length;

  if (avg <= 0) return null;

  const dropRatio = 1 - (latest / avg); // positive = drop
  if (dropRatio <= 0.30) return null;   // threshold: >30% drop

  return {
    isAnomaly:       true,
    type:            "revenue_drop",
    severity:        dropRatio >= 0.60 ? "critical" : dropRatio >= 0.45 ? "high" : "medium",
    domain:          DOMAIN,
    previousAvg:     Number(avg.toFixed(2)),
    latestRevenue:   Number(latest.toFixed(2)),
    dropPct:         Number((dropRatio * 100).toFixed(1)),
    details:         `Revenue dropped ${(dropRatio * 100).toFixed(0)}% below average ($${avg.toFixed(2)} → $${latest.toFixed(2)}) — check churn and payment failures`,
  };
}

function detectFailedPaymentSpike(payments) {
  if (!payments) return null;

  const total  = Number(payments?.total  || 0);
  const failed = Number(payments?.failed || 0);
  if (total <= 0) return null;

  const currentRate = failed / total;

  // Check against history if available
  const history = Array.isArray(payments?.history) ? payments.history : [];
  if (history.length >= 2) {
    const histRates = history.slice(0, -1).map(h => Number(h?.failed_rate || 0));
    const avgRate   = histRates.reduce((s, v) => s + v, 0) / histRates.length;

    // Spike: current failure rate is >2× historical average OR absolute >15%
    if (avgRate > 0 && currentRate / avgRate > 2.0) {
      return {
        isAnomaly:    true,
        type:         "failed_payment_spike",
        severity:     currentRate >= 0.20 ? "high" : "medium",
        domain:       DOMAIN,
        failedCount:  failed,
        totalCount:   total,
        failedRate:   Number((currentRate * 100).toFixed(1)),
        historicalAvgRate: Number((avgRate * 100).toFixed(1)),
        details:      `Failed payment rate is ${(currentRate * 100).toFixed(1)}% (${failed}/${total}) — ${(currentRate / avgRate).toFixed(1)}× historical average of ${(avgRate * 100).toFixed(1)}%`,
      };
    }
  }

  // Absolute threshold: >15% failure rate is always an anomaly
  if (currentRate > 0.15) {
    return {
      isAnomaly:   true,
      type:        "failed_payment_spike",
      severity:    currentRate >= 0.30 ? "high" : "medium",
      domain:      DOMAIN,
      failedCount: failed,
      totalCount:  total,
      failedRate:  Number((currentRate * 100).toFixed(1)),
      details:     `Failed payment rate is ${(currentRate * 100).toFixed(1)}% (${failed}/${total}) — exceeds 15% threshold`,
    };
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────

const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

/**
 * detectStripeAnomaly(data)
 *
 * Runs all Stripe checks and returns the highest-severity anomaly,
 * or a clean no-anomaly result. Never throws.
 */
export function detectStripeAnomaly(data) {
  try {
    const checks = [
      detectRevenueDrop(data?.revenue),
      detectFailedPaymentSpike(data?.payments),
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
    console.error("[stripe-detector] Unexpected error:", err?.message);
    return { isAnomaly: false, type: null, severity: "low", domain: DOMAIN };
  }
}
