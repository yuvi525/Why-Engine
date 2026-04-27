import { NormalizedRequest } from '../../types/normalized';

export function truncateStrategy(request: NormalizedRequest): NormalizedRequest {
  const msgs = request.messages;
  
  // Only truncate if we have a meaningfully long history
  if (msgs.length > 6) {
    // Preserve strict instruction context: first 2 + last 4 messages
    const firstTwo = msgs.slice(0, 2);
    const lastFour = msgs.slice(-4);
    
    // Inject a marker to ensure the LLM knows context was dropped
    const middleMarker = {
      role: 'system',
      content: '[...conversation history truncated by autopilot...]'
    };
    
    return {
      ...request,
      messages: [...firstTwo, middleMarker, ...lastFour]
    };
  }

  return request;
}
