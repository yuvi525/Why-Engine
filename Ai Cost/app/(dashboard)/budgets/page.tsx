'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, Plus, Trash2, RefreshCw, AlertTriangle, CheckCircle2, Edit2 } from 'lucide-react'

interface Budget {
  id: string
  name: string
  scope: string       // 'global' | 'team' | 'project' | 'feature'
  scopeValue: string  // team name, project name, etc.
  limitMicro: number  // monthly limit in microdollars
  softLimitPct: number // alert at X%
  hardLimit: boolean  // block at 100%
  spentMicro: number  // current period spend
  action: string      // 'alert' | 'block' | 'downgrade'
  createdAt: string
}

const usd = (micro: number) => `$${(micro / 1e6).toFixed(2)}`

function BudgetRow({ budget, onDelete, onEdit }: {
  budget: Budget; onDelete: (id: string) => void; onEdit: (b: Budget) => void
}) {
  const pct = Math.min((budget.spentMicro / budget.limitMicro) * 100, 100)
  const status = pct >= 100 ? 'exceeded' : pct >= budget.softLimitPct ? 'warning' : 'ok'
  const colors = { ok: 'var(--accent)', warning: 'var(--warning)', exceeded: 'var(--destructive)' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="card p-4 card-hover"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{budget.name}</h3>
            <span className={`badge ${status === 'ok' ? 'badge-green' : status === 'warning' ? 'badge-amber' : 'badge-red'}`}>
              {status === 'exceeded' ? 'Exceeded' : status === 'warning' ? 'Warning' : 'OK'}
            </span>
            {budget.hardLimit && <span className="badge badge-red">Hard limit</span>}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {budget.scope !== 'global' ? `${budget.scope}: ${budget.scopeValue}` : 'Global'} •{' '}
            On limit: {budget.action}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(budget)} className="btn btn-ghost btn-sm p-1.5">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(budget.id)} className="btn btn-ghost btn-sm p-1.5"
            style={{ color: 'var(--destructive)' }}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 progress-track h-2">
          <motion.div className="progress-fill h-2"
            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8 }}
            style={{ background: colors[status] }} />
        </div>
        <span className="text-xs font-mono tabular w-20 text-right" style={{ color: 'var(--foreground)' }}>
          {usd(budget.spentMicro)} / {usd(budget.limitMicro)}
        </span>
      </div>

      {/* Soft limit marker */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Soft alert at {budget.softLimitPct}%
        </span>
        <span className="text-xs tabular" style={{ color: pct >= budget.softLimitPct ? 'var(--warning)' : 'var(--muted-foreground)' }}>
          ({usd(budget.limitMicro * budget.softLimitPct / 100)})
        </span>
      </div>
    </motion.div>
  )
}

function BudgetModal({ budget, onClose, onSave }: {
  budget?: Budget; onClose: () => void; onSave: (data: Partial<Budget>) => void
}) {
  const [form, setForm] = useState({
    name: budget?.name ?? '',
    scope: budget?.scope ?? 'global',
    scopeValue: budget?.scopeValue ?? '',
    limitUsd: budget ? (budget.limitMicro / 1e6).toFixed(2) : '100',
    softLimitPct: budget?.softLimitPct ?? 80,
    hardLimit: budget?.hardLimit ?? false,
    action: budget?.action ?? 'alert',
  })

  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      name: form.name,
      scope: form.scope,
      scopeValue: form.scopeValue,
      limitMicro: Math.round(parseFloat(form.limitUsd) * 1e6),
      softLimitPct: form.softLimitPct,
      hardLimit: form.hardLimit,
      action: form.action,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-xl p-6 space-y-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            {budget ? 'Edit Budget' : 'Create Budget'}
          </h2>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: 'var(--muted-foreground)' }}>×</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="section-title block mb-1">Budget Name</label>
            <input className="input" placeholder="e.g. Engineering Monthly"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-title block mb-1">Scope</label>
              <select className="select w-full" value={form.scope}
                onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}>
                <option value="global">Global</option>
                <option value="team">Team</option>
                <option value="project">Project</option>
                <option value="feature">Feature</option>
                <option value="customer">Customer</option>
              </select>
            </div>
            {form.scope !== 'global' && (
              <div>
                <label className="section-title block mb-1">Value</label>
                <input className="input" placeholder={`${form.scope} name`}
                  value={form.scopeValue} onChange={e => setForm(f => ({ ...f, scopeValue: e.target.value }))} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-title block mb-1">Monthly Limit (USD)</label>
              <input className="input" type="number" min="1" step="1"
                value={form.limitUsd} onChange={e => setForm(f => ({ ...f, limitUsd: e.target.value }))} />
            </div>
            <div>
              <label className="section-title block mb-1">Alert Threshold (%)</label>
              <input className="input" type="number" min="50" max="99"
                value={form.softLimitPct} onChange={e => setForm(f => ({ ...f, softLimitPct: parseInt(e.target.value) }))} />
            </div>
          </div>

          <div>
            <label className="section-title block mb-1">When limit reached</label>
            <select className="select w-full" value={form.action}
              onChange={e => setForm(f => ({ ...f, action: e.target.value }))}>
              <option value="alert">Alert only</option>
              <option value="block">Block requests</option>
              <option value="downgrade">Downgrade to mini model</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.hardLimit}
              onChange={e => setForm(f => ({ ...f, hardLimit: e.target.checked }))}
              className="rounded" />
            <span className="text-sm" style={{ color: 'var(--foreground)' }}>Hard limit (block at 100%)</span>
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name}
            className="btn btn-primary flex-1" style={{ opacity: saving || !form.name ? 0.6 : 1 }}>
            {saving ? 'Saving…' : budget ? 'Save Changes' : 'Create Budget'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editBudget, setEditBudget] = useState<Budget | undefined>()

  const load = useCallback(() => {
    fetch('/api/budgets')
      .then(r => r.ok ? r.json() : { budgets: [] })
      .then(d => setBudgets(d.budgets ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: Partial<Budget>) => {
    const method = editBudget ? 'PUT' : 'POST'
    const url    = editBudget ? `/api/budgets/${editBudget.id}` : '/api/budgets'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget?')) return
    await fetch(`/api/budgets/${id}`, { method: 'DELETE' })
    setBudgets(b => b.filter(x => x.id !== id))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
    </div>
  )

  return (
    <div className="space-y-6 max-w-screen-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Budget Center</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Set and enforce spend limits across teams, projects, and features
          </p>
        </div>
        <button onClick={() => { setEditBudget(undefined); setShowModal(true) }} className="btn btn-primary">
          <Plus className="w-4 h-4" /> New Budget
        </button>
      </div>

      {budgets.length === 0 ? (
        <div className="empty-state card">
          <Wallet className="w-8 h-8 mb-3" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>No budgets set</p>
          <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
            Create a budget to monitor and control AI spend before it becomes a problem.
          </p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Create First Budget
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map(b => (
            <BudgetRow key={b.id} budget={b}
              onDelete={handleDelete}
              onEdit={b => { setEditBudget(b); setShowModal(true) }}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <BudgetModal
            budget={editBudget}
            onClose={() => { setShowModal(false); setEditBudget(undefined) }}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
