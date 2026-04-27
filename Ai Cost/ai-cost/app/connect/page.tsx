'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Database, Cloud, Code2, ArrowRight, CheckCircle } from 'lucide-react';
import { IngestStream } from '@/components/IngestStream';

// ── Provider cards ─────────────────────────────────────────────────────────────
const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Connect GPT-4o, GPT-4o-mini, and Embeddings API usage.',
    icon: '🤖',
    color: '#10a37f',
    steps: ['Set OPENAI_API_KEY in .env.local', 'Route calls through /api/proxy/llm', 'WHY Engine tracks cost per call automatically'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Monitor Claude 3.5 Sonnet, Claude 3 Haiku, and Opus usage.',
    icon: '🧠',
    color: '#cc785c',
    steps: ['Set ANTHROPIC_API_KEY in .env.local', 'Use model: "claude-3-5-sonnet-20240620"', 'Costs tracked and anomalies detected in real time'],
  },
  {
    id: 'custom',
    name: 'Custom Endpoint',
    description: 'Use the WHY Engine proxy to intercept any LLM provider.',
    icon: '⚡',
    color: '#6366f1',
    steps: ['Point your LLM client to /api/proxy/llm', 'Pass x-target-model header with your model name', 'All usage tracked — no code changes needed'],
  },
];

function ProviderCard({ p, delay }: { p: typeof PROVIDERS[0]; delay: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        background: 'rgba(17,24,39,0.8)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${open ? p.color + '40' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 18,
        padding: '1.5rem',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
      }}
      onClick={() => setOpen(o => !o)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: open ? 16 : 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: `${p.color}18`, border: `1px solid ${p.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
          {p.icon}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB', margin: '0 0 2px' }}>{p.name}</p>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{p.description}</p>
        </div>
        <ArrowRight size={16} style={{ color: '#6B7280', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </div>

      {open && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {p.steps.map((step, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: `${p.color}20`, border: `1px solid ${p.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: p.color, flexShrink: 0, marginTop: 1 }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 1.5 }}>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </motion.div>
  );
}

export default function ConnectPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '0 1.5rem 4rem' }}>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ maxWidth: 720, margin: '0 auto', paddingTop: '5rem', textAlign: 'center' }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 999, padding: '5px 14px', marginBottom: 24 }}>
          <Zap size={12} style={{ color: '#818CF8' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#818CF8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Connect Your AI Infrastructure</span>
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 800, color: '#F9FAFB', letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 16px' }}>
          Start tracking AI costs<br />
          <span style={{ background: 'linear-gradient(135deg,#6366f1,#22c55e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            in 60 seconds
          </span>
        </h1>
        <p style={{ fontSize: 16, color: '#9CA3AF', lineHeight: 1.7, margin: '0 0 40px' }}>
          Connect any LLM provider through the WHY Engine proxy. Cost anomalies are detected automatically with no code changes.
        </p>
      </motion.div>

      {/* Provider cards */}
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 48 }}>
        {PROVIDERS.map((p, i) => (
          <ProviderCard key={p.id} p={p} delay={0.05 * i} />
        ))}
      </div>

      {/* Ingest stream test */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.45 }}
        style={{ maxWidth: 800, margin: '0 auto' }}
      >
        <IngestStream />
      </motion.div>
    </div>
  );
}
