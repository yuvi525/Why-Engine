"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";

const I = "#6366f1"; // indigo accent

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw authErr;
      router.push("/dashboard");
    } catch (err) {
      setError(err?.message || "Sign in failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: I, boxShadow: `0 0 12px ${I}` }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--text-muted)" }}>WHY Engine</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", margin: 0 }}>Welcome back</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Sign in to your AI cost dashboard</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 7 }}>Email</label>
            <input
              id="login-email"
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="you@company.com" autoComplete="email"
              style={{ width: "100%", boxSizing: "border-box", background: "var(--bg-muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 14px", fontSize: 14, color: "var(--text-primary)", outline: "none", transition: "border-color 0.2s" }}
              onFocus={e => e.target.style.borderColor = I} onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 7 }}>Password</label>
            <input
              id="login-password"
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••" autoComplete="current-password"
              style={{ width: "100%", boxSizing: "border-box", background: "var(--bg-muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 14px", fontSize: 14, color: "var(--text-primary)", outline: "none", transition: "border-color 0.2s" }}
              onFocus={e => e.target.style.borderColor = I} onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
          </div>

          {error && (
            <div style={{ background: "var(--rose-muted)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--rose)" }}>
              {error}
            </div>
          )}

          <button
            id="login-submit"
            type="submit" disabled={loading}
            className="btn-accent"
            style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}>
            {loading
              ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Signing in…</>
              : "Sign In →"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 24 }}>
          No account?{" "}
          <Link href="/signup" style={{ color: I, fontWeight: 600, textDecoration: "none" }}>Create one free →</Link>
        </p>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
          <Link href="/dashboard" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Continue without account →</Link>
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
