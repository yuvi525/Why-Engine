# VELA — AI Cost Autopilot

> Drop-in OpenAI-compatible proxy that automatically routes every request to the cheapest model that can handle it — with full WHY explanations.

## Architecture

```
CLIENT (any SDK-compatible app)
         │
         ▼
  ┌──────────────┐
  │  VELA PROXY  │  ← Drop-in replacement for OpenAI base URL
  │  (Fastify)   │
  └──────┬───────┘
         │
   ┌─────▼──────┐
   │  GATE LAYER│  ← Auth · Rate limit · Budget check
   └─────┬──────┘
         │
   ┌─────▼──────────┐
   │ DECISION ENGINE│  ← Pure function: (request) → RoutingDecision
   │  • Complexity  │
   │  • Cost matrix │
   │  • Policy rules│
   │  • Budget state│
   └─────┬──────────┘
         │
   ┌─────▼──────┐
   │  WHY ENGINE│  ← WHY→IMPACT→ACTION→DECISION explanation
   └─────┬──────┘
         │
   ┌─────▼────────────────────────────────────────────┐
   │  PROVIDER ADAPTER (LiteLLM)                      │
   │  Bedrock (PRIMARY) → Vertex (PRIMARY) → OAI (FB) │
   └─────┬────────────────────────────────────────────┘
         │
   ┌─────▼──────┐
   │ COST ENGINE│  ← Real pricing, token counting, savings calc
   └─────┬──────┘
         │
   ┌─────▼──────┐
   │  RESPONSE  │  ← X-Vela-* headers injected
   └─────┬──────┘
         │
   ┌─────▼──────┐
   │   LEDGER   │  ← SQLite (MVP): every decision logged
   └─────┬──────┘
         │
   ┌─────▼──────┐
   │  DASHBOARD │  ← Next.js: real-time savings, decisions, WHY logs
   └────────────┘
```

## Routing Strategy

| Complexity | Provider | Model | Cost/1M tokens |
|---|---|---|---|
| 1 — Simple Q&A | Google Vertex | gemini-1.5-flash-002 | $0.075 |
| 2 — Basic code | AWS Bedrock | claude-3-haiku | $0.80 |
| 3 — Medium analysis | AWS Bedrock | claude-3.5-haiku | $0.80 |
| 4 — Long context | Google Vertex | gemini-1.5-pro-002 | $1.25 |
| 5 — Expert/forced | OpenAI | gpt-4o-mini | $0.15 |

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your AWS + GCP credentials
```

Required:
- `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_REGION`

Optional (graceful degradation if missing):
- `GOOGLE_APPLICATION_CREDENTIALS` + `VERTEX_PROJECT` + `VERTEX_LOCATION`
- `OPENAI_API_KEY`

### 3. Start development

```bash
pnpm dev
```

- Proxy: `http://localhost:3001`
- Dashboard: `http://localhost:3000`

---

## Demo Mode

No cloud credentials? Run with simulated responses:

```bash
DEMO_MODE=true pnpm dev
```

Then seed the dashboard with 50 realistic decision logs:

```bash
pnpm seed:demo
```

---

## Test the Proxy

Drop-in replacement for OpenAI — just change the base URL:

```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Explain photosynthesis in one sentence."}]
  }'
```

Response headers injected by Vela:

```
X-Vela-Model: gemini-1.5-flash-002
X-Vela-Provider: vertex
X-Vela-Cost: 0.000011
X-Vela-Savings: 0.000489
X-Vela-Reason: COMPLEXITY_LOW
X-Vela-Why: Saved $0.000489 vs GPT-4o baseline.
X-Vela-Request-Id: V3k2mNpQx8
```

## Reset DB

```bash
pnpm db:reset
```

## Repo Structure

```
vela/
├── apps/
│   ├── proxy/          ← Fastify proxy server (port 3001)
│   └── dashboard/      ← Next.js 14 dashboard (port 3000)
├── packages/
│   ├── core/           ← Decision engine, WHY engine, cost engine, classifier
│   ├── db/             ← Drizzle ORM + SQLite schema + query helpers
│   └── types/          ← Shared TypeScript interfaces
├── turbo.json
└── package.json
```
