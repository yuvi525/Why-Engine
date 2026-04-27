'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '@/src/components/layout/app-shell';
import { runSystemValidation } from '@/lib/system-validator';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2, Activity } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type CheckStatus = 'pass' | 'warn' | 'fail';

interface Check {
  status: CheckStatus;
  details?: string;
  missing_tables?: string[];
  missing_vars?: string[];
  violations?: string[];
  generate_100_ms?: number;
}

const LABELS: Record<string, string> = {
  pipeline:    'API Pipeline',
  database:    'Database Tables',
  auth:        'Authentication',
  stripe:      'Stripe Config',
  demo:        'Demo Mode',
  brand_copy:  'Brand Copy',
  performance: 'Performance',
};

const STATUS_CONFIG: Record<CheckStatus, { icon: React.ReactNode; color: string; bg: string; border: string; label: string }> = {
  pass: { icon: <CheckCircle size={16} />,   color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)',   label: 'Pass' },
  warn: { icon: <AlertTriangle size={16} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', label: 'Warn' },
  fail: { icon: <XCircle size={16} />,       color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   label: 'Fail' },
};

// ── CheckCard ─────────────────────────────────────────────────────────────────
function CheckCard({ title, check }: { title: string; check: Check }) {
  const cfg = STATUS_CONFIG[check.status] ?? STATUS_CONFIG.warn;
  return (
    <div style={{
      background: 'rgba(17,24,39,0.8)',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${cfg.border}`,
      borderRadius: 14,
      padding: '1rem 1.25rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{title}</p>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 999, padding: '2px 8px' }}>
          {cfg.icon} {cfg.label}
        </span>
      </div>
      {check.details && (
        <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.6, fontFamily: 'monospace', wordBreak: 'break-word' }}>
          {check.details}
        </p>
      )}
      {check.missing_tables && check.missing_tables.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {check.missing_tables.map(t => (
            <span key={t} style={{ fontSize: 10, fontFamily: 'monospace', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 5, padding: '1px 6px' }}>{t}</span>
          ))}
        </div>
      )}
      {check.generate_100_ms != null && (
        <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0', fontFamily: 'monospace' }}>
          {check.generate_100_ms}ms for 100 runs
        </p>
      )}
    </div>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const color = score >= 85 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <svg width={120} height={120} viewBox="0 0 120 120">
          <circle cx={60} cy={60} r={50} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
          <circle cx={60} cy={60} r={50} fill="none" stroke={color} strokeWidth={10}
            strokeDasharray={`${(score / 100) * 314} 314`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'monospace' }}>{score}</span>
          <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, letterSpacing: '0.1em' }}>/ 100</span>
        </div>
      </div>
      <p style={{ fontSize: 12, color: score >= 85 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444', fontWeight: 700, marginTop: 8 }}>
        {score >= 85 ? 'Production Ready' : score >= 60 ? 'Needs Attention' : 'Critical Issues'}
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SystemHealthPage() {
  const [result, setResult]       = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const run = async () => {
    setIsLoading(true);
    try {
      const r = await runSystemValidation();
      setResult(r);
    } catch (e) {
      console.error('System validation failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { run(); }, []);

  const checks: Record<string, Check> = result?.checks ?? {};
  const summary = result?.summary;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity size={16} style={{ color: '#10B981' }} />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white">System Health</h1>
              </div>
              <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0 }}>
                Full validation of pipeline, database, auth, and configuration.
              </p>
            </div>
            <button onClick={run} disabled={isLoading} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 14px', color: '#9CA3AF', fontSize: 12, fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: isLoading ? 0.6 : 1 }}>
              {isLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Re-run checks
            </button>
          </div>
        </motion.div>

        {isLoading && !result ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', gap: 12, color: '#6B7280', fontSize: 14 }}>
            <Loader2 size={20} className="animate-spin" style={{ color: '#818CF8' }} />
            Running system validation…
          </div>
        ) : result ? (
          <>
            {/* Score + summary */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              style={{ background: 'rgba(17,24,39,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.5rem', display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}
            >
              <ScoreRing score={result.readiness_score} />
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {[
                  { label: 'Total Checks', value: summary?.total_checks ?? 0, color: '#9CA3AF' },
                  { label: 'Passed',       value: summary?.passed  ?? 0, color: '#22c55e' },
                  { label: 'Warnings',     value: summary?.warnings ?? 0, color: '#f59e0b' },
                  { label: 'Failed',       value: summary?.failed  ?? 0, color: '#ef4444' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: 'monospace', margin: 0 }}>{s.value}</p>
                    <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', fontWeight: 600, letterSpacing: '0.06em' }}>{s.label}</p>
                  </div>
                ))}
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 11, color: '#374151' }}>
                Last run: {result.timestamp ? new Date(result.timestamp).toLocaleTimeString() : '—'}
              </div>
            </motion.div>

            {/* Check cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(checks).map(([key, check], i) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                >
                  <CheckCard title={LABELS[key] ?? key} check={check as Check} />
                </motion.div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
