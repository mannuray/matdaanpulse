-- Bihar: Districts, Regions, and constituency assignments
-- Applied by database/setup.sh after the VS result seeds. Constituency UPDATEs are scoped to
-- VS elections: VS const_no ranges must never tag Lok Sabha seats (whose const_no overlaps).

-- Districts (38)
INSERT INTO districts (state_id, name, code) VALUES (5, 'West Champaran', 'BR_WESTCHAMPARAN') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'East Champaran', 'BR_EASTCHAMPARAN') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Sheohar', 'BR_SHEOHAR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Sitamarhi', 'BR_SITAMARHI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Madhubani', 'BR_MADHUBANI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Supaul', 'BR_SUPAUL') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Araria', 'BR_ARARIA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Kishanganj', 'BR_KISHANGANJ') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Purnia', 'BR_PURNIA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Katihar', 'BR_KATIHAR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Madhepura', 'BR_MADHEPURA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Saharsa', 'BR_SAHARSA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Darbhanga', 'BR_DARBHANGA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Muzaffarpur', 'BR_MUZAFFARPUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Gopalganj', 'BR_GOPALGANJ') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Siwan', 'BR_SIWAN') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Saran', 'BR_SARAN') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Vaishali', 'BR_VAISHALI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Samastipur', 'BR_SAMASTIPUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Begusarai', 'BR_BEGUSARAI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Khagaria', 'BR_KHAGARIA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Bhagalpur', 'BR_BHAGALPUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Banka', 'BR_BANKA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Munger', 'BR_MUNGER') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Lakhisarai', 'BR_LAKHISARAI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Sheikhpura', 'BR_SHEIKHPURA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Nalanda', 'BR_NALANDA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Patna', 'BR_PATNA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Bhojpur', 'BR_BHOJPUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Buxar', 'BR_BUXAR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Kaimur', 'BR_KAIMUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Rohtas', 'BR_ROHTAS') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Arwal', 'BR_ARWAL') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Jehanabad', 'BR_JEHANABAD') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Aurangabad', 'BR_AURANGABAD') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Gaya', 'BR_GAYA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Nawada', 'BR_NAWADA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (5, 'Jamui', 'BR_JAMUI') ON CONFLICT (code) DO NOTHING;

-- Regions (8)
-- Champaran-Tirhut: West Champaran, East Champaran, Sheohar, Muzaffarpur, Vaishali
-- Mithila: Madhubani, Darbhanga, Samastipur
-- Saran: Saran, Siwan, Gopalganj
-- Kosi: Saharsa, Supaul, Madhepura, Sitamarhi, Khagaria
-- Seemanchal: Purnia, Katihar, Araria, Kishanganj
-- Ang/Bhagalpur: Bhagalpur, Banka, Munger, Begusarai, Lakhisarai, Sheikhpura, Jamui
-- Patna-Bhojpur: Patna, Bhojpur, Buxar, Nalanda, Saran (Saran shared with Saran region — assign to Saran)
-- Magadh: Gaya, Nawada, Aurangabad, Jehanabad, Arwal, Rohtas, Kaimur
INSERT INTO regions (state_id, name, code) VALUES (5, 'Champaran-Tirhut', 'BR_CHAMPARANTIRHUT') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (5, 'Mithila', 'BR_MITHILA') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (5, 'Saran', 'BR_SARAN') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (5, 'Kosi', 'BR_KOSI') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (5, 'Seemanchal', 'BR_SEEMANCHAL') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (5, 'Ang', 'BR_ANG') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (5, 'Patna-Bhojpur', 'BR_PATNABHOJPUR') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (5, 'Magadh', 'BR_MAGADH') ON CONFLICT (state_id, code) DO NOTHING;

-- Assign district_id to Bihar constituencies (all elections)
-- const_no ranges from CSV mapping:
-- 1-9: West Champaran
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_WESTCHAMPARAN') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 1 AND 9;
-- 10-21: East Champaran
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_EASTCHAMPARAN') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 10 AND 21;
-- 22: Sheohar
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_SHEOHAR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no = 22;
-- 23-30: Sitamarhi
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_SITAMARHI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 23 AND 30;
-- 31-40: Madhubani
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_MADHUBANI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 31 AND 40;
-- 41-45: Supaul
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_SUPAUL') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 41 AND 45;
-- 46-51: Araria
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_ARARIA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 46 AND 51;
-- 52-55: Kishanganj
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_KISHANGANJ') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 52 AND 55;
-- 56-62: Purnia
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_PURNIA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 56 AND 62;
-- 63-69: Katihar
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_KATIHAR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 63 AND 69;
-- 70-73: Madhepura
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_MADHEPURA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 70 AND 73;
-- 74-77: Saharsa
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_SAHARSA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 74 AND 77;
-- 78-87: Darbhanga
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_DARBHANGA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 78 AND 87;
-- 88-98: Muzaffarpur
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_MUZAFFARPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 88 AND 98;
-- 99-104: Gopalganj
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_GOPALGANJ') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 99 AND 104;
-- 105-112: Siwan
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_SIWAN') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 105 AND 112;
-- 113-122: Saran
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_SARAN') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 113 AND 122;
-- 123-130: Vaishali
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_VAISHALI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 123 AND 130;
-- 131-140: Samastipur
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_SAMASTIPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 131 AND 140;
-- 141-147: Begusarai
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_BEGUSARAI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 141 AND 147;
-- 148-151: Khagaria
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_KHAGARIA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 148 AND 151;
-- 152-158: Bhagalpur
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_BHAGALPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 152 AND 158;
-- 159-163: Banka
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_BANKA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 159 AND 163;
-- 164-166: Munger
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_MUNGER') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 164 AND 166;
-- 167-168: Lakhisarai
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_LAKHISARAI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 167 AND 168;
-- 169-170: Sheikhpura
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_SHEIKHPURA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 169 AND 170;
-- 171-177: Nalanda
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_NALANDA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 171 AND 177;
-- 178-191: Patna
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_PATNA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 178 AND 191;
-- 192-198: Bhojpur
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_BHOJPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 192 AND 198;
-- 199-202: Buxar
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_BUXAR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 199 AND 202;
-- 203-206: Kaimur
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_KAIMUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 203 AND 206;
-- 207-213: Rohtas
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_ROHTAS') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 207 AND 213;
-- 214-215: Arwal
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_ARWAL') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 214 AND 215;
-- 216-218: Jehanabad
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_JEHANABAD') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 216 AND 218;
-- 219-224: Aurangabad
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_AURANGABAD') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 219 AND 224;
-- 225-234: Gaya
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_GAYA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 225 AND 234;
-- 235-239: Nawada
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_NAWADA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 235 AND 239;
-- 240-243: Jamui
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'BR_JAMUI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 240 AND 243;

-- Assign region_id to Bihar constituencies via district mapping
-- Champaran-Tirhut: West Champaran (1-9), East Champaran (10-21), Sheohar (22), Muzaffarpur (88-98), Vaishali (123-130)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_CHAMPARANTIRHUT') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 1 AND 21;
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_CHAMPARANTIRHUT') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no = 22;
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_CHAMPARANTIRHUT') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 88 AND 98;
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_CHAMPARANTIRHUT') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 123 AND 130;

-- Kosi: Sitamarhi (23-30), Supaul (41-45), Madhepura (70-73), Saharsa (74-77), Khagaria (148-151)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_KOSI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 23 AND 30;
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_KOSI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 41 AND 45;
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_KOSI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 70 AND 77;
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_KOSI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 148 AND 151;

-- Mithila: Madhubani (31-40), Darbhanga (78-87), Samastipur (131-140)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_MITHILA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 31 AND 40;
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_MITHILA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 78 AND 87;
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_MITHILA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 131 AND 140;

-- Seemanchal: Araria (46-51), Kishanganj (52-55), Purnia (56-62), Katihar (63-69)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_SEEMANCHAL') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 46 AND 69;

-- Saran: Gopalganj (99-104), Siwan (105-112), Saran (113-122)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_SARAN') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 99 AND 122;

-- Ang: Begusarai (141-147), Bhagalpur (152-158), Banka (159-163), Munger (164-166), Lakhisarai (167-168), Sheikhpura (169-170), Jamui (240-243)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_ANG') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 141 AND 147;
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_ANG') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 152 AND 170;
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_ANG') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 240 AND 243;

-- Patna-Bhojpur: Nalanda (171-177), Patna (178-191), Bhojpur (192-198), Buxar (199-202)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_PATNABHOJPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 171 AND 202;

-- Magadh: Kaimur (203-206), Rohtas (207-213), Arwal (214-215), Jehanabad (216-218), Aurangabad (219-224), Gaya (225-234), Nawada (235-239)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'BR_MAGADH') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 5 AND const_no BETWEEN 203 AND 239;
