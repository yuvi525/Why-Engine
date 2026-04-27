"use client";

/**
 * src/components/layout/app-shell.tsx
 *
 * Root layout shell for all authenticated/dashboard pages.
 *
 * Desktop layout:
 *   [Sidebar 220px fixed] | [Main content flex-1]
 *
 * Mobile layout:
 *   [Top header bar 56px] at top
 *   [Content, scrollable, with bottom padding for nav]
 *   [Bottom nav bar 64px fixed]
 *
 * No absolute positioning — pure flexbox.
 */

import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#F9FAFB]">

      {/* ── Desktop Sidebar (hidden on mobile) ─────────────────── */}
      <Sidebar />

      {/* ── Mobile Top Header ───────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#0B0F14]/95 backdrop-blur-md border-b border-[rgba(255,255,255,0.06)] z-40 flex items-center px-4">
        <div className="flex items-center gap-2 font-bold tracking-tight text-white">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center">
            <span className="text-[10px] text-white font-bold">W</span>
          </div>
          <span className="text-sm">WHY Engine</span>
        </div>
      </div>

      {/* ── Main Content Area ────────────────────────────────────── */}
      {/*
        Desktop: offset left by sidebar width (220px) via padding-left
        Mobile: offset top by header (56px), offset bottom by mobile nav (64px)
      */}
      <main
        className={[
          "w-full",
          // Mobile: push content below top bar + above bottom nav
          "pt-14 pb-20",
          // Desktop: push content right of sidebar, reset top/bottom pad
          "lg:pl-[220px] lg:pt-0 lg:pb-0",
        ].join(" ")}
      >
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 min-h-screen">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ────────────────────────────────────── */}
      <MobileNav />

    </div>
  );
}
