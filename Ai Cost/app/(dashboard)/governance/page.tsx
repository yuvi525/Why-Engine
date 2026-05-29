'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Plus, Trash2, RefreshCw, ToggleLeft, ToggleRight, Lock, AlertTriangle } from 'lucide-react'

interface Policy {
  id: string
  name: string
  type: 'model_restriction' | 'budget_cap' | 'rate_limit' | 'team_policy'
  enabled: boolean
  config: Record<string, unknown>
  description: string
  createdAt: string
}

const POLICY_TEMPLATES = [
  {
    name: 'Block GPT-4o on Free Tier',
    type: 'model_restriction' as const,
    description: 'Prevents free-tier users from accessing GPT-4o directly.',
    config: { blockedModels: ['gpt-4o'], applyTo: 'free' },
  },
  {
    name: 'Daily Spend Cap — $10',
    type: 'budget_cap' as const,
    description: 'Hard stop at $10 per user per day.',
    config: { limitUsd: 10, scope: 'user', period: 'daily' },
  },
  {
    name: 'Rate Limit — 100 req/hour',
    type: 'rate_limit' as const,
    description: 'Maximum 100 requests per hour per API key.',
    config: { maxRequests: 100, window: '1h' },
  },
]

function PolicyCard({ policy, onToggle, onDelete }: {
  policy: Policy; onToggle: (id: string, enabled: boolean) => void; onDelete: (id: string) => void
}) {
  const typeColors: Record<string, string> = {
    model_restriction: 'badge-red',
    budget_cap:        'badge-amber',
    rate_limit:        'badge-blue',
    team_policy:       'badge-purple',
  }
  const typeLabel: Record<string, string> = {
    model_restriction: 'Model',
    budget_cap:        'Budget',
    rate_limit:        'Rate',
    team_policy:       'Team',
  }

  return (
    <div className="card p-4 card-hover flex items-start gap-4">
      <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: policy.enabled ? 'rgba(99,102,241,0.12)' : 'var(--secondary)' }}>
        <Lock className="w-4 h-4" style={{ color: policy.enabled ? 'var(--primary)' : 'var(--muted-foreground)' }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{policy.name}</span>
          <span className={`badge ${typeColors[policy.type] ?? 'badge-gray'}`}>{typeLabel[policy.type] ?? policy.type}</span>
          {!policy.enabled && <span className="badge badge-gray">Disabled</span>}
        </div>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{policy.description}</p>

        {/* Config summary */}
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(policy.config ?? {}).map(([k, v]) => (
            <span key={k} className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
              {k}: {Array.isArray(v) ? v.join(', ') : String(v)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => onToggle(policy.id, !policy.enabled)} className="btn btn-ghost btn-sm p-1.5">
          {policy.enabled
            ? <ToggleRight className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            : <ToggleLeft className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />}
        </button>
        <button onClick={() => onDelete(policy.id)} className="btn btn-ghost btn-sm p-1.5"
          style={{ color: 'var(--destructive)' }}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function PolicyModal({ onClose, onSave }: { onClose: () => void; onSave: (p: Partial<Policy>) => void }) {
  const [selected, setSelected] = useState(0)
  const [name, setName] = useState(POLICY_TEMPLATES[0].name)
  const [description, setDescription] = useState(POLICY_TEMPLATES[0].description)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(POLICY_TEMPLATES[selected].name)
    setDescription(POLICY_TEMPLATES[selected].description)
  }, [selected])

  const handleSave = async () => {
    setSaving(true)
    const tpl = POLICY_TEMPLATES[selected]
    await onSave({ name, description, type: tpl.type, config: tpl.config, enabled: true })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl p-6 space-y-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>

        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Add Governance Policy</h2>
          <button onClick={onClose} className="text-xl" style={{ color: 'var(--muted-foreground)' }}>×</button>
        </div>

        {/* Templates */}
        <div className="space-y-2">
          <p className="section-title">Policy Template</p>
          {POLICY_TEMPLATES.map((tpl, i) => (
            <button key={i} onClick={() => setSelected(i)}
              className="w-full text-left p-3 rounded-lg transition-colors"
              style={{
                background: selected === i ? 'var(--primary-muted)' : 'var(--secondary)',
                border: `1px solid ${selected === i ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
              }}>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{tpl.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{tpl.description}</p>
            </button>
          ))}
        </div>

        <div>
          <label className="section-title block mb-1">Policy Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="section-title block mb-1">Description</label>
          <input className="input" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name} className="btn btn-primary flex-1"
            style={{ opacity: saving || !name ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Create Policy'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function GovernancePage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(() => {
    fetch('/api/governance')
      .then(r => r.ok ? r.json() : { policies: [] })
      .then(d => setPolicies(d.policies ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch(`/api/governance/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) })
    setPolicies(p => p.map(x => x.id === id ? { ...x, enabled } : x))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this policy?')) return
    await fetch(`/api/governance/${id}`, { method: 'DELETE' })
    setPolicies(p => p.filter(x => x.id !== id))
  }

  const handleSave = async (data: Partial<Policy>) => {
    await fetch('/api/governance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
    </div>
  )

  const active   = policies.filter(p => p.enabled).length
  const inactive = policies.filter(p => !p.enabled).length

  return (
    <div className="space-y-6 max-w-screen-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Governance</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Control AI model access, usage, and spend policies
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus className="w-4 h-4" /> New Policy
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Policies', value: policies.length, color: 'var(--foreground)' },
          { label: 'Active',         value: active,          color: 'var(--accent)' },
          { label: 'Disabled',       value: inactive,        color: 'var(--muted-foreground)' },
        ].map(item => (
          <div key={item.label} className="stat-card">
            <p className="section-title">{item.label}</p>
            <p className="text-2xl font-semibold" style={{ color: item.color }}>{item.value}</p>
          </div>
        ))}
      </div>

      {policies.length === 0 ? (
        <div className="empty-state card">
          <Shield className="w-8 h-8 mb-3" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>No governance policies</p>
          <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
            Add policies to restrict model access, enforce budgets, and control usage.
          </p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add First Policy
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map(p => (
            <PolicyCard key={p.id} policy={p} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && <PolicyModal onClose={() => setShowModal(false)} onSave={handleSave} />}
      </AnimatePresence>
    </div>
  )
}
