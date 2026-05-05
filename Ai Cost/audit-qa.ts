
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PROXY_URL = 'http://localhost:3000/api/v1/chat/completions'
const USER_A_KEY = 'vk_live_testuser123'
const USER_B_KEY = 'vk_live_yuvrajsingh2351'

// PRICING copied for manual validation
const PRICING = {
  'gpt-4o':      { inputMicro: 2_500_000,  outputMicro: 10_000_000 },
  'gpt-4o-mini': { inputMicro:   150_000,  outputMicro:    600_000 },
}

async function verify(prompt: string, apiKey: string, expectCache: boolean = false) {
  const reqStart = Date.now()
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }] })
  })
  
  const data = await res.json()
  const latency = Date.now() - reqStart

  if (!res.ok) {
    return { ok: false, data, status: res.status }
  }

  // Find DB record
  const requestId = data.vela?.requestId
  const dbLog = await prisma.decisionLog.findUnique({ where: { requestId } })

  // Validation Math
  const inputTokens = data.usage.prompt_tokens
  const outputTokens = data.usage.completion_tokens
  const actualModel = data.vela.model.includes('gpt-4o-mini') ? 'gpt-4o-mini' : 'gpt-4o'
  
  const price = PRICING[actualModel]
  const basePrice = PRICING['gpt-4o']

  let expectedActualCost = Math.round((inputTokens * price.inputMicro + outputTokens * price.outputMicro) / 1e6)
  const expectedBaselineCost = Math.round((inputTokens * basePrice.inputMicro + outputTokens * basePrice.outputMicro) / 1e6)
  let expectedSavings = Math.max(0, expectedBaselineCost - expectedActualCost)

  if (expectCache) {
    expectedActualCost = 0
    expectedSavings = expectedBaselineCost
  }

  return {
    ok: true,
    prompt,
    apiResponse: data,
    dbLog,
    mathCheck: {
      inputTokens, outputTokens, actualModel,
      apiCost: data.vela.actualCostMicro,
      dbCost: dbLog?.actualCostMicro,
      expectedActualCost,
      
      apiBaseline: data.vela.baselineCostMicro,
      dbBaseline: dbLog?.baselineCostMicro,
      expectedBaselineCost,

      apiSavings: data.vela.savingsMicro,
      dbSavings: dbLog?.savingsMicro,
      expectedSavings,
    }
  }
}

async function runAudit() {
  console.log('=== VELA SYSTEM AUDIT START ===\n')

  // SECTION 1 & 2 & 3 & 4
  console.log('>>> 1. REAL REQUEST & CALCULATION TESTS')
  const r1 = await verify("Explain artificial intelligence in 1 short sentence", USER_A_KEY)
  console.log(`Prompt 1 Math Check:`, r1?.mathCheck)
  console.log(`Cost Match: API=${r1?.mathCheck?.apiCost}, DB=${r1?.mathCheck?.dbCost}, Expected=${r1?.mathCheck?.expectedActualCost}`)

  const r2 = await verify("Write a Python function to compute fibonacci", USER_A_KEY)
  console.log(`Prompt 2 Math Check:`, r2?.mathCheck)

  // Wait to clear idempotency window (5s limit)
  console.log('\nWaiting 6 seconds for idempotency window...')
  await new Promise(r => setTimeout(r, 6000))

  // SECTION 7: CACHE VALIDATION
  console.log('\n>>> 2. CACHE VALIDATION TEST')
  const rCache = await verify("Explain artificial intelligence in 1 short sentence", USER_A_KEY, true)
  console.log(`Cache Request -> IsCacheHit? ${rCache.dbLog?.isCacheHit}`)
  console.log(`Cache Cost (Expected 0): ${rCache?.mathCheck?.apiCost} (DB: ${rCache?.mathCheck?.dbCost})`)
  console.log(`Cache Savings: Expected=${rCache?.mathCheck?.expectedSavings}, DB=${rCache?.mathCheck?.dbSavings}`)

  // Wait to clear idempotency window
  console.log('\nWaiting 6 seconds for idempotency window...')
  await new Promise(r => setTimeout(r, 6000))

  // SECTION 10: EDGE CASES
  console.log('\n>>> 3. EDGE CASE TESTS')
  const rEmpty = await verify("", USER_A_KEY)
  console.log(`Empty Prompt Math Check:`, rEmpty?.mathCheck)

  const rLarge = await verify("Write the word 'cloud' 100 times: " + "cloud ".repeat(100), USER_A_KEY)
  console.log(`Large Prompt DB Savings: ${rLarge?.mathCheck?.dbSavings}`)

  const rRapid1 = await verify("Fast test", USER_A_KEY)
  const rRapid2 = await verify("Fast test", USER_A_KEY)
  console.log(`Rapid Request 1: ok=${rRapid1.ok}`)
  console.log(`Rapid Request 2: ok=${rRapid2.ok}, status=${rRapid2.status}`)

  // SECTION 8: MULTI-USER ISOLATION
  console.log('\n>>> 4. DB INTEGRITY & MULTI-USER TEST')
  const rUserB = await verify("User B test prompt", USER_B_KEY)
  console.log(`User B Math Check:`, rUserB?.mathCheck)

  console.log('\n=== VELA SYSTEM AUDIT END ===')
  prisma.$disconnect()
}

runAudit().catch(console.error)
