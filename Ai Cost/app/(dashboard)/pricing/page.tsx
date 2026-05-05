'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Zap, ArrowRight, Shield } from 'lucide-react'

export default function PricingPage() {
  const [loading, setLoading] = useState(false)

  const handleStartTrial = async () => {
    setLoading(true)
    try {
      await fetch('/api/upgrade', { method: 'POST', body: JSON.stringify({ action: 'start_trial' }) })
      window.location.href = '/dashboard'
    } finally {
      setLoading(false)
    }
  }

  const handleUpgradeClick = async () => {
    setLoading(true)
    try {
      // Mock payment flow
      await fetch('/api/upgrade', { method: 'POST', body: JSON.stringify({ action: 'upgrade_pro' }) })
      window.location.href = '/dashboard'
    } finally {
      setLoading(false)
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Simple, Transparent Pricing</h1>
        <p className="text-muted-foreground text-lg">Pays for itself after ₹700 usage.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Free Plan */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-8 flex flex-col"
        >
          <div className="mb-6">
            <h3 className="text-xl font-bold text-foreground mb-2">Free</h3>
            <p className="text-muted-foreground text-sm">Perfect to test the waters</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold">₹0</span>
              <span className="text-muted-foreground text-sm">/mo</span>
            </div>
          </div>
          <ul className="space-y-4 mb-8 flex-1 text-sm text-foreground/90">
            <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-muted-foreground shrink-0" /> 500 requests/day</li>
            <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-muted-foreground shrink-0" /> Basic autopilot</li>
            <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-muted-foreground shrink-0" /> Standard routing</li>
          </ul>
          <button disabled={loading} onClick={handleStartTrial} className="w-full py-2.5 rounded-xl bg-secondary text-foreground font-semibold hover:bg-secondary/80 transition">Start 14-Day Free Trial</button>
        </motion.div>

        {/* Pro Plan */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-8 flex flex-col border border-primary/40 relative glow-green md:scale-[1.03] z-10"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-blue-500 rounded-t-2xl" />
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.4)]">
            Most Popular
          </div>
          <div className="mb-6">
            <h3 className="text-xl font-bold text-foreground mb-2">Pro</h3>
            <p className="text-primary text-sm font-medium">Unlocks more savings</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold">₹2,499</span>
              <span className="text-muted-foreground text-sm">/mo</span>
            </div>
          </div>
          <ul className="space-y-4 mb-8 flex-1 text-sm text-foreground/90">
            <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> Unlimited requests</li>
            <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> Advanced autopilot</li>
            <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> Better optimization</li>
          </ul>
          <button disabled={loading} onClick={handleUpgradeClick} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition shadow-[0_0_15px_rgba(16,185,129,0.4)]">Unlock full savings (Pay)</button>
        </motion.div>

        {/* Scale Plan */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-8 flex flex-col"
        >
          <div className="mb-6">
            <h3 className="text-xl font-bold text-foreground mb-2">Scale</h3>
            <p className="text-muted-foreground text-sm">For high-volume teams</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold">₹8,499</span>
              <span className="text-muted-foreground text-sm">/mo</span>
            </div>
          </div>
          <ul className="space-y-4 mb-8 flex-1 text-sm text-foreground/90">
            <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" /> Highest limits</li>
            <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" /> Priority routing</li>
            <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" /> Max savings</li>
          </ul>
          <button onClick={handleUpgradeClick} className="w-full py-2.5 rounded-xl bg-secondary text-foreground font-semibold hover:bg-secondary/80 transition">Contact Sales</button>
        </motion.div>
      </div>

      {/* ROI & Savings Explanation */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-2xl p-8 border border-primary/20 bg-primary/5"
      >
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-foreground mb-2">The ROI of Vela Autopilot</h3>
          <p className="text-muted-foreground text-sm">How we guarantee your software pays for itself.</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h4 className="font-semibold text-foreground">Immediate Savings</h4>
            <p className="text-sm text-muted-foreground">Vela automatically downgrades simple queries to cheaper models, saving you up to 90% on everyday API calls.</p>
          </div>
          
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
              <ArrowRight className="w-5 h-5 text-blue-500" />
            </div>
            <h4 className="font-semibold text-foreground">Zero Compromise</h4>
            <p className="text-sm text-muted-foreground">Complex tasks still route to premium models (like GPT-4o), ensuring your application quality never degrades.</p>
          </div>
          
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-5 h-5 text-amber-500" />
            </div>
            <h4 className="font-semibold text-foreground">Guaranteed ROI</h4>
            <p className="text-sm text-muted-foreground">Once you process more than ₹700 of AI usage through Vela, the Pro plan pays for itself in direct cost reductions.</p>
          </div>
        </div>
      </motion.div>
      
      <div className="text-center pt-8 border-t border-border/50">
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Shield className="w-4 h-4" /> Trusted by engineering teams everywhere.
        </p>
      </div>
    </div>
  )
}
