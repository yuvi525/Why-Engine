const url = 'http://localhost:3000/api/v1/chat/completions';
const apiKey = 'vk_live_afd88338cce342bf927addeba20cd3da';

async function testProxy() {
  console.log('Testing proxy...');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Say this is a test' }]
      })
    });
    
    const status = res.status;
    const text = await res.text();
    
    console.log('Status:', status);
    console.log('Headers:');
    res.headers.forEach((value, name) => {
      console.log(`  ${name}: ${value}`);
    });
    console.log('Body:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testProxy();
