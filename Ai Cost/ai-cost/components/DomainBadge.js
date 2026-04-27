"use client";

/**
 * DomainBadge
 *
 * Compact pill that visually identifies a domain (AI / AWS / Stripe).
 * Each domain has a distinct color + icon so users can orient instantly.
 *
 * Props:
 *   domain  {string}  "ai_cost" | "aws_cost" | "stripe_revenue" | any
 *   size    {string}  "sm" | "md" (default "md")
 */

const DOMAIN_CONFIG = {
  ai_cost: {
    label:  "AI",
    icon:   "✦",
    color:  "#a5b4fc",
    bg:     "rgba(99,102,241,0.12)",
    border: "rgba(99,102,241,0.30)",
    glow:   "rgba(99,102,241,0.20)",
  },
  aws_cost: {
    label:  "AWS",
    icon:   "⬡",
    color:  "#fb923c",
    bg:     "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.30)",
    glow:   "rgba(249,115,22,0.18)",
  },
  stripe_revenue: {
    label:  "Stripe",
    icon:   "◈",
    color:  "#a78bfa",
    bg:     "rgba(139,92,246,0.12)",
    border: "rgba(139,92,246,0.30)",
    glow:   "rgba(139,92,246,0.18)",
  },
};

const FALLBACK = {
  label:  "Unknown",
  icon:   "◇",
  color:  "#64748b",
  bg:     "rgba(100,116,139,0.10)",
  border: "rgba(100,116,139,0.25)",
  glow:   "transparent",
};

export function DomainBadge({ domain, size = "md" }) {
  const cfg = DOMAIN_CONFIG[domain] ?? FALLBACK;

  const isSmall = size === "sm";
  const fontSize    = isSmall ? 9  : 10;
  const iconSize    = isSmall ? 10 : 11;
  const paddingV    = isSmall ? 2  : 3;
  const paddingH    = isSmall ? 7  : 10;
  const gap         = isSmall ? 4  : 5;

  return (
    <span
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap,
        padding:        `${paddingV}px ${paddingH}px`,
        borderRadius:   100,
        fontSize,
        fontWeight:     700,
        letterSpacing:  "0.14em",
        textTransform:  "uppercase",
        color:          cfg.color,
        background:     cfg.bg,
        border:         `1px solid ${cfg.border}`,
        boxShadow:      `0 0 8px ${cfg.glow}`,
        whiteSpace:     "nowrap",
        transition:     "box-shadow 0.2s ease",
        userSelect:     "none",
      }}
    >
      <span style={{ fontSize: iconSize, lineHeight: 1 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
