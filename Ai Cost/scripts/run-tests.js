const fs = require('fs');

async function runTests() {
  const apiKey = 'vk_live_mockkeyforlocaltesting123';
  const url = 'http://localhost:3000/api/v1/chat/completions';

  const prompts = [
    "What is 2+2?",
    "Capital of India?",
    "Define API",
    "Write a job email",
    "Explain REST vs GraphQL",
    "Summarize this paragraph",
    "Explain transformers in detail",
    "Design scalable microservices",
    "Optimize algorithm",
    "What is 2+2?" // Cache hit test
  ];

  console.log("🚀 Starting E2E Tests...\n");

  for (let i = 0; i < prompts.length; i++) {
    console.log(`[Request ${i + 1}] Prompt: "${prompts[i]}"`);
    
    const start = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompts[i] }],
        stream: false
      })
    });

    const ms = Date.now() - start;
    const data = await res.json();

    if (!res.ok) {
      console.log(`❌ FAILED (${res.status}): ${JSON.stringify(data.error || data)}`);
      continue;
    }

    if (data.vela) {
      console.log(`✅ SUCCESS (${ms}ms) | Model: ${data.vela.model} | Reason: ${data.vela.reasonCode} | Savings: $${(data.vela.savings / 1000000).toFixed(4)}`);
      if (data.vela.why) {
        console.log(`   WHY: ${data.vela.why.action}`);
      }
    } else {
      console.log(`⚠️ SUCCESS (${ms}ms) but no Vela metadata found.`);
    }
    
    // Wait slightly to avoid rate limit or exact idempotency window block for similar tests
    await new Promise(r => setTimeout(r, 6000));
  }
}

runTests().catch(console.error);
