CREATE TABLE distillation_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_hash TEXT NOT NULL,
    example_prompt TEXT,
    example_response TEXT,
    frequency_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
