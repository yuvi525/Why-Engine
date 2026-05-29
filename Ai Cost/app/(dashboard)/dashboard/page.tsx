'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Zap, DollarSign, Activity,
  AlertTriangle, ArrowRight, RefreshCw, BarChart3, Clock, Shield
} from 'lucide-react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────
interface Stats {
  savingsTodayMicro: number
  spentTodayMicro: number
  baselineTodayMicro: number
  requestsToday: number
  savingsTotalMicro: number
  totalCostMicro: number
  dailyLimitMicro: number
  savingsThisMonthMicro: number
  streakDays: number
  totalRevenueMicro: number
  marginMicro: number
  marginStatus: string
}

interface Log {
  id: string
  model: string
  reasonCode: string
  savingsMicro: number
  actualCostMicro: number
  baselineCostMicro: number
  savingsPct: number
  promptPreview: string | null
  createdAt: string
  latencyMs: number | null
  why?: { why: string; impact: string; action: string }
}

// ── Formatters ──────────────────────────────────────────────────────────────
const usd = (micro: number, dec = 4) => `$${(micro / 1e6).toFixed(dec)}`
const usdShort = (micro: number) => {
  const v = micro / 1e6
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`
  if (v >= 1) return `$${v.toFixed(2)}`
  return `$${v.toFixed(4)}`
}
const pct = (micro: number, base: number) =>
  base > 0 ? Math.round((micro / base) * 100) : 0

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60)  return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

// ── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, change, changeLabel, icon: Icon, accent, delay = 0 }: {
  label: string; value: string; sub?: string;
  change?: number; changeLabel?: string;
  icon: React.ElementType; accent?: 'green' | 'red' | 'blue' | 'default'; delay?: number;
}) {
  const accentColor = {
    green: 'var(--accent)', red: 'var(--destructive)',
    blue: 'var(--primary)', default: 'var(--muted-foreground)',
  }[accent ?? 'default']

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="stat-card"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="section-title mb-0">{label}</p>
        <div className="w-7 h-7 rounded flex items-center justify-center"
          style={{ background: 'var(--secondary)' }}>
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
        </div>
      </div>
      <p className="text-2xl font-semibold tabular" style={{ color: 'var(--foreground)' }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{sub}</p>}
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {change >= 0
            ? <TrendingUp className="w-3 h-3" style={{ color: 'var(--accent)' }} />
            : <TrendingDown className="w-3 h-3" style={{ color: 'var(--destructive)' }} />}
          <span className="text-xs font-medium" style={{ color: change >= 0 ? 'var(--accent)' : 'var(--destructive)' }}>
            {change >= 0 ? '+' : ''}{change}%
          </span>
          {changeLabel && <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{changeLabel}</span>}
        </div>
      )}
    </motion.div>
  )
}

// ── Budget Gauge ─────────────────────────────────────────────────────────────
function BudgetGauge({ spent, limit }: { spent: number; limit: number }) {
  const p = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
  const status = p >= 90 ? 'critical' : p >= 70 ? 'warning' : 'ok'
  const colors = { ok: 'var(--accent)', warning: 'var(--warning)', critical: 'var(--destructive)' }

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-3">
        <p className="section-title mb-0">Daily Budget</p>
        <span className={`badge ${status === 'ok' ? 'badge-green' : status === 'warning' ? 'badge-amber' : 'badge-red'}`}>
          {p.toFixed(0)}%
        </span>
      </div>
      <p className="text-2xl font-semibold tabular" style={{ color: 'var(--foreground)' }}>
        {usdShort(spent)}
      </p>
      <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--muted-foreground)' }}>
        of {usdShort(limit)} limit
      </p>
      <div className="progress-track h-1.5">
        <motion.div
          className="progress-fill h-1.5"
          initial={{ width: 0 }}
          animate={{ width: `${p}%` }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
          style={{ background: colors[status] }}
        />
      </div>
    </div>
  )
}

// ── Recent activity row ─────────────────────────────────────────────────────
function ActivityRow({ log, onClick }: { log: Log; onClick: () => void }) {
  const isSaved = log.savingsMicro > 0
  const isCache = log.reasonCode === 'CACHE_HIT'

  return (
    <tr className="cursor-pointer" onClick={onClick}
      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="dot dot-green" />
          <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="badge badge-gray font-mono">{log.model.replace('gpt-', 'GPT-').replace('claude-3-5-', 'Claude ')}</span>
      </td>
      <td className="py-3 px-4">
        <span className={`badge ${
          isCache ? 'badge-blue' :
          log.reasonCode === 'COMPLEXITY_LOW' ? 'badge-green' :
          log.reasonCode === 'COMPLEXITY_HIGH' ? 'badge-amber' :
          log.reasonCode === 'BUDGET_GUARD' ? 'badge-red' : 'badge-gray'
        }`}>
          {isCache ? 'Cache' : log.reasonCode.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <span className="text-xs font-mono" style={{ color: 'var(--foreground)' }}>{usd(log.actualCostMicro, 5)}</span>
      </td>
      <td className="py-3 px-4 text-right">
        {isSaved
          ? <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>+{usd(log.savingsMicro, 5)}</span>
          : <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>—</span>}
      </td>
      <td className="py-3 px-4 text-right">
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>WHY →</span>
      </td>
    </tr>
  )
}

// ── WHY Drawer ──────────────────────────────────────────────────────────────
function WHYDrawer({ log, onClose }: { log: Log | null; onClose: () => void }) {
  if (!log) return null
  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm overflow-y-auto"
        style={{ background: 'var(--card)', borderLeft: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold">Decision Detail</h3>
          <button onClick={onClose} className="text-lg leading-none" style={{ color: 'var(--muted-foreground)' }}>×</button>
        </div>
        <div className="p-4 space-y-4">
          {/* Meta */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-gray font-mono">{log.model}</span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{new Date(log.createdAt).toLocaleString()}</span>
          </div>

          {/* Cost grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Paid', value: usd(log.actualCostMicro, 6), color: 'var(--foreground)' },
              { label: 'Baseline', value: usd(log.baselineCostMicro, 6), color: 'var(--muted-foreground)' },
              { label: 'Saved', value: usd(log.savingsMicro, 6), color: 'var(--accent)' },
            ].map(item => (
              <div key={item.label} className="rounded p-2.5 text-center" style={{ background: 'var(--secondary)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>{item.label}</p>
                <p className="text-xs font-mono font-semibold" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Prompt preview */}
          {log.promptPreview && (
            <div className="rounded p-3" style={{ background: 'var(--secondary)' }}>
              <p className="section-title mb-1">Prompt</p>
              <p className="text-sm italic" style={{ color: 'var(--muted-foreground)' }}>"{log.promptPreview}…"</p>
            </div>
          )}

          {/* WHY */}
          {log.why && (
            <div className="why-card p-4 space-y-3">
              {[
                { label: '🧠 WHY', content: log.why.why },
                { label: '💰 Impact', content: log.why.impact },
                { label: '⚡ Action', content: log.why.action },
              ].map(item => (
                <div key={item.label}>
                  <p className="section-title mb-1">{item.label}</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--secondary-foreground)' }}>{item.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Latency */}
          {log.latencyMs && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{log.latencyMs}ms latency</span>
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [logs, setLogs]   = useState<Log[]>([])
  const [plan, setPlan]   = useState('free')
  const [role, setRole]   = useState('customer')
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [selected, setSelected] = useState<Log | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const load = useCallback(() => {
    Promise.all([fetch('/api/decisions?limit=25'), fetch('/api/settings')])
      .then(async ([dRes, sRes]) => {
        if (dRes.status === 401) { window.location.href = '/login'; return }
        const [d, s] = await Promise.all([dRes.json(), sRes.ok ? sRes.json() : { plan: 'free', role: 'customer' }])
        setStats(d.stats)
        setLogs(d.logs ?? [])
        setPlan(s.plan ?? 'free')
        setRole(s.role ?? 'customer')
        setLastFetch(new Date())
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  // Loading
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3" style={{ color: 'var(--muted-foreground)' }}>
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading overview…</span>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-2">
        <AlertTriangle className="w-8 h-8 mx-auto" style={{ color: 'var(--destructive)' }} />
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{error}</p>
        <button onClick={load} className="btn btn-secondary btn-sm">Retry</button>
      </div>
    </div>
  )

  const s = stats ?? {
    savingsTodayMicro: 0, spentTodayMicro: 0, baselineTodayMicro: 0,
    requestsToday: 0, savingsTotalMicro: 0, totalCostMicro: 0,
    dailyLimitMicro: 5_000_000, savingsThisMonthMicro: 0, streakDays: 0,
    totalRevenueMicro: 0, marginMicro: 0, marginStatus: 'break_even',
  }

  const savingsPct = pct(s.savingsTodayMicro, s.baselineTodayMicro)
  const cacheHits  = logs.filter(l => l.reasonCode === 'CACHE_HIT').length
  const avgLatency = logs.filter(l => l.latencyMs).reduce((a, l) => a + (l.latencyMs ?? 0), 0) / Math.max(logs.filter(l => l.latencyMs).length, 1)

  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Your AI cost control command center
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastFetch && (
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Updated {timeAgo(lastFetch.toISOString())}
            </span>
          )}
          <button onClick={load} className="btn btn-secondary btn-sm">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Spend Today"
          value={usdShort(s.spentTodayMicro)}
          sub={`baseline ${usdShort(s.baselineTodayMicro)}`}
          icon={DollarSign}
          accent="default"
          delay={0}
        />
        <StatCard
          label="Saved Today"
          value={usdShort(s.savingsTodayMicro)}
          sub={`${savingsPct}% reduction`}
          icon={TrendingDown}
          accent="green"
          delay={0.05}
          change={savingsPct}
          changeLabel="vs baseline"
        />
        <StatCard
          label="Requests Today"
          value={s.requestsToday.toLocaleString()}
          sub={cacheHits > 0 ? `${cacheHits} cache hits` : 'live routing'}
          icon={Activity}
          accent="blue"
          delay={0.1}
        />
        <StatCard
          label="Saved This Month"
          value={usdShort(s.savingsThisMonthMicro)}
          sub={`${s.streakDays} day streak 🔥`}
          icon={BarChart3}
          accent="green"
          delay={0.15}
        />
      </div>

      {/* ── Budget + Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BudgetGauge spent={s.spentTodayMicro} limit={s.dailyLimitMicro} />

        {/* Quick stats */}
        <div className="stat-card">
          <p className="section-title">Performance</p>
          <div className="space-y-3">
            {[
              { label: 'Avg Latency', value: avgLatency > 0 ? `${avgLatency.toFixed(0)}ms` : '—', color: 'var(--foreground)' },
              { label: 'Cache Rate', value: logs.length > 0 ? `${Math.round((cacheHits / logs.length) * 100)}%` : '—', color: 'var(--accent)' },
              { label: 'Total Saved', value: usdShort(s.savingsTotalMicro), color: 'var(--accent)' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{row.label}</span>
                <span className="text-sm font-medium tabular" style={{ color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* WHY summary */}
        <div className="why-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>WHY Engine</p>
          </div>
          {logs[0]?.why ? (
            <div className="space-y-2">
              <p className="text-xs leading-relaxed" style={{ color: 'var(--secondary-foreground)' }}>
                {logs[0].why.why}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--accent)' }}>
                {logs[0].why.action}
              </p>
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Make a proxied request to see WHY explanations here.
            </p>
          )}
          <Link href="/why" className="flex items-center gap-1 mt-3 text-xs font-medium" style={{ color: 'var(--primary)' }}>
            View WHY Engine <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── Quick actions banner for no key ── */}
      {role !== 'owner' && plan === 'free' && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 rounded-lg"
          style={{ background: 'var(--primary-muted)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <Shield className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>
            You're on the Free plan — <span style={{ color: 'var(--primary)' }}>50 req/day, $5 budget cap.</span>
          </p>
          <Link href="/pricing" className="btn btn-sm ml-auto" style={{ background: 'var(--primary)', color: 'white' }}>
            Upgrade
          </Link>
        </motion.div>
      )}

      {/* ── Recent Requests ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Recent Requests</h2>
          <Link href="/spend" className="text-xs flex items-center gap-1" style={{ color: 'var(--primary)' }}>
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {logs.length === 0 ? (
          <div className="empty-state card">
            <Zap className="w-8 h-8 mb-3" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>No requests yet</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Route your AI calls through Vela to see cost data here.
            </p>
            <Link href="/settings" className="btn btn-primary btn-sm mt-4">Configure API Key</Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Model</th>
                  <th>Reason</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Saved</th>
                  <th className="text-right">Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 15).map(log => (
                  <ActivityRow key={log.id} log={log} onClick={() => setSelected(log)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* WHY Drawer */}
      {selected && <WHYDrawer log={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
