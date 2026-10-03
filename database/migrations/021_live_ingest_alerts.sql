-- Migration 021: live ingest alert gaps (final review of the live ingest feature).
--   ingest_log.refused                 a request refused as a whole (no_lease / inactive_source / not_live); counts stay {}
--   seat_ingest_state.last_rejected_*  the seat's current rejection (cleared when the seat is next applied or unchanged)
--   seat_ingest_state.state            nullable: a seat rejected before it was ever applied has a row with no state yet
--   bump_live_version_ingest           rows without a state are not part of what viewers see, so they bump nothing
BEGIN;

ALTER TABLE ingest_log ADD COLUMN IF NOT EXISTS refused TEXT;

ALTER TABLE seat_ingest_state ADD COLUMN IF NOT EXISTS last_rejected_reason TEXT;
ALTER TABLE seat_ingest_state ADD COLUMN IF NOT EXISTS last_rejected_at TIMESTAMPTZ;
ALTER TABLE seat_ingest_state ALTER COLUMN state DROP NOT NULL;

CREATE OR REPLACE FUNCTION bump_live_version_ingest() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    ids UUID[];
BEGIN
    CASE TG_ARGV[0]
    WHEN 'seat_rows' THEN
        SELECT array_agg(DISTINCT r.election_id) INTO ids FROM changed_rows r WHERE r.state IS NOT NULL;
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

COMMIT;
