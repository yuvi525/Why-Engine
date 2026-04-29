// Pricing in microdollars per 1M tokens (1 USD = 1,000,000 microdollars)
// Source: OpenAI pricing — update this table when prices change
export const PRICING = {
  'gpt-4o':      { inputMicro: 2_500_000,  outputMicro: 10_000_000 },
  'gpt-4o-mini': { inputMicro:   150_000,  outputMicro:    600_000 },
} as const

export interface CostResult {
  actualCostMicro:   number
  baselineCostMicro: number
  savingsMicro:      number
  savingsPct:        number
}

export function computeCost(
  model: keyof typeof PRICING,
  inputTokens: number,
  outputTokens: number
): CostResult {
  const price = PRICING[model]

  const actualCostMicro = Math.round(
    (inputTokens * price.inputMicro + outputTokens * price.outputMicro) / 1_000_000
  )

  const baselineCostMicro = Math.round(
    (inputTokens * PRICING['gpt-4o'].inputMicro +
     outputTokens * PRICING['gpt-4o'].outputMicro) / 1_000_000
  )

  const savingsMicro = Math.max(0, baselineCostMicro - actualCostMicro)
  const savingsPct = baselineCostMicro > 0
    ? Math.round((savingsMicro / baselineCostMicro) * 100)
    : 0

  return { actualCostMicro, baselineCostMicro, savingsMicro, savingsPct }
}

export function formatMicro(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(6)}`
}

export function formatMicroDisplay(micro: number): string {
  const usd = micro / 1_000_000
  if (usd >= 0.01) return `$${usd.toFixed(2)}`
  return `$${usd.toFixed(4)}`
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
