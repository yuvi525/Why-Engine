import Fastify from 'fastify';
import litellm from 'litellm';
import { nanoid } from 'nanoid';
import { decide, classify, estimateCost, generateWHY } from '@vela/core';
import { db, logDecision, getBudgetState, updateBudgetSpent, updateProviderHealth, getRecentDecisions, getTotalSavings } from '@vela/db';
import { ProxyRequest, RoutingContext } from '@vela/types';
import { config } from './config';

const server = Fastify({ logger: true });

server.post('/v1/chat/completions', async (request, reply) => {
  const reqId = nanoid();
  const body = request.body as ProxyRequest;
  
  // a. Extract vela extensions
  const velaBudget = body.vela_budget_override;
  const velaForceModel = body.vela_force_model;
  const velaSensitivity = body.vela_sensitivity || [];
  
  // b. Read budget state
  const budgetState = getBudgetState();
  const dailyBudget = velaBudget || budgetState.dailyBudgetUsd;
  const budgetRemaining = dailyBudget - budgetState.spentTodayUsd;
  
  // c. Run classifier
  const { complexity, sensitivityFlags } = classify(body);
  const combinedSensitivity = Array.from(new Set([...sensitivityFlags, ...velaSensitivity])) as Array<'pii'|'financial'|'legal'|'none'>;
  
  // Estimate input tokens
  const inputStr = body.messages ? body.messages.map(m => m.content).join(' ') : '';
  const estimatedInputTokens = Math.ceil(inputStr.length / 4);
  const estimatedOutputTokens = body.max_tokens || 500;

  // d. Build RoutingContext
  const ctx: RoutingContext = {
    requestId: reqId,
    complexity,
    estimatedInputTokens,
    estimatedOutputTokens,
    budgetRemainingUSD: budgetRemaining,
    dailyBudgetUSD: dailyBudget,
    forcedModel: velaForceModel,
    providerHealth: {
      bedrock: true,
      vertex: true,
      openai: true
    },
    sensitivityFlags: combinedSensitivity,
    userId: 'anonymous'
  };

  // e. Run decide
  const decision = decide(ctx);
  
  const modelMapping = {
    'bedrock': 'bedrock/anthropic.claude-3-haiku-20240307-v1:0',
    'vertex': 'vertex_ai/gemini-1.5-flash-002',
    'openai': 'gpt-4o-mini'
  };
  
  let litellmModel = modelMapping[decision.provider as keyof typeof modelMapping] || decision.model;
  if (decision.reasonCode === 'FORCED_MODEL') {
    litellmModel = decision.model;
  }

  // g. Execute LiteLLM
  try {
    const startTime = Date.now();
    const response = await litellm.completion({
      model: litellmModel,
      messages: body.messages,
      max_tokens: body.max_tokens,
      temperature: body.temperature,
      stream: body.stream,
    });

    const latency = Date.now() - startTime;

    if (body.stream) {
      reply.raw.setHeader('X-Vela-Model', decision.model);
      reply.raw.setHeader('X-Vela-Provider', decision.provider);
      reply.raw.setHeader('X-Vela-Reason', decision.reasonCode);
      reply.raw.setHeader('X-Vela-Request-Id', reqId);
      reply.raw.setHeader('X-Vela-Why', decision.why.decision.substring(0, 100));
      reply.type('text/event-stream');
      
      for await (const chunk of (response as any)) {
         reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
      
      const actCost = estimateCost(decision.model, estimatedInputTokens, estimatedOutputTokens);
      const basCost = estimateCost('gpt-4o', estimatedInputTokens, estimatedOutputTokens);
      
      logDecision({
        id: nanoid(),
        requestId: reqId,
        userId: 'anonymous',
        timestamp: new Date(),
        originalModel: body.model || 'gpt-4',
        routedModel: decision.model,
        provider: decision.provider,
        reasonCode: decision.reasonCode,
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
        actualCostUSD: actCost,
        baselineCostUSD: basCost,
        savingsUSD: basCost - actCost,
        latencyMs: latency,
        why: JSON.stringify(decision.why)
      });
      updateBudgetSpent(actCost);
      return;
    } else {
      // h. Count actual tokens from response
      const usage = (response as any).usage || {};
      const actualInput = usage.prompt_tokens || estimatedInputTokens;
      const actualOutput = usage.completion_tokens || estimatedOutputTokens;

      // i. Recompute actual cost
      const actCost = estimateCost(decision.model, actualInput, actualOutput);
      const basCost = estimateCost('gpt-4o', actualInput, actualOutput);
      const saved = basCost - actCost;

      // j. Log to DB
      logDecision({
        id: nanoid(),
        requestId: reqId,
        userId: 'anonymous',
        timestamp: new Date(),
        originalModel: body.model || 'gpt-4',
        routedModel: decision.model,
        provider: decision.provider,
        reasonCode: decision.reasonCode,
        inputTokens: actualInput,
        outputTokens: actualOutput,
        actualCostUSD: actCost,
        baselineCostUSD: basCost,
        savingsUSD: saved,
        latencyMs: latency,
        why: JSON.stringify(decision.why)
      });

      // k. Update budget state
      updateBudgetSpent(actCost);

      // l. Return response with headers
      reply.header('X-Vela-Model', decision.model);
      reply.header('X-Vela-Provider', decision.provider);
      reply.header('X-Vela-Cost', actCost.toFixed(6));
      reply.header('X-Vela-Savings', saved.toFixed(6));
      reply.header('X-Vela-Reason', decision.reasonCode);
      reply.header('X-Vela-Why', decision.why.decision.substring(0, 100));
      reply.header('X-Vela-Request-Id', reqId);

      return response;
    }

  } catch (err: any) {
    server.log.error(err);
    updateProviderHealth(decision.provider, false, err.message);
    reply.status(500).send({ error: err.message });
  }
});

server.get('/health', async () => {
  return { status: 'ok', version: '1.0.0' };
});

server.get('/api/decisions', async (request) => {
  const query = request.query as { limit?: string };
  const limit = parseInt(query.limit || '50', 10);
  return getRecentDecisions(limit);
});

server.get('/api/usage', async () => {
  const savings = getTotalSavings();
  const budget = getBudgetState();
  return { ...savings, budgetState: budget };
});

server.get('/api/why/:requestId', async (request, reply) => {
  const { requestId } = request.params as { requestId: string };
  const decisions = getRecentDecisions(100);
  const decision = decisions.find(d => d.requestId === requestId);
  if (!decision) return reply.status(404).send({ error: 'Not found' });
  return JSON.parse(decision.why);
});

server.addHook('onRequest', (req, reply, done) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Headers', '*');
  reply.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    reply.status(200).send();
    return;
  }
  done();
});

const start = async () => {
  try {
    const port = parseInt(config.PORT || process.env.PORT || '3001', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Vela proxy listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
