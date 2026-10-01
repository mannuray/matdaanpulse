-- ECI recognition for the national parties. Sets `parties.eci_recognition` only where it is NULL,
-- so a value set in the admin is never overwritten, and only for party ids that exist. Safe to re-run.
-- Source: Election Commission of India list of recognised national parties.
UPDATE parties p
SET eci_recognition = 'National'
WHERE p.eci_recognition IS NULL
  AND p.id IN ('BJP', 'INC', 'BSP', 'CPIM', 'AAP', 'NPP');
