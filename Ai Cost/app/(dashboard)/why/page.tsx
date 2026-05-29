'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, ArrowRight, Brain, DollarSign, Activity } from 'lucide-react'

interface WHYInsight {
  id: string
  type: 'cost_spike' | 'savings_opportunity' | 'model_inefficiency' | 'cache_opportunity' | 'anomaly'
  severity: 'info' | 'warning' | 'critical'
  title: string
  why: string
  impact: string
  action: string
  potentialSavingsMicro?: number
  affectedRequests?: number
  metric?: number
  metricLabel?: string
  createdAt: string
}

interface WHYSummary {
  spendChange: number        // % change vs last period
  topDriver: string
  topDriverPct: number
  savingsOpportunityMicro: number
  insightCount: number
  insights: WHYInsight[]
}

const usd = (micro: number) => `$${(micro / 1e6).toFixed(2)}`

function InsightCard({ insight, delay = 0 }: { insight: WHYInsight; delay?: number }) {
  const [expanded, setExpanded] = useState(false)

  const config = {
    critical: { border: 'var(--destructive)', accent: 'var(--destructive)', badge: 'badge-red', icon: AlertTriangle },
    warning:  { border: 'var(--warning)',     accent: 'var(--warning)',     badge: 'badge-amber', icon: TrendingUp },
    info:     { border: 'var(--primary)',     accent: 'var(--primary)',     badge: 'badge-blue', icon: Brain },
  }[insight.severity]

  const typeLabel: Record<string, string> = {
    cost_spike:          'Cost Spike',
    savings_opportunity: 'Savings Opportunity',
    model_inefficiency:  'Model Inefficiency',
    cache_opportunity:   'Cache Opportunity',
    anomaly:             'Anomaly',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="why-card cursor-pointer"
      style={{ borderLeftColor: config.border }}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: `rgba(${config.accent === 'var(--destructive)' ? '239,68,68' : config.accent === 'var(--warning)' ? '245,158,11' : '99,102,241'},0.12)` }}>
              <config.icon className="w-4 h-4" style={{ color: config.accent }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{insight.title}</span>
                <span className={`badge ${config.badge}`}>{typeLabel[insight.type] ?? insight.type}</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {insight.why}
              </p>
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            {insight.potentialSavingsMicro !== undefined && insight.potentialSavingsMicro > 0 && (
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                  {usd(insight.potentialSavingsMicro)}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>potential savings</p>
              </div>
            )}
            {insight.metric !== undefined && (
              <div>
                <p className="text-sm font-semibold tabular" style={{ color: config.accent }}>
                  {insight.metric > 0 ? '+' : ''}{insight.metric.toFixed(0)}%
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{insight.metricLabel ?? 'change'}</p>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-3 overflow-hidden"
            >
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { label: '🧠 WHY', content: insight.why },
                    { label: '💰 Impact', content: insight.impact },
                    { label: '⚡ Recommended Action', content: insight.action },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg p-3" style={{ background: 'var(--secondary)' }}>
                      <p className="section-title mb-1">{item.label}</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--secondary-foreground)' }}>
                        {item.content}
                      </p>
                    </div>
                  ))}
                </div>

                {insight.affectedRequests && (
                  <p className="text-xs mt-3" style={{ color: 'var(--muted-foreground)' }}>
                    <Activity className="w-3 h-3 inline mr-1" />
                    Affects {insight.affectedRequests.toLocaleString()} requests
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {new Date(insight.createdAt).toLocaleDateString()}
          </span>
          <span className="text-xs" style={{ color: 'var(--primary)' }}>
            {expanded ? 'Less ↑' : 'See analysis ↓'}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

function SummaryBanner({ summary }: { summary: WHYSummary }) {
  const isIncrease = summary.spendChange > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary-muted)' }}>
          <Brain className="w-5 h-5" style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>WHY Engine Analysis</h2>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Automated spend intelligence — updated every 6 hours</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="section-title">Spend Change</p>
          <div className="flex items-center gap-1.5">
            {isIncrease
              ? <TrendingUp className="w-4 h-4" style={{ color: 'var(--destructive)' }} />
              : <TrendingDown className="w-4 h-4" style={{ color: 'var(--accent)' }} />}
            <span className="text-xl font-semibold tabular"
              style={{ color: isIncrease ? 'var(--destructive)' : 'var(--accent)' }}>
              {isIncrease ? '+' : ''}{summary.spendChange.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>vs prior period</p>
        </div>

        <div>
          <p className="section-title">Top Driver</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {summary.topDriver || 'N/A'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {summary.topDriverPct > 0 ? `${summary.topDriverPct}% of spend` : '—'}
          </p>
        </div>

        <div>
          <p className="section-title">Savings Opportunity</p>
          <p className="text-xl font-semibold" style={{ color: 'var(--accent)' }}>
            {usd(summary.savingsOpportunityMicro)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>per month if actioned</p>
        </div>

        <div>
          <p className="section-title">Insights Found</p>
          <p className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>{summary.insightCount}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>actionable recommendations</p>
        </div>
      </div>
    </motion.div>
  )
}

export default function WHYEnginePage() {
  const [summary, setSummary] = useState<WHYSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')

  const load = useCallback(() => {
    fetch('/api/analytics/why')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSummary(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3" style={{ color: 'var(--muted-foreground)' }}>
        <Brain className="w-4 h-4 animate-pulse" />
        <span className="text-sm">Analysing spend patterns…</span>
      </div>
    </div>
  )

  const insights = summary?.insights ?? []
  const filtered = filter === 'all' ? insights : insights.filter(i => i.severity === filter)

  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>WHY Engine</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Understand what happened, why, and what to do about it
          </p>
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary banner */}
      {summary && <SummaryBanner summary={summary} />}

      {/* How it works — shown when no data */}
      {insights.length === 0 && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-6 h-6" style={{ color: 'var(--primary)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              How WHY Engine Works
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Detects patterns', desc: 'Analyses your request history for spend spikes, anomalies, and inefficiencies automatically.' },
              { step: '2', title: 'Explains the cause', desc: 'Identifies which model, feature, or customer is driving unexpected cost changes.' },
              { step: '3', title: 'Recommends action', desc: 'Suggests specific routing changes, budget adjustments, or caching improvements with projected savings.' },
            ].map(item => (
              <div key={item.step} className="flex gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}>
                  {item.step}
                </span>
                <div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--foreground)' }}>{item.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--secondary)' }}>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              WHY insights appear after sufficient request history (typically 24–48 hours of usage).
              Make sure you're routing requests through Vela.
            </p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {insights.length > 0 && (
        <div className="flex items-center gap-2">
          {([
            { key: 'all',      label: 'All',      count: insights.length },
            { key: 'critical', label: 'Critical', count: insights.filter(i => i.severity === 'critical').length },
            { key: 'warning',  label: 'Warning',  count: insights.filter(i => i.severity === 'warning').length },
            { key: 'info',     label: 'Info',     count: insights.filter(i => i.severity === 'info').length },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`btn btn-sm ${filter === tab.key ? 'btn-primary' : 'btn-secondary'}`}>
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 text-xs opacity-70">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Insights list */}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((insight, i) => (
            <InsightCard key={insight.id} insight={insight} delay={i * 0.05} />
          ))}
        </div>
      )}

      {filtered.length === 0 && insights.length > 0 && (
        <div className="empty-state card">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            No {filter} insights found.
          </p>
        </div>
      )}
    </div>
  )
}
