// lib/metrics.js
import redis from "./redis";

const fallbackMetrics = {
  total_requests: 0,
  total_savings: 0,
  blocked_requests: 0
};

export async function incrementMetric(metricName, amount = 1) {
  try {
    console.log("METRICS UPDATED");
    if (redis) {
      if (metricName === 'total_savings') {
        await redis.incrbyfloat(`metrics:global:${metricName}`, amount);
      } else {
        await redis.incrby(`metrics:global:${metricName}`, amount);
      }
      return;
    }
    
    if (fallbackMetrics[metricName] !== undefined) {
      fallbackMetrics[metricName] += amount;
    }
  } catch (err) {
    // Fail safe
  }
}
