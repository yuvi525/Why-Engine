import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveSessionUserId } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Load all logs with attribution fields
  const logs = await prisma.decisionLog.findMany({
    where:   { userId },
    select:  {
      customerId: true, featureId: true, apiKeyId: true,
      actualCostMicro: true, savingsMicro: true, requestId: true,
    },
  })

  // Load active API keys for label lookup
  const apiKeys = await prisma.apiKey.findMany({
    where:  { userId, isActive: true },
    select: { id: true, keyPrefix: true, label: true },
  })
  const keyMap = new Map(apiKeys.map(k => [k.id, k]))

  // ── By customer ──────────────────────────────────────────────────────────
  const custMap = new Map<string, { requests: number; costMicro: number; savingsMicro: number }>()
  for (const l of logs) {
    const key = l.customerId ?? '(untagged)'
    const cur = custMap.get(key) ?? { requests: 0, costMicro: 0, savingsMicro: 0 }
    cur.requests++;  cur.costMicro += l.actualCostMicro;  cur.savingsMicro += l.savingsMicro
    custMap.set(key, cur)
  }

  // ── By feature ───────────────────────────────────────────────────────────
  const featMap = new Map<string, { requests: number; costMicro: number; savingsMicro: number }>()
  for (const l of logs) {
    const key = l.featureId ?? '(untagged)'
    const cur = featMap.get(key) ?? { requests: 0, costMicro: 0, savingsMicro: 0 }
    cur.requests++;  cur.costMicro += l.actualCostMicro;  cur.savingsMicro += l.savingsMicro
    featMap.set(key, cur)
  }

  // ── By API key (REAL data) ────────────────────────────────────────────────
  const keySpendMap = new Map<string, { requests: number; costMicro: number; savingsMicro: number }>()
  for (const l of logs) {
    if (!l.apiKeyId) continue
    const cur = keySpendMap.get(l.apiKeyId) ?? { requests: 0, costMicro: 0, savingsMicro: 0 }
    cur.requests++;  cur.costMicro += l.actualCostMicro;  cur.savingsMicro += l.savingsMicro
    keySpendMap.set(l.apiKeyId, cur)
  }

  // Merge with API key metadata; include keys with zero usage too
  const byApiKey = apiKeys.map(k => {
    const spend = keySpendMap.get(k.id) ?? { requests: 0, costMicro: 0, savingsMicro: 0 }
    return { id: k.id, prefix: k.keyPrefix, label: k.label ?? k.keyPrefix, ...spend }
  })

  // Also include any keyIds in logs that aren't in the active key list (deleted keys)
  for (const [keyId, spend] of keySpendMap.entries()) {
    if (!keyMap.has(keyId)) {
      byApiKey.push({ id: keyId, prefix: 'deleted', label: 'Deleted Key', ...spend })
    }
  }

  const total = {
    requests:     logs.length,
    costMicro:    logs.reduce((a, l) => a + l.actualCostMicro, 0),
    savingsMicro: logs.reduce((a, l) => a + l.savingsMicro, 0),
  }

  return NextResponse.json({
    total,
    byCustomer: Array.from(custMap.entries()).map(([id, v]) => ({ id, ...v })),
    byFeature:  Array.from(featMap.entries()).map(([id, v]) => ({ id, ...v })),
    byApiKey:   byApiKey.sort((a, b) => b.costMicro - a.costMicro),
  })
}
