/**
 * lib/domains.js
 *
 * Canonical domain enum for the WHY Engine multi-domain pipeline.
 *
 * Every anomaly, analysis result, and WHY output should carry a `domain`
 * field drawn from this enum so downstream components (context-builder,
 * WHY engine, formatters) can branch cleanly without string literals.
 *
 * Safe fallback: if a domain is absent or unrecognised → default to AI.
 */

export const DOMAINS = {
  AI:     "ai_cost",
  AWS:    "aws_cost",
  STRIPE: "stripe_revenue",
};

/** All valid domain values as a Set for O(1) membership checks. */
export const DOMAIN_VALUES = new Set(Object.values(DOMAINS));

/**
 * normaliseDomain(raw)
 *
 * Accepts any input and returns a valid DOMAINS value.
 * Unknown / missing domains fall back to DOMAINS.AI — never throws.
 *
 * @param {*} raw
 * @returns {"ai_cost"|"aws_cost"|"stripe_revenue"}
 */
export function normaliseDomain(raw) {
  if (raw && DOMAIN_VALUES.has(String(raw).toLowerCase())) {
    return String(raw).toLowerCase();
  }
  return DOMAINS.AI; // safe default
}
