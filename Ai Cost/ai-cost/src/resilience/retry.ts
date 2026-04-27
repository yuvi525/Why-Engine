import { NormalizedRequest, NormalizedResponse } from '../types/normalized';
import { providerRegistry } from '../providers/registry';
import { recordProviderFailure, recordProviderSuccess } from './circuit-breaker';
import { logger } from '../observability/logger';

export async function executeWithRetry(
  request: NormalizedRequest, 
  initialModel: string, 
  timeoutMs: number = 10000
): Promise<{ response: NormalizedResponse, finalModel: string }> {
  
  let currentModel = initialModel;
  let attempts = 0;
  
  while (attempts < 2) {
    attempts++;
    const providerInst = providerRegistry.getProvider(currentModel);
    
    try {
      // Hard Timeout Wrapper
      const response = await Promise.race([
        providerInst.complete(request),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Provider timeout')), timeoutMs))
      ]);
      
      await recordProviderSuccess(providerInst.name);
      return { response, finalModel: currentModel };

    } catch (err: any) {
      logger.warn({ step: 'provider_retry', attempts, currentModel, error: err.message }, 'Provider call failed');
      await recordProviderFailure(providerInst.name);
      
      if (attempts >= 2) {
        // Fallback mechanism: Downgrade to safest/cheapest model known to be highly available
        currentModel = 'gpt-4o-mini'; 
        logger.info({ step: 'provider_fallback', newModel: currentModel }, 'Falling back to safe model');
        request.model = currentModel;
        
        // Execute final fallback (No internal retries to prevent stack exhaustion)
        const fallbackInst = providerRegistry.getProvider(currentModel);
        const fbResponse = await fallbackInst.complete(request);
        return { response: fbResponse, finalModel: currentModel };
      }
    }
  }

  throw new Error('All provider resilience attempts exhausted');
}
