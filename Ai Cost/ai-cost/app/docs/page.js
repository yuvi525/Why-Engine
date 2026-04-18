"use client";
import { useState, useEffect } from "react";

const CODE = {
  install: `# Copy the SDK into your project
cp why-engine/sdk/index.js ./lib/why-engine-sdk.js`,

  init: `import { WHYEngineClient } from './lib/why-engine-sdk.js';

const client = new WHYEngineClient({
  baseUrl: 'https://your-app.vercel.app',
  debug: true, // remove in production
});`,

  track: `// After every LLM call — send the event
const result = await client.track({
  model:         'gpt-4o',
  input_tokens:  8500,
  output_tokens: 1200,
  // cost auto-calculated if omitted
  session_id:    'session-abc-123',
  agent_id:      'summariser-agent',  // future
  latency_ms:    340,
});

console.log(result.status);  // "collecting" | "decision" | "ok"
if (result.decision) {
  console.log(result.decision.priority);   // "HIGH"
  console.log(result.decision.why);        // WHY explanation
  console.log(result.decision.action);     // ranked actions
}`,

  batch: `// Send a full session at once
const results = await client.trackBatch([
  { model: 'gpt-4o',      input_tokens: 8000, output_tokens: 900 },
  { model: 'gpt-4o',      input_tokens: 12000, output_tokens: 1400 },
  { model: 'gpt-4o',      input_tokens: 52000, output_tokens: 4200 }, // spike
  { model: 'gpt-4o-mini', input_tokens: 3000,  output_tokens: 200  },
], { session_id: 'batch-001' });

const decision = results.find(r => r.status === 'decision');`,

  analyze: `// One-shot: send a full usage array, get a decision immediately
const decision = await client.analyze([
  { model: 'gpt-4o',      tokens: 10000, cost: 0.05 },
  { model: 'gpt-4o',      tokens: 15000, cost: 0.075 },
  { model: 'gpt-4o',      tokens: 52000, cost: 0.26 },
]);

console.log(decision.priority);  // "HIGH"
console.log(decision.impact);    // "$0.09/run → ~$27/month"`,

  ingestCurl: `curl -X POST https://your-app.vercel.app/api/ingest \\
  -H "Content-Type: application/json" \\
  -d '{
    "model":         "gpt-4o",
    "input_tokens":  8500,
    "output_tokens": 1200,
    "session_id":    "sess-001",
    "agent_id":      "my-agent"
  }'`,

  ingestResponse: `{
  "status":           "decision",
  "session_id":       "sess-001",
  "anomaly_detected": true,
  "record_count":     4,
  "total_cost":       0.43,
  "decision": {
    "priority":   "HIGH",
    "why":        "gpt-4o processed 52,000 tokens on record 3 — 3.5× the session average...",
    "impact":     "Cost moved from $0.05 → $0.26 (+420%). $0.09/run → ~$27/month.",
    "action":     ["Switch gpt-4o → gpt-4o-mini for classification (Est. ~$27/month)"],
    "decision":   "Migrate now. Act this billing cycle — est. savings ~$27/month.",
    "confidence": "88%"
  }
}`,
};

function CodeBlock({ code, label }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div style={{ position: "relative", background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
      {label && <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{label}</div>}
      <pre style={{ margin: 0, padding: "16px", overflowX: "auto", fontSize: 12, lineHeight: 1.75, color: "#e2e8f0", fontFamily: "var(--font-geist-mono,monospace)" }}><code>{code}</code></pre>
      <button onClick={copy} style={{ position: "absolute", top: label ? 36 : 10, right: 10, background: copied ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: copied ? "#10b981" : "rgba(255,255,255,0.4)", cursor: "pointer" }}>
        {copied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} style={{ paddingTop: 56 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#e0e7ff", letterSpacing: "-0.02em", margin: "0 0 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 12 }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
    </section>
  );
}

export default function DocsPage() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch("/api/validate").then(r => r.json()).then(setHealth).catch(() => {});
  }, []);

  const NAV = [
    ["overview",   "Overview"],
    ["quickstart", "Quickstart"],
    ["sdk",        "SDK Reference"],
    ["api",        "API Reference"],
    ["ingest",     "/api/ingest"],
    ["analyze",    "/api/analyze"],
    ["validate",   "/api/validate"],
    ["cron",       "Cron Jobs"],
    ["config",     "Configuration"],
  ];

  return (
    <div style={{ flex: 1, display: "flex", minHeight: "100vh", background: "#030308" }}>

      {/* Sidebar */}
      <nav style={{ width: 220, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.07)", padding: "32px 0", position: "sticky", top: 60, height: "calc(100vh - 60px)", overflowY: "auto" }}>
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} style={{ display: "block", padding: "7px 24px", fontSize: 13, color: "rgba(255,255,255,0.45)", textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={e => e.target.style.color = "#e0e7ff"} onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.45)"}>
            {label}
          </a>
        ))}
      </nav>

      {/* Content */}
      <main style={{ flex: 1, maxWidth: 860, padding: "40px 48px", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", margin: "0 0 12px" }}>WHY Engine</p>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: "#e0e7ff", letterSpacing: "-0.03em", margin: "0 0 12px" }}>Documentation</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: 0 }}>
            Complete reference for integrating the WHY Engine into your AI workloads.
          </p>
        </div>

        {/* Config health */}
        {health && (
          <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: 14, background: health.ok ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)", border: `1px solid ${health.ok ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.2)"}` }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: health.ok ? "#10b981" : "#f43f5e", margin: "0 0 8px" }}>
              {health.ok ? "✓ All critical services configured" : "⚠ Configuration incomplete"}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(health.checks).map(([k, v]) => (
                <span key={k} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: v ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)", border: `1px solid ${v ? "rgba(16,185,129,0.25)" : "rgba(244,63,94,0.25)"}`, color: v ? "#10b981" : "#f43f5e", fontWeight: 600 }}>
                  {v ? "✓" : "✗"} {k}
                </span>
              ))}
            </div>
          </div>
        )}

        <Section id="overview" title="Overview">
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.8, margin: 0 }}>
            WHY Engine is an autonomous AI cost intelligence pipeline. Send your LLM usage events — model, tokens, cost — and the engine detects anomalies, explains the root cause, and returns ranked actions with real savings estimates.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Ingest", "POST /api/ingest — single events or batches"],["Analyze", "POST /api/analyze — one-shot full array"],["Monitor", "GET /api/cron/monitor — background processing"],["Alerts", "GET /api/cron/alerts — Slack + email notifications"]].map(([t, d]) => (
              <div key={t} style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e7ff", marginBottom: 4 }}>{t}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{d}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="quickstart" title="Quickstart">
          <CodeBlock label="1 · Copy SDK" code={CODE.install} />
          <CodeBlock label="2 · Initialize client" code={CODE.init} />
          <CodeBlock label="3 · Track an LLM call" code={CODE.track} />
        </Section>

        <Section id="sdk" title="SDK Reference">
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: 0 }}>The SDK wraps the HTTP API with typed methods and session management.</p>
          <CodeBlock label="track() — single event" code={CODE.track} />
          <CodeBlock label="trackBatch() — multiple events, shared session" code={CODE.batch} />
          <CodeBlock label="analyze() — one-shot array" code={CODE.analyze} />
        </Section>

        <Section id="api" title="API Reference">
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: 0 }}>All endpoints accept and return JSON.</p>
        </Section>

        <Section id="ingest" title="POST /api/ingest">
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0 }}>Accepts a single usage event. Runs the full pipeline autonomously.</p>
          <CodeBlock label="Request (curl)" code={CODE.ingestCurl} />
          <CodeBlock label="Response" code={CODE.ingestResponse} />
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#e0e7ff", margin: "0 0 10px" }}>Status values</p>
            {[["collecting","Fewer than 3 records for session — sending more data"],["ok","Enough records, no anomaly, cost below threshold"],["decision","Anomaly detected or cost > $0.50 — full WHY decision returned"],["partial","Anomaly detected but WHY engine failed — check OpenAI config"]].map(([s, d]) => (
              <div key={s} style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", alignItems: "flex-start" }}>
                <code style={{ fontSize: 11, background: "rgba(99,102,241,0.15)", padding: "2px 8px", borderRadius: 6, color: "#a78bfa", flexShrink: 0, marginTop: 1 }}>{s}</code>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{d}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="analyze" title="POST /api/analyze">
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0 }}>One-shot analysis. Pass a full usage array, get a decision immediately. No session accumulation.</p>
          <CodeBlock label="Request" code={`curl -X POST /api/analyze \\
  -d '{"usage":[{"model":"gpt-4o","tokens":10000,"cost":0.05},{"model":"gpt-4o","tokens":52000,"cost":0.26}]}'`} />
        </Section>

        <Section id="validate" title="GET /api/validate">
          <CodeBlock label="Response" code={`{ "ok": true, "checks": { "openai": true, "supabase": true, "slack": false }, "missing": ["slack"] }`} />
        </Section>

        <Section id="cron" title="Cron Jobs">
          <CodeBlock label="vercel.json" code={`{
  "crons": [
    { "path": "/api/cron/monitor", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/alerts",  "schedule": "*/5 * * * *" }
  ]
}`} />
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>Set <code style={{ color: "#a78bfa" }}>CRON_SECRET</code> in Vercel env vars — it&apos;s automatically added to cron request headers.</p>
        </Section>

        <Section id="config" title="Configuration">
          <CodeBlock label=".env.local" code={`OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
ALERT_EMAIL=you@company.com
CRON_SECRET=your-secret
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app`} />
        </Section>
      </main>
    </div>
  );
}
