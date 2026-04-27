"use client";

import { motion } from "framer-motion";
import { GlassCard } from "../ui/glass-card";
import { Badge } from "../ui/badge";

export function ActivityFeed({ activities = [] }: { activities?: any[] }) {
  if (activities.length === 0) {
    return (
      <GlassCard delay={0.7} className="col-span-full lg:col-span-1 flex items-center justify-center min-h-[300px]">
        <div className="text-[#9CA3AF] text-sm">Activity will appear here as requests are processed.</div>
      </GlassCard>
    );
  }

  return (
    <GlassCard delay={0.7} className="col-span-full lg:col-span-1 max-h-[400px] overflow-y-auto">
      <h3 className="text-lg font-medium text-[#F9FAFB] mb-6 sticky top-0 bg-[#111827]/80 backdrop-blur pb-2">Activity Feed</h3>
      <div className="space-y-4">
        {activities.map((item, i) => (
          <motion.div
            key={item.id || i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + i * 0.05 }}
            className="flex flex-col gap-1 p-3 rounded-lg border border-[#1F2937] hover:bg-[#1F2937]/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <Badge variant={item.event_type?.includes('error') ? 'danger' : 'accent'}>
                {item.event_type || 'system_event'}
              </Badge>
              <span className="text-xs text-[#6B7280]">
                {new Date(item.created_at || Date.now()).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm text-[#D1D5DB] mt-1">{item.message}</p>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
}
