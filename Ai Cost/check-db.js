const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDb() {
  console.log('--- DB Content Check ---');
  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: { decisionLogs: true }
      }
    }
  });

  console.log(`Found ${users.length} users:`);
  users.forEach(u => {
    console.log(`- ID: ${u.id}, Email: ${u.email}, Logs: ${u._count.decisionLogs}`);
  });

  const logs = await prisma.decisionLog.findMany({ take: 3 });
  console.log(`\nSample Logs (up to 3):`);
  logs.forEach(l => {
    console.log(`- User: ${l.userId}, Model: ${l.model}, Cost: ${l.actualCostMicro}, Savings: ${l.savingsMicro}`);
  });
}

checkDb().catch(console.error).finally(() => prisma.$disconnect());
