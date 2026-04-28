import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const decisionLogs = sqliteTable('decision_logs', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull(),
  userId: text('user_id').default('anonymous'),
  timestamp: integer('timestamp').notNull(),
  originalModel: text('original_model'),
  routedProvider: text('routed_provider'),
  routedModel: text('routed_model'),
  reasonCode: text('reason_code'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  actualCostUsd: real('actual_cost_usd'),
  baselineCostUsd: real('baseline_cost_usd'),
  savingsUsd: real('savings_usd'),
  latencyMs: integer('latency_ms'),
  whyJson: text('why_json'),
  status: text('status')
});

export const budgetState = sqliteTable('budget_state', {
  id: text('id').primaryKey(),
  dailyBudgetUsd: real('daily_budget_usd').default(5.0),
  spentTodayUsd: real('spent_today_usd').default(0),
  spentTotalUsd: real('spent_total_usd').default(0),
  resetDate: text('reset_date'),
  updatedAt: integer('updated_at')
});

export const providerHealth = sqliteTable('provider_health', {
  provider: text('provider').primaryKey(),
  isHealthy: integer('is_healthy').default(1),
  lastError: text('last_error'),
  checkedAt: integer('checked_at')
});
