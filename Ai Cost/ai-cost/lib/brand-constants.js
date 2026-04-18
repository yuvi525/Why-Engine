/**
 * lib/brand-constants.js
 *
 * Single source of truth for all UI copy in WHY Engine.
 * Import COPY_MAP wherever you need UI text — never hardcode.
 */

export const COPY_MAP = {
  analyze_button:    "Run Cost Intelligence",
  analyze_loading:   "Running Intelligence...",
  dashboard_title:   "AI Cost Intelligence Dashboard",
  result_label:      "Decision Insight",
  cost_label:        "AI Spend",
  anomaly_label:     "Cost Anomaly Detected",
  cta_connect:       "Connect Your AI Infrastructure",
  badge_active:      "AI Cost Intelligence Engine Active",
  nav_dashboard:     "Intelligence Dashboard",
  nav_analyze:       "Run Analysis",
  nav_autopilot:     "Cost Autopilot",
  nav_usage:         "AI Spend Usage",
  empty_state:       "No AI Spend data yet — connect your infrastructure or explore Demo Mode",
  severity_critical: "Critical Anomaly",
  severity_high:     "High Impact",
  severity_medium:   "Moderate Impact",
  severity_low:      "Low Impact",
};

/** Convenience: get severity label */
export function getSeverityLabel(severity) {
  const map = {
    critical: COPY_MAP.severity_critical,
    high:     COPY_MAP.severity_high,
    medium:   COPY_MAP.severity_medium,
    low:      COPY_MAP.severity_low,
  };
  return map[String(severity).toLowerCase()] || severity;
}
