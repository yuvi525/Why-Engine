import { NextResponse } from 'next/server';
import { simulate } from './preflight';
import { fromOpenAIRequest } from '../transforms/openai.transform';

// POST /v1/simulate
export async function simulateRequest(request: Request) {
  try {
    const body = await request.json();
    
    // Normalize into internal format without executing upstream
    const normalizedReq = fromOpenAIRequest(body, {
      requestId: 'sim_' + Date.now(),
      orgId: 'simulate',
      budget: null
    });

    const result = await simulate(normalizedReq);
    
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
