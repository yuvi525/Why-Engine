# Codebase Audit Manifest

## 1. Build Errors
- **`app/api/proxy/llm/route.js`**: `Module not found: Can't resolve '@/lib/prompt-compressor'`
- **`app/api/cron/alerts/route.js`**: Missing exports from `@/lib/alert-engine` (`shouldAlert`, `sendSlackAlert`, `sendEmailAlert`, `logAlert`)

## 2. Type Errors
- Project does not have full TypeScript coverage yet; TypeScript `npx tsc --noEmit` is currently disabled/unconfigured. Type enforcement will be added in subsequent prompts.

## 3. Broken Imports
- `app/api/proxy/llm/route.js` importing `@/lib/prompt-compressor`
- `app/api/cron/alerts/route.js` importing missing functions from `@/lib/alert-engine`

## 4. Boundary Violations
- No strict `"use client"` violations detected importing server components directly in the current build state. However, data fetching architecture needs refactoring to formalize the client-server boundary.

## 5. Mock Data Locations
- `lib/demo-simulator.js`
- `lib/user-utils.js`
- `lib/demo-data.js`
- `app/antigravity/page.js`
- `src/transforms/openai.transform.ts`
- `src/transforms/anthropic.transform.ts`

## 6. Missing / Direct Env Vars
Over 44 files contain direct `process.env.*` reads instead of a centralized, validated config. Key files include:
- `src/queues/dlq-worker.ts`
- `src/state/redis-client.ts`
- `src/observability/logger.ts`
- `src/hooks/useUsage.ts`
- `src/cache/semantic-cache.ts`
- `src/cost-dna/cron.ts`
- `src/config/config.ts`
- `src/compression/compressor.ts`
- `src/billing/webhook.ts`
- `src/billing/stripe-client.ts`
- `src/billing/cron.ts`
- `src/autopilot/queue.ts`
- `src/users/service.ts`
- `src/why/producer.ts`
- `sdk/index.js`
- `src/anomaly/detector.ts`
- `scripts/test-proxy.js`
- `lib/autopilot-engine.js`
- `lib/demo-simulator.js`
- `lib/supabase-browser.js`
- `lib/why-engine.js`
- `lib/stripe.js`
- `lib/semantic-cache.js`
- `lib/redis.js`
- `lib/proxy-why-bridge.js`
- `lib/ingestion-engine.js`
- `lib/db.js`
- `lib/auth.js`
- `lib/api-key-manager.js`
- `lib/api-auth.js`
- `lib/alert-engine.js`
- `app/api/validate/route.js`
- `app/api/stripe/webhook/route.js`
- `app/api/stripe/portal/route.js`
- `app/api/proxy/llm/route.js`
- `app/api/latest-analysis/route.js`
- `app/api/cron/monitor/route.js`
- `app/api/cron/alerts/route.js`
- `app/api/autopilot/rules/[id]/route.js`
- `app/api/autopilot/rules/route.js`
- `app/api/autopilot/manage/route.js`
- `app/api/auth/setup/route.js`
- `app/api/auth/me/route.js`

## 7. Disconnected APIs
- The Next.js API routes largely rely on `demo-data.js` or bypass the database. Specifically, `app/api/proxy/llm/route.js` lacks full DB persistence and real `usage_records` insertion.

---
**Status**: Ready for Prompt 2/18 (Environment + Config Layer Hardening).
