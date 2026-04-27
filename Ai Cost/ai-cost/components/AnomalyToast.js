"use client";

import { useState, useEffect } from "react";

/**
 * AnomalyToast
 *
 * Floating notification that appears top-right when a new anomaly is detected
 * (or in demo mode, after a short delay).
 *
 * Props:
 *   message  {string}   — notification text
 *   severity {string}   — "critical" | "high" | "medium" | "low"
 *   visible  {boolean}  — controlled visibility
 *   onClose  {function} — called when dismissed
 */
const SEV_COLOR = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#f59e0b",
  low:      "#6366f1",
};

export function AnomalyToast({ message, severity = "high", visible, onClose }) {
  const [show, setShow] = useState(false);
  const [exit, setExit] = useState(false);
  const color = SEV_COLOR[severity] || SEV_COLOR.high;

  useEffect(() => {
    if (visible) { setExit(false); setShow(true); }
  }, [visible]);

  function dismiss() {
    setExit(true);
    setTimeout(() => { setShow(false); if (onClose) onClose(); }, 280);
  }

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(dismiss, 6000);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className={exit ? "toast toast-exit" : "toast"}
      style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
    >
      {/* Severity dot */}
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <span style={{
          display:   "block", width: 8, height: 8, borderRadius: "50%",
          background: color, boxShadow: `0 0 8px ${color}`,
          animation: "pulse 1.5s ease infinite",
        }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: color, margin: "0 0 2px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Cost Anomaly Detected
        </p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.5 }}>
          {message || "⚡ New AI Spend anomaly detected — check Decision Insight"}
        </p>
      </div>

      {/* Dismiss */}
      <button onClick={dismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 2, flexShrink: 0, lineHeight: 0, transition: "color 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
        onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      
    </div>
  );
}
