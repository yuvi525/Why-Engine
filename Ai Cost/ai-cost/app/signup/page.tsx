"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/client";
const supabase = createBrowserSupabaseClient();

const I = "#6366f1";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ orgName: "", email: "", password: "", confirm: "" });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [step, setStep]         = useState("form"); // "form" | "verify"

  function update(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.orgName.trim()) { setError("Organisation name is required."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      // 1 — Create Supabase Auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email:    form.email,
        password: form.password,
      });
      if (authErr) throw authErr;

      const user = authData?.user;
      if (!user) throw new Error("Sign up succeeded but no user returned. Check your Supabase email settings.");

      // 2 — Create org + membership via server endpoint
      const setupRes = await fetch("/api/auth/setup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ user_id: user.id, org_name: form.orgName.trim() }),
      });
      const setupData = await setupRes.json();
      if (!setupRes.ok) throw new Error(setupData?.error || "Organisation setup failed.");

      // 3 — If email confirmation is required, show verify step; else redirect
      if (authData?.session) {
        router.push("/dashboard");
      } else {
        setStep("verify");
      }
    } catch (err) {
      setError(err?.message || "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "verify") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 20px" }}>✉</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 10px" }}>Check your email</h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, margin: "0 0 24px" }}>
            We sent a confirmation link to <strong style={{ color: "var(--text-primary)" }}>{form.email}</strong>. Click it to activate your account and access your dashboard.
          </p>
          <Link href="/login" className="btn-accent" style={{ display: "inline-block", padding: "11px 28px", fontSize: 14, fontWeight: 700, textDecoration: "none", borderRadius: 100 }}>
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", background: "var(--bg-muted)",
    border: "1px solid var(--border)", borderRadius: 12, padding: "11px 14px",
    fontSize: 14, color: "var(--text-primary)", outline: "none", transition: "border-color 0.2s",
  };
  const labelStyle = {
    display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
    textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 7,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: I, boxShadow: `0 0 12px ${I}` }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--text-muted)" }}>WHY Engine</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", margin: 0 }}>Create your account</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Start monitoring AI costs in minutes</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <div>
            <label style={labelStyle}>Organisation Name</label>
            <input id="signup-org" type="text" value={form.orgName} onChange={update("orgName")} required
              placeholder="Acme Corp" autoComplete="organization"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = I} onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0 0" }}>Your workspace name. You can change this later.</p>
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input id="signup-email" type="email" value={form.email} onChange={update("email")} required
              placeholder="you@company.com" autoComplete="email"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = I} onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input id="signup-password" type="password" value={form.password} onChange={update("password")} required
              placeholder="8+ characters" autoComplete="new-password"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = I} onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
          </div>

          <div>
            <label style={labelStyle}>Confirm Password</label>
            <input id="signup-confirm" type="password" value={form.confirm} onChange={update("confirm")} required
              placeholder="Repeat password" autoComplete="new-password"
              style={{
                ...inputStyle,
                borderColor: form.confirm && form.confirm !== form.password ? "rgba(244,63,94,0.5)" : "var(--border)",
              }}
              onFocus={e => e.target.style.borderColor = I} onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
          </div>

          {error && (
            <div style={{ background: "var(--rose-muted)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--rose)" }}>
              {error}
            </div>
          )}

          <button id="signup-submit" type="submit" disabled={loading} className="btn-accent"
            style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, border: "none", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}>
            {loading
              ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Creating account…</>
              : "Create Account →"}
          </button>

          <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            Free plan — no credit card required
          </p>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 20 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: I, fontWeight: 600, textDecoration: "none" }}>Sign in →</Link>
        </p>
      </div>
      
    </div>
  );
}
