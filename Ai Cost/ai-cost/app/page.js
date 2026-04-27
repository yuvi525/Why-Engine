import Link from "next/link";

export const metadata = {
  title:       "WHY Engine — Stop Overpaying for AI",
  description: "AI Cost Autopilot: proxy-based LLM cost control with automatic routing, guardrails, and savings tracking. Start saving in 5 minutes.",
};

/* ── Hero stats ───────────────────────────────────────────────────── */
const STATS = [
  { value: "$312K+",  label: "AI spend controlled",  color: "#6366f1" },
  { value: "Up to 70%", label: "Cost reduction",      color: "#22c55e" },
  { value: "<1s",     label: "Routing decision",      color: "#a78bfa" },
  { value: "100%",    label: "Reversible actions",    color: "#f59e0b" },
];

/* ── Core capabilities ────────────────────────────────────────────── */
const CAPABILITIES = [
  {
    icon: "⇄",
    color: "#6366f1",
    bg:   "rgba(99,102,241,0.1)",
    title: "Intelligent Routing",
    desc:  "Every LLM call is automatically routed to the cheapest model that can handle it. gpt-4o → gpt-4o-mini when it's safe. Zero code changes.",
    saving: "Up to 60% per call",
  },
  {
    icon: "🛡",
    color: "#22c55e",
    bg:   "rgba(34,197,94,0.1)",
    title: "Budget Guardrails",
    desc:  "Set daily and monthly spend limits. Block or warn when approaching budget. Never get surprised by a $10K AI bill again.",
    saving: "Prevents runaway costs",
  },
  {
    icon: "⚡",
    color: "#f59e0b",
    bg:   "rgba(245,158,11,0.1)",
    title: "WHY Engine Insights",
    desc:  "Not just 'cost went up'. Root cause analysis with exact dollar impact, ranked actions, and confidence-gated execution.",
    saving: "Actionable, not just visible",
  },
  {
    icon: "🤖",
    color: "#a78bfa",
    bg:   "rgba(167,139,250,0.1)",
    title: "Safe Autopilot",
    desc:  "When confidence > 80%, autopilot executes safe cost-reduction actions automatically. Every action is reversible. You stay in control.",
    saving: "Saves while you sleep",
  },
];

/* ── ROI calculator values ────────────────────────────────────────── */
const ROI_TIERS = [
  { spend: "$500/mo",   savings: "$150",  cost: "$29",  net: "$121",  pct: "30%" },
  { spend: "$1,000/mo", savings: "$300",  cost: "$49",  net: "$251",  pct: "30%" },
  { spend: "$5,000/mo", savings: "$1,750",cost: "$199", net: "$1,551",pct: "35%" },
  { spend: "$10,000/mo",savings: "$4,000",cost: "$299", net: "$3,701",pct: "40%" },
];

export default function HomePage() {
  return (
    <div style={{ flex: 1, background: "#0b0b0b" }}>

      {/* ══════════════════════════════════════════════
          HERO — "stop overpaying" framing
      ══════════════════════════════════════════════ */}
      <section style={{ padding: "100px 24px 112px", textAlign: "center", position: "relative", overflow: "hidden" }}>

        {/* Radial glow */}
        <div style={{ position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: 900, height: 600, background: "radial-gradient(ellipse, rgba(34,197,94,0.07) 0%, rgba(99,102,241,0.08) 35%, transparent 70%)", pointerEvents: "none" }} />
        {/* Grid */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "52px 52px", pointerEvents: "none" }} />

        <div className="animate-fade-up" style={{ position: "relative", maxWidth: 700, margin: "0 auto" }}>

          {/* Status badge */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 18px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 100, fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#22c55e" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px rgba(34,197,94,0.8)" }} />
              Live · Saving AI budgets right now
            </span>
          </div>

          {/* H1 */}
          <h1 style={{ fontSize: "clamp(42px, 7vw, 80px)", fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.04em", color: "#e5e5e5", margin: "0 0 24px" }}>
            Stop overpaying{" "}
            <span style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              for AI.
            </span>
          </h1>

          <p style={{ fontSize: 18, lineHeight: 1.85, color: "rgba(255,255,255,0.42)", maxWidth: 540, margin: "0 auto 52px" }}>
            Drop-in LLM proxy that automatically routes, caps, and optimizes your AI spend.
            See exactly how much you save — updated every hour.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 72 }}>
            <Link href="/dashboard?demo=true" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 32px",
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              borderRadius: 100, color: "#fff", fontSize: 15, fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 2px 20px rgba(34,197,94,0.35)",
            }}>
              See Your Savings — Free
            </Link>
            <Link href="/pricing" style={{
              display: "inline-flex", alignItems: "center",
              padding: "14px 28px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100,
              color: "rgba(255,255,255,0.65)", fontSize: 15, fontWeight: 600,
              textDecoration: "none",
            }}>
              View Pricing →
            </Link>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap" }}>
            {STATS.map(({ value, label, color }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: "-0.03em" }}>{value}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", marginTop: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          ONE-LINE INTEGRATION (instant dev appeal)
      ══════════════════════════════════════════════ */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(10,10,14,0.7)", backdropFilter: "blur(8px)", padding: "40px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 16 }}>One line to start saving</p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 24px", fontFamily: "monospace", fontSize: 13, color: "#e5e5e5", maxWidth: "100%", overflowX: "auto" }}>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>// Before</span>
          <span style={{ color: "#ef4444" }}>baseURL: "https://api.openai.com/v1"</span>
          <span style={{ color: "rgba(255,255,255,0.2)", padding: "0 8px" }}>→</span>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>// After</span>
          <span style={{ color: "#22c55e" }}>baseURL: "https://yourapp.com/api/proxy/llm"</span>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 12 }}>That's it. Every LLM call is now automatically optimized.</p>
      </section>

      {/* ══════════════════════════════════════════════
          4 CORE CAPABILITIES
      ══════════════════════════════════════════════ */}
      <section style={{ maxWidth: 1060, margin: "0 auto", padding: "88px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 12 }}>How It Works</p>
          <h2 style={{ fontSize: "clamp(24px,4vw,40px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#e5e5e5", margin: "0 0 12px" }}>
            Control. Route. Save. Automatically.
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.32)", maxWidth: 480, margin: "0 auto" }}>
            Every LLM call runs through the proxy. Routing, guardrails, and autopilot work silently in the background.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {CAPABILITIES.map(({ icon, color, bg, title, desc, saving }) => (
            <div key={title} className="card-hover" style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "1.75rem", position: "relative", overflow: "hidden" }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, background: bg, borderRadius: 12, fontSize: 18, marginBottom: 16 }}>{icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#e5e5e5", margin: "0 0 10px" }}>{title}</h3>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", margin: "0 0 16px", lineHeight: 1.75 }}>{desc}</p>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color, background: bg, padding: "3px 10px", borderRadius: 100 }}>{saving}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          ROI EXPLAINER
      ══════════════════════════════════════════════ */}
      <section style={{ background: "rgba(10,10,14,0.6)", backdropFilter: "blur(8px)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "88px 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 12 }}>ROI Calculator</p>
            <h2 style={{ fontSize: "clamp(22px,4vw,36px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#e5e5e5", margin: "0 0 12px" }}>
              What does this save you?
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.32)", margin: 0 }}>Based on real usage patterns across our customers.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {ROI_TIERS.map(({ spend, savings, cost, net, pct }) => (
              <div key={spend} style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "1.4rem", textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>AI spend: <span style={{ color: "#e5e5e5" }}>{spend}</span></div>
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 0 14px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>
                  <span>Savings ({pct})</span><span style={{ color: "#22c55e", fontWeight: 700 }}>+{savings}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
                  <span>WHY Engine</span><span style={{ color: "#ef4444" }}>−{cost}</span>
                </div>
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 0 10px" }} />
                <div style={{ fontSize: 18, fontWeight: 800, color: "#22c55e", letterSpacing: "-0.02em" }}>+{net}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 3, letterSpacing: "0.1em" }}>NET GAIN / MONTH</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════ */}
      <section style={{ maxWidth: 680, margin: "0 auto", padding: "88px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(24px,4vw,40px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#e5e5e5", margin: "0 0 16px" }}>
          Start saving in{" "}
          <span style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            5 minutes.
          </span>
        </h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", margin: "0 auto 40px", maxWidth: 440, lineHeight: 1.8 }}>
          No infrastructure changes. No lock-in. Just replace your OpenAI base URL and watch your costs drop.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/dashboard?demo=true" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px", background: "linear-gradient(135deg,#22c55e,#16a34a)", borderRadius: 100, color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none", boxShadow: "0 2px 20px rgba(34,197,94,0.35)" }}>
            See Demo — Free
          </Link>
          <Link href="/pricing" style={{ display: "inline-flex", alignItems: "center", padding: "14px 26px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 100, color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
            View Plans →
          </Link>
        </div>
      </section>

    </div>
  );
}
