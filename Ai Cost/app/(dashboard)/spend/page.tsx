'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, BarChart3, Download } from 'lucide-react'

// ── Types ──
interface SpendData {
  totalCostMicro: number
  spentTodayMicro: number
  savingsTotalMicro: number
  requestsTotal: number
  byModel: { model: string; costMicro: number; requests: number; savingsMicro: number }[]
  byDay: { date: string; costMicro: number; savingsMicro: number; requests: number }[]
  byReason: { reason: string; count: number; costMicro: number }[]
}

const usd = (micro: number, dec = 2) => `$${(micro / 1e6).toFixed(dec)}`
const usdFull = (micro: number) => `$${(micro / 1e6).toFixed(4)}`

function HorizBar({ label, value, max, sub, color = 'var(--primary)' }: {
  label: string; value: number; max: number; sub?: string; color?: string;
}) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-xs truncate flex-shrink-0" style={{ color: 'var(--foreground)' }}>{label}</div>
      <div className="flex-1 progress-track h-1.5">
        <motion.div
          className="progress-fill h-1.5"
          initial={{ width: 0 }}
          animate={{ width: `${w}%` }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          style={{ background: color }}
        />
      </div>
      <div className="text-right w-20 flex-shrink-0">
        <span className="text-xs font-mono tabular" style={{ color: 'var(--foreground)' }}>{usd(value)}</span>
        {sub && <span className="text-xs ml-1" style={{ color: 'var(--muted-foreground)' }}>{sub}</span>}
      </div>
    </div>
  )
}

// Spend trend mini-chart (canvas-free bar chart)
function SpendTrend({ data }: { data: { date: string; costMicro: number; savingsMicro: number }[] }) {
  const maxCost = Math.max(...data.map(d => d.costMicro), 1)
  const last7 = data.slice(-14)

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Spend Trend</h3>
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: 'var(--primary)' }} />Spend</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: 'var(--accent)' }} />Saved</span>
        </div>
      </div>
      {last7.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          No data yet
        </div>
      ) : (
        <div className="flex items-end gap-1 h-20">
          {last7.map((d, i) => {
            const costH = Math.max((d.costMicro / maxCost) * 100, 2)
            const savH  = Math.max((d.savingsMicro / maxCost) * 100, 2)
            return (
              <div key={i} className="flex-1 flex items-end gap-0.5 tooltip-wrap">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${costH}%` }}
                  transition={{ delay: i * 0.03 }}
                  className="flex-1 rounded-t"
                  style={{ background: 'var(--primary)', opacity: 0.7 }}
                />
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${savH}%` }}
                  transition={{ delay: i * 0.03 + 0.05 }}
                  className="flex-1 rounded-t"
                  style={{ background: 'var(--accent)', opacity: 0.7 }}
                />
                <div className="tooltip-box">{d.date}<br />Spend: {usd(d.costMicro)}<br />Saved: {usd(d.savingsMicro)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SpendPage() {
  const [data, setData] = useState<SpendData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d')

  const load = useCallback(() => {
    fetch(`/api/analytics/spend?period=${period}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
    </div>
  )

  const d = data ?? {
    totalCostMicro: 0, spentTodayMicro: 0, savingsTotalMicro: 0,
    requestsTotal: 0, byModel: [], byDay: [], byReason: [],
  }

  const maxModel = Math.max(...d.byModel.map(m => m.costMicro), 1)

  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Spend</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            AI cost breakdown and trends
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['7d', '30d', 'all'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`}>
              {p === '7d' ? 'Last 7 days' : p === '30d' ? 'Last 30 days' : 'All time'}
            </button>
          ))}
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Spend',   value: usd(d.totalCostMicro),    icon: DollarSign,   color: 'var(--foreground)' },
          { label: 'Total Saved',   value: usd(d.savingsTotalMicro), icon: TrendingDown, color: 'var(--accent)' },
          { label: 'Requests',      value: d.requestsTotal.toLocaleString(), icon: BarChart3, color: 'var(--foreground)' },
          { label: 'Avg per Req',   value: d.requestsTotal > 0 ? usdFull(d.totalCostMicro / d.requestsTotal) : '$0', icon: TrendingUp, color: 'var(--foreground)' },
        ].map((item, i) => (
          <motion.div key={item.label}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <p className="section-title mb-0">{item.label}</p>
              <item.icon className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
            </div>
            <p className="text-2xl font-semibold tabular" style={{ color: item.color }}>{item.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Trend + By Model */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SpendTrend data={d.byDay} />

        {/* By Model */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Spend by Model</h3>
          {d.byModel.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--muted-foreground)' }}>No data yet</p>
          ) : (
            <div className="space-y-3">
              {d.byModel.sort((a, b) => b.costMicro - a.costMicro).map(m => (
                <HorizBar key={m.model}
                  label={m.model}
                  value={m.costMicro}
                  max={maxModel}
                  sub={`${m.requests}r`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* By Reason */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Routing Breakdown</h3>
        {d.byReason.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--muted-foreground)' }}>No data yet</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reason</th>
                  <th className="text-right">Requests</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {d.byReason.map(r => (
                  <tr key={r.reason} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td>
                      <span className={`badge ${
                        r.reason === 'CACHE_HIT' ? 'badge-blue' :
                        r.reason === 'COMPLEXITY_LOW' ? 'badge-green' :
                        r.reason === 'BUDGET_GUARD' ? 'badge-red' : 'badge-gray'
                      }`}>
                        {r.reason.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="text-right tabular text-xs">{r.count.toLocaleString()}</td>
                    <td className="text-right tabular text-xs">{usd(r.costMicro)}</td>
                    <td className="text-right tabular text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {d.requestsTotal > 0 ? `${Math.round((r.count / d.requestsTotal) * 100)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
