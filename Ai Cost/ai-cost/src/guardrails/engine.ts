import { NormalizedRequest } from '../types/normalized';
import { OrgPolicy, GuardrailResult } from './types';
import { RouteDecision } from '../routing/types';
import { checkTokenCap } from './checks/token-cap';
import { redactPII } from './checks/pii';
import { checkTaskType } from './checks/task-type';
import { checkModelAllowlist } from './checks/model-allowlist';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';

export async function enforcePreRouting(request: NormalizedRequest, policy: OrgPolicy, inputTokens: number): Promise<GuardrailResult> {
  const result: GuardrailResult = { allowed: true, blocked_reasons: [], events_logged: [] };
  
  // 1. Token Cap (Blocking Logic)
  const tokenErr = checkTokenCap(request, policy, inputTokens);
  if (tokenErr) {
    result.allowed = false;
    result.blocked_reasons.push(tokenErr);
    result.events_logged.push({ type: 'TOKEN_CAP_EXCEEDED', details: tokenErr });
  }

  // 2. PII Redaction (Mutating Logic)
  const { request: piiReq, redactedCount } = redactPII(request, policy);
  if (redactedCount > 0) {
    result.modified_request = piiReq;
    result.events_logged.push({ type: 'PII_REDACTED', details: `Redacted PII in ${redactedCount} messages` });
  }

  await logEvents(request.metadata?.requestId, policy.org_id, result.events_logged);
  return result;
}

export async function enforcePostRouting(request: NormalizedRequest, policy: OrgPolicy, decision: RouteDecision): Promise<GuardrailResult> {
  const result: GuardrailResult = { allowed: true, blocked_reasons: [], events_logged: [] };

  // 1. Task Type (Blocking Logic)
  const taskErr = checkTaskType(decision, policy);
  if (taskErr) {
    result.allowed = false;
    result.blocked_reasons.push(taskErr);
    result.events_logged.push({ type: 'TASK_TYPE_BLOCKED', details: taskErr });
  }

  // 2. Model Allowlist (Mutating Logic)
  const fallbackModel = checkModelAllowlist(decision.model, policy);
  if (fallbackModel) {
    result.modified_model = fallbackModel;
    result.events_logged.push({ type: 'MODEL_FORCED', details: `Original ${decision.model} not allowed. Forced ${fallbackModel}` });
  }

  await logEvents(request.metadata?.requestId, policy.org_id, result.events_logged);
  return result;
}

async function logEvents(requestId: string, orgId: string, events: any[]) {
  if (events.length === 0) return;
  try {
    const sb = getSupabase();
    if (!sb) return;
    
    const inserts = events.map(e => ({
      request_id: requestId || 'unknown',
      org_id: orgId,
      guardrail_type: e.type,
      action_taken: e.type.includes('BLOCKED') || e.type.includes('EXCEEDED') ? 'BLOCK' : 'MODIFY',
      details: { message: e.details },
      created_at: new Date().toISOString()
    }));
    await sb.from('guardrail_events').insert(inserts);
  } catch (err) {
    console.error('[Guardrails] DB log failed', err);
  }
}
