-- Migration 020: live results ingest (spec docs/superpowers/specs/2026-10-03-live-ingest-design.md §3).
--   election_ingest     per election: active source (NULL = paused) and hold minutes
--   ingest_keys         machine keys (sha256 of the key; the key itself is shown once)
--   ingest_shards       named seat sets per election, each with a lease; the "rest" shard is implicit (no row)
--   seat_ingest_state   per seat: state, round, last source and observation time (freshness)
--   seat_holds          admin corrections holding a seat until a later round or expiry
--   ingest_log          one row per ingest request (30-day retention by the app)
--   Live version: bumped by seat_ingest_state changes (state / rounds) and elections.status changes.
BEGIN;

CREATE TABLE IF NOT EXISTS election_ingest (
    election_id   UUID PRIMARY KEY REFERENCES elections(id) ON DELETE CASCADE,
    active_source TEXT,
    hold_minutes  INT NOT NULL DEFAULT 10 CHECK (hold_minutes BETWEEN 1 AND 240),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ingest_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(80) NOT NULL UNIQUE,
    key_hash     CHAR(64) NOT NULL UNIQUE,
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ingest_shards (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id      UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    name             VARCHAR(40) NOT NULL CHECK (name ~ '^[a-z0-9][a-z0-9_-]*$' AND name <> 'rest'),
    source_override  TEXT,
    selector         JSONB NOT NULL,
    lease_holder     TEXT,
    lease_key_id     UUID REFERENCES ingest_keys(id) ON DELETE SET NULL,
    lease_expires_at TIMESTAMPTZ,
    UNIQUE (election_id, name)
);

-- The implicit "rest" shard's lease and source override live on election_ingest.
ALTER TABLE election_ingest ADD COLUMN IF NOT EXISTS rest_source_override TEXT;
ALTER TABLE election_ingest ADD COLUMN IF NOT EXISTS rest_lease_holder TEXT;
ALTER TABLE election_ingest ADD COLUMN IF NOT EXISTS rest_lease_key_id UUID REFERENCES ingest_keys(id) ON DELETE SET NULL;
ALTER TABLE election_ingest ADD COLUMN IF NOT EXISTS rest_lease_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS seat_ingest_state (
    election_id      UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    const_id         VARCHAR(100) NOT NULL REFERENCES constituencies(id) ON DELETE CASCADE,
    state            TEXT NOT NULL CHECK (state IN ('not_started','counting','declared','countermanded','adjourned')),
    round_current    INT,
    round_total      INT,
    last_source      TEXT,
    last_observed_at TIMESTAMPTZ,
    last_applied_at  TIMESTAMPTZ,
    PRIMARY KEY (election_id, const_id)
);

CREATE TABLE IF NOT EXISTS seat_holds (
    election_id   UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    const_id      VARCHAR(100) NOT NULL REFERENCES constituencies(id) ON DELETE CASCADE,
    round_at_hold INT,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (election_id, const_id)
);

CREATE TABLE IF NOT EXISTS ingest_log (
    id          BIGSERIAL PRIMARY KEY,
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    shard       VARCHAR(40) NOT NULL,
    key_id      UUID REFERENCES ingest_keys(id) ON DELETE SET NULL,
    source      TEXT NOT NULL,
    dry_run     BOOLEAN NOT NULL DEFAULT false,
    kind        TEXT NOT NULL DEFAULT 'seats' CHECK (kind IN ('seats','tally')),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    observed_at TIMESTAMPTZ,
    counts      JSONB NOT NULL DEFAULT '{}',
    rejected    JSONB NOT NULL DEFAULT '[]',
    tally_mismatch JSONB
);
CREATE INDEX IF NOT EXISTS ingest_log_election_received ON ingest_log (election_id, received_at DESC);

-- Live version: seat state / rounds and election status are part of what viewers see.
CREATE OR REPLACE FUNCTION bump_live_version_ingest() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    ids UUID[];
BEGIN
    CASE TG_ARGV[0]
    WHEN 'seat_rows' THEN
        SELECT array_agg(DISTINCT r.election_id) INTO ids FROM changed_rows r;
    WHEN 'seat_upd' THEN
        SELECT array_agg(DISTINCT n.election_id) INTO ids
        FROM new_rows n JOIN old_rows o ON o.election_id = n.election_id AND o.const_id = n.const_id
        WHERE (n.state, n.round_current, n.round_total) IS DISTINCT FROM (o.state, o.round_current, o.round_total);
    WHEN 'election_upd' THEN
        SELECT array_agg(DISTINCT n.id) INTO ids
        FROM new_rows n JOIN old_rows o ON o.id = n.id
        WHERE n.status IS DISTINCT FROM o.status;
    ELSE
        RAISE EXCEPTION 'bump_live_version_ingest: unknown mode %', TG_ARGV[0];
    END CASE;
    IF ids IS NOT NULL THEN
        PERFORM bump_election_live_versions(ids);
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS seat_ingest_state_live_ins ON seat_ingest_state;
CREATE TRIGGER seat_ingest_state_live_ins
    AFTER INSERT ON seat_ingest_state REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_live_version_ingest('seat_rows');
DROP TRIGGER IF EXISTS seat_ingest_state_live_upd ON seat_ingest_state;
CREATE TRIGGER seat_ingest_state_live_upd
    AFTER UPDATE ON seat_ingest_state REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_live_version_ingest('seat_upd');
DROP TRIGGER IF EXISTS seat_ingest_state_live_del ON seat_ingest_state;
CREATE TRIGGER seat_ingest_state_live_del
    AFTER DELETE ON seat_ingest_state REFERENCING OLD TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_live_version_ingest('seat_rows');
DROP TRIGGER IF EXISTS elections_status_live_upd ON elections;
CREATE TRIGGER elections_status_live_upd
    AFTER UPDATE ON elections REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_live_version_ingest('election_upd');

COMMIT;
