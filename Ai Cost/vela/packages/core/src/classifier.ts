import { ProxyRequest } from '@vela/types';

export function classify(request: ProxyRequest): { complexity: 1|2|3|4|5, sensitivityFlags: string[] } {
  let content = '';
  if (request.messages && Array.isArray(request.messages)) {
    content = request.messages.map(m => m.content || '').join('\n');
  }

  const length = content.length;
  const isMultiTurn = request.messages && request.messages.length > 3;
  const hasCodeBlocks = /```[\s\S]*?```/g.test(content) && (content.match(/```/g) || []).length >= 4;
  const hasSimpleCode = /```/.test(content) && !hasCodeBlocks;
  const hasMathSymbols = /(?:\\\[|\\\(|\$\$?|∫|∑|√|∂)/.test(content);
  
  const hasStructuredAnalysis = /\b(analyze|compare|architect|design|plan)\b/i.test(content);
  const hasExpertKeywords = /\b(legal contract|financial model|security audit)\b/i.test(content);
  const hasMediumKeywords = /\b(function|class|select|insert|update|delete|where|from)\b/i.test(content);
  
  const isExpertModelRequested = request.model && ((request.model.toLowerCase().includes('gpt-4') && !request.model.toLowerCase().includes('mini')) || request.model.toLowerCase().includes('opus'));

  let complexity: 1|2|3|4|5 = 1;

  if (length > 5000 || isExpertModelRequested || hasExpertKeywords) {
    complexity = 5;
  } else if (length >= 2000 || hasCodeBlocks || hasStructuredAnalysis) {
    complexity = 4;
  } else if (length >= 800 || isMultiTurn || hasMediumKeywords) {
    complexity = 3;
  } else if (length >= 300 || hasSimpleCode) {
    complexity = 2;
  } else {
    if (length < 300 && !hasSimpleCode && !hasMathSymbols && (!request.messages || request.messages.length <= 2)) {
      complexity = 1;
    } else {
      complexity = 2;
    }
  }

  const sensitivityFlags: string[] = [];

  const hasPII = /\b(\d{3}-\d{2}-\d{4}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\+?\d{10,14}|personal data|user data)\b/i.test(content);
  const hasFinancial = /\b(invoice|payment|stripe|transaction|revenue)\b/i.test(content);
  const hasLegal = /\b(contract|liability|compliance|gdpr|terms)\b/i.test(content);

  if (hasPII) sensitivityFlags.push('pii');
  if (hasFinancial) sensitivityFlags.push('financial');
  if (hasLegal) sensitivityFlags.push('legal');

  if (sensitivityFlags.length === 0) {
    sensitivityFlags.push('none');
  }

  return { complexity, sensitivityFlags };
}
