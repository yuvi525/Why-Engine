import Link from "next/link";
import { FeatureCard } from "@/components/FeatureCard";

export const metadata = {
  title:       "WHY Engine — AI Cost Intelligence",
  description: "Detect AI cost anomalies, understand the root cause, and get ranked actions to cut waste. Real-time intelligence for AI infrastructure.",
};

const FEATURES = [
  {
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L18 6.5V13.5L10 18L2 13.5V6.5L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="10" cy="10" r="3" fill="currentColor"/></svg>,
    title: "Spike Detection",
    body:  "Identifies cost spikes vs historical average using a 2× threshold — not just period-over-period comparison.",
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="10" width="3" height="7" rx="1" fill="currentColor"/><rect x="8.5" y="6" width="3" height="11" rx="1" fill="currentColor"/><rect x="14" y="3" width="3" height="14" rx="1" fill="currentColor"/></svg>,
    title: "Model Ranking",
    body:  "Ranks every model by total cost, share %, token volume, and exact savings opportunity per optimization.",
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10H16M10 4L16 10L10 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    title: "WHY Reasoning",
    body:  "AI-generated causation — not just correlation. Every insight cites exact tokens, costs, and root causes.",
  },
  {
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3V10L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/></svg>,
    title: "Priority Scoring",
    body:  "HIGH / MEDIUM / LOW based on model contribution % — not arbitrary growth thresholds.",
  },
];

const STATS = [
  { value: "2×",     label: "Spike threshold",   accent: "#6366f1" },
  { value: "Real $", label: "Savings math",       accent: "#22c55e" },
  { value: "4 types",label: "Anomaly detectors",  accent: "#f59e0b" },
  { value: "<1s",    label: "Analysis latency",   accent: "#8b5cf6" },
];

const SOCIAL_PROOF = [
  { metric: "$312K+", label: "AI spend tracked" },
  { metric: "94.7%",  label: "Detection accuracy" },
  { metric: "1,284",  label: "Anomalies caught" },
];

export default function HomePage() {
  return (
    <div style={{ flex: 1, background: "#030308" }}>

      {/* ═══ HERO ═══ */}
      <section style={{ padding: "90px 24px 100px", textAlign: "center", position: "relative", overflow: "hidden" }}>

        {/* Radial glow */}
        <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 700, height: 450, background: "radial-gradient(ellipse, rgba(99,102,241,0.14) 0%, rgba(139,92,246,0.06) 40%, transparent 70%)", pointerEvents: "none" }} />
        {/* Grid lines (subtle) */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none" }} />

        <div className="animate-fade-up" style={{ position: "relative" }}>

          {/* Badge */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 16px", background: "rgba(10,10,18,0.8)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 100, fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.6)" }} />
              AI Cost Intelligence Engine
            </span>
          </div>

          {/* H1 */}
          <h1 style={{ fontSize: "clamp(38px,6.5vw,72px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.035em", color: "#f8fafc", margin: "0 0 24px" }}>
            Know{" "}
            <span style={{ background: "linear-gradient(135deg, #6366f1 0%, #a78bfa 60%, #c4b5fd 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              exactly
            </span>{" "}
            why your<br />AI costs spiked
          </h1>

          <p style={{ fontSize: 17, lineHeight: 1.8, color: "rgba(255,255,255,0.45)", maxWidth: 500, margin: "0 auto 44px" }}>
            Detect anomalies, find the root cause, and get ranked actions to cut AI spend — in seconds.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 56 }}>
            <Link href="/connect" className="btn-accent" style={{ padding: "13px 28px", fontSize: 14, textDecoration: "none", letterSpacing: "0.01em" }}>
              Connect Your AI Infrastructure
            </Link>
            <Link href="/dashboard" className="btn-ghost" style={{ padding: "13px 28px", fontSize: 14, textDecoration: "none" }}>
              View Live Demo →
            </Link>
          </div>

          {/* Social proof metrics */}
          <div style={{ display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap" }}>
            {SOCIAL_PROOF.map(({ metric, label }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.03em" }}>{metric}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 3, letterSpacing: "0.08em" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STATS STRIP ═══ */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(10,10,18,0.6)", backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {STATS.map(({ value, label, accent }, i) => (
            <div key={label} style={{ padding: "28px 16px", textAlign: "center", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: accent, letterSpacing: "-0.02em", marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section style={{ maxWidth: 920, margin: "0 auto", padding: "80px 24px" }}>
        <div className="animate-fade-up" style={{ textAlign: "center", marginBottom: 52 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 12 }}>
            How It Works
          </p>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", color: "#f8fafc", margin: "0 0 12px" }}>
            From raw usage data to clear action
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", margin: 0, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            Four engines running in sequence — every time you submit a trace.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {FEATURES.map(({ icon, title, body }) => (
            <FeatureCard key={title} icon={icon} title={title} body={body} />
          ))}
        </div>
      </section>

      {/* ═══ CTA FOOTER ═══ */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "72px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", bottom: -100, left: "50%", transform: "translateX(-50%)", width: 500, height: 300, background: "radial-gradient(ellipse, rgba(99,102,241,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="animate-fade-up" style={{ position: "relative" }}>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: "#f8fafc", margin: "0 0 12px", letterSpacing: "-0.03em" }}>
            Ready to find the WHY?
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", margin: "0 0 32px" }}>
            Connect your AI infrastructure and get live cost intelligence in minutes.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/connect" className="btn-accent" style={{ padding: "12px 28px", fontSize: 14, textDecoration: "none" }}>
              Connect Your AI Infrastructure
            </Link>
            <Link href="/dashboard" className="btn-ghost" style={{ padding: "12px 28px", fontSize: 14, textDecoration: "none" }}>
              View Live Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
