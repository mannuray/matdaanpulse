-- Migration 001: Add missing indexes, unique constraints, and check constraints
-- Safe to run on existing data (uses IF NOT EXISTS / NOT VALID where possible)
-- Idempotent: constraints are only added when absent (checked by name).

BEGIN;

-- ============================================================
-- 1. COMPOUND INDEXES (query performance)
-- ============================================================

-- Candidates: fetching all candidates for a constituency in an election
CREATE INDEX IF NOT EXISTS idx_candidates_election_const
  ON candidates(election_id, const_id);

-- Results: filtering by status per constituency (WON/LEADING lookups)
CREATE INDEX IF NOT EXISTS idx_results_const_status
  ON results(const_id, status);

-- Elections: selector filters by type and sorts by year
CREATE INDEX IF NOT EXISTS idx_elections_type_year
  ON elections(type, year);

-- Audit logs: lookup history for a specific entity
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id);

-- ============================================================
-- 2. UNIQUE CONSTRAINTS (data integrity)
-- ============================================================

-- One result row per candidate per constituency
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_results_candidate_const') THEN
    ALTER TABLE results
      ADD CONSTRAINT uq_results_candidate_const
      UNIQUE (candidate_id, const_id);
  END IF;
END $$;

-- One candidate per party per constituency per election (excludes Independents —
-- multiple IND candidates per constituency is valid)
CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_election_const_party
  ON candidates(election_id, const_id, party_id)
  WHERE party_id <> 'IND';

-- NOTE: constituency const_no should be unique per (election_id, state_id, const_no)
-- but the LS seed data has numbering collisions (e.g. Ahmednagar & Aurangabad both #37
-- in Maharashtra). Skipping until seed data is corrected.
-- ALTER TABLE constituencies
--   ADD CONSTRAINT uq_constituencies_election_state_constno
--   UNIQUE (election_id, state_id, const_no);

-- Prevent duplicate elections (same type + state + year)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_elections_type_state_year') THEN
    ALTER TABLE elections
      ADD CONSTRAINT uq_elections_type_state_year
      UNIQUE (type, state_id, year);
  END IF;
END $$;

-- ============================================================
-- 3. CHECK CONSTRAINTS (domain rules)
-- ============================================================

-- Votes must be non-negative
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_results_votes_nonneg') THEN
    ALTER TABLE results
      ADD CONSTRAINT chk_results_votes_nonneg
      CHECK (votes >= 0) NOT VALID;
  END IF;
END $$;

-- NOTE: margin is negative for losers (how much they lost by) — this is
-- intentional in the data model, so no non-negative check here.

-- Turnout must be a valid percentage
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_constituencies_turnout_range') THEN
    ALTER TABLE constituencies
      ADD CONSTRAINT chk_constituencies_turnout_range
      CHECK (voter_turnout IS NULL OR voter_turnout BETWEEN 0 AND 100) NOT VALID;
  END IF;
END $$;

-- Electors must be non-negative
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_constituencies_electors_nonneg') THEN
    ALTER TABLE constituencies
      ADD CONSTRAINT chk_constituencies_electors_nonneg
      CHECK (total_electors IS NULL OR total_electors >= 0) NOT VALID;
  END IF;
END $$;

-- ============================================================
-- 4. VALIDATE NOT VALID CONSTRAINTS (background-safe)
-- Run these separately in low-traffic windows on large tables.
-- They acquire a SHARE UPDATE EXCLUSIVE lock (no writes blocked)
-- but do a full table scan.
-- ============================================================

ALTER TABLE results VALIDATE CONSTRAINT chk_results_votes_nonneg;
ALTER TABLE constituencies VALIDATE CONSTRAINT chk_constituencies_turnout_range;
ALTER TABLE constituencies VALIDATE CONSTRAINT chk_constituencies_electors_nonneg;

COMMIT;
