import { ProxyRequest } from '@vela/types';

function jitter(base: number, pct = 0.2): number {
  const delta = base * pct;
  return Math.round(base - delta + Math.random() * delta * 2);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const LOREM = [
  "Analyzing the provided context through multi-dimensional semantic decomposition.",
  "Cross-referencing knowledge embeddings to surface latent patterns in the input.",
  "Synthesizing a coherent response grounded in contextual relevance and factual consistency.",
  "Evaluating logical dependencies to ensure structural soundness of the output.",
  "Applying chain-of-thought reasoning to trace conclusions from first principles.",
  "Identifying key entities and their relational semantics within the provided data.",
  "Distilling the core intent of the query to minimize unnecessary token generation.",
];

function fakeContent(model: string): string {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const sentence1 = pick(LOREM);
  const sentence2 = pick(LOREM.filter(s => s !== sentence1));
  return `[${model}] ${sentence1} ${sentence2} Analysis complete — result confidence: ${(Math.random() * 15 + 85).toFixed(1)}%.`;
}

interface SimulatedResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

const PROFILES: Record<string, { latencyBase: number; inputBase: number; outputBase: number }> = {
  'gemini-1.5-flash-002':              { latencyBase: 300,  inputBase: 150, outputBase: 80  },
  'gemini-1.5-pro-002':               { latencyBase: 600,  inputBase: 250, outputBase: 140 },
  'anthropic.claude-3-haiku-20240307': { latencyBase: 600,  inputBase: 300, outputBase: 150 },
  'anthropic.claude-3-5-haiku-20241022': { latencyBase: 700, inputBase: 320, outputBase: 160 },
  'gpt-4o-mini':                       { latencyBase: 1150, inputBase: 400, outputBase: 200 },
};

function resolveProfile(model: string) {
  for (const key of Object.keys(PROFILES)) {
    if (model.includes(key) || key.includes(model)) return PROFILES[key];
  }
  return PROFILES['gemini-1.5-flash-002'];
}

export async function simulateResponse(
  model: string,
  messages: ProxyRequest['messages']
): Promise<SimulatedResponse> {
  const profile = resolveProfile(model);
  const latencyMs = jitter(profile.latencyBase);
  await sleep(latencyMs);
  return {
    content: fakeContent(model),
    inputTokens: jitter(profile.inputBase),
    outputTokens: jitter(profile.outputBase),
    latencyMs,
  };
}
