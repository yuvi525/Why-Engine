"use client";

import { useState } from "react";
import { GlassCard } from "../ui/glass-card";
import { apiClient } from "@/src/lib/api-client";

export function BudgetGuardrailsPanel({ policy, addToast }: { policy: any, addToast: (msg: string, type: "success"|"error") => void }) {
  const [enabled, setEnabled] = useState(policy?.autopilot_enabled ?? true);
  const [daily, setDaily] = useState(policy?.daily_budget_usd || 100);
  const [maxInput, setMaxInput] = useState(policy?.max_input_tokens || 8000);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient("/orgs/policy", {
        method: "PATCH",
        body: JSON.stringify({
          autopilot_enabled: enabled,
          daily_budget_usd: Number(daily),
          max_input_tokens: Number(maxInput)
        })
      });
      addToast("Guardrails updated.", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-[#F9FAFB]">Autopilot Guardrails</h3>
          <p className="text-sm text-[#9CA3AF]">Configure automated budget controls and token limits.</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={enabled} onChange={() => setEnabled(!enabled)} />
          <div className="w-11 h-6 bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10B981]"></div>
        </label>
      </div>

      <div className={`space-y-6 max-w-lg transition-opacity ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div>
          <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Daily Budget Limit (USD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">$</span>
            <input
              type="number"
              value={daily}
              onChange={(e) => setDaily(e.target.value)}
              className="w-full bg-[#111827] border border-[#374151] rounded-lg p-3 pl-8 text-white focus:ring-1 focus:ring-[#10B981] outline-none"
            />
          </div>
          <p className="text-xs text-[#6B7280] mt-1">Autopilot will block or downgrade requests if this daily limit is breached.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Max Input Tokens Per Request</label>
          <input
            type="number"
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            className="w-full bg-[#111827] border border-[#374151] rounded-lg p-3 text-white focus:ring-1 focus:ring-[#10B981] outline-none"
          />
          <p className="text-xs text-[#6B7280] mt-1">Requests exceeding this size will trigger aggressive compression or rejection.</p>
        </div>
        
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#1F2937] hover:bg-[#374151] border border-[#374151] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {isSaving ? "Saving..." : "Save Guardrails"}
        </button>
      </div>
    </GlassCard>
  );
}
