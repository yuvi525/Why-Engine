import { DOMAINS } from "@/lib/domains";

const EXPENSIVE_MODEL_PATTERNS = [/gpt-4/i, /^o1/i, /^o3/i];

function isExpensiveModel(model) {
  return EXPENSIVE_MODEL_PATTERNS.some((pattern) => pattern.test(model));
}

function getLatestUsageEntries(usage) {
  return usage.slice(-2).map((entry) => ({
    model: String(entry?.model || "").trim(),
    cost: Number(entry?.cost || 0),
    tokens: Number(entry?.tokens || 0),
  }));
}

function detectCostSpike(usage) {
  // Need at least 2 entries: one historical baseline + one current.
  if (usage.length < 2) {
    return null;
  }

  const historicalEntries = usage.slice(0, -1);
  const historicalAvg =
    historicalEntries.reduce((sum, e) => sum + Number(e.cost || 0), 0) /
    historicalEntries.length;

  // Cannot evaluate a spike against a zero baseline.
  if (historicalAvg <= 0) {
    return null;
  }

  const latestCost = Number(usage[usage.length - 1]?.cost || 0);
  const ratio = latestCost / historicalAvg;

  // Spike threshold: cost increase >50% above historical average (ratio > 1.5).
  if (ratio > 1.5) {
    return {
      isAnomaly: true,
      type:      "cost_spike",
      severity:  "high",
      historicalAvg: Number(historicalAvg.toFixed(4)),
      latestCost:    Number(latestCost.toFixed(4)),
      ratio:         Number(ratio.toFixed(2)),
      details:       `Cost is ${((ratio - 1) * 100).toFixed(0)}% above historical average ($${historicalAvg.toFixed(4)} → $${latestCost.toFixed(4)})`,
    };
  }

  return null;
}

function detectModelOveruse(costByModel, totalCost) {
  if (!totalCost) {
    return null;
  }

  // Build a ranked breakdown of every model's cost share.
  const contributors = Object.entries(costByModel)
    .map(([model, cost]) => ({
      model,
      cost: Number(cost || 0),
      share: Number(((Number(cost || 0) / totalCost) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.cost - a.cost);

  // ── Check 1: single model dominates >70% of total cost ───────────────
  if (contributors.length > 0) {
    const top      = contributors[0];
    const topRatio = top.cost / totalCost;
    if (topRatio > 0.70) {
      return {
        isAnomaly:     true,
        type:          "model_overuse",
        severity:      "high",
        dominantModel: top.model,       // kept for backward compat
        contributors,                   // kept for backward compat
        details: {
          model:     top.model,
          share_pct: top.share,         // e.g. 84.2
          message:   `${top.model} accounts for ${top.share}% of total cost`,
        },
      };
    }
  }

  // ── Check 2: expensive models (gpt-4*, o1, o3) collectively >60% ─────
  // (original logic preserved as a fallback)
  const expensiveShare = contributors
    .filter((c) => isExpensiveModel(c.model))
    .reduce((sum, c) => sum + c.cost, 0);

  const expensiveRatio = expensiveShare / totalCost;

  if (expensiveRatio > 0.6) {
    return {
      isAnomaly: true,
      type: "model_overuse",
      severity: expensiveRatio >= 0.8 ? "high" : "medium",
      contributors,
      details: `Expensive models account for ${(expensiveRatio * 100).toFixed(0)}% of total cost`,
    };
  }

  return null;
}

/**
 * detectTokenSpike
 *
 * Flags a token_spike anomaly when the most-recent entry's token count
 * exceeds 2× the average of all historical entries.
 * Requires at least 2 usage records.
 */
function detectTokenSpike(usage) {
  if (usage.length < 2) return null;

  const historical = usage.slice(0, -1);
  const latest     = usage[usage.length - 1];

  const avgTokens = historical.reduce((sum, e) => sum + Number(e.tokens || 0), 0)
    / historical.length;

  if (avgTokens <= 0) return null;

  const latestTokens = Number(latest?.tokens || 0);
  const ratio        = latestTokens / avgTokens;

  if (ratio > 2.0) {
    return {
      isAnomaly:    true,
      type:         "token_spike",
      severity:     "high",
      avgTokens:    Math.round(avgTokens),
      latestTokens,
      ratio:        Number(ratio.toFixed(2)),
      details:      `Token count is ${ratio.toFixed(1)}× above average (${Math.round(avgTokens).toLocaleString()} → ${latestTokens.toLocaleString()} tokens)`,
    };
  }

  return null;
}

/**
 * detectLoopPattern
 *
 * Flags a loop_detected anomaly when the same model appears in ≥3
 * consecutive usage entries (indicating a retry/tool-call loop).
 *
 * Severity: always "critical" — a loop is always an urgent signal.
 */
function detectLoopPattern(usage) {
  if (usage.length < 3) return null;

  let maxRun = 1;
  let runLen  = 1;
  let loopModel = null;

  for (let i = 1; i < usage.length; i++) {
    const prev = String(usage[i - 1]?.model || "").trim().toLowerCase();
    const curr = String(usage[i]?.model     || "").trim().toLowerCase();

    if (curr && curr === prev) {
      runLen++;
      if (runLen > maxRun) {
        maxRun    = runLen;
        loopModel = curr;
      }
    } else {
      runLen = 1;
    }
  }

  if (maxRun >= 3) {
    return {
      isAnomaly:   true,
      type:        "loop_detected",
      severity:    "critical",
      model:       loopModel,
      repeatCount: maxRun,
      details:     `${loopModel} called ${maxRun} consecutive times — possible retry loop or tool-call cycle`,
    };
  }

  return null;
}

function detectMixChange(usage, totalCost) {
  if (usage.length < 2 || !totalCost) {
    return null;
  }

  const [previousEntry, currentEntry] = getLatestUsageEntries(usage);

  if (!previousEntry.model || !currentEntry.model) {
    return null;
  }

  const modelChanged = previousEntry.model !== currentEntry.model;
  const costDelta = Math.abs(currentEntry.cost - previousEntry.cost);
  const relativeShift = totalCost > 0 ? costDelta / totalCost : 0;

  if (modelChanged && relativeShift >= 0.25) {
    return {
      isAnomaly: true,
      type: "mix_change",
      severity: relativeShift >= 0.5 ? "high" : "medium",
    };
  }

  return null;
}

export function detectCostAnomaly(data) {
  const usage = Array.isArray(data?.usage) ? data.usage : [];
  const currentCost = Number(data?.currentCost || 0);
  const previousCost = Number(data?.previousCost || 0);
  const costByModel = data?.costByModel || {};
  const totalCost = Number(data?.totalCost || 0);

  const checks = [
    detectCostSpike(usage),
    detectModelOveruse(costByModel, totalCost),
    detectMixChange(usage, totalCost),
    detectTokenSpike(usage),
    detectLoopPattern(usage),
  ].filter(Boolean);

  const severityRank = {
    low:      1,
    medium:   2,
    high:     3,
    critical: 4,  // reserved for future escalations
  };

  const highestPriority =
    checks.sort(
      (left, right) =>
        severityRank[right.severity] - severityRank[left.severity]
    )[0] || null;

  if (!highestPriority) {
    return {
      isAnomaly: false,
      type:      null,
      severity:  "low",
      domain:    DOMAINS.AI,   // always present for multi-domain compat
    };
  }

  // Stamp domain onto the winner — spread preserves all existing fields.
  return { ...highestPriority, domain: DOMAINS.AI };
}
