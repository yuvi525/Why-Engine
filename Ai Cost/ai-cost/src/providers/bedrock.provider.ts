import { IProvider, ProviderHealthState } from './provider.interface';
import { NormalizedRequest, NormalizedResponse, TokenCount } from '../types/normalized';
// @ts-ignore
import redis from '@/src/lib/redis';

export class BedrockProvider implements IProvider {
  name = 'bedrock';

  async complete(request: NormalizedRequest): Promise<NormalizedResponse> {
    throw new Error('Not implemented yet - waiting for Prompt 2 Transforms');
  }

  estimateCost(model: string, tokens: TokenCount): number {
    return (tokens.input_tokens * 0.003 / 1000) + (tokens.output_tokens * 0.015 / 1000);
  }

  async getHealth(): Promise<ProviderHealthState> {
    if (!redis) return 'healthy';
    try {
      const state = await redis.get(`provider:health:${this.name}`);
      return (state as ProviderHealthState) || 'healthy';
    } catch {
      return 'healthy';
    }
  }

  async setHealth(state: ProviderHealthState): Promise<void> {
    if (!redis) return;
    try {
      await redis.set(`provider:health:${this.name}`, state, { ex: 30 });
    } catch (err) {
      console.error(`[BedrockProvider] Failed to set health:`, err);
    }
  }
}
