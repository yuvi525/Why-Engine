'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { TrendingUp, TrendingDown, DollarSign, Zap, BarChart3, AlertTriangle, ArrowUpRight } from 'lucide-react'

function fmt(micro: number): string {
  const usd = micro / 1_000_000
  if (Math.abs(usd) >= 1) return `$${usd.toFixed(2)}`
  if (Math.abs(usd) >= 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(6)}`
}

function pct(n: number): string {
  return `${n > 0 ? '+' : ''}${n}%`
}

export default function ROIPage() {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    fetch('/api/analytics/roi')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load ROI data'); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="space-y-4">
      <div className="h-8 w-48 skeleton rounded-lg" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
      </div>
      <div className="h-64 skeleton rounded-xl" />
    </div>
  )

  if (error) return (
    <div className="flex items-center gap-3 card p-6">
      <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
      <p className="text-sm text-muted-foreground">{error}</p>
    </div>
  )

  if (!data?.hasData) return (
    <div className="card p-12 text-center max-w-lg mx-auto">
      <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-foreground mb-2">No ROI data yet</h2>
      <p className="text-sm text-muted-foreground mb-6">
        ROI tracking activates once you're on a paid plan and requests flow through Vela. 
        Your revenue, cost, and margin are tracked on every request.
      </p>
      <Link href="/pricing" className="btn btn-primary inline-flex items-center gap-2">
        View Pricing <ArrowUpRight className="w-4 h-4" />
      </Link>
    </div>
  )

  const { totals, distribution, byDay, topProfitable, topUnprofitable,
          topProfitableFeatures, topUnprofitableFeatures } = data

  const totalReqs   = distribution.profit + distribution.loss + distribution.break_even
  const profitPct   = totalReqs > 0 ? Math.round((distribution.profit / totalReqs) * 100) : 0
  const lossPct     = totalReqs > 0 ? Math.round((distribution.loss / totalReqs) * 100) : 0
  const isPositive  = totals.totalMarginMicro >= 0

  // SVG bar chart helpers
  const maxBarVal   = Math.max(...byDay.map((d: any) => Math.abs(d.margin)), 1)
  const BAR_H       = 80

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">ROI Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Revenue, cost, and margin powered by real request data
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: isPositive ? 'var(--accent-muted)' : 'rgba(239,68,68,0.1)',
                   color: isPositive ? 'var(--accent)' : '#ef4444' }}>
          {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {isPositive ? 'Positive ROI' : 'Negative ROI'}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue',  value: fmt(totals.totalRevenueMicro),  sub: `${totals.requestCount} requests`, icon: DollarSign,    color: 'var(--primary)' },
          { label: 'Total Cost',     value: fmt(totals.totalCostMicro),     sub: 'AI provider spend',               icon: BarChart3,     color: 'var(--muted-foreground)' },
          { label: 'Total Margin',   value: fmt(totals.totalMarginMicro),   sub: pct(totals.marginRate) + ' margin rate', icon: TrendingUp, color: isPositive ? 'var(--accent)' : '#ef4444' },
          { label: 'Total Savings',  value: fmt(totals.totalSavingsMicro),  sub: 'vs always using GPT-4o',          icon: Zap,           color: 'var(--accent)' },
        ].map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{card.label}</p>
              <card.icon className="w-4 h-4" style={{ color: card.color }} />
            </div>
            <p className="text-2xl font-bold text-foreground" style={{ color: i === 2 ? card.color : undefined }}>
              {card.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Margin Health Bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">Margin Health</p>
          <p className="text-xs text-muted-foreground">{profitPct}% of requests are profitable</p>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
          <div style={{ width: `${profitPct}%`, background: 'var(--accent)', transition: 'width 0.8s ease' }} />
          <div style={{ width: `${lossPct}%`, background: '#ef4444', transition: 'width 0.8s ease' }} />
          <div style={{ flex: 1, background: 'var(--border)' }} />
        </div>
        <div className="flex items-center gap-4 mt-2">
          {[
            { label: 'Profitable', count: distribution.profit, color: 'var(--accent)' },
            { label: 'Loss',       count: distribution.loss,   color: '#ef4444' },
            { label: 'Break-even', count: distribution.break_even, color: 'var(--muted-foreground)' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
              <span className="text-xs text-muted-foreground">{item.label}: {item.count}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Margin Trend Chart */}
      {byDay.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          className="card p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Margin Trend (30 days)</p>
          <div className="flex items-end gap-1 h-24">
            {byDay.slice(-30).map((d: any, i: number) => {
              const h = Math.max(4, Math.round((Math.abs(d.margin) / maxBarVal) * BAR_H))
              const isPos = d.margin >= 0
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative"
                  title={`${d.date}: ${fmt(d.margin)}`}>
                  <div className="rounded-t-sm transition-opacity group-hover:opacity-80"
                    style={{ height: `${h}px`, width: '100%', minWidth: 4,
                             background: isPos ? 'var(--accent)' : '#ef4444', opacity: 0.85 }} />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">{byDay[0]?.date ?? ''}</span>
            <span className="text-xs text-muted-foreground">{byDay.at(-1)?.date ?? ''}</span>
          </div>
        </motion.div>
      )}

      {/* Top/Bottom tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Profitable customers */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }} className="card p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Top Profitable Customers</p>
          <RankTable rows={topProfitable} positive />
        </motion.div>

        {/* Unprofitable customers */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }} className="card p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Least Profitable Customers</p>
          <RankTable rows={topUnprofitable} positive={false} />
        </motion.div>

        {/* Profitable features */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }} className="card p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Top Profitable Features</p>
          <RankTable rows={topProfitableFeatures} positive />
        </motion.div>

        {/* Unprofitable features */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }} className="card p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Least Profitable Features</p>
          <RankTable rows={topUnprofitableFeatures} positive={false} />
        </motion.div>
      </div>

      {/* WHY Analysis */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        className="card p-5" style={{ borderLeft: `3px solid ${isPositive ? 'var(--accent)' : '#ef4444'}` }}>
        <p className="text-sm font-semibold text-foreground mb-2">WHY Analysis</p>
        {isPositive ? (
          <p className="text-sm text-muted-foreground">
            Strong ROI. You're generating <span className="text-accent font-semibold">{fmt(totals.totalMarginMicro)}</span> in
            total margin. Vela's routing optimization saved <span className="text-accent font-semibold">{fmt(totals.totalSavingsMicro)}</span> vs
            always using GPT-4o — directly improving your margin.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              AI costs currently exceed plan revenue. This is common at low request volumes where fixed plan revenue is amortized across fewer requests.
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="text-warning font-semibold">Recommended:</span> Enable V2 Routing in Settings to further reduce cost.
              Vela already saved <span className="font-semibold text-foreground">{fmt(totals.totalSavingsMicro)}</span> vs baseline.
              Increasing request volume will improve the margin rate.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function RankTable({ rows, positive }: { rows: any[]; positive: boolean }) {
  if (!rows || rows.length === 0) {
    return <p className="text-xs text-muted-foreground">No tagged data yet. Pass <code className="text-xs">customer_id</code> in requests.</p>
  }
  return (
    <div className="space-y-2">
      {rows.map((r: any) => (
        <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
          <div>
            <p className="text-xs font-medium text-foreground truncate max-w-[120px]">{r.id}</p>
            <p className="text-xs text-muted-foreground">{r.requests} req · {r.marginRatePct}% margin</p>
          </div>
          <p className="text-sm font-semibold tabular-nums"
            style={{ color: positive ? 'var(--accent)' : r.margin < 0 ? '#ef4444' : 'var(--foreground)' }}>
            {fmt(r.margin)}
          </p>
        </div>
      ))}
    </div>
  )
}
