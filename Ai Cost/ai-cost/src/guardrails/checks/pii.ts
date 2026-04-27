import { NormalizedRequest } from '../../types/normalized';
import { OrgPolicy } from '../types';

export function redactPII(request: NormalizedRequest, policy: OrgPolicy): { request: NormalizedRequest, redactedCount: number } {
  if (!policy.pii_detection) return { request, redactedCount: 0 };

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  const cardRegex = /\b(?:\d[ -]*?){13,16}\b/g;

  let redactedCount = 0;
  const newMessages = request.messages.map(msg => {
    if (!msg.content) return msg;
    
    let content = msg.content;
    const originalLen = content.length;
    
    content = content.replace(emailRegex, '[REDACTED_EMAIL]');
    content = content.replace(ssnRegex, '[REDACTED_SSN]');
    content = content.replace(cardRegex, '[REDACTED_CARD]');

    if (content.length !== originalLen) redactedCount++;

    return { ...msg, content };
  });

  return { 
    request: { ...request, messages: newMessages },
    redactedCount
  };
}
