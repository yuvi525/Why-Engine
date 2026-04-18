/**
 * lib/design-system.js
 *
 * Single source of truth for all design tokens used across WHY Engine.
 * Import in JS where you need inline style values that aren't in CSS vars.
 * For CSS, use the variables defined in globals.css.
 */

export const COLORS = {
  background:     "#030308",
  surface:        "#0a0a12",
  surfaceHover:   "#0f0f1a",
  primary:        "#6366f1",
  primaryHover:   "#4f46e5",
  primaryGlow:    "rgba(99,102,241,0.28)",
  accent:         "#8b5cf6",
  success:        "#22c55e",
  successGlow:    "rgba(34,197,94,0.2)",
  warning:        "#f59e0b",
  warningGlow:    "rgba(245,158,11,0.18)",
  danger:         "#ef4444",
  dangerGlow:     "rgba(239,68,68,0.18)",
  textPrimary:    "#f8fafc",
  textSecondary:  "#94a3b8",
  textMuted:      "#475569",
  border:         "rgba(255,255,255,0.07)",
  borderStrong:   "rgba(255,255,255,0.12)",
  borderAccent:   "rgba(99,102,241,0.35)",
};

export const SHADOWS = {
  card:     "0 1px 3px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.4)",
  cardHover:"0 4px 6px rgba(0,0,0,0.5), 0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
  glow:     `0 0 20px rgba(99,102,241,0.35), 0 0 40px rgba(99,102,241,0.15)`,
  glowSm:   `0 0 8px rgba(99,102,241,0.25)`,
  inset:    "inset 0 1px 0 rgba(255,255,255,0.05)",
};

export const RADIUS = {
  card:   "18px",
  inner:  "12px",
  pill:   "100px",
  sm:     "8px",
};

export const TRANSITIONS = {
  fast:   "all 0.15s ease",
  base:   "all 0.2s ease",
  slow:   "all 0.35s cubic-bezier(0.22,1,0.36,1)",
};

export const GRADIENTS = {
  primary:   "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  danger:    "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
  success:   "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
  surface:   "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
  cardHero:  "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.06) 100%)",
};

/** Severity → style map (used by DecisionCard) */
export const SEVERITY_STYLES = {
  critical: { border: "#ef4444", glow: "rgba(239,68,68,0.1)",   label: "Critical" },
  high:     { border: "#f97316", glow: "rgba(249,115,22,0.1)",  label: "High Impact" },
  medium:   { border: "#f59e0b", glow: "rgba(245,158,11,0.08)", label: "Moderate" },
  low:      { border: "#6366f1", glow: "rgba(99,102,241,0.08)", label: "Low Impact" },
};
