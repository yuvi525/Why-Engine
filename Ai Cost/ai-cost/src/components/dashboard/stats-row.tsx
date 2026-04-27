"use client";

import { motion, LayoutGroup } from "framer-motion";
import { StatCard } from "../ui/stat-card";
import { Skeleton } from "../ui/skeleton";
import { DollarSign, Activity, Zap, HardDrive } from "lucide-react";

export function StatsRow({ data, isLoading }: { data: any, isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-xl w-full" />
        ))}
      </div>
    );
  }

  return (
    <LayoutGroup>
      <motion.div layout className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Savings"
          value={`$${(data?.totalSavings || 0).toFixed(2)}`}
          delta="+12.5%"
          deltaType="success"
          icon={DollarSign}
          delay={0.1}
        />
        <StatCard
          title="Total Requests"
          value={(data?.totalRequests || 0).toLocaleString()}
          delta="+4.3%"
          deltaType="neutral"
          icon={Activity}
          delay={0.2}
        />
        <StatCard
          title="Efficiency Score"
          value={data?.efficiencyScore || 0}
          delta="Top 15%"
          deltaType="success"
          icon={Zap}
          delay={0.3}
        />
        <StatCard
          title="Cache Hit Rate"
          value={`${data?.cacheHitRate || 0}%`}
          delta="+2.1%"
          deltaType="success"
          icon={HardDrive}
          delay={0.4}
        />
      </motion.div>
    </LayoutGroup>
  );
}
