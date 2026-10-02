-- Result (counting) dates for the seeded elections. `elections.tentative_next_date` is the counting day:
-- the public site counts down to it and polls for the flip to Live around it; the admin labels it "Result date".
-- Fills only empty dates. Safe to re-run: a date set in the admin is kept, but a date cleared in the
-- admin is filled again by the next setup.sh run.
-- Sources: Election Commission of India result declarations.
UPDATE elections e
SET tentative_next_date = d.result_date
FROM (VALUES
  ('LS', NULL, 2024, DATE '2024-06-04'),
  ('VS', 'BR', 2025, DATE '2025-11-14'),
  ('VS', 'BR', 2020, DATE '2020-11-10'),
  ('VS', 'BR', 2015, DATE '2015-11-08'),
  ('VS', 'BR', 2010, DATE '2010-11-24'),
  ('VS', 'AS', 2021, DATE '2021-05-02'),
  ('VS', 'KL', 2021, DATE '2021-05-02'),
  ('VS', 'PY', 2021, DATE '2021-05-02'),
  ('VS', 'TN', 2021, DATE '2021-05-02'),
  ('VS', 'WB', 2021, DATE '2021-05-02'),
  ('VS', 'AS', 2016, DATE '2016-05-19'),
  ('VS', 'KL', 2016, DATE '2016-05-19'),
  ('VS', 'PY', 2016, DATE '2016-05-19'),
  ('VS', 'TN', 2016, DATE '2016-05-19'),
  ('VS', 'WB', 2016, DATE '2016-05-19'),
  ('VS', 'AS', 2011, DATE '2011-05-13'),
  ('VS', 'KL', 2011, DATE '2011-05-13'),
  ('VS', 'PY', 2011, DATE '2011-05-13'),
  ('VS', 'TN', 2011, DATE '2011-05-13'),
  ('VS', 'WB', 2011, DATE '2011-05-13')
) AS d(type, state_code, year, result_date)
LEFT JOIN states s ON s.code = d.state_code
WHERE e.type = d.type::election_type
  AND e.year = d.year
  AND e.state_id IS NOT DISTINCT FROM s.id
  AND e.tentative_next_date IS NULL;
