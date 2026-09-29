-- West Bengal: Districts, Regions, and constituency assignments
-- Applied by database/setup.sh after the VS result seeds. Constituency UPDATEs are scoped to
-- VS elections: VS const_no ranges must never tag Lok Sabha seats (whose const_no overlaps).

-- Districts (23)
INSERT INTO districts (state_id, name, code) VALUES (36, 'Cooch Behar', 'WB_COOCHBEHAR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Alipurduar', 'WB_ALIPURDUAR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Jalpaiguri', 'WB_JALPAIGURI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Kalimpong', 'WB_KALIMPONG') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Darjeeling', 'WB_DARJEELING') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Uttar Dinajpur', 'WB_UTTARDINAJPUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Dakshin Dinajpur', 'WB_DAKSHINDINAJPUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Maldah', 'WB_MALDAH') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Murshidabad', 'WB_MURSHIDABAD') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Nadia', 'WB_NADIA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'North 24 Parganas', 'WB_NORTH24PGS') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'South 24 Parganas', 'WB_SOUTH24PGS') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Kolkata', 'WB_KOLKATA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Howrah', 'WB_HOWRAH') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Hooghly', 'WB_HOOGHLY') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Purba Medinipur', 'WB_PURBAMEDINIPUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Paschim Medinipur', 'WB_PASCHIMMEDINIPUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Jhargram', 'WB_JHARGRAM') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Purulia', 'WB_PURULIA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Bankura', 'WB_BANKURA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Purba Bardhaman', 'WB_PURBABARDHAMAN') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Paschim Bardhaman', 'WB_PASCHIMBARDHAMAN') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (36, 'Birbhum', 'WB_BIRBHUM') ON CONFLICT (code) DO NOTHING;

-- Regions (8)
-- North Bengal Hills: Darjeeling, Kalimpong
-- North Bengal Plains: Cooch Behar, Alipurduar, Jalpaiguri
-- Malda-Dinajpur: Maldah, Uttar Dinajpur, Dakshin Dinajpur
-- Murshidabad-Nadia: Murshidabad, Nadia
-- Kolkata-Howrah: Kolkata, Howrah, Hooghly
-- South Bengal: North 24 Parganas, South 24 Parganas
-- Rarh-Burdwan: Purba Bardhaman, Paschim Bardhaman, Birbhum
-- Junglemahal: Bankura, Purulia, Paschim Medinipur, Jhargram, Purba Medinipur
INSERT INTO regions (state_id, name, code) VALUES (36, 'North Bengal Hills', 'WB_HILLS') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (36, 'North Bengal Plains', 'WB_NORTHPLAINS') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (36, 'Malda-Dinajpur', 'WB_MALDADINAJPUR') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (36, 'Murshidabad-Nadia', 'WB_GANGETIC') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (36, 'Kolkata-Howrah', 'WB_KOLKATAHOWRAH') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (36, 'South Bengal', 'WB_SOUTHBENGAL') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (36, 'Rarh-Burdwan', 'WB_RAHRBARDHAMAN') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (36, 'Junglemahal', 'WB_JUNGLEMAHAL') ON CONFLICT (state_id, code) DO NOTHING;

-- Assign district_id to WB constituencies (all elections, by const_no)
-- 1-9: Cooch Behar
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_COOCHBEHAR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 1 AND 9;
-- 10-14: Alipurduar
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_ALIPURDUAR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 10 AND 14;
-- 15-21: Jalpaiguri
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_JALPAIGURI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 15 AND 21;
-- 22: Kalimpong
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_KALIMPONG') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no = 22;
-- 23-27: Darjeeling
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_DARJEELING') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 23 AND 27;
-- 28-36: Uttar Dinajpur
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_UTTARDINAJPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 28 AND 36;
-- 37-42: Dakshin Dinajpur
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_DAKSHINDINAJPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 37 AND 42;
-- 43-54: Maldah
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_MALDAH') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 43 AND 54;
-- 55-76: Murshidabad
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_MURSHIDABAD') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 55 AND 76;
-- 77-93: Nadia
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_NADIA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 77 AND 93;
-- 94-126: North 24 Parganas
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_NORTH24PGS') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 94 AND 126;
-- 127-157: South 24 Parganas
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_SOUTH24PGS') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 127 AND 157;
-- 158-168: Kolkata
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_KOLKATA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 158 AND 168;
-- 169-184: Howrah
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_HOWRAH') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 169 AND 184;
-- 185-202: Hooghly
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_HOOGHLY') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 185 AND 202;
-- 203-218: Purba Medinipur
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_PURBAMEDINIPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 203 AND 218;
-- 219, 223-236: Paschim Medinipur (non-contiguous due to Jhargram carve-out)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_PASCHIMMEDINIPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no = 219;
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_PASCHIMMEDINIPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 223 AND 236;
-- 220-222, 237: Jhargram (non-contiguous)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_JHARGRAM') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 220 AND 222;
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_JHARGRAM') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no = 237;
-- 238-246: Purulia
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_PURULIA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 238 AND 246;
-- 247-258: Bankura
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_BANKURA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 247 AND 258;
-- 259-274: Purba Bardhaman
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_PURBABARDHAMAN') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 259 AND 274;
-- 275-283: Paschim Bardhaman
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_PASCHIMBARDHAMAN') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 275 AND 283;
-- 284-294: Birbhum
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'WB_BIRBHUM') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 284 AND 294;

-- Assign region_id to WB constituencies via district grouping
-- North Bengal Hills: Kalimpong (22), Darjeeling (23-27)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'WB_HILLS') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no = 22;
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'WB_HILLS') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 23 AND 27;

-- North Bengal Plains: Cooch Behar (1-9), Alipurduar (10-14), Jalpaiguri (15-21)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'WB_NORTHPLAINS') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 1 AND 21;

-- Malda-Dinajpur: Uttar Dinajpur (28-36), Dakshin Dinajpur (37-42), Maldah (43-54)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'WB_MALDADINAJPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 28 AND 54;

-- Murshidabad-Nadia: Murshidabad (55-76), Nadia (77-93)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'WB_GANGETIC') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 55 AND 93;

-- South Bengal: North 24 Parganas (94-126), South 24 Parganas (127-157)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'WB_SOUTHBENGAL') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 94 AND 157;

-- Kolkata-Howrah: Kolkata (158-168), Howrah (169-184), Hooghly (185-202)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'WB_KOLKATAHOWRAH') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 158 AND 202;

-- Junglemahal: Purba Medinipur (203-218), Paschim Medinipur (219,223-236), Jhargram (220-222,237), Purulia (238-246), Bankura (247-258)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'WB_JUNGLEMAHAL') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 203 AND 258;

-- Rarh-Burdwan: Purba Bardhaman (259-274), Paschim Bardhaman (275-283), Birbhum (284-294)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'WB_RAHRBARDHAMAN') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 36 AND const_no BETWEEN 259 AND 294;
