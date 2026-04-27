"use client";

import { useState } from "react";
import { GlassCard } from "../ui/glass-card";
import { apiClient } from "@/src/lib/api-client";

export function OrgConfigPanel({ org, addToast }: { org: any, addToast: (msg: string, type: "success"|"error") => void }) {
  const [name, setName] = useState(org?.name || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient("/orgs/config", {
        method: "PATCH",
        body: JSON.stringify({ name })
      });
      addToast("Organization details updated.", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <GlassCard>
      <h3 className="text-lg font-medium text-[#F9FAFB] mb-1">Organization Profile</h3>
      <p className="text-sm text-[#9CA3AF] mb-6">Manage your core workspace identity.</p>

      <div className="space-y-4 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Organization Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#111827] border border-[#374151] rounded-lg p-3 text-white focus:ring-1 focus:ring-[#6366F1] outline-none"
          />
        </div>
        
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#1F2937] hover:bg-[#374151] border border-[#374151] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </GlassCard>
  );
}
