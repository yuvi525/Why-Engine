'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Key, Plus, Trash2, Settings, Copy, Check, Zap, FlaskConical } from 'lucide-react'

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

export default function SettingsPage() {
  const [keys, setKeys]               = useState<any[]>([])
  const [loading, setLoading]         = useState(false)
  const [newKey, setNewKey]           = useState<string | null>(null)
  const [v2Routing, setV2Routing]     = useState(false)
  const [v2Why, setV2Why]             = useState(false)
  const [flagSaving, setFlagSaving]   = useState(false)

  const fetchKeys = () =>
    fetch('/api/keys').then(r => r.json()).then(d => setKeys(d.keys || []))

  useEffect(() => {
    fetchKeys()
    // Load current flag state from settings API
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        setV2Routing(d.v2RoutingEnabled ?? false)
        setV2Why(d.v2WhyEnabled ?? false)
      })
      .catch(() => { /* non-critical */ })
  }, [])

  const createKey = async () => {
    setLoading(true)
    setNewKey(null)
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Production Key' }),
    })
    const data = await res.json()
    if (data.key) { setNewKey(data.key); fetchKeys() }
    setLoading(false)
  }

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    await fetch(`/api/keys/${id}`, { method: 'DELETE' })
    fetchKeys()
  }

  const saveFlags = async (patch: { enableV2Routing?: boolean; enableV2Why?: boolean }) => {
    setFlagSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    } catch { /* non-critical */ } finally {
      setFlagSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Settings className="w-7 h-7 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage API keys and workspace configuration.</p>
      </motion.div>

      {/* New key alert */}
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

      {/* API Keys section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/20">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground text-sm">API Keys</h2>
            <span className="text-xs text-muted-foreground">({keys.length})</span>
          </div>
          <button
            onClick={createKey}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
          >
            <Plus className="w-3.5 h-3.5" />
            {loading ? 'Generating...' : 'New Key'}
          </button>
        </div>

        {/* Integration snippet */}
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

      {/* Usage guide */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
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

      {/* V2 Features section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
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
              </div>
              <p className="text-xs text-muted-foreground max-w-sm">
                5-tier complexity scoring for more precise model selection. Requires shadow data to be meaningful.
              </p>
            </div>
            <button
              id="toggle-v2-routing"
              disabled={flagSaving}
              onClick={() => {
                const next = !v2Routing
                setV2Routing(next)
                saveFlags({ enableV2Routing: next })
              }}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                v2Routing ? 'bg-primary' : 'bg-secondary'
              } disabled:opacity-50`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                v2Routing ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* V2 WHY toggle */}
          <div className="px-6 py-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Personalized WHY Explanations</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm">
                WHY explanations reference your personal usage history (request count, quality rates, total savings).
              </p>
            </div>
            <button
              id="toggle-v2-why"
              disabled={flagSaving}
              onClick={() => {
                const next = !v2Why
                setV2Why(next)
                saveFlags({ enableV2Why: next })
              }}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                v2Why ? 'bg-primary' : 'bg-secondary'
              } disabled:opacity-50`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                v2Why ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
