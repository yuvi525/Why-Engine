// Run this script to apply schema migrations to Supabase (Postgres)
// Stop the dev server first, then: node scripts/migrate.js
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// ── Load .env.local ───────────────────────────────────────────────────
const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8')
const envVars = {}
for (const line of envFile.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const idx = trimmed.indexOf('=')
  if (idx === -1) continue
  const key = trimmed.slice(0, idx).trim()
  const val = trimmed.slice(idx + 1).trim()
  envVars[key] = val
}

const env = { ...process.env, ...envVars }

// ── Step 1: Generate Prisma client ───────────────────────────────────
// (Stop dev server first — the DLL is locked when Next.js is running)
console.log('→ Running prisma generate...')
try {
  execSync('node node_modules/prisma/build/index.js generate', { env, stdio: 'inherit' })
} catch (err) {
  console.error('ERROR: prisma generate failed.')
  console.error('Make sure the Next.js dev server is STOPPED before running this script.')
  process.exit(1)
}

// ── Step 2: Push schema to Supabase Postgres ─────────────────────────
console.log('→ Running prisma db push...')
try {
  execSync('node node_modules/prisma/build/index.js db push', { env, stdio: 'inherit' })
} catch (err) {
  console.error('ERROR: prisma db push failed. Check DATABASE_URL / DIRECT_URL in .env.local')
  process.exit(1)
}

console.log('\n✓ Migration complete! You can restart the dev server now.')
