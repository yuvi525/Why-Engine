"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { COLORS, SHADOWS } from "@/lib/design-system";
import { supabase } from "@/lib/supabase-browser";

const NAV_LINKS = [
  { href: "/",                    label: "Home"       },
  { href: "/dashboard",           label: "Dashboard"  },
  { href: "/pricing",             label: "Pricing"    },
  { href: "/dashboard/autopilot", label: "Autopilot"  },
  { href: "/docs",                label: "Docs"       },
];

export function Navbar() {
  const pathname = usePathname();
  const [liveCost, setLiveCost] = useState(null);

  useEffect(() => {
    let interval;
    supabase.auth.getSession().then(({ data }) => {
      if (!data?.session) return;
      const poll = async () => {
        const r = await fetch('/api/latest-analysis').catch(() => null);
        if (!r?.ok) return;
        const d = await r.json();
        // CORRECT field: d.analysis.totalCost
        if (d?.found && d?.analysis?.totalCost) {
          setLiveCost(d.analysis.totalCost);
        }
      };
      poll();
      interval = setInterval(poll, 15000);
    });
    return () => clearInterval(interval);
  }, []);

  return (
    <header style={{
      position:          "sticky",
      top:               0,
      zIndex:            50,
      background:        "rgba(3,3,8,0.85)",
      backdropFilter:    "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderBottom:      "1px solid rgba(255,255,255,0.06)",
      boxShadow:         "0 1px 0 rgba(255,255,255,0.04)",
    }}>
      <nav style={{
        maxWidth:       1200,
        margin:         "0 auto",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        height:         58,
        padding:        "0 1.5rem",
      }}>

        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
          <div style={{
            width:        30, height: 30,
            background:   "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            borderRadius: 9,
            display:      "flex", alignItems: "center", justifyContent: "center",
            boxShadow:    "0 0 12px rgba(99,102,241,0.4), 0 0 24px rgba(99,102,241,0.15)",
            flexShrink:   0,
          }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L14 5.5V10.5L8 14L2 10.5V5.5L8 2Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="8" cy="8" r="2" fill="white"/>
            </svg>
          </div>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.02em", display: "block", lineHeight: 1.2 }}>
              WHY Engine
            </span>
            <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              AI Cost Autopilot
            </span>
          </div>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center flex-1 justify-center" style={{ gap: 4 }}>
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link key={href} href={href} style={{
                padding:        "5px 12px",
                borderRadius:   100,
                fontSize:       12,
                fontWeight:     isActive ? 600 : 450,
                textDecoration: "none",
                color:          isActive ? "#f8fafc" : "rgba(255,255,255,0.45)",
                background:     isActive ? "rgba(99,102,241,0.12)" : "transparent",
                border:         isActive ? "1px solid rgba(99,102,241,0.25)" : "1px solid transparent",
                transition:     "all 0.18s ease",
                letterSpacing:  "0.01em",
                whiteSpace:     "nowrap",
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = "rgba(255,255,255,0.75)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.background = "transparent"; }}}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Mobile Hamburger */}
        <div className="flex md:hidden flex-1 justify-end items-center">
          <button style={{ background: "transparent", border: "none", color: "var(--text-primary)", padding: "8px", cursor: "pointer" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6H20M4 12H20M4 18H20" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Auth / CTA */}
        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
          {/* Live cost ticker */}
          {liveCost !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--emerald)', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 100, padding: '3px 10px' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--emerald)', animation: 'pulse 1.5s ease infinite', display: 'inline-block' }} />
              ${Number(liveCost).toFixed(3)} tracked
            </div>
          )}
          <Link href="/login" style={{
            padding:        "6px 14px",
            fontSize:       12,
            fontWeight:     500,
            textDecoration: "none",
            color:          "rgba(255,255,255,0.45)",
            borderRadius:   100,
            border:         "1px solid rgba(255,255,255,0.08)",
            transition:     "all 0.18s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.8)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          >
            Sign In
          </Link>
          <Link href="/dashboard?demo=true" className="btn-accent" style={{ padding: "6px 16px", fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, letterSpacing: "0.01em" }}>
            Start Saving
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 6H10M7 3L10 6L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </nav>
    </header>
  );
}
