// lib/loop-detector.js
import crypto from 'crypto';
import redis from './redis';

/**
 * hashPrompt(prompt)
 */
export function hashPrompt(prompt) {
  if (!prompt) return "empty";
  return crypto.createHash("sha256").update(prompt).digest("hex").substring(0, 16);
}

/**
 * trackRequest(userId, prompt)
 */
export async function trackRequest(userId, prompt) {
  try {
    if (!redis) return;
    const uid = userId || 'anonymous';
    const hash = hashPrompt(prompt);
    
    const key = `loop:${uid}`;
    const now = Date.now();
    await redis.zadd(key, { score: now, member: `${now}:${hash}` });
    await redis.expire(key, 30);
  } catch (err) {
    console.error("[loop-detector] error tracking request:", err.message);
  }
}

/**
 * detectLoop(userId, prompt)
 */
export async function detectLoop(userId, prompt) {
  try {
    if (!redis) return false;
    const uid = userId || 'anonymous';
    const hash = hashPrompt(prompt);
    const key = `loop:${uid}`;
    
    const now = Date.now();
    const tenSecondsAgo = now - 10000;
    
    await redis.zremrangebyscore(key, 0, tenSecondsAgo);
    const members = await redis.zrange(key, 0, -1);
    
    let count = 0;
    for (const member of members) {
      if (typeof member === 'string' && member.endsWith(`:${hash}`)) {
        count++;
      }
    }
    
    if (count >= 3) {
      console.log("REDIS HIT - LOOP DETECTED");
      return true;
    }
    
    console.log("REDIS MISS - NO LOOP");
    return false;
  } catch (err) {
    console.error("[loop-detector] error detecting loop:", err.message);
    return false;
  }
}
