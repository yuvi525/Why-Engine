"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "../ui/glass-card";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { apiClient } from "@/src/lib/api-client";

export function WhyExplanation({ requestId }: { requestId: string | null }) {
  const [whyText, setWhyText] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setWhyText(null);
      setIsPolling(false);
      return;
    }

    setWhyText(null);
    setIsPolling(true);

    let attempts = 0;
    const maxAttempts = 5; // 5 * 2s = 10s max

    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const data = await apiClient<any>(`/requests/${requestId}/why`);
        if (data.status !== "pending") {
          setWhyText(data.routing_reason || "No explicit reason provided.");
          setIsPolling(false);
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error("Failed to fetch WHY logic", err);
      }

      if (attempts >= maxAttempts && isPolling) {
        setIsPolling(false);
        clearInterval(pollInterval);
        setWhyText("Engine rationale could not be generated in time. Try refreshing later.");
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [requestId]);

  if (!requestId) return null;

  return (
    <GlassCard className="mt-6 border-l-4 border-l-[#6366F1]">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-[#F9FAFB]">The "WHY" Engine</h3>
        {isPolling && <Loader2 className="w-3 h-3 text-[#6366F1] animate-spin" />}
      </div>
      
      {isPolling && !whyText ? (
        <p className="text-sm text-[#9CA3AF] animate-pulse">Generating engine rationale...</p>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-sm text-[#D1D5DB] leading-relaxed italic"
        >
          {whyText}
        </motion.div>
      )}
    </GlassCard>
  );
}
