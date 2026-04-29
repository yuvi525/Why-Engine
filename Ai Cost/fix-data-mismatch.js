const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMismatch() {
  const browserUserId = '1f6fe52a-33c6-438b-9856-39bfbc95c72b';
  const proxyUserId = 'f280b947-1788-4d11-a795-b37593ead4eb';

  console.log(`Transferring data from Proxy User (${proxyUserId}) to Browser User (${browserUserId})...`);

  // 1. Transfer DecisionLogs
  const updatedLogs = await prisma.decisionLog.updateMany({
    where: { userId: proxyUserId },
    data: { userId: browserUserId }
  });
  console.log(`Transferred ${updatedLogs.count} DecisionLogs.`);

  // 2. Transfer or Update BudgetState
  // First check if browser user has a BudgetState
  const existingBudget = await prisma.budgetState.findUnique({ where: { userId: browserUserId } });
  const proxyBudget = await prisma.budgetState.findUnique({ where: { userId: proxyUserId } });

  if (proxyBudget) {
    if (existingBudget) {
      await prisma.budgetState.update({
        where: { userId: browserUserId },
        data: {
          spentTodayMicro: proxyBudget.spentTodayMicro,
          baselineTodayMicro: proxyBudget.baselineTodayMicro,
          totalSpentMicro: proxyBudget.totalSpentMicro,
          totalBaselineMicro: proxyBudget.totalBaselineMicro,
          requestsToday: proxyBudget.requestsToday,
          cacheHitsToday: proxyBudget.cacheHitsToday
        }
      });
      // Delete proxy budget
      await prisma.budgetState.delete({ where: { userId: proxyUserId } });
    } else {
      await prisma.budgetState.update({
        where: { userId: proxyUserId },
        data: { userId: browserUserId }
      });
    }
    console.log('Transferred BudgetState.');
  }

  // 3. Transfer API Key
  const apiKeys = await prisma.apiKey.findMany({ where: { userId: proxyUserId } });
  if (apiKeys.length > 0) {
    await prisma.apiKey.updateMany({
      where: { userId: proxyUserId },
      data: { userId: browserUserId }
    });
    console.log(`Transferred ${apiKeys.length} API Keys.`);
  }

  // 4. Update the User record's encryptedApiKey
  const proxyUser = await prisma.user.findUnique({ where: { id: proxyUserId } });
  if (proxyUser && proxyUser.encryptedApiKey) {
    await prisma.user.update({
      where: { id: browserUserId },
      data: { encryptedApiKey: proxyUser.encryptedApiKey }
    });
    console.log('Transferred encrypted OpenAI Key.');
  }

  console.log('Data flow mismatch fixed. Dashboard should now show real data!');
}

fixMismatch().catch(console.error).finally(() => prisma.$disconnect());
