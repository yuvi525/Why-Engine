import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const logs = await prisma.decisionLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  })
  console.log(logs)
}

main().then(() => prisma.$disconnect())
