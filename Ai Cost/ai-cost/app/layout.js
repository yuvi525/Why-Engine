import { Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { DemoBanner } from "@/components/DemoBanner";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets:  ["latin"],
});

export const metadata = {
  title:       "WHY Engine — AI Cost Intelligence",
  description: "Detect AI cost anomalies, identify root causes, and get clear actions to reduce spend.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={geistMono.variable}>
      <body style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
        <DemoBanner />
        <Navbar />
        <div className="flex min-h-screen flex-col">{children}</div>
        <GlobalActiveBadge />
      </body>
    </html>
  );
}

/**
 * GlobalActiveBadge
 * Fixed bottom-left pill — "AI Cost Intelligence Engine Active"
 * Only rendered client-side via a small inline script trick.
 * Reads localStorage 'whye_analysis_count' to decide visibility.
 */
function GlobalActiveBadge() {
  return (
    <>
      <div id="whye-global-badge" style={{ display: "none", position: "fixed", bottom: 20, left: 20, zIndex: 8888, alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.75)", background: "rgba(0,0,0,0.7)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 100, padding: "6px 14px", backdropFilter: "blur(8px)", pointerEvents: "none" }}>
        <span id="whye-badge-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
        AI Cost Intelligence Engine Active
      </div>
      <script dangerouslySetInnerHTML={{ __html: `
        (function(){
          try {
            var count = parseInt(localStorage.getItem('whye_analysis_count') || '0', 10);
            if (count >= 1) {
              var el = document.getElementById('whye-global-badge');
              if (el) { el.style.display = 'flex'; }
            }
          } catch(e) {}
        })();
      `}} />
    </>
  );
}
