import { NormalizedRequest, NormalizedResponse } from '../types/normalized';

export function fromOpenAIRequest(rawRequest: any, metadata: any): NormalizedRequest {
  return {
    model: rawRequest.model || 'gpt-4o',
    messages: rawRequest.messages || [],
    max_tokens: rawRequest.max_tokens,
    temperature: rawRequest.temperature,
    metadata: {
      ...metadata
    }
  };
}

export function toOpenAIResponse(normalized: NormalizedResponse): any {
  return {
    id: `chatcmpl-${normalized.metadata?.requestId || Math.random().toString(36).substring(2)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: normalized.model_used,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: normalized.content
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: normalized.input_tokens,
      completion_tokens: normalized.output_tokens,
      total_tokens: normalized.input_tokens + normalized.output_tokens
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
