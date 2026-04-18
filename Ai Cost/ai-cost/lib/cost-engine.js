import { MODEL_SUGGESTIONS, getPricePerThousand } from "./model-pricing";

function roundCurrency(value) {
  return Number(value.toFixed(2));
}

export function calculateTotalCost(data) {
  return roundCurrency(
    data.reduce((total, entry) => total + Number(entry.cost || 0), 0)
  );
}

export function calculateGrowth(data) {
  const latestCost = Number(data[data.length - 1]?.cost || 0);
  const previousCost = Number(data[data.length - 2]?.cost || 0);

  if (previousCost <= 0) {
    return {
      latestCost: roundCurrency(latestCost),
      previousCost: roundCurrency(previousCost),
      growthPercentage: latestCost > 0 ? 100 : 0,
    };
  }

  return {
    latestCost: roundCurrency(latestCost),
    previousCost: roundCurrency(previousCost),
    growthPercentage: roundCurrency(
      ((latestCost - previousCost) / previousCost) * 100
    ),
  };
}

export function groupCostByModel(data) {
  return data.reduce((accumulator, entry) => {
    const model = entry.model || "unknown";
    accumulator[model] = roundCurrency(
      Number(accumulator[model] || 0) + Number(entry.cost || 0)
    );
    return accumulator;
  }, {});
}

export function findHighestCostModel(data) {
  const costByModel = groupCostByModel(data);
  const [model = "unknown", cost = 0] =
    Object.entries(costByModel).sort((a, b) => b[1] - a[1])[0] || [];

  return {
    model,
    cost: roundCurrency(Number(cost || 0)),
  };
}

export function detectCostLeak(data) {
  const totalCost = calculateTotalCost(data);
  const { latestCost, previousCost, growthPercentage } = calculateGrowth(data);
  const highestCostModel = findHighestCostModel(data);
  const dominantShare =
    totalCost > 0 ? (highestCostModel.cost / totalCost) * 100 : 0;
  const spikeAmount = latestCost - previousCost;

  const hasLeak =
    growthPercentage >= 30 || dominantShare >= 60 || spikeAmount >= 10;

  let reason = "No meaningful cost leak detected.";

  if (growthPercentage >= 30) {
    reason = `Latest usage cost increased ${growthPercentage}% versus the previous period.`;
  } else if (dominantShare >= 60) {
    reason = `${highestCostModel.model} accounts for ${roundCurrency(
      dominantShare
    )}% of total spend.`;
  } else if (spikeAmount >= 10) {
    reason = `Latest usage cost rose by $${roundCurrency(spikeAmount)} in a single period.`;
  }

  return {
    detected: hasLeak,
    reason,
    dominantShare: roundCurrency(dominantShare),
    spikeAmount: roundCurrency(spikeAmount),
  };
}

export function estimateSavings(data) {
  const highestCostModel = findHighestCostModel(data);
  const suggestedModel =
    MODEL_SUGGESTIONS[highestCostModel.model] || "gpt-4o-mini";

  // Sum all tokens used by the top model across every record.
  const topModelTokens = data
    .filter((e) => e.model === highestCostModel.model)
    .reduce((sum, e) => sum + Number(e.tokens || 0), 0);

  // Real savings = tokens × (current price − alternative price) / 1,000
  const currentPricePerK = getPricePerThousand(highestCostModel.model);
  const suggestedPricePerK = getPricePerThousand(suggestedModel);
  const priceDelta = currentPricePerK - suggestedPricePerK;

  // Math.max guards against edge cases where suggested model is somehow pricier.
  const estimatedSavings = roundCurrency(
    Math.max(0, (topModelTokens / 1000) * priceDelta)
  );

  return {
    suggestedModel,
    estimatedSavings,
  };
}

/**
 * rankCostContributors(data)
 *
 * Returns every unique model ranked by total cost descending.
 * Each entry includes cost share %, token volume, request count,
 * and real per-model estimated savings using pricing registry math.
 *
 * @param {Array} data - Validated usage records [{ model, tokens, cost }]
 * @returns {Array} Ranked contributor objects
 */
export function rankCostContributors(data) {
  const totalCost = calculateTotalCost(data);

  // Aggregate cost, tokens, and request count per model.
  const modelMap = data.reduce((acc, entry) => {
    const model = entry.model || "unknown";
    if (!acc[model]) {
      acc[model] = { totalCost: 0, totalTokens: 0, requestCount: 0 };
    }
    acc[model].totalCost += Number(entry.cost || 0);
    acc[model].totalTokens += Number(entry.tokens || 0);
    acc[model].requestCount += 1;
    return acc;
  }, {});

  return Object.entries(modelMap)
    .map(([model, stats]) => {
      const suggestedModel = MODEL_SUGGESTIONS[model] || "gpt-4o-mini";
      const currentPricePerK = getPricePerThousand(model);
      const suggestedPricePerK = getPricePerThousand(suggestedModel);
      const priceDelta = currentPricePerK - suggestedPricePerK;
      const estimatedSavings = roundCurrency(
        Math.max(0, (stats.totalTokens / 1000) * priceDelta)
      );

      return {
        model,
        totalCost: roundCurrency(stats.totalCost),
        percentage: totalCost > 0
          ? roundCurrency((stats.totalCost / totalCost) * 100)
          : 0,
        totalTokens: stats.totalTokens,
        requestCount: stats.requestCount,
        suggestedModel,
        estimatedSavings,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost);
}

export function buildCostIntelligence(data) {
  const totalCost = calculateTotalCost(data);
  const { latestCost, previousCost, growthPercentage } = calculateGrowth(data);
  const costByModel = groupCostByModel(data);
  const costLeak = detectCostLeak(data);
  const highestCostModel = findHighestCostModel(data);
  const { suggestedModel, estimatedSavings } = estimateSavings(data);
  const rankedContributors = rankCostContributors(data);

  return {
    totalCost,
    latestCost,
    previousCost,
    growthPercentage,
    costByModel,
    costLeak,
    highestCostModel,
    suggestedModel,
    estimatedSavings,
    rankedContributors,
  };
}
