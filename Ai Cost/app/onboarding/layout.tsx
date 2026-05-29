'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CheckCircle, Circle } from 'lucide-react'

const STEPS = [
  { n: 1, label: 'Connect Key',   href: '/onboarding' },
  { n: 2, label: 'API Key',       href: '/onboarding/step2' },
  { n: 3, label: 'Test Request',  href: '/onboarding/step3' },
  { n: 4, label: 'View Savings',  href: '/onboarding/step4' },
  { n: 5, label: 'Complete',      href: '/onboarding/step5' },
]

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const currentStep = STEPS.findIndex(s => s.href === pathname) + 1 || 1

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Vela Setup</span>
        </div>
        <Link href="/dashboard" className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Skip setup →
        </Link>
      </header>

      {/* Progress steps */}
      <div className="flex items-center justify-center py-6 px-4">
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const done   = step.n < currentStep
            const active = step.n === currentStep
            return (
              <div key={step.n} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all"
                    style={{
                      borderColor: done ? 'var(--accent)' : active ? 'var(--primary)' : 'var(--border)',
                      background:  done ? 'var(--accent)' : active ? 'var(--primary)' : 'transparent',
                    }}>
                    {done
                      ? <CheckCircle className="w-4 h-4 text-white" />
                      : <span className="text-xs font-bold" style={{ color: active ? 'white' : 'var(--muted-foreground)' }}>{step.n}</span>
                    }
                  </div>
                  <span className="text-xs mt-1 hidden sm:block" style={{
                    color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
                    fontWeight: active ? 600 : 400,
                  }}>{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-8 sm:w-16 h-0.5 mx-1" style={{
                    background: step.n < currentStep ? 'var(--accent)' : 'var(--border)',
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-4 py-4">
        <div className="w-full max-w-lg">
          {children}
        </div>
      </main>
    </div>
  )
}
