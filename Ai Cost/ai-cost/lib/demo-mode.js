/**
 * lib/demo-mode.js
 *
 * isDemoMode() — returns true when:
 *   1. URL contains ?demo=true  (query-param trigger from landing page CTA)
 *   2. OR no Supabase session exists (handled separately in dashboard via auth check)
 *
 * Safe to call on server (returns false) and in client components.
 */
export function isDemoMode() {
  if (typeof window === "undefined") return false;
  return window.location.search.includes("demo=true");
}

/**
 * getDemoParam()
 * Returns the raw value of the 'demo' query param, or null.
 * Useful for Next.js pages that need to pass the param through to child components.
 */
export function getDemoParam() {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get("demo");
  } catch {
    return null;
  }
}
