/**
 * lib/demo-simulator.js
 *
 * Simulates a live data stream for demo mode.
 * Fires synthetic new_analysis, new_anomaly, and usage_update events
 * at randomised intervals so the dashboard feels alive.
 *
 * Usage:
 *   const { stop } = simulateDemoIngestion(({ type, payload }) => { ... })
 */
import { generateDemoRun, DEMO_USAGE } from "./demo-data";

const BASE_INTERVAL_MS = 12_000; // 12 s between events

/**
 * simulateDemoIngestion(callback)
 *
 * @param {function} callback  — called with { type, payload }
 *   type: "new_analysis" | "new_anomaly" | "usage_update"
 * @returns {{ stop: function }} — call stop() to cancel the simulation
 */
export function simulateDemoIngestion(callback) {
  let stopped = false;
  let timer;

  const ANOMALY_TYPES = ["cost_spike", "mix_change", "model_overuse"];
  const SEVERITIES = ["critical", "high", "medium"];

  function tick() {
    if (stopped) return;

    const roll = Math.random();

    if (roll < 0.5) {
      // 50% chance — new analysis
      const analysis = generateDemoRun();
      callback({ type: "new_analysis", payload: analysis });
    } else if (roll < 0.75) {
      // 25% chance — new anomaly
      const anomaly = {
        id: `ano-sim-${Date.now()}`,
        type: ANOMALY_TYPES[Math.floor(Math.random() * ANOMALY_TYPES.length)],
        severity: SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)],
        title: ["Token Surge Detected", "Model Drift Alert", "Budget Threshold Warning"][
          Math.floor(Math.random() * 3)
        ],
        detail: "Automated anomaly detected by WHY Engine",
        detected_at: new Date().toISOString(),
        delta_pct: Math.floor(20 + Math.random() * 200),
      };
      callback({ type: "new_anomaly", payload: anomaly });
    } else {
      // 25% chance — usage update
      const updatedUsage = {
        ...DEMO_USAGE,
        requests_today: DEMO_USAGE.requests_today + Math.floor(Math.random() * 50),
        savings_from_autopilot_usd:
          DEMO_USAGE.savings_from_autopilot_usd + parseFloat((Math.random() * 2).toFixed(2)),
        analyses_today: DEMO_USAGE.analyses_today + 1,
      };
      callback({ type: "usage_update", payload: updatedUsage });
    }

    // Schedule next tick at a random jitter around BASE_INTERVAL_MS
    const jitter = (Math.random() - 0.5) * 4000;
    timer = setTimeout(tick, BASE_INTERVAL_MS + jitter);
  }

  // First tick after a short delay
  timer = setTimeout(tick, 3000);

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
