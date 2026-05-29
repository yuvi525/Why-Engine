import { redis } from '@/lib/redis'

// ── Policy shapes (as stored in Redis by the Governance UI) ──────────────────

export interface GovernancePolicy {
  id:          string
  name:        string
  type:        string            // 'model_restriction' | 'rate_limit' | 'cost_limit'
  description: string
  enabled:     boolean
  config:      Record<string, unknown>
  createdAt:   string
}

export interface GovernanceResult {
  blocked: boolean
  reason?: string
  policyId?: string
  policyName?: string
}

// ── Governance enforcement ────────────────────────────────────────────────────
// Always fails OPEN: if Redis is unavailable → allow request.
// Called in proxy AFTER plan enforcement, BEFORE budget gate.

export async function enforceGovernancePolicies(
  userId:      string,
  requestedModel: string,  // the vela alias chosen by routing: 'vela-mini' | 'vela-pro'
): Promise<GovernanceResult> {
  try {
    const raw = await redis.get<GovernancePolicy[]>(`governance:${userId}`)
    if (!raw || !Array.isArray(raw)) return { blocked: false }

    const policies = raw.filter(p => p.enabled)
    if (policies.length === 0) return { blocked: false }

    for (const policy of policies) {
      // ── Model restriction ─────────────────────────────────────────────
      if (policy.type === 'model_restriction') {
        const cfg = policy.config as {
          allowedModels?: string[]
          blockedModels?: string[]
        }

        // Blocked models list
        if (cfg.blockedModels && cfg.blockedModels.length > 0) {
          if (cfg.blockedModels.includes(requestedModel)) {
            return {
              blocked:    true,
              reason:     `Model '${requestedModel}' is blocked by governance policy '${policy.name}'.`,
              policyId:   policy.id,
              policyName: policy.name,
            }
          }
        }

        // Allowed models list (whitelist — only allow these)
        if (cfg.allowedModels && cfg.allowedModels.length > 0) {
          if (!cfg.allowedModels.includes(requestedModel)) {
            return {
              blocked:    true,
              reason:     `Model '${requestedModel}' is not in the allowed list for policy '${policy.name}'.`,
              policyId:   policy.id,
              policyName: policy.name,
            }
          }
        }
      }

      // ── Rate limit ────────────────────────────────────────────────────
      if (policy.type === 'rate_limit') {
        const cfg = policy.config as { requestsPerHour?: number }
        if (cfg.requestsPerHour) {
          const counterKey = `gov_ratelimit:${userId}:${policy.id}:${getCurrentHourBucket()}`
          try {
            const count = await redis.incr(counterKey)
            if (count === 1) {
              // First increment — set expiry to 2 hours (covers rollover)
              await redis.expire(counterKey, 7200)
            }
            if (count > cfg.requestsPerHour) {
              return {
                blocked:    true,
                reason:     `Hourly request limit of ${cfg.requestsPerHour} reached (policy: '${policy.name}').`,
                policyId:   policy.id,
                policyName: policy.name,
              }
            }
          } catch {
            // Redis error → fail open
          }
        }
      }
    }

    return { blocked: false }
  } catch {
    // Any error → fail open
    return { blocked: false }
  }
}

// ── Budget rule resolver ──────────────────────────────────────────────────────
// Reads customer-defined budget configs from Redis.
// Returns the SMALLEST enabled daily hard limit, or postgresLimit if none found.
// Always fails OPEN.

export interface BudgetRule {
  id:           string
  name:         string
  scope:        string   // 'daily' | 'monthly' | 'per_request'
  limitMicro:   number   // hard limit in microdollars
  hardLimit:    boolean
  softLimitPct: number   // 0-100: trigger downgrade at this % of limit
  enabled:      boolean
}

export async function resolveEffectiveDailyLimit(
  userId:        string,
  postgresLimit: number,
): Promise<{ dailyLimitMicro: number; softLimitPct: number }> {
  try {
    const raw = await redis.get<BudgetRule[]>(`budgets:${userId}`)
    if (!raw || !Array.isArray(raw)) return { dailyLimitMicro: postgresLimit, softLimitPct: 80 }

    const dailyBudgets = raw.filter(b => b.enabled && b.scope === 'daily' && b.hardLimit && b.limitMicro > 0)
    if (dailyBudgets.length === 0) return { dailyLimitMicro: postgresLimit, softLimitPct: 80 }

    // Use the most restrictive (smallest) hard limit
    const smallest = dailyBudgets.reduce((a, b) => a.limitMicro < b.limitMicro ? a : b)
    const effectiveLimit = Math.min(smallest.limitMicro, postgresLimit)

    return {
      dailyLimitMicro: effectiveLimit,
      softLimitPct:    smallest.softLimitPct ?? 80,
    }
  } catch {
    return { dailyLimitMicro: postgresLimit, softLimitPct: 80 }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCurrentHourBucket(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`
}
