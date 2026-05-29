'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, ArrowRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

function fmtMicro(micro: number) {
  const usd = micro / 1_000_000
  if (usd < 0.001) return `$${usd.toFixed(6)}`
  return `$${usd.toFixed(4)}`
}

export default function OnboardingStep3() {
  const router = useRouter()
  const [apiKey, setApiKey]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [error, setError]     = useState('')

  useEffect(() => {
    const k = sessionStorage.getItem('vela_api_key') ?? ''
    setApiKey(k)
  }, [])

  const sendRequest = async () => {
    if (!apiKey) { setError('No API key found. Go back to Step 2 and generate one.'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const origin = window.location.origin
      const res = await fetch(`${origin}/api/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'vela-mini',
          messages: [{ role: 'user', content: 'Hello! This is my first Vela request. Reply with a short, friendly greeting in one sentence.' }],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message ?? `Error ${res.status}`)
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Request failed. Check your API key in Settings.')
    } finally {
      setLoading(false)
    }
  }

  const responseText = result?.choices?.[0]?.message?.content ?? ''
  const vela         = result?.vela ?? {}
  const saved        = vela.savingsMicro ?? 0
  const cost         = vela.actualCostMicro ?? 0
  const model        = vela.model ?? 'gpt-4o-mini'
  const reason       = vela.reasonCode ?? ''

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Send your first request</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Click the button below to send a real test request through Vela's proxy.
        </p>
      </div>

      {!result ? (
        <div className="space-y-4">
          {/* Request preview */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Test Message</p>
            <p className="text-sm text-foreground italic">
              "Hello! This is my first Vela request. Reply with a short, friendly greeting in one sentence."
            </p>
          </div>

          {!apiKey && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(245,158,11,0.08)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              No API key found. <button onClick={() => router.push('/onboarding/step2')} className="underline ml-1">Go back to Step 2</button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
            </div>
          )}

          <button onClick={sendRequest} disabled={loading || !apiKey}
            className="btn btn-primary w-full flex items-center justify-center gap-2 py-3">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Routing request...</span></>
              : <><Zap className="w-4 h-4" /><span>Send Test Request</span></>}
          </button>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Success indicator */}
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Request routed successfully!</p>
          </div>

          {/* Response */}
          <div className="card p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Response</p>
            <p className="text-sm text-foreground">{responseText}</p>
          </div>

          {/* Vela metadata */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Model Used',    value: model.replace('gpt-4o-mini', 'GPT-4o-mini').replace('gpt-4o', 'GPT-4o') },
              { label: 'Actual Cost',   value: fmtMicro(cost) },
              { label: 'Saved',         value: fmtMicro(saved), highlight: true },
            ].map(item => (
              <div key={item.label} className="card p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className="text-sm font-bold" style={{ color: item.highlight ? 'var(--accent)' : 'var(--foreground)' }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {reason && (
            <p className="text-xs text-muted-foreground px-1">
              Routing decision: <span className="font-medium text-foreground">{reason.replace(/_/g, ' ')}</span>
            </p>
          )}

          <button onClick={() => router.push('/onboarding/step4')} className="btn btn-primary w-full flex items-center justify-center gap-2">
            <span>View Your Savings</span><ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </motion.div>
  )
}
