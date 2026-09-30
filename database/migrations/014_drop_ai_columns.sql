-- Migration 014: Remove built-in AI enrichment columns
-- The app no longer generates AI briefings (Gemini integration removed).
-- Keeps dominance, dominance_party, incumbency, notes. Idempotent; no seed dependency.
-- Dropping ai_status also drops idx_const_analysis_status; the explicit DROP INDEX
-- keeps re-runs and partially migrated databases tidy.

DROP INDEX IF EXISTS idx_const_analysis_status;

ALTER TABLE constituency_analysis
    DROP COLUMN IF EXISTS ai_briefing,
    DROP COLUMN IF EXISTS ai_demographics,
    DROP COLUMN IF EXISTS ai_key_issues,
    DROP COLUMN IF EXISTS ai_generated_at,
    DROP COLUMN IF EXISTS ai_status;
