"use client";

/**
 * src/components/layout/sidebar.tsx
 *
 * Desktop sidebar navigation.
 * Active indicator uses CSS only (no Framer Motion layoutId) to prevent
 * React 19 + Framer Motion v12 infinite effect recursion.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { cn } from "../ui/glass-card";
import { AnimatePresence, motion } from "framer-motion";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/client";
import { COPY_MAP } from "@/lib/brand-constants";

const NAV_LINKS = [
  { name: "⚡ Connect AI",           href: "/connect",                 highlight: true },
  { name: COPY_MAP.nav_dashboard,     href: "/dashboard" },
  { name: COPY_MAP.nav_analyze,       href: "/analyze" },
  { name: COPY_MAP.nav_autopilot,     href: "/dashboard/autopilot" },
  { name: "API Keys",                 href: "/dashboard/api-keys" },
  { name: "System Health",            href: "/dashboard/system-health" },
  { name: "Pricing",                  href: "/pricing" },
  { name: "Docs",                     href: "/docs" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [liveCost, setLiveCost] = useState<number | null>(null);
  const [livePulse, setLivePulse] = useState(false);

  // Live cost ticker — polls /api/usage only when authenticated
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    let interval: NodeJS.Timeout;

    supabase.auth.getSession().then(({ data }) => {
      if (!data?.session) return;

      const poll = async () => {
        try {
          const res = await fetch("/api/usage?range=7d");
          if (!res.ok) return;
          const records: any[] = await res.json();
          const today = new Date().toDateString();
          const todayCost = records
            .filter(r => new Date(r.created_at).toDateString() === today)
            .reduce((sum, r) => sum + Number(r.cost_usd || 0), 0);

          if (todayCost > 0) {
            setLiveCost(todayCost);
            setLivePulse(true);
            setTimeout(() => setLivePulse(false), 800);
          }
        } catch {
          // silently ignore — sidebar ticker is non-critical
        }
      };

      poll();
      interval = setInterval(poll, 15_000);
    });

    return () => clearInterval(interval);
  }, []); // [] is correct — runs once on mount

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-[220px] flex-col bg-[#0B0F14] border-r border-[rgba(255,255,255,0.06)]">
      {/* Logo */}
      <div className="flex h-16 items-center px-5 border-b border-[rgba(255,255,255,0.06)] shrink-0">
        <div className="flex items-center gap-2.5 font-bold text-[15px] tracking-tight text-white">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#4F46E5] flex items-center justify-center shadow-[0_0_16px_rgba(99,102,241,0.4)]">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          WHY Engine
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto">
        {NAV_LINKS.map((link, idx) => {
          const isActive =
            pathname === link.href ||
            (link.href.length > 1 && pathname.startsWith(link.href));
          const isHighlight = (link as any).highlight;
          const addSep = idx === 4;

          return (
            <div key={link.href}>
              {addSep && (
                <div
                  style={{
                    height: 1,
                    background: "rgba(255,255,255,0.06)",
                    margin: "6px 4px 8px",
                  }}
                />
              )}
              <Link
                href={link.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 select-none",
                  isActive
                    ? "text-white bg-[rgba(99,102,241,0.14)] border border-[rgba(99,102,241,0.22)]"
                    : isHighlight
                    ? "text-[#818CF8] hover:text-[#A5B4FC] hover:bg-[rgba(99,102,241,0.06)] border border-transparent"
                    : "text-[#6B7280] hover:text-[#D1D5DB] hover:bg-[rgba(255,255,255,0.04)] border border-transparent"
                )}
              >
                <span>{link.name}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Live cost ticker */}
      <div className="p-3 border-t border-[rgba(255,255,255,0.06)] shrink-0">
        <AnimatePresence>
          {liveCost !== null ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-[rgba(16,185,129,0.07)] border border-[rgba(16,185,129,0.15)] p-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <motion.span
                  animate={livePulse ? { scale: [1, 1.6, 1] } : { scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_rgba(16,185,129,0.8)]"
                />
                <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#10B981]">
                  Live Spend
                </span>
              </div>
              <div className="text-lg font-bold text-white tracking-tight">
                ${liveCost.toFixed(4)}
                <span className="text-[10px] font-normal text-[#6B7280] ml-1">today</span>
              </div>
            </motion.div>
          ) : (
            <div className="rounded-xl bg-[#111827] p-3 border border-[rgba(255,255,255,0.06)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6B7280] mb-1">
                Activity
              </div>
              <div className="text-xs text-[#374151]">No spend tracked yet</div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
