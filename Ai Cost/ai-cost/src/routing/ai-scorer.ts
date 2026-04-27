import { NormalizedRequest } from '../types/normalized';
import { AIScore } from './types';
import crypto from 'crypto';
// @ts-ignore
import redis from '@/src/lib/redis';

export async function scorePrompt(request: NormalizedRequest): Promise<AIScore> {
  try {
    // Extract last 3 messages for context
    const lastMessages = request.messages.slice(-3).map((m: any) => m.content).join('\n');
    const hash = crypto.createHash('sha256').update(lastMessages).digest('hex');
    const cacheKey = `ai-score:${hash}`;

    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) return (typeof cached === 'string' ? JSON.parse(cached) : cached) as AIScore;
    }

    // Heuristic fallback mimicking the LLM classifier for speed
    // In full production, this dispatches a mini sub-call to claude-haiku
    let complexity = 3;
    let task_type = 'general';
    let recommended_model = 'gpt-4o-mini';

    const textLower = lastMessages.toLowerCase();
    if (textLower.includes('classify') || textLower.includes('category')) {
      task_type = 'classification';
      complexity = 2;
    } else if (textLower.includes('code') || textLower.includes('function') || textLower.includes('debug')) {
      task_type = 'coding';
      complexity = 4;
      recommended_model = 'gpt-4o';
    } else if (lastMessages.length > 2000) {
      task_type = 'analysis';
      complexity = 5;
      recommended_model = 'claude-3-5-sonnet-20241022';
    }

    const result: AIScore = { complexity, task_type, recommended_model };

    if (redis) {
      await redis.set(cacheKey, JSON.stringify(result), { ex: 3600 }); // 1h TTL cache
    }

    return result;
  } catch (err) {
    return { complexity: 3, task_type: 'unknown', recommended_model: 'gpt-4o-mini' };
  }
}
