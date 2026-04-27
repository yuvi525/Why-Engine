import { cn } from "./glass-card";

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "neutral" | "accent";
  className?: string;
}) {
  const variants = {
    success: "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20",
    warning: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20",
    danger: "bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/20",
    neutral: "bg-[#1F2937] text-[#D1D5DB] border-[#374151]",
    accent: "bg-[#6366F1]/10 text-[#818CF8] border-[#6366F1]/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
