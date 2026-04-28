'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || 'http://localhost:3001';

interface VelaResponse {
  choices: Array<{ message: { content: string } }>;
  vela: {
    requestId: string;
    actualModel: string;
    actualProvider: string;
    simulatedModel: string;
    simulatedProvider: string;
    reasonCode: string;
    cost: number;
    savings: number;
    why: {
      why: string;
      impact: string;
      action: string;
      decision: string;
    };
  };
}

const PROVIDER_LABELS: Record<string, string> = {
  bedrock: 'AWS Bedrock',
  vertex: 'Google Vertex AI',
  openai: 'OpenAI',
};

const PROVIDER_COLORS: Record<string, string> = {
  bedrock: 'text-orange-400',
  vertex: 'text-blue-400',
  openai: 'text-green-400',
};

const MODEL_LABELS: Record<string, string> = {
  'gemini-1.5-flash-002': 'Gemini 1.5 Flash',
  'gemini-1.5-pro-002': 'Gemini 1.5 Pro',
  'anthropic.claude-3-haiku-20240307': 'Claude 3 Haiku',
  'anthropic.claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  'gpt-4o-mini': 'GPT-4o mini',
  'gpt-4o': 'GPT-4o',
};

function formatModel(m: string) {
  return MODEL_LABELS[m] || m;
}

export default function DemoPage() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VelaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${PROXY_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 512,
        }),
      });
      if (!res.ok) throw new Error(`Proxy error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const v = result?.vela;
  const responseText = result?.choices?.[0]?.message?.content ?? '';
  const isSimulated = v && v.simulatedModel !== v.actualModel;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight text-white">Live Demo</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Routing logic runs in full — execution via{' '}
          <span className="text-green-400 font-mono">gpt-4o-mini</span> (MVP mode)
        </p>
      </motion.div>

      {/* Input */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg space-y-4"
      >
        <label className="block text-sm font-medium text-zinc-300">Your prompt</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); }}
          rows={4}
          placeholder="e.g. Summarise the benefits of cloud cost optimisation..."
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-white
                     text-sm placeholder-zinc-600 focus:outline-none focus:ring-2
                     focus:ring-blue-500 resize-none transition"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-600">Ctrl + Enter to send</p>
          <button
            onClick={run}
            disabled={loading || !prompt.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40
                       disabled:cursor-not-allowed rounded-lg text-sm font-medium
                       transition-all duration-150 active:scale-95"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Running…
              </span>
            ) : 'Run →'}
          </button>
        </div>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-sm text-red-300"
          >
            ⚠ {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result card */}
      <AnimatePresence>
        {v && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6"
          >
            {/* Optimization badge */}
            {isSimulated && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-600/20 border border-blue-700/40">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span className="text-xs text-blue-400 font-medium">
                  Optimization simulated — multi-model execution coming soon
                </span>
              </div>
            )}

            {/* Model grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoCard label="Actual Execution">
                <ModelRow label="Model" value={formatModel(v.actualModel)} mono accent="text-green-400" />
                <ModelRow label="Provider" value={PROVIDER_LABELS[v.actualProvider] || v.actualProvider} />
              </InfoCard>

              <InfoCard label="Simulated Optimal Route">
                <ModelRow
                  label="Model"
                  value={formatModel(v.simulatedModel)}
                  mono
                  accent={v.simulatedModel !== v.actualModel ? 'text-blue-400' : 'text-green-400'}
                />
                <ModelRow
                  label="Provider"
                  value={PROVIDER_LABELS[v.simulatedProvider] || v.simulatedProvider}
                  accent={PROVIDER_COLORS[v.simulatedProvider] || 'text-zinc-300'}
                />
              </InfoCard>
            </div>

            {/* Cost */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatPill label="Reason Code" value={v.reasonCode} mono />
              <StatPill label="Cost" value={`$${v.cost.toFixed(8)}`} mono accent="text-zinc-200" />
              <StatPill label="Savings vs GPT-4o" value={`$${v.savings.toFixed(8)}`} mono accent="text-emerald-400" />
            </div>

            {/* WHY */}
            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-zinc-800/40 border-b border-zinc-800">
                <span className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">WHY Engine</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800">
                <WhySection label="Why" body={v.why.why} />
                <WhySection label="Impact" body={v.why.impact} />
                <WhySection label="Action Taken" body={v.why.action} />
                <WhySection label="Decision" body={v.why.decision} />
              </div>
            </div>

            {/* Response text */}
            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-zinc-800/40 border-b border-zinc-800">
                <span className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">Model Response</span>
              </div>
              <p className="px-5 py-4 text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {responseText}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────
function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">{label}</p>
      {children}
    </div>
  );
}

function ModelRow({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-sm font-medium ${accent || 'text-zinc-200'} ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function StatPill({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: string }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-sm font-semibold ${accent || 'text-zinc-200'} ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function WhySection({ label, body }: { label: string; body: string }) {
  return (
    <div className="px-4 py-4 space-y-1">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className="text-sm text-zinc-300 leading-relaxed">{body}</p>
    </div>
  );
}
