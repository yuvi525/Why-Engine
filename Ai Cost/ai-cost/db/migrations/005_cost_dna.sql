CREATE TABLE cost_dna_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id),
    top_expensive_task_types JSONB,
    model_distribution JSONB,
    cache_hit_rate NUMERIC(5,4),
    compression_rate NUMERIC(5,4),
    avg_tokens_per_request INTEGER,
    waste_score INTEGER,
    recommendations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
