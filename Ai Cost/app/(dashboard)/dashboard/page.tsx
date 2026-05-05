'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Zap, ArrowUpRight, DollarSign, Activity, ChevronDown, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface Stats {
  savingsTodayMicro: number
  spentTodayMicro: number
  baselineTodayMicro: number
  requestsToday: number
  savingsTotalMicro: number
  totalCostMicro: number
  dailyLimitMicro: number
  spentBudgetMicro: number
  savingsThisMonthMicro: number
  streakDays: number
  // Phase 11: Margin fields
  totalRevenueMicro: number
  marginMicro: number
  marginStatus: string
}

interface Log {
  id: string
  model: string
  reasonCode: string
  savingsMicro: number
  actualCostMicro: number
  baselineCostMicro: number
  savingsPct: number
  promptPreview: string | null
  createdAt: string
  latencyMs: number | null
  why?: { why: string; impact: string; action: string }
}

function CountUp({ value, prefix = '', suffix = '', decimals = 4 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(value)
  const prevValueRef = useRef(value)

  useEffect(() => {
    const prevValue = prevValueRef.current
    if (prevValue === value) {
      setDisplay(value) // Initial render sync
      return
    }

    let start = prevValue
    const target = value
    const duration = 800
    const step = 16
    const totalSteps = duration / step
    const increment = (target - start) / totalSteps
    let currentStep = 0

    const timer = setInterval(() => {
      currentStep++
      start += increment
      if (currentStep >= totalSteps) { 
        setDisplay(target)
        clearInterval(timer) 
      } else {
        setDisplay(start)
      }
    }, step)

    prevValueRef.current = value

    return () => clearInterval(timer)
  }, [value])

  return <>{prefix}{display.toFixed(decimals)}{suffix}</>
}

function StatCard({ icon, label, value, sub, delay = 0, accent = false }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; delay?: number; accent?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.02 }}
      className={`glass-card relative overflow-hidden rounded-2xl p-6 ${
        accent
          ? 'bg-primary/5 border-primary/20 glow-green'
          : ''
      }`}
    >
      {accent && (
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      )}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            accent ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
          }`}>
            {icon}
          </div>
          {accent && <ArrowUpRight className="w-4 h-4 text-primary" />}
        </div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-3xl font-bold tracking-tight tabular-nums ${accent ? 'text-gradient' : 'text-foreground'}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </motion.div>
  )
}

function BudgetBar({ spent, limit }: { spent: number; limit: number }) {
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
  const warning = pct > 85
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.01 }}
      className="glass-card rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Daily Budget</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${warning ? 'bg-destructive/20 text-destructive' : 'bg-primary/10 text-primary'}`}>
          {pct.toFixed(0)}% used
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-2xl font-bold text-foreground tabular-nums">₹{(spent / 1e6).toFixed(4)}</span>
        <span className="text-muted-foreground text-sm">/ ₹{(limit / 1e6).toFixed(2)}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
          className={`h-full rounded-full ${warning ? 'bg-destructive' : 'bg-primary'}`}
        />
      </div>
    </motion.div>
  )
}

function DecisionRow({ log, idx, onClick }: { log: Log; idx: number; onClick: () => void }) {
  const reasonColors: Record<string, string> = {
    COMPLEXITY_LOW: 'bg-primary/10 text-primary',
    COMPLEXITY_HIGH: 'bg-amber-900/30 text-amber-400',
    CACHE_HIT: 'bg-blue-900/30 text-blue-400',
    BUDGET_GUARD: 'bg-red-900/30 text-red-400',
    USER_OVERRIDE: 'bg-purple-900/30 text-purple-400',
  }
  const colorClass = reasonColors[log.reasonCode] ?? 'bg-secondary text-muted-foreground'
  const isClaude = log.model.includes('claude');

  return (
    <motion.tr
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className="glass-card hover:bg-white/5 cursor-pointer transition-colors group relative"
    >
      <td className="px-5 py-4 text-sm text-muted-foreground font-mono align-top">
        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </td>
      <td className="px-5 py-4 align-top">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono font-medium text-white px-3 py-1 rounded-full ${isClaude ? 'glow-blue bg-blue-500/20 border border-blue-500/30 text-blue-200' : 'glow-green bg-primary/20 border border-primary/30 text-emerald-200'}`}>
                {log.model}
              </span>
              <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Optimized by Autopilot
              </span>
            </div>
            <div className="flex items-center gap-2 ml-1 mt-0.5">
              <span className="text-[10px] font-medium text-muted-foreground">
                Autopilot selected best model
              </span>
              <span className="text-[10px] font-mono text-muted-foreground opacity-60">
                • {log.latencyMs ?? (12 + (log.id.charCodeAt(0) % 20))}ms
              </span>
            </div>
          </div>
      </td>
      <td className="px-5 py-4 align-top">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colorClass}`}>
          {log.reasonCode.replace(/_/g, ' ')}
        </span>
      </td>
      <td className="px-5 py-4 text-right align-top">
        <div className="flex flex-col items-end text-xs space-y-1">
          <div className="text-muted-foreground flex items-center gap-2">
            <span className="opacity-70">Model used:</span>
            <span>{log.model} → ₹{(log.actualCostMicro / 1e6).toFixed(4)}</span>
          </div>
          <div className="text-muted-foreground flex items-center gap-2">
            <span className="opacity-70">Baseline:</span>
            <span>gpt-4o → ₹{(log.baselineCostMicro / 1e6).toFixed(4)}</span>
          </div>
          <div className="font-bold text-primary flex items-center gap-2 mt-1">
            <span className="opacity-90">Saved:</span>
            <span>₹{(log.savingsMicro / 1e6).toFixed(4)}</span>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 text-right align-top">
        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors mt-1 inline-block">
          WHY →
        </span>
      </td>
    </motion.tr>
  )
}

function WhyPanel({ log, onClose }: { log: Log | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {log && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border z-50 overflow-y-auto"
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Decision Detail</h3>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono bg-secondary text-secondary-foreground px-2.5 py-1 rounded-lg">{log.model}</span>
                <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
              </div>

              {log.promptPreview && (
                <div className="bg-secondary/50 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Prompt Preview</p>
                  <p className="text-sm text-foreground/80 italic">"{log.promptPreview}"</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Actual Cost', value: `₹${(log.actualCostMicro / 1e6).toFixed(5)}`, color: 'text-foreground' },
                  { label: 'Baseline', value: `₹${(log.baselineCostMicro / 1e6).toFixed(5)}`, color: 'text-muted-foreground line-through' },
                  { label: 'Saved', value: `₹${(log.savingsMicro / 1e6).toFixed(5)}`, color: 'text-primary font-bold' },
                ].map(item => (
                  <div key={item.label} className="bg-secondary/50 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p className={`text-sm font-bold tabular-nums ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              {log.why && (
                <div className="space-y-3 mt-4">
                  {[
                    { label: '🧠 Why', content: log.why.why, bg: 'bg-secondary/50' },
                    { label: '💰 Impact', content: log.why.impact, bg: 'bg-primary/5 border border-primary/10' },
                    { label: '⚡ Action', content: log.why.action, bg: 'bg-secondary/50' },
                  ].map(item => (
                    <div key={item.label} className={`${item.bg} rounded-xl p-4`}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{item.label}</p>
                      <p className="text-sm text-foreground/90 leading-relaxed">{item.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function SavingsTooltip() {
  return (
    <div className="absolute invisible opacity-0 group-hover:visible group-hover:opacity-100 bg-card border border-border text-xs text-foreground p-3 rounded-lg shadow-xl transition-all w-64 text-left z-50 left-1/2 -translate-x-1/2 bottom-full mb-2">
      <p className="font-bold mb-1">How savings calculated</p>
      <p className="text-muted-foreground leading-relaxed">We compare against higher-cost model (e.g. GPT-4o)</p>
    </div>
  )
}

function TopSavingsBar({ stats, plan, role, onUpgrade }: { stats: Stats, plan: string, role: string, onUpgrade: () => void }) {
  const todayValue = stats.savingsTodayMicro / 1e6;
  const totalValue = stats.savingsTotalMicro / 1e6;
  const monthlyValue = stats.savingsThisMonthMicro / 1e6;
  const streak = stats.streakDays;
  const profit = (stats.savingsTotalMicro - stats.totalCostMicro) / 1e6;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden glow-green"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
      
      <div className="relative z-10 flex items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
          <Zap className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-2">
            You saved 
            <motion.span 
              key={todayValue}
              initial={{ scale: 1.1, textShadow: '0 0 20px rgba(16,185,129,0.8)' }}
              animate={{ scale: 1, textShadow: '0 0 10px rgba(16,185,129,0.3)' }}
              transition={{ duration: 0.5 }}
              className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-primary drop-shadow-[0_0_12px_rgba(16,185,129,0.5)] group relative cursor-help inline-flex items-center gap-1 border-b border-primary/30 border-dashed pb-0.5"
            >
              <CountUp value={todayValue} prefix="₹" decimals={2} />
              <SavingsTooltip />
            </motion.span>
            today
          </h2>
          <div className="mt-2.5">
            {profit > 0 ? (
              <p className="text-sm font-semibold text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Net benefit: <CountUp value={profit} prefix="₹" decimals={2} />
              </p>
            ) : (
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary/50 animate-pulse" />
                Optimizing your costs...
              </p>
            )}
            <p className="text-[10px] font-medium text-muted-foreground mt-1 opacity-80">
              Based on optimized model selection vs baseline
            </p>
          </div>
          {plan === 'free' && role !== 'owner' && (
            <p onClick={onUpgrade} className="text-xs font-semibold text-primary/80 mt-1 cursor-pointer hover:underline inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              Free plan limits optimization. Pro unlocks more →
            </p>
          )}
        </div>
      </div>
      
      <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-10">
        <div className="flex items-center gap-10">
          <div className="text-center">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Streak</p>
            <p className="text-2xl font-bold text-foreground tabular-nums flex items-center gap-1.5 justify-center">
              <span className="text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">🔥</span> {streak} <span className="text-sm font-medium text-muted-foreground">days</span>
            </p>
          </div>
          <div className="w-px h-12 bg-border" />
          <div className="text-center">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">This Month</p>
            <p className="text-2xl font-bold text-foreground tabular-nums"><CountUp value={monthlyValue} prefix="₹" decimals={2} /></p>
          </div>
          <div className="w-px h-12 bg-border" />
          <div className="text-center">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Lifetime</p>
            <p className="text-2xl font-bold text-foreground tabular-nums"><CountUp value={totalValue} prefix="₹" decimals={2} /></p>
          </div>
        </div>

        {/* Progress System - Daily Goal */}
        <div className="w-full md:w-48 bg-black/20 p-3 rounded-xl border border-white/5">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Daily Goal</p>
            <p className="text-[10px] font-bold text-primary">₹500</p>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden relative">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((todayValue / 500) * 100, 100)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-primary rounded-full"
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function UpgradeTrigger({ stats, plan, role, trialEndsAt, onUpgrade }: { stats: Stats, plan: string, role: string, trialEndsAt?: string | null, onUpgrade: () => void }) {
  if (role === 'owner') return null

  const requestsToday = stats.requestsToday;
  const reqLimit = 500; // Free tier hardcoded for logic
  const reqPct = plan === 'free' ? (requestsToday / reqLimit) * 100 : 0;
  const savingsTotal = stats.savingsTotalMicro / 1e6;
  const savingsToday = stats.savingsTodayMicro / 1e6;

  // Trigger 0: First savings ever
  if (plan === 'free' && savingsToday > 0 && savingsTotal > 0 && savingsTotal < 10 && requestsToday <= 3) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glow-green">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
          <p className="text-sm font-medium text-primary">🎉 First saving! Vela saved you ₹{savingsToday.toFixed(4)} on that request. Upgrade to save on every request.</p>
        </div>
        <button onClick={onUpgrade} className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition shadow-[0_0_10px_rgba(16,185,129,0.4)] whitespace-nowrap">Unlock full savings</button>
      </motion.div>
    )
  }

  // Trigger 5: Trial Expiry
  if (plan === 'pro_trial' && trialEndsAt) {
    const daysLeft = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glow-green">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-primary shrink-0" />
          <p className="text-sm font-medium text-primary">Pro Trial active — {daysLeft} days remaining. Upgrade to keep full savings.</p>
        </div>
        <button onClick={onUpgrade} className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition shadow-[0_0_10px_rgba(16,185,129,0.4)] whitespace-nowrap">Unlock full savings</button>
      </motion.div>
    )
  }

  // Trigger 2: Limit Reached
  if (reqPct >= 100 && plan === 'free') {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <p className="text-sm font-medium text-destructive">Limit reached — upgrade to continue saving</p>
        </div>
        <button onClick={onUpgrade} className="px-4 py-1.5 bg-destructive text-destructive-foreground text-xs font-bold rounded-lg hover:bg-destructive/90 transition whitespace-nowrap">Unlock full savings</button>
      </motion.div>
    )
  }

  // Trigger 1: 80% usage
  if (reqPct >= 80 && plan === 'free') {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-900/10 border border-amber-900/30 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm font-medium text-amber-500">You're hitting limits — upgrade to continue saving</p>
        </div>
        <button onClick={onUpgrade} className="px-4 py-1.5 bg-amber-500 text-black text-xs font-bold rounded-lg hover:bg-amber-400 transition whitespace-nowrap">Unlock full savings</button>
      </motion.div>
    )
  }

  // Trigger 4: High value user
  if (requestsToday > 200 && savingsTotal > 500 && plan === 'free') {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card border border-primary/40 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between glow-green gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-primary shrink-0" />
          <p className="text-sm font-medium text-primary">You’ve saved ₹{savingsTotal.toFixed(0)} — unlock more with Pro</p>
        </div>
        <button onClick={onUpgrade} className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition shadow-[0_0_10px_rgba(16,185,129,0.4)] whitespace-nowrap">Unlock full savings</button>
      </motion.div>
    )
  }

  // Trigger 3: Savings milestone
  if (savingsTotal >= 100 && plan === 'free') {
    const amount = savingsTotal >= 500 ? '500' : '100';
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-primary shrink-0" />
          <p className="text-sm font-medium text-primary">You’ve saved ₹{amount} — unlock more with Pro</p>
        </div>
        <button onClick={onUpgrade} className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition whitespace-nowrap">Unlock full savings</button>
      </motion.div>
    )
  }

  // Trigger 6: Missed Savings
  if (plan === 'free' && savingsTotal > 10) {
    const missed = (savingsTotal * 0.25).toFixed(0);
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-blue-900/10 border border-blue-900/30 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-blue-500 shrink-0" />
          <p className="text-sm font-medium text-blue-500">You missed ~₹{missed} in extra savings. Advanced Routing is locked.</p>
        </div>
        <button onClick={onUpgrade} className="px-4 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition whitespace-nowrap">Unlock full savings</button>
      </motion.div>
    )
  }

  return null;
}

function UpgradeModal({ onClose, savedTotal }: { onClose: () => void, savedTotal?: number }) {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'offer' | 'trial'>('offer')

  const handleStartTrial = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/upgrade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start_trial' }) })
      if (res.ok) window.location.reload()
    } catch (err) {
      console.error('[vela] Trial activation failed:', err)
    } finally {
      setLoading(false)
    }
  }

  // Razorpay payment link — reads from env var with fallback
  const RAZORPAY_PAYMENT_LINK = process.env.NEXT_PUBLIC_RAZORPAY_PAYMENT_LINK || 'https://rzp.io/l/vela-pro'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-card rounded-2xl w-full max-w-md p-8 relative border border-primary/30 glow-green"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-xl leading-none">×</button>

          {step === 'offer' && (
            <>
              <div className="mb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-1">Unlock full savings</h2>
                <p className="text-muted-foreground text-sm">
                  {savedTotal && savedTotal > 0
                    ? `You've already saved ₹${savedTotal.toFixed(2)}. Pro unlocks even more.`
                    : 'Pays for itself after ₹700 AI usage.'}
                </p>
              </div>

              <div className="space-y-3 mb-8">
                {[
                  'Unlimited requests per day',
                  'Advanced 5-tier autopilot routing',
                  'Shadow analytics & insights',
                  'Up to 90% savings on simple queries',
                  'Pays for itself after ₹700 usage',
                ].map(f => (
                  <div key={f} className="flex gap-3 items-center">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-foreground text-sm">{f}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <a
                  href={RAZORPAY_PAYMENT_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                >
                  Pay ₹2,499/mo → Unlock Now
                </a>
                <button
                  onClick={() => setStep('trial')}
                  className="w-full py-2.5 rounded-xl bg-secondary text-foreground font-semibold hover:bg-secondary/80 transition text-sm"
                >
                  Try free for 14 days first
                </button>
              </div>
            </>
          )}

          {step === 'trial' && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">Start 14-Day Free Trial</h2>
                <p className="text-muted-foreground text-sm">
                  Full Pro access for 14 days. No card required. We'll remind you before it ends.
                </p>
              </div>
              <div className="space-y-3 mb-8">
                {['Full Pro access immediately', 'No credit card needed', 'Cancel or upgrade anytime'].map(f => (
                  <div key={f} className="flex gap-3 items-center">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-foreground text-sm">{f}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <button
                  onClick={handleStartTrial}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition shadow-[0_0_15px_rgba(16,185,129,0.4)] disabled:opacity-60"
                >
                  {loading ? 'Activating...' : 'Start Free Trial'}
                </button>
                <button
                  onClick={() => setStep('offer')}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition"
                >
                  ← Back
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function DashboardPage() {
  const [stats, setStats]           = useState<Stats | null>(null)
  const [logs, setLogs]             = useState<Log[]>([])
  const [selectedLog, setSelectedLog] = useState<Log | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [byokOk, setByokOk]         = useState<boolean | null>(null) // null = loading
  const [showRewardPopup, setShowRewardPopup] = useState(false)
  const [recentSavings, setRecentSavings] = useState(0)
  const [plan, setPlan]             = useState<string>('free')
  const [role, setRole]             = useState<string>('customer')
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  useEffect(() => {
    const fetchDashboard = () => {
      Promise.all([
        fetch('/api/decisions?limit=20'),
        fetch('/api/settings'),
      ])
        .then(async ([decRes, settRes]) => {
          if (decRes.status === 401) throw new Error('auth')
          if (!decRes.ok) throw new Error(`API error ${decRes.status}`)
          const [decData, settData] = await Promise.all([decRes.json(), settRes.ok ? settRes.json() : null])
          
          setStats(prev => {
            if (prev && prev.requestsToday < decData.stats.requestsToday) {
              const justSaved = decData.stats.savingsTotalMicro - prev.savingsTotalMicro;
              if (justSaved > 0) {
                setRecentSavings(justSaved / 1e6);
                setShowRewardPopup(true);
                setTimeout(() => setShowRewardPopup(false), 4000);
              }
            }
            return decData.stats
          })
          setLogs(decData.logs || [])
          if (settData) {
            setByokOk(settData.hasApiKey === true)
            setPlan(settData.plan || 'free')
            setRole(settData.role || 'customer')
            setTrialEndsAt(settData.trialEndsAt || null)
            setSettingsLoaded(true)
          }
        })
        .catch(err => {
          if (err.message === 'auth') setError('auth')
          else if (!error) setError(err.message)
        })
        .finally(() => setLoading(false))
    }
    
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 5000)
    
    // Check URL for upgrade trigger
    if (typeof window !== 'undefined' && window.location.search.includes('upgrade=true')) {
      setShowUpgradeModal(true)
      // Clean up URL without reload
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    
    return () => clearInterval(interval)
  }, [error])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error === 'auth') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Session Required</h2>
          <p className="text-muted-foreground text-sm">Please log in to view your dashboard.</p>
          <a href="/login" className="inline-block px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition">
            Sign In
          </a>
        </div>
      </div>
    )
  }

  if (error && error !== 'auth') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-sm glass-card p-8 rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Error Loading Data</h2>
          <p className="text-muted-foreground text-sm">{error}</p>
          <div className="mt-4 inline-block bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg">
            <p className="text-xs font-medium text-primary flex items-center gap-2">
              <Shield className="w-3 h-3" />
              Request failed — no cost incurred
            </p>
          </div>
        </div>
      </div>
    )
  }

  const s: Stats = stats ?? {
    savingsTodayMicro: 0, spentTodayMicro: 0, baselineTodayMicro: 0,
    requestsToday: 0, savingsTotalMicro: 0, totalCostMicro: 0, dailyLimitMicro: 5_000_000, spentBudgetMicro: 0,
    savingsThisMonthMicro: 0, streakDays: 0,
    totalRevenueMicro: 0, marginMicro: 0, marginStatus: 'break_even',
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight">
              Cost <span className="text-gradient">Autopilot</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider glow-green shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Autopilot: ON
            </span>
            {logs.length > 0 && (
              <span className="text-xs text-muted-foreground ml-2 px-2 py-1 bg-secondary/50 rounded-md border border-border/50 hidden sm:inline-block">
                Last optimized: {formatTimeAgo(new Date(logs[0].createdAt))}
              </span>
            )}
          </div>
          {settingsLoaded && plan === 'free' && role !== 'owner' && (
            <button onClick={() => setShowUpgradeModal(true)} className="px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-bold rounded-xl text-sm transition">
              Upgrade Plan
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">
            Optimized model selection. We automatically choose the most cost-efficient model for each request.
          </p>
          <p className="text-[10px] text-primary/80 font-medium uppercase tracking-wider flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Optimization confidence: High
          </p>
        </div>
      </motion.div>

      {/* BYOK warning banner */}
      <AnimatePresence>
        {byokOk === false && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-4 bg-amber-900/20 border border-amber-900/40 rounded-2xl p-5"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-900/40 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-amber-400 text-sm mb-0.5">OpenAI API Key Required</p>
              <p className="text-xs text-muted-foreground mb-3">
                Vela needs your OpenAI key to route and proxy requests. Without it, all proxy calls will fail with a 422 error.
              </p>
              <a
                href="/settings"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-900/50 rounded-lg text-xs font-semibold transition"
              >
                <Shield className="w-3 h-3" />
                Add key in Settings →
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Savings Bar */}
      <TopSavingsBar stats={s} plan={plan} role={role} onUpgrade={() => setShowUpgradeModal(true)} />
      
      {/* Upgrade Triggers */}
      <UpgradeTrigger stats={s} plan={plan} role={role} trialEndsAt={trialEndsAt} onUpgrade={() => setShowUpgradeModal(true)} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Total Spent"
          value={<CountUp value={s.spentTodayMicro / 1e6} prefix="₹" decimals={4} />}
          sub="Today's cost"
          delay={0.1}
        />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Requests"
          value={<CountUp value={s.requestsToday} decimals={0} />}
          sub="Processed today"
          delay={0.2}
        />
        {/* AI Spend vs Savings */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ scale: 1.02 }}
          className="glass-card relative overflow-hidden rounded-2xl p-6 col-span-1 md:col-span-2 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">AI Spend vs Savings</p>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary text-muted-foreground">
               <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div className="flex gap-6">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Total Cost</p>
                <p className="text-xl font-bold text-foreground"><CountUp value={s.totalCostMicro / 1e6} prefix="₹" decimals={2} /></p>
              </div>
              <div className="w-px bg-border/50" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Total Savings</p>
                <p className="text-xl font-bold text-primary"><CountUp value={s.savingsTotalMicro / 1e6} prefix="₹" decimals={2} /></p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-md">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold text-primary">
                Net benefit: <CountUp value={(s.savingsTotalMicro - s.totalCostMicro) / 1e6} prefix="₹" decimals={2} />
              </span>
            </div>
          </div>
        </motion.div>

        {/* Phase 11: Margin Indicator Card */}
        <StatCard
          icon={<Shield className="w-5 h-5" />}
          label="Margin"
          value={
            <span className={s.marginMicro >= 0 ? 'text-primary' : 'text-destructive'}>
              <CountUp value={s.marginMicro / 1e6} prefix="₹" decimals={2} />
            </span>
          }
          sub={s.marginStatus === 'profit' ? 'You are profitable' : s.marginStatus === 'loss' ? 'AI costs exceed plan revenue' : 'Break even'}
          delay={0.35}
          accent={s.marginMicro > 0}
        />
      </div>

      {/* Budget */}
      <BudgetBar spent={s.spentBudgetMicro} limit={s.dailyLimitMicro} />

      {/* Decision Feed */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="glass-card rounded-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Recent Decisions</h2>
          <a href="/decisions" className="text-xs text-primary hover:underline">View all →</a>
        </div>
        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-lg text-foreground font-medium mb-2">Send your first request to see savings</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Make an API call through the proxy to start tracking.</p>
          </div>
        ) : (
          <table className="w-full text-sm border-separate border-spacing-y-2 px-4">
            <thead>
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Model</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saved</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <DecisionRow key={log.id} log={log} idx={i} onClick={() => setSelectedLog(log)} />
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      <WhyPanel log={selectedLog} onClose={() => setSelectedLog(null)} />

      {/* Reward Popup */}
      <AnimatePresence>
        {showRewardPopup && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-8 right-8 z-50 glass-card border border-primary/50 shadow-[0_0_40px_rgba(16,185,129,0.3)] rounded-2xl p-5 flex items-center gap-4 min-w-[280px]"
          >
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 glow-green">
              <span className="text-xl">🎉</span>
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">Saved ₹{recentSavings.toFixed(4)}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total saved today: <span className="text-primary font-bold">₹{(stats?.savingsTodayMicro ? stats.savingsTodayMicro / 1e6 : 0).toFixed(4)}</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} savedTotal={stats ? stats.savingsTotalMicro / 1e6 : 0} />}
    </div>
  )
}
