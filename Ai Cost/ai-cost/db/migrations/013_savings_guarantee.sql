CREATE TABLE savings_guarantees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id),
    month DATE NOT NULL,
    guaranteed_savings_usd NUMERIC(10,2),
    actual_savings_usd NUMERIC(10,2),
    status TEXT, -- met, underperforming
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
