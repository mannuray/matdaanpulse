-- Migration 002: Add results.election_id FK, drop redundant indexes
-- Eliminates the extra join through candidates on every results query
-- Idempotent: a no-op on a fresh database built from schema.sql (which already has the column).

BEGIN;

-- ============================================================
-- 1. Add election_id to results (denormalized from candidates)
-- ============================================================

ALTER TABLE results
  ADD COLUMN IF NOT EXISTS election_id UUID;

-- Backfill from candidates
UPDATE results r
  SET election_id = c.election_id
  FROM candidates c
  WHERE r.candidate_id = c.id
    AND r.election_id IS NULL;

-- Now make it NOT NULL + add FK
ALTER TABLE results
  ALTER COLUMN election_id SET NOT NULL;

-- Databases built from an older schema.sql have this FK under the auto-generated name
-- results_election_id_fkey: rename it rather than adding a duplicate FK.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_results_election') THEN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'results_election_id_fkey'
                 AND conrelid = 'results'::regclass) THEN
      ALTER TABLE results RENAME CONSTRAINT results_election_id_fkey TO fk_results_election;
    ELSE
      ALTER TABLE results
        ADD CONSTRAINT fk_results_election
        FOREIGN KEY (election_id) REFERENCES elections(id);
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_results_election_id
  ON results(election_id);

-- Compound index for the hot query: all results for an election filtered by status
CREATE INDEX IF NOT EXISTS idx_results_election_status
  ON results(election_id, status);

-- ============================================================
-- 2. Drop redundant single-column indexes
-- ============================================================

-- idx_candidates_election_id is covered by idx_candidates_election_const(election_id, const_id)
DROP INDEX IF EXISTS idx_candidates_election_id;

-- idx_results_const_id is covered by idx_results_const_status(const_id, status)
DROP INDEX IF EXISTS idx_results_const_id;

COMMIT;
