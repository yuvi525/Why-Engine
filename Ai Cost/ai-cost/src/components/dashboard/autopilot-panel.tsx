"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bot, Zap, CheckCircle, Clock, ChevronRight, Loader2 } from "lucide-react";
import { GlassCard } from "../ui/glass-card";

interface AutopilotSuggestion {
  id: string;
  type?: string;
  priority?: string;
  title: string;
  detail?: string;
  estimatedMonthlySavings?: number;
  confidence?: string | number;
  manual_action?: string;
}

interface AutopilotData {
  suggestions?: AutopilotSuggestion[];
  rules_triggered?: number;
  rule_results?: any[];
}

interface AutopilotPanelProps {
  autopilot: AutopilotData | null;
  isLoading?: boolean;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
  critical: "#ef4444",
};

export function AutopilotPanel({ autopilot, isLoading }: AutopilotPanelProps) {
  if (isLoading) {
    return (
      <GlassCard delay={0.5}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-[rgba(34,197,94,0.1)] flex items-center justify-center">
            <Bot className="w-4 h-4 text-[#22c55e]" />
          </div>
          <h3 className="text-base font-semibold text-[#F9FAFB]">Autopilot Suggestions</h3>
        </div>
        <div className="flex items-center justify-center py-10">
          <div className="flex items-center gap-3 text-[#9CA3AF] text-sm">
            <Loader2 size={16} className="animate-spin" />
            Generating suggestions…
          </div>
        </div>
      </GlassCard>
    );
  }

  const suggestions = autopilot?.suggestions ?? [];
  const rulesTriggered = autopilot?.rules_triggered ?? 0;

  return (
    <GlassCard delay={0.5}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[rgba(34,197,94,0.1)] flex items-center justify-center">
            <Bot className="w-4 h-4 text-[#22c55e]" />
          </div>
          <h3 className="text-base font-semibold text-[#F9FAFB]">Autopilot Suggestions</h3>
        </div>
        {rulesTriggered > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.2)",
              color: "#22c55e",
              borderRadius: 999,
              padding: "3px 10px",
            }}
          >
            {rulesTriggered} rule{rulesTriggered !== 1 ? "s" : ""} triggered
          </span>
        )}
      </div>

      {suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          <CheckCircle size={32} style={{ color: "#22c55e", opacity: 0.6 }} />
          <p className="text-sm text-[#9CA3AF]">All clear — no urgent suggestions right now.</p>
        </div>
      ) : (
        <AnimatePresence>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {suggestions.slice(0, 4).map((s, i) => {
              const priorityColor = PRIORITY_COLOR[String(s.priority || "medium").toLowerCase()] ?? "#818CF8";
              return (
                <motion.div
                  key={s.id ?? i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.3 }}
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    cursor: "default",
                    transition: "border-color 0.2s",
                  }}
                  whileHover={{ scale: 1.005, borderColor: "rgba(255,255,255,0.12)" }}
                >
                  {/* Priority dot */}
                  <div
                    style={{
                      flexShrink: 0,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: priorityColor,
                      marginTop: 5,
                      boxShadow: `0 0 6px ${priorityColor}`,
                    }}
                  />

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#F9FAFB" }}>{s.title}</p>
                      {s.estimatedMonthlySavings != null && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#10B981", fontFamily: "monospace" }}>
                          −${s.estimatedMonthlySavings.toFixed(0)}/mo
                        </span>
                      )}
                    </div>

                    {s.detail && (
                      <p style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.55, marginBottom: s.manual_action ? 8 : 0 }}>
                        {s.detail}
                      </p>
                    )}

                    {s.manual_action && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                        <ChevronRight size={11} style={{ color: "#818CF8" }} />
                        <span style={{ fontSize: 11, color: "#818CF8", fontWeight: 600 }}>
                          {s.manual_action}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}

      {/* Footer stats */}
      {(autopilot?.rule_results?.length ?? 0) > 0 && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Clock size={12} style={{ color: "#6B7280" }} />
          <span style={{ fontSize: 11, color: "#6B7280" }}>
            {autopilot!.rule_results!.length} rule result{autopilot!.rule_results!.length !== 1 ? "s" : ""} evaluated
          </span>
        </div>
      )}
    </GlassCard>
  );
}
