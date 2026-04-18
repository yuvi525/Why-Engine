"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { DecisionCard } from "@/components/decision-card";
import { AnomalyToast } from "@/components/AnomalyToast";
import { supabase } from "@/lib/supabase-browser";
import { DEMO_ANALYSIS_RESULTS, DEMO_ANOMALIES, DEMO_USAGE, DEMO_AUTOPILOT_RULES } from "@/lib/demo-data";
import { COPY_MAP } from "@/lib/brand-constants";
import { COLORS, GRADIENTS } from "@/lib/design-system";

const REFRESH_MS = 10_000;

// ── Skeleton loader ───────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[0,1,2,3].map(i => (
          <div key={i} className="skeleton" style={{ height: 100, borderRadius: 18 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 420, borderRadius: 18 }} />
    </div>
  );
}

// ── Stat card with hover lift ─────────────────────────────────────────────
function StatCard({ label, value, sub, accentColor, icon, trend }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:    "#0a0a12",
        border:        `1px solid ${hovered ? "rgba(99,102,241,0.22)" : "rgba(255,255,255,0.07)"}`,
        borderRadius:  18,
        padding:       "1.25rem 1.4rem",
        boxShadow:     hovered
          ? "0 4px 8px rgba(0,0,0,0.55), 0 20px 56px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)"
          : "0 1px 3px rgba(0,0,0,0.55), 0 8px 32px rgba(0,0,0,0.45)",
        transform:     hovered ? "translateY(-4px)" : "translateY(0)",
        transition:    "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        position:      "relative",
        overflow:      "hidden",
      }}
    >
      {/* Subtle glow blob in corner */}
      <div style={{
        position:   "absolute", top: -20, right: -20,
        width:      80, height: 80,
        background: `radial-gradient(circle, ${accentColor || "rgba(99,102,241,0.2)"} 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", margin: 0 }}>
          {label}
        </p>
        {icon && <span style={{ fontSize: 16, opacity: 0.7 }}>{icon}</span>}
      </div>

      <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: accentColor ? accentColor.replace("rgba(","").split(",").slice(0,3).join(",").replace(/\d+$/, "1)") : "#f8fafc", margin: "0 0 4px", lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>{sub}</p>}
      {trend && (
        <p style={{ fontSize: 11, color: trend.up ? "#22c55e" : "#ef4444", margin: "6px 0 0", fontWeight: 600 }}>
          {trend.up ? "↑" : "↓"} {trend.label}
        </p>
      )}
    </div>
  );
}

// ── Demo stream mini bar ──────────────────────────────────────────────────
function StreamRecord({ r, i }) {
  return (
    <div className="animate-fade-up" style={{
      display:       "flex", alignItems: "center", gap: 10,
      padding:       "7px 12px",
      background:    "rgba(255,255,255,0.02)",
      border:        "1px solid rgba(255,255,255,0.06)",
      borderRadius:  10,
      fontSize:      11,
      animation:     `fadeUp 0.35s ${i * 0.08}s cubic-bezier(0.22,1,0.36,1) both`,
    }}>
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
      <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>{r.model}</span>
      <span style={{ color: "rgba(255,255,255,0.3)" }}>{Number(r.tokens || 0).toLocaleString()}t</span>
      <span style={{ marginLeft: "auto", fontWeight: 700, color: (r.cost || 0) > 0.3 ? "#ef4444" : "#22c55e" }}>${Number(r.cost || 0).toFixed(3)}</span>
    </div>
  );
}

// ── Autopilot mini panel ──────────────────────────────────────────────────
function AutopilotPanel({ autopilot }) {
  if (!autopilot?.suggestions?.length) return null;
  const topTwo = autopilot.suggestions.slice(0, 2);
  return (
    <div className="animate-fade-up delay-300" style={{ background: "#0a0a12", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "1.25rem 1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.55)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🤖</div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", margin: 0 }}>Cost Autopilot</p>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: 0 }}>
            {autopilot.rules_triggered} rule{autopilot.rules_triggered !== 1 ? "s" : ""} evaluated · Advisory only
          </p>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {topTwo.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#f8fafc", margin: "0 0 2px" }}>{s.title}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.5 }}>{s.manual_action}</p>
            </div>
            {s.estimatedMonthlySavings != null && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", whiteSpace: "nowrap", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 100, padding: "2px 8px" }}>
                ~${Number(s.estimatedMonthlySavings).toFixed(2)}/mo
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
// DASHBOARD PAGE
// ════════════════════════════════════════════════════
export default function DashboardPage() {
  const [isLoggedIn, setIsLoggedIn]   = useState(null);
  const [decision, setDecision]       = useState(null);
  const [autopilot, setAutopilot]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [source, setSource]           = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [countdown, setCountdown]     = useState(REFRESH_MS / 1000);
  const [streamRecords, setStreamRecords] = useState([]);
  const [toastVisible, setToastVisible]   = useState(false);
  const stopDemoRef = useRef(null);

  // ── Auth check ────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsLoggedIn(!!data?.session));
  }, []);

  // ── Demo toast after 3s ───────────────────────────
  useEffect(() => {
    if (source !== "demo") return;
    const t = setTimeout(() => setToastVisible(true), 3000);
    return () => clearTimeout(t);
  }, [source]);

  // ── Live data loader ──────────────────────────────
  const loadLive = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/latest-analysis");
      const d = await r.json().catch(() => null);
      if (r.ok && d?.found && d.data) {
        setDecision(d.data); setSource("live"); setLastUpdated(new Date()); setCountdown(REFRESH_MS / 1000);
        return;
      }
      const r2 = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usage: [
          { model: "gpt-4o", tokens: 12000, cost: 8 },
          { model: "gpt-4o", tokens: 18000, cost: 10 },
          { model: "gpt-4o", tokens: 34000, cost: 18 },
        ]}),
      });
      const d2 = await r2.json().catch(() => null);
      if (!r2.ok || !d2 || d2.message) { setDecision(null); setError(d2?.error || "No analysis data yet."); return; }
      setDecision(d2); setSource("sample"); setLastUpdated(new Date()); setCountdown(REFRESH_MS / 1000);
    } catch (e) {
      setDecision(null); setError(e?.message || "Unable to load.");
    } finally { setLoading(false); }
  }, []);

  // ── Demo mode loader ──────────────────────────────
  const loadDemo = useCallback(() => {
    setLoading(false); setSource("demo");
    setDecision(DEMO_ANALYSIS_RESULTS[0]);
    setAutopilot({
      suggestions:    DEMO_AUTOPILOT_RULES.map(r => ({ id: r.id, type: r.type, title: r.name, manual_action: r.description, estimatedMonthlySavings: r.total_saved_usd })),
      rules_triggered: DEMO_AUTOPILOT_RULES.filter(r => r.enabled).length,
    });
    setLastUpdated(new Date());
    setStreamRecords([]);

    const nodes = Object.entries(DEMO_ANALYSIS_RESULTS[0].node_breakdown || {}).map(
      ([node, data]) => ({ model: node, tokens: data.tokens ?? 0, cost: data.cost_usd ?? 0 })
    );
    let i = 0;
    const tid = setInterval(() => {
      if (i >= nodes.length) { clearInterval(tid); return; }
      setStreamRecords(prev => [...prev, { ...nodes[i], index: i }]);
      i++;
    }, 1800);
    stopDemoRef.current = () => clearInterval(tid);
  }, []);

  // ── Route on auth ─────────────────────────────────
  useEffect(() => {
    if (isLoggedIn === null) return;
    if (isLoggedIn) loadLive(); else loadDemo();
    return () => { if (stopDemoRef.current) stopDemoRef.current(); };
  }, [isLoggedIn, loadLive, loadDemo]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const id = setInterval(loadLive, REFRESH_MS);
    return () => clearInterval(id);
  }, [isLoggedIn, loadLive]);

  useEffect(() => {
    if (loading || !isLoggedIn) return;
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [loading, isLoggedIn]);

  // ── Derived stats ─────────────────────────────────
  const d0        = DEMO_ANALYSIS_RESULTS[0];
  const totalCost = decision?.total_cost_usd ?? decision?.totalCost ?? d0.total_cost_usd;
  const savings   = decision?.why_output?.financial_impact?.monthly_projection_usd ?? DEMO_USAGE.savings_from_autopilot_usd;
  const aType     = String(decision?.anomaly_type ?? decision?.anomalyType ?? decision?.type ?? d0.severity).replace(/_/g, " ");
  const priority  = decision?.priority ?? (decision?.severity === "critical" || decision?.severity === "high" ? "HIGH" : "MEDIUM");
  const priColor  = priority === "HIGH" ? "#ef4444" : priority === "MEDIUM" ? "#f59e0b" : "#22c55e";
  const activeAnomalies = DEMO_ANOMALIES.filter(a => a.severity === "critical" || a.severity === "high").length;

  return (
    <div style={{ flex: 1, padding: "32px 28px", background: "var(--bg-base)" }}>

      {/* Floating anomaly toast */}
      <AnomalyToast
        visible={toastVisible}
        severity={decision?.severity || "high"}
        message={`⚡ ${aType} detected in ${decision?.agent_id || "AI pipeline"} — view Decision Insight`}
        onClose={() => setToastVisible(false)}
      />

      <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Demo banner ── */}
        {source === "demo" && (
          <div className="animate-fade-up" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1", boxShadow: "0 0 10px rgba(99,102,241,0.6)", display: "inline-block", animation: "pulse 2s ease infinite" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                Demo Mode — Simulated AI Cost Intelligence
              </span>
            </div>
            <Link href="/connect" style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 100, padding: "4px 12px", textDecoration: "none" }}>
              Connect Real Data →
            </Link>
          </div>
        )}

        {/* ── Page header ── */}
        <div className="animate-fade-up delay-50" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", margin: "0 0 6px" }}>WHY Engine</p>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "#f8fafc", margin: "0 0 6px" }}>
              {COPY_MAP.dashboard_title}
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
              {source === "live" && "Live data · auto-refreshes every 10s"}
              {source === "sample" && "Sample analysis · connect your infrastructure for real data"}
              {source === "demo" && "Simulated stream · sign in to see your real AI spend"}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Live badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 100, padding: "4px 12px" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "pulse 1.5s ease infinite" }} />
              AI Cost Engine Active
            </div>
            {isLoggedIn ? (
              <button onClick={loadLive} disabled={loading} className="btn-accent" style={{ padding: "7px 18px", fontSize: 12, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                {loading
                  ? <><span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Refreshing</>
                  : <>↺ Refresh</>}
              </button>
            ) : (
              <Link href="/connect" className="btn-accent" style={{ padding: "7px 18px", fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                Connect AI →
              </Link>
            )}
          </div>
        </div>

        {/* ── Stat cards: AI Cost Intelligence Overview ── */}
        {!loading && (
          <div className="animate-fade-up delay-100" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            <StatCard
              label={COPY_MAP.cost_label}
              value={`$${Number(totalCost).toFixed(2)}`}
              sub="current period"
              icon="💰"
              accentColor="rgba(99,102,241,0.6)"
              trend={{ up: false, label: "+312% from baseline" }}
            />
            <StatCard
              label="Active Anomalies"
              value={String(activeAnomalies)}
              sub="critical + high priority"
              icon="⚠️"
              accentColor="rgba(239,68,68,0.6)"
            />
            <StatCard
              label={COPY_MAP.result_label + "s"}
              value={String(DEMO_USAGE.analyses_today)}
              sub="analyses today"
              icon="🔍"
              accentColor="rgba(139,92,246,0.6)"
              trend={{ up: true, label: "6 more than yesterday" }}
            />
            <StatCard
              label="Autopilot Savings"
              value={`$${Number(DEMO_USAGE.savings_from_autopilot_usd).toFixed(0)}`}
              sub="this billing period"
              icon="🤖"
              accentColor="rgba(34,197,94,0.6)"
              trend={{ up: true, label: "Est. $312/month" }}
            />
          </div>
        )}

        {loading && <Skeleton />}

        {!loading && error && (
          <div className="animate-fade-up" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 16, padding: "1.25rem 1.5rem", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", margin: "0 0 4px" }}>Unable to load {COPY_MAP.result_label}</p>
              <p style={{ fontSize: 12, color: "rgba(239,68,68,0.7)", margin: 0 }}>{error}</p>
            </div>
          </div>
        )}

        {/* ── Decision card ── */}
        {!loading && !error && decision && (
          <div className="animate-fade-up delay-200">
            <DecisionCard
              decision={decision}
              totalCost={decision?.total_cost_usd ?? decision?.totalCost}
              anomalyType={aType}
              severity={decision?.severity}
              isDemo={source === "demo"}
            />
          </div>
        )}

        {/* ── Ingest stream (demo) ── */}
        {source === "demo" && streamRecords.length > 0 && (
          <div className="animate-fade-up delay-300">
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", margin: "0 0 10px" }}>Simulated Ingest Stream</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {streamRecords.map((r, i) => <StreamRecord key={i} r={r} i={i} />)}
            </div>
          </div>
        )}

        {/* ── Autopilot panel ── */}
        {!loading && autopilot && <AutopilotPanel autopilot={autopilot} />}

        {/* ── Connect CTA (demo only) ── */}
        {source === "demo" && (
          <div className="animate-fade-up delay-400" style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.12)", borderRadius: 18, padding: "1.5rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", margin: "0 0 4px" }}>Ready to monitor your real AI spend?</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>Connect your infrastructure and get live cost intelligence in minutes.</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/connect" className="btn-accent" style={{ padding: "9px 20px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Get Started Free →</Link>
              <Link href="/docs" className="btn-ghost" style={{ padding: "9px 16px", fontSize: 12, textDecoration: "none" }}>View Docs</Link>
            </div>
          </div>
        )}

        {lastUpdated && !loading && isLoggedIn && (
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "right", margin: "0" }}>
            Updated {lastUpdated.toLocaleTimeString()} · next refresh in {countdown}s
          </p>
        )}
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 640px) {
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
