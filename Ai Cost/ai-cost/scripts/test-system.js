const http = require('http');

const BASE_URL = "http://localhost:3000";

async function runTest(name, testFn) {
  process.stdout.write(`▶ ${name}... `);
  try {
    const result = await testFn();
    if (result.pass) {
      console.log(`\n  ✔ PASS | ${result.reason}`);
    } else {
      console.log(`\n  ❌ FAIL | ${result.reason}`);
    }
  } catch (err) {
    console.log(`\n  ❌ FAIL | Error: ${err.message}`);
  }
  console.log("--------------------------------------------------");
}

async function main() {
  console.log("==================================================");
  console.log("🚀 WHY ENGINE: SYSTEM VALIDATION HARNESS");
  console.log("==================================================\n");

  let sharedHeaders = null;

  // TEST 1 — BASIC PROXY
  await runTest("TEST 1 — BASIC PROXY", async () => {
    const res = await fetch(`${BASE_URL}/api/proxy/llm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Say exactly 'hello'" }],
        routing_mode: "off" // Disable routing logic
      })
    });
    
    if (!res.ok) return { pass: false, reason: `Status ${res.status} from proxy. Ensure OPENAI_API_KEY is valid in .env.local` };
    
    const tokens = res.headers.get("x-proxy-input-tokens");
    const cost = res.headers.get("x-proxy-cost-usd");
    
    if (tokens && cost) {
      return { pass: true, reason: `Proxied successfully. Tokens: ${tokens}, Cost: $${cost}` };
    }
    return { pass: false, reason: "Missing telemetry headers (x-proxy-input-tokens, x-proxy-cost-usd)" };
  });

  // TEST 2 — ROUTING
  await runTest("TEST 2 — ROUTING", async () => {
    const res = await fetch(`${BASE_URL}/api/proxy/llm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }], // Short prompt triggers 'short_prompt' routing rule
        routing_mode: "smart"
      })
    });
    
    if (!res.ok) return { pass: false, reason: `Status ${res.status} from proxy.` };
    
    sharedHeaders = res.headers;
    const routedModel = res.headers.get("x-proxy-model");
    const rule = res.headers.get("x-proxy-rule-matched");
    
    if (routedModel === "gpt-4o-mini") {
      return { pass: true, reason: `Successfully routed from gpt-4o to ${routedModel} via rule '${rule}'` };
    }
    return { pass: false, reason: `Model was not routed. Expected gpt-4o-mini, got ${routedModel}` };
  });

  // TEST 3 — SAVINGS
  await runTest("TEST 3 — SAVINGS", async () => {
    if (!sharedHeaders) return { pass: false, reason: "Skipped: No headers available from TEST 2" };
    
    const savings = Number(sharedHeaders.get("x-proxy-savings-usd") || 0);
    if (savings > 0) {
      return { pass: true, reason: `Verified positive cost savings: $${savings.toFixed(6)}` };
    }
    return { pass: false, reason: `Savings not calculated correctly or <= 0 (value: $${savings})` };
  });

  // TEST 4 — GUARDRAIL BLOCK
  await runTest("TEST 4 — GUARDRAIL BLOCK", async () => {
    const pid = "test-guard-123";
    
    // 1. Set $0.000001 budget
    await fetch(`${BASE_URL}/api/budget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: pid, daily_limit_usd: 0.000001, mode: "block" })
    });
    
    // 2. Call proxy
    const res = await fetch(`${BASE_URL}/api/proxy/llm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        project_id: pid,
        messages: [{ role: "user", content: "This should be blocked due to budget" }]
      })
    });
    
    // 3. Reset budget to unblock
    await fetch(`${BASE_URL}/api/budget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: pid, daily_limit_usd: 100 })
    });
    
    if (res.status === 429) {
      return { pass: true, reason: "Request correctly blocked by budget guardrail (429 Too Many Requests)" };
    }
    return { pass: false, reason: `Expected 429 Block, got ${res.status}` };
  });

  // TEST 5 — WHY ENGINE
  await runTest("TEST 5 — WHY ENGINE", async () => {
    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usage: [
          { model: "gpt-4o", tokens: 100000, cost: 5.00 },
          { model: "gpt-4o", tokens: 200000, cost: 10.00 }
        ]
      })
    });
    
    const data = await res.json().catch(() => null);
    if (res.ok && data?.why) {
      return { pass: true, reason: `WHY Output successfully generated: "${data.why.substring(0, 45)}..."` };
    }
    return { pass: false, reason: `WHY Engine output missing. Status: ${res.status}` };
  });

  // TEST 6 — AUTOPILOT
  await runTest("TEST 6 — AUTOPILOT", async () => {
    // Autopilot settings API (auto_safe mode)
    const res = await fetch(`${BASE_URL}/api/autopilot/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_mode", mode: "auto_safe" })
    });
    
    const data = await res.json().catch(() => null);
    if (res.ok && data?.mode === "auto_safe") {
      return { pass: true, reason: "Autopilot confirmed 'auto_safe' mode switch" };
    }
    return { pass: false, reason: "Failed to communicate with Autopilot API" };
  });

  // TEST 7 — ALERTS
  await runTest("TEST 7 — ALERTS", async () => {
    // Simulate spike ingestion
    const res = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o", tokens: 5000000, cost: 100.00, user_id: "test" 
      })
    });
    
    if (res.status === 200 || res.status === 201) {
      return { pass: true, reason: "Alert condition simulated (massive usage spike ingested)" };
    }
    return { pass: false, reason: `Ingest endpoint returned ${res.status}` };
  });

  // TEST 8 — API KEY
  await runTest("TEST 8 — API KEY", async () => {
    // Attempt to list keys without valid token -> should 401
    const res = await fetch(`${BASE_URL}/api/keys`, {
      method: "GET",
      headers: { "Authorization": "Bearer invalid_token_123" }
    });
    
    if (res.status === 401) {
      return { pass: true, reason: "Invalid API key gracefully blocked (401 Unauthorized)" };
    }
    return { pass: false, reason: `Expected 401, got ${res.status}` };
  });

  // TEST 9 — DEMO MODE
  await runTest("TEST 9 — DEMO MODE", async () => {
    // Demo endpoint check
    try {
      const demoUrl = `${BASE_URL}/api/validate`;
      const res = await fetch(demoUrl);
      
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.mode === "demo" || data?.mode === "live")) {
        return { pass: true, reason: `Successfully retrieved validation data. Mode: ${data.mode}` };
      }
      return { pass: false, reason: "Response didn't contain valid mode configuration" };
    } catch(err) {
      return { pass: false, reason: err.message };
    }
  });

  console.log("==================================================");
  console.log("🏁 VALIDATION COMPLETE");
  console.log("==================================================");
}

main();
