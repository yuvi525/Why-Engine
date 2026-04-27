const fetch = require('node-fetch');

async function runE2ETest() {
  const url = 'http://localhost:3000/api/proxy/llm';
  const apiKey = process.env.TEST_API_KEY || 'sk_test_mock';
  
  const payload = {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'What is the capital of France? Explain in exactly 3 sentences.' }],
    temperature: 0.7
  };

  console.log(`\n[Test] Dispatching payload to V2 Orchestrator at ${url}...`);
  const startTime = Date.now();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    const duration = Date.now() - startTime;

    console.log(`\n[Result] Status: ${res.status}`);
    
    // Validating V2 Custom Headers
    console.log(`[Headers] X-Why-Request-Id: ${res.headers.get('x-why-request-id')}`);
    console.log(`[Headers] X-Savings-USD: $${res.headers.get('x-savings-usd')}`);
    console.log(`[Headers] X-Model-Used: ${res.headers.get('x-model-used')}`);
    console.log(`[Headers] X-Cache-Hit: ${res.headers.get('x-cache-hit')}`);
    console.log(`[Headers] Latency: ${duration}ms\n`);
    
    if (data.choices && data.choices[0]) {
      console.log(`[LLM Content] ${data.choices[0].message.content.substring(0, 150)}...\n`);
    } else {
      console.log(`[Error Blocked]`, data);
    }

  } catch (err) {
    console.error('[Error] E2E Request failed:', err.message);
  }
}

runE2ETest();
