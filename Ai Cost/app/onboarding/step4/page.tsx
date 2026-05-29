'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingDown, Zap, ArrowRight, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'

function fmtMicro(micro: number) {
  const usd = micro / 1_000_000
  return usd >= 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(6)}`
}

export default function OnboardingStep4() {
  const router = useRouter()
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/decisions?limit=10')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const logs        = data?.logs ?? []
  const totalSaved  = logs.reduce((a: number, l: any) => a + (l.savingsMicro ?? 0), 0)
  const totalCost   = logs.reduce((a: number, l: any) => a + (l.actualCostMicro ?? 0), 0)
  const cacheHits   = logs.filter((l: any) => l.isCacheHit).length
  const firstWhy    = logs[0]?.why ?? null

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Your savings are live</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here's what Vela has already saved you based on your requests.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Requests',    value: String(logs.length),       icon: BarChart3,    color: 'var(--primary)' },
              { label: 'Total Cost',  value: fmtMicro(totalCost),       icon: Zap,          color: 'var(--muted-foreground)' },
              { label: 'Total Saved', value: fmtMicro(totalSaved),      icon: TrendingDown, color: 'var(--accent)', highlight: true },
            ].map(item => (
              <motion.div key={item.label} initial={{ scale: 0.95 }} animate={{ scale: 1 }}
                className="card p-4 text-center">
                <item.icon className="w-4 h-4 mx-auto mb-2" style={{ color: item.color }} />
                <p className="text-lg font-bold" style={{ color: (item as any).highlight ? 'var(--accent)' : 'var(--foreground)' }}>
                  {item.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
              </motion.div>
            ))}
          </div>

          {/* First WHY explanation */}
          {firstWhy && (
            <div className="card p-5 space-y-3" style={{ borderLeft: '3px solid var(--primary)' }}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">WHY Vela chose this model</p>
              <p className="text-sm text-foreground">{firstWhy.why}</p>
              {firstWhy.action && (
                <p className="text-xs text-muted-foreground">{firstWhy.action}</p>
              )}
            </div>
          )}

          {/* Recent requests table */}
          {logs.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Requests</p>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {logs.slice(0, 5).map((l: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-xs font-medium text-foreground truncate max-w-[160px]">
                        {l.promptPreview || 'Request'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {l.model} · {l.reasonCode?.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                        {fmtMicro(l.savingsMicro ?? 0)} saved
                      </p>
                      <p className="text-xs text-muted-foreground">{fmtMicro(l.actualCostMicro ?? 0)} cost</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => router.push('/onboarding/step5')}
            className="btn btn-primary w-full flex items-center justify-center gap-2">
            <span>Complete Setup</span><ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </motion.div>
  )
}
