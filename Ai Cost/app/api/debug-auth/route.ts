import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  
  const supabase = await createServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()

  return NextResponse.json({
    hasUser: !!user,
    user: user,
    error: error,
    cookies: allCookies.map(c => c.name),
    env: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10),
    }
  })
}
