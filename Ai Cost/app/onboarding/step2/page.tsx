'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, ArrowRight, Key } from 'lucide-react'
import { motion } from 'framer-motion'

export default function OnboardingStep2() {
  const router = useRouter()
  const [generatedKey, setGeneratedKey] = useState('')
  const [loading, setLoading]           = useState(false)
  const [copied, setCopied]             = useState(false)
  const [error, setError]               = useState('')

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-vela-domain.com'

  const generateKey = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'My First Key' }),
      })
      if (!res.ok) throw new Error('Failed to generate key')
      const data = await res.json()
      const key  = data.key ?? data.apiKey ?? data.fullKey ?? ''
      setGeneratedKey(key)
      // Store for step 3
      if (key) sessionStorage.setItem('vela_api_key', key)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Create your Vela API key</h1>
        <p className="text-sm text-muted-foreground mt-1">
          This key replaces your OpenAI or Claude key in your app. Point your app here instead.
        </p>
      </div>

      {!generatedKey ? (
        <div className="space-y-4">
          <div className="card p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--secondary)' }}>
              <Key className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">One-time display</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your full key will only be shown once. Copy it before leaving this page.
              </p>
            </div>
          </div>

          {error && (
            <p className="text-sm px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
              {error}
            </p>
          )}

          <button onClick={generateKey} disabled={loading} className="btn btn-primary w-full flex items-center justify-center gap-2">
            {loading ? 'Generating...' : <><Key className="w-4 h-4" /><span>Generate API Key</span></>}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Key display */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Vela API Key</p>
              <button onClick={() => copy(generatedKey)} className="flex items-center gap-1 text-xs transition"
                style={{ color: copied ? 'var(--accent)' : 'var(--muted-foreground)' }}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <code className="block text-xs font-mono break-all" style={{ color: 'var(--foreground)' }}>
              {generatedKey}
            </code>
          </div>

          {/* Code snippet */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-2" style={{ background: 'var(--secondary)' }}>
              <p className="text-xs font-semibold text-muted-foreground">Python · OpenAI SDK</p>
              <button onClick={() => copy(`from openai import OpenAI\n\nclient = OpenAI(\n    api_key="${generatedKey}",\n    base_url="${origin}/api/v1"\n)\n\nresponse = client.chat.completions.create(\n    model="vela-mini",\n    messages=[{"role": "user", "content": "Hello!"}]\n)`)}
                className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Copy
              </button>
            </div>
            <pre className="text-xs p-4 overflow-x-auto" style={{ color: 'var(--foreground)', background: '#0d0d0d' }}>
{`from openai import OpenAI

client = OpenAI(
    api_key="${generatedKey}",
    base_url="${origin}/api/v1"
)

response = client.chat.completions.create(
    model="vela-mini",
    messages=[{"role": "user", "content": "Hello!"}]
)`}
            </pre>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: 'rgba(99,102,241,0.08)', color: '#818cf8' }}>
            <span>ℹ</span>
            <span>Use <code>vela-mini</code> or <code>vela-pro</code> as the model. We route to the optimal provider automatically.</span>
          </div>

          <button onClick={() => router.push('/onboarding/step3')} className="btn btn-primary w-full flex items-center justify-center gap-2">
            <span>I've saved my key</span><ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </motion.div>
  )
}
