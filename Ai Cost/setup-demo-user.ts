import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

import { encrypt } from './lib/crypto'

const prisma = new PrismaClient()

async function setup() {
  const email = 'demo@vela.app'
  const password = '123456'
  
  const hashedPassword = await bcrypt.hash(password, 10)
  
  // Need a mock API key encrypted so the app doesn't crash if it tries to use it
  const mockKey = 'sk-proj-' + randomBytes(16).toString('hex')
  const encryptedApiKey = encrypt(mockKey)

  // Create or update demo user
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hashedPassword,
      role: 'customer',
      encryptedApiKey,
      plan: 'free'
    },
    create: {
      email,
      passwordHash: hashedPassword,
      role: 'customer',
      encryptedApiKey,
      plan: 'free'
    }
  })

  // Initialize budget state
  await prisma.budgetState.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      dailyLimitMicro: 5_000_000,
      requestsToday: 0,
      spentTodayMicro: 0
    }
  })

  console.log('Demo user created:', user.email, 'Role:', user.role)
}

setup().catch(console.error).finally(() => prisma.$disconnect())
