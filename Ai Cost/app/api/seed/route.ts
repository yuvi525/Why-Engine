import { NextResponse } from 'next/server'

// SECURITY: Seed endpoint locked to development only
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Disabled in production' }, { status: 403 })
  }
  return NextResponse.json({ error: 'Use scripts/seed.js for local seeding' }, { status: 403 })
}
