"use client";

import { AppShell } from "@/src/components/layout/app-shell";
import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <AppShell>
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#38BDF8] animate-spin" />
          <p className="text-[#9CA3AF] text-sm animate-pulse">Aggregating usage data...</p>
        </div>
      </div>
    </AppShell>
  );
}
