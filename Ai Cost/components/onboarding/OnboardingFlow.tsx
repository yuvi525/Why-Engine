'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, DollarSign, Code, Check } from 'lucide-react'

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [providerKey, setProviderKey] = useState('')
  const [provider, setProvider] = useState<'openai' | 'claude'>('openai')
  const [error, setError] = useState('')
  const [apiKey, setApiKey] = useState('')

  const handleSaveProviderKey = async () => {
    if (!providerKey.startsWith('sk-') || providerKey.length < 20) {
      setError('Invalid key format. Must start with sk-')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ openAiKey: providerKey })
    })
    if (res.ok) {
      setStep(3)
    } else {
      setError('Failed to save key')
    }
    setLoading(false)
  }

  const handleCreateKey = async () => {
    setLoading(true)
    const res = await fetch('/api/keys', { method: 'POST', body: JSON.stringify({ label: 'Vela Production Key' }) })
    const data = await res.json()
    if (data.key) {
      setApiKey(data.key)
      setStep(4)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 glass-card rounded-2xl overflow-hidden">
      <div className="p-8 border-b border-border bg-secondary/10">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome to Vela Autopilot</h2>
        <p className="text-muted-foreground mt-2">Let's set up your AI routing proxy in 3 simple steps.</p>
      </div>
      
      <div className="p-8">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">1</div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Add your API key to start saving</h3>
                  <p className="text-sm text-muted-foreground">Select your provider below.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => { setProvider('openai'); setStep(2) }} className="p-4 border border-border rounded-xl hover:border-primary transition flex flex-col items-center gap-2">
                   <span className="font-semibold">OpenAI</span>
                 </button>
                 <button onClick={() => { setProvider('claude'); setStep(2) }} className="p-4 border border-border rounded-xl hover:border-primary transition flex flex-col items-center gap-2">
                   <span className="font-semibold">Claude</span>
                 </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
             <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="flex items-center space-x-4">
                   <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">2</div>
                   <div>
                     <h3 className="text-lg font-semibold text-foreground">Enter {provider === 'openai' ? 'OpenAI' : 'Claude'} API Key</h3>
                     <p className="text-sm text-muted-foreground">Securely connect your account.</p>
                   </div>
                </div>
                <div>
                   <input type="password" value={providerKey} onChange={(e) => setProviderKey(e.target.value)} className="w-full bg-secondary border border-border rounded-xl p-3 text-foreground" placeholder="sk-..." />
                   <p className="text-xs text-muted-foreground mt-2 font-medium">Your key is never stored in plain text</p>
                   {error && <p className="text-xs text-destructive mt-1">{error}</p>}
                </div>
                <button onClick={handleSaveProviderKey} disabled={loading} className="w-full py-3 bg-foreground text-background rounded-lg font-medium transition disabled:opacity-50">
                  {loading ? 'Saving...' : 'Save Key'}
                </button>
             </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Generate Proxy Key</h3>
                  <p className="text-sm text-muted-foreground">This key authenticates your app with the Vela proxy.</p>
                </div>
              </div>
              <button
                onClick={handleCreateKey}
                disabled={loading}
                className="w-full py-3 px-4 bg-foreground hover:bg-foreground/90 text-background rounded-lg font-medium transition disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <Key className="w-4 h-4" />
                <span>{loading ? 'Generating...' : 'Generate Secret Key'}</span>
              </button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">4</div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Secure your Key</h3>
                  <p className="text-sm text-muted-foreground">Copy this key now. It won't be shown again.</p>
                </div>
              </div>
              
              <div className="bg-secondary p-4 rounded-xl border border-border flex justify-between items-center">
                <code className="text-sm font-mono text-foreground">{apiKey}</code>
              </div>

              <button
                onClick={() => setStep(5)}
                className="w-full py-3 px-4 bg-foreground hover:bg-foreground/90 text-background rounded-lg font-medium transition"
              >
                I've copied my key
              </button>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">5</div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Integrate Proxy</h3>
                  <p className="text-sm text-muted-foreground">Update your OpenAI client base URL.</p>
                </div>
              </div>

              <div className="bg-secondary p-4 rounded-xl border border-border text-sm font-mono overflow-x-auto text-muted-foreground">
                <span className="text-primary">import</span> OpenAI <span className="text-primary">from</span> 'openai'<br/><br/>
                <span className="text-primary">const</span> client = <span className="text-primary">new</span> OpenAI({'{'}<br/>
                &nbsp;&nbsp;apiKey: <span className="text-amber-500">'{apiKey}'</span>,<br/>
                &nbsp;&nbsp;baseURL: <span className="text-amber-500">'{typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_APP_URL || window.location.origin) : "https://your-domain.com"}/api/v1'</span><br/>
                {'}'})
              </div>

              <button
                onClick={onComplete}
                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition flex items-center justify-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Go to Dashboard</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
