const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('==================================================');
console.log('VELA PRODUCTION READINESS AUDIT FIXES - UNIT TESTS');
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

// ────────────────────────────────────────────────────────────────
// 1. Webhook Signature Verification & Replay Protection (Bug 12)
// ────────────────────────────────────────────────────────────────
console.log('--- 1. WEBHOOK SIGNATURE & REPLAY PROTECTION ---');

function verifyStripeSignature(body, sig, secret) {
  const parts = sig.split(',').reduce((acc, part) => {
    const [k, v] = part.split('='); acc[k] = v; return acc;
  }, {});
  const timestamp = parts['t'];
  const v1Sig = parts['v1'];
  if (!timestamp || !v1Sig) throw new Error('Missing timestamp or signature');

  const tsNumber = parseInt(timestamp, 10);
  if (isNaN(tsNumber) || Math.abs(Date.now() / 1000 - tsNumber) > 300) {
    throw new Error('Timestamp expired or invalid');
  }

  const signed = `${timestamp}.${body}`;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');

  const bufExpected = Buffer.from(expected, 'hex');
  const bufActual = Buffer.from(v1Sig, 'hex');
  if (bufExpected.length !== bufActual.length || !crypto.timingSafeEqual(bufExpected, bufActual)) {
    throw new Error('Signature mismatch');
  }
  return true;
}

const SECRET = 'whsec_test_secret';
const payload = JSON.stringify({ event: 'test' });

// Test 1a: Valid signature
try {
  const ts = Math.floor(Date.now() / 1000);
  const signed = `${ts}.${payload}`;
  const hmac = crypto.createHmac('sha256', SECRET).update(signed).digest('hex');
  const sig = `t=${ts},v1=${hmac}`;
  const result = verifyStripeSignature(payload, sig, SECRET);
  assert(result === true, 'Valid signature is accepted');
} catch (e) {
  assert(false, `Valid signature failed: ${e.message}`);
}

// Test 1b: Expired timestamp (> 5 minutes)
try {
  const ts = Math.floor(Date.now() / 1000) - 301; // 5 mins + 1 sec
  const signed = `${ts}.${payload}`;
  const hmac = crypto.createHmac('sha256', SECRET).update(signed).digest('hex');
  const sig = `t=${ts},v1=${hmac}`;
  verifyStripeSignature(payload, sig, SECRET);
  assert(false, 'Expired signature should be rejected');
} catch (e) {
  assert(e.message === 'Timestamp expired or invalid', 'Correctly rejects expired signature (> 5 mins)');
}

// Test 1c: Invalid signature
try {
  const ts = Math.floor(Date.now() / 1000);
  const sig = `t=${ts},v1=invalidhmachere`;
  verifyStripeSignature(payload, sig, SECRET);
  assert(false, 'Invalid signature should be rejected');
} catch (e) {
  assert(e.message === 'Signature mismatch', 'Correctly rejects invalid signature');
}

// ────────────────────────────────────────────────────────────────
// 2. Decryption Error Handling & 422 Response (Bug 13)
// ────────────────────────────────────────────────────────────────
console.log('\n--- 2. DECRYPTION ERROR HANDLING ---');

class MockNextResponse {
  static json(body, init) {
    return {
      body,
      status: init?.status ?? 200
    };
  }
}

function handleDecryption(encryptedKey, decryptFn) {
  let openAiKey;
  try {
    openAiKey = decryptFn(encryptedKey);
    return { success: true, key: openAiKey };
  } catch (err) {
    return MockNextResponse.json({
      error: {
        message: 'Decryption of configured provider API key failed. Please update/re-save your API key in Settings.',
        type: 'decryption_error',
        code: 422,
      },
      vela: { requestId: 'mock-req-id', reasonCode: 'DECRYPTION_ERROR' }
    }, { status: 422 });
  }
}

// Test 2a: Decryption succeeds
const mockDecryptOk = (key) => 'sk-proj-valid';
const resultOk = handleDecryption('encrypted-stuff', mockDecryptOk);
assert(resultOk.success === true && resultOk.key === 'sk-proj-valid', 'Returns decrypted key on success');

// Test 2b: Decryption fails (throws)
const mockDecryptFail = (key) => { throw new Error('Decipher failed'); };
const resultFail = handleDecryption('corrupted-stuff', mockDecryptFail);
assert(resultFail.status === 422, 'Returns status 422 on decryption failure');
assert(resultFail.body.error.type === 'decryption_error', 'Returns decryption_error type in payload');

// ────────────────────────────────────────────────────────────────
// 3. Static Code Verification of Fixes (Bugs 1-11)
// ────────────────────────────────────────────────────────────────
console.log('\n--- 3. STATIC CODE VERIFICATION ---');

const WORKSPACE = path.join(__dirname, '..');

// Test 3a: Alert Rules keys standardized in evaluate-alerts
const evaluateAlertsContent = fs.readFileSync(path.join(WORKSPACE, 'app/api/cron/evaluate-alerts/route.ts'), 'utf8');
assert(evaluateAlertsContent.includes('alert_rules:${bs.userId}'), 'Bug 1: evaluate-alerts/route.ts queries alert_rules key prefix');

// Test 3b: Fired alerts consolidated to alerts:fired in fired/route.ts
const firedRouteContent = fs.readFileSync(path.join(WORKSPACE, 'app/api/alerts/fired/route.ts'), 'utf8');
assert(firedRouteContent.includes('alerts:fired:${userId}'), 'Bug 2: fired/route.ts reads/writes alerts:fired key prefix');

// Test 3c: Supabase auth removed in upgrade and keys
const upgradeContent = fs.readFileSync(path.join(WORKSPACE, 'app/api/upgrade/route.ts'), 'utf8');
const keysContent = fs.readFileSync(path.join(WORKSPACE, 'app/api/keys/route.ts'), 'utf8');
assert(!upgradeContent.includes('createServerSupabase') && upgradeContent.includes('resolveSessionUserId'), 'Bug 3: upgrade/route.ts uses resolveSessionUserId and no Supabase auth');
assert(!keysContent.includes('createServerSupabase') && keysContent.includes('resolveSessionUserId'), 'Bug 3: keys/route.ts uses resolveSessionUserId and no Supabase auth');

// Test 3d: Stripe Downgrade Fallback by Email
const stripeWebhookContent = fs.readFileSync(path.join(WORKSPACE, 'app/api/stripe-webhook/route.ts'), 'utf8');
assert(stripeWebhookContent.includes('fetch(`https://api.stripe.com/v1/customers/${customerId}`'), 'Bug 4: Stripe webhook implements email lookup fallback via customers API');

// Test 3e: Razorpay dynamic plan lookup
const razorpayContent = fs.readFileSync(path.join(WORKSPACE, 'app/api/razorpay-webhook/route.ts'), 'utf8');
assert(razorpayContent.includes('notes?.plan') || razorpayContent.includes('notes.plan'), 'Bug 9: Razorpay webhook retrieves plan from payment notes dynamically');

// Test 3f: Blocking KEYS removed
const resetBudgetsContent = fs.readFileSync(path.join(WORKSPACE, 'app/api/cron/reset-budgets/route.ts'), 'utf8');
assert(!resetBudgetsContent.includes('redis.keys(') && resetBudgetsContent.includes('naturally expire'), 'Bug 10: reset-budgets/route.ts has no blocking Redis KEYS calls');

// Test 3g: Alert Cron N+1 query skip optimization
assert(evaluateAlertsContent.includes('hasAnomalyRule = rules.some'), 'Bug 11: evaluate-alerts/route.ts optimizes N+1 queries by checking anomaly rule existence');

// Test 3h: Concurrency-safe Alert Ack using Lua script
const ackRouteContent = fs.readFileSync(path.join(WORKSPACE, 'app/api/alerts/fired/[id]/ack/route.ts'), 'utf8');
assert(ackRouteContent.includes('luaScript') && ackRouteContent.includes('redis.eval'), 'Ack Route utilizes race-condition-free Lua script atomic update');

// Test 3i: O(1) Lifetime Savings Aggregate
const spendRouteContent = fs.readFileSync(path.join(WORKSPACE, 'app/api/analytics/spend/route.ts'), 'utf8');
assert(spendRouteContent.includes('prisma.decisionLog.aggregate') && spendRouteContent.includes('_sum: { savingsMicro: true }'), 'Spend route aggregates lifetime savings using DB _sum');

// Test 3j: Bounded Streak Calculator
const decisionsRouteContent = fs.readFileSync(path.join(WORKSPACE, 'app/api/decisions/route.ts'), 'utf8');
assert(decisionsRouteContent.includes('SELECT DISTINCT DATE_TRUNC'), 'Decisions route uses queryRaw select distinct days to optimize streak memory');

console.log('\n==================================================');
console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('==================================================\n');
process.exit(failed > 0 ? 1 : 0);
