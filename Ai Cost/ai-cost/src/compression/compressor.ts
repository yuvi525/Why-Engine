import { NormalizedRequest } from '../types/normalized';
import { CompressionResult } from './types';
import { dedupStrategy } from './strategies/dedup';
import { truncateStrategy } from './strategies/truncate';
import { llmCompressStrategy } from './strategies/llm-compress';

// Rough tokenizer approximation
function estimateTokens(request: NormalizedRequest): number {
  const text = request.messages.map(m => m.content || '').join(' ');
  return Math.ceil(text.length / 4);
}

export async function compress(request: NormalizedRequest): Promise<CompressionResult> {
  const originalTokens = estimateTokens(request);
  
  // 1. Core Bypass Logic
  const bypass = request.metadata?.bypassCompression === true;
  const cacheHit = request.metadata?.cache_hit === true;
  const threshold = parseInt(process.env.COMPRESSION_THRESHOLD || '1500', 10);

  if (bypass || cacheHit || originalTokens <= threshold) {
    return {
      compressed_request: request,
      original_tokens: originalTokens,
      compressed_tokens: originalTokens,
      compression_ratio: 0
    };
  }

  let currentRequest = request;
  let currentTokens = originalTokens;

  // 2. Cascade Strategy 1: Boilerplate Dedup
  currentRequest = dedupStrategy(currentRequest);
  currentTokens = estimateTokens(currentRequest);

  // 3. Cascade Strategy 2: History Truncation
  if (currentTokens > threshold) {
    currentRequest = truncateStrategy(currentRequest);
    currentTokens = estimateTokens(currentRequest);
  }

  // 4. Cascade Strategy 3: LLM Extractive Summarization (Haiku)
  if (currentTokens > threshold) {
    currentRequest = await llmCompressStrategy(currentRequest);
    currentTokens = estimateTokens(currentRequest);
  }

  // Calculate final absolute ratio
  let ratio = 0;
  if (originalTokens > 0) {
    ratio = (originalTokens - currentTokens) / originalTokens;
  }

  // Safety Guardrail: Do not alter semantic meaning by > 40%
  if (ratio > 0.40) {
    console.warn(`[Compressor] Aborting: Compression ratio ${ratio} exceeded 40% safe threshold`);
    return {
      compressed_request: request,
      original_tokens: originalTokens,
      compressed_tokens: originalTokens,
      compression_ratio: 0
    };
  }

  // Update metadata telemetry for Savings Engine
  if (ratio > 0) {
    currentRequest.metadata.compressed = true;
    currentRequest.metadata.compression_ratio = ratio;
  }

  return {
    compressed_request: currentRequest,
    original_tokens: originalTokens,
    compressed_tokens: currentTokens,
    compression_ratio: ratio
  };
}
