
;(async () => {
const PROXY_URL = 'http://localhost:3000/api/v1/chat/completions'
const USER_A_KEY = 'vk_live_testuser123'

  console.log(`\n\n--- CACHE TEST (User A) ---`)
  const prompt = "Explain artificial intelligence in simple terms"
  
  // Prime the cache
  await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${USER_A_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }] })
  })

  console.log('Waiting 6 seconds for idempotency window to expire...')
  await new Promise(resolve => setTimeout(resolve, 6000))

  // Read from cache
  const start = Date.now()
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${USER_A_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }] })
  })
  const data = await res.json()
  console.log(JSON.stringify(data, null, 2))
  const latency = Date.now() - start
  console.log(`Cache Request Latency: ${latency}ms`)
  console.log(`Vela Reason: ${data?.vela?.reasonCode}`)
  console.log(`Cached Model: ${data?.vela?.model}`)
})()
