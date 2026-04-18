"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";
import { COPY_MAP } from "@/lib/brand-constants";

/**
 * DemoBanner
 *
 * Sticky top banner shown only when user is not logged in.
 * Shimmer animated background, pulse icon.
 * Adds padding-top: 40px to layout via a portal-style div.
 */
export function DemoBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setVisible(!data?.session);
    });
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* Spacer so page content isn't hidden behind the banner */}
      <div style={{ height: 40 }} />

      <div style={{
        position:   "fixed",
        top:        0,
        left:       0,
        right:      0,
        height:     40,
        zIndex:     9999,
        display:    "flex",
        alignItems: "center",
        justifyContent: "center",
        gap:        10,
        background: "linear-gradient(90deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)",
        backgroundSize: "200% 100%",
        animation:  "demoBannerShimmer 3s linear infinite",
        borderBottom: "1px solid rgba(99,102,241,0.3)",
      }}>
        {/* Pulse icon */}
        <span style={{ fontSize: 14, animation: "pulse 1.5s ease infinite" }}>⚡</span>

        <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: "0.02em" }}>
          Demo Mode — Simulated AI Cost Intelligence&nbsp;&nbsp;|&nbsp;&nbsp;
        </span>

        <a href="/connect" style={{
          fontSize:       12,
          fontWeight:     700,
          color:          "#a5b4fc",
          textDecoration: "underline",
          textUnderlineOffset: 2,
          cursor:         "pointer",
        }}>
          {COPY_MAP.cta_connect} →
        </a>

        <style>{`
          @keyframes demoBannerShimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.4; }
          }
        `}</style>
      </div>
    </>
  );
}
