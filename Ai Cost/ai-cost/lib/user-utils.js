// lib/user-utils.js
import crypto from "crypto";

export function generateUserId(req) {
  try {
    const xUserId = req.headers.get("x-user-id");
    if (xUserId) return xUserId;

    // Use IP and User-Agent if available
    const ip = req.headers.get("x-forwarded-for") || req.ip || "unknown-ip";
    const userAgent = req.headers.get("user-agent") || "unknown-agent";

    const hash = crypto.createHash("sha256").update(`${ip}-${userAgent}`).digest("hex").substring(0, 12);
    return `guest_${hash}`;
  } catch (err) {
    return `guest_${Math.random().toString(36).substring(2, 10)}`;
  }
}
