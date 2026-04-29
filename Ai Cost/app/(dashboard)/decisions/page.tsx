'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ListTree, Zap } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'

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

const reasonColors: Record<string, string> = {
  COMPLEXITY_LOW:  'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50',
  COMPLEXITY_HIGH: 'bg-amber-900/30 text-amber-400 border border-amber-900/50',
  CACHE_HIT:       'bg-blue-900/30 text-blue-400 border border-blue-900/50',
  BUDGET_GUARD:    'bg-red-900/30 text-red-400 border border-red-900/50',
  USER_OVERRIDE:   'bg-purple-900/30 text-purple-400 border border-purple-900/50',
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 overflow-y-auto shadow-2xl"
          >
            <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-card">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground text-sm">Why Drawer</h3>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none transition">×</button>
            </div>

            <div className="p-5 space-y-5">
              {/* Meta */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono bg-secondary text-secondary-foreground px-2.5 py-1 rounded-lg">{log.model}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${reasonColors[log.reasonCode] ?? 'bg-secondary text-muted-foreground'}`}>
                  {log.reasonCode.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>

              {/* Prompt */}
              {log.promptPreview && (
                <div className="bg-secondary/60 rounded-xl p-4 border border-border/50">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Prompt</p>
                  <p className="text-sm text-foreground/80 italic">"{log.promptPreview}"</p>
                </div>
              )}

              {/* Cost breakdown */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Actual', val: `$${(log.actualCostMicro / 1e6).toFixed(5)}`, cls: 'text-foreground' },
                  { label: 'Baseline', val: `$${(log.baselineCostMicro / 1e6).toFixed(5)}`, cls: 'text-muted-foreground line-through' },
                  { label: 'Saved', val: `$${(log.savingsMicro / 1e6).toFixed(5)}`, cls: 'text-primary font-bold' },
                ].map(item => (
                  <div key={item.label} className="bg-secondary/50 border border-border/50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
                    <p className={`text-xs font-bold tabular-nums ${item.cls}`}>{item.val}</p>
                  </div>
                ))}
              </div>

              {/* Savings pct */}
              <div className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-xl p-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold text-sm">{log.savingsPct}%</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Cost Reduction</p>
                  <p className="text-xs text-muted-foreground">vs. always using GPT-4o baseline</p>
                </div>
              </div>

              {/* WHY sections */}
              {log.why && (
                <div className="space-y-3">
                  {[
                    { emoji: '🧠', label: 'Why', content: log.why.why, accent: false },
                    { emoji: '💰', label: 'Impact', content: log.why.impact, accent: true },
                    { emoji: '⚡', label: 'Action', content: log.why.action, accent: false },
                  ].map(section => (
                    <div
                      key={section.label}
                      className={`rounded-xl p-4 border ${
                        section.accent
                          ? 'bg-primary/5 border-primary/15'
                          : 'bg-secondary/50 border-border/50'
                      }`}
                    >
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                        {section.emoji} {section.label}
                      </p>
                      <p className="text-sm text-foreground/90 leading-relaxed">{section.content}</p>
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

export default function DecisionsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [selected, setSelected] = useState<Log | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/decisions?limit=50')
      .then(r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'auth' : `Error ${r.status}`)
        return r.json()
      })
      .then(data => setLogs(data.logs || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ListTree className="w-7 h-7 text-primary" />
          Decision Feed
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Every routing decision made by Vela Autopilot.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        {loading && (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Loading decisions...</p>
          </div>
        )}

        {!loading && error && (
          <div className="p-12 text-center">
            <p className="text-destructive text-sm">{error === 'auth' ? 'Please sign in to view decisions.' : error}</p>
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium text-sm">No decisions logged yet</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Send a request through the Vela proxy to begin.</p>
          </div>
        )}

        {!loading && logs.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {['Time', 'Model', 'Reason', 'Tokens', 'Saved', ''].map(h => (
                  <th key={h} className={`px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${h === 'Saved' || h === '' ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.035, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => setSelected(log)}
                  className="border-b border-border/30 hover:bg-secondary/40 cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-mono bg-secondary text-secondary-foreground px-2 py-1 rounded-lg">{log.model}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${reasonColors[log.reasonCode] ?? 'bg-secondary text-muted-foreground'}`}>
                      {log.reasonCode.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-muted-foreground tabular-nums">
                    {((log.actualCostMicro > 0 ? log.actualCostMicro : 0) / 1e6 * 1000).toFixed(3)}k
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-primary text-sm tabular-nums">
                    +${(log.savingsMicro / 1e6).toFixed(5)}
                  </td>
                  <td className="px-5 py-4 text-right text-xs text-muted-foreground group-hover:text-primary transition-colors">
                    WHY →
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      <WhyPanel log={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
