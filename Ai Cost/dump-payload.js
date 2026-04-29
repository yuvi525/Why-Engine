const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function printSampleResponse() {
  const browserUserId = '1f6fe52a-33c6-438b-9856-39bfbc95c72b';
  
  const logs = await prisma.decisionLog.findMany({
    where: { userId: browserUserId },
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: {
      id: true, requestId: true, model: true, reasonCode: true,
      inputTokens: true, outputTokens: true, actualCostMicro: true,
      baselineCostMicro: true, savingsMicro: true, savingsPct: true,
      isCacheHit: true, promptPreview: true, createdAt: true,
    },
  });

  const budget = await prisma.budgetState.findUnique({ where: { userId: browserUserId } });

  const responsePayload = {
    logs: logs.map(log => ({
      ...log,
      why: {
        why: 'Sample why explanation...',
        impact: 'Sample impact...',
        action: 'Sample action...'
      },
    })),
    stats: {
      savingsTodayMicro: 8624,
      spentTodayMicro: 551,
      baselineTodayMicro: 9175,
      requestsToday: 21,
      savingsTotalMicro: budget.totalBaselineMicro - budget.totalSpentMicro,
      dailyLimitMicro: budget.dailyLimitMicro,
      spentBudgetMicro: budget.spentTodayMicro,
    }
  };

  console.log(JSON.stringify(responsePayload, null, 2));
}

printSampleResponse().catch(console.error).finally(() => prisma.$disconnect());
