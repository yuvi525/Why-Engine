import { createHash } from 'crypto'
import { prisma } from './prisma'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { decrypt } from './crypto'

// ── API Key Validation (Proxy path) ────────────────────────────────────────
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

// ── Key Generator ──────────────────────────────────────────────────────────
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const { randomUUID } = require('crypto')
  const raw    = randomUUID().replace(/-/g, '')
  const key    = `vk_live_${raw}`
  const hash   = createHash('sha256').update(key).digest('hex')
  const prefix = key.slice(0, 16)
  return { key, hash, prefix }
}

// ── Session Cookie Resolver (Dashboard API routes) ─────────────────────────
// Reads the vela_session AES cookie set during login/signup.
// Use this in all /api/* dashboard routes instead of Supabase getUser().
export async function resolveSessionUserId(req?: NextRequest): Promise<string | null> {
  try {
    // Prefer reading from the incoming request headers directly
    // (works in both Pages and App Router)
    let sessionCookie: string | undefined

    if (req) {
      sessionCookie = req.cookies.get('vela_session')?.value
    }

    // Fallback: use Next.js cookies() helper (server components / Route Handlers)
    if (!sessionCookie) {
      try {
        const cookieStore = await cookies()
        sessionCookie = cookieStore.get('vela_session')?.value
      } catch { /* cookies() not available in this context */ }
    }

    if (!sessionCookie) return null

    const raw    = decrypt(sessionCookie)
    const parsed = JSON.parse(raw)

    if (parsed?.id && typeof parsed.id === 'string') return parsed.id
    return null
  } catch {
    return null
  }
}

// ── Owner Check ────────────────────────────────────────────────────────────
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'yuvrajsingh2351@gmail.com'

export async function isOwner(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  })
  if (!user) return false
  return user.role === 'owner' || user.email === OWNER_EMAIL
}
