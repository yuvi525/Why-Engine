import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { DecisionLog } from '@vela/types';
import { eq, desc, sum, count } from 'drizzle-orm';

const sqlite = new Database(process.env.DB_PATH || './vela.db');

// Auto-create tables (no migration step needed)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS decision_logs (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    user_id TEXT DEFAULT 'anonymous',
    timestamp INTEGER NOT NULL,
    original_model TEXT,
    routed_provider TEXT,
    routed_model TEXT,
    reason_code TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    actual_cost_usd REAL,
    baseline_cost_usd REAL,
    savings_usd REAL,
    latency_ms INTEGER,
    why_json TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS budget_state (
    id TEXT PRIMARY KEY,
    daily_budget_usd REAL DEFAULT 5.0,
    spent_today_usd REAL DEFAULT 0,
    spent_total_usd REAL DEFAULT 0,
    reset_date TEXT,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS provider_health (
    provider TEXT PRIMARY KEY,
    is_healthy INTEGER DEFAULT 1,
    last_error TEXT,
    checked_at INTEGER
  );
`);

export const db = drizzle(sqlite, { schema });
export { schema };

export function logDecision(log: DecisionLog): void {
  db.insert(schema.decisionLogs).values({
    id: log.id,
    requestId: log.requestId,
    userId: log.userId,
    timestamp: log.timestamp.getTime(),
    originalModel: log.originalModel,
    routedProvider: log.provider,
    routedModel: log.routedModel,
    reasonCode: log.reasonCode,
    inputTokens: log.inputTokens,
    outputTokens: log.outputTokens,
    actualCostUsd: log.actualCostUSD,
    baselineCostUsd: log.baselineCostUSD,
    savingsUsd: log.savingsUSD,
    latencyMs: log.latencyMs,
    whyJson: log.why,
    status: 'success'
  }).run();
}

export function getRecentDecisions(limit: number): DecisionLog[] {
  const rows = db.select().from(schema.decisionLogs).orderBy(desc(schema.decisionLogs.timestamp)).limit(limit).all();
  return rows.map(r => ({
    id: r.id,
    requestId: r.requestId,
    userId: r.userId || 'anonymous',
    timestamp: new Date(r.timestamp),
    originalModel: r.originalModel || '',
    provider: r.routedProvider || '',
    routedModel: r.routedModel || '',
    reasonCode: r.reasonCode || '',
    inputTokens: r.inputTokens || 0,
    outputTokens: r.outputTokens || 0,
    actualCostUSD: r.actualCostUsd || 0,
    baselineCostUSD: r.baselineCostUsd || 0,
    savingsUSD: r.savingsUsd || 0,
    latencyMs: r.latencyMs || 0,
    why: r.whyJson || ''
  }));
}

export function getTotalSavings(): { totalSavings: number; totalCost: number; requestCount: number } {
  const result = db.select({
    totalSavings: sum(schema.decisionLogs.savingsUsd),
    totalCost: sum(schema.decisionLogs.actualCostUsd),
    requestCount: count()
  }).from(schema.decisionLogs).get();

  return {
    totalSavings: result?.totalSavings ? Number(result.totalSavings) : 0,
    totalCost: result?.totalCost ? Number(result.totalCost) : 0,
    requestCount: result?.requestCount ? Number(result.requestCount) : 0
  };
}

export interface BudgetState {
  id: string;
  dailyBudgetUsd: number;
  spentTodayUsd: number;
  spentTotalUsd: number;
  resetDate: string | null;
  updatedAt: number | null;
}

export function getBudgetState(): BudgetState {
  let state = db.select().from(schema.budgetState).where(eq(schema.budgetState.id, 'singleton')).get();
  if (!state) {
    db.insert(schema.budgetState).values({
      id: 'singleton',
      dailyBudgetUsd: 5.0,
      spentTodayUsd: 0,
      spentTotalUsd: 0,
      resetDate: new Date().toISOString(),
      updatedAt: Date.now()
    }).run();
    state = db.select().from(schema.budgetState).where(eq(schema.budgetState.id, 'singleton')).get();
  }
  
  return {
    id: state!.id,
    dailyBudgetUsd: state!.dailyBudgetUsd || 0,
    spentTodayUsd: state!.spentTodayUsd || 0,
    spentTotalUsd: state!.spentTotalUsd || 0,
    resetDate: state!.resetDate,
    updatedAt: state!.updatedAt
  };
}

export function updateBudgetSpent(amountUSD: number): void {
  const state = getBudgetState();
  const today = new Date().toISOString().split('T')[0];
  const resetDate = state.resetDate?.split('T')[0];
  
  let newSpentToday = state.spentTodayUsd + amountUSD;
  if (today !== resetDate) {
    newSpentToday = amountUSD; // reset for new day
  }

  db.update(schema.budgetState)
    .set({
      spentTodayUsd: newSpentToday,
      spentTotalUsd: state.spentTotalUsd + amountUSD,
      resetDate: new Date().toISOString(),
      updatedAt: Date.now()
    })
    .where(eq(schema.budgetState.id, 'singleton'))
    .run();
}

export function updateProviderHealth(provider: string, healthy: boolean, error?: string): void {
  const existing = db.select().from(schema.providerHealth).where(eq(schema.providerHealth.provider, provider)).get();
  if (existing) {
    db.update(schema.providerHealth).set({
      isHealthy: healthy ? 1 : 0,
      lastError: error || null,
      checkedAt: Date.now()
    }).where(eq(schema.providerHealth.provider, provider)).run();
  } else {
    db.insert(schema.providerHealth).values({
      provider,
      isHealthy: healthy ? 1 : 0,
      lastError: error || null,
      checkedAt: Date.now()
    }).run();
  }
}
