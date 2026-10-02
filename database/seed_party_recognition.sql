-- ECI recognition for the national parties. Fills `parties.eci_recognition` only where it is empty
-- (NULL), and only for party ids that exist.
-- Run once (seed_runs, migration 018): setup.sh re-runs every seed, so after the first run a value set or
-- cleared ("Not set") in the admin is kept. On a database that ran this file before seed_runs existed it
-- runs one last time, which can refill a value cleared in the admin.
-- A row added here later is never applied where this file has run: put it in a new seed with its own marker.
-- Source: Election Commission of India list of recognised national parties.
BEGIN;

SELECT NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_party_recognition') AS seed_apply \gset
\if :seed_apply

UPDATE parties p
SET eci_recognition = 'National'
WHERE p.eci_recognition IS NULL
  AND p.id IN ('BJP', 'INC', 'BSP', 'CPIM', 'AAP', 'NPP');

\endif
INSERT INTO seed_runs (name) VALUES ('seed_party_recognition') ON CONFLICT (name) DO NOTHING;

COMMIT;
