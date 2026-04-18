"use client";

import { useState, useRef, useEffect } from "react";
import { DecisionCard } from "@/components/decision-card";

const DEMO_DATA = [
  { model: "gpt-4o", tokens: 10000, cost: 5 },
  { model: "gpt-4o", tokens: 15000, cost: 7 },
  { model: "gpt-4o", tokens: 55000, cost: 28 },
];
const DEMO_JSON = JSON.stringify(DEMO_DATA, null, 2);

const PLACEHOLDER = `[
  { "model": "gpt-4o", "tokens": 10000, "cost": 5 },
  { "model": "gpt-4o", "tokens": 15000, "cost": 7 },
  { "model": "gpt-4o", "tokens": 55000, "cost": 28 }
]`;

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: 16, minHeight: 400 }}>
      {/* Header skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div className="skeleton" style={{ height: 12, width: "45%", borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 24, width: 80, borderRadius: 100 }} />
      </div>
      <div className="skeleton" style={{ height: 22, width: "70%", borderRadius: 8 }} />
      {/* Section skeletons */}
      {[0.9, 0.75, 0.85, 0.6, 0.7].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 14, width: `${w * 100}%`, borderRadius: 8 }} />
      ))}
      <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
      {[0.8, 0.65].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 14, width: `${w * 100}%`, borderRadius: 8 }} />
      ))}
    </div>
  );
}

function EmptyState({ onDemo }) {
  return (
    <div className="card animate-fade-in" style={{
      padding: "4rem 2rem", display: "flex", flexDirection: "column",
      alignItems: "center", textAlign: "center", minHeight: 360,
      justifyContent: "center",
      border: "1px dashed var(--border-strong)",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, marginBottom: 20,
        background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))",
        border: "1px solid rgba(99,102,241,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa",
      }}>
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <path d="M13 3L23 8.5V17.5L13 23L3 17.5V8.5L13 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <circle cx="13" cy="13" r="4" fill="currentColor"/>
        </svg>
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
        Run AI Cost Intelligence on your usage data
      </p>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 24px", lineHeight: 1.6, maxWidth: 280 }}>
        Paste usage JSON or run the demo to see a full WHY Decision Insight.
      </p>
      <button onClick={onDemo} className="btn-accent" style={{ padding: "10px 22px", fontSize: 13, border: "none", cursor: "pointer" }}>
        Try Demo
      </button>
    </div>
  );
}

export default function AnalyzePage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [success, setSuccess] = useState(false);
  const [visible, setVisible] = useState(false);

  const resultRef = useRef(null);

  useEffect(() => {
    if (result) {
      const t = setTimeout(() => setVisible(true), 30);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [result]);

  async function runAnalysis(payload) {
    setError(""); setResult(null); setSuccess(false); setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usage: payload }),
      });
      let data = null;
      try { data = await res.json(); } catch { throw new Error("Failed to parse response."); }
      if (!res.ok) throw new Error(data?.error || "Analysis failed.");
      if (data?.message) { setError(data.message); return; }
      setResult(data); setSuccess(true);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (err) {
      setError(err.message || "Failed to analyze.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    const val = input.trim();
    if (!val) { setError("Paste usage JSON before running."); return; }
    let parsed;
    try { parsed = JSON.parse(val); } catch { setError("Invalid JSON. Check for missing commas or brackets."); return; }
    if (!Array.isArray(parsed)) { setError("Usage data must be a JSON array — e.g. [{ ... }, { ... }]."); return; }
    await runAnalysis(parsed);
  }

  async function handleDemo() {
    setInput(DEMO_JSON); setError(""); setResult(null); setSuccess(false);
    await runAnalysis(DEMO_DATA);
  }

  function handleClear() { setInput(""); setError(""); setResult(null); setSuccess(false); }

  return (
    <div style={{ flex: 1, padding: "40px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Page header */}
        <div className="card animate-fade-up" style={{ padding: "2rem 2.5rem" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>WHY Engine</p>
              <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: "0 0 10px" }}>Run Cost Intelligence</h1>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)", margin: 0, maxWidth: 480 }}>
                Paste your LLM usage data — get a full AI spend anomaly report with causation, financial impact, and ranked actions.
              </p>
            </div>
            <button onClick={handleDemo} disabled={loading} className="btn-ghost" style={{ padding: "10px 20px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M5.5 4.5L9.5 7L5.5 9.5V4.5Z" fill="currentColor"/>
              </svg>
              Try Demo
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 20, alignItems: "start" }}>

          {/* Input panel */}
          <div className="card animate-fade-up delay-100" style={{ padding: "1.75rem" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>Usage Input</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px", lineHeight: 1.6 }}>
              Paste your LLM usage data{" "}
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>(model, tokens, cost)</span>{" "}
              as a JSON array.
            </p>

            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
              JSON Payload
            </label>

            <div style={{ position: "relative" }}>
              <textarea
                id="usage-json"
                value={input}
                onChange={e => { setInput(e.target.value); setError(""); }}
                placeholder={PLACEHOLDER}
                rows={14}
                spellCheck={false}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: error ? "rgba(244,63,94,0.05)" : "var(--bg-muted)",
                  border: `1px solid ${error ? "rgba(244,63,94,0.4)" : "var(--border)"}`,
                  borderRadius: 14, padding: "12px 14px",
                  fontFamily: "var(--font-geist-mono, monospace)", fontSize: 12, lineHeight: 1.7,
                  color: "var(--text-primary)", resize: "vertical", outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => { if (!error) e.target.style.borderColor = "var(--border-strong)"; }}
                onBlur={e => { if (!error) e.target.style.borderColor = "var(--border)"; }}
              />
              {input && (
                <button onClick={handleClear} style={{
                  position: "absolute", top: 10, right: 10,
                  background: "var(--bg-subtle)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: 5, cursor: "pointer", color: "var(--text-muted)",
                  display: "flex", lineHeight: 0, transition: "color 0.2s",
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>

            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>
              Format: <code style={{ background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: 6, fontSize: 11 }}>[{`{"model":"gpt-4o","tokens":10000,"cost":5}`}]</code>
            </p>

            {error && (
              <div style={{
                marginTop: 14, display: "flex", gap: 10, alignItems: "flex-start",
                background: "var(--rose-muted)", border: "1px solid rgba(244,63,94,0.25)",
                borderRadius: 12, padding: "12px 14px",
              }}>
                <svg style={{ color: "var(--rose)", flexShrink: 0, marginTop: 1 }} width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M7.5 4.5V8M7.5 10.5H7.51" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <p style={{ fontSize: 13, color: "var(--rose)", margin: 0, lineHeight: 1.5 }}>{error}</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={handleAnalyze} disabled={loading} className="btn-accent" style={{ flex: 1, padding: "11px 0", fontSize: 13, cursor: "pointer", border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {loading ? (
                  <>
                    <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                      <circle cx="7" cy="7" r="2" fill="currentColor"/>
                    </svg>
                    Run Analysis
                  </>
                )}
              </button>
              <button onClick={handleDemo} disabled={loading} className="btn-ghost" style={{ padding: "11px 18px", fontSize: 13, cursor: "pointer" }}>
                Demo
              </button>
            </div>
          </div>

          {/* Result panel */}
          <div ref={resultRef} style={{ scrollMarginTop: 80 }}>
            {loading && <SkeletonCard />}
            {!loading && !result && !error && <EmptyState onDemo={handleDemo} />}
            {!loading && result && (
              <div style={{
                display: "flex", flexDirection: "column", gap: 12,
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(16px)",
                transition: "opacity 0.45s cubic-bezier(0.22,1,0.36,1), transform 0.45s cubic-bezier(0.22,1,0.36,1)",
              }}>
                {success && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "var(--emerald-muted)", border: "1px solid rgba(16,185,129,0.25)",
                    borderRadius: 14, padding: "12px 16px",
                  }}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ color: "var(--emerald)", flexShrink: 0 }}>
                      <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M4.5 7.5L6.5 9.5L10.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--emerald)", margin: 0 }}>
                      Decision Insight ready — here&apos;s what to fix
                    </p>
                  </div>
                )}
                <DecisionCard decision={result} totalCost={result?.totalCost} anomalyType={result?.anomalyType ?? result?.type} />
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .analyze-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
