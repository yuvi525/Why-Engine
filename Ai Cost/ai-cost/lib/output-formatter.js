function formatPercent(value) {
  return Number(value || 0).toFixed(0);
}

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

// ─────────────────────────────────────────────
// PRIORITY — based on top model contribution %
// ─────────────────────────────────────────────
// Thresholds reflect how dominant a single model is in total spend.
// Contribution % is always meaningful regardless of dataset size,
// unlike absolute savings which are bounded by token counts in test data.

const CONTRIBUTION_HIGH_THRESHOLD   = 70; // ≥70% share → HIGH
const CONTRIBUTION_MEDIUM_THRESHOLD = 40; // ≥40% share → MEDIUM

function getPriority(data, anomaly) {
  // Primary signal: top contributor's % share of total spend.
  // Prefer rankedContributors (Step 7 data) → fallback to costLeak.dominantShare.
  const topShare = (() => {
    const fromRanked = Number(data?.rankedContributors?.[0]?.percentage ?? -1);
    if (fromRanked >= 0) return fromRanked;
    return Number(data?.costLeak?.dominantShare ?? 0);
  })();

  if (topShare >= CONTRIBUTION_HIGH_THRESHOLD) return "HIGH";
  if (topShare >= CONTRIBUTION_MEDIUM_THRESHOLD) return "MEDIUM";

  // Secondary floor: if detection engine flagged severity=high and there are
  // any savings to capture, never label the result LOW.
  if (anomaly?.severity === "high" && Number(data?.estimatedSavings || 0) > 0) {
    return "MEDIUM";
  }

  return "LOW";
}

// ─────────────────────────────────────────────
// IMPACT SCALING — appends monthly savings estimate
// ─────────────────────────────────────────────
// Converts per-analysis savings into a human-readable scale estimate
// so "$0.27" becomes "$0.09/run → ~$0.90/day · ~$27/month".
//
// Assumptions (conservative):
//   requestCount  = number of records in the usage array (proxy for runs/period)
//   daily runs    = 10  (one run per ~2.5 working hours)
//   monthly runs  = 300 (30 days × 10)

const DAILY_RUN_ESTIMATE   = 10;
const MONTHLY_RUN_ESTIMATE = 300;

function scaleImpact(baseImpact, data) {
  const estimatedSavings = Number(data?.estimatedSavings || 0);

  // Nothing to scale if there are no savings.
  if (estimatedSavings <= 0) return baseImpact;

  // Use request count from the top ranked contributor as the per-run denominator.
  // Fall back to 1 so we never divide by zero.
  const requestCount = Math.max(
    1,
    Number(data?.rankedContributors?.[0]?.requestCount ?? 1)
  );

  const savingsPerRun  = estimatedSavings / requestCount;
  const dailySavings   = savingsPerRun * DAILY_RUN_ESTIMATE;
  const monthlySavings = savingsPerRun * MONTHLY_RUN_ESTIMATE;

  const scaleSentence =
    `${formatCurrency(savingsPerRun)} per run` +
    ` \u2192 ~${formatCurrency(dailySavings)}/day` +
    ` \u00b7 ~${formatCurrency(monthlySavings)}/month at current usage rate.`;

  // Append to the WHY engine's own impact sentence — do not replace it.
  const trimmed = String(baseImpact || "").trim();
  return trimmed ? `${trimmed} ${scaleSentence}` : scaleSentence;
}

// ─────────────────────────────────────────────
// IMPACT HEADER — guaranteed cost movement line
// ─────────────────────────────────────────────
// Prepends a structured "Cost moved from $X → $Y (+Z%)" line
// so the user always sees exact cost movement regardless of
// what the WHY engine chose to include in its impact sentence.

function buildImpactHeader(data) {
  const prev    = Number(data?.previousCost  || 0);
  const current = Number(data?.latestCost    || 0);
  const pct     = Number(data?.growthPercentage || 0);

  // No previous data — first recorded period.
  if (prev <= 0) {
    return `First recorded period cost: ${formatCurrency(current)}.`;
  }

  const direction = pct >= 0 ? "+" : "";
  return (
    `Cost moved from ${formatCurrency(prev)} \u2192 ${formatCurrency(current)}` +
    ` (${direction}${formatPercent(pct)}%).`
  );
}

// Assembles the full impact string:
// [cost movement header] + [WHY engine sentence] + [scale sentence]
function buildFullImpact(baseImpact, data) {
  const header  = buildImpactHeader(data);
  const scaled  = scaleImpact(baseImpact, data);
  const trimmed = String(scaled || "").trim();
  // Avoid duplicating the header if the WHY engine already starts with "Cost moved".
  if (trimmed.startsWith("Cost moved") || trimmed.startsWith("First recorded")) {
    return trimmed;
  }
  return trimmed ? `${header} ${trimmed}` : header;
}

// ─────────────────────────────────────────────
// CONFIDENCE FALLBACK
// ─────────────────────────────────────────────
// Derives a confidence value when the WHY engine returns empty/missing.
// Thresholds mirror the calibration rules in why-engine.js prompt
// so derived and AI-generated confidence values are consistent.

function deriveConfidence(anomaly, data) {
  const type  = anomaly?.type  ?? "";
  const ratio = Number(anomaly?.ratio ?? 0);
  const share = Number(
    data?.rankedContributors?.[0]?.percentage ??
    data?.costLeak?.dominantShare ?? 0
  );

  if (type === "cost_spike") {
    if (ratio >= 3.0) return "88%";
    if (ratio >= 2.0) return "76%";
    return "65%";
  }

  if (type === "model_overuse") {
    if (share >= 80) return "88%";
    if (share >= 60) return "76%";
    return "65%";
  }

  if (type === "mix_change") return "58%";

  return "72%"; // generic fallback
}

function formatChange(data, anomaly) {
  const growthPercentage = Number(data?.growthPercentage || 0);
  const latestCost = Number(data?.latestCost || 0);
  const previousCost = Number(data?.previousCost || 0);
  const highestCostModel = data?.highestCostModel?.model || "the top-cost model";
  const suggestedModel = data?.suggestedModel || "a lower-cost model";

  if (anomaly?.type === "cost_spike") {
    return `Cost increased ${formatPercent(growthPercentage)}% compared to previous period`;
  }

  if (anomaly?.type === "model_overuse") {
    return `${highestCostModel} is driving a disproportionate share of total AI spend`;
  }

  if (anomaly?.type === "mix_change") {
    return `Model mix shifted from ${formatCurrency(previousCost)} to ${formatCurrency(latestCost)} with a higher-cost usage pattern`;
  }

  return `Potential savings of ${formatCurrency(data?.estimatedSavings)} identified by moving usage toward ${suggestedModel}`;
}

/**
 * rankActions(actions, rankedContributors)
 *
 * Reorders the WHY engine's action array so that steps mentioning the
 * highest-savings model appear first. Falls back to original order when
 * no model names are found in the action strings.
 *
 * @param {string[]} actions - Action steps from the WHY engine
 * @param {Array}    rankedContributors - From cost-engine rankCostContributors()
 * @returns {string[]}
 */
function rankActions(actions, rankedContributors) {
  if (!Array.isArray(actions) || actions.length <= 1) {
    return Array.isArray(actions) ? actions : [];
  }

  if (!Array.isArray(rankedContributors) || rankedContributors.length === 0) {
    return actions;
  }

  // Build a savings-rank lookup: model name (lowercase) → rank index (0 = highest savings)
  const savingsRank = {};
  [...rankedContributors]
    .sort((a, b) => b.estimatedSavings - a.estimatedSavings)
    .forEach((contributor, index) => {
      savingsRank[contributor.model.toLowerCase()] = index;
    });

  return [...actions].sort((actionA, actionB) => {
    const lowerA = actionA.toLowerCase();
    const lowerB = actionB.toLowerCase();

    // Find the best (lowest) savings rank referenced in each action string.
    const rankA = Object.entries(savingsRank).reduce(
      (best, [model, rank]) => (lowerA.includes(model) ? Math.min(best, rank) : best),
      Infinity
    );
    const rankB = Object.entries(savingsRank).reduce(
      (best, [model, rank]) => (lowerB.includes(model) ? Math.min(best, rank) : best),
      Infinity
    );

    // Unmatched actions (Infinity) fall to the end.
    return rankA - rankB;
  });
}

// ─────────────────────────────────────────────
// ACTION ENRICHMENT — append monthly savings
// ─────────────────────────────────────────────
// Scans each action string for a model name from rankedContributors.
// When a match is found and the contributor has savings > 0,
// appends "(Est. monthly savings: ~$N)" to that action.
// Preserves the existing order (call after rankActions).

function enrichActions(actions, rankedContributors) {
  if (!Array.isArray(actions) || actions.length === 0) return actions;
  if (!Array.isArray(rankedContributors) || rankedContributors.length === 0) return actions;

  return actions.map((action) => {
    const lower = String(action).toLowerCase();

    // Find the first contributor whose model name appears in this action string.
    const match = rankedContributors.find(
      (c) => c.estimatedSavings > 0 && lower.includes(c.model.toLowerCase())
    );

    if (!match) return action;

    const monthlySavings = (match.estimatedSavings / Math.max(1, match.requestCount)) * MONTHLY_RUN_ESTIMATE;
    if (monthlySavings < 0.01) return action;

    // Avoid appending if the action already mentions a savings figure.
    if (action.includes("Est. monthly") || action.includes("$")) return action;

    return `${action.trimEnd()} (Est. monthly savings: ~${formatCurrency(monthlySavings)})`;
  });
}

// ─────────────────────────────────────────────
// DECISION ENFORCEMENT — ensure urgency + savings
// ─────────────────────────────────────────────
// If the WHY engine's decision string contains no dollar figure,
// appends a brief urgency + savings context suffix.
// If it already has a $ amount, the decision is returned unchanged.

function enforceDecision(decision, data) {
  const text = String(decision || "").trim();

  // Already has a dollar figure — WHY engine did its job.
  if (text.includes("$")) return text;

  const monthlySavings = (() => {
    const savings      = Number(data?.estimatedSavings || 0);
    const requestCount = Math.max(1, Number(data?.rankedContributors?.[0]?.requestCount ?? 1));
    return (savings / requestCount) * MONTHLY_RUN_ESTIMATE;
  })();

  const topModel   = data?.rankedContributors?.[0]?.model ?? data?.highestCostModel?.model ?? "the top model";
  const switchTo   = data?.rankedContributors?.[0]?.suggestedModel ?? data?.suggestedModel ?? "a lower-cost model";

  const suffix = monthlySavings >= 0.01
    ? ` Act this billing cycle — est. monthly savings: ~${formatCurrency(monthlySavings)} by switching ${topModel} \u2192 ${switchTo}.`
    : ` Act this billing cycle.`;

  return text ? `${text}${suffix}` : suffix.trim();
}

export function formatDecisionOutput(data, anomaly) {
  // Resolve confidence: prefer WHY engine value, derive if missing/empty.
  const rawConfidence = String(data?.confidence || "").trim();
  const confidence = rawConfidence || deriveConfidence(anomaly, data);

  // Build ranked + enriched actions.
  const rankedActions = rankActions(
    Array.isArray(data?.action) ? data.action : [],
    data?.rankedContributors
  );

  return {
    priority:   getPriority(data, anomaly),
    change:     formatChange(data, anomaly),
    why:        String(data?.why || "").trim(),
    impact:     buildFullImpact(data?.impact, data),
    action:     enrichActions(rankedActions, data?.rankedContributors),
    decision:   enforceDecision(data?.decision, data),
    confidence,
  };
}
