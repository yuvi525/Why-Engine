// Real per-token costs in USD (approximate, as of 2024)
const COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o':                               { input: 0.000005,   output: 0.000015 },
  'gpt-4o-mini':                          { input: 0.00000015, output: 0.0000006 },
  'gemini-1.5-flash-002':                 { input: 0.000000075, output: 0.0000003 },
  'gemini-1.5-pro-002':                   { input: 0.00000125, output: 0.000005 },
  'anthropic.claude-3-haiku-20240307':    { input: 0.00000025, output: 0.00000125 },
  'anthropic.claude-3-5-haiku-20241022':  { input: 0.0000008,  output: 0.000004 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COSTS[model] || COSTS['gpt-4o-mini'];
  return rates.input * inputTokens + rates.output * outputTokens;
}
