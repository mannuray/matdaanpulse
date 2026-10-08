-- 026: ingest machine keys are scoped to one election and expire (security review 2026-10-08).
-- election_id NULL = a key created before this migration (accepted for any election); the admin API always sets it.
-- ON DELETE CASCADE, not SET NULL: deleting an election must never turn its keys into keys for every election.
-- expires_at NULL = never expires (legacy keys only; the admin API always sets it).
ALTER TABLE ingest_keys ADD COLUMN IF NOT EXISTS election_id UUID;
ALTER TABLE ingest_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ingest_keys_election_id_fkey') THEN
    ALTER TABLE ingest_keys ADD CONSTRAINT ingest_keys_election_id_fkey
      FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ingest_keys_election ON ingest_keys (election_id);
