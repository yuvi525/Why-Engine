// lib/alert-engine.js

export async function sendAlert(event) {
  try {
    const alertData = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    };
    console.log("ALERT:", alertData);
    const webhookUrl = process.env.ALERT_WEBHOOK;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertData)
      });
    }
  } catch (err) {
    // Fail safe
  }
}

export function shouldAlert(result) {
  return result.priority === "HIGH" || result.priority === "CRITICAL";
}

export async function sendSlackAlert(result, webhookUrl) {
  return { ok: true };
}

export async function sendEmailAlert(result, email) {
  return { ok: true };
}

export async function logAlert(sb, data) {
  return { ok: true };
}
