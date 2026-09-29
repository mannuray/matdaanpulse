-- Migration 011: Indexes declared in backend/prisma/schema.prisma but never created by SQL
-- Keeps the SQL-built database in sync with the Prisma datamodel (no `prisma migrate diff` drift).

CREATE INDEX IF NOT EXISTS idx_candidates_person_id
  ON candidates(person_id);

-- Top-N / ranking queries: results for an election or constituency ordered by votes
CREATE INDEX IF NOT EXISTS idx_results_election_votes
  ON results(election_id, votes DESC);

CREATE INDEX IF NOT EXISTS idx_results_const_votes
  ON results(const_id, votes DESC);
