'use client'
import { motion, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import { TrendingUp } from 'lucide-react'

interface SavingsCardProps {
  savingsTodayMicro: number
}

export function SavingsCard({ savingsTodayMicro }: SavingsCardProps) {
  const savingsUsd = savingsTodayMicro / 1_000_000
  
  const springValue = useSpring(0, { bounce: 0, duration: 2000 })
  const displayValue = useTransform(springValue, (current) => current.toFixed(4))

  useEffect(() => {
    springValue.set(savingsUsd)
  }, [savingsUsd, springValue])

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl bg-white border border-border shadow-sm p-8 group hover:shadow-md transition-shadow"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-primary/20 transition-colors duration-700 pointer-events-none"></div>
      
      <div className="relative z-10 flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <TrendingUp className="w-5 h-5" />
        </div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Savings Today</h2>
      </div>
      
      <div className="relative z-10 flex items-baseline space-x-2">
        <span className="text-3xl font-medium text-foreground/50">$</span>
        <motion.span 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
          className="text-6xl font-bold tracking-tight text-foreground"
        >
          {displayValue}
        </motion.span>
      </div>

      <p className="mt-4 text-sm text-muted-foreground relative z-10">
        Saved by dynamically routing complex requests to <strong>Vela Pro</strong> and simple ones to <strong>Vela Mini</strong>.
      </p>
    </motion.div>
  )
}
