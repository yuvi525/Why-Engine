import { providerRegistry } from '../../providers/registry';

export async function handleProviderDegraded(metadata: any) {
  const { provider } = metadata;
  if (!provider) return;

  try {
    const provInst = providerRegistry.getProvider(provider); // Need a way to get via raw string safely
    if (provInst) {
      await provInst.setHealth('degraded');
      console.log(`[Autopilot] Provider ${provider} marked as degraded.`);
    }
  } catch (err) {
    // If provider string isn't an exact mapped model, try fetching from raw map
    const mapped = providerRegistry['providers'].get(provider);
    if (mapped) {
      await mapped.setHealth('degraded');
      console.log(`[Autopilot] Provider ${provider} marked as degraded.`);
    }
  }
}
