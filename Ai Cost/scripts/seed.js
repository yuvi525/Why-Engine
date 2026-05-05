const fs = require('fs')
const path = require('path')
const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8')
for (const line of envFile.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const idx = trimmed.indexOf('=')
  if (idx === -1) continue
  process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
}
const { PrismaClient } = require('@prisma/client')
const { createHash, randomBytes } = require('crypto')
const prisma = new PrismaClient()

// Same encryption as lib/crypto.ts
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
function encrypt(text) {
  const iv = randomBytes(12)
  const cipher = require('crypto').createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

async function seed() {
  const userId = '11111111-1111-1111-1111-111111111111'
  const apiKey = 'vk_live_mockkeyforlocaltesting123'
  const keyHash = createHash('sha256').update(apiKey).digest('hex')
  const openAiKey = process.env.OPENAI_API_KEY || 'sk-proj-mock'

  await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {
      encryptedApiKey: encrypt(openAiKey),
    },
    create: {
      id: userId,
      email: 'test@example.com',
      plan: 'pro',
      encryptedApiKey: encrypt(openAiKey),
      apiKeys: {
        create: {
          keyHash,
          keyPrefix: apiKey.slice(0, 12),
          label: 'Test Key'
        }
      },
      budgetState: {
        create: {
          dailyLimitMicro: 50000000,
          autoDowngradeAt: 0.8
        }
      }
    }
  })
  console.log('Seeded test user successfully. Key:', apiKey)
}
seed().catch(console.error).finally(() => prisma.$disconnect())
