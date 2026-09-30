-- Migration 015: per-election live version (CDN-ready live, docs/DEPLOYMENT.md §2.2)
--
-- election_live_state.version is a monotonic per-election counter. Viewers poll
-- GET /elections/:id/live and fetch the snapshot GET /elections/:id/results?v=<version>,
-- which the CDN caches as immutable. The version must therefore change whenever
-- the data in a snapshot changes, whoever writes it (API overrides, the live
-- simulation's direct SQL, seeds, admin edits). Statement-level triggers bump it
-- inside the writing transaction, so a committed change and its new version
-- become visible together.
--
-- The value is GREATEST(version + 1, now in epoch milliseconds): it never
-- decreases, and a rebuilt database does not reuse version numbers that a CDN
-- may still hold under an immutable URL.
--
-- Idempotent; no seed dependency (rows are created by the triggers or on first read).

CREATE TABLE IF NOT EXISTS election_live_state (
    election_id UUID PRIMARY KEY REFERENCES elections(id) ON DELETE CASCADE,
    version     BIGINT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION bump_election_live_version() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    now_ms BIGINT := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
BEGIN
    IF TG_ARGV[0] = 'parties' THEN
        -- Party name/colour appear in snapshot tallies: bump every election that uses the party.
        INSERT INTO election_live_state AS s (election_id, version, updated_at)
        SELECT DISTINCT c.election_id, now_ms, now()
        FROM candidates c JOIN changed_rows p ON c.party_id = p.id
        ON CONFLICT (election_id) DO UPDATE
            SET version = GREATEST(s.version + 1, EXCLUDED.version), updated_at = now();
    ELSE
        -- results / candidates rows carry election_id directly.
        INSERT INTO election_live_state AS s (election_id, version, updated_at)
        SELECT DISTINCT r.election_id, now_ms, now()
        FROM changed_rows r
        WHERE r.election_id IS NOT NULL
        ON CONFLICT (election_id) DO UPDATE
            SET version = GREATEST(s.version + 1, EXCLUDED.version), updated_at = now();
    END IF;
    RETURN NULL;
END;
$$;

-- Transition tables allow one event per trigger, hence one trigger per event.
DROP TRIGGER IF EXISTS trg_results_live_version_ins ON results;
CREATE TRIGGER trg_results_live_version_ins
    AFTER INSERT ON results REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_election_live_version('results');

DROP TRIGGER IF EXISTS trg_results_live_version_upd ON results;
CREATE TRIGGER trg_results_live_version_upd
    AFTER UPDATE ON results REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_election_live_version('results');

DROP TRIGGER IF EXISTS trg_results_live_version_del ON results;
CREATE TRIGGER trg_results_live_version_del
    AFTER DELETE ON results REFERENCING OLD TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_election_live_version('results');

-- Candidate names are part of the snapshot rows.
DROP TRIGGER IF EXISTS trg_candidates_live_version_upd ON candidates;
CREATE TRIGGER trg_candidates_live_version_upd
    AFTER UPDATE ON candidates REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_election_live_version('candidates');

DROP TRIGGER IF EXISTS trg_parties_live_version_upd ON parties;
CREATE TRIGGER trg_parties_live_version_upd
    AFTER UPDATE ON parties REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_election_live_version('parties');
