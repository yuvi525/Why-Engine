"use client";

import Link from "next/link";

const FREE_LIMIT = 10;

/**
 * UpgradeBanner
 *
 * Shows inside /analyze when the user is approaching or has hit the free limit.
 * Props:
 *   used     {number}  - analyses used this month
 *   limit    {number}  - free plan limit (default FREE_LIMIT)
 *   onDismiss {function} - optional dismiss handler
 *
 * Usage tiers:
 *   8+ / 10  → warning (soft nudge)
 *   10 / 10  → hard block with upgrade CTA
 */
export function UpgradeBanner({ used = 0, limit = FREE_LIMIT, onDismiss }) {
  const remaining = Math.max(0, limit - used);
  const isBlocked = remaining === 0;
  const isWarning = !isBlocked && remaining <= 2;

  if (!isWarning && !isBlocked) return null;

  if (isBlocked) {
    return (
      <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5V9M8 11.5H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-900">
                Monthly limit reached — {used}/{limit} analyses used
              </p>
              <p className="mt-1 text-sm leading-6 text-rose-700">
                Upgrade to Pro for unlimited analyses, full history, and Slack
                alerts. One finding typically saves{" "}
                <strong>$40–200/month</strong> in AI spend.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <Link
              href="/pricing"
              id="upgrade-cta-blocked"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              Upgrade to Pro — ₹999/mo
            </Link>
            <p className="text-[10px] text-rose-500">
              🎉 Launch offer: ₹499 for first 3 months
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Warning state (2 or fewer remaining)
  return (
    <div className="flex items-start justify-between gap-4 rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4">
      <div className="flex gap-3">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M8 2L14.5 13H1.5L8 2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M8 6V9M8 11.5H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-amber-800">
          <strong>{remaining} free {remaining === 1 ? "analysis" : "analyses"} remaining</strong>{" "}
          this month.{" "}
          <Link
            href="/pricing"
            id="upgrade-cta-warning"
            className="font-semibold underline underline-offset-2 hover:text-amber-900"
          >
            Upgrade for unlimited →
          </Link>
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1 text-amber-500 transition hover:bg-amber-100"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
