import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { resolveSessionUserId } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userId = await resolveSessionUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const key = `alerts:fired:${userId}`
    const luaScript = `
      local key = KEYS[1]
      local id = ARGV[1]
      local raw = redis.call('GET', key)
      if not raw then return 0 end
      local ok, alerts = pcall(cjson.decode, raw)
      if not ok or type(alerts) ~= "table" then return 0 end
      local changed = false
      for i, a in ipairs(alerts) do
        if a.id == id then
          a.acknowledged = true
          changed = true
        end
      end
      if changed then
        redis.call('SETEX', key, 604800, cjson.encode(alerts))
        return 1
      end
      return 0
    `
    try {
      await redis.eval(luaScript, [key], [id])
    } catch (luaErr) {
      console.warn('[vela-ack] Lua script failed, falling back to JS get-set:', luaErr)
      const raw    = await redis.get(key)
      const data   = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : []
      const alerts = Array.isArray(data) ? data : []

      const updated = alerts.map((a: any) =>
        a.id === id ? { ...a, acknowledged: true } : a
      )
      await redis.setex(key, 86400 * 7, JSON.stringify(updated))
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to acknowledge' }, { status: 500 })
  }
}
