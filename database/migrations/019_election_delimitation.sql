-- Migration 019: the delimitation each election was fought on, and versioned map files.
--
--   1. elections.delimitation: the boundary set (the year of the delimitation order, e.g. '2008', '2023') the
--      election's seats belong to. Seat history and the seat analysis link a seat across elections by state +
--      seat number, which is only meaningful within one delimitation: after a redraw (Assam 2023) seat #40 is
--      another place. They compare only elections of the same type, state and delimitation; NULL compares with
--      nothing (no history, never a wrong flip). Filled for the seeded elections by
--      seed_election_delimitation.sql; set it in the admin for a new election.
--   2. Map files are named per delimitation (/geo/<code>_ac_<era>.geojson, /geo/india_pc_<era>.geojson): every
--      file shipped so far is the 2008 delimitation. Rewrites the old paths in the manifests (text column),
--      leaving already-versioned paths alone, so it is idempotent and needs no seed data.
BEGIN;

ALTER TABLE elections ADD COLUMN IF NOT EXISTS delimitation VARCHAR(10);

UPDATE elections
SET manifest_url = regexp_replace(
      regexp_replace(manifest_url, '/geo/([a-z]+)_ac\.geojson', '/geo/\1_ac_2008.geojson', 'g'),
      '/geo/india_pc\.geojson', '/geo/india_pc_2008.geojson', 'g')
WHERE manifest_url ~ '/geo/([a-z]+_ac|india_pc)\.geojson';

COMMIT;
