import { OrgPolicy } from '../types';
import { RouteDecision } from '../../routing/types';

export function checkTaskType(decision: RouteDecision | undefined, policy: OrgPolicy): string | null {
  if (!decision || !decision.task_type || !policy.blocked_task_types) return null;

  if (policy.blocked_task_types.includes(decision.task_type)) {
    return `Task type '${decision.task_type}' is blocked by corporate org policy`;
  }
  return null;
}
