"use client";

import { AppShell } from "@/src/components/layout/app-shell";
import { ApiKeysPanel } from "@/src/components/settings/api-keys-panel";
import { OrgConfigPanel } from "@/src/components/settings/org-config-panel";
import { BudgetGuardrailsPanel } from "@/src/components/settings/budget-guardrails-panel";
import { Toast } from "@/src/components/ui/toast";
import { useEffect, useState } from "react";
import { apiClient } from "@/src/lib/api-client";
import { Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";

export default function SettingsPage() {
  const [data, setData] = useState<any>(null);
  const [toasts, setToasts] = useState<any[]>([]);

  const addToast = (message: string, type: "success"|"error"|"info") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Normally we'd build an endpoint for full settings, or do this Server-Side.
        // For simplicity, we fetch keys and use mock for org since we haven't built GET /orgs/config yet
        const keys = await apiClient<any>("/keys");
        setData({
          keys,
          org: { name: "Demo Org" },
          policy: { autopilot_enabled: true, daily_budget_usd: 100, max_input_tokens: 8000 }
        });
      } catch (err: any) {
        addToast(err.message, "error");
      }
    };
    fetchSettings();
  }, []);

  if (!data) {
    return (
      <AppShell>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#6366F1]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
          <p className="text-[#9CA3AF] mt-1">Manage your organization, API keys, and autopilot guardrails.</p>
        </div>

        <ApiKeysPanel initialKeys={data.keys} addToast={addToast} />
        <OrgConfigPanel org={data.org} addToast={addToast} />
        <BudgetGuardrailsPanel policy={data.policy} addToast={addToast} />
        
        {/* Toast Container */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
          <AnimatePresence>
            {toasts.map(t => (
              <Toast key={t.id} id={t.id} message={t.message} type={t.type} onClose={removeToast} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  );
}
