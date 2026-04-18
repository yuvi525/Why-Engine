"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase-browser";
import { UpgradeBanner } from "@/app/pricing/page";

const I = "#6366f1", V = "#8b5cf6";
const GRAD = `linear-gradient(135deg,${I},${V})`;

const TYPE_ICONS = {
  model_migration:      "🔄",
  prompt_optimization:  "📝",
  workflow_review:      "🔍",
  routing_optimization: "⚡",
  cost_monitoring:      "📊",
};

const TRIGGER_LABELS = { anomaly: "On Anomaly", cost_threshold: "Cost Threshold" };
const PRIORITY_COLORS = {
  HIGH:   { bg: "rgba(244,63,94,0.1)",   border: "rgba(244,63,94,0.25)",   text: "#f43f5e" },
  MEDIUM: { bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)",  text: "#f59e0b" },
  LOW:    { bg: "rgba(99,102,241,0.1)",  border: "rgba(99,102,241,0.25)",  text: "#6366f1" },
};

function PriorityBadge({ priority }) {
  const col = PRIORITY_COLORS[priority] || PRIORITY_COLORS.LOW;
  return (
    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 100, background: col.bg, border: `1px solid ${col.border}`, color: col.text }}>
      {priority}
    </span>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => !disabled && onChange(!checked)} disabled={disabled}
      style={{ width: 40, height: 22, borderRadius: 100, background: checked ? I : "rgba(255,255,255,0.1)", border: "none", cursor: disabled ? "not-allowed" : "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: checked ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", display: "block" }} />
    </button>
  );
}

function SuggestionCard({ s }) {
  const icon = TYPE_ICONS[s.type] || "💡";
  return (
    <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{s.title}</span>
            <PriorityBadge priority={s.priority || "LOW"} />
          </div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.6 }}>{s.detail}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {s.estimatedMonthlySavings != null && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981" }}>
                Est. ~${Number(s.estimatedMonthlySavings).toFixed(2)}/month saved
              </span>
            )}
            {s.confidence && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Confidence: {s.confidence}</span>
            )}
          </div>
          {s.manual_action && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              <strong style={{ color: I }}>Action: </strong>{s.manual_action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AutopilotPage() {
  const [plan, setPlan]         = useState(null);   // null = loading
  const [token, setToken]       = useState("");
  const [rules, setRules]       = useState([]);
  const [logs, setLogs]         = useState([]);
  const [suggestions, setSugs]  = useState([]);
  const [loading, setLoading]   = useState(true);
  const [seeding, setSeeding]   = useState(false);
  const [toggling, setToggling] = useState(null);
  const [error, setError]       = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const t = data?.session?.access_token || "";
      setToken(t);
      if (t) {
        const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${t}` } }).catch(() => null);
        const d = res?.ok ? await res.json() : {};
        setPlan(d?.plan || "free");
      } else {
        setPlan("free");
      }
    });
  }, []);

  const headers = useCallback(() => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Fetch rules + logs
      const rRes = await fetch("/api/autopilot/rules", { headers: headers() });
      if (rRes.ok) {
        const d = await rRes.json();
        setRules(d.rules || []);
        setLogs(d.logs || []);
      }
      // Fetch latest analysis for live suggestions
      const aRes = await fetch("/api/latest-analysis", { headers: headers() });
      if (aRes.ok) {
        const { found, data: analysis } = await aRes.json();
        if (found && analysis) {
          const sRes = await fetch("/api/autopilot", {
            method: "POST", headers: headers(),
            body: JSON.stringify({ decision: analysis }),
          });
          if (sRes.ok) {
            const s = await sRes.json();
            setSugs(s.suggestions || []);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => { if (token && plan === "scale") fetchData(); }, [token, plan, fetchData]);

  async function handleSeedDefaults() {
    setSeeding(true);
    try {
      const res  = await fetch("/api/autopilot/rules", { method: "POST", headers: headers(), body: JSON.stringify({ seed_defaults: true }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Seed failed");
      setRules(data.rules || []);
    } catch (err) { setError(err.message); }
    finally { setSeeding(false); }
  }

  async function handleToggle(rule) {
    setToggling(rule.id);
    try {
      const res  = await fetch(`/api/autopilot/rules/${rule.id}`, { method: "PATCH", headers: headers(), body: JSON.stringify({ enabled: !rule.enabled }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Toggle failed");
      setRules(prev => prev.map(r => r.id === rule.id ? data : r));
    } catch (err) { setError(err.message); }
    finally { setToggling(null); }
  }

  async function handleDelete(ruleId) {
    if (!confirm("Delete this rule?")) return;
    const res = await fetch(`/api/autopilot/rules/${ruleId}`, { method: "DELETE", headers: headers() });
    if (res.ok) setRules(prev => prev.filter(r => r.id !== ruleId));
  }

  // ── Not logged in ─────────────────────────────────────────────────────
  if (!token && plan !== null) {
    return (
      <div style={{ flex: 1, padding: "40px 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="card" style={{ padding: "2.5rem", textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🤖</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 10px" }}>Sign in to use Autopilot</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Autopilot (Advisory Mode) is scoped to your organisation.</p>
          <a href="/login" className="btn-accent" style={{ display: "inline-block", padding: "10px 28px", fontSize: 13, fontWeight: 700, textDecoration: "none", borderRadius: 100 }}>Sign In →</a>
        </div>
      </div>
    );
  }

  // ── Plan gate ─────────────────────────────────────────────────────────
  if (plan !== null && plan !== "scale") {
    return (
      <div style={{ flex: 1, padding: "40px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <UpgradeBanner plan={plan} feature="Autopilot (Advisory Mode)" />
          <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
            <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: "0 0 10px" }}>Autopilot (Advisory Mode)</h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 6px", lineHeight: 1.7 }}>AI-driven cost optimization suggestions — no automatic changes.</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28 }}>Available on the Scale plan.</p>
            <a href="/pricing" className="btn-accent" style={{ display: "inline-block", padding: "11px 32px", fontSize: 14, fontWeight: 700, textDecoration: "none", borderRadius: 100 }}>
              Unlock Autopilot →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: "40px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <div className="card animate-fade-up" style={{ padding: "1.75rem 2rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 8px" }}>Scale Plan · Advisory Mode</p>
              <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 10 }}>
                🤖 Autopilot
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                AI-driven cost optimization suggestions · No automatic changes — full control remains with you.
              </p>
            </div>
            {rules.length === 0 && !loading && (
              <button onClick={handleSeedDefaults} disabled={seeding} className="btn-accent"
                style={{ padding: "9px 18px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                {seeding ? "Adding…" : "+ Add Default Rules"}
              </button>
            )}
          </div>
        </div>

        {error && <div style={{ background: "var(--rose-muted)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "var(--rose)" }}>{error}</div>}

        {/* Live Suggestions */}
        {suggestions.length > 0 && (
          <div className="card animate-fade-up delay-100" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                Live Suggestions <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>({suggestions.length})</span>
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {suggestions.map(s => <SuggestionCard key={s.id} s={s} />)}
            </div>
          </div>
        )}

        {/* Rules */}
        <div className="card animate-fade-up delay-200" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Autopilot Rules <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>({rules.filter(r => r.enabled).length} active)</span>
            </h2>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 12 }} />)}
            </div>
          ) : rules.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>No rules configured yet.</p>
              <button onClick={handleSeedDefaults} disabled={seeding} className="btn-accent" style={{ padding: "9px 20px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>
                {seeding ? "Adding…" : "Add Default Rules"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rules.map(rule => (
                <div key={rule.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 12 }}>
                  <Toggle checked={rule.enabled} onChange={() => handleToggle(rule)} disabled={toggling === rule.id} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{rule.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: I, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", padding: "2px 8px", borderRadius: 100 }}>
                        {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {rule.action_type} · {rule.config?.threshold ? `Threshold: $${rule.config.threshold}` : rule.config?.anomaly_type || "All anomalies"}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(rule.id)} style={{ fontSize: 11, color: "var(--rose)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", opacity: 0.7 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity log */}
        {logs.length > 0 && (
          <div className="card animate-fade-up delay-300" style={{ padding: "1.5rem" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 14px" }}>
              Activity Log <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>· Last 20 events</span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {logs.map(log => (
                <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: I, flexShrink: 0, marginTop: 6 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{log.action}</div>
                    {log.details?.decision_priority && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        Priority: {log.details.decision_priority} · Cost: ${Number(log.details.total_cost || 0).toFixed(3)} · Suggestions: {log.details.suggestions_count ?? 0}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{new Date(log.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
