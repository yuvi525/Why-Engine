import { NormalizedRequest } from '../../types/normalized';
import { OrgPolicy } from '../types';

export function checkTokenCap(request: NormalizedRequest, policy: OrgPolicy, inputTokens: number): string | null {
  if (policy.max_input_tokens && inputTokens > policy.max_input_tokens) {
    return `Input tokens (${inputTokens}) exceed org policy cap (${policy.max_input_tokens})`;
  }
  return null;
}
