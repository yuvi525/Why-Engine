'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899']

// ── Dark tooltip ──────────────────────────────────────────────────────────────
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{
      background: '#1a2234',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: '10px 14px',
      backdropFilter: 'blur(12px)',
      fontSize: 12,
    }}>
      <p style={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}>{d.name}</p>
      <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0 }}>
        Cost: <span style={{ color: '#fff', fontFamily: 'monospace' }}>${Number(d.value || 0).toFixed(4)}</span>
      </p>
      {d.payload.tokens != null && (
        <p style={{ color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>
          Tokens: <span style={{ color: '#fff', fontFamily: 'monospace' }}>{Number(d.payload.tokens || 0).toLocaleString()}</span>
        </p>
      )}
    </div>
  )
}

// ── Center label (total cost) ─────────────────────────────────────────────────
function CenterLabel({ cx, cy, total }) {
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={10} fontWeight={700} letterSpacing="0.1em">
        TOTAL
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#F9FAFB" fontSize={18} fontWeight={800} fontFamily="monospace">
        ${Number(total || 0).toFixed(2)}
      </text>
    </g>
  )
}

// ── Custom legend ─────────────────────────────────────────────────────────────
function ModelLegend({ data }) {
  const total = data.reduce((s, d) => s + Number(d.value || 0), 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
      {data.map((entry, i) => {
        const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0'
        return (
          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              flexShrink: 0,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: COLORS[i % COLORS.length],
              boxShadow: `0 0 5px ${COLORS[i % COLORS.length]}80`,
            }} />
            <span style={{ fontSize: 12, color: '#D1D5DB', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.name}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginRight: 8 }}>
              {pct}%
            </span>
            <span style={{ fontSize: 11, color: '#F9FAFB', fontFamily: 'monospace', fontWeight: 700 }}>
              ${Number(entry.value || 0).toFixed(4)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
/**
 * @param {{ data: Array<{ name: string, value: number, tokens?: number }> }} props
 */
export function ModelDistributionChart({ data = [] }) {
  const total = data.reduce((s, d) => s + Number(d.value || 0), 0)

  if (!data.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          gap: 10,
          minHeight: 240,
        }}
      >
        <div style={{ fontSize: 32 }}>📊</div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
          No model distribution data yet
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
    >
      <div style={{ height: 200, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              dataKey="value"
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
            {/* Center label rendered via customized label — we use a separate absolute overlay */}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Centre cost overlay — absolutely positioned over the donut hole */}
      <div style={{ position: 'relative', marginTop: -200, height: 200, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', margin: 0 }}>
            TOTAL
          </p>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#F9FAFB', fontFamily: 'monospace', margin: 0 }}>
            ${Number(total).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Legend */}
      <ModelLegend data={data} />
    </motion.div>
  )
}
