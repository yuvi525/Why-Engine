import { OrgPolicy } from '../types';

export function checkModelAllowlist(routedModel: string, policy: OrgPolicy): string | null {
  if (!policy.allowed_models || policy.allowed_models.length === 0) return null; // Unrestricted
  
  if (!policy.allowed_models.includes(routedModel)) {
    // Modify routing implicitly to the first allowed compliant model
    return policy.allowed_models[0];
  }
  return null;
}
