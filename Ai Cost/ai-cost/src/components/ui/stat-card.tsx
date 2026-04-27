import { GlassCard } from "./glass-card";
import { cn } from "./glass-card";

export function StatCard({
  title,
  value,
  delta,
  deltaType = "neutral",
  icon: Icon,
  delay = 0,
}: {
  title: string;
  value: string | number;
  delta?: string;
  deltaType?: "success" | "warning" | "danger" | "neutral";
  icon?: any;
  delay?: number;
}) {
  const deltaColors = {
    success: "text-[#10B981]",
    warning: "text-[#F59E0B]",
    danger: "text-[#F43F5E]",
    neutral: "text-[#9CA3AF]",
  };

  return (
    <GlassCard delay={delay} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[#9CA3AF]">{title}</h3>
        {Icon && <Icon className="h-4 w-4 text-[#6366F1]" />}
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-semibold text-[#F9FAFB] tracking-tight">{value}</span>
        {delta && (
          <span className={cn("text-xs font-medium", deltaColors[deltaType])}>
            {delta}
          </span>
        )}
      </div>
    </GlassCard>
  );
}
