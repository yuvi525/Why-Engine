"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Brain, TrendingUp, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { GlassCard } from "../ui/glass-card";

interface DecisionData {
  priority?: string;
  change?: string;
  why?: string;
  impact?: string;
  action?: string[];
  decision?: string;
  confidence?: string;
  totalCost?: number;
  total_cost_usd?: number;
  estimatedSavings?: number;
  anomalyType?: string;
  anomaly_detected?: boolean;
  severity?: string;
}

interface WHYAnalysisPanelProps {
  decision: DecisionData | null;
  isLoading?: boolean;
  isDemo?: boolean;
}

const PRIORITY_STYLES: Record<string, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
  HIGH: {
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.22)",
    color: "#ef4444",
    icon: <AlertTriangle size={13} />,
  },
  MEDIUM: {
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.22)",
    color: "#f59e0b",
    icon: <TrendingUp size={13} />,
  },
  LOW: {
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.22)",
    color: "#22c55e",
    icon: <CheckCircle size={13} />,
  },
};

function PriorityBadge({ priority }: { priority?: string }) {
  const key = (priority || "LOW").toUpperCase();
  const s = PRIORITY_STYLES[key] || PRIORITY_STYLES.LOW;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.05em",
      }}
    >
      {s.icon}
      {key}
    </span>
  );
}

export function WHYAnalysisPanel({ decision, isLoading, isDemo }: WHYAnalysisPanelProps) {
  if (isLoading) {
    return (
      <GlassCard delay={0.4}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-[rgba(99,102,241,0.12)] flex items-center justify-center">
            <Brain className="w-4 h-4 text-[#818CF8]" />
          </div>
          <h3 className="text-base font-semibold text-[#F9FAFB]">WHY Engine Analysis</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-[#9CA3AF] text-sm">
            <Loader2 size={16} className="animate-spin" />
            Analysing your AI spend…
          </div>
        </div>
      </GlassCard>
    );
  }

  if (!decision) {
    return (
      <GlassCard delay={0.4}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-[rgba(99,102,241,0.12)] flex items-center justify-center">
            <Brain className="w-4 h-4 text-[#818CF8]" />
          </div>
          <h3 className="text-base font-semibold text-[#F9FAFB]">WHY Engine Analysis</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Brain size={20} style={{ color: "#818CF8" }} />
          </div>
          <p className="text-sm font-medium text-[#9CA3AF]">No analysis yet</p>
          <p className="text-xs text-[#6B7280] max-w-[260px] leading-relaxed">
            Send your first request through the WHY proxy to see real-time cost intelligence here.
          </p>
        </div>
      </GlassCard>
    );
  }

  const cost = decision.totalCost ?? decision.total_cost_usd ?? 0;
  const savings = decision.estimatedSavings ?? 0;
  const anomalyLabel = decision.anomalyType
    ? String(decision.anomalyType).replace(/_/g, " ")
    : null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={decision.decision ?? "why-panel"}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <GlassCard delay={0}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[rgba(99,102,241,0.12)] flex items-center justify-center">
                <Brain className="w-4 h-4 text-[#818CF8]" />
              </div>
              <h3 className="text-base font-semibold text-[#F9FAFB]">WHY Engine Analysis</h3>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={decision.priority} />
              {isDemo && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    background: "rgba(245,158,11,0.1)",
                    border: "1px solid rgba(245,158,11,0.2)",
                    color: "#F59E0B",
                    borderRadius: 999,
                    padding: "2px 8px",
                  }}
                >
                  DEMO
                </span>
              )}
            </div>
          </div>

          {/* Change headline */}
          {decision.change && (
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#F9FAFB",
                marginBottom: 14,
                lineHeight: 1.5,
              }}
            >
              {decision.change}
            </p>
          )}

          {/* Cost / Savings chips */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Total Spend", value: `$${cost.toFixed(2)}`, color: "#F43F5E", bg: "rgba(244,63,94,0.08)", border: "rgba(244,63,94,0.18)" },
              { label: "Est. Savings", value: `$${savings.toFixed(2)}`, color: "#10B981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.18)" },
              { label: "Confidence", value: decision.confidence ?? "–", color: "#818CF8", bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.18)" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                style={{
                  background: s.bg,
                  border: `1px solid ${s.border}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <p style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                  {s.label}
                </p>
                <p style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>
                  {s.value}
                </p>
              </motion.div>
            ))}
          </div>

          {/* WHY explanation */}
          {decision.why && (
            <div
              style={{
                background: "rgba(99,102,241,0.05)",
                border: "1px solid rgba(99,102,241,0.12)",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 14,
              }}
            >
              <p style={{ fontSize: 10, fontWeight: 700, color: "#818CF8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
                Why This Happened
              </p>
              <p style={{ fontSize: 13, color: "#D1D5DB", lineHeight: 1.65 }}>{decision.why}</p>
            </div>
          )}

          {/* Actions list */}
          {decision.action && decision.action.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
                Recommended Actions
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {decision.action.slice(0, 3).map((act, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.07 }}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      fontSize: 13,
                      color: "#D1D5DB",
                      lineHeight: 1.5,
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "rgba(99,102,241,0.14)",
                        color: "#818CF8",
                        fontSize: 11,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 1,
                      }}
                    >
                      {i + 1}
                    </span>
                    {act}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Decision footer */}
          {decision.decision && (
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                borderRadius: 10,
                padding: "10px 14px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                Decision
              </p>
              <p style={{ fontSize: 13, color: "#F9FAFB", lineHeight: 1.55, fontWeight: 500 }}>
                {decision.decision}
              </p>
            </div>
          )}

          {/* Anomaly type tag */}
          {anomalyLabel && (
            <div style={{ marginTop: 12 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  color: "#F87171",
                  borderRadius: 999,
                  padding: "3px 10px",
                  textTransform: "capitalize",
                }}
              >
                ⚠ {anomalyLabel}
              </span>
            </div>
          )}
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  );
}
