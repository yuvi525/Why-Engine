"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase-browser";

const I = "#6366f1";

function StatusBadge({ revoked }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
      padding: "3px 10px", borderRadius: 100,
      background: revoked ? "rgba(244,63,94,0.1)" : "rgba(16,185,129,0.1)",
      border: `1px solid ${revoked ? "rgba(244,63,94,0.25)" : "rgba(16,185,129,0.25)"}`,
      color: revoked ? "var(--rose)" : "var(--emerald)",
    }}>
      {revoked ? "Revoked" : "Active"}
    </span>
  );
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  }
  return (
    <button onClick={copy} style={{ background: done ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "4px 12px", fontSize: 11, fontWeight: 600, color: done ? "var(--emerald)" : "var(--text-muted)", cursor: "pointer", transition: "all 0.2s" }}>
      {done ? "✓ Copied" : "Copy"}
    </button>
  );
}

export default function ApiKeysPage() {
  const [keys, setKeys]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey]       = useState(null);   // {rawKey, prefix, id}
  const [revoking, setRevoking]   = useState(null);
  const [error, setError]         = useState("");
  const [token, setToken]         = useState("");

  // Get session token for API calls
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data?.session?.access_token || "");
    });
  }, []);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const fetchKeys = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res  = await fetch("/api/keys", { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load keys");
      setKeys(data.keys || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, authHeaders]);

  useEffect(() => { if (token) fetchKeys(); }, [token, fetchKeys]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setNewKey(null);
    try {
      const res  = await fetch("/api/keys", { method: "POST", headers: authHeaders(), body: JSON.stringify({ name: newKeyName || "API Key" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create key");
      setNewKey(data);
      setNewKeyName("");
      fetchKeys();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId) {
    setRevoking(keyId);
    setError("");
    try {
      const res  = await fetch(`/api/keys/${keyId}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to revoke key");
      fetchKeys();
    } catch (err) {
      setError(err.message);
    } finally {
      setRevoking(null);
    }
  }

  if (!token) {
    return (
      <div style={{ flex: 1, padding: "40px 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="card" style={{ padding: "2.5rem", textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🔑</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 10px" }}>Sign in to manage API keys</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>API keys are scoped to your organisation.</p>
          <a href="/login" className="btn-accent" style={{ display: "inline-block", padding: "10px 24px", fontSize: 13, fontWeight: 700, textDecoration: "none", borderRadius: 100 }}>Sign In →</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: "40px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <div className="card animate-fade-up" style={{ padding: "1.75rem 2rem" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>Settings</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: "0 0 8px" }}>API Keys</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
            Use these keys to authenticate requests to <code style={{ background: "var(--bg-subtle)", padding: "2px 7px", borderRadius: 6, fontSize: 11 }}>POST /api/ingest</code> from your application.
          </p>
        </div>

        {/* New key revealed */}
        {newKey && (
          <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 18, padding: "1.5rem" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--emerald)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
              ✓ Key created — copy it now. It will not be shown again.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg-muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px" }}>
              <code style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-geist-mono,monospace)", wordBreak: "break-all" }}>
                {newKey.rawKey}
              </code>
              <CopyButton text={newKey.rawKey} />
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
              <span>Prefix: <code style={{ color: "var(--text-secondary)" }}>{newKey.prefix}…</code></span>
              <span>Usage: <code style={{ color: "var(--text-secondary)" }}>Authorization: Bearer {newKey.rawKey}</code></span>
            </div>
            <button onClick={() => setNewKey(null)} style={{ marginTop: 14, background: "none", border: "none", fontSize: 12, color: "var(--text-muted)", cursor: "pointer", textDecoration: "underline" }}>
              I've saved it — dismiss
            </button>
          </div>
        )}

        {/* Create form */}
        <form onSubmit={handleCreate} className="card animate-fade-up delay-100" style={{ padding: "1.5rem" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 14px" }}>Create new key</h2>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
              placeholder="Key name, e.g. Production"
              style={{ flex: 1, background: "var(--bg-muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "var(--text-primary)", outline: "none" }}
              onFocus={e => e.target.style.borderColor = I} onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
            <button type="submit" disabled={creating} className="btn-accent" style={{ padding: "10px 20px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              {creating ? <><span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Creating…</> : "+ Create Key"}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div style={{ background: "var(--rose-muted)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "var(--rose)" }}>
            {error}
          </div>
        )}

        {/* Key list */}
        <div className="card animate-fade-up delay-200" style={{ padding: "1.5rem" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px" }}>
            Your keys <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>({keys.filter(k => !k.revoked_at).length} active)</span>
          </h2>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 12 }} />)}
            </div>
          ) : keys.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "2rem 0" }}>No keys yet — create one above.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {keys.map(key => (
                <div key={key.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{key.name || "Unnamed"}</span>
                      <StatusBadge revoked={!!key.revoked_at} />
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-muted)" }}>
                      <span><code style={{ color: "var(--text-secondary)" }}>{key.key_prefix}…</code></span>
                      <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
                      {key.last_used_at && <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>}
                      {key.revoked_at && <span>Revoked {new Date(key.revoked_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  {!key.revoked_at && (
                    <button
                      onClick={() => { if (confirm(`Revoke key "${key.name}"? This cannot be undone.`)) handleRevoke(key.id); }}
                      disabled={revoking === key.id}
                      style={{ fontSize: 12, fontWeight: 600, color: "var(--rose)", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 8, padding: "5px 14px", cursor: "pointer", whiteSpace: "nowrap" }}>
                      {revoking === key.id ? "Revoking…" : "Revoke"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage guide */}
        <div className="card animate-fade-up delay-300" style={{ padding: "1.5rem" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 14px" }}>Usage</h2>
          <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px" }}>
            <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.8, color: "#e2e8f0", fontFamily: "var(--font-geist-mono,monospace)", overflowX: "auto" }}>{`# Track a single LLM call
curl -X POST https://your-app.vercel.app/api/ingest \\
  -H "Authorization: Bearer whe_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model":         "gpt-4o",
    "input_tokens":  8500,
    "output_tokens": 1200,
    "session_id":    "sess-001"
  }'`}</pre>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0", lineHeight: 1.6 }}>
            Or use the <a href="/docs" style={{ color: I, textDecoration: "none", fontWeight: 600 }}>WHY Engine SDK</a> for automatic tracking in your Node.js app.
          </p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
