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

// ─────────────────────────────────────────────────────────────────────────
// SPLIT PRICING — used by the LLM proxy for accurate per-call cost math
// Prices are per 1,000 tokens in USD (published provider rates).
// Update whenever a provider changes pricing.
// ─────────────────────────────────────────────────────────────────────────
export const MODEL_PRICING_SPLIT = {
  // ── OpenAI ──────────────────────────────────────────────────────────────
  "gpt-4o":           { input: 0.005000, output: 0.015000 },
  "gpt-4o-mini":      { input: 0.000150, output: 0.000600 },
  "gpt-4.1":          { input: 0.002000, output: 0.008000 },
  "gpt-4.1-mini":     { input: 0.000400, output: 0.001600 },
  "gpt-4-turbo":      { input: 0.010000, output: 0.030000 },
  "gpt-3.5-turbo":    { input: 0.000500, output: 0.001500 },
  "o1":               { input: 0.015000, output: 0.060000 },
  "o1-mini":          { input: 0.003000, output: 0.012000 },
  "o3":               { input: 0.010000, output: 0.040000 },

  // ── Anthropic ────────────────────────────────────────────────────────────
  "claude-3-5-sonnet-20241022": { input: 0.003000, output: 0.015000 },
  "claude-3-5-haiku-20241022":  { input: 0.000800, output: 0.004000 },
  "claude-3-opus-20240229":     { input: 0.015000, output: 0.075000 },
  "claude-sonnet":              { input: 0.003000, output: 0.015000 }, // alias
  "claude-haiku":               { input: 0.000250, output: 0.001250 }, // alias

  // ── Google ───────────────────────────────────────────────────────────────
  "gemini-1.5-pro":   { input: 0.001250, output: 0.005000 },
  "gemini-1.5-flash": { input: 0.000075, output: 0.000300 },
  "gemini-2.0-flash": { input: 0.000100, output: 0.000400 },

  // ── Meta / Groq ──────────────────────────────────────────────────────────
  "llama-3.1-70b":    { input: 0.000590, output: 0.000790 },
  "llama-3.1-8b":     { input: 0.000050, output: 0.000080 },
  "mixtral-8x7b":     { input: 0.000240, output: 0.000240 },
};

// Fallback when model is not in the split table
const SPLIT_FALLBACK = { input: 0.000150, output: 0.000600 }; // gpt-4o-mini rates

/**
 * getSplitPricing(model)
 *
 * Returns { input, output } price per 1,000 tokens.
 * Falls back to gpt-4o-mini pricing for unknown models — never throws.
 *
 * @param {string} model
 * @returns {{ input: number, output: number }}
 */
export function getSplitPricing(model) {
  return MODEL_PRICING_SPLIT[model] ?? SPLIT_FALLBACK;
}

/**
 * calculateCost(model, inputTokens, outputTokens)
 *
 * Accurate per-call cost in USD using split input/output pricing.
 * This is the formula the proxy uses after every LLM call.
 *
 *   cost = (inputTokens  × inputPrice  / 1000)
 *         + (outputTokens × outputPrice / 1000)
 *
 * @param {string} model        - Model identifier
 * @param {number} inputTokens  - Prompt token count
 * @param {number} outputTokens - Completion token count
 * @returns {number}            - Cost in USD, rounded to 8 decimal places
 */
export function calculateCost(model, inputTokens, outputTokens) {
  const { input, output } = getSplitPricing(model);
  const cost = (inputTokens * input + outputTokens * output) / 1000;
  return Math.round(cost * 1e8) / 1e8; // 8dp precision
}
