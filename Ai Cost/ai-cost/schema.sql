-- Supabase Full Database Schema
-- Run this completely in your Supabase SQL Editor

-- 1. Orgs and Memberships
CREATE TABLE IF NOT EXISTS orgs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  plan       text NOT NULL DEFAULT 'free',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid REFERENCES orgs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  role       text NOT NULL DEFAULT 'owner',
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- 2. API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES orgs(id) ON DELETE CASCADE,
  key_hash    text NOT NULL UNIQUE,
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  last_used   timestamptz
);

CREATE TABLE IF NOT EXISTS api_key_usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id      uuid REFERENCES api_keys(id) ON DELETE CASCADE,
  org_id      uuid REFERENCES orgs(id) ON DELETE CASCADE,
  request_time timestamptz DEFAULT now(),
  cost        numeric DEFAULT 0
);

-- 3. Core Tables (Logs & Alerts)
CREATE TABLE IF NOT EXISTS why_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES orgs(id),
  request_id    text,
  model         text NOT NULL,
  tokens        integer DEFAULT 0,
  cost          numeric DEFAULT 0,
  provider      text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS savings_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES orgs(id),
  amount        numeric DEFAULT 0,
  reason        text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES orgs(id),
  user_id       uuid,
  action        text NOT NULL,
  entity        text NOT NULL,
  details       jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES orgs(id),
  level         text NOT NULL,
  message       text NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- 4. Budgets and Approvals
CREATE TABLE IF NOT EXISTS budget_policies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES orgs(id) ON DELETE CASCADE,
  project_id    text,
  limit_amount  numeric NOT NULL,
  action        text NOT NULL DEFAULT 'alert',
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approvals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES orgs(id),
  request_id    text NOT NULL,
  status        text NOT NULL DEFAULT 'pending',
  cost_estimate numeric,
  created_at    timestamptz DEFAULT now()
);

-- 5. Autopilot
CREATE TABLE IF NOT EXISTS autopilot_configs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES orgs(id) ON DELETE CASCADE,
  enabled       boolean DEFAULT true,
  settings      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS autopilot_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES orgs(id) ON DELETE CASCADE,
  rule_type     text NOT NULL,
  threshold     numeric NOT NULL,
  action        text NOT NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS autopilot_actions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES orgs(id),
  rule_id       uuid REFERENCES autopilot_rules(id),
  action_type   text NOT NULL,
  status        text NOT NULL DEFAULT 'completed',
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS autopilot_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES orgs(id),
  action        text NOT NULL,
  result        jsonb,
  created_at    timestamptz DEFAULT now()
);

-- 6. Added Missing System Tables (Usage, Analysis, Cron, Settings)
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text,
  project_id    text,
  feature       text,
  model         text NOT NULL,
  original_model text,
  routed_model  text,
  routing_mode  text,
  input_tokens  integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  total_tokens  integer DEFAULT 0,
  cost_usd      numeric(12,8) DEFAULT 0,
  savings_usd   numeric(12,8) DEFAULT 0,
  latency_ms    integer DEFAULT 0,
  session_id    text,
  cost          numeric(12,8) DEFAULT 0,
  tokens        integer DEFAULT 0,
  org_id        uuid,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analysis_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    text NOT NULL,
  anomaly_type  text,
  priority      text,
  why           text,
  impact        text,
  action        jsonb,
  decision      text,
  confidence    numeric,
  total_cost    numeric(12,8),
  estimated_savings numeric(12,8),
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anomaly_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    text,
  type          text,
  severity      text,
  details       jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    text,
  payload       jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL UNIQUE,
  preferences   jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cron_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name      text NOT NULL,
  status        text NOT NULL,
  summary       jsonb,
  created_at    timestamptz DEFAULT now()
);
