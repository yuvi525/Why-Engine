'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || 'http://localhost:3001';

const PROVIDER_COLORS: Record<string, string> = {
  bedrock: 'text-orange-400',
  vertex:  'text-blue-400',
  openai:  'text-green-400',
};

const PROVIDER_LABELS: Record<string, string> = {
  bedrock: 'AWS Bedrock',
  vertex:  'Google Vertex AI',
  openai:  'OpenAI',
};

const MODEL_LABELS: Record<string, string> = {
  'gemini-1.5-flash-002':                'Gemini 1.5 Flash',
  'gemini-1.5-pro-002':                  'Gemini 1.5 Pro',
  'anthropic.claude-3-haiku-20240307':   'Claude 3 Haiku',
  'anthropic.claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  'gpt-4o-mini':                         'GPT-4o mini',
  'gpt-4o':                              'GPT-4o',
};

const REASON_LABELS: Record<string, string> = {
  COMPLEXITY_LOW:  'Low complexity',
  COMPLEXITY_MED:  'Med complexity',
  COMPLEXITY_HIGH: 'High complexity',
  BUDGET_GUARD:    'Budget guard',
  SENSITIVITY_PII: 'PII detected',
  FORCED_MODEL:    'Forced model',
  PROVIDER_DOWN:   'Provider down',
};

interface Decision {
  id: string;
  requestId: string;
  timestamp: number | string;
  originalModel: string;
  routedModel: string;
  provider: string;
  reasonCode: string;
  actualCostUSD?: number;
  actualCostUsd?: number;
  savingsUSD?: number;
  savingsUsd?: number;
  latencyMs: number;
  why?: string;
  whyJson?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    saved: '0.0000',
    spent: '0.0000',
    count: 0,
    budgetPercent: 0,
    budgetRemaining: '0.00',
  });
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [usageRes, decisionsRes] = await Promise.all([
        fetch(`${PROXY_URL}/api/usage`),
        fetch(`${PROXY_URL}/api/decisions?limit=20`),
      ]);
      const usage   = await usageRes.json();
      const logsRaw = await decisionsRes.json();
      const logs    = Array.isArray(logsRaw) ? logsRaw : (logsRaw?.decisions ?? []);

      const budget  = usage.budgetState?.dailyBudgetUsd || 5;
      const spent   = usage.budgetState?.spentTodayUsd  || 0;
      const rem     = Math.max(0, budget - spent);
      const pct     = spent >= budget ? 100 : (spent / budget) * 100;

      setStats({
        saved:           (usage.totalSavings || 0).toFixed(4),
        spent:           spent.toFixed(4),
        count:           usage.requestCount || 0,
        budgetPercent:   pct,
        budgetRemaining: rem.toFixed(2),
      });
      setDecisions(logs);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 5000);
    return () => clearInterval(t);
  }, []);

  const formatTime = (ts: number | string) => {
    const d = new Date(typeof ts === 'number' ? ts : ts);
    return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const parseWhy = (str?: string | null) => {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex gap-2 items-center text-zinc-500 text-sm">
          <span className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          Loading Vela dashboard…
        </div>
      </div>
    );
  }

  // ─── Metric cards ────────────────────────────────────────────────────────────
  const metrics = [
    { label: 'Total Saved',        value: `$${stats.saved}`,          accent: 'text-emerald-400', glow: 'shadow-emerald-900/30' },
    { label: 'Total Spent',        value: `$${stats.spent}`,          accent: 'text-zinc-200',    glow: '' },
    { label: 'Requests Routed',    value: String(stats.count),         accent: 'text-white',       glow: '' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight text-white">Cost Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Live AI routing decisions & savings — refreshes every 5s</p>
      </motion.div>

      {/* Metric grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            whileHover={{ scale: 1.02 }}
            className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg ${m.glow} transition-transform`}
          >
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">{m.label}</p>
            <p className={`text-3xl font-semibold font-mono ${m.accent}`}>{m.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Budget bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow"
      >
        <div className="flex justify-between items-end mb-3">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Daily Budget</p>
            <p className="text-xl font-semibold font-mono text-sky-400 mt-1">${stats.budgetRemaining} remaining</p>
          </div>
          <span className="text-xs text-zinc-600 font-mono">{stats.budgetPercent.toFixed(1)}% used</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${stats.budgetPercent > 90 ? 'bg-red-500' : stats.budgetPercent > 70 ? 'bg-amber-500' : 'bg-sky-500'}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, stats.budgetPercent)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </motion.div>

      {/* Provider status */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {['bedrock', 'vertex', 'openai'].map((prov, i) => (
          <motion.div
            key={prov}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.05 }}
            className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
              <span className="text-sm font-medium text-zinc-300">{PROVIDER_LABELS[prov]}</span>
            </div>
            <span className={`text-xs font-mono ${PROVIDER_COLORS[prov]}`}>
              {prov === 'openai' ? '⚡ Active (MVP)' : '● Standby'}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* Decisions table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg"
      >
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Recent Routing Decisions</h2>
          <span className="text-xs text-zinc-600">last 20</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 text-zinc-500 uppercase tracking-widest">
              <tr>
                {['Time', 'Request', 'Routed To', 'Reason', 'Cost', 'Saved'].map(h => (
                  <th key={h} className="px-5 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              <AnimatePresence>
                {decisions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-zinc-600">
                      No decisions yet —{' '}
                      <a href="/demo" className="text-blue-500 hover:text-blue-400 underline">try the demo</a>
                      {' '}or run <code className="font-mono text-sky-500">pnpm seed:demo</code>
                    </td>
                  </tr>
                )}
                {decisions.map((dec, idx) => {
                  const why           = parseWhy(dec.why ?? dec.whyJson);
                  const provider      = dec.provider ?? '';
                  const routedModel   = MODEL_LABELS[dec.routedModel] || dec.routedModel || '—';
                  const originalModel = dec.originalModel || '—';
                  const reason        = REASON_LABELS[dec.reasonCode] || dec.reasonCode || '—';
                  const cost          = dec.actualCostUSD ?? dec.actualCostUsd ?? 0;
                  const savings       = dec.savingsUSD ?? dec.savingsUsd ?? 0;
                  const isExpanded    = expandedRow === dec.id;

                  return (
                    <React.Fragment key={dec.id}>
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className="hover:bg-zinc-800/30 cursor-pointer transition-colors"
                        onClick={() => setExpandedRow(isExpanded ? null : dec.id)}
                      >
                        <td className="px-5 py-3.5 font-mono text-zinc-500">{formatTime(dec.timestamp)}</td>
                        <td className="px-5 py-3.5 font-mono text-zinc-400">{originalModel}</td>
                        <td className="px-5 py-3.5">
                          <span className={`font-mono font-semibold ${PROVIDER_COLORS[provider] || 'text-zinc-300'}`}>
                            {routedModel}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-md font-mono">{reason}</span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-zinc-400">${Number(cost).toFixed(7)}</td>
                        <td className="px-5 py-3.5 font-mono text-emerald-400">${Number(savings).toFixed(7)}</td>
                      </motion.tr>

                      {isExpanded && why && (
                        <tr>
                          <td colSpan={6} className="p-0 border-none">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="px-5 py-4 bg-blue-950/20 border-t border-b border-blue-900/20 grid grid-cols-2 gap-4 text-xs"
                            >
                              <WhyBlock label="Why" body={why.why} />
                              <WhyBlock label="Impact" body={why.impact} />
                              <WhyBlock label="Action" body={why.action} />
                              <WhyBlock label="Decision" body={why.decision} />
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function WhyBlock({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-sky-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-zinc-300 leading-relaxed">{body}</p>
    </div>
  );
}
