/**
 * lib/demo-data.js
 *
 * Realistic demo fixtures for the AI Cost Autopilot.
 * Used by useDashboardData when no Supabase session exists.
 */

export const DEMO_ANALYSIS_RESULTS = [
  {
    id: "demo-a1",
    priority: "HIGH",
    change: "Cost increased 312% compared to previous period",
    why: "GPT-4o usage surged 8× in the last 24 hours due to a batch summarisation job that was routed to the premium tier instead of GPT-4o-mini. The routing rule for 'summarise' intent was overridden by a hardcoded model parameter in the ingestion pipeline.",
    impact:
      "At current burn rate you will exceed your $500 monthly budget in 6 days. Estimated overage: $312.",
    action: [
      "Switch batch summarisation jobs to gpt-4o-mini — saves ~$0.014/1k tokens",
      "Add a model cap rule in Autopilot: summarise intent → gpt-4o-mini",
      "Remove hardcoded model= from the ingestion API call",
      "Enable semantic cache for repeated summarise requests (est. 40% cache-hit rate)",
    ],
    decision:
      "Immediately reroute summarisation workload to gpt-4o-mini. Expected savings: $218 this month.",
    confidence: "91%",
    totalCost: 487.32,
    estimatedSavings: 218.0,
    anomalyType: "cost_spike",
    severity: "critical",
    sessionId: "demo-session-001",
    createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    anomaly_detected: true,
    node_breakdown: {
      "gpt-4o (batch)":    { tokens: 142000, cost_usd: 1.42 },
      "gpt-4o-mini":       { tokens: 380000, cost_usd: 0.76 },
      "claude-3-5-sonnet": { tokens: 62000,  cost_usd: 0.93 },
      "claude-3-haiku":    { tokens: 210000, cost_usd: 0.21 },
      "gemini-1.5-flash":  { tokens: 88000,  cost_usd: 0.18 },
    },
    why_output: {
      summary: "GPT-4o batch usage surged due to routing rule override.",
      root_causes: [
        { cause: "Hardcoded model param in ingestion pipeline", node: "ingestion", confidence: "91%" },
        { cause: "Missing intent-based routing rule for summarise", node: "router", confidence: "85%" },
      ],
      financial_impact: { monthly_projection_usd: 487.32, waste_percentage: 44 },
      recommendations: ["Switch to gpt-4o-mini for summarise intent", "Enable semantic cache"],
    },
  },
  {
    id: "demo-a2",
    priority: "MEDIUM",
    change: "Model mix drifted — Claude-3.5-Sonnet share rose from 12% to 38%",
    why: "A new feature rollout defaulted all code generation requests to Claude-3.5-Sonnet regardless of complexity. Shorter code-assist queries (< 200 tokens) are being sent to a 200k-context model unnecessarily.",
    impact:
      "Overspend of ~$94 this week. Claude-3.5-Sonnet is 4× more expensive than Haiku for short completions.",
    action: [
      "Add complexity routing: code < 400 tokens → claude-3-haiku",
      "Audit feature flag that changed the default model",
      "Review per-feature model assignments quarterly",
    ],
    decision:
      "Update routing rules to use Haiku for short code-assist. Estimated saving: $94/week.",
    confidence: "84%",
    totalCost: 231.15,
    estimatedSavings: 94.0,
    anomalyType: "mix_change",
    severity: "high",
    sessionId: "demo-session-002",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    anomaly_detected: true,
    why_output: {
      summary: "Model mix shifted toward expensive Claude-3.5-Sonnet.",
      root_causes: [
        { cause: "Feature flag changed default model globally", node: "router", confidence: "84%" },
      ],
      financial_impact: { monthly_projection_usd: 376, waste_percentage: 25 },
      recommendations: ["Route short code queries to claude-3-haiku"],
    },
  },
  {
    id: "demo-a3",
    priority: "LOW",
    change: "Token efficiency improved 18% week-over-week",
    why: "Prompt compression changes from last week reduced average input tokens by 340 per request across translation workloads.",
    impact: "Saving $28 this week. On track for $112/month reduction.",
    action: [
      "Extend compression to customer-support prompts (est. +$45/mo saving)",
      "Document compression patterns in team runbook",
    ],
    decision:
      "No immediate action needed. Continue monitoring and extend compression to remaining workloads.",
    confidence: "78%",
    totalCost: 142.0,
    estimatedSavings: 28.0,
    anomalyType: null,
    severity: "low",
    sessionId: "demo-session-003",
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    anomaly_detected: false,
    why_output: {
      summary: "Prompt compression reduced token usage 18% WoW.",
      root_causes: [
        { cause: "Prompt templates were verbose for translation tasks", node: "prompt_builder", confidence: "78%" },
      ],
      financial_impact: { monthly_projection_usd: 112, waste_percentage: 0 },
      recommendations: ["Extend compression to support prompts"],
    },
  },
  {
    id: "demo-a4",
    priority: "HIGH",
    change: "Embedding API costs up 180% vs last week",
    why: "A nightly re-indexing job is regenerating all embeddings on every run instead of only dirty records. This creates 400k redundant embedding calls per night.",
    impact: "$62/night in unnecessary embedding costs — $1,860/month if unchecked.",
    action: [
      "Add dirty-record flag to embedding pipeline",
      "Implement incremental indexing — only embed changed documents",
      "Cache embeddings in pgvector with TTL of 7 days",
    ],
    decision: "Fix embedding pipeline to use incremental updates. Immediate $1,860/mo saving.",
    confidence: "89%",
    totalCost: 318.5,
    estimatedSavings: 1860.0,
    anomalyType: "model_overuse",
    severity: "high",
    sessionId: "demo-session-004",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    anomaly_detected: true,
    why_output: {
      summary: "Embedding pipeline regenerates all records nightly instead of incrementally.",
      root_causes: [
        { cause: "Missing dirty-flag logic in indexing job", node: "embedding_pipeline", confidence: "89%" },
        { cause: "No embedding cache layer", node: "cache", confidence: "72%" },
      ],
      financial_impact: { monthly_projection_usd: 1860, waste_percentage: 78 },
      recommendations: ["Incremental indexing", "pgvector cache with TTL"],
    },
  },
  {
    id: "demo-a5",
    priority: "MEDIUM",
    change: "GPT-4o Vision calls spiking on image-heavy pages",
    why: "Product team added a screenshot analysis feature that calls GPT-4o Vision on every page load in development mode. Dev-mode debug calls are leaking into staging traffic.",
    impact: "$34 overspend in staging environment this week.",
    action: [
      "Gate Vision calls behind NODE_ENV !== 'development' check",
      "Add per-feature cost attribution tags",
      "Set a staging budget cap of $20/week in Autopilot",
    ],
    decision: "Add environment gate to Vision calls. Saves $34/week in staging.",
    confidence: "82%",
    totalCost: 98.4,
    estimatedSavings: 34.0,
    anomalyType: "cost_spike",
    severity: "medium",
    sessionId: "demo-session-005",
    createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    anomaly_detected: true,
    why_output: {
      summary: "Dev-mode Vision debug calls leaking into staging traffic.",
      root_causes: [
        { cause: "Missing environment guard on Vision feature", node: "api_gateway", confidence: "82%" },
      ],
      financial_impact: { monthly_projection_usd: 136, waste_percentage: 35 },
      recommendations: ["Add NODE_ENV guard", "Set staging budget cap"],
    },
  },
  {
    id: "demo-a6",
    priority: "LOW",
    change: "Cache hit rate dropped from 41% to 12%",
    why: "A key normalization bug in the semantic cache layer caused cache keys to include millisecond timestamps, making every request unique and bypassing cached completions.",
    impact: "Lost $47 in potential cache savings this week.",
    action: [
      "Fix cache key normalization — strip volatile fields (timestamps, request IDs)",
      "Re-warm cache with top-100 prompt templates",
      "Monitor cache hit rate daily via System Health page",
    ],
    decision: "Fix cache key bug immediately. Restores $47/week in savings.",
    confidence: "95%",
    totalCost: 189.0,
    estimatedSavings: 47.0,
    anomalyType: null,
    severity: "low",
    sessionId: "demo-session-006",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    anomaly_detected: false,
    why_output: {
      summary: "Cache key normalization bug bypasses semantic cache entirely.",
      root_causes: [
        { cause: "Cache key includes volatile ms timestamp", node: "cache_layer", confidence: "95%" },
      ],
      financial_impact: { monthly_projection_usd: 188, waste_percentage: 25 },
      recommendations: ["Strip volatile fields from cache key", "Re-warm cache"],
    },
  },
];

export const DEMO_ANOMALIES = [
  {
    id: "ano-1",
    type: "cost_spike",
    severity: "critical",
    title: "GPT-4o Batch Surge",
    detail: "8× spike in GPT-4o usage from ingestion pipeline",
    detected_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    delta_pct: 312,
  },
  {
    id: "ano-2",
    type: "mix_change",
    severity: "high",
    title: "Model Mix Drift",
    detail: "Claude-3.5-Sonnet share up 26 pts in 48 h",
    detected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    delta_pct: 117,
  },
  {
    id: "ano-3",
    type: "model_overuse",
    severity: "medium",
    title: "Gemini Pro Overuse",
    detail: "Gemini-1.5-Pro called for <200-token requests",
    detected_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    delta_pct: 55,
  },
];

export const DEMO_USAGE = {
  plan: "pro",
  analyses_today: 47,
  total_cost_mtd: 487.32,
  savings_from_autopilot_usd: 218.0,
  budget_cap_usd: 500,
  budget_used_pct: 97.4,
  requests_today: 12340,
  cache_hit_rate_pct: 38,
  efficiency_score: 72,
  top_model: "gpt-4o",
  top_model_share_pct: 61,
  // 30-day trace counts used by CostChart (one entry per day)
  daily_traces: [
    210, 198, 312, 278, 421, 390, 345, 267, 412, 388,
    430, 512, 478, 390, 421, 398, 367, 445, 490, 520,
    488, 510, 432, 401, 389, 467, 498, 521, 489, 512,
  ],
};


export const DEMO_AUTOPILOT_RULES = [
  {
    id: "rule-1",
    name: "Summarise → GPT-4o-mini",
    trigger: "intent === 'summarise'",
    action: "route to gpt-4o-mini",
    enabled: true,
    savings_usd: 148.2,
    runs: 2840,
  },
  {
    id: "rule-2",
    name: "Short code-assist → Haiku",
    trigger: "intent === 'code' && tokens < 400",
    action: "route to claude-3-haiku",
    enabled: true,
    savings_usd: 61.5,
    runs: 1102,
  },
  {
    id: "rule-3",
    name: "Cache repeated translations",
    trigger: "intent === 'translate' && cache_miss",
    action: "semantic cache lookup",
    enabled: true,
    savings_usd: 28.3,
    runs: 540,
  },
  {
    id: "rule-4",
    name: "Budget alert at 80%",
    trigger: "budget_used_pct >= 80",
    action: "send Slack alert + pause non-critical jobs",
    enabled: false,
    savings_usd: 0,
    runs: 0,
  },
];

/**
 * generateDemoRun(agent?) — creates a synthetic run record.
 * Returns: { run_id, session_id, agent_id, model, tokens, cost, ...rest }
 */
export function generateDemoRun(agent = null) {
  const models    = ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet-20240620", "claude-3-haiku-20240307"];
  const types     = ["cost_spike", "mix_change", "model_overuse", null];
  const priorities = ["HIGH", "MEDIUM", "LOW"];
  const idx       = Math.floor(Math.random() * 3);
  const model     = agent?.model ?? models[Math.floor(Math.random() * models.length)];
  const tokens    = 1200 + Math.floor(Math.random() * 8000);
  const cost      = parseFloat((tokens * 0.0000025).toFixed(6));

  return {
    // Required by system-validator.js
    run_id:     `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    session_id: `demo-session-${Date.now()}`,
    agent_id:   agent?.agent_id ?? "agent-default",
    model,
    tokens,
    cost,
    // Full analysis shape
    id: `demo-run-${Date.now()}`,
    priority: priorities[idx],
    change: ["Cost up 28% this hour", "Model mix shifted", "Token usage spiked"][idx],
    why: "Automated analysis detected a pattern change in your model usage distribution.",
    impact: `Estimated ${["$12", "$7", "$3"][idx]} incremental spend if trend continues.`,
    action: ["Review model routing rules", "Check batch job schedules", "Enable semantic cache"],
    decision: "Autopilot monitoring. No immediate manual action required.",
    confidence: `${70 + Math.floor(Math.random() * 20)}%`,
    totalCost: 100 + Math.random() * 400,
    estimatedSavings: 10 + Math.random() * 80,
    anomalyType: types[Math.floor(Math.random() * types.length)],
    severity: ["high", "medium", "low"][idx],
    sessionId: `demo-session-${Date.now()}`,
    createdAt: new Date().toISOString(),
    anomaly_detected: Math.random() > 0.4,
    why_output: {
      summary: "Automated analysis detected a usage pattern change.",
      root_causes: [{ cause: "Routing rule change", node: "ingestion", confidence: "74%" }],
      financial_impact: { monthly_projection_usd: 0, waste_percentage: 0 },
      recommendations: [],
    },
  };
}

/**
 * DEMO_AGENTS — synthetic agent definitions used by system-validator.js
 * generateDemoRun(agent) produces a run record with agent context.
 */
export const DEMO_AGENTS = [
  { agent_id: "agent-summarise", name: "Summarisation Agent", model: "gpt-4o-mini",       intent: "summarise" },
  { agent_id: "agent-code",      name: "Code Assist Agent",   model: "claude-3-haiku",     intent: "code" },
  { agent_id: "agent-translate", name: "Translation Agent",   model: "gemini-1.5-flash",   intent: "translate" },
];

