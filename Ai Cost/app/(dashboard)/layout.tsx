'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  Shield,
  Bell,
  GitBranch,
  Zap,
  Settings,
  LogOut,
  ChevronDown,
  AlertTriangle,
  Users,
  BarChart3,
} from 'lucide-react'

const NAV = [
  { group: 'Overview',
    items: [
      { href: '/dashboard',    label: 'Overview',     icon: LayoutDashboard },
    ],
  },
  { group: 'Spend',
    items: [
      { href: '/spend',        label: 'Spend',        icon: TrendingUp },
      { href: '/attribution',  label: 'Attribution',  icon: GitBranch },
    ],
  },
  { group: 'Control',
    items: [
      { href: '/budgets',      label: 'Budgets',      icon: Wallet },
      { href: '/governance',   label: 'Governance',   icon: Shield },
      { href: '/alerts',       label: 'Alerts',       icon: Bell },
    ],
  },
  { group: 'Intelligence',
    items: [
      { href: '/roi',          label: 'ROI',          icon: BarChart3 },
      { href: '/why',          label: 'WHY Engine',   icon: Zap },
    ],
  },
  { group: 'Account',
    items: [
      { href: '/settings',     label: 'Settings',     icon: Settings },
    ],
  },
]

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  free:      { label: 'Free',       cls: 'badge-gray'   },
  pro:       { label: 'Pro',        cls: 'badge-blue'   },
  pro_trial: { label: 'Trial',      cls: 'badge-purple' },
  scale:     { label: 'Scale',      cls: 'badge-green'  },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()

  const [status, setStatus] = useState<{
    plan: string; hasApiKey: boolean; requestsToday: number;
    dailyLimit: number; usagePct: number; email?: string; role?: string;
  } | null>(null)

  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        return r.ok ? r.json() : null
      })
      .then(d => {
        if (!d) return
        const limit    = d.planConfig?.requestsPerDay ?? 50
        const usagePct = limit === -1 ? 0 : Math.min(Math.round((d.requestsToday / limit) * 100), 100)
        setStatus({ plan: d.plan ?? 'free', hasApiKey: d.hasApiKey ?? false,
          requestsToday: d.requestsToday ?? 0, dailyLimit: limit, usagePct, email: d.email, role: d.role })
      })
      .catch(() => {})
  }, [])

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const isAdmin = status?.role === 'owner'
  const planBadge = PLAN_BADGE[status?.plan ?? 'free'] ?? PLAN_BADGE.free

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* ── Sidebar ── */}
      <aside className={`${collapsed ? 'w-14' : 'w-56'} flex-shrink-0 flex flex-col transition-all duration-200`}
        style={{ background: 'var(--card)', borderRight: '1px solid var(--border)' }}>

        {/* Logo */}
        <div className="h-14 flex items-center px-4 gap-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--primary)' }}>
            <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm tracking-tight" style={{ color: 'var(--foreground)' }}>Vela</span>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-auto p-1 rounded transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsed ? '-rotate-90' : 'rotate-90'}`} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV.map(group => (
            <div key={group.group}>
              {!collapsed && (
                <p className="section-title px-2 mb-1">{group.group}</p>
              )}
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`nav-link ${active ? 'active' : ''}`}
                    title={collapsed ? label : undefined}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span>{label}</span>}
                    {!collapsed && active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--primary)' }} />
                    )}
                  </Link>
                )
              })}
            </div>
          ))}

          {isAdmin && (
            <div>
              {!collapsed && <p className="section-title px-2 mb-1">Admin</p>}
              <Link href="/admin" className={`nav-link ${pathname === '/admin' ? 'active' : ''}`} title={collapsed ? 'Admin' : undefined}>
                <Users className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>Admin Panel</span>}
              </Link>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-2 flex-shrink-0 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
          {/* BYOK warning */}
          {status && !status.hasApiKey && !collapsed && (
            <Link href="/settings" className="flex items-center gap-2 px-2 py-2 rounded text-xs transition-colors"
              style={{ background: 'var(--warning-muted)', color: 'var(--warning)' }}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Add API Key</span>
            </Link>
          )}

          {/* Plan + usage */}
          {status && !collapsed && (
            <div className="px-2 py-2 rounded" style={{ background: 'var(--secondary)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {status.email?.split('@')[0] ?? 'Account'}
                </span>
                <span className={`badge ${planBadge.cls}`}>{planBadge.label}</span>
              </div>
              {status.dailyLimit !== -1 && (
                <>
                  <div className="progress-track h-1 mt-1">
                    <div className="progress-fill h-1"
                      style={{ width: `${status.usagePct}%`, background: status.usagePct >= 80 ? 'var(--warning)' : 'var(--primary)' }} />
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    {status.requestsToday}/{status.dailyLimit} req today
                  </p>
                </>
              )}
            </div>
          )}

          <button onClick={handleSignOut}
            className="nav-link w-full" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex-shrink-0 flex items-center px-6 gap-4"
          style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {NAV.flatMap(g => g.items).find(n => pathname === n.href || pathname.startsWith(n.href + '/'))?.label ?? 'Vela'}
            </p>
          </div>
          {/* Status dot */}
          <div className="flex items-center gap-1.5">
            <span className="dot dot-green dot-pulse" />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Autopilot active</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
