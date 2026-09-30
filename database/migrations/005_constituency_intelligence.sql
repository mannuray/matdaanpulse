-- Migration 005: Constituency Intelligence System
-- Adds metadata JSONB to constituencies + pre-computed analysis table

-- Add metadata JSONB to constituencies (for manual tags, region)
ALTER TABLE constituencies ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Pre-computed constituency analysis (one row per constituency per election)
CREATE TABLE IF NOT EXISTS constituency_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    const_id VARCHAR(100) NOT NULL REFERENCES constituencies(id),
    election_id UUID NOT NULL REFERENCES elections(id),

    -- Historical analysis (auto-computed from past results)
    dominance VARCHAR(20),
    dominance_party VARCHAR(20),
    incumbency JSONB DEFAULT '{}',

    -- AI-generated content
    ai_briefing TEXT,
    ai_demographics JSONB,
    ai_key_issues TEXT[],
    ai_generated_at TIMESTAMP,
    ai_status VARCHAR(20) DEFAULT 'pending',

    -- Manual overrides
    notes TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(const_id, election_id)
);

CREATE INDEX IF NOT EXISTS idx_const_analysis_election ON constituency_analysis(election_id);
-- ai_status is dropped again by migration 014; only index it while it exists so re-runs stay idempotent.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'constituency_analysis' AND column_name = 'ai_status') THEN
        CREATE INDEX IF NOT EXISTS idx_const_analysis_status ON constituency_analysis(ai_status);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_const_analysis_const ON constituency_analysis(const_id);
