'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Plus, Trash2, RefreshCw, AlertTriangle, CheckCircle2, Info, ToggleLeft, ToggleRight } from 'lucide-react'

interface AlertRule {
  id: string
  name: string
  type: 'spend_spike' | 'budget_threshold' | 'anomaly' | 'daily_limit'
  threshold: number      // percentage or USD amount depending on type
  windowMinutes: number  // look-back window
  enabled: boolean
  channels: string[]     // ['dashboard', 'email']
  lastTriggered?: string
  triggerCount: number
  createdAt: string
}

interface FiredAlert {
  id: string
  ruleId: string
  ruleName: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  value: number
  threshold: number
  firedAt: string
  acknowledged: boolean
}

const ALERT_TYPES = [
  { key: 'spend_spike',      label: 'Spend Spike',     desc: 'Alert when spend increases by X% vs prior period' },
  { key: 'budget_threshold', label: 'Budget Threshold', desc: 'Alert when budget usage reaches X%' },
  { key: 'anomaly',          label: 'Usage Anomaly',   desc: 'Alert when request volume deviates significantly' },
  { key: 'daily_limit',      label: 'Daily Limit',     desc: 'Alert when daily spend exceeds $X' },
] as const

function AlertRuleCard({ rule, onToggle, onDelete }: {
  rule: AlertRule; onToggle: (id: string, e: boolean) => void; onDelete: (id: string) => void
}) {
  const typeLabel: Record<string, string> = {
    spend_spike: 'Spend Spike', budget_threshold: 'Budget', anomaly: 'Anomaly', daily_limit: 'Daily'
  }
  const typeBadge: Record<string, string> = {
    spend_spike: 'badge-amber', budget_threshold: 'badge-purple', anomaly: 'badge-blue', daily_limit: 'badge-red'
  }

  return (
    <div className="card p-4 card-hover">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{rule.name}</span>
            <span className={`badge ${typeBadge[rule.type] ?? 'badge-gray'}`}>{typeLabel[rule.type] ?? rule.type}</span>
            {!rule.enabled && <span className="badge badge-gray">Disabled</span>}
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Threshold: {rule.type === 'daily_limit' ? `$${rule.threshold}` : `${rule.threshold}%`}
            {' '}• Window: {rule.windowMinutes}m
            {' '}• Channels: {rule.channels.join(', ')}
          </p>
          {rule.lastTriggered && (
            <p className="text-xs mt-1" style={{ color: 'var(--warning)' }}>
              Last triggered: {new Date(rule.lastTriggered).toLocaleString()} ({rule.triggerCount}× total)
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 ml-4">
          <button onClick={() => onToggle(rule.id, !rule.enabled)} className="btn btn-ghost btn-sm p-1.5">
            {rule.enabled
              ? <ToggleRight className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              : <ToggleLeft className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />}
          </button>
          <button onClick={() => onDelete(rule.id)} className="btn btn-ghost btn-sm p-1.5"
            style={{ color: 'var(--destructive)' }}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function FiredAlertCard({ alert, onAck }: { alert: FiredAlert; onAck: (id: string) => void }) {
  const colors = {
    critical: { border: 'var(--destructive)', bg: 'var(--destructive-muted)', icon: AlertTriangle, color: 'var(--destructive)' },
    warning:  { border: 'var(--warning)',     bg: 'var(--warning-muted)',     icon: AlertTriangle, color: 'var(--warning)' },
    info:     { border: 'var(--primary)',     bg: 'var(--primary-muted)',     icon: Info,           color: 'var(--primary)' },
  }[alert.severity]

  return (
    <div className="alert-bar" style={{ borderColor: colors.border, background: colors.bg,
      opacity: alert.acknowledged ? 0.5 : 1 }}>
      <colors.icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: colors.color }} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{alert.ruleName}</span>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {new Date(alert.firedAt).toLocaleString()}
          </span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--secondary-foreground)' }}>{alert.message}</p>
      </div>
      {!alert.acknowledged && (
        <button onClick={() => onAck(alert.id)} className="btn btn-ghost btn-sm p-1" title="Acknowledge">
          <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        </button>
      )}
    </div>
  )
}

function AlertModal({ onClose, onSave }: { onClose: () => void; onSave: (r: Partial<AlertRule>) => void }) {
  const [form, setForm] = useState({
    name: '', type: 'spend_spike' as AlertRule['type'],
    threshold: 50, windowMinutes: 60,
    channels: ['dashboard'] as string[],
  })
  const [saving, setSaving] = useState(false)

  const toggleChannel = (ch: string) => {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter(c => c !== ch) : [...f.channels, ch],
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave({ ...form, enabled: true, triggerCount: 0 })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-xl p-6 space-y-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>

        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Create Alert Rule</h2>
          <button onClick={onClose} className="text-xl" style={{ color: 'var(--muted-foreground)' }}>×</button>
        </div>

        <div>
          <label className="section-title block mb-1">Rule Name</label>
          <input className="input" placeholder="e.g. Spend spike alert"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>

        <div>
          <label className="section-title block mb-1">Alert Type</label>
          <div className="space-y-1.5">
            {ALERT_TYPES.map(t => (
              <button key={t.key} onClick={() => setForm(f => ({ ...f, type: t.key }))}
                className="w-full text-left p-2.5 rounded-lg transition-colors"
                style={{
                  background: form.type === t.key ? 'var(--primary-muted)' : 'var(--secondary)',
                  border: `1px solid ${form.type === t.key ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{t.label}</p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="section-title block mb-1">
              Threshold {form.type === 'daily_limit' ? '($)' : '(%)'}
            </label>
            <input className="input" type="number"
              value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: parseFloat(e.target.value) }))} />
          </div>
          <div>
            <label className="section-title block mb-1">Window (minutes)</label>
            <input className="input" type="number"
              value={form.windowMinutes} onChange={e => setForm(f => ({ ...f, windowMinutes: parseInt(e.target.value) }))} />
          </div>
        </div>

        <div>
          <label className="section-title block mb-2">Delivery Channels</label>
          <div className="flex gap-2">
            {['dashboard', 'email'].map(ch => (
              <button key={ch} onClick={() => toggleChannel(ch)}
                className="btn btn-sm"
                style={{
                  background: form.channels.includes(ch) ? 'var(--primary-muted)' : 'var(--secondary)',
                  color: form.channels.includes(ch) ? 'var(--primary)' : 'var(--muted-foreground)',
                  border: `1px solid ${form.channels.includes(ch) ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                }}>
                {ch.charAt(0).toUpperCase() + ch.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name} className="btn btn-primary flex-1"
            style={{ opacity: saving || !form.name ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Create Alert'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([])
  const [fired, setFired] = useState<FiredAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(() => {
    Promise.all([fetch('/api/alerts/rules'), fetch('/api/alerts/fired')])
      .then(async ([rr, fr]) => {
        const [rd, fd] = await Promise.all([rr.ok ? rr.json() : { rules: [] }, fr.ok ? fr.json() : { alerts: [] }])
        setRules(rd.rules ?? [])
        setFired(fd.alerts ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch(`/api/alerts/rules/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) })
    setRules(r => r.map(x => x.id === id ? { ...x, enabled } : x))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this alert rule?')) return
    await fetch(`/api/alerts/rules/${id}`, { method: 'DELETE' })
    setRules(r => r.filter(x => x.id !== id))
  }

  const handleAck = async (id: string) => {
    await fetch(`/api/alerts/fired/${id}/ack`, { method: 'POST' })
    setFired(f => f.map(x => x.id === id ? { ...x, acknowledged: true } : x))
  }

  const handleSave = async (data: Partial<AlertRule>) => {
    await fetch('/api/alerts/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
    </div>
  )

  const unacked = fired.filter(f => !f.acknowledged)

  return (
    <div className="space-y-6 max-w-screen-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Alerts</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Spend spike detection and anomaly notifications
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus className="w-4 h-4" /> New Alert Rule
        </button>
      </div>

      {/* Active alerts */}
      {unacked.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
            Active Alerts <span className="badge badge-red ml-1">{unacked.length}</span>
          </h2>
          <div className="space-y-2">
            {unacked.map(a => <FiredAlertCard key={a.id} alert={a} onAck={handleAck} />)}
          </div>
        </div>
      )}

      {/* Rules */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
          Alert Rules
          {rules.length > 0 && <span className="badge badge-gray ml-2">{rules.length}</span>}
        </h2>

        {rules.length === 0 ? (
          <div className="empty-state card">
            <Bell className="w-8 h-8 mb-3" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>No alert rules</p>
            <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Create rules to be notified when AI spend spikes or anomalies occur.
            </p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
              <Plus className="w-3.5 h-3.5" /> Create First Rule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map(r => <AlertRuleCard key={r.id} rule={r} onToggle={handleToggle} onDelete={handleDelete} />)}
          </div>
        )}
      </div>

      {/* Recent history */}
      {fired.filter(f => f.acknowledged).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>Alert History</h2>
          <div className="space-y-2 opacity-60">
            {fired.filter(f => f.acknowledged).slice(0, 5).map(a => (
              <FiredAlertCard key={a.id} alert={a} onAck={() => {}} />
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showModal && <AlertModal onClose={() => setShowModal(false)} onSave={handleSave} />}
      </AnimatePresence>
    </div>
  )
}
