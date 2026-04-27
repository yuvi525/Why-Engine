import { NormalizedResponse } from '../types/normalized';

export interface CacheResult {
  hit: boolean;
  response?: NormalizedResponse;
  similarity?: number;
}

export interface CacheVectorData {
  orgId: string;
  hash: string;
  vector: number[];
  responseStr: string;
}
