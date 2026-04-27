"use client";

import { GlassCard } from "../ui/glass-card";
import { Badge } from "../ui/badge";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function MetadataPanel({ metadata }: { metadata: Record<string, string> | null }) {
  const [copied, setCopied] = useState(false);

  if (!metadata) {
    return (
      <GlassCard className="h-full flex items-center justify-center min-h-[300px]">
        <span className="text-[#9CA3AF] text-sm text-center">
          Submit a prompt to view execution metadata, routing decisions, and savings.
        </span>
      </GlassCard>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(metadata['X-Request-Id'] || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <GlassCard className="h-full flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-medium text-[#F9FAFB] mb-4">Request Metadata</h3>
        <div className="space-y-4">
          
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#9CA3AF] uppercase tracking-wider">Model Used</span>
            <div className="flex items-center">
              <Badge variant="accent">{metadata['X-Model-Used'] || 'unknown'}</Badge>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#9CA3AF] uppercase tracking-wider">Actual Cost</span>
            <span className="text-xl font-semibold text-[#F9FAFB]">
              ${Number(metadata['X-Cost-USD'] || 0).toFixed(6)}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#9CA3AF] uppercase tracking-wider">Savings (vs GPT-4o)</span>
            <div className="flex items-center">
              <Badge variant="success" className="text-sm py-1 px-3">
                +${Number(metadata['X-Savings-USD'] || 0).toFixed(6)}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#9CA3AF] uppercase tracking-wider">Cache Status</span>
            <div className="flex items-center">
              {metadata['X-Cache-Hit'] === 'true' ? (
                <Badge variant="success">HIT</Badge>
              ) : (
                <Badge variant="neutral">MISS</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1 pt-4 border-t border-[#1F2937]">
            <span className="text-xs text-[#9CA3AF] uppercase tracking-wider">Request ID</span>
            <div className="flex items-center justify-between bg-[#111827] border border-[#1F2937] p-2 rounded-lg group">
              <span className="font-mono text-xs text-[#D1D5DB] truncate pr-4">
                {metadata['X-Request-Id'] || 'unknown'}
              </span>
              <button onClick={handleCopy} className="text-[#9CA3AF] hover:text-white transition-colors">
                {copied ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

        </div>
      </div>
    </GlassCard>
  );
}
