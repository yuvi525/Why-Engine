import { describe, it, expect } from 'vitest';
import { decide } from '@vela/core';
import { RoutingContext } from '@vela/types';

const baseCtx: RoutingContext = {
  requestId: 'test-id',
  complexity: 1,
  estimatedInputTokens: 100,
  estimatedOutputTokens: 50,
  budgetRemainingUSD: 4.0,
  dailyBudgetUSD: 5.0,
  providerHealth: { bedrock: true, vertex: true, openai: true },
  sensitivityFlags: ['none'],
};

describe('Decision Engine', () => {
  it('complexity 1 routes to vertex / gemini-flash', () => {
    const ctx: RoutingContext = { ...baseCtx, complexity: 1 };
    const decision = decide(ctx);
    expect(decision.provider).toBe('vertex');
    expect(decision.model).toContain('gemini-1.5-flash');
    expect(decision.reasonCode).toBe('COMPLEXITY_LOW');
  });

  it('complexity 2 routes to bedrock / claude-haiku', () => {
    const ctx: RoutingContext = { ...baseCtx, complexity: 2 };
    const decision = decide(ctx);
    expect(decision.provider).toBe('bedrock');
    expect(decision.model).toContain('haiku');
  });

  it('complexity 4 routes to vertex / gemini-pro', () => {
    const ctx: RoutingContext = { ...baseCtx, complexity: 4 };
    const decision = decide(ctx);
    expect(decision.provider).toBe('vertex');
    expect(decision.model).toContain('gemini-1.5-pro');
  });

  it('complexity 5 routes to openai / gpt-4o-mini', () => {
    const ctx: RoutingContext = { ...baseCtx, complexity: 5 };
    const decision = decide(ctx);
    expect(decision.provider).toBe('openai');
    expect(decision.model).toBe('gpt-4o-mini');
  });

  it('budget guard triggers at <10% budget remaining', () => {
    const ctx: RoutingContext = {
      ...baseCtx,
      complexity: 5,
      budgetRemainingUSD: 0.4,   // 8% of $5 — under 10%
      dailyBudgetUSD: 5.0,
    };
    const decision = decide(ctx);
    expect(decision.reasonCode).toBe('BUDGET_GUARD');
    expect(decision.provider).toBe('vertex');
    expect(decision.model).toContain('flash');
  });

  it('PII flag overrides vertex provider to bedrock', () => {
    const ctx: RoutingContext = {
      ...baseCtx,
      complexity: 1,   // would normally go to vertex/flash
      sensitivityFlags: ['pii'],
    };
    const decision = decide(ctx);
    expect(decision.reasonCode).toBe('SENSITIVITY_PII');
    expect(decision.provider).toBe('bedrock');
  });

  it('provider down triggers fallback to next provider', () => {
    const ctx: RoutingContext = {
      ...baseCtx,
      complexity: 1,  // vertex/flash normally
      providerHealth: { bedrock: true, vertex: false, openai: true },
    };
    const decision = decide(ctx);
    expect(decision.reasonCode).toBe('PROVIDER_DOWN');
    expect(decision.provider).not.toBe('vertex');
  });

  it('forced model overrides all routing rules', () => {
    const ctx: RoutingContext = {
      ...baseCtx,
      complexity: 1,
      budgetRemainingUSD: 0.1,   // would trigger budget guard
      sensitivityFlags: ['pii'], // would trigger PII override
      forcedModel: 'gpt-4o-mini',
    };
    const decision = decide(ctx);
    expect(decision.reasonCode).toBe('FORCED_MODEL');
    expect(decision.model).toBe('gpt-4o-mini');
  });

  it('WHY explanation is always populated', () => {
    const decision = decide(baseCtx);
    expect(decision.why.why).toBeTruthy();
    expect(decision.why.impact).toBeTruthy();
    expect(decision.why.action).toBeTruthy();
    expect(decision.why.decision).toBeTruthy();
  });

  it('estimatedSavingsUSD is non-negative for cheap models', () => {
    const ctx: RoutingContext = { ...baseCtx, complexity: 1 };
    const decision = decide(ctx);
    expect(decision.estimatedSavingsUSD).toBeGreaterThanOrEqual(0);
  });

  it('fallbackChain never includes the chosen model', () => {
    const ctx: RoutingContext = { ...baseCtx, complexity: 1 };
    const decision = decide(ctx);
    expect(decision.fallbackChain).not.toContain(decision.model);
  });
});
