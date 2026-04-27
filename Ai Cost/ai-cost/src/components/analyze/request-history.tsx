"use client";

import { Clock } from "lucide-react";
import { GlassCard } from "../ui/glass-card";

export function RequestHistory({ history, onRestore }: { history: any[], onRestore: (item: any) => void }) {
  if (history.length === 0) return null;

  return (
    <GlassCard className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-[#9CA3AF]" />
        <h3 className="text-sm font-medium text-[#F9FAFB]">Recent Requests</h3>
      </div>
      <div className="space-y-2">
        {history.map((item, i) => (
          <button
            key={i}
            onClick={() => onRestore(item)}
            className="w-full text-left p-3 rounded-lg border border-[#1F2937] hover:bg-[#1F2937]/50 transition-colors"
          >
            <div className="text-sm text-[#D1D5DB] truncate">{item.prompt}</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-[#6B7280]">{item.model}</span>
              <span className="text-xs text-[#10B981]">${Number(item.metadata['X-Cost-USD'] || 0).toFixed(4)}</span>
            </div>
          </button>
        ))}
      </div>
    </GlassCard>
  );
}
