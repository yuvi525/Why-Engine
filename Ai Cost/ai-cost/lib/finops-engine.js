// lib/finops-engine.js
import { calculateCost } from "@/lib/model-pricing";
import redis from "./redis";

const fallbackUserBudgets = new Map();

export function estimateRequestCost(model, prompt) {
  try {
    if (!prompt) return 0;
    const estimatedTokens = Math.ceil(prompt.length / 4);
    const cost = calculateCost(model, estimatedTokens, Math.floor(estimatedTokens / 2));
    return cost;
  } catch (err) {
    return 0; 
  }
}

export async function checkUserBudget(userId, estimatedCost) {
  try {
    const uid = userId || 'anonymous';
    
    if (redis) {
      const key = `budget:${uid}`;
      const profile = await redis.get(key) || { daily_budget: 5.00, used_today: 0 };
      
      if (profile.used_today + estimatedCost > profile.daily_budget) {
        return { allowed: false, reason: `FinOps Block: Request exceeds daily user budget of $${profile.daily_budget.toFixed(2)}. Used: $${profile.used_today.toFixed(2)}` };
      }
      return { allowed: true, reason: "" };
    }

    // Fallback
    if (!fallbackUserBudgets.has(uid)) {
      fallbackUserBudgets.set(uid, { daily_budget: 5.00, used_today: 0, last_reset: new Date().toDateString() });
    }
    const profile = fallbackUserBudgets.get(uid);
    const today = new Date().toDateString();
    if (profile.last_reset !== today) {
      profile.used_today = 0;
      profile.last_reset = today;
    }
    if (profile.used_today + estimatedCost > profile.daily_budget) {
      return { allowed: false, reason: `FinOps Block: Request exceeds daily user budget of $${profile.daily_budget.toFixed(2)}. Used: $${profile.used_today.toFixed(2)}` };
    }
    return { allowed: true, reason: "" };
  } catch (err) {
    console.error("[finops-engine] error checking budget:", err.message);
    return { allowed: true, reason: "" }; 
  }
}

export async function updateUsage(userId, actualCost) {
  try {
    const uid = userId || 'anonymous';
    
    if (redis) {
      const key = `budget:${uid}`;
      let profile = await redis.get(key);
      if (!profile) {
        profile = { daily_budget: 5.00, used_today: 0 };
      }
      profile.used_today += actualCost;
      await redis.set(key, profile, { ex: 86400 });
      return;
    }

    if (!fallbackUserBudgets.has(uid)) return;
    const profile = fallbackUserBudgets.get(uid);
    profile.used_today += actualCost;
  } catch (err) {
    console.error("[finops-engine] error updating usage:", err.message);
  }
}
