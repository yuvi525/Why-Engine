import { NormalizedRequest, NormalizedResponse } from '../types/normalized';

export function fromAnthropicRequest(rawRequest: any, metadata: any): NormalizedRequest {
  // Anthropic separates system prompt into a top-level field
  const messages = rawRequest.messages ? [...rawRequest.messages] : [];
  if (rawRequest.system) {
    messages.unshift({ role: 'system', content: rawRequest.system });
  }

  return {
    model: rawRequest.model || 'claude-3-5-sonnet-20241022',
    messages: messages,
    max_tokens: rawRequest.max_tokens,
    temperature: rawRequest.temperature,
    metadata: {
      ...metadata
    }
  };
}

export function toAnthropicResponse(normalized: NormalizedResponse): any {
  return {
    id: `msg_${normalized.metadata?.requestId || Math.random().toString(36).substring(2)}`,
    type: 'message',
    role: 'assistant',
    model: normalized.model_used,
    content: [
      {
        type: 'text',
        text: normalized.content
      }
    ],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: normalized.input_tokens,
      output_tokens: normalized.output_tokens
    },
    // Optional extensions for proxy tracking
    proxy_metadata: {
      cost_usd: normalized.cost_usd,
      latency_ms: normalized.latency_ms,
      cache_hit: normalized.cache_hit,
      savings_usd: normalized.savings_usd
    }
  };
}
