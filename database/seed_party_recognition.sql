-- ECI recognition for the national parties. Fills `parties.eci_recognition` only where it is empty
-- (NULL), and only for party ids that exist. Safe to re-run: a value set in the admin is kept, but a
-- value cleared in the admin ("Not set") is filled again by the next setup.sh run.
-- Source: Election Commission of India list of recognised national parties.
UPDATE parties p
SET eci_recognition = 'National'
WHERE p.eci_recognition IS NULL
  AND p.id IN ('BJP', 'INC', 'BSP', 'CPIM', 'AAP', 'NPP');
