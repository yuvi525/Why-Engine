import { NormalizedRequest } from '../../types/normalized';

export function dedupStrategy(request: NormalizedRequest): NormalizedRequest {
  const newMessages = [];
  const seenSystemTexts = new Set<string>();

  for (const msg of request.messages) {
    if (msg.role === 'system') {
      const txt = (msg.content || '').trim();
      if (seenSystemTexts.has(txt)) {
        continue; // Strip duplicate boilerplate
      }
      seenSystemTexts.add(txt);
      newMessages.push(msg);
    } else {
      newMessages.push(msg);
    }
  }

  return { ...request, messages: newMessages };
}
