/**
 * lib/alert-engine.js
 *
 * Alert system for WHY Engine cost decisions.
 *
 * Functions:
 *   shouldAlert(result)              → boolean
 *   sendSlackAlert(result, webhook)  → Promise<{ ok, error? }>
 *   sendEmailAlert(result, email)    → Promise<{ ok, error? }>
 *
 * Database requirement (run once in Supabase SQL editor):
 * ─────────────────────────────────────────────────────────
 * CREATE TABLE IF NOT EXISTS alert_log (
 *   id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   session_id   text NOT NULL,
 *   channel      text NOT NULL,          -- 'slack' | 'email'
 *   destination  text,                   -- webhook URL or email address
 *   priority     text,
 *   anomaly_type text,
 *   sent_at      timestamptz DEFAULT now(),
 *   success      boolean DEFAULT true,
 *   error_msg    text
 * );
 * CREATE INDEX ON alert_log (session_id);
 * ─────────────────────────────────────────────────────────
 */

// ── Thresholds ────────────────────────────────────────────────────────────
const ALERT_PRIORITIES = new Set(["HIGH"]);          // which priorities trigger alerts
const MIN_TOTAL_COST   = 1.0;                        // USD — ignore trivially small costs

// ─────────────────────────────────────────────────────────────────────────
// shouldAlert
// ─────────────────────────────────────────────────────────────────────────
/**
 * Determines whether an analysis result warrants an alert.
 *
 * Rules:
 *  • priority must be in ALERT_PRIORITIES (HIGH)
 *  • totalCost must exceed MIN_TOTAL_COST to avoid noise on test data
 *
 * @param {object} result - Row from analysis_results or formatted decision
 * @returns {boolean}
 */
export function shouldAlert(result) {
  const priority  = String(result?.priority  || "").toUpperCase();
  const totalCost = Number(result?.total_cost ?? result?.totalCost ?? 0);
  return ALERT_PRIORITIES.has(priority) && totalCost >= MIN_TOTAL_COST;
}

// ─────────────────────────────────────────────────────────────────────────
// formatSlackPayload
// ─────────────────────────────────────────────────────────────────────────
function formatSlackPayload(result) {
  const priority    = String(result?.priority    || "HIGH").toUpperCase();
  const anomaly     = String(result?.anomaly_type ?? result?.anomalyType ?? "unknown").replace(/_/g, " ");
  const totalCost   = Number(result?.total_cost  ?? result?.totalCost  ?? 0).toFixed(2);
  const savings     = Number(result?.estimated_savings ?? result?.estimatedSavings ?? 0).toFixed(2);
  const why         = String(result?.why     || "See dashboard for details").slice(0, 280);
  const decision    = String(result?.decision || "").slice(0, 280);
  const sessionId   = String(result?.session_id || "");

  const emojiMap = { HIGH: "🔴", MEDIUM: "🟡", LOW: "🟢" };
  const emoji    = emojiMap[priority] || "⚠️";

  return {
    text: `${emoji} *WHY Engine Alert* — ${priority} priority cost anomaly detected`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${emoji} AI Cost Alert — ${priority}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Anomaly Type*\n${anomaly}` },
          { type: "mrkdwn", text: `*Total Cost*\n$${totalCost}` },
          { type: "mrkdwn", text: `*Est. Savings*\n$${savings}` },
          { type: "mrkdwn", text: `*Session*\n${sessionId.slice(0, 8)}…` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*WHY*\n${why}` },
      },
      decision
        ? { type: "section", text: { type: "mrkdwn", text: `*Decision*\n${decision}` } }
        : null,
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Dashboard" },
            url:  `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard`,
            style: "primary",
          },
        ],
      },
    ].filter(Boolean),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// sendSlackAlert
// ─────────────────────────────────────────────────────────────────────────
/**
 * Sends a formatted Slack block message to a webhook URL.
 *
 * @param {object} result     - analysis result row
 * @param {string} webhookUrl - Slack incoming webhook URL
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function sendSlackAlert(result, webhookUrl) {
  if (!webhookUrl) return { ok: false, error: "No Slack webhook URL provided." };

  try {
    const payload = formatSlackPayload(result);
    const res = await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Slack responded ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "Slack fetch failed" };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// sendEmailAlert (placeholder — wire to Resend / SendGrid when ready)
// ─────────────────────────────────────────────────────────────────────────
/**
 * Placeholder email alert. Logs to console until an email provider is configured.
 * To activate: install `resend` and replace the body below.
 *
 * @param {object} result - analysis result row
 * @param {string} email  - recipient address
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function sendEmailAlert(result, email) {
  if (!email) return { ok: false, error: "No email address provided." };

  // TODO: replace with Resend / SendGrid / Nodemailer
  // Example Resend implementation:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({ from: "alerts@yourdomain.com", to: email, subject: "...", html: "..." });

  console.log(`[alert-engine] email placeholder — would send to ${email}`, {
    priority:   result?.priority,
    totalCost:  result?.total_cost,
    anomalyType: result?.anomaly_type,
  });

  return { ok: true, placeholder: true };
}

// ─────────────────────────────────────────────────────────────────────────
// logAlert — writes to alert_log table
// ─────────────────────────────────────────────────────────────────────────
export async function logAlert(sb, { sessionId, channel, destination, result, success, errorMsg }) {
  if (!sb) return;
  sb.from("alert_log").insert([{
    session_id:  sessionId,
    channel,
    destination: destination || null,
    priority:    result?.priority    || null,
    anomaly_type: result?.anomaly_type ?? result?.anomalyType || null,
    success,
    error_msg:   errorMsg || null,
  }]).then(({ error }) => {
    if (error) console.error("[alert-engine] alert_log insert failed:", error.message);
  });
}
