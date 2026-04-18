function roundValue(value) {
  return Number(Number(value || 0).toFixed(2));
}

function buildModelBreakdown(costByModel, totalCost) {
  return Object.entries(costByModel)
    .map(([model, cost]) => ({
      model,
      cost: roundValue(cost),
      percentage: totalCost > 0 ? roundValue((Number(cost) / totalCost) * 100) : 0,
    }))
    .sort((left, right) => right.cost - left.cost);
}

/**
 * deriveCausation()
 *
 * Produces a real causal statement for topDriver.reason based on the
 * anomaly type and concrete usage signals (tokens, requests, cost share).
 * Replaces the hardcoded "highest cost contributor" string.
 *
 * @param {string|null} anomalyType - "cost_spike" | "model_overuse" | "mix_change" | null
 * @param {object} topDriver - { model, cost, percentage } from modelBreakdown[0]
 * @param {object} anomaly - full anomaly object from detection-engine
 * @param {Array}  rawUsage - validated usage records [{ model, tokens, cost }]
 * @returns {string}
 */
function deriveCausation(anomalyType, topDriver, anomaly, rawUsage) {
  const usage = Array.isArray(rawUsage) ? rawUsage : [];
  const model = topDriver?.model || "unknown";
  const share = topDriver?.percentage ?? 0;

  // Token total and request count for the top model.
  const topModelRecords = usage.filter((e) => e.model === model);
  const totalTokens = topModelRecords.reduce(
    (sum, e) => sum + Number(e.tokens || 0),
    0
  );
  const requestCount = topModelRecords.length;

  if (anomalyType === "cost_spike") {
    const historicalAvg = anomaly?.historicalAvg ?? 0;
    const ratio = anomaly?.ratio ?? 0;
    return (
      `${model} triggered a ${ratio}\u00d7 cost spike above the historical ` +
      `average of $${historicalAvg.toFixed(2)}. ` +
      `Usage: ${totalTokens.toLocaleString()} tokens across ` +
      `${requestCount} request(s).`
    );
  }

  if (anomalyType === "model_overuse") {
    return (
      `${model} consumed ${share}% of total spend across ` +
      `${requestCount} request(s) and ` +
      `${totalTokens.toLocaleString()} tokens — ` +
      `a high-cost model driving a disproportionate share of spend.`
    );
  }

  if (anomalyType === "mix_change") {
    // For mix change, surface the shift between the two latest records.
    const prevRecord = usage[usage.length - 2];
    const currRecord = usage[usage.length - 1];
    const prevModel = prevRecord?.model || "previous model";
    const currModel = currRecord?.model || model;
    const prevCost = Number(prevRecord?.cost || 0).toFixed(2);
    const currCost = Number(currRecord?.cost || 0).toFixed(2);
    const affectedRequests = usage.filter(
      (e) => e.model === currModel
    ).length;
    return (
      `Model usage shifted from ${prevModel} to ${currModel} in the latest ` +
      `period, driving spend from $${prevCost} to $${currCost} across ` +
      `${affectedRequests} request(s).`
    );
  }

  // Default: generic cost share statement.
  return (
    `${model} accounts for ${share}% of total spend across ` +
    `${requestCount} request(s) and ${totalTokens.toLocaleString()} tokens.`
  );
}

export function buildContext(data, anomaly, rawUsage) {
  const usage = Array.isArray(rawUsage) ? rawUsage : [];
  const currentCost = roundValue(data?.latestCost);
  const previousCost = roundValue(data?.previousCost);
  const percentageChange = roundValue(data?.growthPercentage);
  const totalCost = roundValue(data?.totalCost);
  const costByModel = data?.costByModel || {};
  const modelBreakdown = buildModelBreakdown(costByModel, totalCost);
  const topDriver = modelBreakdown[0] || {
    model: "unknown",
    cost: 0,
    percentage: 0,
  };
  const estimatedWaste = roundValue(data?.estimatedSavings);

  // Compute token + request counts for the top model from raw usage.
  const topModelRecords = usage.filter((e) => e.model === topDriver.model);
  const topDriverTotalTokens = topModelRecords.reduce(
    (sum, e) => sum + Number(e.tokens || 0),
    0
  );
  const topDriverRequestCount = topModelRecords.length;

  // Spike fields — only present when the anomaly is a cost_spike.
  const spike =
    anomaly?.type === "cost_spike"
      ? {
          historicalAvg: anomaly.historicalAvg ?? 0,
          latestCost: anomaly.latestCost ?? currentCost,
          ratio: anomaly.ratio ?? 0,
        }
      : null;

  // Contributors — ranked model breakdown, present when detection engine supplies it.
  const contributors = Array.isArray(anomaly?.contributors)
    ? anomaly.contributors
    : [];

  return {
    anomalyType: anomaly?.type || null,
    summary: {
      currentCost,
      previousCost,
      percentageChange,
    },
    modelBreakdown,
    topDriver: {
      model: topDriver.model,
      reason: deriveCausation(anomaly?.type, topDriver, anomaly, rawUsage),
      share: topDriver.percentage,
      totalTokens: topDriverTotalTokens,
      requestCount: topDriverRequestCount,
    },
    spike,
    contributors,
    estimatedWaste,
    suggestedOptimization: {
      from: data?.highestCostModel?.model || topDriver.model,
      to: data?.suggestedModel || "gpt-4o-mini",
      savings: estimatedWaste,
    },
    // Full ranked breakdown with per-model cost %, tokens, and real savings.
    rankedContributors: Array.isArray(data?.rankedContributors)
      ? data.rankedContributors
      : [],
  };
}
