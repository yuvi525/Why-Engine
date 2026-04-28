import Fastify from 'fastify';
import { nanoid } from 'nanoid';
import OpenAI from 'openai';
import { decide, classify, estimateCost, generateWHY } from '@vela/core';
import { logDecision, getBudgetState, updateBudgetSpent, updateProviderHealth, getRecentDecisions, getTotalSavings } from '@vela/db';
import { ProxyRequest, RoutingContext } from '@vela/types';
import { config } from './config';

const server = Fastify({ logger: true });

// ─── MVP: all execution via OpenAI ────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── /v1/chat/completions ─────────────────────────────────────────────────────
server.post('/v1/chat/completions', async (request, reply) => {
  const reqId = nanoid();
  const body = request.body as ProxyRequest;

  // a. Extract vela extensions
  const velaBudget   = body.vela_budget_override;
  const velaForce    = body.vela_force_model;
  const velaSens     = body.vela_sensitivity || [];

  // b. Budget state
  const budgetState    = getBudgetState();
  const dailyBudget    = velaBudget || budgetState.dailyBudgetUsd;
  const budgetRemaining = dailyBudget - budgetState.spentTodayUsd;

  // c. Classify
  const { complexity, sensitivityFlags } = classify(body);
  const combinedSensitivity = Array.from(
    new Set([...sensitivityFlags, ...velaSens])
  ) as Array<'pii' | 'financial' | 'legal' | 'none'>;

  const inputStr = body.messages?.map(m => m.content).join(' ') || '';
  const estimatedInputTokens  = Math.ceil(inputStr.length / 4);
  const estimatedOutputTokens = body.max_tokens || 500;

  // d. Routing context + decision (full logic, unchanged)
  const ctx: RoutingContext = {
    requestId: reqId,
    complexity,
    estimatedInputTokens,
    estimatedOutputTokens,
    budgetRemainingUSD: budgetRemaining,
    dailyBudgetUSD: dailyBudget,
    forcedModel: velaForce,
    providerHealth: { bedrock: true, vertex: true, openai: true },
    sensitivityFlags: combinedSensitivity,
    userId: 'anonymous',
  };

  const decision = decide(ctx);

  try {
    const startTime = Date.now();

    // e. MVP execution — always OpenAI gpt-4o-mini regardless of routing decision
    let finalResponse: any;
    let actualInput: number;
    let actualOutput: number;
    let latency: number;

    if (config.DEMO_MODE) {
      const { simulateResponse } = await import('./demo');
      const sim = await simulateResponse(decision.model, body.messages);
      latency       = sim.latencyMs;
      actualInput   = sim.inputTokens;
      actualOutput  = sim.outputTokens;
      finalResponse = {
        id: `demo-${reqId}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: decision.actualModel,
        choices: [{ index: 0, message: { role: 'assistant', content: sim.content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: actualInput, completion_tokens: actualOutput, total_tokens: actualInput + actualOutput },
      };
    } else {
      // Real OpenAI call (MVP — ignores simulated provider)
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: body.messages as OpenAI.Chat.ChatCompletionMessageParam[],
        max_tokens: body.max_tokens,
        temperature: body.temperature,
      });
      latency       = Date.now() - startTime;
      actualInput   = completion.usage?.prompt_tokens     || estimatedInputTokens;
      actualOutput  = completion.usage?.completion_tokens || estimatedOutputTokens;
      finalResponse = completion;
    }

    // f. Costs (use actual token counts)
    const actCost  = estimateCost(decision.actualModel, actualInput, actualOutput);
    const basCost  = estimateCost('gpt-4o', actualInput, actualOutput);
    const saved    = basCost - actCost;

    // g. Log to DB
    logDecision({
      id: nanoid(),
      requestId: reqId,
      userId: 'anonymous',
      timestamp: new Date(),
      originalModel: body.model || 'gpt-4',
      routedModel: decision.model,        // simulated
      provider: decision.provider,        // simulated
      reasonCode: decision.reasonCode,
      inputTokens: actualInput,
      outputTokens: actualOutput,
      actualCostUSD: actCost,
      baselineCostUSD: basCost,
      savingsUSD: saved,
      latencyMs: latency,
      why: JSON.stringify(decision.why),
    });
    updateBudgetSpent(actCost);

    // h. Response headers
    reply.header('X-Vela-Simulated-Model',    decision.model);
    reply.header('X-Vela-Simulated-Provider', decision.provider);
    reply.header('X-Vela-Actual-Model',       decision.actualModel);
    reply.header('X-Vela-Actual-Provider',    decision.actualProvider);
    reply.header('X-Vela-Cost',               actCost.toFixed(8));
    reply.header('X-Vela-Savings',            saved.toFixed(8));
    reply.header('X-Vela-Reason',             decision.reasonCode);
    reply.header('X-Vela-Why',               decision.why.why.substring(0, 120));
    reply.header('X-Vela-Request-Id',         reqId);

    // i. Structured response with BOTH simulated + actual model info
    return {
      ...finalResponse,
      vela: {
        requestId:        reqId,
        actualModel:      decision.actualModel,
        actualProvider:   decision.actualProvider,
        simulatedModel:   decision.model,
        simulatedProvider: decision.provider,
        reasonCode:       decision.reasonCode,
        cost:             actCost,
        savings:          saved,
        why:              decision.why,
      },
    };

  } catch (err: any) {
    server.log.error(err);
    updateProviderHealth(decision.provider, false, err.message);
    reply.status(500).send({ error: err.message });
  }
});

// ─── Utility routes ───────────────────────────────────────────────────────────
server.get('/health', async () => ({ status: 'ok', version: '1.0.0', demo: config.DEMO_MODE }));

server.get('/api/decisions', async (request) => {
  const q = request.query as { limit?: string };
  return getRecentDecisions(parseInt(q.limit || '50', 10));
});

server.get('/api/usage', async () => {
  const savings = getTotalSavings();
  const budget  = getBudgetState();
  return { ...savings, budgetState: budget };
});

server.get('/api/why/:requestId', async (request, reply) => {
  const { requestId } = request.params as { requestId: string };
  const decisions = getRecentDecisions(200);
  const d = decisions.find(x => x.requestId === requestId);
  if (!d) return reply.status(404).send({ error: 'Not found' });
  return JSON.parse(d.why);
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
server.addHook('onRequest', (req, reply, done) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Headers', '*');
  reply.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') { reply.status(200).send(); return; }
  done();
});

const start = async () => {
  try {
    const port = parseInt(config.PORT || '3001', 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`\n🚀 Vela proxy ready on http://localhost:${port}`);
    console.log(`   Mode: ${config.DEMO_MODE ? '🎭 DEMO' : '⚡ LIVE (OpenAI)'}\n`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
