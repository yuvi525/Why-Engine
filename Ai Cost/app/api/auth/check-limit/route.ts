import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const count = await prisma.user.count()
    if (count >= 20) {
      return NextResponse.json({ allowed: false, count })
    }
    return NextResponse.json({ allowed: true, count })
  } catch (error) {
    return NextResponse.json({ allowed: true, error: 'Failed to check limit' }) // Fail open
  }
}
