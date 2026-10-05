-- Display names the base seed (seed.sql, from the ECI LS 2024 files) wrote in ECI's form. Fill-only: changes a name only
-- while it is still the old value, so an admin edit is kept. Idempotent.
UPDATE states SET name = 'Delhi' WHERE id = 24 AND code = 'DL' AND name = 'NCT OF Delhi';
