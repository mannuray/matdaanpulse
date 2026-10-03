-- The delimitation (boundary set) of each seeded election: all of them were fought on the 2008 delimitation.
-- Fills only empty values, so a value set in the admin is kept. Assam's 2023 redraw applies from its 2026
-- election on, which is not seeded here. Lok Sabha 2029 is left empty on purpose: a national redraw may follow the
-- next census, so its boundaries are not known yet (empty compares with nothing); set it in the admin once known.
BEGIN;

UPDATE elections e
SET delimitation = d.delimitation
FROM (VALUES
  ('LS', NULL, 2024, '2008'),
  ('VS', 'BR', 2025, '2008'), ('VS', 'BR', 2020, '2008'), ('VS', 'BR', 2015, '2008'), ('VS', 'BR', 2010, '2008'),
  ('VS', 'AS', 2021, '2008'), ('VS', 'AS', 2016, '2008'), ('VS', 'AS', 2011, '2008'),
  ('VS', 'KL', 2021, '2008'), ('VS', 'KL', 2016, '2008'), ('VS', 'KL', 2011, '2008'),
  ('VS', 'PY', 2021, '2008'), ('VS', 'PY', 2016, '2008'), ('VS', 'PY', 2011, '2008'),
  ('VS', 'TN', 2021, '2008'), ('VS', 'TN', 2016, '2008'), ('VS', 'TN', 2011, '2008'),
  ('VS', 'WB', 2021, '2008'), ('VS', 'WB', 2016, '2008'), ('VS', 'WB', 2011, '2008')
) AS d(type, state_code, year, delimitation)
LEFT JOIN states s ON s.code = d.state_code
WHERE e.type = d.type::election_type
  AND e.year = d.year
  AND e.state_id IS NOT DISTINCT FROM s.id
  AND e.delimitation IS NULL;

COMMIT;
