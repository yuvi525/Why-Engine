CREATE TABLE failed_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL,
    payload JSONB,
    error TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
