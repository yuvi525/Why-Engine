"use client";

/**
 * components/FeatureCard.js
 *
 * Client component — isolated so app/page.js stays a Server Component.
 * Premium hover: lift + indigo glow border + icon scale.
 */
export function FeatureCard({ icon, title, body }) {
  return (
    <div
      style={{
        background:     "#0a0a12",
        border:         "1px solid rgba(255,255,255,0.07)",
        borderRadius:   18,
        padding:        "1.5rem",
        transition:     "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        cursor:         "default",
        backgroundImage:"linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0) 60%)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform   = "translateY(-4px)";
        e.currentTarget.style.boxShadow   = "0 4px 8px rgba(0,0,0,0.55), 0 20px 56px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.18)";
        e.currentTarget.style.borderColor = "rgba(99,102,241,0.25)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform   = "translateY(0)";
        e.currentTarget.style.boxShadow   = "none";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
      }}
    >
      {/* Icon */}
      <div style={{
        width:       42, height: 42, borderRadius: 12,
        background:  "linear-gradient(135deg, rgba(99,102,241,0.16), rgba(139,92,246,0.1))",
        border:      "1px solid rgba(99,102,241,0.22)",
        display:     "flex", alignItems: "center", justifyContent: "center",
        color:       "#a78bfa", marginBottom: 16,
        transition:  "transform 0.2s ease",
      }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", margin: "0 0 8px", letterSpacing: "-0.01em" }}>{title}</h3>
      <p  style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.38)", margin: 0 }}>{body}</p>
    </div>
  );
}
