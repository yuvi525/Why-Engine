CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    daily_budget_usd NUMERIC(10,4),
    monthly_budget_usd NUMERIC(10,4),
    preferred_provider TEXT,
    alert_webhook_url TEXT,
    stripe_customer_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    label TEXT,
    rate_limit_rpm INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimize routing lookups
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_organizations_stripe ON organizations(stripe_customer_id);
