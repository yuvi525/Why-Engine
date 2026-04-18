/**
 * lib/demo-data.js
 *
 * All demo/simulation data for WHY Engine.
 * NEVER writes to Supabase — pure in-memory.
 */

// ── Agent profiles ────────────────────────────────────────────────────────
export const DEMO_AGENTS = [
  {
    id:                   "customer-support-bot",
    name:                 "Customer Support Bot",
    nodes:                ["intent-classifier", "response-generator", "escalation-checker"],
    typical_model:        "gpt-4o-mini",
    typical_cost_per_run: 0.0043,
  },
  {
    id:                   "market-research-agent",
    name:                 "Market Research Agent",
    nodes:                ["query-planner", "web-scraper-llm", "summarizer", "report-writer"],
    typical_model:        "gpt-4o",
    typical_cost_per_run: 0.21,
  },
  {
    id:                   "code-review-pipeline",
    name:                 "Code Review Pipeline",
    nodes:                ["diff-parser", "security-scanner", "style-checker", "feedback-writer"],
    typical_model:        "claude-sonnet-4-5",
    typical_cost_per_run: 0.087,
  },
];

// ── Anomaly injection helpers ─────────────────────────────────────────────
const ANOMALY_TYPES = ["cost_spike", "model_overuse", "loop_detected", "token_bloat"];

function pickAnomaly() {
  return ANOMALY_TYPES[Math.floor(Math.random() * ANOMALY_TYPES.length)];
}

function rand8() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * generateDemoRun(agentProfile)
 * Returns a realistic trace object matching /api/ingest schema.
 * 1-in-5 chance of anomaly injection.
 */
export function generateDemoRun(agent) {
  const jitter      = 0.7 + Math.random() * 0.6;   // ±30%
  const injectAnomaly = Math.random() < 0.2;
  const anomalyType   = injectAnomaly ? pickAnomaly() : null;

  const baseTokens   = Math.round((agent.typical_cost_per_run / 0.00003) * jitter);
  const baseCost     = parseFloat((agent.typical_cost_per_run * jitter).toFixed(5));

  let model        = agent.typical_model;
  let tokens       = baseTokens;
  let cost         = baseCost;
  const metadata   = {};
  let tool_calls   = agent.nodes.map(n => ({ node: n, status: "ok" }));

  if (anomalyType === "cost_spike") {
    cost            = parseFloat((baseCost * 6.4).toFixed(5));
    tokens          = Math.round(baseTokens * 5.8);
    metadata.retry_count = 8;
    metadata.anomaly     = "cost_spike";
  } else if (anomalyType === "model_overuse") {
    model           = "gpt-4o";   // upgrade regardless of profile
    cost            = parseFloat((baseCost * 3.1).toFixed(5));
    metadata.anomaly = "model_overuse";
    metadata.note    = "Routed to expensive model for simple classification task";
  } else if (anomalyType === "loop_detected") {
    const loopNode  = tool_calls[0];
    tool_calls      = [...tool_calls, loopNode, loopNode, loopNode];
    metadata.anomaly = "loop_detected";
    metadata.loop_node = loopNode.node;
    cost            = parseFloat((baseCost * 2.8).toFixed(5));
  } else if (anomalyType === "token_bloat") {
    tokens          = Math.round(baseTokens * 4.2);
    cost            = parseFloat((baseCost * 4.2).toFixed(5));
    metadata.anomaly      = "token_bloat";
    metadata.input_tokens = tokens;
    metadata.note         = "System prompt exceeded 8k tokens";
  }

  return {
    run_id:     `demo_${rand8()}`,
    session_id: `demo_session_${rand8()}`,
    agent_id:   agent.id,
    model,
    tokens,
    cost,
    source:     "demo",
    nodes:      tool_calls,
    metadata,
    anomaly_type: anomalyType,
    timestamp:  new Date().toISOString(),
  };
}

// ── Pre-built analysis results ────────────────────────────────────────────
export const DEMO_ANALYSIS_RESULTS = [
  {
    run_id:         "demo_a1b2c3d4",
    agent_id:       "market-research-agent",
    severity:       "critical",
    total_cost_usd: 1.34,
    node_breakdown: {
      "query-planner":    { tokens: 420,  cost_usd: 0.013 },
      "web-scraper-llm":  { tokens: 18400, cost_usd: 0.552, retries: 6 },
      "summarizer":       { tokens: 42000, cost_usd: 0.630 },
      "report-writer":    { tokens: 4800,  cost_usd: 0.145 },
    },
    why_output: {
      summary: "The market-research-agent's summarizer node consumed 847% more tokens than baseline due to a missing output length constraint, generating 4,200-token summaries for queries requiring under 300 tokens. Combined with 6 retry loops on the web-scraper-llm node, this single run cost $1.34 versus an expected $0.18.",
      root_causes: [
        { cause: "No max_tokens constraint on summarizer node", node: "summarizer", confidence: "94%", evidence: "42,000 tokens consumed vs 4,800 baseline average" },
        { cause: "Retry storm on web scraper — 6 retries with no backoff", node: "web-scraper-llm", confidence: "89%", evidence: "18,400 tokens, 6 retry_count in metadata" },
        { cause: "Full document passed to summarizer instead of chunked input", node: "query-planner", confidence: "76%", evidence: "Input size 14× larger than comparable sessions" },
      ],
      financial_impact: { monthly_projection_usd: 402.00, waste_percentage: 87 },
      recommendations: [
        { action: "Add max_tokens: 300 to summarizer node config", target_node: "summarizer", expected_saving_usd: 0.567, confidence: "91%", implementation: "Set max_tokens parameter in your LLM client call inside summarizer.js" },
        { action: "Implement exponential backoff with max 2 retries on web-scraper-llm", target_node: "web-scraper-llm", expected_saving_usd: 0.368, confidence: "85%", implementation: "Wrap fetch with retry utility: retry(fn, { max: 2, backoff: 'exponential' })" },
        { action: "Chunk documents into 2k-token segments before passing to summarizer", target_node: "query-planner", expected_saving_usd: 0.180, confidence: "78%", implementation: "Split document at sentence boundaries every 2000 tokens before summarizer call" },
      ],
    },
    analyzed_at: new Date(Date.now() - 180_000).toISOString(),
  },
  {
    run_id:         "demo_e5f6g7h8",
    agent_id:       "code-review-pipeline",
    severity:       "critical",
    total_cost_usd: 0.74,
    node_breakdown: {
      "diff-parser":    { tokens: 1200,  cost_usd: 0.036 },
      "security-scanner": { tokens: 22800, cost_usd: 0.342 },
      "style-checker":  { tokens: 18200, cost_usd: 0.237 },
      "feedback-writer": { tokens: 3400, cost_usd: 0.125 },
    },
    why_output: {
      summary: "The code-review-pipeline's security-scanner and style-checker nodes processed the entire repository diff (4,800 lines) instead of only the changed files, consuming 41,000 tokens for a 220-line pull request. The expected cost was $0.087 per run; actual was $0.74 — an 8.5× overrun.",
      root_causes: [
        { cause: "diff-parser passing full repo context instead of PR diff", node: "diff-parser", confidence: "96%", evidence: "Token count 40× above median for similar PR sizes" },
        { cause: "claude-sonnet-4-5 used for style-checking (overkill for linting)", node: "style-checker", confidence: "88%", evidence: "Style-check tasks have <0.3% accuracy difference vs claude-haiku" },
      ],
      financial_impact: { monthly_projection_usd: 222.00, waste_percentage: 88 },
      recommendations: [
        { action: "Filter diff-parser to output only changed file hunks", target_node: "diff-parser", expected_saving_usd: 0.530, confidence: "93%", implementation: "Use git diff --unified=3 <base>..<head> instead of full checkout" },
        { action: "Downgrade style-checker to claude-haiku", target_node: "style-checker", expected_saving_usd: 0.190, confidence: "86%", implementation: "Set model: 'claude-haiku-3' in style-checker.config.js" },
      ],
    },
    analyzed_at: new Date(Date.now() - 360_000).toISOString(),
  },
  {
    run_id:         "demo_i9j0k1l2",
    agent_id:       "customer-support-bot",
    severity:       "high",
    total_cost_usd: 0.031,
    node_breakdown: {
      "intent-classifier":  { tokens: 1800, cost_usd: 0.011 },
      "response-generator": { tokens: 2400, cost_usd: 0.014 },
      "escalation-checker": { tokens: 1200, cost_usd: 0.006 },
    },
    why_output: {
      summary: "The customer-support-bot routed 43% of intent-classification calls to gpt-4o instead of gpt-4o-mini, inflating costs by 7.2× for tasks where both models achieve identical outcomes. This routing error occurred after a model config update that removed the task-complexity gate.",
      root_causes: [
        { cause: "Model routing config missing complexity_threshold check", node: "intent-classifier", confidence: "92%", evidence: "43% of calls used gpt-4o; historical baseline 0%" },
        { cause: "Config update on 2026-04-17 removed task-gate logic", node: "intent-classifier", confidence: "87%", evidence: "Git diff shows removal of if (complexity > 0.7) branch" },
      ],
      financial_impact: { monthly_projection_usd: 73.20, waste_percentage: 86 },
      recommendations: [
        { action: "Restore complexity_threshold: 0.7 gate in model router", target_node: "intent-classifier", expected_saving_usd: 0.024, confidence: "94%", implementation: "Revert model-router.js to commit abc123 or add: if (score < 0.7) model = 'gpt-4o-mini'" },
      ],
    },
    analyzed_at: new Date(Date.now() - 600_000).toISOString(),
  },
  {
    run_id:         "demo_m3n4o5p6",
    agent_id:       "market-research-agent",
    severity:       "high",
    total_cost_usd: 0.38,
    node_breakdown: {
      "query-planner":   { tokens: 800,  cost_usd: 0.024 },
      "web-scraper-llm": { tokens: 5200, cost_usd: 0.156 },
      "summarizer":      { tokens: 4100, cost_usd: 0.123 },
      "report-writer":   { tokens: 2600, cost_usd: 0.078 },
    },
    why_output: {
      summary: "The market-research-agent exceeded its $0.50/run budget cap on 12 occasions this week due to open-ended report-writer prompts that generated 8–12 page outputs for queries requiring 1–2 page summaries. Average cost is running at $0.38/run vs the $0.21 typical baseline.",
      root_causes: [
        { cause: "report-writer has no output_length constraint", node: "report-writer", confidence: "89%", evidence: "Output tokens averaged 2,600 vs 900 in previous week" },
        { cause: "Query complexity scoring underestimates research queries", node: "query-planner", confidence: "74%", evidence: "All 12 budget-exceeded runs were classified as 'medium' complexity" },
      ],
      financial_impact: { monthly_projection_usd: 114.00, waste_percentage: 45 },
      recommendations: [
        { action: "Add max_tokens: 1200 to report-writer for medium-complexity queries", target_node: "report-writer", expected_saving_usd: 0.092, confidence: "82%", implementation: "Check query.complexity in report-writer.js and set max_tokens accordingly" },
      ],
    },
    analyzed_at: new Date(Date.now() - 1_200_000).toISOString(),
  },
  {
    run_id:         "demo_q7r8s9t0",
    agent_id:       "code-review-pipeline",
    severity:       "medium",
    total_cost_usd: 0.12,
    node_breakdown: {
      "diff-parser":      { tokens: 900,  cost_usd: 0.027 },
      "security-scanner": { tokens: 1800, cost_usd: 0.054 },
      "style-checker":    { tokens: 900,  cost_usd: 0.027 },
      "feedback-writer":  { tokens: 400,  cost_usd: 0.012 },
    },
    why_output: {
      summary: "The code-review-pipeline is processing 34% more PRs than last week following CI/CD automation changes, causing a moderate cost increase. No per-run anomaly detected — the issue is volume, not efficiency.",
      root_causes: [
        { cause: "CI trigger expanded to include documentation file changes", node: "diff-parser", confidence: "81%", evidence: "34% of new runs triggered by .md file changes only" },
      ],
      financial_impact: { monthly_projection_usd: 36.00, waste_percentage: 25 },
      recommendations: [
        { action: "Exclude documentation-only PRs from code review pipeline", target_node: "diff-parser", expected_saving_usd: 0.041, confidence: "79%", implementation: "Add path filter to CI trigger: ignore: ['**/*.md', 'docs/**']" },
      ],
    },
    analyzed_at: new Date(Date.now() - 2_400_000).toISOString(),
  },
  {
    run_id:         "demo_u1v2w3x4",
    agent_id:       "customer-support-bot",
    severity:       "low",
    total_cost_usd: 0.0051,
    node_breakdown: {
      "intent-classifier":  { tokens: 820,  cost_usd: 0.0018 },
      "response-generator": { tokens: 980,  cost_usd: 0.0023 },
      "escalation-checker": { tokens: 440,  cost_usd: 0.0010 },
    },
    why_output: {
      summary: "The customer-support-bot is operating within normal parameters. A minor 19% cost increase versus last week is attributable to 14% higher ticket volume and a small increase in average conversation length. No optimization action required at this time.",
      root_causes: [
        { cause: "Ticket volume increase (Monday spike, normal pattern)", node: "intent-classifier", confidence: "91%", evidence: "847 traces today vs 724 same day last week" },
      ],
      financial_impact: { monthly_projection_usd: 1.53, waste_percentage: 5 },
      recommendations: [
        { action: "No action required — monitor for sustained volume increase beyond 30%", target_node: "intent-classifier", expected_saving_usd: 0.0, confidence: "95%", implementation: "Set alert: if daily_traces > 1100 for 3 consecutive days" },
      ],
    },
    analyzed_at: new Date(Date.now() - 3_600_000).toISOString(),
  },
];

// ── Anomaly events ────────────────────────────────────────────────────────
export const DEMO_ANOMALIES = [
  { id: "anom-1", run_id: "demo_a1b2c3d4", agent_id: "market-research-agent", type: "token_bloat",   severity: "critical", detected_at: new Date(Date.now() - 182_000).toISOString(), details: { tokens: 42000, expected: 4800 } },
  { id: "anom-2", run_id: "demo_e5f6g7h8", agent_id: "code-review-pipeline",  type: "cost_spike",    severity: "critical", detected_at: new Date(Date.now() - 362_000).toISOString(), details: { cost: 0.74, expected: 0.087 } },
  { id: "anom-3", run_id: "demo_i9j0k1l2", agent_id: "customer-support-bot",  type: "model_overuse", severity: "high",     detected_at: new Date(Date.now() - 602_000).toISOString(), details: { model: "gpt-4o", expected_model: "gpt-4o-mini" } },
  { id: "anom-4", run_id: "demo_m3n4o5p6", agent_id: "market-research-agent", type: "cost_spike",    severity: "high",     detected_at: new Date(Date.now() - 1_202_000).toISOString(), details: { cost: 0.38, expected: 0.21 } },
];

// ── Usage stats ───────────────────────────────────────────────────────────
export const DEMO_USAGE = {
  traces_today:              847,
  analyses_today:            23,
  cost_tracked_usd:          1243.67,
  plan:                      "growth",
  daily_traces:              [312, 298, 421, 387, 502, 467, 391, 428, 344, 519, 623, 487, 392, 441, 378, 612, 703, 489, 534, 601, 445, 382, 490, 567, 634, 712, 589, 701, 823, 847],
  savings_from_autopilot_usd: 312.40,
};

// ── Autopilot rules ───────────────────────────────────────────────────────
export const DEMO_AUTOPILOT_RULES = [
  {
    id:            "rule-1",
    name:          "GPT-4o → GPT-4o-mini Routing",
    type:          "model_routing",
    agent_id:      "customer-support-bot",
    description:   "Route intent classification to gpt-4o-mini when complexity score < 0.7",
    config:        { from_model: "gpt-4o", to_model: "gpt-4o-mini", threshold: 0.7 },
    enabled:       true,
    applied_count: 1243,
    total_saved_usd: 89.43,
  },
  {
    id:            "rule-2",
    name:          "Market Research Budget Cap",
    type:          "budget_cap",
    agent_id:      "market-research-agent",
    description:   "Halt run and notify if projected cost exceeds $0.50",
    config:        { limit_usd: 0.50, action: "halt_and_notify" },
    enabled:       true,
    applied_count: 12,
    total_saved_usd: 43.20,
  },
  {
    id:            "rule-3",
    name:          "Code Review Compression",
    type:          "compression_rule",
    agent_id:      "code-review-pipeline",
    description:   "Compress diff-parser output to changed hunks only when input > 2k tokens",
    config:        { max_input_tokens: 2000, compression: "changed_hunks_only" },
    enabled:       true,
    applied_count: 387,
    total_saved_usd: 31.18,
  },
];
