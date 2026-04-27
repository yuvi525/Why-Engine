import { NormalizedRequest, NormalizedResponse, TokenCount } from '../types/normalized';

export type ProviderHealthState = 'healthy' | 'degraded' | 'offline';

export interface IProvider {
  name: string;
  complete(request: NormalizedRequest): Promise<NormalizedResponse>;
  estimateCost(model: string, tokens: TokenCount): number;
  getHealth(): Promise<ProviderHealthState>;
  setHealth(state: ProviderHealthState): Promise<void>;
}
