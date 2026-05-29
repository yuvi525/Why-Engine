import { NextRequest, NextResponse } from 'next/server'
import { resolveSessionUserId } from '@/lib/auth'

// Unified auth check — reads vela_session cookie, not Supabase
export async function GET(req: NextRequest) {
  const userId = await resolveSessionUserId(req)
  if (userId) return NextResponse.json({ loggedIn: true, userId })
  return NextResponse.json({ loggedIn: false })
}
