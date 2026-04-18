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

  // Spike threshold: current period cost exceeds 2× the historical average.
  if (ratio > 2.0) {
    return {
      isAnomaly: true,
      type: "cost_spike",
      severity: ratio >= 3.0 ? "high" : "medium",
      historicalAvg: Number(historicalAvg.toFixed(4)),
      latestCost: Number(latestCost.toFixed(4)),
      ratio: Number(ratio.toFixed(2)),
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
  ].filter(Boolean);

  const severityRank = {
    low: 1,
    medium: 2,
    high: 3,
  };

  const highestPriority =
    checks.sort(
      (left, right) =>
        severityRank[right.severity] - severityRank[left.severity]
    )[0] || null;

  if (!highestPriority) {
    return {
      isAnomaly: false,
      type: null,
      severity: "low",
    };
  }

  return highestPriority;
}
