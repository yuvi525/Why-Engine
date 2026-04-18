"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";

const I = "#6366f1", V = "#8b5cf6";
const GRAD = `linear-gradient(135deg,${I},${V})`;

/* ── Plan data ── */
const PLANS = [
  {
    key:      "free",
    name:     "Free",
    price:    0,
    period:   null,
    badge:    null,
    desc:     "Perfect for exploring AI cost intelligence.",
    cta:      "Get Started",
    ctaHref:  "/signup",
    accent:   "rgba(255,255,255,0.08)",
    featured: false,
    features: [
      "Up to 10 analysis runs/month",
      "WHY Engine decision output",
      "Anomaly detection",
      "Basic cost breakdown",
      "Community support",
    ],
    limitations: [
      "No decision history",
      "No Autopilot access",
      "No API key access",
    ],
  },
  {
    key:      "growth",
    name:     "Growth",
    price:    12,
    period:   "/month",
    badge:    "Most popular",
    desc:     "For teams actively monitoring AI spend.",
    cta:      "Upgrade to Growth",
    accent:   I,
    featured: true,
    features: [
      "500 analysis runs/month",
      "Full WHY Engine intelligence",
      "30-day decision history",
      "Slack & email alerts",
      "API key access",
      "Priority support",
    ],
    limitations: [],
  },
  {
    key:      "scale",
    name:     "Scale",
    price:    49,
    period:   "/month",
    badge:    "Best value",
    desc:     "Unlimited AI cost autopilot for power teams.",
    cta:      "Upgrade to Scale",
    accent:   V,
    featured: false,
    features: [
      "Unlimited analysis runs",
      "Full WHY Engine intelligence",
      "90-day decision history",
      "Autopilot cost controls",
      "Multi-org support",
      "Advanced API + SDK",
      "Dedicated support",
    ],
    limitations: [],
  },
];

/* ── Upgrade banner (soft paywall) ── */
export function UpgradeBanner({ plan = "free", feature = "advanced AI Cost Intelligence" }) {
  if (plan !== "free") return null;
  return (
    <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 2px" }}>
          ⚡ Upgrade to unlock {feature}
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          Free plan — limited to 10 runs/month.
        </p>
      </div>
      <a href="/pricing" style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#fff", background: GRAD, padding: "8px 18px", borderRadius: 100, textDecoration: "none", boxShadow: "0 0 16px rgba(99,102,241,0.3)" }}>
        View Plans →
      </a>
    </div>
  );
}

/* ── Tick / cross ── */
function Tick() { return <span style={{ color: "#10b981", fontSize: 14, flexShrink: 0 }}>✓</span>; }
function Cross() { return <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 14, flexShrink: 0 }}>✗</span>; }

/* ── Single plan card ── */
function PlanCard({ plan, currentPlan, loading, onUpgrade }) {
  const isCurrent  = currentPlan === plan.key;
  const isUpgrade  = !isCurrent && plan.price > 0;
  const borderCol  = plan.featured ? I : "var(--border)";

  return (
    <div style={{
      position: "relative", display: "flex", flexDirection: "column",
      background: plan.featured ? "rgba(99,102,241,0.06)" : "var(--bg-card)",
      border: `1px solid ${borderCol}`,
      borderRadius: 22,
      padding: "2rem",
      boxShadow: plan.featured ? `0 0 40px rgba(99,102,241,0.12)` : "none",
      transition: "transform 0.2s",
    }}>
      {/* Badge */}
      {plan.badge && (
        <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: GRAD, borderRadius: 100, padding: "4px 14px", fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "#fff", whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}>
          {plan.badge}
        </div>
      )}

      {/* Header */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 10px" }}>{plan.name}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
        <span style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)" }}>
          {plan.price === 0 ? "Free" : `$${plan.price}`}
        </span>
        {plan.period && <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{plan.period}</span>}
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 24px", lineHeight: 1.6 }}>{plan.desc}</p>

      {/* CTA */}
      {isCurrent ? (
        <div style={{ padding: "10px 0", textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--text-muted)", borderRadius: 100, border: "1px solid var(--border)", marginBottom: 24 }}>
          ✓ Current Plan
        </div>
      ) : (
        <button
          onClick={() => onUpgrade(plan.key)}
          disabled={loading === plan.key}
          style={{
            padding: "11px 0", borderRadius: 100, fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 24, transition: "opacity 0.2s, transform 0.2s",
            background: plan.featured ? GRAD : "transparent",
            border: `1px solid ${plan.featured ? "transparent" : borderCol}`,
            color: plan.featured ? "#fff" : "var(--text-primary)",
            boxShadow: plan.featured ? "0 0 20px rgba(99,102,241,0.3)" : "none",
            opacity: loading === plan.key ? 0.7 : 1,
          }}>
          {loading === plan.key ? "Redirecting…" : plan.cta}
        </button>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border)", margin: "0 0 20px" }} />

      {/* Features */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {plan.features.map(f => (
          <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
            <Tick /> {f}
          </li>
        ))}
        {plan.limitations.map(f => (
          <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
            <Cross /> {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PRICING PAGE
══════════════════════════════════════════════════════════════════ */
export default function PricingPage() {
  const [currentPlan, setCurrentPlan] = useState(null); // null = not loaded / not authed
  const [token, setToken]     = useState("");
  const [loading, setLoading] = useState(null); // key being upgraded
  const [error, setError]     = useState("");
  const [notice, setNotice]   = useState("");

  useEffect(() => {
    // Check upgrade success/cancel from URL
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgrade") === "success") setNotice(`🎉 Plan upgraded successfully! Welcome to ${params.get("plan") || "your new plan"}.`);
    if (params.get("upgrade") === "cancelled") setNotice("Upgrade cancelled. You're still on your current plan.");

    // Get session
    supabase.auth.getSession().then(async ({ data }) => {
      const t = data?.session?.access_token || "";
      setToken(t);
      if (t) {
        // Fetch org plan
        const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${t}` } }).catch(() => null);
        if (res?.ok) {
          const d = await res.json();
          setCurrentPlan(d?.plan || "free");
        } else {
          setCurrentPlan("free");
        }
      }
    });
  }, []);

  async function handleUpgrade(planKey) {
    if (planKey === "free") return;
    setError("");

    if (!token) {
      window.location.href = `/login?redirect=/pricing`;
      return;
    }

    setLoading(planKey);
    try {
      const res  = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.redirectTo) { window.location.href = data.redirectTo; return; }
        throw new Error(data?.error || "Failed to start checkout.");
      }

      window.location.href = data.url; // → Stripe hosted checkout
    } catch (err) {
      setError(err.message);
      setLoading(null);
    }
  }

  return (
    <div style={{ flex: 1, padding: "64px 24px 80px", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1060, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", margin: "0 0 14px" }}>AI Cost Intelligence Plans</p>
          <h1 style={{ fontSize: "clamp(30px,5vw,52px)", fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)", margin: "0 0 16px", lineHeight: 1.1 }}>
            Upgrade Your<br/>
            <span style={{ background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              AI Spend Visibility
            </span>
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-secondary)", maxWidth: 540, margin: "0 auto 0", lineHeight: 1.7 }}>
            Know exactly why your AI costs spike, and what to do about it. Stop wasting budget on invisible waste.
          </p>
        </div>

        {/* Notice banners */}
        {notice && (
          <div style={{ background: notice.startsWith("🎉") ? "rgba(16,185,129,0.08)" : "rgba(99,102,241,0.08)", border: `1px solid ${notice.startsWith("🎉") ? "rgba(16,185,129,0.25)" : "rgba(99,102,241,0.2)"}`, borderRadius: 14, padding: "14px 20px", textAlign: "center", fontSize: 14, color: notice.startsWith("🎉") ? "var(--emerald)" : "var(--text-primary)", marginBottom: 32 }}>
            {notice}
          </div>
        )}
        {error && (
          <div style={{ background: "var(--rose-muted)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 14, padding: "14px 20px", textAlign: "center", fontSize: 13, color: "var(--rose)", marginBottom: 24 }}>
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24, alignItems: "start" }}>
          {PLANS.map(plan => (
            <PlanCard
              key={plan.key}
              plan={plan}
              currentPlan={currentPlan}
              loading={loading}
              onUpgrade={handleUpgrade}
            />
          ))}
        </div>

        {/* Trust row */}
        <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap", marginTop: 52 }}>
          {["Cancel anytime", "No setup fees", "Instant upgrade", "Secure via Stripe"].map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
              <span style={{ color: "#10b981" }}>✓</span> {t}
            </div>
          ))}
        </div>

        {/* Manage billing link (only for paid users) */}
        {currentPlan && currentPlan !== "free" && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <a href="/api/stripe/portal" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "underline" }}>
              Manage billing &amp; invoices →
            </a>
          </div>
        )}

        {/* FAQ */}
        <div style={{ maxWidth: 640, margin: "56px auto 0" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", textAlign: "center", letterSpacing: "-0.03em", marginBottom: 28 }}>FAQ</h2>
          {[
            ["Can I use WHY Engine without paying?", "Yes — the Free plan gives you 10 analysis runs per month, which is enough to explore the platform and see real cost intelligence output."],
            ["What counts as an analysis run?", "A run is triggered when enough usage data is collected for a session (≥ 3 records) OR when total session cost exceeds $0.50. Low-volume sessions below the threshold don't count."],
            ["Is my payment information secure?", "All payments are processed by Stripe. We never store or see your card details."],
            ["Can I cancel anytime?", "Yes. Cancel in the billing portal at any time. Your plan continues until the end of the billing period, then reverts to Free."],
            ["Do I need to set up Stripe keys?", "Only if you're self-hosting and want to enable billing. The demo mode works fully without Stripe keys."],
          ].map(([q, a]) => (
            <details key={q} style={{ borderBottom: "1px solid var(--border)", padding: "16px 0", cursor: "pointer" }}>
              <summary style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {q} <span style={{ color: "var(--text-muted)", fontSize: 18, lineHeight: 1 }}>+</span>
              </summary>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "12px 0 0", lineHeight: 1.75 }}>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
