/**
 * MODEL_PRICING
 *
 * Price per 1,000 tokens in USD.
 * Values represent a blended estimate of input + output costs
 * based on each provider's published pricing.
 *
 * Update this registry whenever provider pricing changes.
 * All engine logic reads from here — no pricing is hardcoded elsewhere.
 */
export const MODEL_PRICING = {
  // OpenAI
  "gpt-4o":        0.005000,
  "gpt-4o-mini":   0.000150,
  "gpt-4.1":       0.002000,
  "gpt-4.1-mini":  0.000400,
  "gpt-4-turbo":   0.010000,
  "o1":            0.015000,
  "o3":            0.010000,

  // Anthropic
  "claude-sonnet": 0.003000,
  "claude-haiku":  0.000250,
};

/**
 * MODEL_SUGGESTIONS
 *
 * Maps each expensive model to its recommended cheaper alternative.
 * Used by the cost engine to calculate real savings opportunities.
 *
 * Rules:
 * - If a model is already the cheapest option, map it to itself.
 * - Always map to a model that exists in MODEL_PRICING.
 */
export const MODEL_SUGGESTIONS = {
  // OpenAI
  "gpt-4o":       "gpt-4o-mini",
  "gpt-4o-mini":  "gpt-4o-mini",
  "gpt-4.1":      "gpt-4.1-mini",
  "gpt-4.1-mini": "gpt-4.1-mini",
  "gpt-4-turbo":  "gpt-4o-mini",
  "o1":           "gpt-4o-mini",
  "o3":           "gpt-4o-mini",

  // Anthropic
  "claude-sonnet": "claude-haiku",
  "claude-haiku":  "claude-haiku",
};

/**
 * getPricePerThousand(model)
 *
 * Returns the price per 1,000 tokens for the given model.
 * Falls back to gpt-4o-mini pricing for unknown models so the
 * engine never crashes on unrecognised model names.
 *
 * @param {string} model - The model identifier.
 * @returns {number} Price in USD per 1,000 tokens.
 */
export function getPricePerThousand(model) {
  return MODEL_PRICING[model] ?? MODEL_PRICING["gpt-4o-mini"];
}
