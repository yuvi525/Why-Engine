import { cookies } from 'next/headers'
import { decrypt } from '@/lib/crypto'

export async function createServerSupabase() {
  const cookieStore = await cookies()
  
  // Return a mocked Supabase client that just supports auth.getUser()
  // reading from our local bcrypt session cookie
  return {
    auth: {
      async getUser() {
        try {
          const sessionCookie = cookieStore.get('vela_session')?.value
          if (!sessionCookie) return { data: { user: null }, error: null }
          
          const raw = decrypt(sessionCookie)
          const parsed = JSON.parse(raw)
          
          if (parsed && parsed.id && parsed.email) {
            return { data: { user: { id: parsed.id, email: parsed.email } }, error: null }
          }
          
          return { data: { user: null }, error: null }
        } catch (err) {
          return { data: { user: null }, error: null }
        }
      }
    }
  } as any
}
