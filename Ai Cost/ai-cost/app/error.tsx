"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { AppShell } from "@/src/components/layout/app-shell";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global Error Boundary caught:", error);
  }, [error]);

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center h-[70vh] max-w-md mx-auto text-center">
        <div className="w-16 h-16 bg-[#F43F5E]/10 rounded-full flex items-center justify-center mb-6 border border-[#F43F5E]/20">
          <AlertCircle className="w-8 h-8 text-[#F43F5E]" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Something went wrong!</h2>
        <p className="text-[#9CA3AF] mb-8">
          We encountered an unexpected error while loading this page. Our team has been notified.
        </p>
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 bg-[#1F2937] hover:bg-[#374151] text-white px-6 py-3 rounded-xl border border-[#374151] transition-colors"
        >
          <RefreshCcw className="w-4 h-4" /> Try Again
        </button>
      </div>
    </AppShell>
  );
}
