'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Key, Plus, Trash2, Settings, Copy, Check,
  Zap, FlaskConical, Eye, EyeOff, Shield,
  ShieldCheck, TrendingUp, AlertTriangle, X,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="text-muted-foreground hover:text-foreground transition p-1 rounded"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function Toggle({
  id, checked, onChange, disabled,
}: { id: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      id={id}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
        checked ? 'bg-primary' : 'bg-secondary'
      } disabled:opacity-50`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  )
}

const PLAN_COLORS: Record<string, string> = {
  free:  'bg-secondary text-muted-foreground border border-border',
  pro:   'bg-blue-900/30 text-blue-400 border border-blue-900/50',
  scale: 'bg-amber-900/30 text-amber-400 border border-amber-900/50',
}

// ── Main Component ────────────────────────────────────────────────────

export default function SettingsPage() {
  const [keys, setKeys]             = useState<any[]>([])
  const [keysLoading, setKeysLoading] = useState(false)
  const [newKey, setNewKey]         = useState<string | null>(null)

  // Settings state (loaded from /api/settings)
  const [settings, setSettings]     = useState<any>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)

  // BYOK state
  const [openAiInput, setOpenAiInput]   = useState('')
  const [showKey, setShowKey]           = useState(false)
  const [byokSaving, setByokSaving]     = useState(false)
  const [byokError, setByokError]       = useState('')
  const [byokSuccess, setByokSuccess]   = useState(false)

  // Flag state
  const [v2Routing, setV2Routing]   = useState(false)
  const [v2Why, setV2Why]           = useState(false)
  const [flagSaving, setFlagSaving] = useState(false)

  // Upgrade banner
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  // ── Data loading ────────────────────────────────────────────────────

  const fetchKeys = () =>
    fetch('/api/keys').then(r => r.json()).then(d => setKeys(d.keys || []))

  const fetchSettings = () =>
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        setSettings(d)
        setV2Routing(d.v2RoutingEnabled ?? false)
        setV2Why(d.v2WhyEnabled ?? false)
        // Show upgrade banner if on free and made >30 requests today
        if (d.plan === 'free' && (d.requestsToday ?? 0) > 30) {
          setShowUpgradeBanner(true)
        }
      })
      .finally(() => setSettingsLoading(false))

  useEffect(() => {
    fetchKeys()
    fetchSettings()
  }, [])

  // ── Actions ─────────────────────────────────────────────────────────

  const createKey = async () => {
    setKeysLoading(true)
    setNewKey(null)
    const res  = await fetch('/api/keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Production Key' }),
    })
    const data = await res.json()
    if (data.key) { setNewKey(data.key); fetchKeys() }
    setKeysLoading(false)
  }

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    await fetch(`/api/keys/${id}`, { method: 'DELETE' })
    fetchKeys()
  }

  const saveByok = async () => {
    setByokSaving(true)
    setByokError('')
    setByokSuccess(false)
    try {
      const res  = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openAiKey: openAiInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setByokError(data.error ?? 'Failed to save key.')
      } else {
        setByokSuccess(true)
        setOpenAiInput('')
        await fetchSettings() // refresh mask
        setTimeout(() => setByokSuccess(false), 3000)
      }
    } catch {
      setByokError('Network error — please try again.')
    } finally {
      setByokSaving(false)
    }
  }

  const removeByok = async () => {
    if (!confirm('Remove your OpenAI API key? Requests will stop working until you add a new one.')) return
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeOpenAiKey: true }),
    })
    await fetchSettings()
  }

  const saveFlags = async (patch: { enableV2Routing?: boolean; enableV2Why?: boolean }) => {
    setFlagSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    } catch { /* non-critical */ } finally {
      setFlagSaving(false)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────

  const plan       = settings?.plan ?? 'free'
  const planConfig = settings?.planConfig
  const requestsToday = settings?.requestsToday ?? 0
  const dailyLimit = planConfig?.requestsPerDay ?? 50
  const usagePct   = dailyLimit === -1 ? 0 : Math.min(Math.round((requestsToday / dailyLimit) * 100), 100)
  const nearLimit  = usagePct >= 80

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Settings className="w-7 h-7 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your API keys, OpenAI key, plan, and advanced features.</p>
      </motion.div>

      {/* ── UPGRADE BANNER ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showUpgradeBanner && plan === 'free' && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className="relative bg-gradient-to-r from-primary/10 to-blue-900/20 border border-primary/20 rounded-2xl p-5 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
            <button
              onClick={() => setShowUpgradeBanner(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">
                  You're approaching your Free plan limit
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  Upgrade to Pro for 2,000 requests/day, V2 routing, and shadow analytics.
                </p>
                <a
                  href="mailto:upgrade@getvela.ai?subject=Upgrade%20to%20Pro"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold transition shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Upgrade to Pro — $29/mo
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Vela key alert */}
      {newKey && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/5 border border-primary/20 rounded-2xl p-5"
        >
          <p className="text-sm font-semibold text-primary mb-2">✓ Key created — copy it now, it won't be shown again.</p>
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-4 py-2.5">
            <code className="text-xs font-mono text-foreground flex-1 break-all">{newKey}</code>
            <CopyButton text={newKey} />
          </div>
        </motion.div>
      )}

      {/* ── PLAN CARD ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground text-sm">Plan & Usage</h2>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${PLAN_COLORS[plan]}`}>
            {planConfig?.name ?? 'Free'}
          </span>
        </div>

        <div className="px-6 py-5 space-y-4">
          {settingsLoading ? (
            <div className="h-16 flex items-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Request usage bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Requests Today
                  </span>
                  <span className={`text-xs font-bold tabular-nums ${nearLimit ? 'text-amber-400' : 'text-foreground'}`}>
                    {requestsToday.toLocaleString()} / {dailyLimit === -1 ? '∞' : dailyLimit.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePct}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className={`h-full rounded-full ${nearLimit ? 'bg-amber-400' : 'bg-primary'}`}
                  />
                </div>
                {nearLimit && (
                  <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {usagePct}% of daily limit used — consider upgrading
                  </p>
                )}
              </div>

              {/* Plan features */}
              {planConfig && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {[
                    { label: 'Daily Budget Cap', value: `$${planConfig.dailyBudgetCapUsd}` },
                    { label: 'V2 Routing',       value: planConfig.v2RoutingAllowed ? '✓ Included' : '✗ Pro+' },
                    { label: 'Shadow Analytics', value: planConfig.shadowAnalytics   ? '✓ Included' : '✗ Pro+' },
                    { label: 'Support',          value: planConfig.supportLevel },
                  ].map(f => (
                    <div key={f.label} className="bg-secondary/40 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{f.label}</p>
                      <p className={`text-xs font-semibold ${f.value.startsWith('✓') ? 'text-primary' : f.value.startsWith('✗') ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {f.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {plan !== 'scale' && (
                <a
                  href="mailto:upgrade@getvela.ai?subject=Upgrade%20Vela%20Plan"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {plan === 'free' ? 'Upgrade to Pro — $29/mo →' : 'Upgrade to Scale — $99/mo →'}
                </a>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* ── BYOK SECTION ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border flex items-center gap-2 bg-secondary/20">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground text-sm">OpenAI API Key (BYOK)</h2>
          <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider ml-auto">
            {settings?.hasApiKey ? 'Configured' : 'Required'}
          </span>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Vela uses your OpenAI key to make API calls on your behalf. Your key is encrypted with AES-256-GCM and never stored in plaintext.
          </p>

          {/* Current key display */}
          {settings?.hasApiKey && settings?.keyMask && (
            <div className="flex items-center gap-3 bg-secondary/40 border border-border/50 rounded-xl px-4 py-3">
              <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Current Key</p>
                <code className="text-xs font-mono text-foreground">{settings.keyMask}</code>
              </div>
              <button
                onClick={removeByok}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition"
                title="Remove key"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Key input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              {settings?.hasApiKey ? 'Replace Key' : 'Add Key'}
            </label>
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                id="openai-key-input"
                type={showKey ? 'text' : 'password'}
                value={openAiInput}
                onChange={e => { setOpenAiInput(e.target.value); setByokError('') }}
                placeholder="sk-proj-..."
                className="w-full bg-secondary border border-border text-foreground rounded-xl px-4 py-2.5 pr-10 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition placeholder:text-muted-foreground font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(s => !s)}
                className="absolute right-3 text-muted-foreground hover:text-foreground transition"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {byokError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {byokError}
              </p>
            )}

            {byokSuccess && (
              <p className="text-xs text-primary flex items-center gap-1">
                <Check className="w-3 h-3" />
                API key saved and encrypted successfully.
              </p>
            )}

            <button
              id="save-openai-key"
              onClick={saveByok}
              disabled={byokSaving || openAiInput.trim().length < 20}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold transition disabled:opacity-40 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
            >
              {byokSaving ? (
                <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
              ) : (
                <><ShieldCheck className="w-3.5 h-3.5" /> Save Key</>
              )}
            </button>
          </div>

          <div className="flex items-start gap-2 bg-secondary/30 rounded-xl px-3 py-2.5 border border-border/30">
            <Shield className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Encrypted with AES-256-GCM using a server-only key. We never log, transmit, or store your key in plaintext. You can remove it at any time.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── VELA API KEYS ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/20">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground text-sm">Vela API Keys</h2>
            <span className="text-xs text-muted-foreground">({keys.length})</span>
          </div>
          <button
            onClick={createKey}
            disabled={keysLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
          >
            <Plus className="w-3.5 h-3.5" />
            {keysLoading ? 'Generating...' : 'New Key'}
          </button>
        </div>

        {/* Proxy endpoint */}
        <div className="px-6 py-4 bg-secondary/10 border-b border-border">
          <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Proxy Endpoint</p>
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-4 py-2.5">
            <code className="text-xs font-mono text-primary flex-1">http://localhost:3000/api/v1/chat/completions</code>
            <CopyButton text="http://localhost:3000/api/v1/chat/completions" />
          </div>
        </div>

        <div className="divide-y divide-border/50">
          {keys.map((k, i) => (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              key={k.id}
              className="px-6 py-4 flex items-center justify-between hover:bg-secondary/20 transition"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground">{k.label || 'API Key'}</span>
                  <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <code className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">{k.keyPrefix}••••••••••••••</code>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Created {new Date(k.createdAt).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => revokeKey(k.id)}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
          {keys.length === 0 && (
            <div className="px-6 py-10 text-center text-muted-foreground">
              <Key className="w-6 h-6 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No API keys yet. Create one above.</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── INTEGRATION SNIPPET ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-card border border-border rounded-2xl p-6"
      >
        <h2 className="font-semibold text-foreground text-sm mb-4">Quick Integration</h2>
        <div className="bg-secondary rounded-xl p-4 overflow-x-auto">
          <pre className="text-xs text-muted-foreground font-mono leading-relaxed">
{`import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: 'vk_live_YOUR_KEY',
  baseURL: 'http://localhost:3000/api/v1'
})

const response = await client.chat.completions.create({
  model: 'vela-mini',   // or 'vela-pro'
  messages: [{ role: 'user', content: 'Hello!' }]
})`}
          </pre>
        </div>
      </motion.div>

      {/* ── V2 FEATURES ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border flex items-center gap-2 bg-secondary/20">
          <FlaskConical className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground text-sm">V2 Features</h2>
          <span className="text-[10px] font-semibold bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-wider">Beta</span>
        </div>

        <div className="divide-y divide-border/50">
          {/* V2 Routing toggle */}
          <div className="px-6 py-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">V2 Routing</span>
                {!settings?.planConfig?.v2RoutingAllowed && (
                  <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded font-semibold">Pro+</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground max-w-sm">
                5-tier complexity scoring for more precise model selection.
              </p>
            </div>
            <Toggle
              id="toggle-v2-routing"
              checked={v2Routing}
              disabled={flagSaving || !settings?.planConfig?.v2RoutingAllowed}
              onChange={next => { setV2Routing(next); saveFlags({ enableV2Routing: next }) }}
            />
          </div>

          {/* V2 WHY toggle */}
          <div className="px-6 py-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Personalized WHY Explanations</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm">
                WHY explanations reference your personal usage history.
              </p>
            </div>
            <Toggle
              id="toggle-v2-why"
              checked={v2Why}
              disabled={flagSaving}
              onChange={next => { setV2Why(next); saveFlags({ enableV2Why: next }) }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
