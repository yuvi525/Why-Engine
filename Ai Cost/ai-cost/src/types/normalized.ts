export interface NormalizedRequest {
  model: string;
  messages: any[];
  max_tokens?: number;
  temperature?: number;
  metadata: {
    orgId?: string;
    apiKey?: string;
    requestId?: string;
    budget?: number;
    [key: string]: any;
  };
}

export interface NormalizedResponse {
  content: string;
  model_used: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  cache_hit: boolean;
  savings_usd: number;
  metadata?: {
    requestId?: string;
    [key: string]: any;
  };
  raw_response?: any;
}

export interface TokenCount {
  input_tokens: number;
  output_tokens: number;
}
