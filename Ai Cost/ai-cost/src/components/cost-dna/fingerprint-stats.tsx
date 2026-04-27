"use client";

import { GlassCard } from "../ui/glass-card";
import { HardDrive, Minimize2, Hash, RefreshCcw } from "lucide-react";

export function FingerprintStats({ metrics }: { metrics: any }) {
  const stats = [
    {
      label: "Semantic Cache Hit Rate",
      value: `${(metrics?.cache_hit_rate || 24)}%`,
      icon: HardDrive,
      color: "text-[#10B981]",
      bg: "bg-[#10B981]/10"
    },
    {
      label: "Avg Prompt Compression",
      value: `${(metrics?.compression_rate || 15)}%`,
      icon: Minimize2,
      color: "text-[#38BDF8]",
      bg: "bg-[#38BDF8]/10"
    },
    {
      label: "Avg Tokens / Request",
      value: (metrics?.avg_tokens || 850).toLocaleString(),
      icon: Hash,
      color: "text-[#818CF8]",
      bg: "bg-[#818CF8]/10"
    },
    {
      label: "Loop Frequency",
      value: `${(metrics?.loop_frequency || 2)}%`,
      icon: RefreshCcw,
      color: "text-[#F59E0B]",
      bg: "bg-[#F59E0B]/10"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 col-span-full">
      {stats.map((stat, idx) => (
        <GlassCard key={idx} delay={0.2 + idx * 0.1} className="p-4 flex items-center gap-4">
          <div className={`p-3 rounded-lg ${stat.bg}`}>
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
          </div>
          <div>
            <div className="text-xs text-[#9CA3AF] mb-1">{stat.label}</div>
            <div className="text-xl font-bold text-[#F9FAFB] tracking-tight">{stat.value}</div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
