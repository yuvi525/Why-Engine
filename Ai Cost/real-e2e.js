const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

const PROXY_URL = 'http://localhost:3000/api/v1/chat/completions';
const API_KEY = 'vk_live_afd88338cce342bf927addeba20cd3da';
const USER_ID = '1f6fe52a-33c6-438b-9856-39bfbc95c72b';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
for (const line of envLocal.split('\n')) {
  if (line && line.includes('=') && !line.startsWith('#')) {
    const [k, v] = line.split('=');
    envVars[k.trim()] = v.trim();
  }
}

const REDIS_URL = envVars.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = envVars.UPSTASH_REDIS_REST_TOKEN;

const REQUESTS = [
  "What is AI?",
  "Say hello in 5 words",
  "Explain REST API simply",
  "Write a Node.js Express server with authentication",
  "Design a scalable microservices architecture with Kafka",
  "Explain recursion with code examples",
  "Build a full system design for Netflix",
  "Summarize this: AI is transforming industries rapidly...",
  "Write SQL query for joining 3 tables",
  "Create a production-ready CI/CD pipeline with AWS"
];

async function updateRedisBudget(spentMicro) {
  if (REDIS_URL && REDIS_TOKEN) {
    await fetch(`${REDIS_URL}/hset/budget:${USER_ID}:today/spentMicro/${spentMicro}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
  }
}

async function runRealTests() {
  console.log("==========================================");
  console.log("VELA REAL TRAFFIC VALIDATION");
  console.log("==========================================\n");

  // Reset budget for clean test
  await prisma.budgetState.update({
    where: { userId: USER_ID },
    data: { spentTodayMicro: 0, dailyLimitMicro: 5000000, autoDowngradeAt: 0.8 }
  });
  await updateRedisBudget(0);
  
  // Clear old logs so we only verify these 10 (Optional, but helps with clean output)
  await prisma.decisionLog.deleteMany({ where: { userId: USER_ID } });

  const results = [];
  let currentBudgetSpent = 0;

  for (let i = 0; i < REQUESTS.length; i++) {
    const prompt = REQUESTS[i];
    console.log(`Sending Request ${i + 1}/${REQUESTS.length}...`);

    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
    });

    if (!res.ok) {
      console.error(`Request failed with status ${res.status}`);
      const text = await res.text();
      console.error(text);
      continue;
    }

    const data = await res.json();
    const vela = data.vela;
    
    const budgetAfter = await prisma.budgetState.findUnique({ where: { userId: USER_ID } });
    
    results.push({
      prompt: prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt,
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
      modelDecision: vela.model,
      actualModel: vela.actualModel || 'gpt-4o-mini',
      actualCost: vela.actualCostMicro,
      baselineCost: vela.baselineCostMicro,
      savings: vela.savingsMicro,
      reason: vela.reasonCode,
      budgetBefore: currentBudgetSpent,
      budgetAfter: budgetAfter.spentTodayMicro,
      why: vela.why.why,
      impact: vela.why.impact,
      action: vela.why.action
    });

    currentBudgetSpent = budgetAfter.spentTodayMicro;
    
    // Slight delay to avoid aggressive rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  // STEP 4 - AUTOPILOT TEST
  console.log("\n--- AUTOPILOT VALIDATION ---");
  console.log("Setting daily limit to $0.01 (10,000 microdollars) and spending 9,000...");
  
  await prisma.budgetState.update({
    where: { userId: USER_ID },
    data: { spentTodayMicro: 9000, dailyLimitMicro: 10000, autoDowngradeAt: 0.8 }
  });
  await updateRedisBudget(9000);

  const autoPrompt = "Design a scalable microservices architecture with Kafka, Redis, and Postgres, and explain the failover mechanisms step by step.";
  const autoRes = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: autoPrompt }] })
  });
  
  const autoData = await autoRes.json();
  const autoVela = autoData.vela;

  console.log(`Autopilot Reason: ${autoVela.reasonCode} (Expected: BUDGET_GUARD)`);
  console.log(`Autopilot Model Decision: ${autoVela.model} (Expected: vela-mini)`);
  
  results.push({
    prompt: "[AUTOPILOT] " + autoPrompt.substring(0, 20) + '...',
    inputTokens: autoData.usage ? autoData.usage.prompt_tokens : 0,
    outputTokens: autoData.usage ? autoData.usage.completion_tokens : 0,
    modelDecision: autoVela.model,
    actualModel: autoVela.actualModel || 'gpt-4o-mini',
    actualCost: autoVela.actualCostMicro,
    baselineCost: autoVela.baselineCostMicro,
    savings: autoVela.savingsMicro,
    reason: autoVela.reasonCode,
    budgetBefore: 9000,
    budgetAfter: 'N/A',
    why: autoVela.why.why,
    impact: autoVela.why.impact,
    action: autoVela.why.action
  });

  // STEP 6 - DATABASE VERIFICATION
  console.log("\n--- DATABASE VERIFICATION ---");
  const dbLogs = await prisma.decisionLog.findMany({ where: { userId: USER_ID } });
  console.log(`Logs in DB: ${dbLogs.length}`);

  fs.writeFileSync('real-results.json', JSON.stringify(results, null, 2));
  console.log("\nResults written to real-results.json");

}

runRealTests().catch(console.error).finally(() => prisma.$disconnect());
