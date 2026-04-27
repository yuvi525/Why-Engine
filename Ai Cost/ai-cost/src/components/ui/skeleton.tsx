import { cn } from "./glass-card";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[#1F2937]/50",
        className
      )}
    />
  );
}
