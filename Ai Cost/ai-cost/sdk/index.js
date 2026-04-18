/**
 * WHY Engine SDK
 * ==============
 * Lightweight client for the WHY Engine ingestion API.
 * Works in Node.js, Edge functions, and modern browsers.
 *
 * Install (once published):
 *   npm install why-engine-sdk
 *
 * For now — copy this file into your project and import directly.
 *
 * Usage:
 *   import { WHYEngineClient } from './sdk/index.js';
 *   const client = new WHYEngineClient({ baseUrl: 'https://your-app.vercel.app' });
 *   await client.track({ model: 'gpt-4o', tokens: 12000, cost: 0.06 });
 */

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const SDK_VERSION      = "0.1.0";

// ─────────────────────────────────────────────────────────────────────────
// WHYEngineClient
// ─────────────────────────────────────────────────────────────────────────
export class WHYEngineClient {
  /**
   * @param {object} options
   * @param {string}  options.baseUrl    - Base URL of your WHY Engine deployment
   * @param {string}  [options.apiKey]   - API key (future auth — pass-through for now)
   * @param {string}  [options.sessionId]- Optional fixed session ID for grouping
   * @param {boolean} [options.debug]    - Log all requests/responses
   */
  constructor({ baseUrl = DEFAULT_BASE_URL, apiKey, sessionId, debug = false } = {}) {
    this.baseUrl   = String(baseUrl).replace(/\/$/, "");
    this.apiKey    = apiKey  || null;
    this.sessionId = sessionId || null;
    this.debug     = debug;
  }

  // ── Internal fetch ──────────────────────────────────────────────────────
  async _post(path, body) {
    const headers = {
      "Content-Type": "application/json",
      "X-SDK-Version": SDK_VERSION,
    };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    if (this.debug) console.log(`[WHYEngine SDK] POST ${path}`, body);

    const res = await fetch(`${this.baseUrl}${path}`, {
      method:  "POST",
      headers,
      body:    JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (this.debug) console.log(`[WHYEngine SDK] Response ${res.status}`, data);

    if (!res.ok) {
      const err = new Error(data?.error || `Request failed (${res.status})`);
      err.status = res.status;
      err.data   = data;
      throw err;
    }

    return data;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // track() — send a single LLM usage event
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Track a single LLM call. Returns the pipeline result when enough data
   * has accumulated for a session.
   *
   * @param {object} event
   * @param {string}  event.model          - Model identifier, e.g. "gpt-4o"
   * @param {number}  [event.tokens]       - Total token count (fallback)
   * @param {number}  [event.input_tokens] - Input tokens (preferred)
   * @param {number}  [event.output_tokens]- Output tokens (preferred)
   * @param {number}  [event.cost]         - Cost in USD (auto-calculated if omitted)
   * @param {string}  [event.session_id]   - Groups events; uses client default if set
   * @param {string}  [event.agent_id]     - Future: agent identifier
   * @param {string}  [event.run_id]       - Future: run identifier
   * @param {string}  [event.user_id]      - Future: user identifier
   * @param {number}  [event.latency_ms]   - Response latency
   * @param {object}  [event.metadata]     - Arbitrary metadata
   * @returns {Promise<object>}            - Pipeline result from /api/ingest
   */
  async track(event = {}) {
    return this._post("/api/ingest", {
      ...event,
      session_id: event.session_id || this.sessionId || undefined,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // trackBatch() — send multiple events sequentially
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Track multiple LLM usage events for the same session.
   * Events are sent sequentially so the pipeline accumulates records correctly.
   *
   * @param {object[]} events          - Array of event objects (same shape as track())
   * @param {object}   [options]
   * @param {string}   [options.session_id] - Override session for all events
   * @param {number}   [options.delayMs]    - ms to wait between events (default: 0)
   * @returns {Promise<object[]>}           - Array of pipeline results
   */
  async trackBatch(events = [], { session_id, delayMs = 0 } = {}) {
    const sid     = session_id || this.sessionId || crypto.randomUUID();
    const results = [];

    for (const event of events) {
      const result = await this.track({ ...event, session_id: sid });
      results.push(result);
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // analyze() — run a one-shot analysis on a usage array
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Send a complete usage array to /api/analyze for a one-shot decision.
   * Useful when you already have all data and don't need session accumulation.
   *
   * @param {object[]} usage - Array of { model, tokens, cost } objects
   * @returns {Promise<object>} - Formatted decision
   */
  async analyze(usage = []) {
    return this._post("/api/analyze", { usage });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Convenience singleton factory
// ─────────────────────────────────────────────────────────────────────────
/**
 * Create a pre-configured client from environment variables.
 *
 * Reads:
 *   NEXT_PUBLIC_APP_URL — base URL
 *   WHY_ENGINE_API_KEY  — API key (optional)
 *
 * @param {object} [overrides] - Any WHYEngineClient constructor options
 * @returns {WHYEngineClient}
 */
export function createClient(overrides = {}) {
  return new WHYEngineClient({
    baseUrl:   process.env.NEXT_PUBLIC_APP_URL || DEFAULT_BASE_URL,
    apiKey:    process.env.WHY_ENGINE_API_KEY  || undefined,
    ...overrides,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Default export — singleton for simple use cases
// ─────────────────────────────────────────────────────────────────────────
export default createClient();
