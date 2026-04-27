"use client";

import { useState } from "react";
import { GlassCard } from "../ui/glass-card";
import { Badge } from "../ui/badge";
import { Zap, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { apiClient } from "@/src/lib/api-client";
import { motion, AnimatePresence } from "framer-motion";

export function RecommendationsList({ recommendations }: { recommendations: any[] }) {
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [applied, setApplied] = useState<number[]>([]);

  const handleApply = async (idx: number, type: string) => {
    setApplyingId(idx);
    try {
      // Stub for actual application logic, for now it mocks an async apply
      await new Promise(r => setTimeout(r, 1000));
      setApplied(prev => [...prev, idx]);
    } catch (err) {
      console.error(err);
    } finally {
      setApplyingId(null);
    }
  };

  if (!recommendations || recommendations.length === 0) {
    return (
      <GlassCard className="lg:col-span-2">
        <h3 className="text-lg font-medium text-[#F9FAFB] mb-6">Autopilot Recommendations</h3>
        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-[#374151] rounded-xl">
          <CheckCircle className="w-8 h-8 text-[#10B981] mb-2" />
          <p className="text-[#9CA3AF]">Your pipeline is fully optimized. No recommendations at this time.</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="lg:col-span-2">
      <div className="flex items-center gap-2 mb-6">
        <Zap className="w-5 h-5 text-[#F59E0B]" />
        <h3 className="text-lg font-medium text-[#F9FAFB]">Autopilot Recommendations</h3>
      </div>
      <div className="space-y-4">
        <AnimatePresence>
          {recommendations.map((rec, idx) => {
            const isApplying = applyingId === idx;
            const isApplied = applied.includes(idx);
            
            if (isApplied) return null;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#374151] bg-[#111827]/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="warning">{rec.type}</Badge>
                    <span className="text-sm font-medium text-[#F9FAFB]">Est. Savings: ${rec.impact_usd}/mo</span>
                  </div>
                  <p className="text-sm text-[#D1D5DB]">{rec.description}</p>
                </div>
                <button
                  onClick={() => handleApply(idx, rec.type)}
                  disabled={isApplying}
                  className="flex items-center justify-center min-w-[100px] bg-[#6366F1] hover:bg-[#4F46E5] disabled:bg-[#374151] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply Fix"}
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {applied.length === recommendations.length && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center p-8 border border-dashed border-[#10B981]/30 rounded-xl bg-[#10B981]/5">
            <CheckCircle className="w-8 h-8 text-[#10B981] mb-2" />
            <p className="text-[#10B981] font-medium">All recommendations applied!</p>
          </motion.div>
        )}
      </div>
    </GlassCard>
  );
}
