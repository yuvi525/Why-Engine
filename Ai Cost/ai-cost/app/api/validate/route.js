import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/db";

/**
 * GET /api/validate
 *
 * System health check — returns which services are configured.
 * Used by the /docs page health panel and CI validation.
 * Never returns secret values.
 */
export async function GET() {
  const checks = {
    supabase:   isConfigured(),
    openai:     Boolean(process.env.OPENAI_API_KEY),
    stripe:     Boolean(process.env.STRIPE_SECRET_KEY),
    slack:      Boolean(process.env.SLACK_WEBHOOK_URL),
    anon_key:   Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    app_url:    Boolean(process.env.NEXT_PUBLIC_APP_URL),
    cron_secret: Boolean(process.env.CRON_SECRET),
  };

  const allOk = Object.values(checks).every(Boolean);
  const coreOk = checks.supabase && checks.openai;

  return NextResponse.json({
    ok:      allOk,
    core_ok: coreOk,
    mode:    coreOk ? "live" : "demo",
    checks,
    summary: {
      configured: Object.values(checks).filter(Boolean).length,
      total:      Object.keys(checks).length,
    },
  });
}
