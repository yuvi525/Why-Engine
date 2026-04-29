import fetch from 'node-fetch';
import { prisma } from './lib/prisma';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const PROXY_URL = 'http://localhost:3000/api/v1/chat/completions';

async function runTests() {
  console.log('==================================================');
  console.log('VELA END-TO-END QA TEST');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;
  let testNumber = 1;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] Test ${testNumber}: ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${testNumber}: ${message}`);
      failed++;
    }
    testNumber++;
  }

  // Use the seeded user and key
  const API_KEY = 'vk_live_afd88338cce342bf927addeba20cd3da';
  const USER_ID = 'f280b947-1788-4d11-a795-b37593ead4eb';

  // 1 & 2. AUTH & API KEY TEST
  console.log('--- 1 & 2. AUTH & API KEY TEST ---');
  const apiKeyRecord = await prisma.apiKey.findFirst({ where: { userId: USER_ID } });
  assert(apiKeyRecord !== null, 'API key exists in the database');
  
  const userRecord = await prisma.user.findUnique({ where: { id: USER_ID } });
  assert(userRecord !== null, 'User exists in the database');
  assert(userRecord.encryptedApiKey !== null, 'User has OpenAI API key configured');

  // 3 & 4. PROXY & ROUTING TEST (Simple)
  console.log('\n--- 3 & 4. PROXY & ROUTING TEST (Simple Request) ---');
  let simpleRes, simpleData;
  try {
    simpleRes = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'What is 2+2?' }] })
    });
    simpleData = await simpleRes.json();
    assert(simpleRes.status === 200, 'Simple request returned 200 OK');
    assert(simpleData.vela !== undefined, 'Vela metadata is present in response');
    assert(simpleData.vela.reasonCode === 'COMPLEXITY_LOW', 'Reason code is COMPLEXITY_LOW for simple request');
  } catch (err) {
    console.error(err);
    assert(false, 'Simple request threw an error');
  }

  // PROXY & ROUTING TEST (Complex)
  console.log('\n--- ROUTING TEST (Complex Request) ---');
  let complexRes, complexData;
  try {
    const complexText = 'Analyze this comprehensive data and calculate step-by-step the architecture optimizations required for a microservices refactor with multiple import statements and class definitions.';
    complexRes = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: complexText }] })
    });
    complexData = await complexRes.json();
    assert(complexRes.status === 200, 'Complex request returned 200 OK');
    assert(complexData.vela.reasonCode === 'COMPLEXITY_HIGH', `Reason code is COMPLEXITY_HIGH (got ${complexData.vela.reasonCode})`);
  } catch (err) {
    console.error(err);
    assert(false, 'Complex request threw an error');
  }

  // 5. COST ENGINE TEST
  console.log('\n--- 5. COST ENGINE TEST ---');
  if (complexData && complexData.vela) {
    const v = complexData.vela;
    assert(v.baselineCostMicro > v.actualCostMicro, `Baseline cost (${v.baselineCostMicro}) > Actual cost (${v.actualCostMicro})`);
    assert(v.savingsMicro > 0, `Savings > 0 (Savings: ${v.savingsMicro})`);
  } else {
    assert(false, 'Cannot test cost engine because response is missing');
  }

  // 6. WHY ENGINE TEST
  console.log('\n--- 6. WHY ENGINE TEST ---');
  if (complexData && complexData.vela && complexData.vela.why) {
    const why = complexData.vela.why;
    assert(typeof why.why === 'string' && why.why.length > 0, 'WHY explanation is present');
    assert(typeof why.impact === 'string' && why.impact.length > 0, 'IMPACT explanation is present');
    assert(typeof why.action === 'string' && why.action.length > 0, 'ACTION explanation is present');
  } else {
    assert(false, 'Cannot test WHY engine because response is missing');
  }

  // 7. AUTOPILOT TEST
  console.log('\n--- 7. AUTOPILOT TEST ---');
  // Simulate low budget
  await prisma.budgetState.update({
    where: { userId: USER_ID },
    data: { spentTodayMicro: 4_500_000, dailyLimitMicro: 5_000_000, autoDowngradeAt: 0.8 } // 90% spent
  });

  let autoRes, autoData;
  try {
    // Send complex request which would normally route to gpt-4o
    const complexText = 'Analyze this comprehensive data and calculate step-by-step the architecture optimizations required for a microservices refactor with multiple import statements and class definitions.';
    autoRes = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: complexText }] })
    });
    autoData = await autoRes.json();
    assert(autoRes.status === 200, 'Autopilot request returned 200 OK');
    assert(autoData.vela.reasonCode === 'BUDGET_GUARD', `Model was downgraded due to budget (got ${autoData.vela.reasonCode})`);
  } catch (err) {
    console.error(err);
    assert(false, 'Autopilot request threw an error');
  }

  // Restore budget state
  await prisma.budgetState.update({
    where: { userId: USER_ID },
    data: { spentTodayMicro: 0 }
  });

  // 8. DATABASE TEST
  console.log('\n--- 8. DATABASE TEST ---');
  const logCount = await prisma.decisionLog.count({
    where: { userId: USER_ID }
  });
  // The seed script created 10, and we just did 3 requests
  assert(logCount >= 13, `Decision logs are stored in the DB (Total: ${logCount})`);

  console.log('\n==================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');
}

runTests().catch(console.error);
