import { IProvider, ProviderHealthState } from './provider.interface';
import { NormalizedRequest, NormalizedResponse, TokenCount } from '../types/normalized';
// @ts-ignore
import redis from '@/src/lib/redis';

export class AnthropicProvider implements IProvider {
  name = 'anthropic';

  async complete(request: NormalizedRequest): Promise<NormalizedResponse> {
    throw new Error('Not implemented yet - waiting for Prompt 2 Transforms');
  }

  estimateCost(model: string, tokens: TokenCount): number {
    if (model.includes('haiku')) {
      return (tokens.input_tokens * 0.00025 / 1000) + (tokens.output_tokens * 0.00125 / 1000);
    }
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
      console.error(`[AnthropicProvider] Failed to set health:`, err);
    }
  }
}
