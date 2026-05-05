import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { encrypt } from '@/lib/crypto'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    console.log(`[AUTH] Login attempt for: ${normalizedEmail}`)

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    if (!user) {
      console.log(`[AUTH] Login failed: User not found for ${normalizedEmail}`)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 })
    }

    if (!user.passwordHash) {
      console.log(`[AUTH] Login failed: No password hash for ${normalizedEmail}`)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 })
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash)
    console.log(`[AUTH] Password match for ${normalizedEmail}: ${isMatch}`)

    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 })
    }

    // Success - create session cookie
    const token = encrypt(JSON.stringify({ id: user.id, email: user.email }))
    const res = NextResponse.json({ success: true, role: user.role })
    res.cookies.set('vela_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    return res

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
