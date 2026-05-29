'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Shield, ArrowRight, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'

function detectProvider(key: string): 'openai' | 'claude' | 'unknown' {
  if (key.startsWith('sk-ant-')) return 'claude'
  if (key.startsWith('sk-'))     return 'openai'
  return 'unknown'
}

export default function OnboardingStep1() {
  const router  = useRouter()
  const [key, setKey]         = useState('')
  const [show, setShow]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const provider = detectProvider(key)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim()) { setError('Please enter your API key'); return }
    if (provider === 'unknown') { setError('Key must start with sk- (OpenAI) or sk-ant- (Claude)'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openAiKey: key.trim() }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed to save key') }
      sessionStorage.setItem('vela_provider', provider)
      router.push('/onboarding/step2')
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Connect your AI provider</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add your OpenAI or Claude API key. We encrypt it with AES-256-GCM and never expose it.
        </p>
      </div>
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <Shield className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
        <p style={{ color: 'var(--accent)' }}>Your key is encrypted with AES-256-GCM. Never logged or transmitted in plaintext.</p>
      </div>
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-muted-foreground">API Key</label>
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={key}
              onChange={e => { setKey(e.target.value); setError('') }}
              placeholder="sk-... or sk-ant-..." className="input w-full pr-10 font-mono text-sm" autoComplete="off" />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }}>
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {key.length > 4 && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: provider === 'unknown' ? '#ef4444' : 'var(--accent)' }} />
              <span className="text-xs text-muted-foreground">
                {provider === 'openai' ? '✓ OpenAI key detected' : provider === 'claude' ? '✓ Claude key detected' : '⚠ Unrecognised format'}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <button type="submit" disabled={loading || !key.trim()} className="btn btn-primary w-full flex items-center justify-center gap-2">
            {loading ? 'Saving...' : <><span>Save & Continue</span><ArrowRight className="w-4 h-4" /></>}
          </button>
          <button type="button" onClick={() => router.push('/onboarding/step2')}
            className="text-xs text-center py-2" style={{ color: 'var(--muted-foreground)' }}>
            I'll add my key later →
          </button>
        </div>
      </form>
    </motion.div>
  )
}
