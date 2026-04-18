"use client";

import { useState, useEffect, useCallback } from "react";
import { runSystemValidation } from "@/lib/system-validator";

export const metadata = { title: "System Health & Validation — WHY Engine" };

// ── SVG circular progress ring ────────────────────────────────────────────
function ScoreRing({ score }) {
  const R = 54, C = 2 * Math.PI * R;
  const color  = score >= 85 ? "#22c55e" : score >= 60 ? "#eab308" : "#ef4444";
  const label  = score >= 85 ? "Production Ready ✓" : score >= 60 ? "Needs Attention ⚠" : "Not Ready ✗";
  const offset = C - (score / 100) * C;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <svg width={132} height={132} viewBox="0 0 132 132">
        <circle cx={66} cy={66} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
        <circle
          cx={66} cy={66} r={R}
          fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={C} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.8s ease" }}
        />
        <text x={66} y={60} textAnchor="middle" fill="#fff" fontSize={28} fontWeight={800} fontFamily="system-ui">{score}</text>
        <text x={66} y={78} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={10} fontFamily="system-ui">/100</text>
      </svg>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
    </div>
  );
}

// ── Status icon ───────────────────────────────────────────────────────────
function StatusIcon({ status }) {
  if (status === "pass") return <span style={{ color: "#22c55e", fontSize: 16 }}>✓</span>;
  if (status === "warn") return <span style={{ color: "#eab308", fontSize: 16 }}>⚠</span>;
  return <span style={{ color: "#ef4444", fontSize: 16 }}>✗</span>;
}

function Pill({ text, color = "#ef4444" }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 100, padding: "2px 8px", display: "inline-block", margin: "2px 3px" }}>
      {text}
    </span>
  );
}

// ── Check card ────────────────────────────────────────────────────────────
function CheckCard({ title, check }) {
  if (!check) return null;
  const borderColor = check.status === "pass" ? "#22c55e" : check.status === "warn" ? "#eab308" : "#ef4444";

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${borderColor}30`, borderLeft: `3px solid ${borderColor}`, borderRadius: 14, padding: "1.25rem 1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <StatusIcon status={check.status} />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{title}</h3>
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: borderColor, background: `${borderColor}15`, border: `1px solid ${borderColor}30`, borderRadius: 100, padding: "2px 10px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {check.status}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>{check.details}</p>

      {/* Missing tables */}
      {Array.isArray(check.missing_tables) && check.missing_tables.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {check.missing_tables.map(t => <Pill key={t} text={t} />)}
        </div>
      )}
      {/* Missing vars */}
      {Array.isArray(check.missing_vars) && check.missing_vars.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {check.missing_vars.map(v => <Pill key={v} text={v} />)}
        </div>
      )}
      {/* Violations */}
      {Array.isArray(check.violations) && check.violations.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {check.violations.map((v, i) => <Pill key={i} text={v} />)}
        </div>
      )}
      {/* Performance ms */}
      {check.generate_100_ms !== undefined && check.generate_100_ms >= 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
          generateDemoRun × 100: <strong style={{ color: "var(--text-primary)" }}>{check.generate_100_ms}ms</strong>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function SystemHealthPage() {
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(true);

  const runValidation = useCallback(async () => {
    setLoading(true);
    try {
      const r = await runSystemValidation();
      setReport(r);
    } catch (err) {
      console.error("[system-health] Validation error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-run on mount
  useEffect(() => { runValidation(); }, [runValidation]);

  function exportReport() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `whye-validation-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const CHECKS = report?.checks;

  return (
    <div style={{ flex: 1, padding: "40px 24px", background: "#030308" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", margin: "0 0 8px" }}>WHY Engine · Owner Access</p>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", margin: "0 0 6px" }}>System Health & Validation</h1>
            {report && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>Last run: {new Date(report.timestamp).toLocaleString()}</p>}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {report && (
              <button onClick={exportReport} style={{ padding: "9px 18px", fontSize: 12, fontWeight: 700, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 100, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
                Export Report ↓
              </button>
            )}
            <button onClick={runValidation} disabled={loading} style={{ padding: "9px 20px", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 100, color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
              {loading ? (
                <><span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Running…</>
              ) : "▶ Run Validation"}
            </button>
          </div>
        </div>

        {/* Score card */}
        {loading && !report && (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem 0" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <span style={{ width: 40, height: 40, border: "3px solid rgba(99,102,241,0.3)", borderTopColor: "#6366f1", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: 0 }}>Running system checks…</p>
            </div>
          </div>
        )}

        {report && (
          <>
            {/* Score + summary */}
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "2rem" }}>
              <ScoreRing score={report.readiness_score} />
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", margin: "0 0 12px" }}>Readiness Summary</p>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
                  <div><p style={{ fontSize: 24, fontWeight: 800, color: "#22c55e", margin: "0 0 2px" }}>{report.summary.passed}</p><p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0 }}>Passed</p></div>
                  <div><p style={{ fontSize: 24, fontWeight: 800, color: "#eab308", margin: "0 0 2px" }}>{report.summary.warnings}</p><p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0 }}>Warnings</p></div>
                  <div><p style={{ fontSize: 24, fontWeight: 800, color: "#ef4444", margin: "0 0 2px" }}>{report.summary.failed}</p><p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0 }}>Failed</p></div>
                  <div><p style={{ fontSize: 24, fontWeight: 800, color: "rgba(255,255,255,0.7)", margin: "0 0 2px" }}>{report.summary.total_checks}</p><p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0 }}>Total</p></div>
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0 }}>
                  {report.production_ready
                    ? "✓ System meets production readiness threshold (≥ 85)."
                    : `⚠ Score below 85 — see failing checks to reach production readiness.`}
                </p>
              </div>
            </div>

            {/* Check cards grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <CheckCard title="A — Pipeline Connectivity" check={CHECKS?.pipeline} />
              <CheckCard title="B — Database Tables"      check={CHECKS?.database} />
              <CheckCard title="C — Auth System"          check={CHECKS?.auth} />
              <CheckCard title="D — Stripe Configuration" check={CHECKS?.stripe} />
              <CheckCard title="E — Demo Mode"            check={CHECKS?.demo} />
              <CheckCard title="F — Brand Copy"           check={CHECKS?.brand_copy} />
              <CheckCard title="G — Performance"          check={CHECKS?.performance} />
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .check-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
