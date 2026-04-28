'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardPage() {
  const [stats, setStats] = useState({ saved: '0.00', spent: '0.00', count: 0, budgetPercent: 0, budgetRemaining: '0.00' });
  const [decisions, setDecisions] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = process.env.NEXT_PUBLIC_PROXY_URL || 'http://localhost:3001';
        const [usageRes, decisionsRes] = await Promise.all([
          fetch(`${url}/api/usage`),
          fetch(`${url}/api/decisions?limit=20`)
        ]);
        
        const usage = await usageRes.json();
        const logs = await decisionsRes.json();
        
        const budget = usage.budgetState?.dailyBudgetUsd || 5;
        const spent = usage.budgetState?.spentTodayUsd || 0;
        const rem = Math.max(0, budget - spent);
        const pct = spent >= budget ? 100 : (spent / budget) * 100;

        setStats({
          saved: (usage.totalSavings || 0).toFixed(2),
          spent: spent.toFixed(2),
          count: usage.requestCount || 0,
          budgetPercent: pct,
          budgetRemaining: rem.toFixed(2)
        });
        
        setDecisions(logs);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const getProviderColor = (p: string) => {
    if (p === 'bedrock') return 'text-blue-400';
    if (p === 'vertex') return 'text-green-400';
    if (p === 'openai') return 'text-orange-400';
    return 'text-gray-400';
  };

  const parseWhy = (whyStr: string) => {
    try { return JSON.parse(whyStr); } catch { return null; }
  };

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) return <div className="p-8 text-gray-500">Loading Vela Dashboard...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gray-900/40 p-6 rounded-xl border border-gray-800">
          <p className="text-sm text-gray-400 mb-2">Total Saved</p>
          <p className="text-3xl font-mono text-[#00FF88]">${stats.saved}</p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gray-900/40 p-6 rounded-xl border border-gray-800">
          <p className="text-sm text-gray-400 mb-2">Total Spent</p>
          <p className="text-3xl font-mono text-gray-300">${stats.spent}</p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-gray-900/40 p-6 rounded-xl border border-gray-800">
          <p className="text-sm text-gray-400 mb-2">Request Count</p>
          <p className="text-3xl font-mono text-white">{stats.count}</p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-gray-900/40 p-6 rounded-xl border border-gray-800 flex flex-col justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">Budget Remaining</p>
            <p className="text-xl font-mono text-[#00D9FF]">${stats.budgetRemaining}</p>
          </div>
          <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
            <div className="bg-[#00D9FF] h-full" style={{ width: `${100 - stats.budgetPercent}%` }}></div>
          </div>
        </motion.div>
      </div>

      {/* Provider Status */}
      <div className="grid grid-cols-3 gap-6">
        {['AWS Bedrock', 'Google Vertex', 'OpenAI'].map((prov, i) => (
          <motion.div key={prov} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + (i * 0.1) }} className="flex items-center justify-between p-4 bg-gray-900/20 rounded-lg border border-gray-800/50">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-[#00FF88] rounded-full shadow-[0_0_8px_#00FF88]"></div>
              <span className="font-medium text-sm text-gray-300">{prov}</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Avg Cost</p>
              <p className="text-xs font-mono text-gray-400">$0.0001</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Decisions Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-gray-900/40 border border-gray-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h3 className="font-medium text-gray-200">Recent Routing Decisions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900/80 text-gray-400 text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Original Request</th>
                <th className="px-6 py-3">Routed To</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Actual Cost</th>
                <th className="px-6 py-3">Saved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              <AnimatePresence>
                {decisions.map((dec) => {
                  const why = parseWhy(dec.why);
                  const isExpanded = expandedRow === dec.id;
                  return (
                    <React.Fragment key={dec.id}>
                      <motion.tr 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-gray-800/20 cursor-pointer group"
                        onClick={() => setExpandedRow(isExpanded ? null : dec.id)}
                      >
                        <td className="px-6 py-4 font-mono text-xs text-gray-500">{formatTime(dec.timestamp)}</td>
                        <td className="px-6 py-4 font-mono text-gray-300">{dec.originalModel}</td>
                        <td className="px-6 py-4">
                          <span className={`font-mono font-medium ${getProviderColor(dec.provider)}`}>{dec.routedModel}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs">{dec.reasonCode}</span>
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-400">${Number(dec.actualCostUSD).toFixed(6)}</td>
                        <td className="px-6 py-4 font-mono text-[#00FF88]">${Number(dec.savingsUSD).toFixed(6)}</td>
                      </motion.tr>
                      {isExpanded && why && (
                        <tr>
                          <td colSpan={6} className="p-0 border-none">
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="px-6 py-4 bg-blue-900/10 border-t border-b border-blue-900/30 text-sm overflow-hidden"
                            >
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-[#00D9FF] font-medium mb-1">Why this decision?</p>
                                  <p className="text-gray-300 mb-3">{why.why}</p>
                                  
                                  <p className="text-[#00D9FF] font-medium mb-1">Impact</p>
                                  <p className="text-gray-300">{why.impact}</p>
                                </div>
                                <div>
                                  <p className="text-[#00FF88] font-medium mb-1">Action Taken</p>
                                  <p className="text-gray-300 mb-3">{why.action}</p>

                                  <p className="text-[#00FF88] font-medium mb-1">Final Outcome</p>
                                  <p className="text-gray-300">{why.decision}</p>
                                </div>
                              </div>
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
