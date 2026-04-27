"use client";

import { useState } from "react";
import { COPY_MAP, getSeverityLabel } from "@/lib/brand-constants";
import { DomainBadge } from "@/components/DomainBadge";
import { SavingsCard } from "@/components/SavingsCard";

/* ─────────────────────────────────────────────────────────────
   DecisionCard — extended with:
   • COPY_MAP strings
   • Severity-based left border + glow
   • "AI Spend" metric row
   • Collapsible recommendations section
   • isDemo "simulated" badge
   Props:
     decision    {object}  - formatted decision from API / demo
     totalCost   {number}  - optional
     anomalyType {string}  - optional
     severity    {string}  - 'critical'|'high'|'medium'|'low'
     isDemo      {boolean} - show simulated pill
─────────────────────────────────────────────────────────────── */

const PRIORITY_CONFIG = {
  HIGH:   { color: "#f43f5e", bg: "rgba(244,63,94,0.10)",   border: "rgba(244,63,94,0.25)",   dot: "#f43f5e" },
  MEDIUM: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.25)",  dot: "#f59e0b" },
  LOW:    { color: "#10b981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.25)",  dot: "#10b981" },
};

// Left-border severity styles
const SEVERITY_BORDER = {
  critical: { borderLeft: "3px solid #ef4444", background: "rgba(239,68,68,0.04)" },
  high:     { borderLeft: "3px solid #f97316", background: "rgba(249,115,22,0.04)" },
  medium:   { borderLeft: "3px solid #eab308", background: "rgba(234,179,8,0.03)"  },
  low:      { borderLeft: "3px solid #6366f1", background: "rgba(99,102,241,0.04)"  },
};

function MetaChip({ label, value }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, padding: "5px 12px" }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function SectionBlock({ label, children }) {
  return (
    <div className="section-block animate-fade-up">
      <p className="section-label">{label}</p>
      <div style={{ fontSize: 14, lineHeight: 1.8, color: "var(--text-secondary)" }}>{children}</div>
    </div>
  );
}

function ImpactBlock({ label, children }) {
  return (
    <div className="section-impact animate-fade-up delay-100">
      <p className="section-label" style={{ color: "var(--amber)" }}>{label}</p>
      <div style={{ fontSize: 15, lineHeight: 1.8, color: "#fcd34d", fontWeight: 500 }}>{children}</div>
    </div>
  );
}

function DecisionBlock({ label, children }) {
  return (
    <div className="section-decision animate-fade-up delay-200">
      <p className="section-label">{label}</p>
      <div style={{ fontSize: 15, lineHeight: 1.75, color: "var(--text-primary)", fontWeight: 700 }}>{children}</div>
    </div>
  );
}

function ConfidenceBar({ confidence }) {
  const num = parseInt(String(confidence || "0").replace("%", ""), 10) || 0;
  const fillColor = num >= 80 ? "var(--emerald)" : num >= 60 ? "var(--amber)" : "var(--text-muted)";
  return (
    <div className="animate-fade-up delay-300">
      <p className="section-label">Confidence</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="conf-track" style={{ flex: 1 }}>
          <div className="conf-fill" style={{ width: `${num}%`, background: fillColor }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", minWidth: 40, textAlign: "right" }}>
          {confidence || "—"}
        </span>
      </div>
    </div>
  );
}

// Collapsible recommendations from why_output
function RecommendationsSection({ recommendations }) {
  const [open, setOpen] = useState(false);
  if (!Array.isArray(recommendations) || recommendations.length === 0) return null;

  return (
    <div className="section-block" style={{ overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}>
        <p className="section-label" style={{ margin: 0, flex: 1, textAlign: "left" }}>Recommendations ({recommendations.length})</p>
        <span style={{ fontSize: 16, color: "var(--text-muted)", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>
      <div style={{
        maxHeight: open ? `${recommendations.length * 120}px` : 0,
        overflow: "hidden",
        transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1)",
        marginTop: open ? 12 : 0,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recommendations.map((r, i) => (
            <div key={i} style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>{r.action}</span>
                {r.expected_saving_usd > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--emerald)", whiteSpace: "nowrap" }}>
                    ~${Number(r.expected_saving_usd).toFixed(3)} saved/run
                  </span>
                )}
              </div>
              {r.implementation && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, fontFamily: "monospace", background: "rgba(0,0,0,0.2)", padding: "4px 8px", borderRadius: 6, lineHeight: 1.5 }}>
                  {r.implementation}
                </p>
              )}
              {r.target_node && (
                <span style={{ display: "inline-block", marginTop: 6, fontSize: 10, fontWeight: 700, color: "#6366f1", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 100, padding: "2px 8px" }}>
                  node: {r.target_node}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DecisionCard({ decision, totalCost, anomalyType, severity, isDemo, domain, estimatedSavings, suggestedModel, fromModel }) {
  const priority  = String(decision?.priority || "LOW").toUpperCase();
  const pConfig   = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.LOW;
  const actions   = Array.isArray(decision?.action) ? decision.action : [];
  const sevStyle  = SEVERITY_BORDER[String(severity || "").toLowerCase()] || {};

  // why_output may come from demo analysis results
  const whyOutput      = decision?.why_output;
  const recommendations = whyOutput?.recommendations || [];
  const financialImpact = whyOutput?.financial_impact;

  return (
    <article
      className="card animate-fade-up"
      style={{ overflow: "hidden", ...sevStyle, position: "relative" }}
    >
      {/* Demo badge */}
      {isDemo && (
        <div style={{ position: "absolute", bottom: 14, right: 14, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 100, padding: "2px 8px", letterSpacing: "0.1em" }}>
          simulated
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ padding: "1.75rem 2rem 1.5rem", borderBottom: "1px solid var(--border)", background: "linear-gradient(135deg, var(--bg-card) 0%, var(--bg-subtle) 100%)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
              {COPY_MAP.result_label}
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.35, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
              {decision?.change || COPY_MAP.anomaly_label}
            </h2>
            {/* Severity label */}
            {severity && (
              <p style={{ fontSize: 11, fontWeight: 700, color: SEVERITY_BORDER[severity]?.borderLeft?.replace("3px solid ", "") || "#6366f1", marginTop: 6, marginBottom: 0 }}>
                {getSeverityLabel(severity)}
              </p>
            )}
          </div>

          {/* Priority badge + Domain badge row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {domain && <DomainBadge domain={domain} size="sm" />}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 100, fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", background: pConfig.bg, border: `1px solid ${pConfig.border}`, color: pConfig.color, whiteSpace: "nowrap" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: pConfig.dot, flexShrink: 0 }} />
              {priority}
            </span>
          </div>
        </div>

        {/* Meta chips — AI Spend label from COPY_MAP */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          {totalCost !== undefined && (
            <MetaChip label={COPY_MAP.cost_label} value={`$${Number(totalCost || 0).toFixed(2)}`} />
          )}
          {financialImpact?.monthly_projection_usd && (
            <MetaChip label="Monthly Projection" value={`$${Number(financialImpact.monthly_projection_usd).toFixed(2)}`} />
          )}
          {financialImpact?.waste_percentage && (
            <MetaChip label="Waste" value={`${financialImpact.waste_percentage}%`} />
          )}
          {anomalyType && (
            <MetaChip label={COPY_MAP.anomaly_label.split(" ")[0]} value={String(anomalyType).replace(/_/g, " ")} />
          )}
          {decision?.confidence && (
            <MetaChip label="Confidence" value={decision.confidence} />
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "1.5rem 2rem", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* WHY summary — prefer why_output.summary over decision.why */}
        <SectionBlock label="Why this happened">
          <p style={{ margin: 0 }}>{whyOutput?.summary || decision?.why || "—"}</p>
        </SectionBlock>

        {/* Root causes (from why_output) */}
        {Array.isArray(whyOutput?.root_causes) && whyOutput.root_causes.length > 0 && (
          <SectionBlock label="Root causes">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {whyOutput.root_causes.map((rc, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 12px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f43f5e", flexShrink: 0, marginTop: 6 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{rc.cause}</span>
                    {rc.node && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>→ {rc.node}</span>}
                    {rc.evidence && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "3px 0 0", fontStyle: "italic" }}>{rc.evidence}</p>}
                  </div>
                  {rc.confidence && <span style={{ fontSize: 11, color: "var(--emerald)", fontWeight: 700, whiteSpace: "nowrap" }}>{rc.confidence}</span>}
                </div>
              ))}
            </div>
          </SectionBlock>
        )}

        {/* IMPACT */}
        <ImpactBlock label="Financial impact">
          <p style={{ margin: 0 }}>{decision?.impact || "—"}</p>
        </ImpactBlock>

        {/* Standard actions (from WHY engine output) */}
        {actions.length > 0 && (
          <SectionBlock label="Recommended actions">
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              {actions.map((step, i) => (
                <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", fontSize: 10, fontWeight: 800, color: "#fff", marginTop: 2 }}>
                    {i + 1}
                  </span>
                  <span style={{ lineHeight: 1.7, color: "var(--text-secondary)" }}>{step}</span>
                </li>
              ))}
            </ol>
          </SectionBlock>
        )}

        {/* Collapsible recommendations from why_output */}
        <RecommendationsSection recommendations={recommendations} />

        {/* SAVINGS CARD — shown when estimatedSavings provided */}
        {Number(estimatedSavings) > 0 && (
          <SavingsCard
            estimatedSavings={estimatedSavings}
            requestCount={decision?.rankedContributors?.[0]?.requestCount || 1}
            suggestedModel={suggestedModel || decision?.suggestedOptimization?.to || "gpt-4o-mini"}
            fromModel={fromModel || decision?.suggestedOptimization?.from || "gpt-4o"}
            domain={domain || "ai_cost"}
          />
        )}

        {/* DECISION */}
        <DecisionBlock label={COPY_MAP.result_label}>
          <p style={{ margin: 0 }}>{decision?.decision || "—"}</p>
        </DecisionBlock>

        {/* CONFIDENCE BAR */}
        {decision?.confidence && (
          <div className="section-block">
            <ConfidenceBar confidence={decision.confidence} />
          </div>
        )}
      </div>
    </article>
  );
}
