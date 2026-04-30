'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ListTree, Settings, Zap, LogOut, ShieldCheck, AlertTriangle } from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const nav = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/decisions',  label: 'Decisions',   icon: ListTree },
  { href: '/settings',   label: 'Settings',    icon: Settings },
]

const PLAN_LABELS: Record<string, string> = {
  free:  'Free',
  pro:   'Pro',
  scale: 'Scale',
}

const PLAN_COLORS: Record<string, string> = {
  free:  'text-muted-foreground',
  pro:   'text-blue-400',
  scale: 'text-amber-400',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()

  // Live sidebar status — fetched once from /api/settings
  const [sidebarStatus, setSidebarStatus] = useState<{
    plan: string
    hasApiKey: boolean
    requestsToday: number
    dailyLimit: number
    usagePct: number
  } | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        const limit    = d.planConfig?.requestsPerDay ?? 50
        const usagePct = limit === -1 ? 0 : Math.min(Math.round((d.requestsToday / limit) * 100), 100)
        setSidebarStatus({
          plan:          d.plan ?? 'free',
          hasApiKey:     d.hasApiKey ?? false,
          requestsToday: d.requestsToday ?? 0,
          dailyLimit:    limit,
          usagePct,
        })
      })
      .catch(() => { /* sidebar status is non-critical */ })
  }, [])

  const handleSignOut = async () => {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-border flex flex-col bg-card">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.4)]">
              <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-lg tracking-tight text-foreground">Vela</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2 mt-1">Main</p>
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-primary/10 text-primary shadow-[0_0_0_1px_rgba(16,185,129,0.2)]'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-2">

          {/* BYOK warning — shown when no OpenAI key */}
          {sidebarStatus && !sidebarStatus.hasApiKey && (
            <Link
              href="/settings"
              className="flex items-start gap-2 bg-amber-900/20 border border-amber-900/40 rounded-xl px-3 py-2.5 hover:bg-amber-900/30 transition"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest">Key Required</p>
                <p className="text-xs text-muted-foreground mt-0.5">Add your OpenAI key in Settings</p>
              </div>
            </Link>
          )}

          {/* Autopilot status / plan info */}
          {sidebarStatus ? (
            <div className="bg-primary/5 border border-primary/10 rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-primary" />
                  <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">
                    {sidebarStatus.hasApiKey ? 'Autopilot Active' : 'Autopilot Paused'}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${PLAN_COLORS[sidebarStatus.plan] ?? 'text-muted-foreground'}`}>
                  {PLAN_LABELS[sidebarStatus.plan] ?? sidebarStatus.plan}
                </span>
              </div>
              {/* Usage mini-bar */}
              {sidebarStatus.dailyLimit !== -1 && (
                <>
                  <div className="h-1 bg-secondary rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full transition-all ${sidebarStatus.usagePct >= 80 ? 'bg-amber-400' : 'bg-primary'}`}
                      style={{ width: `${sidebarStatus.usagePct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {sidebarStatus.requestsToday} / {sidebarStatus.dailyLimit} requests today
                  </p>
                </>
              )}
              {sidebarStatus.dailyLimit === -1 && (
                <p className="text-xs text-muted-foreground mt-0.5">Unlimited requests</p>
              )}
            </div>
          ) : (
            <div className="bg-primary/5 border border-primary/10 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">Autopilot Active</p>
              <p className="text-xs text-muted-foreground mt-0.5">All requests optimized</p>
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-xs px-3 py-2 rounded-lg hover:bg-secondary transition w-full"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex-shrink-0 border-b border-border flex items-center px-8 bg-card/50 backdrop-blur">
          <p className="text-sm text-muted-foreground">
            {nav.find(n => n.href === pathname)?.label ?? 'Vela'}
          </p>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
