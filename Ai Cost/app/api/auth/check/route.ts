import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    return NextResponse.json({ loggedIn: true })
  }
  return NextResponse.json({ loggedIn: false })
}
