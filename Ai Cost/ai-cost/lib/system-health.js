// lib/system-health.js
import redis from "./redis";

export async function getSystemHealth() {
  try {
    let redisStatus = "active";
    if (!redis) {
      redisStatus = "inactive";
    } else {
      // Light ping to check actual connection
      await redis.get("ping_test");
    }

    return {
      status: "healthy",
      cache: "active",
      rateLimit: redisStatus === "active" ? "active" : "fallback",
      finops: "active",
      redis: redisStatus,
      lastChecked: new Date().toISOString()
    };
  } catch (err) {
    return {
      status: "degraded",
      cache: "active",
      rateLimit: "fallback",
      finops: "fallback",
      redis: "error",
      lastChecked: new Date().toISOString()
    };
  }
}
