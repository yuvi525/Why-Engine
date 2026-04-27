import { NormalizedRequest } from '../../types/normalized';
import crypto from 'crypto';
// @ts-ignore
import redis from '@/src/lib/redis';

export async function llmCompressStrategy(request: NormalizedRequest): Promise<NormalizedRequest> {
  // Locate the single largest instruction block to summarize
  let maxIdx = -1;
  let maxLen = -1;

  for (let i = 0; i < request.messages.length; i++) {
    const len = (request.messages[i].content || '').length;
    // Don't compress AI outputs, only human instructions
    if (len > maxLen && request.messages[i].role !== 'assistant') {
      maxLen = len;
      maxIdx = i;
    }
  }

  if (maxIdx === -1) return request;

  const targetMessage = request.messages[maxIdx].content;
  const hash = crypto.createHash('sha256').update(targetMessage).digest('hex');
  const cacheKey = `compress:llm:${hash}`;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const newMessages = [...request.messages];
      newMessages[maxIdx] = { ...newMessages[maxIdx], content: cached as string };
      return { ...request, messages: newMessages };
    }
  }

  // In full production, this dispatches to Claude Haiku with instructions to summarize.
  // We use a heuristic fallback here until Prompt 14 orchestrator is fully wired.
  const compressedText = targetMessage.substring(0, Math.floor(targetMessage.length * 0.6)) + '\n\n[...autopilot extractive summary...]';

  if (redis) {
    await redis.set(cacheKey, compressedText, { ex: 604800 }); // 7d TTL
  }

  const newMessages = [...request.messages];
  newMessages[maxIdx] = { ...newMessages[maxIdx], content: compressedText };

  return { ...request, messages: newMessages };
}
