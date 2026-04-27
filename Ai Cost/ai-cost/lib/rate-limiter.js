// lib/rate-limiter.js
import redis from "./redis";

export async function checkRateLimit(userId) {
  try {
    if (!redis) return { allowed: true, remaining: 20 }; // fail-open
    
    const uid = userId || 'anonymous';
    const key = `rate:${uid}`;
    
    // Atomic increment
    const count = await redis.incr(key);
    
    if (count === 1) {
      // First request in the minute window
      await redis.expire(key, 60);
    }
    
    const maxRequests = 20;
    const remaining = Math.max(0, maxRequests - count);

    if (count > maxRequests) {
      console.log("RATE LIMIT HIT");
      return { allowed: false, reason: "Rate limit exceeded", remaining: 0 };
    }
    
    console.log("RATE OK");
    return { allowed: true, remaining };

  } catch (err) {
    console.error("[rate-limiter] error:", err.message);
    return { allowed: true, remaining: 20 }; // fail-open
  }
}
