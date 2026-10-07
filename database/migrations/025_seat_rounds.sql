-- 025: seat timeline + baseline bookkeeping (spec docs/superpowers/specs/2026-10-07-seat-analysis-design.md §5).
-- seat_rounds: one row per change of a seat's leader, runner-up, margin or declared state, appended in the same
-- transaction (under the same seat lock) as the results write, by the ingest and by admin seat corrections.
CREATE TABLE IF NOT EXISTS seat_rounds (
  election_id            UUID         NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  const_id               VARCHAR(100) NOT NULL REFERENCES constituencies(id) ON DELETE CASCADE,
  seq                    INTEGER      NOT NULL,
  round_no               INTEGER,
  round_total            INTEGER,
  leader_candidate_id    UUID,
  runner_up_candidate_id UUID,
  margin                 INTEGER,
  votes_counted          INTEGER      NOT NULL DEFAULT 0,
  declared               BOOLEAN      NOT NULL DEFAULT false,
  observed_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  source                 TEXT         NOT NULL,
  PRIMARY KEY (election_id, const_id, seq)
);
CREATE INDEX IF NOT EXISTS seat_rounds_latest ON seat_rounds (election_id, const_id, seq DESC);

-- An Upcoming election can have a baseline before any final analysis exists.
ALTER TABLE election_analysis ALTER COLUMN data DROP NOT NULL;
ALTER TABLE election_analysis ADD COLUMN IF NOT EXISTS baseline_computed_at TIMESTAMPTZ;
