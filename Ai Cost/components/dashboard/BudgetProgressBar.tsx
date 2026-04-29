'use client'

import { motion } from 'framer-motion'
import { Activity, Wallet } from 'lucide-react'

interface BudgetProgressBarProps {
  spentTodayMicro: number
  dailyLimitMicro: number
  requestsToday: number
}

export function BudgetProgressBar({ spentTodayMicro, dailyLimitMicro, requestsToday }: BudgetProgressBarProps) {
  const spentUsd = (spentTodayMicro / 1_000_000).toFixed(2)
  const limitUsd = (dailyLimitMicro / 1_000_000).toFixed(2)
  const pct = Math.min((spentTodayMicro / dailyLimitMicro) * 100, 100)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-border flex flex-col justify-between"
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-foreground/70">
            <Wallet className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Budget Spent</h2>
        </div>

        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-3xl font-bold tracking-tight">${spentUsd}</span>
            <span className="text-sm font-medium text-muted-foreground">/ ${limitUsd}</span>
          </div>
          <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
              className={`h-full rounded-full ${pct > 85 ? 'bg-destructive' : 'bg-foreground'}`}
            />
          </div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-border flex flex-col justify-between"
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-foreground/70">
            <Activity className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Requests Processed</h2>
        </div>
        
        <div>
          <span className="text-4xl font-bold tracking-tight">{requestsToday}</span>
        </div>
      </motion.div>
    </div>
  )
}
