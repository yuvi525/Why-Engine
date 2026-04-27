"use client";

import { motion } from "framer-motion";
import { GlassCard } from "../ui/glass-card";

export function ResponseOutput({ responseText }: { responseText: string | null }) {
  if (!responseText) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <GlassCard className="mt-6 min-h-[200px]">
        <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">Model Response</h3>
        <div className="font-mono text-sm text-[#F9FAFB] whitespace-pre-wrap leading-relaxed">
          {responseText}
        </div>
      </GlassCard>
    </motion.div>
  );
}
