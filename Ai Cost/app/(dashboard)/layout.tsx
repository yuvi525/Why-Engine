'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ListTree, Settings, Zap, LogOut } from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

const nav = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/decisions',  label: 'Decisions',   icon: ListTree },
  { href: '/settings',   label: 'Settings',    icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

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
        <div className="p-3 border-t border-border">
          <div className="bg-primary/5 border border-primary/10 rounded-xl px-3 py-2.5 mb-2">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">Autopilot Active</p>
            <p className="text-xs text-muted-foreground mt-0.5">All requests optimized</p>
          </div>
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
