'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Zap, Building2, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/src/components/ui/toast-provider';

// ── Plan definitions ───────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    tagline: 'Get started with AI cost intelligence',
    color: '#6366f1',
    features: [
      'Up to 1,000 LLM requests/month',
      'Basic cost anomaly detection',
      'WHY Engine analysis (3/day)',
      '7-day data retention',
      'Dashboard & reporting',
    ],
    cta: 'Current Plan',
    stripePlan: null,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$49',
    period: '/month',
    tagline: 'For growing teams spending $500+/month on AI',
    color: '#22c55e',
    badge: 'Most Popular',
    features: [
      'Up to 50,000 LLM requests/month',
      'Full WHY Engine analysis (unlimited)',
      'Autopilot cost reduction rules',
      'Real-time anomaly alerts (Slack)',
      '90-day data retention',
      'API key management',
      'Priority support',
    ],
    cta: 'Upgrade to Growth',
    stripePlan: 'growth',
  },
  {
    id: 'scale',
    name: 'Scale',
    price: '$199',
    period: '/month',
    tagline: 'Enterprise-grade for $5k+/month AI budgets',
    color: '#f59e0b',
    badge: 'Best Value',
    features: [
      'Unlimited LLM requests',
      'Full WHY Engine + Cost DNA',
      'Advanced Autopilot + custom rules',
      'Multi-model routing optimization',
      'Unlimited data retention',
      'SSO & team management',
      'Custom SLA & dedicated support',
      'On-premise deployment option',
    ],
    cta: 'Upgrade to Scale',
    stripePlan: 'scale',
  },
];

// ── PlanCard ──────────────────────────────────────────────────────────────────
function PlanCard({ plan, currentPlan, onUpgrade, isLoading }: {
  plan: typeof PLANS[0];
  currentPlan: string;
  onUpgrade: (id: string) => void;
  isLoading: string | null;
}) {
  const isCurrent = currentPlan === plan.id;
  const isUpgrading = isLoading === plan.id;

  return (
    <div style={{
      background: 'rgba(17,24,39,0.9)',
      backdropFilter: 'blur(16px)',
      border: `1px solid ${isCurrent ? plan.color + '50' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 20,
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Popular badge */}
      {(plan as any).badge && (
        <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', background: `${plan.color}18`, border: `1px solid ${plan.color}40`, color: plan.color, borderRadius: 999, padding: '2px 10px' }}>
          {(plan as any).badge}
        </div>
      )}

      {/* Top accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: isCurrent ? `linear-gradient(90deg,${plan.color},${plan.color}80)` : 'transparent', borderRadius: '20px 20px 0 0' }} />

      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: plan.color, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px' }}>{plan.name}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
          <span style={{ fontSize: 38, fontWeight: 800, color: '#F9FAFB', fontFamily: 'monospace', letterSpacing: '-0.02em' }}>{plan.price}</span>
          <span style={{ fontSize: 13, color: '#6B7280' }}>{plan.period}</span>
        </div>
        <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0, lineHeight: 1.5 }}>{plan.tagline}</p>
      </div>

      {/* Features */}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <CheckCircle size={14} style={{ color: plan.color, flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 1.5 }}>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={() => !isCurrent && plan.stripePlan && onUpgrade(plan.id)}
        disabled={isCurrent || isUpgrading}
        style={{
          width: '100%',
          background: isCurrent
            ? 'rgba(255,255,255,0.04)'
            : `linear-gradient(135deg,${plan.color},${plan.color}cc)`,
          border: `1px solid ${isCurrent ? 'rgba(255,255,255,0.08)' : plan.color + '60'}`,
          borderRadius: 12,
          padding: '11px 20px',
          fontSize: 13,
          fontWeight: 700,
          color: isCurrent ? '#6B7280' : '#fff',
          cursor: isCurrent ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'all 0.2s',
        }}
      >
        {isUpgrading
          ? <><Loader2 size={14} className="animate-spin" /> Processing…</>
          : isCurrent
          ? <><CheckCircle size={14} /> {plan.cta}</>
          : <>{plan.cta} <ArrowRight size={14} /></>
        }
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const { toast } = useToast();
  const [currentPlan, setCurrentPlan] = useState('free');
  const [upgrading, setUpgrading]     = useState<string | null>(null);

  // Fetch current plan
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.plan) setCurrentPlan(d.plan);
    }).catch(() => {});
  }, []);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.url) window.location.href = data.url;
    } catch (e: any) {
      toast(e.message, 'error');
      setUpgrading(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '0 1.5rem 6rem' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ maxWidth: 600, margin: '0 auto', paddingTop: '5rem', textAlign: 'center', marginBottom: 56 }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 999, padding: '5px 14px', marginBottom: 20 }}>
          <Zap size={12} style={{ color: '#818CF8' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#818CF8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Simple, Transparent Pricing</span>
        </div>
        <h1 style={{ fontSize: 44, fontWeight: 800, color: '#F9FAFB', letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 16px' }}>
          Pricing that scales<br />
          <span style={{ background: 'linear-gradient(135deg,#6366f1,#22c55e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            with your AI spend
          </span>
        </h1>
        <p style={{ fontSize: 16, color: '#9CA3AF', lineHeight: 1.7, margin: 0 }}>
          Start free. Upgrade when you're ready. Every plan includes the full WHY Engine analysis pipeline.
        </p>
      </motion.div>

      {/* Plan cards grid */}
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
          >
            <PlanCard
              plan={plan}
              currentPlan={currentPlan}
              onUpgrade={handleUpgrade}
              isLoading={upgrading}
            />
          </motion.div>
        ))}
      </div>

      {/* Enterprise note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{ maxWidth: 600, margin: '40px auto 0', textAlign: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <Building2 size={14} style={{ color: '#6B7280' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}>Need custom volume, contracts, or on-prem?</span>
        </div>
        <a href="mailto:hello@whyengine.ai" style={{ fontSize: 13, color: '#818CF8', fontWeight: 600 }}>
          Contact us for enterprise pricing →
        </a>
      </motion.div>
    </div>
  );
}
