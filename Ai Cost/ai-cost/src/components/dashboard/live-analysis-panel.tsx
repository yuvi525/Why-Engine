"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "../ui/glass-card";
import { Badge } from "../ui/badge";
import { TrendingUp, Zap, Brain, Target } from "lucide-react";

interface LiveAnalysisPanelProps {
  latestRequest: any | null;
}

export function LiveAnalysisPanel({ latestRequest }: LiveAnalysisPanelProps) {
  if (!latestRequest) {
    return (
      <GlassCard className="min-h-[220px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[#1F2937] flex items-center justify-center mx-auto mb-3">
            <Brain className="w-5 h-5 text-[#6B7280]" />
          </div>
          <p className="text-[#9CA3AF] text-sm font-medium">No analysis yet</p>
          <p className="text-[#6B7280] text-xs mt-1">Send your first request to see the WHY Engine analysis</p>
        </div>
      </GlassCard>
    );
  }

  const savings = Number(latestRequest.savings_usd || 0);
  const cost = Number(latestRequest.cost_usd || 0);
  const model = latestRequest.model || "unknown";
  const routingReason = latestRequest.routing_reason || "Model selected by WHY Engine routing";
  const cacheHit = latestRequest.cache_hit;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={latestRequest.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#F9FAFB] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#6366F1]" />
              Latest Analysis
            </h3>
            <div className="flex items-center gap-2">
              {cacheHit && <Badge variant="success">Cache HIT</Badge>}
              <Badge variant="accent">{model}</Badge>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              {
                icon: <Target className="w-3.5 h-3.5" />,
                label: "Actual Cost",
                value: `$${cost.toFixed(6)}`,
                color: "text-[#F43F5E]",
                bg: "bg-[#F43F5E]/10",
              },
              {
                icon: <TrendingUp className="w-3.5 h-3.5" />,
                label: "Saved vs GPT-4o",
                value: `$${savings.toFixed(6)}`,
                color: "text-[#10B981]",
                bg: "bg-[#10B981]/10",
              },
              {
                icon: <Brain className="w-3.5 h-3.5" />,
                label: "Tokens",
                value: ((latestRequest.input_tokens || 0) + (latestRequest.output_tokens || 0)).toLocaleString(),
                color: "text-[#818CF8]",
                bg: "bg-[#6366F1]/10",
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.3 }}
                className="rounded-xl bg-[#0B0F14]/80 border border-[rgba(255,255,255,0.06)] p-3"
              >
                <div className={`flex items-center gap-1.5 ${stat.color} mb-1.5`}>
                  <div className={`${stat.bg} ${stat.color} p-1 rounded-md`}>{stat.icon}</div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">{stat.label}</span>
                </div>
                <div className={`text-base font-bold ${stat.color} font-mono`}>{stat.value}</div>
              </motion.div>
            ))}
          </div>

          {/* WHY Explanation */}
          <div className="rounded-xl bg-[rgba(99,102,241,0.06)] border border-[rgba(99,102,241,0.14)] p-3">
            <p className="text-[10px] font-bold text-[#818CF8] uppercase tracking-wider mb-1.5">WHY Engine Rationale</p>
            <p className="text-sm text-[#D1D5DB] leading-relaxed italic">{routingReason}</p>
          </div>

          {/* Request ID */}
          {latestRequest.id && (
            <p className="text-[10px] text-[#374151] font-mono mt-3">
              Request ID: {latestRequest.id}
            </p>
          )}
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  );
}
