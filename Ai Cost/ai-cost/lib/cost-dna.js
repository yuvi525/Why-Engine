// lib/cost-dna.js
import redis from "./redis";

const fallbackProfiles = new Map();

export async function updateCostProfile(userId, tokens, cost) {
  try {
    const uid = userId || 'anonymous';
    
    if (redis) {
      const key = `dna:${uid}`;
      let profile = await redis.get(key);
      if (!profile) {
        profile = { avg_cost: cost, avg_tokens: tokens, request_count: 1, last_updated: Date.now() };
        await redis.set(key, profile, { ex: 2592000 });
        return;
      }
      
      const newCount = profile.request_count + 1;
      profile.avg_cost = ((profile.avg_cost * profile.request_count) + cost) / newCount;
      profile.avg_tokens = ((profile.avg_tokens * profile.request_count) + tokens) / newCount;
      profile.request_count = newCount;
      profile.last_updated = Date.now();
      
      await redis.set(key, profile, { ex: 2592000 });
      return;
    }

    if (!fallbackProfiles.has(uid)) {
      fallbackProfiles.set(uid, { avg_cost: cost, avg_tokens: tokens, request_count: 1, last_updated: Date.now() });
      return;
    }
    const profile = fallbackProfiles.get(uid);
    const newCount = profile.request_count + 1;
    profile.avg_cost = ((profile.avg_cost * profile.request_count) + cost) / newCount;
    profile.avg_tokens = ((profile.avg_tokens * profile.request_count) + tokens) / newCount;
    profile.request_count = newCount;
    profile.last_updated = Date.now();

  } catch (err) {
    console.error("[cost-dna] Error updating profile:", err.message);
  }
}

export async function detectAnomaly(userId, tokens, cost) {
  try {
    const uid = userId || 'anonymous';
    
    let profile = null;
    if (redis) {
      const key = `dna:${uid}`;
      profile = await redis.get(key);
    } else {
      profile = fallbackProfiles.get(uid);
    }

    if (!profile || profile.request_count < 3) {
      return { isAnomaly: false, reason: "" };
    }

    if (cost > (profile.avg_cost * 2)) {
      return { isAnomaly: true, reason: `Cost spike detected: $${cost} is >2x average of $${profile.avg_cost.toFixed(4)}` };
    }

    if (tokens > (profile.avg_tokens * 2)) {
      return { isAnomaly: true, reason: `Token spike detected: ${tokens} is >2x average of ${Math.round(profile.avg_tokens)}` };
    }

    return { isAnomaly: false, reason: "" };
  } catch (err) {
    console.error("[cost-dna] Error detecting anomaly:", err.message);
    return { isAnomaly: false, reason: "" }; 
  }
}
