'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle, LayoutDashboard, CreditCard, ArrowRight, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

const CHECKLIST = [
  'Provider API key connected',
  'Vela API key generated',
  'First request routed through Vela',
  'Savings tracked in real-time',
]

export default function OnboardingStep5() {
  const router = useRouter()

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Hero */}
      <div className="text-center py-4">
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'var(--accent)', boxShadow: '0 0 40px rgba(16,185,129,0.3)' }}>
          <Zap className="w-8 h-8 text-white" strokeWidth={2.5} />
        </motion.div>
        <h1 className="text-2xl font-bold text-foreground">You're all set!</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Vela is now routing your AI traffic, enforcing budgets, and tracking every dollar saved.
        </p>
      </div>

      {/* Checklist */}
      <div className="card p-5 space-y-3">
        {CHECKLIST.map((item, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
            <p className="text-sm text-foreground">{item}</p>
          </motion.div>
        ))}
      </div>

      {/* Next steps */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">What's next</p>

        {[
          {
            icon: LayoutDashboard,
            title: 'Go to Dashboard',
            desc:  'See your real-time spend, budget health, and routing decisions.',
            href:  '/dashboard',
            primary: true,
          },
          {
            icon: CreditCard,
            title: 'View Pricing Plans',
            desc:  'Unlock V2 routing, shadow analytics, and higher limits.',
            href:  '/pricing',
            primary: false,
          },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className={`flex items-center gap-4 p-4 rounded-xl transition-all ${item.primary ? 'btn-primary' : ''}`}
            style={item.primary
              ? { background: 'var(--primary)', color: 'white' }
              : { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: item.primary ? 'rgba(255,255,255,0.15)' : 'var(--secondary)' }}>
              <item.icon className="w-4 h-4" style={{ color: item.primary ? 'white' : 'var(--primary)' }} />
            </div>
            <div className="flex-1 text-left">
              <p className={`text-sm font-semibold ${item.primary ? 'text-white' : 'text-foreground'}`}>{item.title}</p>
              <p className={`text-xs mt-0.5 ${item.primary ? 'text-white/70' : 'text-muted-foreground'}`}>{item.desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 flex-shrink-0 opacity-60" />
          </Link>
        ))}
      </div>

      {/* Quick tip */}
      <div className="px-4 py-3 rounded-xl text-xs"
        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', color: '#818cf8' }}>
        <span className="font-semibold">Pro tip:</span> Pass <code>customer_id</code> and <code>feature_id</code> in your requests
        to unlock per-customer ROI tracking in the Attribution and ROI dashboards.
      </div>
    </motion.div>
  )
}
