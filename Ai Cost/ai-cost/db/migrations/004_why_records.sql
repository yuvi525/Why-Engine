CREATE TABLE why_records (
    request_id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    routing_reason TEXT,
    savings_reason TEXT,
    risk_note TEXT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
