'use client'

import { motion } from 'framer-motion'
import { Sparkles, Zap, BrainCircuit, Activity } from 'lucide-react'

const providers = [
  { name: 'OpenAI', icon: <Zap className="w-5 h-5 text-green-400" />, status: 'Active' },
  { name: 'Claude', icon: <BrainCircuit className="w-5 h-5 text-purple-400" />, status: 'Active' },
  { name: 'Gemini', icon: <Sparkles className="w-5 h-5 text-blue-400" />, status: 'Coming Soon' },
]

export function ProviderCarousel() {
  return (
    <div className="w-full max-w-2xl mx-auto overflow-hidden relative py-12">
      {/* Fade masks */}
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent z-10" />
      
      <motion.div
        className="flex gap-6 items-center w-max"
        animate={{ x: [0, -600] }}
        transition={{ repeat: Infinity, ease: 'linear', duration: 15 }}
      >
        {/* Render 3 times to create seamless loop */}
        {[...providers, ...providers, ...providers].map((p, i) => (
          <div key={i} className="flex items-center gap-3 glass-card rounded-2xl px-5 py-3 transition-all hover:scale-105">
            {p.icon}
            <div>
              <p className="font-semibold text-foreground text-sm leading-tight">{p.name}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mt-0.5">
                {p.status === 'Active' && <Activity className="w-3 h-3 text-primary" />}
                {p.status}
              </p>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  )
}
