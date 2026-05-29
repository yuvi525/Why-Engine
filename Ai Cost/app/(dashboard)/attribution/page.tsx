'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitBranch, RefreshCw, Users, Tag, DollarSign, TrendingDown } from 'lucide-react'

interface AttributionData {
  byCustomer: { id: string; requests: number; costMicro: number; savingsMicro: number }[]
  byFeature:  { id: string; requests: number; costMicro: number; savingsMicro: number }[]
  byApiKey:   { prefix: string; label?: string; requests: number; costMicro: number }[]
  total:      { requests: number; costMicro: number; savingsMicro: number }
}

const usd = (micro: number) => `$${(micro / 1e6).toFixed(4)}`
const usdS = (micro: number) => `$${(micro / 1e6).toFixed(2)}`

function AttributionTable({ rows, keyLabel, colorize = false }: {
  rows: { key: string; requests: number; costMicro: number; savingsMicro: number }[]
  keyLabel: string
  colorize?: boolean
}) {
  const maxCost = Math.max(...rows.map(r => r.costMicro), 1)

  if (rows.length === 0) return (
    <div className="empty-state">
      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        No attribution data. Pass <code className="px-1 rounded" style={{ background: 'var(--secondary)' }}>customer_id</code> or <code className="px-1 rounded" style={{ background: 'var(--secondary)' }}>feature_id</code> in your API request body.
      </p>
    </div>
  )

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>{keyLabel}</th>
          <th className="text-right">Requests</th>
          <th className="text-right">Cost</th>
          <th className="text-right">Saved</th>
          <th className="text-right">Share</th>
        </tr>
      </thead>
      <tbody>
        {rows.sort((a, b) => b.costMicro - a.costMicro).map(row => {
          const share = Math.round((row.costMicro / maxCost) * 100)
          return (
            <tr key={row.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <td>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono" style={{ color: 'var(--foreground)' }}>{row.key || '(unset)'}</span>
                </div>
              </td>
              <td className="text-right text-xs tabular" style={{ color: 'var(--muted-foreground)' }}>
                {row.requests.toLocaleString()}
              </td>
              <td className="text-right text-xs font-mono tabular" style={{ color: 'var(--foreground)' }}>
                {usdS(row.costMicro)}
              </td>
              <td className="text-right text-xs font-mono tabular" style={{ color: 'var(--accent)' }}>
                {usdS(row.savingsMicro)}
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 progress-track h-1">
                    <div className="progress-fill h-1" style={{ width: `${share}%`, background: 'var(--primary)' }} />
                  </div>
                  <span className="text-xs tabular w-6" style={{ color: 'var(--muted-foreground)' }}>{share}%</span>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function AttributionPage() {
  const [data, setData] = useState<AttributionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'customer' | 'feature' | 'apikey'>('customer')

  const load = useCallback(() => {
    fetch('/api/analytics/attribution')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
    </div>
  )

  const d = data ?? { byCustomer: [], byFeature: [], byApiKey: [], total: { requests: 0, costMicro: 0, savingsMicro: 0 } }

  const tabs = [
    { key: 'customer', label: 'By Customer',  icon: Users,      data: d.byCustomer.map(r => ({ key: r.id, ...r })) },
    { key: 'feature',  label: 'By Feature',   icon: Tag,        data: d.byFeature.map(r => ({ key: r.id, ...r })) },
    { key: 'apikey',   label: 'By API Key',   icon: GitBranch,  data: d.byApiKey.map(r => ({ key: r.prefix + (r.label ? ` (${r.label})` : ''), requests: r.requests, costMicro: r.costMicro, savingsMicro: 0 })) },
  ] as const

  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Attribution</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Understand who and what is driving AI spend
          </p>
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Requests', value: d.total.requests.toLocaleString(), icon: GitBranch },
          { label: 'Total Cost',     value: usdS(d.total.costMicro),          icon: DollarSign },
          { label: 'Total Saved',    value: usdS(d.total.savingsMicro),       icon: TrendingDown },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <p className="section-title mb-0">{item.label}</p>
              <item.icon className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
            </div>
            <p className="text-2xl font-semibold tabular" style={{ color: 'var(--foreground)' }}>{item.value}</p>
          </motion.div>
        ))}
      </div>

      {/* How to guide */}
      <div className="card p-4">
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--foreground)' }}>How to enable attribution</p>
        <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
          Add <code>customer_id</code> and <code>feature_id</code> to your API requests:
        </p>
        <pre className="text-xs p-3 rounded overflow-x-auto" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
{`{
  "model": "gpt-4o",
  "messages": [...],
  "customer_id": "acme-corp",
  "feature_id": "search"
}`}
        </pre>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors"
              style={{
                color: tab === t.key ? 'var(--foreground)' : 'var(--muted-foreground)',
                borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              }}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              <span className="badge badge-gray ml-1">{t.data.length}</span>
            </button>
          ))}
        </div>
        <div className="p-0">
          <AnimatePresence mode="wait">
            <motion.div key={tab}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}>
              <AttributionTable
                rows={tabs.find(t2 => t2.key === tab)!.data}
                keyLabel={tab === 'customer' ? 'Customer ID' : tab === 'feature' ? 'Feature ID' : 'API Key'}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
