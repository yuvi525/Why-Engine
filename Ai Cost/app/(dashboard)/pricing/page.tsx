'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Zap, ArrowRight, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

const PLANS = [
  {
    key:     'free',
    name:    'Free',
    price:   '$0',
    period:  '/mo',
    badge:   null,
    desc:    'Get started and see the savings.',
    features: [
      '50 requests / day',
      '$5 daily budget cap',
      'V1 smart routing',
      'Cost dashboard',
      'WHY Engine',
      'Community support',
    ],
    unavailable: ['V2 5-tier routing', 'Shadow analytics', 'ROI Intelligence', 'Priority support'],
    cta:     'Current plan',
    ctaFree: true,
  },
  {
    key:     'pro',
    name:    'Pro',
    price:   '$29',
    period:  '/mo',
    badge:   'Most Popular',
    desc:    'For teams serious about AI cost control.',
    features: [
      '2,000 requests / day',
      '$50 daily budget cap',
      'V2 5-tier routing',
      'Shadow analytics',
      'ROI Intelligence',
      'Attribution by customer & feature',
      'Governance policies',
      'Alert engine',
      'Email support',
    ],
    unavailable: [],
    cta:     'Upgrade to Pro',
    ctaFree: false,
    plan:    'pro',
  },
  {
    key:     'scale',
    name:    'Scale',
    price:   '$99',
    period:  '/mo',
    badge:   null,
    desc:    'Unlimited scale with full intelligence.',
    features: [
      'Unlimited requests',
      '$500 daily budget cap',
      'Everything in Pro',
      'Learning engine',
      'Full audit log export',
      'Priority support',
      'Early access to new features',
    ],
    unavailable: [],
    cta:     'Upgrade to Scale',
    ctaFree: false,
    plan:    'scale',
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [currentPlan, setCurrentPlan] = useState<string>('free')
  const [loading, setLoading]         = useState(false)
  const [upgrading, setUpgrading]     = useState<string | null>(null)
  const [error, setError]             = useState('')
  const [billingConfigured, setBillingConfigured] = useState<boolean>(true)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.plan) setCurrentPlan(d.plan)
        if (d && d.billingConfigured !== undefined) setBillingConfigured(d.billingConfigured)
      })
      .catch(() => {})
  }, [])

  const handleUpgrade = async (planKey: string) => {
    setUpgrading(planKey); setError('')
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'stripe_not_configured') {
          setError('Stripe is not yet configured. Contact support to upgrade.')
        } else {
          setError(data.error ?? 'Failed to start checkout')
        }
        return
      }
      if (data.url) window.location.href = data.url
    } catch {
      setError('Failed to connect to checkout. Please try again.')
    } finally {
      setUpgrading(null)
    }
  }

  const handleTrial = async () => {
    setLoading(true)
    try {
      await fetch('/api/upgrade?action=start_trial', { method: 'POST' })
      router.push('/dashboard?trial=started')
    } finally {
      setLoading(false)
    }
  }

  const isCurrentOrHigher = (planKey: string) => {
    const order = ['free', 'pro_trial', 'pro', 'scale']
    return order.indexOf(currentPlan) >= order.indexOf(planKey)
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Simple, transparent pricing</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Vela pays for itself. Average users save 60–80% on AI costs vs paying full GPT-4o prices.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm text-center"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((plan, i) => {
          const isCurrent   = currentPlan === plan.key || (currentPlan === 'pro_trial' && plan.key === 'pro')
          const isHigher    = isCurrentOrHigher(plan.key)
          const isPopular   = plan.badge === 'Most Popular'

          return (
            <motion.div key={plan.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="card p-6 flex flex-col relative"
              style={isPopular ? { border: '1.5px solid var(--primary)', boxShadow: '0 0 30px rgba(99,102,241,0.12)' } : {}}>

              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold text-white"
                  style={{ background: 'var(--primary)' }}>
                  {plan.badge}
                </div>
              )}

              {/* Plan name + price */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-foreground">{plan.name}</p>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-end gap-0.5">
                  <span className="text-3xl font-black text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground mb-0.5">{plan.period}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{plan.desc}</p>
              </div>

              {/* CTA */}
              <div className="mb-5">
                {plan.ctaFree ? (
                  <div className="w-full py-2 rounded-lg text-center text-sm font-medium"
                    style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>
                    {isCurrent ? 'Current plan' : 'Free forever'}
                  </div>
                ) : !billingConfigured ? (
                  <div className="w-full py-2 rounded-lg text-center text-sm font-medium border"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                    Billing Coming Soon
                  </div>
                ) : isCurrent ? (
                  <div className="w-full py-2 rounded-lg text-center text-sm font-medium"
                    style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                    ✓ Active
                  </div>
                ) : (
                  <button onClick={() => handleUpgrade(plan.plan!)}
                    disabled={upgrading === plan.plan || isHigher}
                    className={`btn w-full flex items-center justify-center gap-2 ${isPopular ? 'btn-primary' : ''}`}
                    style={!isPopular ? { border: '1px solid var(--border)' } : {}}>
                    {upgrading === plan.plan ? 'Redirecting...' : (
                      <><span>{plan.cta}</span><ArrowRight className="w-3.5 h-3.5" /></>
                    )}
                  </button>
                )}
              </div>

              {/* Features */}
              <div className="flex-1 space-y-2">
                {plan.features.map(f => (
                  <div key={f} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                    <span className="text-xs text-foreground">{f}</span>
                  </div>
                ))}
                {plan.unavailable.map(f => (
                  <div key={f} className="flex items-start gap-2 opacity-35">
                    <div className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 flex items-center justify-center">
                      <div className="w-2.5 h-px rounded-full bg-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground line-through">{f}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Trial CTA */}
      {currentPlan === 'free' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          className="card p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.1)' }}>
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Try Pro free for 14 days</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                No credit card required. Full V2 routing + ROI Intelligence unlocked immediately.
              </p>
            </div>
          </div>
          <button onClick={handleTrial} disabled={loading}
            className="btn flex items-center gap-2 flex-shrink-0"
            style={{ border: '1px solid var(--primary)', color: 'var(--primary)' }}>
            {loading ? 'Starting...' : <><span>Start Free Trial</span><ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
        </motion.div>
      )}

      {/* Payment options note */}
      <div className="text-center space-y-1">
        <p className="text-xs text-muted-foreground">
          Payments via Stripe (US / EU / international) · Razorpay available for Indian customers
        </p>
        <p className="text-xs text-muted-foreground">
          Need a custom plan for a team?{' '}
          <a href="mailto:support@yourdomain.com" className="underline" style={{ color: 'var(--primary)' }}>
            Contact us
          </a>
        </p>
      </div>

      {/* FAQ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        {[
          { q: 'What is BYOK?', a: 'Bring Your Own Key — you connect your own OpenAI or Claude API key. Vela routes and tracks spend on your key, never charging provider markup.' },
          { q: 'How does Vela save money?', a: 'Vela automatically routes simple requests to GPT-4o-mini (which costs 16× less) and complex requests to GPT-4o. You pay only for what\'s needed.' },
          { q: 'Can I cancel anytime?', a: 'Yes. Cancel from the Stripe billing portal. Your account downgrades to Free at the next billing cycle.' },
          { q: 'Is my API key safe?', a: 'Yes. We encrypt it with AES-256-GCM. We never store or transmit it in plaintext. You can revoke it any time from Settings.' },
        ].map(item => (
          <div key={item.q} className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{item.q}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
