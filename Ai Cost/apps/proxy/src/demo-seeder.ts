import { nanoid } from 'nanoid';
import { logDecision } from '@vela/db';
import { decide, classify, estimateCost, generateWHY } from '@vela/core';
import { ProxyRequest, RoutingContext } from '@vela/types';

const SAMPLE_PROMPTS: { request: ProxyRequest; requestedModel: string }[] = [
  {
    requestedModel: 'gpt-4',
    request: {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hi' }],
    },
  },
  {
    requestedModel: 'gpt-4',
    request: {
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'Write a Python function to sort a list of dictionaries by a key.' },
      ],
    },
  },
  {
    requestedModel: 'gpt-4',
    request: {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a code reviewer.' },
        { role: 'user', content: 'Review this function: def add(a, b): return a + b' },
        { role: 'assistant', content: 'Looks fine, but lacks type hints.' },
        { role: 'user', content: 'Can you add type hints and a docstring?' },
      ],
    },
  },
  {
    requestedModel: 'claude-opus',
    request: {
      model: 'claude-opus',
      messages: [
        {
          role: 'user',
          content:
            'Analyze and compare the architectural trade-offs between microservices and monolithic applications for a high-traffic SaaS product. Include scalability, deployment complexity, team structure, and cost implications.',
        },
      ],
    },
  },
  {
    requestedModel: 'gpt-4',
    request: {
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content:
            'My user data shows purchase history and email: john@example.com. Analyze trends.',
        },
      ],
    },
  },
  {
    requestedModel: 'gpt-4',
    request: {
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content:
            'Process this invoice payment for transaction #INV-2024-0011 via Stripe. Revenue impact: $5,000.',
        },
      ],
    },
  },
  {
    requestedModel: 'gpt-4-turbo',
    request: {
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'user',
          content:
            'Design a distributed rate-limiting system for an API gateway handling 100k req/s across 10 regions. Cover Redis Cluster, token bucket algorithm, consistency guarantees, and failure modes. Provide architecture diagram in ASCII and pseudo-code for the core algorithm.',
        },
      ],
    },
  },
  {
    requestedModel: 'gpt-4',
    request: {
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Review this GDPR compliance policy and identify liability gaps.',
        },
      ],
    },
  },
  {
    requestedModel: 'gpt-4',
    request: {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Summarize: the sky is blue.' }],
    },
  },
  {
    requestedModel: 'gpt-4',
    request: {
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content:
            'Write unit tests for this class:\n```python\nclass Calculator:\n    def add(self, a, b): return a + b\n    def divide(self, a, b): return a / b\n```',
        },
      ],
    },
  },
];

async function seed() {
  console.log('🌱 Seeding 50 demo decision logs...');
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < 50; i++) {
    const sample = SAMPLE_PROMPTS[i % SAMPLE_PROMPTS.length];
    const { complexity, sensitivityFlags } = classify(sample.request);

    const budgetRemaining = 5.0 - (i * 0.08);
    const dailyBudget = 5.0;

    const ctx: RoutingContext = {
      requestId: nanoid(),
      complexity,
      estimatedInputTokens: 150 + Math.floor(Math.random() * 300),
      estimatedOutputTokens: 80 + Math.floor(Math.random() * 150),
      budgetRemainingUSD: Math.max(budgetRemaining, 0.1),
      dailyBudgetUSD: dailyBudget,
      providerHealth: { bedrock: true, vertex: true, openai: true },
      sensitivityFlags: sensitivityFlags as Array<'pii' | 'financial' | 'legal' | 'none'>,
    };

    const decision = decide(ctx);

    const actualInput = ctx.estimatedInputTokens;
    const actualOutput = ctx.estimatedOutputTokens;
    const actualCost = estimateCost(decision.model, actualInput, actualOutput);
    const baselineCost = estimateCost('gpt-4o', actualInput, actualOutput);
    const savings = baselineCost - actualCost;

    const tsOffset = Math.floor(Math.random() * oneDayMs);
    const timestamp = new Date(now - tsOffset);

    logDecision({
      id: nanoid(),
      requestId: ctx.requestId,
      userId: `demo-user-${(i % 5) + 1}`,
      timestamp,
      originalModel: sample.requestedModel,
      routedModel: decision.model,
      provider: decision.provider,
      reasonCode: decision.reasonCode,
      inputTokens: actualInput,
      outputTokens: actualOutput,
      actualCostUSD: actualCost,
      baselineCostUSD: baselineCost,
      savingsUSD: savings,
      latencyMs: 200 + Math.floor(Math.random() * 1300),
      why: JSON.stringify(decision.why),
    });

    process.stdout.write(`\r  Seeded ${i + 1}/50`);
  }

  console.log('\n✅ Done! 50 decision logs seeded.');
}

seed().catch(console.error);
