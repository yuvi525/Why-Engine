CREATE TABLE org_policies (
    org_id UUID PRIMARY KEY REFERENCES organizations(id),
    max_input_tokens INTEGER,
    max_output_tokens INTEGER,
    allowed_models JSONB,
    blocked_task_types JSONB,
    pii_detection BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE guardrail_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id),
    request_id UUID,
    guardrail_type TEXT,
    action_taken TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
