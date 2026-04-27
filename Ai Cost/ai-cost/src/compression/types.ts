import { NormalizedRequest } from '../types/normalized';

export interface CompressionResult {
  compressed_request: NormalizedRequest;
  original_tokens: number;
  compressed_tokens: number;
  compression_ratio: number;
}
