

const PROXY_URL = 'http://localhost:3000/api/v1/chat/completions'

// User A: testuser123@gmail.com
const USER_A_KEY = 'vk_live_testuser123'
// User B: yuvrajsingh2351@gmail.com
const USER_B_KEY = 'vk_live_yuvrajsingh2351'

const PROMPTS = [
  "Explain artificial intelligence in simple terms",
  "Write a Python function for factorial",
  "Summarize the benefits of cloud computing",
  "Create a short marketing email",
  "Explain DevOps in 5 bullet points"
]

async function testUser(userId: string, apiKey: string) {
  console.log(`\n\n--- TESTING USER: ${userId} ---`)
  for (let i = 0; i < PROMPTS.length; i++) {
    console.log(`\n[Request ${i+1}] Prompt: "${PROMPTS[i]}"`)
    try {
      const start = Date.now()
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: PROMPTS[i] }]
        })
      })
      const data = await res.json()
      const latency = Date.now() - start
      
      if (!res.ok) {
        console.error(`ERROR ${res.status}:`, data)
        continue
      }
      
      if (data.vela) {
        console.log(`Success! Latency: ${latency}ms`)
        console.log(`Vela Log: Model: ${data.vela.model}, Cost: ${data.vela.actualCostMicro/1e6}, Savings: ${data.vela.savingsMicro/1e6}`)
        console.log(`Usage:`, data.usage)
      } else {
        console.log(`Response missing Vela data:`, data)
      }
    } catch (e) {
      console.error(`Fetch failed:`, e)
    }
    
    // Add small delay between requests
    await new Promise(r => setTimeout(r, 1000))
  }
}

async function run() {
  await testUser('User A', USER_A_KEY)
  await testUser('User B', USER_B_KEY)
  
  console.log(`\n\n--- CACHE TEST (User A) ---`)
  const prompt = "Explain artificial intelligence in simple terms"
  const start = Date.now()
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${USER_A_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }] })
  })
  const data = await res.json()
  const latency = Date.now() - start
  console.log(`Cache Request Latency: ${latency}ms`)
  console.log(`Vela Reason: ${data?.vela?.reasonCode}`)
  
  console.log(`\n\n--- ERROR TEST (Invalid Key) ---`)
  const errRes = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer invalid_key_123`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }] })
  })
  const errData = await errRes.json()
  console.log(`Error Response ${errRes.status}:`, errData)
}

run()
