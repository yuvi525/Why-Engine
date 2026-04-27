"use client";

import { useState, useEffect, useRef } from "react";
import {
  DEMO_ANALYSIS_RESULTS, DEMO_ANOMALIES,
  DEMO_USAGE, DEMO_AUTOPILOT_RULES,
} from "@/lib/demo-data";
import { simulateDemoIngestion } from "@/lib/demo-simulator";
import { supabase } from "@/lib/supabase-browser";

/**
 * useDashboardData()
 *
 * Abstracts real vs demo data fetching.
 * Dashboard components never need to know which source is active.
 *
 * Returns:
 *   { analyses, anomalies, usage, autopilotRules, isDemo, isLoading, lastUpdated }
 */
export function useDashboardData() {
  const [isDemo, setIsDemo]         = useState(true);
  const [isLoading, setIsLoading]   = useState(true);
  const [analyses, setAnalyses]     = useState([]);
  const [anomalies, setAnomalies]   = useState([]);
  const [usage, setUsage]           = useState(null);
  const [autopilotRules, setRules]  = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const stopRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // ── Check auth ─────────────────────────────────────────────
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!data?.session) {
        // ── DEMO MODE ──────────────────────────────────────────
        setIsDemo(true);
        setAnalyses(DEMO_ANALYSIS_RESULTS);
        setAnomalies(DEMO_ANOMALIES);
        setUsage(DEMO_USAGE);
        setRules(DEMO_AUTOPILOT_RULES);
        setLastUpdated(new Date());
        setIsLoading(false);

        // Start live simulation
        const { stop } = simulateDemoIngestion(({ type, payload }) => {
          if (cancelled) return;
          if (type === "new_analysis") {
            setAnalyses(prev => [payload, ...prev].slice(0, 20));
          }
          if (type === "new_anomaly") {
            setAnomalies(prev => [payload, ...prev].slice(0, 20));
          }
          if (type === "usage_update") {
            setUsage(payload);
          }
          setLastUpdated(new Date());
        });
        stopRef.current = stop;

      } else {
        // ── LIVE MODE ──────────────────────────────────────────
        setIsDemo(false);
        await fetchRealData(data.session, cancelled, setAnalyses, setAnomalies, setUsage, setRules, setLastUpdated, setIsLoading);
      }
    }

    init();
    return () => {
      cancelled = true;
      if (stopRef.current) stopRef.current();
    };
  }, []);

  return { analyses, anomalies, usage, autopilotRules, isDemo, isLoading, lastUpdated };
}

// ── Real data fetcher ─────────────────────────────────────────────────────
async function fetchRealData(session, cancelled, setAnalyses, setAnomalies, setUsage, setRules, setLastUpdated, setIsLoading) {
  try {
    const token = session.access_token;
    const headers = { Authorization: `Bearer ${token}` };

    const [aRes, rulesRes, meRes] = await Promise.all([
      fetch("/api/latest-analysis", { headers }).catch(() => null),
      fetch("/api/autopilot/rules", { headers }).catch(() => null),
      fetch("/api/auth/me",         { headers }).catch(() => null),
    ]);

    if (!cancelled) {
      if (aRes?.ok) {
        const d = await aRes.json();
        if (d?.analysis) setAnalyses([d.analysis]);
      }
      if (rulesRes?.ok) {
        const d = await rulesRes.json();
        setRules(d?.rules || []);
      }
      if (meRes?.ok) {
        const d = await meRes.json();
        setUsage({ ...DEMO_USAGE, plan: d?.plan || "free" }); // real plan, demo stats
      }
      setLastUpdated(new Date());
    }
  } catch (err) {
    console.error("[useDashboardData] fetch error:", err.message);
  } finally {
    if (!cancelled) setIsLoading(false);
  }
}
