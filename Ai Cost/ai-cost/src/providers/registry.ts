import { IProvider } from './provider.interface';

export class ProviderRegistry {
  private providers: Map<string, IProvider> = new Map();
  private modelMap: Map<string, string> = new Map();

  register(provider: IProvider, supportedModels: string[]) {
    this.providers.set(provider.name, provider);
    for (const model of supportedModels) {
      this.modelMap.set(model, provider.name);
    }
  }

  getProvider(modelId: string): IProvider {
    const providerName = this.modelMap.get(modelId);
    
    // Default fallback logic if model not explicitly registered
    if (!providerName) {
      if (modelId.startsWith('claude')) {
        return this.providers.get('anthropic')!;
      } else if (modelId.startsWith('amazon') || modelId.startsWith('anthropic.claude') || modelId.startsWith('meta')) {
        return this.providers.get('bedrock')!;
      } else {
        // Default to OpenAI
        return this.providers.get('openai')!;
      }
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found for model ${modelId}`);
    }
    return provider;
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistry();
