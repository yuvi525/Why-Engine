'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DecisionCard } from '@/components/decision-card';
import { Zap, Loader2, CheckCircle, AlertTriangle, Activity } from 'lucide-react';

// ── Models ────────────────────────────────────────────────────────────────────
const MODELS = [
  { id: 'gpt-4o',          label: 'GPT-4o',            color: '#10a37f' },
  { id: 'gpt-4o-mini',     label: 'GPT-4o-mini',       color: '#10a37f' },
  { id: 'claude-sonnet',   label: 'Claude 3.5 Sonnet',  color: '#cc785c' },
];

const STATUS_CONFIG = {
  collecting: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Collecting data…' },
  ok:         { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  label: 'No anomaly detected' },
  decision:   { color: '#818CF8', bg: 'rgba(99,102,241,0.1)', label: 'Decision ready' },
  partial:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Partial result' },
  error:      { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  label: 'Error' },
};

// ── IngestStream ──────────────────────────────────────────────────────────────
export function IngestStream() {
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [result, setResult]               = useState(null);
  const [isLoading, setIsLoading]         = useState(false);
  const [error, setError]                 = useState(null);

  const sendTestEvent = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    const testEvent = {
      model:         selectedModel,
      input_tokens:  8500,
      output_tokens: 1200,
      session_id:    `test-${Date.now()}`,
    };

    try {
      const res = await fetch('/api/ingest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(testEvent),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const statusCfg = result ? (STATUS_CONFIG[result.status] ?? STATUS_CONFIG.partial) : null;

  return (
    <div style={{
      background: 'rgba(17,24,39,0.9)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 20,
      padding: '1.75rem 2rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity size={16} style={{ color: '#818CF8' }} />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB', margin: 0 }}>Test Your Connection</p>
          <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>Send a test event and see the WHY Engine respond in real-time.</p>
        </div>
      </div>

      {/* Model selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {MODELS.map(m => (
          <button
            key={m.id}
            onClick={() => setSelectedModel(m.id)}
            style={{
              background: selectedModel === m.id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${selectedModel === m.id ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 600,
              color: selectedModel === m.id ? '#A5B4FC' : '#9CA3AF',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Payload preview */}
      <pre style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', marginBottom: 16, overflow: 'auto', lineHeight: 1.7 }}>
{JSON.stringify({ model: selectedModel, input_tokens: 8500, output_tokens: 1200, session_id: 'test-...' }, null, 2)}
      </pre>

      {/* Send button */}
      <button
        onClick={sendTestEvent}
        disabled={isLoading}
        style={{
          background: isLoading ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          border: 'none', borderRadius: 12, padding: '10px 24px',
          fontSize: 13, fontWeight: 700, color: '#fff',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
        }}
      >
        {isLoading
          ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
          : <><Zap size={14} /> Send Test Event</>
        }
      </button>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ marginTop: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '10px 14px', color: '#f87171', fontSize: 13 }}
          >
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && statusCfg && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            {/* Status row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.color}40`, borderRadius: 999, padding: '4px 12px' }}>
                <CheckCircle size={12} /> {statusCfg.label}
              </span>
              {result.total_cost != null && (
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                  Cost: <strong style={{ color: '#F9FAFB', fontFamily: 'monospace' }}>${Number(result.total_cost).toFixed(5)}</strong>
                </span>
              )}
              {result.record_count != null && (
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                  Records: <strong style={{ color: '#F9FAFB' }}>{result.record_count}</strong>
                </span>
              )}
              {result.anomaly_detected && (
                <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', borderRadius: 999, padding: '2px 8px' }}>
                  Anomaly Detected
                </span>
              )}
            </div>

            {/* Decision card */}
            {result.decision && (
              <div>
                {/* @ts-ignore */}
                <DecisionCard
                  decision={result.decision}
                  totalCost={result.total_cost ?? result.decision.totalCost}
                  anomalyType={String(result.decision.anomalyType ?? '').replace(/_/g, ' ')}
                  severity={String(result.decision.severity ?? '').toLowerCase()}
                  estimatedSavings={result.decision.estimatedSavings}
                  isDemo={false}
                  domain={null}
                  suggestedModel={null}
                  fromModel={null}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
