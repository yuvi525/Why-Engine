CREATE TABLE benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    global_avg_cost_per_request NUMERIC(10,4),
    global_avg_tokens_per_request INTEGER,
    global_cache_hit_rate NUMERIC(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
