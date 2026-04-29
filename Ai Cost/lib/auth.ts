import { createHash } from 'crypto'
import { prisma } from './prisma'

export async function validateApiKey(authHeader: string | null): Promise<{
  valid: boolean
  userId?: string
  keyId?: string
}> {
  if (!authHeader?.startsWith('Bearer ')) return { valid: false }

  const key = authHeader.slice(7)
  if (!key.startsWith('vk_live_')) return { valid: false }

  const keyHash = createHash('sha256').update(key).digest('hex')

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash, isActive: true },
    select: { id: true, userId: true },
  })

  if (!apiKey) return { valid: false }

  // Update lastUsedAt async — never block
  void prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  })

  return { valid: true, userId: apiKey.userId, keyId: apiKey.id }
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const { randomUUID } = require('crypto')
  const raw = randomUUID().replace(/-/g, '')
  const key = `vk_live_${raw}`
  const hash = createHash('sha256').update(key).digest('hex')
  const prefix = key.slice(0, 16)
  return { key, hash, prefix }
}
