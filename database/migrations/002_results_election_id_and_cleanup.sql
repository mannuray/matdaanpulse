-- Migration 002: Add results.election_id FK, drop redundant indexes
-- Eliminates the extra join through candidates on every results query

BEGIN;

-- ============================================================
-- 1. Add election_id to results (denormalized from candidates)
-- ============================================================

ALTER TABLE results
  ADD COLUMN election_id UUID;

-- Backfill from candidates
UPDATE results r
  SET election_id = c.election_id
  FROM candidates c
  WHERE r.candidate_id = c.id;

-- Now make it NOT NULL + add FK
ALTER TABLE results
  ALTER COLUMN election_id SET NOT NULL;

ALTER TABLE results
  ADD CONSTRAINT fk_results_election
  FOREIGN KEY (election_id) REFERENCES elections(id);

CREATE INDEX idx_results_election_id
  ON results(election_id);

-- Compound index for the hot query: all results for an election filtered by status
CREATE INDEX idx_results_election_status
  ON results(election_id, status);

-- ============================================================
-- 2. Drop redundant single-column indexes
-- ============================================================

-- idx_candidates_election_id is covered by idx_candidates_election_const(election_id, const_id)
DROP INDEX IF EXISTS idx_candidates_election_id;

-- idx_results_const_id is covered by idx_results_const_status(const_id, status)
DROP INDEX IF EXISTS idx_results_const_id;

COMMIT;
