"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COPY_MAP } from "@/lib/brand-constants";

const NAV = [
  { href: "/connect",                 label: "⚡ Connect AI",              highlight: true },
  { href: "/dashboard",               label: COPY_MAP.nav_dashboard },
  { href: "/analyze",                 label: COPY_MAP.nav_analyze },
  { href: "/dashboard/autopilot",     label: COPY_MAP.nav_autopilot },
  { href: "/pricing",                 label: "Pricing" },
  { href: "/docs",                    label: "Docs" },
  { href: "/dashboard/system-health", label: "System Health" },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", flex: 1, minHeight: "calc(100vh - 58px)" }}>

      {/* ── Glassmorphism sidebar ── */}
      <aside style={{
        width:               220,
        flexShrink:          0,
        borderRight:         "1px solid rgba(255,255,255,0.06)",
        background:          "rgba(10,10,18,0.7)",
        backdropFilter:      "blur(20px)",
        WebkitBackdropFilter:"blur(20px)",
        padding:             "20px 12px",
        display:             "flex",
        flexDirection:       "column",
        gap:                 2,
        position:            "sticky",
        top:                 58,
        height:              "calc(100vh - 58px)",
        overflowY:           "auto",
      }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", padding: "0 12px", marginBottom: 8 }}>
          Navigation
        </p>

        {NAV.map(({ href, label, highlight }) => {
          const active = pathname === href || (href !== "/dashboard" && href !== "/" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} style={{
              display:        "flex",
              alignItems:     "center",
              gap:            8,
              padding:        "8px 12px",
              borderRadius:   12,
              fontSize:       12,
              fontWeight:     active ? 600 : 450,
              color:          active ? "#f8fafc" : highlight ? "#818cf8" : "rgba(255,255,255,0.4)",
              background:     active
                ? "rgba(99,102,241,0.14)"
                : "transparent",
              border:         active
                ? "1px solid rgba(99,102,241,0.22)"
                : "1px solid transparent",
              boxShadow:      active ? "0 0 12px rgba(99,102,241,0.08)" : "none",
              textDecoration: "none",
              transition:     "all 0.18s ease",
              letterSpacing:  "0.01em",
            }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = highlight ? "#818cf8" : "rgba(255,255,255,0.4)"; }}}
            >
              {label}
            </Link>
          );
        })}

        {/* Bottom badge */}
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)", marginLeft: -12, marginRight: -12, paddingLeft: 12, paddingRight: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.12)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s ease infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(34,197,94,0.8)", letterSpacing: "0.08em" }}>Engine Active</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: "auto", background: "var(--bg-base)" }}>
        {children}
      </main>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>
    </div>
  );
}
