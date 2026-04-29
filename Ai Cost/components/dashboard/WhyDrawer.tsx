'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, ShieldAlert, Zap } from 'lucide-react'

interface WhyDrawerProps {
  isOpen: boolean
  onClose: () => void
  log: any
}

export function WhyDrawer({ isOpen, onClose, log }: WhyDrawerProps) {
  if (!log || !log.why) return null

  const isSavings = log.savingsMicro > 0

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-2xl z-50 p-6 flex flex-col"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Decision Rationale</h2>
              <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 pr-2">
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-primary" />
                  <span>The Why</span>
                </div>
                <p className="text-foreground leading-relaxed">
                  {log.why.why}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>The Impact</span>
                </div>
                <p className="text-foreground leading-relaxed">
                  {log.why.impact}
                </p>
              </div>

              <div className="space-y-3 p-4 bg-secondary/50 rounded-xl border border-border">
                <div className="flex items-center space-x-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <CheckCircle2 className={`w-4 h-4 ${isSavings ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span>Action Taken</span>
                </div>
                <p className={`font-medium ${isSavings ? 'text-primary' : 'text-foreground'}`}>
                  {log.why.action}
                </p>
              </div>
              
              <div className="pt-8 border-t border-border">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Request Preview</h3>
                <div className="bg-secondary p-4 rounded-xl text-sm font-mono text-secondary-foreground overflow-hidden whitespace-pre-wrap">
                  {log.promptPreview || "No preview available"}
                  {log.promptPreview && log.promptPreview.length >= 100 && "..."}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
