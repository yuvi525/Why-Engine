const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { Redis } = require('@upstash/redis');

const WORKSPACE_DIR = path.join(__dirname, '..');
const envLocal = fs.readFileSync(path.join(WORKSPACE_DIR, '.env.local'), 'utf8');
const envVars = {};
for (const line of envLocal.split('\n')) {
  if (line && line.trim() && line.includes('=') && !line.startsWith('#')) {
    const idx = line.indexOf('=');
    const k = line.substring(0, idx).trim();
    const v = line.substring(idx + 1).trim();
    envVars[k] = v;
  }
}
Object.assign(process.env, envVars);

const prisma = new PrismaClient();
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(ciphertext) {
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

async function runTests() {
  console.log('==================================================');
  console.log('VELA PRODUCTION READINESS AUDIT FIXES VALIDATION');
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

  const APP_URL = 'http://localhost:3000';
  const CRON_SECRET = process.env.CRON_SECRET || 'my_secure_cron_secret';
  const STRIPE_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock_123';

  // Seed / use a test user
  const TEST_USER_ID = 'test-audit-user-id-' + Math.random().toString(36).slice(2, 8);
  const TEST_EMAIL = `test-${Math.random().toString(36).slice(2, 8)}@vela.run`;

  console.log(`Setting up test user with ID: ${TEST_USER_ID}, Email: ${TEST_EMAIL}`);

  // Create user in DB
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: TEST_EMAIL,
      plan: 'free',
      role: 'customer'
    }
  });

  // Helper to generate cookies header
  const sessionCookieVal = encrypt(JSON.stringify({ id: TEST_USER_ID }));
  const headersWithCookie = {
    'Cookie': `vela_session=${sessionCookieVal}`,
    'Content-Type': 'application/json'
  };

  try {
    // ────────────────────────────────────────────────────────────────
    // BUG 12: Webhook Replay Protection & Signature Validation
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- BUG 12: Stripe Webhook Replay Protection ---');
    const webhookUrl = `${APP_URL}/api/stripe-webhook`;
    const payload = JSON.stringify({
      id: 'evt_test_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          customer_details: { email: TEST_EMAIL },
          metadata: { userId: TEST_USER_ID, plan: 'pro' }
        }
      }
    });

    // Case A: Missing signature
    const resA = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });
    assert(resA.status === 400, 'Rejects request with missing signature (returns 400)');

    // Case B: Signature present but timestamp expired (more than 5 minutes old)
    const oldTimestamp = Math.floor(Date.now() / 1000) - 360; // 6 minutes ago
    const oldSigned = `${oldTimestamp}.${payload}`;
    const oldHmac = crypto.createHmac('sha256', STRIPE_SECRET).update(oldSigned).digest('hex');
    const resB = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'stripe-signature': `t=${oldTimestamp},v1=${oldHmac}`,
        'Content-Type': 'application/json'
      },
      body: payload
    });
    assert(resB.status === 400, 'Rejects request with expired timestamp signature (returns 400)');

    // Case C: Signature present and timestamp is valid (current time)
    const validTimestamp = Math.floor(Date.now() / 1000);
    const validSigned = `${validTimestamp}.${payload}`;
    const validHmac = crypto.createHmac('sha256', STRIPE_SECRET).update(validSigned).digest('hex');
    const resC = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'stripe-signature': `t=${validTimestamp},v1=${validHmac}`,
        'Content-Type': 'application/json'
      },
      body: payload
    });
    assert(resC.status === 200, 'Accepts request with valid timestamp signature (returns 200)');

    // Verify user was upgraded
    const userUpgraded = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
    assert(userUpgraded.plan === 'pro', 'User successfully upgraded to pro via Stripe Webhook');

    // ────────────────────────────────────────────────────────────────
    // BUG 13: Decryption Failures Return 422
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- BUG 13: Decryption Failures Return 422 ---');
    // Set a corrupted/invalid encrypted API key in the DB
    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { encryptedApiKey: 'bad-iv-format:no-tags:corrupted-data' }
    });

    // Create a Vela API Key for this user
    const keyUuid = crypto.randomUUID().replace(/-/g, '');
    const velaApiKey = `vk_live_${keyUuid}`;
    const keyHash = crypto.createHash('sha256').update(velaApiKey).digest('hex');
    await prisma.apiKey.create({
      data: {
        userId: TEST_USER_ID,
        keyHash,
        keyPrefix: velaApiKey.slice(0, 16),
        label: 'Test Key'
      }
    });

    // Call completion proxy with this key
    const proxyUrl = `${APP_URL}/api/v1/chat/completions`;
    const resProxy = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${velaApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }]
      })
    });
    const proxyData = await resProxy.json();
    assert(resProxy.status === 422, 'Returns 422 Unprocessable Entity on key decryption failure (no 500 crash)');
    assert(proxyData.error.type === 'decryption_error', 'Response error type is decryption_error');

    // ────────────────────────────────────────────────────────────────
    // BUG 1 & 2: Alert Rules & Fired Alerts Key Consistency & Cron Check
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- BUG 1 & 2 & 11: Alert Evaluation Cron and Key Consistency ---');
    const ruleId = 'rule-test-123';
    const mockRules = [{
      id: ruleId,
      name: 'Test Spend Spike',
      type: 'spend_spike',
      threshold: 90,
      enabled: true,
      severity: 'warning'
    }];
    await redis.set(`alert_rules:${TEST_USER_ID}`, JSON.stringify(mockRules));

    // Let's call evaluate-alerts cron
    const cronUrl = `${APP_URL}/api/cron/evaluate-alerts`;
    const resCron = await fetch(cronUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
    });
    const cronData = await resCron.json();
    assert(resCron.status === 200, 'Evaluate alerts cron runs successfully (returns 200)');
    assert(cronData.success === true, 'Cron response indicates success: true');

    // ────────────────────────────────────────────────────────────────
    // BUG 2 & Concurrency: Fired Alerts Acknowledgment
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- BUG 2 & Concurrency: Fired Alerts Acknowledgment ---');
    const mockFired = [{
      id: 'fired-alert-abc',
      ruleId: ruleId,
      ruleName: 'Test Spend Spike',
      type: 'spend_spike',
      severity: 'warning',
      message: 'Daily spend limit warnings',
      acknowledged: false,
      firedAt: new Date().toISOString()
    }];
    await redis.set(`alerts:fired:${TEST_USER_ID}`, JSON.stringify(mockFired));

    // Call GET /api/alerts/fired using headersWithCookie to verify we retrieve it
    const resFiredList = await fetch(`${APP_URL}/api/alerts/fired`, {
      method: 'GET',
      headers: headersWithCookie
    });
    const firedListData = await resFiredList.json();
    assert(resFiredList.status === 200, 'Fired alerts list retrieved successfully');
    assert(firedListData.alerts.length > 0 && firedListData.alerts.some(a => a.id === 'fired-alert-abc'), 'Retrieve alert from alerts:fired:${userId} consistent cache key');

    // Acknowledge the alert (calls POST /api/alerts/fired/[id]/ack)
    const ackUrl = `${APP_URL}/api/alerts/fired/fired-alert-abc/ack`;
    const resAck = await fetch(ackUrl, {
      method: 'POST',
      headers: headersWithCookie
    });
    const ackData = await resAck.json();
    assert(resAck.status === 200, 'Alert acknowledgment endpoint returns 200 OK');
    assert(ackData.success === true, 'Alert acknowledgment success');

    // Verify it is acknowledged in Redis
    const afterAckRaw = await redis.get(`alerts:fired:${TEST_USER_ID}`);
    const afterAck = typeof afterAckRaw === 'string' ? JSON.parse(afterAckRaw) : afterAckRaw;
    assert(afterAck && afterAck[0].acknowledged === true, 'Alert marked as acknowledged in Redis alerts:fired:${userId}');

    // ────────────────────────────────────────────────────────────────
    // BUG 7: Custom Budgets Defaults
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- BUG 7: Custom Budgets Defaults ---');
    const budgetsUrl = `${APP_URL}/api/budgets`;
    const resBudget = await fetch(budgetsUrl, {
      method: 'POST',
      headers: headersWithCookie,
      body: JSON.stringify({
        name: 'My Daily Limit',
        limitMicro: 10000000,
        hardLimit: true
      })
    });
    assert(resBudget.status === 200 || resBudget.status === 201, `Budget rule created successfully (returned status ${resBudget.status})`);

    // Verify in Redis
    const budgetsInRedis = await redis.get(`budgets:${TEST_USER_ID}`);
    const budgets = typeof budgetsInRedis === 'string' ? JSON.parse(budgetsInRedis) : budgetsInRedis;
    const latestBudget = budgets[budgets.length - 1];
    assert(latestBudget.enabled === true, 'Budget defaults to enabled: true');
    assert(latestBudget.scope === 'daily', 'Budget defaults to scope: "daily"');

    // ────────────────────────────────────────────────────────────────
    // BUG 8: Overview Margin monthly calculation
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- BUG 8: Overview Margin Logic ---');
    const decisionsUrl = `${APP_URL}/api/decisions`;
    const resDec = await fetch(decisionsUrl, {
      method: 'GET',
      headers: headersWithCookie
    });
    assert(resDec.status === 200, 'Decisions endpoint with streak and monthly margin returns 200 OK');

    // ────────────────────────────────────────────────────────────────
    // BUG 10: Redis performance - reset budget
    // ────────────────────────────────────────────────────────────────
    console.log('\n--- BUG 10: Reset Budgets Cron without KEYS scan ---');
    const resetUrl = `${APP_URL}/api/cron/reset-budgets`;
    const resReset = await fetch(resetUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
    });
    const resetData = await resReset.json();
    assert(resReset.status === 200, 'Reset budgets cron runs successfully (returns 200)');
    assert(resetData.success === true, 'Reset budgets success is true');

  } catch (err) {
    console.error('Test run error:', err);
  } finally {
    // Clean up DB
    console.log('\nCleaning up DB test user and API keys...');
    try {
      await prisma.apiKey.deleteMany({ where: { userId: TEST_USER_ID } });
      await prisma.user.delete({ where: { id: TEST_USER_ID } });
    } catch (e) {
      console.warn('DB Cleanup failed or no cleanup needed:', e.message);
    }
    await prisma.$disconnect();

    // Clean up Redis
    console.log('Cleaning up Redis keys...');
    try {
      await redis.del(`alert_rules:${TEST_USER_ID}`);
      await redis.del(`alerts:fired:${TEST_USER_ID}`);
      await redis.del(`budgets:${TEST_USER_ID}`);
    } catch (e) {
      console.warn('Redis Cleanup failed:', e.message);
    }
  }

  console.log('\n==================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
