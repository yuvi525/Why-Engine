/**
 * lib/demo-simulator.js
 *
 * Drives the live demo experience on the dashboard.
 * Runs setInterval ticks, calls onUpdate() with typed payloads.
 * NEVER writes to Supabase.
 */

import {
  DEMO_AGENTS, DEMO_ANALYSIS_RESULTS, DEMO_ANOMALIES, DEMO_USAGE,
  generateDemoRun,
} from "@/lib/demo-data";
import { supabase } from "@/lib/supabase-browser";

let _usageState = { ...DEMO_USAGE };

/**
 * isDemoMode()
 * Returns true when running client-side with no active session.
 * Always false on SSR (typeof window === 'undefined').
 */
export function isDemoMode() {
  if (typeof window === "undefined") return false;
  // Non-blocking synchronous check using cached session
  try {
    // supabase-js caches session in localStorage — getSession() is async
    // but we can read the raw key for a sync check.
    const raw = window.localStorage.getItem("sb-" + (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace("https://", "").split(".")[0] + "-auth-token");
    return !raw;
  } catch {
    return true; // If localStorage unavailable, assume demo
  }
}

/**
 * simulateDemoIngestion(onUpdate)
 *
 * @param {(event: { type: string, payload: object }) => void} onUpdate
 * @param {number} [intervalMs=4000]
 * @returns {{ stop: () => void }}
 */
export function simulateDemoIngestion(onUpdate, intervalMs = 4000) {
  let tickCount    = 0;
  let tracesToday  = _usageState.traces_today;
  let analysesToday = _usageState.analyses_today;
  let costTracked  = _usageState.cost_tracked_usd;

  function tick() {
    tickCount++;

    // a) Pick random agent
    const agent = DEMO_AGENTS[Math.floor(Math.random() * DEMO_AGENTS.length)];

    // b) Generate a trace
    const trace = generateDemoRun(agent);
    tracesToday++;
    costTracked = parseFloat((costTracked + trace.cost).toFixed(4));

    onUpdate({ type: "new_trace", payload: trace });

    // c) New analysis result (every other tick)
    if (tickCount % 2 === 0) {
      const result = DEMO_ANALYSIS_RESULTS[Math.floor(Math.random() * DEMO_ANALYSIS_RESULTS.length)];
      // Freshen the timestamp so it appears "just now"
      const freshResult = {
        ...result,
        run_id:      `demo_${Math.random().toString(36).slice(2, 10)}`,
        analyzed_at: new Date().toISOString(),
      };
      analysesToday++;
      onUpdate({ type: "new_analysis", payload: freshResult });
    }

    // d) Anomaly (1-in-3)
    if (Math.random() < 0.333) {
      const anomaly = DEMO_ANOMALIES[Math.floor(Math.random() * DEMO_ANOMALIES.length)];
      onUpdate({
        type: "new_anomaly",
        payload: {
          ...anomaly,
          id:          `anom-live-${tickCount}`,
          detected_at: new Date().toISOString(),
        },
      });
    }

    // e) Usage update (every tick)
    _usageState = {
      ..._usageState,
      traces_today:     tracesToday,
      analyses_today:   analysesToday,
      cost_tracked_usd: costTracked,
    };
    onUpdate({ type: "usage_update", payload: { ..._usageState } });
  }

  // Fire first tick immediately for snappy UX
  tick();
  const timerId = setInterval(tick, intervalMs);

  return {
    stop: () => clearInterval(timerId),
  };
}
