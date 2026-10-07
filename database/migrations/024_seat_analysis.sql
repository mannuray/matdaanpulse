-- 024: seat analysis rework (spec docs/superpowers/specs/2026-10-07-seat-analysis-design.md §4.4).
-- constituency_analysis.data holds the shared module's SeatAnalysis; `incumbency` is no longer written (dropped by a
-- later migration). election_analysis holds the per-election ElectionAnalysis, and `baseline` (Phase B) the
-- pre-counting baseline.
ALTER TABLE constituency_analysis ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE constituency_analysis ADD COLUMN IF NOT EXISTS schema_version SMALLINT;
ALTER TABLE constituency_analysis ADD COLUMN IF NOT EXISTS computed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS election_analysis (
  election_id    UUID PRIMARY KEY REFERENCES elections(id) ON DELETE CASCADE,
  data           JSONB NOT NULL,
  baseline       JSONB,
  schema_version SMALLINT NOT NULL,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
