'use client'

/**
 * /admin — Owner-only control panel
 *
 * AUTH:  Validated server-side via /api/admin/* — any 403 redirects to /dashboard.
 *        Client re-validates on mount as a secondary safety net.
 * SCOPE: Purely a control plane. Zero interaction with execution path.
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  BarChart3,
  ScrollText,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Clock,
  Zap,
  DollarSign,
  Activity,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Crown,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string
  email: string
  plan: string
  role: string
  createdAt: string
  requestsToday: number
  totalSpendMicro: number
}

interface AdminStats {
  totalUsers: number
  totalRequests: number
  totalSpendMicro: number
  totalSpendUsd: string
}

interface AdminLog {
  id: string
  userId: string
  email: string
  model: string
  costMicro: number
  costUsd: string
  reasonCode: string
  isCacheHit: boolean
  createdAt: string
}

type AdminAction = 'upgrade_pro' | 'downgrade_free' | 'reset_usage' | 'extend_trial'
type Tab = 'users' | 'stats' | 'logs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUsd(micro: number) {
  return `$${(micro / 1_000_000).toFixed(4)}`
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

function planColor(plan: string) {
  switch (plan) {
    case 'pro':       return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    case 'pro_trial': return 'text-purple-400 bg-purple-400/10 border-purple-400/20'
    case 'scale':     return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    default:          return 'text-slate-400 bg-slate-400/10 border-slate-400/20'
  }
}

function modelBadge(model: string) {
  if (model.includes('mini')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  return 'bg-violet-500/10 text-violet-400 border-violet-500/20'
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab]           = useState<Tab>('users')
  const [users, setUsers]       = useState<AdminUser[]>([])
  const [stats, setStats]       = useState<AdminStats | null>(null)
  const [logs, setLogs]         = useState<AdminLog[]>([])
  const [loading, setLoading]   = useState(true)
  const [toasts, setToasts]     = useState<Toast[]>([])
  const [acting, setActing]     = useState<Record<string, boolean>>({})
  const [isTestMode, setIsTestMode] = useState(false)

  // ── Toast helpers ──────────────────────────────────────────────
  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  // ── Auth check + initial data load ────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Use stats as auth sentinel — 403 means not owner
      const statsRes = await fetch('/api/admin/stats')
      if (statsRes.status === 403) {
        router.push('/dashboard')
        return
      }
      const statsData = await statsRes.json()
      setStats(statsData)

      const [usersRes, logsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/logs'),
      ])
      if (usersRes.ok) setUsers(await usersRes.json())
      if (logsRes.ok)  setLogs(await logsRes.json())
    } catch {
      addToast('Failed to load admin data', 'error')
    } finally {
      setLoading(false)
    }
  }, [router, addToast])

  useEffect(() => { void load() }, [load])

  // ── User action handler ────────────────────────────────────────
  const handleAction = async (userId: string, action: AdminAction, label: string) => {
    const key = `${userId}:${action}`
    if (acting[key]) return

    if (isTestMode) {
      addToast(`[TEST MODE] Would run: ${action} on ${label}`, 'success')
      return
    }

    setActing(prev => ({ ...prev, [key]: true }))
    try {
      const res = await fetch('/api/admin/user', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        addToast(data.error ?? 'Action failed', 'error')
      } else {
        addToast(data.message ?? 'Done', 'success')
        // Refresh users list after mutation
        const usersRes = await fetch('/api/admin/users')
        if (usersRes.ok) setUsers(await usersRes.json())
      }
    } catch {
      addToast('Network error', 'error')
    } finally {
      setActing(prev => ({ ...prev, [key]: false }))
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-[#e5e7eb] font-['Inter',sans-serif]">

      {/* ── Toast Stack ───────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm shadow-2xl backdrop-blur-sm pointer-events-auto
              ${t.type === 'success'
                ? 'bg-emerald-900/80 border-emerald-700/50 text-emerald-200'
                : 'bg-red-900/80 border-red-700/50 text-red-200'
              }`}
            style={{ animation: 'slideIn 0.25s ease-out' }}
          >
            {t.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              : <AlertCircle   className="w-4 h-4 text-red-400 flex-shrink-0" />
            }
            {t.message}
          </div>
        ))}
      </div>

      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="border-b border-white/8 bg-white/[0.02] backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <ShieldAlert className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-base text-white">Vela Admin</span>
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-violet-400 bg-violet-400/10 border border-violet-400/20 rounded px-1.5 py-0.5">
                Control Plane
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Test Mode Toggle */}
            <button
              onClick={() => setIsTestMode(p => !p)}
              className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-all font-medium
                ${isTestMode
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-300'
                }`}
            >
              <Activity className="w-3.5 h-3.5" />
              {isTestMode ? 'Test Mode ON' : 'Test Mode'}
            </button>

            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-slate-300 hover:bg-white/8 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Stats Cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              icon: Users,
              label: 'Total Users',
              value: loading ? '—' : String(stats?.totalUsers ?? 0),
              color: 'from-blue-600/20 to-blue-500/5 border-blue-500/15',
              iconColor: 'text-blue-400',
            },
            {
              icon: BarChart3,
              label: 'Total Requests',
              value: loading ? '—' : (stats?.totalRequests ?? 0).toLocaleString(),
              color: 'from-violet-600/20 to-violet-500/5 border-violet-500/15',
              iconColor: 'text-violet-400',
            },
            {
              icon: DollarSign,
              label: 'Total Spend',
              value: loading ? '—' : `$${stats?.totalSpendUsd ?? '0.0000'}`,
              color: 'from-emerald-600/20 to-emerald-500/5 border-emerald-500/15',
              iconColor: 'text-emerald-400',
            },
          ].map(({ icon: Icon, label, value, color, iconColor }) => (
            <div key={label} className={`rounded-2xl border bg-gradient-to-br ${color} p-5 backdrop-blur-sm`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4 h-4 ${iconColor}`} />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Tab Bar ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/8 rounded-xl p-1 w-fit">
          {([
            { id: 'users', label: 'Users',       icon: Users },
            { id: 'stats', label: 'System Stats', icon: BarChart3 },
            { id: 'logs',  label: 'Recent Logs',  icon: ScrollText },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === id
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-white/5'
                }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            TAB: USERS
        ═══════════════════════════════════════════════════════════ */}
        {tab === 'users' && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-white text-sm">All Users</span>
                <span className="ml-1 text-xs text-slate-500 bg-white/5 rounded-full px-2 py-0.5">
                  {users.length}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500 text-sm">Loading users…</div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">No users found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium">Req Today</th>
                      <th className="px-4 py-3 font-medium">Total Spend</th>
                      <th className="px-4 py-3 font-medium">Joined</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-white/[0.015] transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {u.role === 'owner' && (
                              <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            )}
                            <span className="font-medium text-white truncate max-w-[220px]">{u.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${planColor(u.plan)}`}>
                            {u.plan}
                          </span>
                        </td>
                        <td className="px-4 py-4 tabular-nums text-slate-300">
                          {u.requestsToday.toLocaleString()}
                        </td>
                        <td className="px-4 py-4 tabular-nums text-slate-300">
                          {fmtUsd(u.totalSpendMicro)}
                        </td>
                        <td className="px-4 py-4 text-slate-500 text-xs">
                          {fmtTime(u.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <ActionButton
                              label="Upgrade"
                              icon={TrendingUp}
                              color="text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30"
                              loading={acting[`${u.id}:upgrade_pro`]}
                              disabled={u.plan === 'pro' || u.role === 'owner'}
                              onClick={() => handleAction(u.id, 'upgrade_pro', u.email)}
                            />
                            <ActionButton
                              label="Downgrade"
                              icon={TrendingDown}
                              color="text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30"
                              loading={acting[`${u.id}:downgrade_free`]}
                              disabled={u.plan === 'free' || u.role === 'owner'}
                              onClick={() => handleAction(u.id, 'downgrade_free', u.email)}
                            />
                            <ActionButton
                              label="Reset"
                              icon={RotateCcw}
                              color="text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30"
                              loading={acting[`${u.id}:reset_usage`]}
                              onClick={() => handleAction(u.id, 'reset_usage', u.email)}
                            />
                            <ActionButton
                              label="+7 Days"
                              icon={Clock}
                              color="text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/30"
                              loading={acting[`${u.id}:extend_trial`]}
                              onClick={() => handleAction(u.id, 'extend_trial', u.email)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB: STATS
        ═══════════════════════════════════════════════════════════ */}
        {tab === 'stats' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-white text-sm">System Overview</h2>
              </div>

              {loading ? (
                <p className="text-slate-500 text-sm">Loading…</p>
              ) : stats ? (
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Total Users',    value: stats.totalUsers.toLocaleString(),     sub: 'registered accounts',    color: 'border-blue-500/30' },
                    { label: 'Total Requests', value: stats.totalRequests.toLocaleString(),   sub: 'decision log entries',   color: 'border-violet-500/30' },
                    { label: 'Total Spend',    value: `$${stats.totalSpendUsd}`,              sub: `${(stats.totalSpendMicro).toLocaleString()} microdollars`, color: 'border-emerald-500/30' },
                    { label: 'Avg Cost / Req', value: stats.totalRequests > 0 ? `$${(stats.totalSpendMicro / stats.totalRequests / 1_000_000).toFixed(6)}` : '—', sub: 'per request average', color: 'border-amber-500/30' },
                  ].map(({ label, value, sub, color }) => (
                    <div key={label} className={`rounded-xl border ${color} bg-white/[0.025] p-5`}>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
                      <p className="text-xs text-slate-500 mt-1">{sub}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No stats available</p>
              )}
            </div>

            {/* Owner capabilities note */}
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-violet-300">Owner Privileges Active</p>
                <p>Rate limits and budget limits are bypassed for your account. Routing decisions and cost calculations remain fully intact — the system still records every request accurately.</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB: LOGS
        ═══════════════════════════════════════════════════════════ */}
        {tab === 'logs' && (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-white text-sm">Recent Decision Logs</span>
                <span className="ml-1 text-xs text-slate-500 bg-white/5 rounded-full px-2 py-0.5">
                  Last 50
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500 text-sm">Loading logs…</div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">No logs yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                      <th className="px-6 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Model</th>
                      <th className="px-4 py-3 font-medium">Cost</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Cache</th>
                      <th className="px-6 py-3 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {logs.map(l => (
                      <tr key={l.id} className="hover:bg-white/[0.015] transition-colors">
                        <td className="px-6 py-3.5">
                          <span className="text-slate-300 truncate max-w-[200px] block">{l.email}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${modelBadge(l.model)}`}>
                            {l.model.replace('gpt-4o-mini', 'mini').replace('gpt-4o', '4o')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-slate-300 text-xs">
                          ${l.costUsd}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-[10px] text-slate-500 font-mono">{l.reasonCode}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          {l.isCacheHit
                            ? <span className="text-emerald-400 text-xs font-medium flex items-center gap-1"><Zap className="w-3 h-3" />Hit</span>
                            : <span className="text-slate-600 text-xs">—</span>
                          }
                        </td>
                        <td className="px-6 py-3.5 text-slate-500 text-xs">
                          {fmtTime(l.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-xs text-slate-600 pt-2">
          <ChevronRight className="w-3 h-3" />
          <span>Admin control plane — changes are permanent. Use Test Mode to simulate actions safely.</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── ActionButton ─────────────────────────────────────────────────────────────

function ActionButton({
  label,
  icon: Icon,
  color,
  loading = false,
  disabled = false,
  onClick,
}: {
  label: string
  icon: React.ElementType
  color: string
  loading?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-[11px] font-medium transition-all
        ${disabled
          ? 'opacity-30 cursor-not-allowed text-slate-600'
          : `${color} cursor-pointer`
        }
        ${loading ? 'opacity-60' : ''}
      `}
    >
      {loading
        ? <RefreshCw className="w-3 h-3 animate-spin" />
        : <Icon className="w-3 h-3" />
      }
      {label}
    </button>
  )
}
