'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Zap, ArrowRight, ShieldCheck, TrendingDown, LayoutDashboard } from 'lucide-react'
import { ProviderCarousel } from '@/components/ProviderCarousel'

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    fetch('/api/auth/check')
      .then(res => res.json())
      .then(data => {
        if (data.loggedIn) setIsLoggedIn(true)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans overflow-x-hidden">
      {/* Navigation */}
      <header className="px-6 py-4 flex justify-between items-center z-20 absolute top-0 w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
            <Zap className="w-4 h-4 text-white" strokeWidth={3} />
          </div>
          <span className="text-xl font-bold tracking-tight">Vela</span>
        </div>
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <Link href="/dashboard" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2 shadow-[0_0_16px_rgba(16,185,129,0.3)]">
              <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition">
                Sign In
              </Link>
              <Link href="/login" className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-semibold transition shadow-[0_0_16px_rgba(16,185,129,0.3)]">
                Get Started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center pt-32 pb-20 px-4 relative overflow-hidden">
        {/* Background Gradients & Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-1/3 -translate-x-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        
        {/* Subtle Floating Elements */}
        <motion.div 
          animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }} 
          transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
          className="absolute top-1/4 right-1/4 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10"
        />
        <motion.div 
          animate={{ y: [0, 30, 0], opacity: [0.2, 0.5, 0.2] }} 
          transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
          className="absolute bottom-1/3 left-1/4 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -z-10"
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-4xl w-full"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border text-sm font-semibold text-muted-foreground mb-8">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Vela Autopilot v1.0 is Live
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground leading-[1.1] mb-6 relative z-10">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-500 blur-2xl opacity-20 -z-10" />
            Reduce AI Costs by <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-300 to-blue-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              60–90% Automatically
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Stop overpaying for simple tasks. Vela sits between your app and your AI provider, 
            intelligently routing requests to the cheapest capable model in milliseconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-8 py-3.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-base font-semibold transition flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(16,185,129,0.4)]"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-3.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-base font-semibold transition flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(16,185,129,0.4)]"
              >
                Start Saving Now <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-400 mb-16">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live proxy — routing AI requests in real time
          </div>

          {/* Stats Preview */}
          <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto mb-16">
            <motion.div whileHover={{ scale: 1.02 }} className="glass-card rounded-2xl p-5 text-center">
              <TrendingDown className="w-6 h-6 text-primary mx-auto mb-3" />
              <p className="text-4xl font-bold text-foreground">60–90%</p>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-1">Cost Reduction</p>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} className="glass-card rounded-2xl p-5 text-center">
              <Zap className="w-6 h-6 text-blue-400 mx-auto mb-3 glow-blue" />
              <p className="text-4xl font-bold text-foreground">&lt;15ms</p>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-1">Routing Overhead</p>
            </motion.div>
          </div>
        </motion.div>

        {/* Carousel */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="w-full"
        >
          <ProviderCarousel />
        </motion.div>
      </main>
    </div>
  )
}
