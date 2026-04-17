-- Puducherry: Districts, Regions, and constituency assignments
-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_py_districts_regions.sql

-- Districts (4 — Puducherry is a UT with 4 non-contiguous areas)
INSERT INTO districts (state_id, name, code) VALUES (27, 'Puducherry', 'PY_PUDUCHERRY') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (27, 'Karaikal', 'PY_KARAIKAL') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (27, 'Mahe', 'PY_MAHE') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (27, 'Yanam', 'PY_YANAM') ON CONFLICT (code) DO NOTHING;

-- Regions (2 — Puducherry region + Outlying territories)
INSERT INTO regions (state_id, name, code) VALUES (27, 'Puducherry', 'PY_PUDUCHERRY_REG') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (27, 'Outlying Districts', 'PY_OUTLYING') ON CONFLICT (state_id, code) DO NOTHING;

-- District assignments
-- ACs 1-24: Puducherry district (main territory, 24 seats near Pondicherry town)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'PY_PUDUCHERRY') WHERE state_id = 27 AND const_no BETWEEN 1 AND 24;
-- ACs 25-29: Karaikal district (5 seats)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'PY_KARAIKAL') WHERE state_id = 27 AND const_no BETWEEN 25 AND 29;
-- AC 30: Mahe (1 seat)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'PY_MAHE') WHERE state_id = 27 AND const_no = 30;
-- Yanam has no separate AC (included in Puducherry district ACs)

-- Region assignments
-- Puducherry region: ACs 1-24 (main territory)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'PY_PUDUCHERRY_REG') WHERE state_id = 27 AND const_no BETWEEN 1 AND 24;
-- Outlying: ACs 25-30 (Karaikal + Mahe)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'PY_OUTLYING') WHERE state_id = 27 AND const_no BETWEEN 25 AND 30;
