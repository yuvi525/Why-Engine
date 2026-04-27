"use client";

import { useState } from "react";

/**
 * LockedFeature
 *
 * Wraps any content with a premium locked overlay.
 * Shows a blur + lock icon + upgrade CTA.
 * Clicking the overlay calls onUpgrade() (or navigates to /pricing).
 *
 * Props:
 *   children      {ReactNode}
 *   label         {string}     Feature name shown in overlay
 *   plan          {string}     "growth" | "enterprise" (required plan)
 *   onUpgrade     {function}   Optional callback — defaults to /pricing nav
 *   isLocked      {boolean}    If false, renders children as-is (no overlay)
 */

const PLAN_CONFIG = {
  growth:     { color: "#6366f1", label: "Growth" },
  enterprise: { color: "#a78bfa", label: "Enterprise" },
};

export function LockedFeature({
  children,
  label      = "Premium Feature",
  plan       = "growth",
  onUpgrade,
  isLocked   = true,
}) {
  const [hovered, setHovered] = useState(false);

  if (!isLocked) return <>{children}</>;

  const planCfg = PLAN_CONFIG[plan] ?? PLAN_CONFIG.growth;

  function handleClick() {
    if (onUpgrade) {
      onUpgrade();
    } else if (typeof window !== "undefined") {
      window.location.href = "/pricing";
    }
  }

  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
      {/* Blurred content underneath */}
      <div style={{
        filter:        "blur(4px)",
        opacity:       0.35,
        pointerEvents: "none",
        userSelect:    "none",
      }}>
        {children}
      </div>

      {/* Lock overlay */}
      <div
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position:       "absolute",
          inset:          0,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          gap:            12,
          background:     hovered
            ? "rgba(3,3,8,0.82)"
            : "rgba(3,3,8,0.72)",
          backdropFilter: "blur(2px)",
          cursor:         "pointer",
          transition:     "background 0.2s ease",
          borderRadius:   14,
          border:         `1px solid rgba(255,255,255,0.07)`,
        }}
      >
        {/* Lock icon */}
        <div style={{
          width:          48,
          height:         48,
          borderRadius:   "50%",
          background:     `rgba(${plan === "enterprise" ? "139,92,246" : "99,102,241"},0.15)`,
          border:         `1px solid ${planCfg.color}40`,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       22,
          transform:      hovered ? "scale(1.08)" : "scale(1)",
          transition:     "transform 0.2s ease",
          boxShadow:      hovered ? `0 0 20px ${planCfg.color}35` : "none",
        }}>
          🔒
        </div>

        {/* Labels */}
        <div style={{ textAlign: "center" }}>
          <p style={{
            fontSize:   14,
            fontWeight: 700,
            color:      "var(--text-primary)",
            margin:     "0 0 4px",
          }}>
            {label}
          </p>
          <p style={{
            fontSize: 12,
            color:    "var(--text-muted)",
            margin:   0,
          }}>
            Available on{" "}
            <span style={{ color: planCfg.color, fontWeight: 700 }}>
              {planCfg.label}
            </span>{" "}
            plan
          </p>
        </div>

        {/* CTA button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          style={{
            display:        "inline-flex",
            alignItems:     "center",
            gap:            6,
            padding:        "7px 18px",
            borderRadius:   100,
            border:         "none",
            background:     `linear-gradient(135deg, ${planCfg.color} 0%, ${plan === "enterprise" ? "#6366f1" : "#8b5cf6"} 100%)`,
            color:          "#fff",
            fontSize:       12,
            fontWeight:     700,
            cursor:         "pointer",
            letterSpacing:  "0.04em",
            transform:      hovered ? "translateY(-2px) scale(1.04)" : "none",
            boxShadow:      hovered ? `0 6px 20px ${planCfg.color}45` : `0 2px 8px ${planCfg.color}30`,
            transition:     "transform 0.2s ease, box-shadow 0.2s ease",
          }}
        >
          ↑ Upgrade
        </button>
      </div>
    </div>
  );
}
