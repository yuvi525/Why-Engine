import { NextResponse } from 'next/server'

export async function GET() {
  // SECURITY: Debug endpoint permanently disabled
  return NextResponse.json({ error: 'Not available' }, { status: 403 })
}
