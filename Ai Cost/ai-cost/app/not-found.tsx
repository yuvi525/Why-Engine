"use client";

import Link from "next/link";
import { Search, ArrowLeft } from "lucide-react";
import { AppShell } from "@/src/components/layout/app-shell";

export default function NotFound() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center h-[70vh] max-w-md mx-auto text-center">
        <div className="w-16 h-16 bg-[#1F2937] rounded-full flex items-center justify-center mb-6 border border-[#374151]">
          <Search className="w-8 h-8 text-[#9CA3AF]" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">404 - Not Found</h2>
        <p className="text-[#9CA3AF] mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white px-6 py-3 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    </AppShell>
  );
}
