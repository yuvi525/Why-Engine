import { NormalizedRequest } from '../types/normalized';

export interface OrgPolicy {
  org_id: string;
  max_input_tokens?: number;
  max_output_tokens?: number;
  allowed_models?: string[];
  blocked_task_types?: string[];
  pii_detection?: boolean;
}

export interface GuardrailResult {
  allowed: boolean;
  blocked_reasons: string[];
  modified_request?: NormalizedRequest;
  modified_model?: string;
  events_logged: any[];
}
