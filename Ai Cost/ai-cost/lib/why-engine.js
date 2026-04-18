import OpenAI from "openai";

function normalizeConfidence(value) {
  const raw = String(value || "").trim().replace("%", "");
  const numeric = Number(raw);

  if (!Number.isFinite(numeric)) {
    throw new Error("WHY_ENGINE_INVALID_CONFIDENCE");
  }

  const bounded = Math.max(0, Math.min(100, numeric));
  return `${Math.round(bounded)}%`;
}

function buildFallbackDecision(context) {
  const topDriverModel = context?.topDriver?.model || "the top-cost model";
  const topDriverReason = context?.topDriver?.reason || "the top cost driver";
  const share = Number(context?.topDriver?.share || 0).toFixed(1);
  const totalTokens = Number(
    context?.topDriver?.totalTokens || 0
  ).toLocaleString();
  const requestCount = Number(context?.topDriver?.requestCount || 0);
  const optimizationFrom =
    context?.suggestedOptimization?.from || topDriverModel;
  const optimizationTo =
    context?.suggestedOptimization?.to || "gpt-4o-mini";
  const savings = Number(context?.suggestedOptimization?.savings || 0).toFixed(2);
  const currentCost = Number(context?.summary?.currentCost || 0).toFixed(2);
  const previousCost = Number(context?.summary?.previousCost || 0).toFixed(2);
  const percentageChange = Number(
    context?.summary?.percentageChange || 0
  ).toFixed(0);

  return {
    why: `${topDriverModel} is the primary cost driver: ${topDriverReason} It accounts for ${share}% of total spend across ${requestCount} request(s) and ${totalTokens} tokens.`,
    impact: `Cost moved from $${previousCost} to $${currentCost} (${percentageChange}% change). Estimated savings of $${savings} are available by migrating eligible workloads from ${optimizationFrom} to ${optimizationTo}.`,
    action: [
      `Audit workloads currently routed to ${optimizationFrom} and identify which tasks do not require its capabilities.`,
      `Migrate low-complexity workloads from ${optimizationFrom} to ${optimizationTo} and track cost over the next billing cycle.`,
    ],
    decision: `Prioritize migration of ${optimizationFrom} traffic to ${optimizationTo}. Target savings: $${savings}.`,
    confidence: "72%",
  };
}

function normalizeDecision(payload, context) {
  const why = String(payload?.why || "").trim();
  const impact = String(payload?.impact || "").trim();
  const decision = String(payload?.decision || "").trim();
  const action = Array.isArray(payload?.action)
    ? payload.action
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];
  const confidence = normalizeConfidence(payload?.confidence);

  if (!why || !impact || !decision || action.length === 0) {
    throw new Error("WHY_ENGINE_INVALID_RESPONSE");
  }

  return {
    why,
    impact,
    action,
    decision,
    confidence,
  };
}

function buildWhyPrompt(context) {
  // Pre-extract key values so GPT reads labelled data, not a raw JSON blob.
  const topModel      = context?.topDriver?.model      ?? "unknown";
  const share         = context?.topDriver?.share       ?? 0;
  const totalTokens   = (context?.topDriver?.totalTokens ?? 0).toLocaleString();
  const requestCount  = context?.topDriver?.requestCount ?? 0;
  const switchTo      = context?.suggestedOptimization?.to      ?? "gpt-4o-mini";
  const savings       = Number(context?.suggestedOptimization?.savings ?? 0).toFixed(2);
  const anomalyType   = context?.anomalyType ?? "unknown";
  const currentCost   = Number(context?.summary?.currentCost   ?? 0).toFixed(2);
  const previousCost  = Number(context?.summary?.previousCost  ?? 0).toFixed(2);
  const pctChange     = Number(context?.summary?.percentageChange ?? 0).toFixed(0);

  // Spike-specific values — only meaningful when anomalyType === "cost_spike".
  const spikeRatio    = context?.spike?.ratio        ?? null;
  const spikeAvg      = context?.spike?.historicalAvg ?? null;

  // Top ranked contributor savings (from rankCostContributors — may differ from top-level savings).
  const topContributor = Array.isArray(context?.rankedContributors)
    ? context.rankedContributors[0]
    : null;
  const contributorSavings = Number(topContributor?.estimatedSavings ?? savings).toFixed(2);

  const spikeBlock = spikeRatio !== null
    ? [
        "",
        "SPIKE DATA (anomaly type is cost_spike):",
        `• Spike ratio:     ${spikeRatio}× above historical average`,
        `• Historical avg:  $${Number(spikeAvg ?? 0).toFixed(2)}`,
        `• Current cost:    $${currentCost}`,
      ].join("\n")
    : "";

  return [
    "You are WHY ENGINE — a senior AI cost analyst writing decision-grade incident reasoning.",
    "You receive structured AI cost telemetry and must produce precise, quantified operational output.",
    "",
    "═══════════════════════════════════════════",
    "AVAILABLE DATA — use ONLY these values, do NOT invent numbers:",
    "═══════════════════════════════════════════",
    `• Anomaly type:    ${anomalyType}`,
    `• Top model:       ${topModel}`,
    `• Cost share:      ${share}%`,
    `• Token volume:    ${totalTokens} tokens`,
    `• Request count:   ${requestCount} request(s)`,
    `• Current cost:    $${currentCost}`,
    `• Previous cost:   $${previousCost}`,
    `• Cost change:     ${pctChange}%`,
    `• Switch to:       ${switchTo}`,
    `• Est. savings:    $${contributorSavings}`,
    spikeBlock,
    "",
    "═══════════════════════════════════════════",
    "STRICT RULES — each violation makes the output invalid:",
    "═══════════════════════════════════════════",
    "- Return JSON only. No markdown. No prose outside the schema.",
    "- Every sentence in 'why', 'impact', and 'decision' MUST contain at least one number AND one model name.",
    "- NEVER say 'the model', 'this model', 'usage increased', or 'costs rose' without specifics.",
    "- NEVER invent numbers — use only the AVAILABLE DATA block above.",
    "- NEVER use filler: 'it is important', 'notably', 'significantly', 'please', 'ensure', 'consider'.",
    "",
    "═══════════════════════════════════════════",
    "WHY — causation rules:",
    "═══════════════════════════════════════════",
    "Choose EXACTLY ONE causation mechanism and explain it. Do not mix mechanisms.",
    "",
    "  A) MODEL_USAGE (use when model_overuse or no spike):",
    `     Pattern: "${topModel} accounts for [X]% of $[total] spend across [N] requests`,
    `              and [T] tokens — routing tasks to ${topModel} that ${switchTo} can handle`,
    `              at [Y]× lower cost."`,
    "",
    "  B) TOKEN_SPIKE (use when cost_spike):",
    `     Pattern: "${topModel} processed [T] tokens this period, a [ratio]× spike above`,
    `              the $[avg] historical average, driving cost from $[prev] to $[curr]."`,
    "",
    "  C) COST_SHIFT (use when mix_change):",
    `     Pattern: "Usage shifted from [cheap_model] to ${topModel}, increasing`,
    `              per-period cost from $[prev] to $[curr] — a [X]% increase."`,
    "",
    "BAD examples (never write like this):",
    '  ✗ "Usage increased this period."',
    '  ✗ "The model is being overused."',
    '  ✗ "Costs have risen significantly."',
    "",
    "GOOD examples (write like this):",
    `  ✓ "${topModel} accounts for ${share}% of total spend across ${requestCount} requests`,
    `     and ${totalTokens} tokens — tasks routable to ${switchTo} at ~97% lower cost."`,
    spikeRatio !== null
      ? `  ✓ "${topModel} processed ${totalTokens} tokens this period — a ${spikeRatio}× spike above the $${Number(spikeAvg ?? 0).toFixed(2)} historical average."`
      : "",
    "",
    "═══════════════════════════════════════════",
    "IMPACT — financial consequence rules:",
    "═══════════════════════════════════════════",
    `- State the cost movement: from $${previousCost} to $${currentCost} (${pctChange}% change).`,
    `- State the savings opportunity: $${contributorSavings} by switching ${topModel} → ${switchTo}.`,
    "- Do NOT restate the WHY. Impact is about financial consequence only.",
    "",
    "═══════════════════════════════════════════",
    "ACTION — exactly 2 items, each must be specific and include savings:",
    "═══════════════════════════════════════════",
    "action[0] — AUDIT step:",
    `  - Identify which ${topModel} workloads are low-complexity (summarization, classification, extraction).`,
    "  - State what to look for. Be specific about the task type.",
    "  - BAD:  'Audit model usage.'",
    `  - GOOD: 'Audit all ${topModel} workloads and tag tasks that are summarization,`,
    `           classification, or extraction — these are candidates for ${switchTo}.'`,
    "",
    "action[1] — MIGRATION step:",
    `  - Name exact source model (${topModel}) and target model (${switchTo}).`,
    `  - Include expected savings: $${contributorSavings} based on current token volume.`,
    "  - BAD:  'Switch to a cheaper model.'",
    `  - GOOD: 'Migrate ${topModel} → ${switchTo} for tagged low-complexity workloads.`,
    `           Expected savings: $${contributorSavings} at current ${totalTokens}-token usage rate.'`,
    "",
    "═══════════════════════════════════════════",
    "DECISION — two-part format, no exceptions:",
    "═══════════════════════════════════════════",
    "Part 1 — IMMEDIATE ACTION: Start with a verb. Name exact models. Include a time horizon.",
    "  Examples: 'Migrate now.', 'Audit this billing cycle.', 'Redirect within 7 days.'",
    "Part 2 — FINANCIAL STAKE: State dollar savings. State the risk of inaction.",
    `  Example: 'Inaction sustains $${contributorSavings} in avoidable spend per period;`,
    `            at scale this compounds with every additional ${topModel} request.'`,
    "",
    "BAD:  'Prioritize optimization of gpt-4o.'",
    `GOOD: 'Migrate ${topModel} → ${switchTo} for low-complexity workloads this billing cycle.`,
    `       Inaction sustains $${contributorSavings} in avoidable spend at current usage rate.'`,
    "",
    "═══════════════════════════════════════════",
    "CONFIDENCE CALIBRATION:",
    "═══════════════════════════════════════════",
    "- 85%-100%: cost_spike with ratio >= 3.0 OR model_overuse with share >= 80%.",
    "- 60%-84%:  cost_spike with ratio >= 2.0 OR model_overuse with share >= 60%.",
    "- Below 60%: fewer than 3 records OR anomaly type is mix_change.",
    "",
    "═══════════════════════════════════════════",
    "OUTPUT SCHEMA — return exactly this, no extra fields:",
    "═══════════════════════════════════════════",
    '{ "why": string, "impact": string, "action": string[], "decision": string, "confidence": string }',
    'confidence must be a percentage string e.g. "84%".',
    "",
    `Full context (for reference): ${JSON.stringify(context)}`,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");
}

export async function generateWhyDecision(context) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY_MISSING");
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "why_decision",
        strict: true,
        schema: {
          type: "object",
          properties: {
            why: {
              type: "string",
            },
            impact: {
              type: "string",
            },
            action: {
              type: "array",
              items: {
                type: "string",
              },
              minItems: 1,
            },
            decision: {
              type: "string",
            },
            confidence: {
              type: "string",
            },
          },
          required: ["why", "impact", "action", "decision", "confidence"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "system",
        content:
          "You convert structured AI cost telemetry into precise, quantified operational decisions.",
      },
      {
        role: "user",
        content: buildWhyPrompt(context),
      },
    ],
  });

  const rawContent = completion.choices?.[0]?.message?.content?.trim();

  if (!rawContent) {
    return buildFallbackDecision(context);
  }

  try {
    const parsed = JSON.parse(rawContent);
    return normalizeDecision(parsed, context);
  } catch (error) {
    console.error("[why-engine] Failed to parse OpenAI response", error, rawContent);
    return buildFallbackDecision(context);
  }
}
