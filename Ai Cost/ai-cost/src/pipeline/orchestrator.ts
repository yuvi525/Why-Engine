import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getOrgByApiKey, getOrgUsage, incrementUsage } from '../orgs/org-store';
import { check as checkAnomalies } from '../anomaly/detector';
import { get as cacheGet, set as cacheSet } from '../cache/semantic-cache';
import { compress } from '../compression/compressor';
import { enforcePreRouting, enforcePostRouting } from '../guardrails/engine';
import { route } from '../routing/router';
import { providerRegistry } from '../providers/registry';
import { calculateSavings } from '../savings/calculator';
import { enqueueWhy } from '../why/producer';
import { fromOpenAIRequest, toOpenAIResponse } from '../transforms/openai.transform';
import { handlePipelineError } from './error-handler';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';

export async function executePipeline(rawRequest: Request): Promise<Response> {
  const startTime = Date.now();
  let requestId = crypto.randomUUID();
  
  try {
    // 1. AuthMiddleware.validate() → load org + policy
    const authHeader = rawRequest.headers.get('authorization') || '';
    const rawKey = authHeader.replace('Bearer ', '');
    const org = await getOrgByApiKey(rawKey);
    
    if (!org) {
      return NextResponse.json({ error: 'Unauthorized. Invalid API Key.' }, { status: 401 });
    }
    
    const orgUsage = await getOrgUsage(org.id);

    let policy = { org_id: org.id };
    const sb = getSupabase();
    if (sb) {
      const { data } = await sb.from('org_policies').select('*').eq('org_id', org.id).single();
      if (data) policy = data;
    }

    // 2. transform(rawRequest) → NormalizedRequest
    const body = await rawRequest.json();
    let request = fromOpenAIRequest(body, {
      requestId,
      orgId: org.id,
      budget: orgUsage.daily_budget_usd
    });

    // 3. AnomalyDetector.check() → if BLOCKING return 429
    const anomalies = await checkAnomalies(request, orgUsage);
    const blockingAnomaly = anomalies.find(a => a.isBlocking);
    if (blockingAnomaly) {
      return NextResponse.json({ error: blockingAnomaly.message, blocked: true }, { status: 429 });
    }

    // 4. SemanticCache.get() → if HIT skip LLM completely
    let response = null;
    let routeDecision = null;
    let savingsRecord = null;
    
    const cacheResult = await cacheGet(request);
    
    if (cacheResult && cacheResult.hit && cacheResult.response) {
      response = cacheResult.response;
    } else {
      // 5. Compressor.compress()
      const compResult = await compress(request);
      request = compResult.compressed_request;

      // 6. Guardrails PRE-ROUTING (Token Caps, PII Redaction)
      const inputTokens = compResult.compressed_tokens; 
      const preGuard = await enforcePreRouting(request, policy, inputTokens);
      if (!preGuard.allowed) {
        return NextResponse.json({ error: preGuard.blocked_reasons.join(', ') }, { status: 400 });
      }
      if (preGuard.modified_request) {
        request = preGuard.modified_request;
      }

      // 7. Router.route()
      routeDecision = await route(request);

      // 8. Guardrails POST-ROUTING (Task Type Block, Model Allowlist Override)
      const postGuard = await enforcePostRouting(request, policy, routeDecision);
      if (!postGuard.allowed) {
        return NextResponse.json({ error: postGuard.blocked_reasons.join(', ') }, { status: 403 });
      }
      if (postGuard.modified_model) {
        routeDecision.model = postGuard.modified_model;
        const fallbackProv = providerRegistry.getProvider(routeDecision.model);
        routeDecision.provider = fallbackProv.name;
      }

      // 9. Provider.complete()
      const providerInstance = providerRegistry.getProvider(routeDecision.model);
      try {
        response = await providerInstance.complete(request);
      } catch (err) {
        console.error(`[Provider] Primary model ${routeDecision.model} failed. Executing fallback retry...`);
        // Retry logic: Safe fallback to fastest, cheapest tier on failure
        const fallbackModel = 'gpt-4o-mini';
        const fallbackProvider = providerRegistry.getProvider(fallbackModel);
        request.model = fallbackModel;
        response = await fallbackProvider.complete(request);
        routeDecision.model = fallbackModel;
        routeDecision.provider = fallbackProvider.name;
        routeDecision.reason += ' (Fallback triggered due to provider execution error)';
      }

      // 10. SemanticCache.set() async
      setImmediate(() => cacheSet(request, response!));
    }

    // 11. SavingsCalculator.calculate()
    savingsRecord = await calculateSavings(response, routeDecision);

    // 12. OrgStore.incrementUsage() async
    setImmediate(() => incrementUsage(org.id, savingsRecord.actual_cost_usd, response!.input_tokens + response!.output_tokens));

    // 13. WhyProducer.enqueueWhy() async
    setImmediate(() => enqueueWhy(requestId, {
      route_decision: routeDecision,
      savings_record: savingsRecord,
      anomalies,
      org_id: org.id
    }));

    // 14. Transform NormalizedResponse → Standard OpenAI Wire Format Output
    const wireResponse = toOpenAIResponse(response);
    
    // Extensible OpenTelemetry & Proxy Observability Headers
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Why-Request-Id': requestId,
      'X-Savings-USD': savingsRecord.savings_usd.toFixed(6),
      'X-Model-Used': response.model_used,
      'X-Cache-Hit': response.cache_hit ? 'true' : 'false',
      'X-Pipeline-Latency-Ms': (Date.now() - startTime).toString(),
      'X-Request-Id': requestId
    });

    setImmediate(async () => {
      const db = getSupabase();
      if (db) {
        await db.from('audit_logs').insert({
          org_id: org?.id,
          event_type: 'proxy_success',
          message: `Proxy request ${requestId} succeeded using ${response.model_used}`,
          metadata: { requestId, latencyMs: Date.now() - startTime, model: response.model_used }
        });
      }
    });

    return new NextResponse(JSON.stringify(wireResponse), { status: 200, headers });

  } catch (err: any) {
    const errorDetails = handlePipelineError(err);
    
    setImmediate(async () => {
      const db = getSupabase();
      if (db) {
        await db.from('audit_logs').insert({
          org_id: null,
          event_type: 'proxy_error',
          message: `Proxy request ${requestId} failed: ${errorDetails.error}`,
          metadata: { requestId, error: errorDetails.error }
        });
      }
    });

    return NextResponse.json({ error: errorDetails.error || 'Internal proxy error', requestId }, { status: errorDetails.status || 500 });
  }
}
