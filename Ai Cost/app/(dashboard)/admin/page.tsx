'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, DollarSign, Activity, RefreshCw, Shield, Crown, Ban, CheckCircle2 } from 'lucide-react'

interface UserRow {
  id: string
  email: string
  plan: string
  role: string
  createdAt: string
  requestsToday: number
  totalSpentMicro: number
  totalSavedMicro: number
  hasApiKey: boolean
}

const usd = (micro: number) => `$${(micro / 1e6).toFixed(2)}`

const PLAN_BADGE: Record<string, string> = {
  free: 'badge-gray', pro: 'badge-blue', pro_trial: 'badge-purple', scale: 'badge-green',
}

export default function AdminPage() {
  const [users, setUsers]   = useState<UserRow[]>([])
  const [stats, setStats]   = useState<{ totalUsers: number; totalSpend: number; totalSaved: number; activeToday: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch('/api/admin/users')
      .then(r => {
        if (r.status === 403) { window.location.href = '/dashboard'; return null }
        return r.ok ? r.json() : null
      })
      .then(d => {
        if (!d) return
        setUsers(d.users ?? [])
        setStats(d.stats ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const setPlan = async (userId: string, plan: string) => {
    setActionLoading(userId)
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    load()
    setActionLoading(null)
  }

  const filtered = users.filter(u =>
    !search || u.email.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
    </div>
  )

  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <Crown className="w-5 h-5" style={{ color: 'var(--warning)' }} />
            Admin Panel
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            User management and platform overview
          </p>
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Users',    value: stats.totalUsers.toLocaleString(),   icon: Users,      color: 'var(--foreground)' },
            { label: 'Active Today',   value: stats.activeToday.toLocaleString(),  icon: Activity,   color: 'var(--accent)' },
            { label: 'Platform Spend', value: usd(stats.totalSpend),               icon: DollarSign, color: 'var(--foreground)' },
            { label: 'Total Saved',    value: usd(stats.totalSaved),               icon: Shield,     color: 'var(--accent)' },
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
      )}

      {/* User Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Users <span className="badge badge-gray ml-1">{users.length}</span>
          </h2>
          <input
            className="input w-48"
            placeholder="Search by email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Role</th>
                <th className="text-right">Requests Today</th>
                <th className="text-right">Total Spend</th>
                <th className="text-right">Total Saved</th>
                <th>BYOK</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{u.email}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{u.id.slice(0, 8)}…</p>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${PLAN_BADGE[u.plan] ?? 'badge-gray'}`}>{u.plan}</span>
                  </td>
                  <td>
                    {u.role === 'owner'
                      ? <span className="badge badge-amber">Owner</span>
                      : <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Customer</span>}
                  </td>
                  <td className="text-right tabular text-xs">{u.requestsToday}</td>
                  <td className="text-right tabular text-xs">{usd(u.totalSpentMicro)}</td>
                  <td className="text-right tabular text-xs" style={{ color: 'var(--accent)' }}>{usd(u.totalSavedMicro)}</td>
                  <td>
                    {u.hasApiKey
                      ? <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      : <Ban className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />}
                  </td>
                  <td>
                    <select
                      className="select text-xs py-1 px-2"
                      value={u.plan}
                      disabled={actionLoading === u.id}
                      onChange={e => setPlan(u.id, e.target.value)}
                    >
                      <option value="free">Free</option>
                      <option value="pro_trial">Pro Trial</option>
                      <option value="pro">Pro</option>
                      <option value="scale">Scale</option>
                    </select>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-xs" style={{ color: 'var(--muted-foreground)' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
