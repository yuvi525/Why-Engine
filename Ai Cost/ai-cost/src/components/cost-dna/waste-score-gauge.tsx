"use client";

import { motion } from "framer-motion";
import { GlassCard } from "../ui/glass-card";

export function WasteScoreGauge({ score }: { score: number }) {
  // A simple SVG donut/arc gauge
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  // Let's make it a 180 degree arc
  const arcLength = Math.PI * radius;
  const percent = score / 100;
  const strokeDashoffset = arcLength - percent * arcLength;

  const color = score > 70 ? "#F43F5E" : score > 30 ? "#F59E0B" : "#10B981";

  return (
    <GlassCard className="flex flex-col items-center justify-center p-8">
      <h3 className="text-sm font-medium text-[#9CA3AF] mb-6">System Waste Score</h3>
      <div className="relative flex items-center justify-center">
        <svg width="200" height="120" viewBox="0 0 200 120" className="overflow-visible">
          {/* Background Arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#1F2937"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {/* Foreground Arc */}
          <motion.path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${arcLength}`}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset: arcLength - (score / 100) * arcLength }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute bottom-4 flex flex-col items-center">
          <span className="text-5xl font-bold tracking-tight text-white" style={{ color }}>{score}</span>
          <span className="text-xs text-[#9CA3AF] mt-1">/ 100</span>
        </div>
      </div>
      <p className="text-sm text-center text-[#D1D5DB] mt-4 max-w-xs">
        {score > 70 
          ? "High waste detected. Immediate action recommended to reduce LLM overhead."
          : score > 30
          ? "Moderate optimization possible. Consider enabling stricter Autopilot guardrails."
          : "Highly optimized. Your cost fingerprint is extremely efficient."}
      </p>
    </GlassCard>
  );
}
