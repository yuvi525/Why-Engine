'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Key, Plus, Trash2, Copy, Check, Zap, Eye, EyeOff,
  Shield, ShieldCheck, AlertTriangle, X, Settings, FlaskConical,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="btn btn-ghost btn-sm p-1.5"
    >
      {copied ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative w-10 h-5 rounded-full transition-colors"
      style={{
        background: checked ? 'var(--primary)' : 'var(--secondary)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
        style={{ left: checked ? 'calc(100% - 18px)' : '2px' }}
      />
    </button>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [keys, setKeys]             = useState<any[]>([])
  const [keysLoading, setKeysLoading] = useState(false)
  const [newKey, setNewKey]         = useState<string | null>(null)

  const [settings, setSettings]     = useState<any>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)

  // BYOK
  const [openAiInput, setOpenAiInput] = useState('')
  const [showKey, setShowKey]         = useState(false)
  const [byokSaving, setByokSaving]   = useState(false)
  const [byokError, setByokError]     = useState('')
  const [byokSuccess, setByokSuccess] = useState(false)

  // Budget
  const [dailyLimitInput, setDailyLimitInput] = useState('')
  const [budgetSaving, setBudgetSaving]       = useState(false)
  const [budgetSuccess, setBudgetSuccess]     = useState(false)

  // Flags
  const [v2Routing, setV2Routing]   = useState(false)
  const [v2Why, setV2Why]           = useState(false)
  const [flagSaving, setFlagSaving] = useState(false)

  const fetchKeys = () =>
    fetch('/api/keys').then(r => r.json()).then(d => setKeys(d.keys || [])).catch(() => {})

  const fetchSettings = () =>
    fetch('/api/settings')
      .then(async r => {
        if (!r.ok) return
        const d = await r.json().catch(() => null)
        if (!d) return
        setSettings(d)
        setV2Routing(d.v2RoutingEnabled ?? false)
        setV2Why(d.v2WhyEnabled ?? false)
        setDailyLimitInput(String(d.dailyLimitUsd ?? 5))
      })
      .finally(() => setSettingsLoading(false))

  useEffect(() => { fetchKeys(); fetchSettings() }, [])

  // ── Actions ────────────────────────────────────────────────────────────
  const createKey = async () => {
    setKeysLoading(true); setNewKey(null)
    try {
      const res  = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: 'Vela API Key' }) })
      const data = await res.json().catch(() => null)
      if (data?.key) { setNewKey(data.key); fetchKeys() }
    } finally { setKeysLoading(false) }
  }

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this key? This cannot be undone.')) return
    await fetch(`/api/keys/${id}`, { method: 'DELETE' })
    fetchKeys()
  }

  const saveByok = async () => {
    setByokSaving(true); setByokError(''); setByokSuccess(false)
    try {
      const res  = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ openAiKey: openAiInput.trim() }) })
      const data = await res.json()
      if (!res.ok) { setByokError(data.error ?? 'Failed to save key.') }
      else { setByokSuccess(true); setOpenAiInput(''); fetchSettings(); setTimeout(() => setByokSuccess(false), 3000) }
    } catch { setByokError('Network error — please try again.') }
    finally { setByokSaving(false) }
  }

  const removeByok = async () => {
    if (!confirm('Remove your provider API key?')) return
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ removeOpenAiKey: true }) })
    fetchSettings()
  }

  const saveBudget = async () => {
    setBudgetSaving(true); setBudgetSuccess(false)
    try {
      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dailyLimitUsd: parseFloat(dailyLimitInput) }) })
      setBudgetSuccess(true); fetchSettings(); setTimeout(() => setBudgetSuccess(false), 3000)
    } finally { setBudgetSaving(false) }
  }

  const saveFlag = async (patch: { enableV2Routing?: boolean; enableV2Why?: boolean }) => {
    setFlagSaving(true)
    try { await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }) }
    finally { setFlagSaving(false) }
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const isOwner    = settings?.role === 'owner'
  const plan       = settings?.plan ?? 'free'
  const planConfig = settings?.planConfig
  const requestsToday = settings?.requestsToday ?? 0
  const dailyLimit    = planConfig?.requestsPerDay ?? 50
  const usagePct      = dailyLimit === -1 ? 0 : Math.min(Math.round((requestsToday / dailyLimit) * 100), 100)
  const baseUrl       = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')

  const PLAN_PRICES: Record<string, string> = {
    free: 'Free', pro: '$29/mo', pro_trial: 'Trial', scale: '$99/mo',
  }

  if (settingsLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          Manage your API keys, provider key, and feature flags.
        </p>
      </div>

      {/* ── New Key Banner ── */}
      <AnimatePresence>
        {newKey && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="card p-4" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'var(--accent-muted)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--accent)' }}>
              ✓ Key created — copy it now, it won't be shown again
            </p>
            <div className="flex items-center gap-2 rounded px-3 py-2" style={{ background: 'var(--secondary)' }}>
              <code className="text-xs font-mono flex-1 break-all" style={{ color: 'var(--foreground)' }}>{newKey}</code>
              <CopyBtn text={newKey} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Plan & Usage ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Plan &amp; Usage</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${plan === 'free' ? 'badge-gray' : plan === 'pro' ? 'badge-blue' : plan === 'pro_trial' ? 'badge-purple' : 'badge-green'}`}>
              {planConfig?.name ?? 'Free'}
            </span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{PLAN_PRICES[plan] ?? 'Free'}</span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Usage bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Requests today</span>
              <span className="text-xs font-mono tabular" style={{ color: usagePct >= 80 ? 'var(--warning)' : 'var(--foreground)' }}>
                {requestsToday} / {dailyLimit === -1 ? '∞' : dailyLimit}
              </span>
            </div>
            <div className="progress-track h-1.5">
              <motion.div className="progress-fill h-1.5"
                initial={{ width: 0 }} animate={{ width: `${usagePct}%` }}
                style={{ background: usagePct >= 80 ? 'var(--warning)' : 'var(--primary)' }} />
            </div>
            {usagePct >= 80 && (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--warning)' }}>
                <AlertTriangle className="w-3 h-3" /> {usagePct}% of daily limit used
              </p>
            )}
          </div>

          {/* Daily budget limit */}
          <div>
            <label className="section-title block mb-1.5">Daily Spend Limit (USD)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted-foreground)' }}>$</span>
                <input
                  className="input pl-6"
                  type="number" min="1" step="1"
                  value={dailyLimitInput}
                  onChange={e => setDailyLimitInput(e.target.value)}
                />
              </div>
              <button onClick={saveBudget} disabled={budgetSaving}
                className="btn btn-secondary btn-sm" style={{ opacity: budgetSaving ? 0.6 : 1 }}>
                {budgetSaving ? 'Saving…' : budgetSuccess ? '✓ Saved' : 'Save'}
              </button>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Autopilot blocks new requests when this limit is reached.
            </p>
          </div>

          {/* Upgrade CTA */}
          {!isOwner && plan !== 'scale' && (
            <a href="/pricing" className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--primary)' }}>
              <Zap className="w-3.5 h-3.5" />
              {plan === 'free' || plan === 'pro_trial' ? 'Upgrade to Pro — $29/mo' : 'Upgrade to Scale — $99/mo'} →
            </a>
          )}
        </div>
      </div>

      {/* ── Provider API Key (BYOK) ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Provider API Key (BYOK)</h2>
          </div>
          <span className={`badge ${settings?.hasApiKey ? 'badge-green' : 'badge-amber'}`}>
            {settings?.hasApiKey ? 'Configured' : 'Required'}
          </span>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Your OpenAI or Claude key. Vela uses it to make API calls on your behalf. Encrypted with AES-256-GCM.
          </p>

          {settings?.hasApiKey && settings?.keyMask && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'var(--secondary)' }}>
              <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
              <div className="flex-1">
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Current key{settings.provider && ` · ${settings.provider === 'claude' ? 'Claude' : 'OpenAI'}`}
                </p>
                <code className="text-xs font-mono" style={{ color: 'var(--foreground)' }}>{settings.keyMask}</code>
              </div>
              <button onClick={removeByok} className="btn btn-ghost btn-sm p-1.5" style={{ color: 'var(--destructive)' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div>
            <label className="section-title block mb-1.5">{settings?.hasApiKey ? 'Replace Key' : 'Add Key'}</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                className="input pr-10 font-mono"
                placeholder="sk-proj-…"
                value={openAiInput}
                onChange={e => { setOpenAiInput(e.target.value); setByokError('') }}
              />
              <button type="button" onClick={() => setShowKey(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--muted-foreground)' }}>
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {byokError   && <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--destructive)' }}><AlertTriangle className="w-3 h-3" />{byokError}</p>}
            {byokSuccess && <p className="text-xs mt-1" style={{ color: 'var(--accent)' }}>✓ Key saved securely</p>}
            <button onClick={saveByok} disabled={byokSaving || openAiInput.trim().length < 20}
              className="btn btn-primary btn-sm mt-2" style={{ opacity: byokSaving || openAiInput.trim().length < 20 ? 0.6 : 1 }}>
              <ShieldCheck className="w-3.5 h-3.5" />
              {byokSaving ? 'Saving…' : 'Save Key'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Vela API Keys ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Vela API Keys</h2>
            <span className="badge badge-gray">{keys.length}</span>
          </div>
          <button onClick={createKey} disabled={keysLoading} className="btn btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" />
            {keysLoading ? 'Generating…' : 'New Key'}
          </button>
        </div>

        {/* Proxy endpoint */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <p className="section-title mb-1">Proxy Endpoint</p>
          <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: 'var(--secondary)' }}>
            <code className="text-xs font-mono flex-1" style={{ color: 'var(--primary)' }}>{baseUrl}/api/v1/chat/completions</code>
            <CopyBtn text={`${baseUrl}/api/v1/chat/completions`} />
          </div>
        </div>

        {/* Integration snippet */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="section-title mb-1">Quick Integration</p>
          <pre className="text-xs p-3 rounded overflow-x-auto leading-relaxed" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
{`const openai = new OpenAI({
  apiKey:  'vk_live_YOUR_KEY',
  baseURL: '${baseUrl}/api/v1',
})
// Optionally tag for attribution:
// body: { customer_id: 'acme', feature_id: 'search' }`}
          </pre>
        </div>

        {/* Key list */}
        <div>
          {keys.length === 0 ? (
            <div className="empty-state">
              <Key className="w-6 h-6 mb-2" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No keys yet. Create one above.</p>
            </div>
          ) : (
            keys.map((k, i) => (
              <div key={k.id} className="flex items-center justify-between px-4 py-3 card-hover"
                style={{ borderBottom: i < keys.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{k.label || 'API Key'}</span>
                    <span className="badge badge-green">Active</span>
                  </div>
                  <code className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{k.keyPrefix}••••••••••</code>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    Created {new Date(k.createdAt).toLocaleDateString()}
                    {k.lastUsedAt && ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <button onClick={() => revokeKey(k.id)} className="btn btn-ghost btn-sm p-1.5" style={{ color: 'var(--destructive)' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── V2 Features ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <FlaskConical className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Advanced Features</h2>
          <span className="badge badge-amber ml-auto">Beta</span>
        </div>

        <div>
          {[
            {
              id:       'v2-routing',
              icon:     Zap,
              label:    'V2 Routing',
              desc:     '5-tier complexity scoring for more precise model selection.',
              locked:   !planConfig?.v2RoutingAllowed,
              lockedMsg: 'Requires Pro plan',
              checked:  v2Routing,
              onChange: (v: boolean) => { setV2Routing(v); saveFlag({ enableV2Routing: v }) },
            },
            {
              id:       'v2-why',
              icon:     Zap,
              label:    'Personalized WHY',
              desc:     'WHY explanations reference your personal usage history.',
              locked:   false,
              checked:  v2Why,
              onChange: (v: boolean) => { setV2Why(v); saveFlag({ enableV2Why: v }) },
            },
          ].map(f => (
            <div key={f.id} className="flex items-center gap-4 px-4 py-4"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{f.label}</span>
                  {f.locked && <span className="badge badge-gray">{f.lockedMsg}</span>}
                </div>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{f.desc}</p>
              </div>
              <Toggle checked={f.checked} onChange={f.onChange} disabled={flagSaving || f.locked} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
