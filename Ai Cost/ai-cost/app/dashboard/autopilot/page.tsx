'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppShell } from '@/src/components/layout/app-shell';
import {
  Bot, Zap, Trash2, ToggleLeft, ToggleRight,
  Loader2, AlertTriangle, CheckCircle, ChevronRight,
  PlusCircle, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-browser';
import { DEMO_ANALYSIS_RESULTS, DEMO_AUTOPILOT_RULES } from '@/lib/demo-data';
import { generateSuggestions } from '@/lib/autopilot-engine';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Suggestion {
  id: string;
  type?: string;
  priority?: string;
  title: string;
  detail?: string;
  estimatedMonthlySavings?: number | null;
  confidence?: string | number;
  manual_action?: string;
  model_from?: string;
  model_to?: string;
}

interface Rule {
  id: string;
  name: string;
  trigger_type?: string;
  action_type?: string;
  config?: Record<string, any>;
  enabled: boolean;
  savings_usd?: number;
  runs?: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────
const PRIORITY_COLOR: Record<string, string> = {
  HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e', critical: '#ef4444',
};

function headers() {
  return { 'Content-Type': 'application/json' };
}

// ── SuggestionCard ────────────────────────────────────────────────────────────
function SuggestionCard({ s }: { s: Suggestion }) {
  const pColor = PRIORITY_COLOR[String(s.priority || 'LOW').toUpperCase()] ?? '#818CF8';
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Priority dot */}
        <span
          style={{
            flexShrink: 0, width: 8, height: 8, borderRadius: '50%',
            background: pColor, boxShadow: `0 0 6px ${pColor}`,
            marginTop: 5,
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB', margin: 0 }}>{s.title}</p>
            {s.estimatedMonthlySavings != null && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981', fontFamily: 'monospace' }}>
                −${Number(s.estimatedMonthlySavings).toFixed(0)}/mo
              </span>
            )}
          </div>
          {s.detail && (
            <p style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6, margin: '0 0 8px' }}>{s.detail}</p>
          )}
          {s.manual_action && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronRight size={11} style={{ color: '#818CF8' }} />
              <span style={{ fontSize: 11, color: '#818CF8', fontWeight: 600 }}>{s.manual_action}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RuleRow ───────────────────────────────────────────────────────────────────
function RuleRow({
  rule,
  onToggle,
  onDelete,
  isDeleting,
}: {
  rule: Rule;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '12px 14px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB', margin: '0 0 2px' }}>{rule.name}</p>
        {rule.trigger_type && (
          <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
            {rule.trigger_type} → {rule.action_type}
          </p>
        )}
      </div>

      {/* Savings badge */}
      {rule.savings_usd != null && Number(rule.savings_usd) > 0 && (
        <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>
          ${Number(rule.savings_usd).toFixed(2)} saved
        </span>
      )}

      {/* Toggle */}
      <button
        onClick={() => onToggle(rule.id, !rule.enabled)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
        title={rule.enabled ? 'Disable rule' : 'Enable rule'}
      >
        {rule.enabled
          ? <ToggleRight size={22} style={{ color: '#22c55e' }} />
          : <ToggleLeft size={22} style={{ color: '#4B5563' }} />
        }
      </button>

      {/* Delete */}
      <button
        onClick={() => onDelete(rule.id)}
        disabled={isDeleting}
        style={{ background: 'none', border: 'none', cursor: isDeleting ? 'not-allowed' : 'pointer', padding: 2, flexShrink: 0, opacity: isDeleting ? 0.4 : 1 }}
        title="Delete rule"
      >
        {isDeleting
          ? <Loader2 size={14} style={{ color: '#6B7280' }} className="animate-spin" />
          : <Trash2 size={14} style={{ color: '#6B7280' }} />
        }
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AutopilotPage() {
  const [suggestions, setSugs]        = useState<Suggestion[]>([]);
  const [rules, setRules]             = useState<Rule[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [isSeeding, setIsSeeding]     = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [isDemo, setIsDemo]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // ── Load data ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session?.session) {
        // ── Demo mode ──────────────────────────────────────────────────────
        setIsDemo(true);
        setSugs(generateSuggestions(DEMO_ANALYSIS_RESULTS[0]));
        setRules(DEMO_AUTOPILOT_RULES as unknown as Rule[]);
        setIsLoading(false);
        return;
      }

      setIsDemo(false);

      // 1 — Latest analysis
      const aRes = await fetch('/api/latest-analysis');
      if (aRes.ok) {
        const { found, analysis } = await aRes.json();
        if (found && analysis) {
          // 2 — Generate autopilot suggestions
          const sRes = await fetch('/api/autopilot', {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ decision: analysis }),
          });
          if (sRes.ok) {
            const s = await sRes.json();
            setSugs(s.suggestions || []);
          }
        }
      }

      // 3 — Load rules
      const rRes = await fetch('/api/autopilot/rules');
      if (rRes.ok) {
        const rData = await rRes.json();
        setRules(rData.rules || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Rule toggle ───────────────────────────────────────────────────────────
  const handleToggle = async (id: string, enabled: boolean) => {
    if (isDemo) {
      // Demo: optimistic local toggle only
      setRules(prev => prev.map(r => r.id === id ? { ...r, enabled } : r));
      return;
    }
    const res = await fetch(`/api/autopilot/rules/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRules(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
    }
  };

  // ── Rule delete ───────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (isDemo) {
      setRules(prev => prev.filter(r => r.id !== id));
      return;
    }
    setDeletingId(id);
    const res = await fetch(`/api/autopilot/rules/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRules(prev => prev.filter(r => r.id !== id));
    }
    setDeletingId(null);
  };

  // ── Seed defaults ─────────────────────────────────────────────────────────
  const handleSeed = async () => {
    if (isDemo) return;
    setIsSeeding(true);
    const res = await fetch('/api/autopilot/rules', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ seed_defaults: true }),
    });
    if (res.ok) {
      const d = await res.json();
      setRules(d.rules || []);
    }
    setIsSeeding(false);
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={16} style={{ color: '#22c55e' }} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Cost Autopilot
              </h1>
              {isDemo && (
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B', borderRadius: 999, padding: '2px 8px' }}>
                  DEMO
                </span>
              )}
            </div>
            <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0 }}>
              AI-generated suggestions and automated rules to reduce your spend.
            </p>
          </div>

          <button
            onClick={load}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 14px', color: '#9CA3AF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </motion.div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', color: '#F87171', fontSize: 13 }}>
            Error: {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── SUGGESTIONS ─────────────────────────────────────── */}
          <div
            style={{
              background: 'rgba(17,24,39,0.8)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              padding: '1.25rem 1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Zap size={15} style={{ color: '#818CF8' }} />
              <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                Autopilot Suggestions ({suggestions.length})
              </p>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '3rem 0', color: '#6B7280', fontSize: 13 }}>
                <Loader2 size={16} className="animate-spin" />
                Generating suggestions…
              </div>
            ) : suggestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <CheckCircle size={32} style={{ color: '#22c55e', opacity: 0.5, margin: '0 auto 12px' }} />
                <p style={{ color: '#6B7280', fontSize: 13 }}>No suggestions right now — all looks good!</p>
              </div>
            ) : (
              <AnimatePresence>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {suggestions.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                      transition={{ delay: i * 0.06, duration: 0.35 }}
                    >
                      <SuggestionCard s={s} />
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
            )}
          </div>

          {/* ── RULES ───────────────────────────────────────────── */}
          <div
            style={{
              background: 'rgba(17,24,39,0.8)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              padding: '1.25rem 1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={15} style={{ color: '#F59E0B' }} />
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                  Automation Rules ({rules.length})
                </p>
              </div>
              {!isDemo && (
                <button
                  onClick={handleSeed}
                  disabled={isSeeding}
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '5px 10px', color: '#818CF8', fontSize: 11, fontWeight: 600, cursor: isSeeding ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, opacity: isSeeding ? 0.6 : 1 }}
                >
                  {isSeeding ? <Loader2 size={12} className="animate-spin" /> : <PlusCircle size={12} />}
                  Seed defaults
                </button>
              )}
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '3rem 0', color: '#6B7280', fontSize: 13 }}>
                <Loader2 size={16} className="animate-spin" />
                Loading rules…
              </div>
            ) : rules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 12 }}>No rules yet.</p>
                {!isDemo && (
                  <button
                    onClick={handleSeed}
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '8px 16px', color: '#818CF8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Seed default rules
                  </button>
                )}
              </div>
            ) : (
              <AnimatePresence>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rules.map((rule) => (
                    <motion.div
                      key={rule.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
                      transition={{ duration: 0.3 }}
                    >
                      <RuleRow
                        rule={rule}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                        isDeleting={deletingId === rule.id}
                      />
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
