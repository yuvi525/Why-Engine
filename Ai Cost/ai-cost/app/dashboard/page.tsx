"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/src/components/layout/app-shell";
import { StatsRow } from "@/src/components/dashboard/stats-row";
import { ActivityFeed } from "@/src/components/dashboard/activity-feed";
import { WHYAnalysisPanel } from "@/src/components/dashboard/why-analysis-panel";
import { AutopilotPanel } from "@/src/components/dashboard/autopilot-panel";
import { CostChart } from "@/components/charts/CostChart";
import { ModelDistributionChart } from "@/components/charts/ModelDistribution";
import { apiClient } from "@/src/lib/api-client";
import { DEMO_ANALYSIS_RESULTS, DEMO_USAGE } from "@/lib/demo-data";
import { supabase } from "@/lib/supabase-browser";

const REFRESH_MS = 10_000;

// ── Sample usage for the fallback analyze call ────────────────────
const SAMPLE_USAGE = [
  { model: "gpt-4o",      tokens: 18500, cost: 0.185 },
  { model: "gpt-4o-mini", tokens: 42000, cost: 0.126 },
];

export default function DashboardPage() {
  // ── Core usage / activity state ───────────────────────────────
  const [stats,         setStats]        = useState<any>(null);
  const [usageData,     setUsageData]    = useState<any[]>([]);
  const [activities,    setActivities]   = useState<any[]>([]);
  const [isLoading,     setIsLoading]    = useState(true);

  // ── WHY analysis state ────────────────────────────────────────
  const [decision,      setDecision]     = useState<any>(null);
  const [decisionSrc,   setDecisionSrc]  = useState<"live" | "demo">("demo");
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // ── Autopilot state ───────────────────────────────────────────
  const [autopilot,     setAutopilot]    = useState<any>(null);
  const [autopilotLoading, setAutopilotLoading] = useState(false);
  const [isLoggedIn,    setIsLoggedIn]   = useState(false);

  // ──────────────────────────────────────────────────────────────
  // FETCH AUTOPILOT SUGGESTIONS after decision loads
  // ──────────────────────────────────────────────────────────────
  const fetchAutopilot = useCallback(async (decisionPayload: any) => {
    if (!decisionPayload) return;
    setAutopilotLoading(true);
    try {
      const apRes = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: decisionPayload }),
      });
      if (apRes.ok) {
        const apData = await apRes.json();
        setAutopilot(apData);
      }
    } catch {
      // autopilot is non-critical — silently fail
    } finally {
      setAutopilotLoading(false);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────
  // LOAD DEMO DATA (when not logged in)
  // ──────────────────────────────────────────────────────────────
  const loadDemo = useCallback(() => {
    const demo = DEMO_ANALYSIS_RESULTS[0];
    setDecision(demo);
    setDecisionSrc("demo");
    setStats({
      totalCost:      DEMO_USAGE.total_cost_mtd,
      totalSavings:   DEMO_USAGE.savings_from_autopilot_usd,
      totalRequests:  DEMO_USAGE.requests_today,
      cacheHitRate:   DEMO_USAGE.cache_hit_rate_pct,
      efficiencyScore: DEMO_USAGE.efficiency_score,
    });
  }, []);

  // ──────────────────────────────────────────────────────────────
  // LOAD LIVE DATA (when logged in)
  // ──────────────────────────────────────────────────────────────
  const loadLive = useCallback(async () => {
    try {
      // 1 — Usage + requests in parallel
      const [usage, reqs] = await Promise.allSettled([
        apiClient<any[]>("/usage?range=30d"),
        apiClient<any[]>("/requests?limit=20"),
      ]);
      const usageRecords  = usage.status  === "fulfilled" ? usage.value  : [];
      const requestRecords = reqs.status  === "fulfilled" ? reqs.value   : [];

      setUsageData(usageRecords);
      setActivities(requestRecords);

      // 2 — Derive stats
      const totalCost     = usageRecords.reduce((s: number, r: any) => s + Number(r.cost_usd    || 0), 0);
      const totalSavings  = usageRecords.reduce((s: number, r: any) => s + Number(r.savings_usd || 0), 0);
      const totalRequests = usageRecords.length;
      const cacheHits     = usageRecords.filter((r: any) => r.cache_hit).length;
      const cacheHitRate  = totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0;
      setStats({
        totalCost,
        totalSavings,
        totalRequests,
        cacheHitRate,
        efficiencyScore: totalSavings > 0
          ? Math.min(99, Math.round((totalSavings / (totalCost + totalSavings)) * 100))
          : 0,
      });

      // 3 — Latest WHY analysis: GET /api/latest-analysis
      setAnalysisLoading(true);
      const aRes = await fetch("/api/latest-analysis");
      if (aRes.ok) {
        const d = await aRes.json();
        if (d?.found && d.analysis) {
          setDecision(d.analysis);
          setDecisionSrc("live");
          // Fire autopilot after decision loads
          fetchAutopilot(d.analysis);
          return;
        }
      }

      // 4 — Fallback: POST /api/analyze with sample data
      const fRes = await fetch("/api/analyze", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ usage: SAMPLE_USAGE }),
      });
      if (fRes.ok) {
        const fd = await fRes.json();
        if (fd && !fd.message) {
          setDecision(fd);
          setDecisionSrc("live");
          fetchAutopilot(fd);
        }
      }
    } catch {
      // Non-critical — keep existing demo data
    } finally {
      setAnalysisLoading(false);
      setIsLoading(false);
    }
  }, [fetchAutopilot]);

  // ──────────────────────────────────────────────────────────────
  // INIT
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Always show demo data immediately
      loadDemo();
      setIsLoading(false);

      // Then check auth and load live if session exists
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (data?.session) {
        setIsLoggedIn(true);
        await loadLive();
      }
    }

    init();

    const interval = setInterval(() => {
      if (isLoggedIn) loadLive();
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ──────────────────────────────────────────────────────────────
  // COST CHART DATA — demo: from daily_traces; live: from usageData
  // ──────────────────────────────────────────────────────────────
  const costChartData = (() => {
    if (usageData.length > 0) {
      // Live: aggregate per day
      const daily: Record<string, { cost: number; savings: number }> = {};
      usageData.forEach((r: any) => {
        const d = new Date(r.created_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
        if (!daily[d]) daily[d] = { cost: 0, savings: 0 };
        daily[d].cost    += Number(r.cost_usd    || 0);
        daily[d].savings += Number(r.savings_usd || 0);
      });
      return Object.entries(daily)
        .slice(-14)
        .map(([date, vals]) => ({
          date,
          cost:    parseFloat(vals.cost.toFixed(4)),
          savings: parseFloat(vals.savings.toFixed(4)),
        }));
    }
    // Demo: derive from daily_traces
    return (DEMO_USAGE.daily_traces || []).slice(-14).map((traces: number, i: number) => {
      const date = new Date();
      date.setDate(date.getDate() - (13 - i));
      const cost    = parseFloat((traces * 0.0043).toFixed(2));
      const savings = parseFloat((cost * 0.28).toFixed(2));
      return {
        date: date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }),
        cost,
        savings,
      };
    });
  })();

  // ──────────────────────────────────────────────────────────────
  // MODEL PIE DATA — demo: node_breakdown; live: rankedContributors
  // ──────────────────────────────────────────────────────────────
  const pieData = (() => {
    if (decision?.rankedContributors?.length) {
      return decision.rankedContributors.map((c: any) => ({
        name:    c.model,
        value:   c.totalCost,
        tokens:  c.totalTokens,
        percentage: c.percentage,
      }));
    }
    const nb = decision?.node_breakdown || {};
    return Object.entries(nb).map(([name, data]: [string, any]) => ({
      name,
      value:  parseFloat((data.cost_usd || 0).toFixed(4)),
      tokens: data.tokens || 0,
    }));
  })();

  const hasLiveData = usageData.length > 0;

  // ──────────────────────────────────────────────────────────────
  // STAT CARDS VARIANTS (for stagger animation)
  // ──────────────────────────────────────────────────────────────
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07 } },
  };
  const item = {
    hidden: { opacity: 0, y: 16 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as any } },
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ── Page header ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
              <p className="text-[#9CA3AF] mt-1">
                Real-time AI cost intelligence and autopilot recommendations.
              </p>
            </div>
            {/* Live indicator */}
            <div className="flex items-center gap-2 text-xs font-semibold text-[#10B981] bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.18)] rounded-full px-3 py-1.5">
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_rgba(16,185,129,0.8)]"
              />
              {hasLiveData ? "Live data" : decisionSrc === "demo" ? "Demo mode" : "Awaiting data"}
            </div>
          </div>
        </motion.div>

        {/* ── Stats Row (animated stagger) ─────────────────────── */}
        {isLoading ? (
          <StatsRow data={null} isLoading={true} />
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {[
              {
                title: "AI Spend (MTD)",
                value: `$${(stats?.totalCost ?? 0).toFixed(2)}`,
                delta: "+12.5%",
                deltaType: "danger",
              },
              {
                title: "Autopilot Savings",
                value: `$${(stats?.totalSavings ?? 0).toFixed(2)}`,
                delta: "this month",
                deltaType: "success",
              },
              {
                title: "Total Requests",
                value: (stats?.totalRequests ?? 0).toLocaleString(),
                delta: "+4.3%",
                deltaType: "neutral",
              },
              {
                title: "Cache Hit Rate",
                value: `${stats?.cacheHitRate ?? 0}%`,
                delta: "+2.1%",
                deltaType: "success",
              },
            ].map((card, i) => (
              <motion.div key={i} variants={item}>
                <div
                  style={{
                    background: "rgba(17,24,39,0.8)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 16,
                    padding: "1.25rem 1.5rem",
                  }}
                >
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6B7280", marginBottom: 8 }}>
                    {card.title}
                  </p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", fontFamily: "monospace", marginBottom: 6 }}>
                    {card.value}
                  </p>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: card.deltaType === "success" ? "#10B981" : card.deltaType === "danger" ? "#F43F5E" : "#9CA3AF",
                    }}
                  >
                    {card.delta}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Charts row — Cost vs Savings + Model Distribution ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost vs Savings area chart */}
          <div
            style={{
              background: "rgba(17,24,39,0.8)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16,
              padding: "1.25rem 1.5rem",
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 16, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Cost vs Savings — Last 14 Days
            </p>
            <CostChart data={costChartData} />
          </div>

          {/* Model spend distribution donut */}
          <div
            style={{
              background: "rgba(17,24,39,0.8)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16,
              padding: "1.25rem 1.5rem",
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Model Spend Distribution
            </p>
            <ModelDistributionChart data={pieData} />
          </div>
        </div>

        {/* ── WHY Analysis + Autopilot ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WHYAnalysisPanel
            decision={decision}
            isLoading={analysisLoading}
            isDemo={decisionSrc === "demo"}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <AutopilotPanel
              autopilot={autopilot}
              isLoading={autopilotLoading}
            />
          </motion.div>
        </div>

        {/* ── Activity feed (only shown when live data present) ── */}
        {hasLiveData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-3">
              <ActivityFeed activities={activities} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
