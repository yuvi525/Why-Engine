'use client'

import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { motion } from 'framer-motion'

// ── Custom tooltip ────────────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1a2234',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: '10px 14px',
      backdropFilter: 'blur(12px)',
      fontSize: 12,
      minWidth: 130,
    }}>
      <p style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 700, marginBottom: 6, fontSize: 11, letterSpacing: '0.08em' }}>
        {label}
      </p>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.55)', textTransform: 'capitalize' }}>{entry.name}:</span>
          <span style={{ color: '#fff', fontWeight: 700, fontFamily: 'monospace' }}>${entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── CostChart ─────────────────────────────────────────────────────────────────
/**
 * @param {{ data: Array<{ date: string, cost: number, savings: number }> }} props
 */
export function CostChart({ data = [] }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradSavings" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            stroke="rgba(255,255,255,0.2)"
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="rgba(255,255,255,0.2)"
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => '$' + v}
          />

          <Tooltip content={<DarkTooltip />} />

          <Legend
            wrapperStyle={{ paddingTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}
            formatter={(value) => (
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'capitalize' }}>
                {value}
              </span>
            )}
          />

          <Area
            type="monotone"
            dataKey="cost"
            name="Cost"
            stroke="#ef4444"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#gradCost)"
            dot={false}
            activeDot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="savings"
            name="Savings"
            stroke="#22c55e"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#gradSavings)"
            dot={false}
            activeDot={{ r: 4, fill: '#22c55e', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  )
}
