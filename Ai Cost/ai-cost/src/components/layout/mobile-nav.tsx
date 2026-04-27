"use client";

/**
 * src/components/layout/mobile-nav.tsx
 *
 * Bottom navigation bar for mobile.
 * Active indicator uses CSS only (no Framer Motion layoutId) to prevent
 * React 19 + Framer Motion v12 infinite effect recursion.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Activity, BarChart3, Settings, Dna } from "lucide-react";
import { cn } from "../ui/glass-card";

export function MobileNav() {
  const pathname = usePathname();

  const links = [
    { name: "Dashboard", href: "/dashboard",  icon: LayoutDashboard },
    { name: "Analyze",   href: "/analyze",    icon: Activity },
    { name: "Cost DNA",  href: "/cost-dna",   icon: Dna },
    { name: "Usage",     href: "/usage",      icon: BarChart3 },
    { name: "Settings",  href: "/settings",   icon: Settings },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0B0F14]/95 backdrop-blur-md border-t border-[rgba(255,255,255,0.06)] z-50 px-2">
      <nav className="flex items-center justify-between h-full max-w-md mx-auto">
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.name}
              href={link.href}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isActive ? "text-[#818CF8]" : "text-[#6B7280] hover:text-[#D1D5DB]"
              )}
            >
              {/* CSS-only active top bar — no layoutId */}
              {isActive && (
                <span
                  className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-[#6366F1] rounded-b-full"
                />
              )}
              <link.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{link.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
