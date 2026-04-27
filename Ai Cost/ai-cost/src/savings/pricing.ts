// Prices are per 1,000 tokens (USD)
export const PRICING_TABLE: Record<string, { input: number, output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'o1-preview': { input: 0.015, output: 0.060 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-5-haiku-20241022': { input: 0.00025, output: 0.00125 },
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'amazon.titan-text-express-v1': { input: 0.0008, output: 0.0016 },
  'meta.llama3-70b-instruct-v1:0': { input: 0.00265, output: 0.0035 },
};

// Universal baseline used for calculating "Savings vs Standard Pricing"
export const BASELINE_MODEL = 'gpt-4o';

export function calculateCostForModel(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_TABLE[model];
  if (!pricing) {
    // Fallback to average generic model cost if model is not precisely recognized
    return (inputTokens * 0.002 / 1000) + (outputTokens * 0.005 / 1000);
  }
  return (inputTokens * pricing.input / 1000) + (outputTokens * pricing.output / 1000);
}
