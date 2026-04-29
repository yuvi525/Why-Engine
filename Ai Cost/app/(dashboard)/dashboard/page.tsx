'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Zap, ArrowUpRight, DollarSign, Activity, ChevronDown } from 'lucide-react'

interface Stats {
  savingsTodayMicro: number
  spentTodayMicro: number
  baselineTodayMicro: number
  requestsToday: number
  savingsTotalMicro: number
  dailyLimitMicro: number
  spentBudgetMicro: number
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
  why?: { why: string; impact: string; action: string }
}

function CountUp({ value, prefix = '', suffix = '', decimals = 4 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const target = value
    const duration = 1500
    const step = 16
    const increment = (target / (duration / step))
    const timer = setInterval(() => {
      start += increment
      if (start >= target) { setDisplay(target); clearInterval(timer) }
      else setDisplay(start)
    }, step)
    return () => clearInterval(timer)
  }, [value])
  return <>{prefix}{display.toFixed(decimals)}{suffix}</>
}

function StatCard({ icon, label, value, sub, delay = 0, accent = false }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; delay?: number; accent?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-2xl border p-6 ${
        accent
          ? 'bg-primary/5 border-primary/20 shadow-[0_0_32px_rgba(16,185,129,0.1)]'
          : 'bg-card border-border'
      }`}
    >
      {accent && (
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      )}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            accent ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
          }`}>
            {icon}
          </div>
          {accent && <ArrowUpRight className="w-4 h-4 text-primary" />}
        </div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-3xl font-bold tracking-tight tabular-nums ${accent ? 'text-gradient' : 'text-foreground'}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </motion.div>
  )
}

function BudgetBar({ spent, limit }: { spent: number; limit: number }) {
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
  const warning = pct > 85
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="bg-card border border-border rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Daily Budget</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${warning ? 'bg-destructive/20 text-destructive' : 'bg-primary/10 text-primary'}`}>
          {pct.toFixed(0)}% used
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-2xl font-bold text-foreground tabular-nums">${(spent / 1e6).toFixed(4)}</span>
        <span className="text-muted-foreground text-sm">/ ${(limit / 1e6).toFixed(2)}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
          className={`h-full rounded-full ${warning ? 'bg-destructive' : 'bg-primary'}`}
        />
      </div>
    </motion.div>
  )
}

function DecisionRow({ log, idx, onClick }: { log: Log; idx: number; onClick: () => void }) {
  const reasonColors: Record<string, string> = {
    COMPLEXITY_LOW: 'bg-primary/10 text-primary',
    COMPLEXITY_HIGH: 'bg-amber-900/30 text-amber-400',
    CACHE_HIT: 'bg-blue-900/30 text-blue-400',
    BUDGET_GUARD: 'bg-red-900/30 text-red-400',
    USER_OVERRIDE: 'bg-purple-900/30 text-purple-400',
  }
  const colorClass = reasonColors[log.reasonCode] ?? 'bg-secondary text-muted-foreground'

  return (
    <motion.tr
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className="border-b border-border/50 hover:bg-secondary/40 cursor-pointer transition-colors group"
    >
      <td className="px-5 py-4 text-sm text-muted-foreground font-mono">
        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </td>
      <td className="px-5 py-4">
        <span className="text-xs font-mono font-medium bg-secondary text-secondary-foreground px-2.5 py-1 rounded-lg">
          {log.model}
        </span>
      </td>
      <td className="px-5 py-4">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colorClass}`}>
          {log.reasonCode.replace(/_/g, ' ')}
        </span>
      </td>
      <td className="px-5 py-4 text-right">
        <span className="text-sm font-bold text-primary tabular-nums">
          +${(log.savingsMicro / 1e6).toFixed(5)}
        </span>
      </td>
      <td className="px-5 py-4 text-right">
        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
          WHY →
        </span>
      </td>
    </motion.tr>
  )
}

function WhyPanel({ log, onClose }: { log: Log | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {log && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border z-50 overflow-y-auto"
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Decision Detail</h3>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono bg-secondary text-secondary-foreground px-2.5 py-1 rounded-lg">{log.model}</span>
                <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
              </div>

              {log.promptPreview && (
                <div className="bg-secondary/50 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Prompt Preview</p>
                  <p className="text-sm text-foreground/80 italic">"{log.promptPreview}"</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Actual Cost', value: `$${(log.actualCostMicro / 1e6).toFixed(5)}`, color: 'text-foreground' },
                  { label: 'Baseline', value: `$${(log.baselineCostMicro / 1e6).toFixed(5)}`, color: 'text-muted-foreground line-through' },
                  { label: 'Saved', value: `$${(log.savingsMicro / 1e6).toFixed(5)}`, color: 'text-primary font-bold' },
                ].map(item => (
                  <div key={item.label} className="bg-secondary/50 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p className={`text-sm font-bold tabular-nums ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              {log.why && (
                <div className="space-y-3 mt-4">
                  {[
                    { label: '🧠 Why', content: log.why.why, bg: 'bg-secondary/50' },
                    { label: '💰 Impact', content: log.why.impact, bg: 'bg-primary/5 border border-primary/10' },
                    { label: '⚡ Action', content: log.why.action, bg: 'bg-secondary/50' },
                  ].map(item => (
                    <div key={item.label} className={`${item.bg} rounded-xl p-4`}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{item.label}</p>
                      <p className="text-sm text-foreground/90 leading-relaxed">{item.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [selectedLog, setSelectedLog] = useState<Log | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/decisions?limit=20')
      .then(r => {
        if (r.status === 401) throw new Error('auth')
        if (!r.ok) throw new Error(`API error ${r.status}`)
        return r.json()
      })
      .then(data => {
        console.log('[Dashboard] Received API Data:', data)
        setStats(data.stats)
        setLogs(data.logs || [])
      })
      .catch(err => {
        if (err.message === 'auth') setError('auth')
        else setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error === 'auth') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Session Required</h2>
          <p className="text-muted-foreground text-sm">Please log in to view your dashboard.</p>
          <a href="/login" className="inline-block px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition">
            Sign In
          </a>
        </div>
      </div>
    )
  }

  const s = stats ?? {
    savingsTodayMicro: 0, spentTodayMicro: 0, baselineTodayMicro: 0,
    requestsToday: 0, savingsTotalMicro: 0, dailyLimitMicro: 5_000_000, spentBudgetMicro: 0,
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold tracking-tight">
          Cost <span className="text-gradient">Autopilot</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">Real-time AI routing intelligence. Every request optimized.</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          accent
          icon={<TrendingUp className="w-5 h-5" />}
          label="Saved Today"
          value={`$${(s.savingsTodayMicro / 1e6).toFixed(4)}`}
          sub={`${s.requestsToday} requests routed`}
          delay={0}
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Total Spent"
          value={`$${(s.spentTodayMicro / 1e6).toFixed(4)}`}
          sub="Today's AI cost"
          delay={0.1}
        />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Requests"
          value={`${s.requestsToday}`}
          sub="Processed today"
          delay={0.2}
        />
        <StatCard
          icon={<Zap className="w-5 h-5" />}
          label="All-Time Saved"
          value={`$${(s.savingsTotalMicro / 1e6).toFixed(4)}`}
          sub="Cumulative savings"
          delay={0.3}
        />
      </div>

      {/* Budget */}
      <BudgetBar spent={s.spentBudgetMicro} limit={s.dailyLimitMicro} />

      {/* Decision Feed */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Recent Decisions</h2>
          <a href="/decisions" className="text-xs text-primary hover:underline">View all →</a>
        </div>
        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">No routing decisions yet</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Send a request through the proxy to see autopilot in action.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Model</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saved</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <DecisionRow key={log.id} log={log} idx={i} onClick={() => setSelectedLog(log)} />
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      <WhyPanel log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  )
}
