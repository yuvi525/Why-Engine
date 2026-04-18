import { NextResponse } from "next/server";

/**
 * middleware.js
 *
 * Route guards for WHY Engine.
 * Runs at the Edge before pages/API routes are loaded.
 *
 * Rules:
 *   PUBLIC  — no auth required:
 *     /, /login, /signup, /pricing, /docs, /connect, /api/*
 *
 *   PROTECTED — requires auth (Supabase session cookie):
 *     /dashboard, /dashboard/* (except system-health which also needs role)
 *
 *   ADMIN-ONLY — requires auth + owner|admin role:
 *     /dashboard/system-health
 *     (role check performed client-side on the page itself;
 *      middleware just ensures user is authenticated)
 */

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/pricing",
  "/docs",
  "/connect",
  "/api",
];

function isPublic(pathname) {
  return PUBLIC_PATHS.some(p =>
    p === "/" ? pathname === "/" : pathname.startsWith(p)
  );
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Always allow public routes and static assets
  if (
    isPublic(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for Supabase session cookie
  // Supabase stores session as sb-<ref>-auth-token in cookies.
  const hasCookie = [...request.cookies.keys()].some(
    k => k.startsWith("sb-") && k.endsWith("-auth-token")
  );

  if (!hasCookie) {
    // Redirect unauthenticated users to login, preserving intended path
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // /dashboard/system-health — admin only.
  // Full role check is done client-side (edge middleware can't query Supabase).
  // Cookie presence is sufficient here — role gate enforced in the page.

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
