import { prisma } from '@/lib/prisma'

/**
 * Aggregates total cost per customer_id for a given Vela user.
 * Only includes logs that have a customerId set.
 */
export async function costPerCustomer(
  userId: string
): Promise<Array<{ customerId: string; totalCostMicro: number; requestCount: number }>> {
  const results = await prisma.decisionLog.groupBy({
    by: ['customerId'],
    where: { userId, customerId: { not: null } },
    _sum: { actualCostMicro: true },
    _count: { id: true },
    orderBy: { _sum: { actualCostMicro: 'desc' } },
  })

  return results.map(r => ({
    customerId: r.customerId!,
    totalCostMicro: r._sum.actualCostMicro ?? 0,
    requestCount: r._count.id,
  }))
}

/**
 * Aggregates total cost per feature_id for a given Vela user.
 * Only includes logs that have a featureId set.
 */
export async function costPerFeature(
  userId: string
): Promise<Array<{ featureId: string; totalCostMicro: number; requestCount: number }>> {
  const results = await prisma.decisionLog.groupBy({
    by: ['featureId'],
    where: { userId, featureId: { not: null } },
    _sum: { actualCostMicro: true },
    _count: { id: true },
    orderBy: { _sum: { actualCostMicro: 'desc' } },
  })

  return results.map(r => ({
    featureId: r.featureId!,
    totalCostMicro: r._sum.actualCostMicro ?? 0,
    requestCount: r._count.id,
  }))
}
