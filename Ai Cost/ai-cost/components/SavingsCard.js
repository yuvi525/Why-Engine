"use client";

import { useState } from "react";

/**
 * SavingsCard
 *
 * Highlights estimated savings in a premium animated card.
 * Shows per-run, daily, and monthly projections.
 *
 * Props:
 *   estimatedSavings  {number}   per-analysis savings in USD
 *   requestCount      {number}   number of requests (for scaling)
 *   suggestedModel    {string}   model to switch to
 *   fromModel         {string}   current expensive model
 *   domain            {string}   "ai_cost" | "aws_cost" | "stripe_revenue"
 */

const DAILY_RUNS   = 10;
const MONTHLY_RUNS = 300;

function fmt(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

export function SavingsCard({
  estimatedSavings = 0,
  requestCount     = 1,
  suggestedModel   = "gpt-4o-mini",
  fromModel        = "gpt-4o",
  domain           = "ai_cost",
}) {
  const [hovered, setHovered] = useState(false);

  const perRun  = estimatedSavings / Math.max(1, requestCount);
  const daily   = perRun * DAILY_RUNS;
  const monthly = perRun * MONTHLY_RUNS;

  // Domain-specific accent
  const accent = domain === "aws_cost"
    ? "#fb923c"
    : domain === "stripe_revenue"
    ? "#a78bfa"
    : "#22c55e";

  const accentBg  = domain === "aws_cost"
    ? "rgba(249,115,22,0.08)"
    : domain === "stripe_revenue"
    ? "rgba(139,92,246,0.08)"
    : "rgba(34,197,94,0.07)";

  const accentBorder = domain === "aws_cost"
    ? "rgba(249,115,22,0.22)"
    : domain === "stripe_revenue"
    ? "rgba(139,92,246,0.22)"
    : "rgba(34,197,94,0.20)";

  if (estimatedSavings <= 0) return null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:    accentBg,
        border:        `1px solid ${accentBorder}`,
        borderLeft:    `3px solid ${accent}`,
        borderRadius:  14,
        padding:       "1.125rem 1.375rem",
        display:       "flex",
        flexDirection: "column",
        gap:           14,
        transform:     hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow:     hovered
          ? `0 8px 28px rgba(0,0,0,0.4), 0 0 16px ${accentBorder}`
          : "0 1px 3px rgba(0,0,0,0.35)",
        transition:    "transform 0.22s ease, box-shadow 0.22s ease",
        cursor:        "default",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color:         accent,
        }}>
          💰 Estimated Savings
        </span>
        <span style={{
          fontSize:   22,
          fontWeight: 800,
          color:      accent,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}>
          {fmt(estimatedSavings)}
        </span>
      </div>

      {/* Projections row */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { label: "Per run",  value: fmt(perRun)  },
          { label: "Daily",    value: fmt(daily)   },
          { label: "Monthly",  value: fmt(monthly) },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              flex:          "1 1 70px",
              background:    "rgba(0,0,0,0.25)",
              border:        "1px solid rgba(255,255,255,0.05)",
              borderRadius:  10,
              padding:       "8px 12px",
              textAlign:     "center",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Switch suggestion */}
      {fromModel && suggestedModel && fromModel !== suggestedModel && (
        <div style={{
          display:    "flex",
          alignItems: "center",
          gap:        8,
          fontSize:   12,
          color:      "var(--text-muted)",
        }}>
          <span style={{
            fontFamily:  "monospace",
            fontSize:    11,
            color:       "var(--text-secondary)",
            background:  "rgba(0,0,0,0.3)",
            border:      "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6,
            padding:     "2px 7px",
          }}>
            {fromModel}
          </span>
          <span style={{ color: accent, fontSize: 14 }}>→</span>
          <span style={{
            fontFamily:  "monospace",
            fontSize:    11,
            color:       accent,
            background:  accentBg,
            border:      `1px solid ${accentBorder}`,
            borderRadius: 6,
            padding:     "2px 7px",
            fontWeight:  700,
          }}>
            {suggestedModel}
          </span>
        </div>
      )}
    </div>
  );
}
