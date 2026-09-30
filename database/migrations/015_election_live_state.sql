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
-- may still hold under an immutable URL. After a restore / PITR run:
--   UPDATE election_live_state SET version = GREATEST(version + 1, (extract(epoch FROM clock_timestamp()) * 1000)::bigint);
--
-- UPDATE triggers compare old and new rows and bump only when a column that
-- appears in snapshots changed (e.g. the party-symbol seed does not bump).
--
-- Idempotent; no seed dependency (rows are created by the triggers or on first read).
-- Runs in one transaction and uses CREATE OR REPLACE TRIGGER (PostgreSQL 14+;
-- local 15, Neon 15+), so a re-run (setup.sh on every deploy) never leaves a
-- moment without triggers.

BEGIN;

CREATE TABLE IF NOT EXISTS election_live_state (
    election_id UUID PRIMARY KEY REFERENCES elections(id) ON DELETE CASCADE,
    version     BIGINT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upsert-bump a set of elections; rows are locked in election_id order (no deadlocks
-- between concurrent statements touching overlapping elections).
CREATE OR REPLACE FUNCTION bump_election_live_versions(ids UUID[]) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    now_ms BIGINT := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
BEGIN
    INSERT INTO election_live_state AS s (election_id, version, updated_at)
    SELECT e, now_ms, now()
    FROM (SELECT DISTINCT unnest(ids) AS e) d
    WHERE e IS NOT NULL
    ORDER BY e
    ON CONFLICT (election_id) DO UPDATE
        SET version = GREATEST(s.version + 1, EXCLUDED.version), updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION bump_election_live_version() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    ids UUID[];
BEGIN
    CASE TG_ARGV[0]
    WHEN 'rows' THEN
        -- results INSERT / DELETE (and the pre-fix-round single-table triggers): rows carry election_id.
        SELECT array_agg(DISTINCT r.election_id) INTO ids FROM changed_rows r;
    WHEN 'results_upd' THEN
        SELECT array_agg(DISTINCT e) INTO ids FROM (
            SELECT n.election_id AS e FROM new_rows n JOIN old_rows o ON o.id = n.id
            WHERE (n.votes, n.status, n.margin, n.candidate_id, n.const_id, n.election_id)
                  IS DISTINCT FROM (o.votes, o.status, o.margin, o.candidate_id, o.const_id, o.election_id)
            UNION
            SELECT o.election_id FROM new_rows n JOIN old_rows o ON o.id = n.id
            WHERE n.election_id IS DISTINCT FROM o.election_id
        ) x;
    WHEN 'candidates_upd' THEN
        SELECT array_agg(DISTINCT n.election_id) INTO ids
        FROM new_rows n JOIN old_rows o ON o.id = n.id
        WHERE (n.name, n.party_id) IS DISTINCT FROM (o.name, o.party_id);
    WHEN 'constituencies_upd' THEN
        SELECT array_agg(DISTINCT n.election_id) INTO ids
        FROM new_rows n JOIN old_rows o ON o.id = n.id
        WHERE n.type IS DISTINCT FROM o.type;
    WHEN 'parties_upd' THEN
        -- Party name/colour appear in snapshot tallies: bump every election that uses the party.
        SELECT array_agg(DISTINCT c.election_id) INTO ids
        FROM candidates c
        JOIN new_rows n ON c.party_id = n.id
        JOIN old_rows o ON o.id = n.id
        WHERE (n.name, n.color) IS DISTINCT FROM (o.name, o.color);
    ELSE
        RAISE EXCEPTION 'bump_election_live_version: unknown mode %', TG_ARGV[0];
    END CASE;
    IF ids IS NOT NULL THEN
        PERFORM bump_election_live_versions(ids);
    END IF;
    RETURN NULL;
END;
$$;

-- Transition tables allow one event per trigger, hence one trigger per event.
CREATE OR REPLACE TRIGGER trg_results_live_version_ins
    AFTER INSERT ON results REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_election_live_version('rows');

CREATE OR REPLACE TRIGGER trg_results_live_version_upd
    AFTER UPDATE ON results REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_election_live_version('results_upd');

CREATE OR REPLACE TRIGGER trg_results_live_version_del
    AFTER DELETE ON results REFERENCING OLD TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_election_live_version('rows');

-- Candidate names/parties are part of the snapshot rows.
CREATE OR REPLACE TRIGGER trg_candidates_live_version_upd
    AFTER UPDATE ON candidates REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_election_live_version('candidates_upd');

-- Constituency type is in the snapshot rows (const_type).
CREATE OR REPLACE TRIGGER trg_constituencies_live_version_upd
    AFTER UPDATE ON constituencies REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_election_live_version('constituencies_upd');

CREATE OR REPLACE TRIGGER trg_parties_live_version_upd
    AFTER UPDATE ON parties REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_election_live_version('parties_upd');

COMMIT;
