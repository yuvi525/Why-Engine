import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { env } from '../src/config/env';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Create Org
  const { data: org, error: orgErr } = await supabase
    .from('orgs')
    .insert({ name: 'Demo Org', plan: 'pro' })
    .select()
    .single();

  if (orgErr) throw new Error(`Org error: ${orgErr.message}`);
  const orgId = org.id;

  // Set budget in org_policies (assuming org_policies table exists per schema)
  await supabase.from('org_policies').insert({
    org_id: orgId,
    daily_budget_usd: 100
  });

  console.log(`✅ Created Org: ${orgId}`);

  // 2. Create API Key
  await supabase.from('api_keys').insert({
    org_id: orgId,
    key_hash: 'whye_seed_test_key_hash',
    name: 'Development Key',
  });

  // 3. Usage Records
  const usageInsert = [];
  const savingsInsert = [];
  
  for (let i = 0; i < 5; i++) {
    const reqId = `req_${Math.random().toString(36).substring(7)}`;
    usageInsert.push({
      request_id: reqId,
      org_id: orgId,
      model: i % 2 === 0 ? 'gpt-4o' : 'claude-3-5-sonnet',
      total_tokens: 500 + i * 100,
      cost_usd: 0.01 + i * 0.005,
      cache_hit: i === 3,
    });

    savingsInsert.push({
      request_id: reqId,
      org_id: orgId,
      baseline_cost_usd: 0.02 + i * 0.005,
      actual_cost_usd: 0.01 + i * 0.005,
      savings_usd: 0.01,
      saving_reason: i === 3 ? 'cache' : 'routing',
      routing_reason: 'Budget optimization'
    });
  }

  await supabase.from('usage_records').insert(usageInsert);
  await supabase.from('savings_records').insert(savingsInsert);

  // 4. Cost DNA
  await supabase.from('cost_dna_snapshots').insert({
    org_id: orgId,
    waste_score: 45,
    recommendations: [
      { type: 'routing', impact_usd: 120, description: 'Route simple summarization to gpt-4o-mini' },
      { type: 'caching', impact_usd: 40, description: 'Increase semantic cache similarity threshold' }
    ]
  });

  // 5. Efficiency Score
  await supabase.from('efficiency_scores').insert({
    org_id: orgId,
    score: 88,
    metrics: { cache_hit_rate: 0.25, avg_latency: 400 }
  });

  console.log('✅ Seed complete!');
}

seed().catch(console.error);
