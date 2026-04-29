export type ComplexityScore = 0 | 1

export interface ClassifierInput {
  messages: { role: string; content: string }[]
  totalInputTokens: number
}

export function classify(input: ClassifierInput): ComplexityScore {
  let score = 0

  // Signal 1: Token count
  if (input.totalInputTokens > 800) score += 3
  else if (input.totalInputTokens > 400) score += 2
  else if (input.totalInputTokens > 150) score += 1

  // Signal 2: Code involvement
  const fullText = input.messages.map(m => m.content).join('\n')
  if (
    fullText.includes('```') ||
    fullText.includes('function ') ||
    /\bclass\b|\bimport\b|\bconst\b|\bdef\b/.test(fullText)
  ) score += 2

  // Signal 3: Complex intent keywords
  const complexKeywords = [
    'analyze', 'analyse', 'compare', 'evaluate', 'critique', 'review',
    'debug', 'fix this bug', 'optimize', 'refactor', 'architecture',
    'reason', 'explain why', 'prove', 'derive', 'calculate step',
    'write a detailed', 'comprehensive', 'in-depth',
  ]
  if (complexKeywords.some(kw => fullText.toLowerCase().includes(kw))) score += 2

  // Signal 4: Multi-turn
  const turns = input.messages.filter(m => m.role !== 'system').length
  if (turns > 4) score += 1

  // Signal 5: Simple intent discount
  const simpleKeywords = [
    'what is', 'define', 'translate', 'list', 'summarize', 'convert',
    'how do i', 'what does', 'give me', 'in one sentence',
  ]
  const lowerText = fullText.toLowerCase()
  if (simpleKeywords.some(kw => lowerText.startsWith(kw))) score -= 2

  const userMessages = input.messages.filter(m => m.role === 'user')
  if (userMessages.length === 1 && input.totalInputTokens < 100) score -= 2

  return score >= 4 ? 1 : 0
}
