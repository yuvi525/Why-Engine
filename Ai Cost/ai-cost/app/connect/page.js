"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COPY_MAP } from "@/lib/brand-constants";

const PROVIDERS = [
  {
    id:          "openai",
    name:        "OpenAI",
    color:       "#10a37f",
    placeholder: "sk-...",
    helper:      "Used to track GPT-4o, GPT-4o-mini costs automatically",
    storageKey:  "whye_openai_key_ref",
  },
  {
    id:          "anthropic",
    name:        "Claude",
    color:       "#c96442",
    placeholder: "sk-ant-...",
    helper:      "Used to track Claude Sonnet, Haiku costs automatically",
    storageKey:  "whye_anthropic_key_ref",
  },
];

function maskKey(key) {
  if (!key || key.length < 11) return key;
  return key.slice(0, 7) + "..." + key.slice(-4);
}

function ProviderCard({ provider }) {
  const [value, setValue]   = useState("");
  const [status, setStatus] = useState(() => {
    try { return localStorage.getItem(provider.storageKey) ? "connected" : "not_connected"; }
    catch { return "not_connected"; }
  });
  const [toast, setToast]   = useState("");

  function handleSave() {
    if (!value.trim()) return;
    // Store only display ref — never the full key
    const ref = maskKey(value.trim());
    try { localStorage.setItem(provider.storageKey, ref); } catch { /* no-op */ }
    setStatus("connected");
    setToast(`${provider.name} connected — tracking enabled`);
    setValue("");
    setTimeout(() => setToast(""), 3000);
  }

  function handleDisconnect() {
    try { localStorage.removeItem(provider.storageKey); } catch { /* no-op */ }
    setStatus("not_connected");
  }

  const isConnected = status === "connected";
  const storedRef   = (() => { try { return localStorage.getItem(provider.storageKey); } catch { return null; } })();

  return (
    <div style={{
      background:   "rgba(255,255,255,0.03)",
      backdropFilter: "blur(12px)",
      border:       `1px solid ${isConnected ? provider.color + "50" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 18,
      padding:      "1.75rem",
      transition:   "border-color 0.2s",
      position:     "relative",
    }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#10b981", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 100, padding: "5px 14px", whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(16,185,129,0.4)", zIndex: 10 }}>
          ✓ {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: provider.color, letterSpacing: "-0.02em" }}>{provider.name}</span>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 100, background: isConnected ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)", border: `1px solid ${isConnected ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`, color: isConnected ? "#10b981" : "rgba(255,255,255,0.4)" }}>
          {isConnected ? "● Connected" : "○ Not Connected"}
        </span>
      </div>

      {isConnected ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>{storedRef}</span>
          <button onClick={handleDisconnect} style={{ fontSize: 11, color: "#f43f5e", background: "none", border: "none", cursor: "pointer" }}>Disconnect</button>
        </div>
      ) : (
        <>
          <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>API Key</label>
          <input
            id={`key-${provider.id}`}
            type="password"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={provider.placeholder}
            autoComplete="off"
            style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "#fff", outline: "none", fontFamily: "monospace", marginBottom: 10 }}
          />
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "0 0 14px", lineHeight: 1.5 }}>{provider.helper}</p>
          <button onClick={handleSave} disabled={!value.trim()} style={{ width: "100%", padding: "9px 0", fontSize: 13, fontWeight: 700, background: value.trim() ? `${provider.color}` : "rgba(255,255,255,0.06)", border: "none", borderRadius: 100, color: "#fff", cursor: value.trim() ? "pointer" : "not-allowed", transition: "background 0.2s", opacity: value.trim() ? 1 : 0.5 }}>
            Save Key
          </button>
        </>
      )}
    </div>
  );
}

function CustomEndpointCard() {
  const [url, setUrl]     = useState("");
  const [key, setKey]     = useState("");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    try { localStorage.setItem("whye_custom_endpoint_ref", url); } catch { /* no-op */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const inputStyle = {
    width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 12px",
    fontSize: 13, color: "#fff", outline: "none", fontFamily: "monospace",
  };

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "1.75rem" }}>
      <span style={{ fontSize: 18, fontWeight: 800, color: "#a78bfa", letterSpacing: "-0.02em", display: "block", marginBottom: 16 }}>Custom Endpoint</span>
      <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>Base URL</label>
      <input id="custom-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.groq.com/openai/v1" autoComplete="off" style={{ ...inputStyle, marginBottom: 10 }} />
      <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>API Key</label>
      <input id="custom-key" type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="gsk_..." autoComplete="off" style={{ ...inputStyle, marginBottom: 10 }} />
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "0 0 14px", lineHeight: 1.5 }}>For Ollama, Together AI, Groq, or any OpenAI-compatible API</p>
      <button onClick={handleSave} disabled={!url.trim()} style={{ width: "100%", padding: "9px 0", fontSize: 13, fontWeight: 700, background: url.trim() ? "rgba(167,139,250,0.8)" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 100, color: "#fff", cursor: url.trim() ? "pointer" : "not-allowed", opacity: url.trim() ? 1 : 0.5 }}>
        {saved ? "✓ Saved locally" : "Save Endpoint"}
      </button>
    </div>
  );
}

export default function ConnectPage() {
  const router  = useRouter();
  const connectedProviders = PROVIDERS.filter(p => { try { return !!localStorage.getItem(p.storageKey); } catch { return false; } }).map(p => p.id);

  function handleContinue() {
    const connected = PROVIDERS.filter(p => { try { return !!localStorage.getItem(p.storageKey); } catch { return false; } }).map(p => p.id);
    console.log("BYOK_INTENT:", { providers: connected });
    router.push("/dashboard");
  }

  return (
    <div style={{ flex: 1, padding: "52px 24px 80px", background: "#030308" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Header */}
        <div className="animate-fade-up">
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", margin: "0 0 12px" }}>WHY Engine · BYOK</p>
          <h1 style={{ fontSize: "clamp(26px,4vw,40px)", fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", margin: "0 0 10px" }}>
            {COPY_MAP.cta_connect}
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.7 }}>
            Your keys are stored locally and never sent to our servers.
          </p>
        </div>

        {/* Provider cards */}
        <div className="animate-fade-up delay-100" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {PROVIDERS.map(p => <ProviderCard key={p.id} provider={p} />)}
        </div>

        {/* Custom endpoint */}
        <div className="animate-fade-up delay-200">
          <CustomEndpointCard />
        </div>

        {/* Info box */}
        <div className="animate-fade-up delay-300" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
            <div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: "0 0 6px", lineHeight: 1.6 }}>
                These inputs prepare your account for future automatic tracking. Full BYOK integration ships in v2. Today, use our SDK for manual tracking.
              </p>
              <a href="/docs" style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", textDecoration: "none" }}>View SDK Docs →</a>
            </div>
          </div>
        </div>

        {/* Continue button */}
        <button onClick={handleContinue} className="animate-fade-up delay-300" style={{ padding: "13px 0", fontSize: 15, fontWeight: 800, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 100, color: "#fff", cursor: "pointer", boxShadow: "0 0 32px rgba(99,102,241,0.3)", letterSpacing: "-0.01em" }}>
          Continue to Dashboard →
        </button>
      </div>
    </div>
  );
}
