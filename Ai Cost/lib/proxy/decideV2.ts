import { Redis } from '@upstash/redis'
import { AutopilotAction } from './autopilot'
import { RoutingDecision, ReasonCode } from './decide'
import { redis } from '../redis'

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface V2Input {
  messages: { role: string; content: string }[]
  totalInputTokens: number
}

export interface V2Decision extends RoutingDecision {
  complexityV2: number  // 1-5 scale
  shadowOnly: boolean   // true = shadow mode, do not apply to actual routing
}

export interface ConfidenceData {
  successRate: number
  sampleCount: number
  avgLatencyMs: number
  avgSavingsMicro: number
  computedAt: number
}

// ──────────────────────────────────────────────────────────────────────────────
// 5-tier complexity scoring
// ──────────────────────────────────────────────────────────────────────────────

export function classifyV2Score(input: V2Input): number {
  let score = 0

  // Token volume
  if (input.totalInputTokens > 800)      score += 3
  else if (input.totalInputTokens > 400) score += 2
  else if (input.totalInputTokens > 150) score += 1

  const fullText = input.messages.map((m) => m.content ?? '').join('\n')
  const lowerText = fullText.toLowerCase()

  // Code involvement
  if (
    fullText.includes('```') ||
    fullText.includes('function ') ||
    /\bclass\b|\bimport\b|\bconst\b|\bdef\b/.test(fullText)
  ) score += 2

  // Complex intent keywords
  const complexKws = [
    'analyze', 'analyse', 'compare', 'evaluate', 'critique', 'review',
    'debug', 'fix this bug', 'optimize', 'refactor', 'architecture',
    'reason', 'explain why', 'prove', 'derive', 'calculate step',
    'write a detailed', 'comprehensive', 'in-depth',
  ]
  if (complexKws.some(kw => lowerText.includes(kw))) score += 2

  // Multi-turn conversation
  if (input.messages.filter(m => m.role !== 'system').length > 4) score += 1

  // Simple intent discount
  const simpleKws = [
    'what is', 'define', 'translate', 'list', 'summarize', 'convert',
    'how do i', 'what does', 'give me', 'in one sentence',
  ]
  if (simpleKws.some(kw => lowerText.startsWith(kw))) score -= 2

  const userMessages = input.messages.filter(m => m.role === 'user')
  if (userMessages.length === 1 && input.totalInputTokens < 100) score -= 2

  // Clamp to 1-5 scale
  if (score <= 0) return 1
  if (score <= 2) return 2
  if (score <= 4) return 3
  if (score <= 6) return 4
  return 5
}

// Static routing matrix: complexity 1-5 → real model
const V2_MATRIX: Record<number, 'gpt-4o-mini' | 'gpt-4o'> = {
  1: 'gpt-4o-mini',
  2: 'gpt-4o-mini',
  3: 'gpt-4o-mini',
  4: 'gpt-4o',
  5: 'gpt-4o',
}

// ──────────────────────────────────────────────────────────────────────────────
// Decision Engine V2
// Runs in SHADOW MODE by default — never affects actual routing until flag is set.
// ──────────────────────────────────────────────────────────────────────────────

export async function decideV2(
  input: V2Input,
  autopilotAction: AutopilotAction,
  shadowOnly = true
): Promise<V2Decision> {
  // Autopilot always takes priority — same as V1
  if (autopilotAction.action === 'FORCE_MINI') {
    return { model: 'vela-mini', reasonCode: 'BUDGET_GUARD', complexityV2: 1, shadowOnly }
  }

  const complexityV2 = classifyV2Score(input)
  let targetModel = V2_MATRIX[complexityV2]

  // Optionally adjust based on routing confidence if learning engine has run
  try {
    const bucketKey = complexityV2 >= 4 ? 1 : 0
    const confidenceKey = `routing:confidence:${bucketKey}:${targetModel}`
    const confidence = await redis.get<ConfidenceData>(confidenceKey)

    if (confidence && confidence.sampleCount >= 50) {
      // If mini has <85% success rate at this complexity level, escalate to pro
      if (targetModel === 'gpt-4o-mini' && confidence.successRate < 0.85) {
        targetModel = 'gpt-4o'
      }
    }
  } catch {
    // Redis failure → use static matrix (fail open)
  }

  const model = targetModel === 'gpt-4o' ? 'vela-pro' : 'vela-mini'
  const reasonCode: ReasonCode = complexityV2 >= 4 ? 'COMPLEXITY_HIGH' : 'COMPLEXITY_LOW'

  return { model, reasonCode, complexityV2, shadowOnly }
}

// ──────────────────────────────────────────────────────────────────────────────
// Shadow Decision Logger
// Records V2 decisions alongside V1 for accuracy comparison.
// Never throws — shadow logging failure is non-critical.
// ──────────────────────────────────────────────────────────────────────────────

export async function runShadowDecision(
  prisma: import('@prisma/client').PrismaClient,
  requestId: string,
  userId: string,
  v1Decision: RoutingDecision,
  v2Decision: V2Decision
): Promise<void> {
  try {
    await (prisma as any).shadowDecision.create({
      data: {
        requestId,
        userId,
        v1Model: v1Decision.model,
        v2Model: v2Decision.model,
        diverged: v1Decision.model !== v2Decision.model,
        complexityV1: v1Decision.reasonCode === 'COMPLEXITY_HIGH' ? 1 : 0,
        complexityV2: v2Decision.complexityV2,
      },
    })
  } catch {
    // Shadow logging failure is intentionally swallowed
  }
}
