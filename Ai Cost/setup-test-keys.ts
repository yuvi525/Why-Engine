import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { encrypt } from './lib/crypto'
import { createHash } from 'crypto'

// Manually parse .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envLines = envContent.split('\n')
for (const line of envLines) {
  if (line.startsWith('OPENAI_API_KEY=')) {
    process.env.OPENAI_API_KEY = line.split('=')[1].trim()
  }
  if (line.startsWith('ENCRYPTION_KEY=')) {
    process.env.ENCRYPTION_KEY = line.split('=')[1].trim()
  }
}

const prisma = new PrismaClient()

async function setup() {
  const users = await prisma.user.findMany()
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('No OPENAI_API_KEY found in .env.local')
    return
  }

  const encryptedKey = encrypt(process.env.OPENAI_API_KEY)

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { encryptedApiKey: encryptedKey }
    })
    console.log(`Updated user ${user.email} with encrypted API key.`)

    // Create a known API Key for this user
    const rawKey = `vk_live_${user.email.split('@')[0]}`
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    const keyPrefix = rawKey.slice(0, 16)

    // UPSERT the API key
    const existing = await prisma.apiKey.findFirst({ where: { userId: user.id } })
    if (existing) {
      await prisma.apiKey.update({
        where: { id: existing.id },
        data: { keyHash, keyPrefix, isActive: true }
      })
    } else {
      await prisma.apiKey.create({
        data: { userId: user.id, keyHash, keyPrefix, label: 'Test Key' }
      })
    }
    
    // Ensure budget state exists
    const budget = await prisma.budgetState.findUnique({ where: { userId: user.id } })
    if (!budget) {
      await prisma.budgetState.create({
        data: { userId: user.id }
      })
    }

    console.log(`Created API Key for ${user.email}: ${rawKey}`)
  }
}

setup().then(() => prisma.$disconnect())
