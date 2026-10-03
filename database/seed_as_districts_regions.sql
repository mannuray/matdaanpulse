-- Assam: Districts, Regions, and constituency assignments
-- Applied by database/setup.sh after the VS result seeds. Constituency UPDATEs are scoped to the 2008-delimitation
-- VS elections: VS const_no ranges must never tag Lok Sabha seats (whose const_no overlaps).

-- Districts (35)
INSERT INTO districts (state_id, name, code) VALUES (4, 'Karimganj', 'AS_KARIMGANJ') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Hailakandi', 'AS_HAILAKANDI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Cachar', 'AS_CACHAR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Dima Hasao', 'AS_DIMAHASAO') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Karbi Anglong', 'AS_KARBIANGLONG') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'South Salmara-Mankachar', 'AS_SOUTHSALMARA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Dhubri', 'AS_DHUBRI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Kokrajhar', 'AS_KOKRAJHAR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Bongaigaon', 'AS_BONGAIGAON') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Chirang', 'AS_CHIRANG') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Goalpara', 'AS_GOALPARA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Barpeta', 'AS_BARPETA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Bajali', 'AS_BAJALI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Kamrup', 'AS_KAMRUP') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Kamrup Metropolitan', 'AS_KAMRUPMETRO') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Nalbari', 'AS_NALBARI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Baksa', 'AS_BAKSA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Tamulpur', 'AS_TAMULPUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Darrang', 'AS_DARRANG') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Udalguri', 'AS_UDALGURI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Sonitpur', 'AS_SONITPUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Biswanath', 'AS_BISWANATH') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Morigaon', 'AS_MORIGAON') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Nagaon', 'AS_NAGAON') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Hojai', 'AS_HOJAI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Golaghat', 'AS_GOLAGHAT') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Jorhat', 'AS_JORHAT') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Majuli', 'AS_MAJULI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Sivasagar', 'AS_SIVASAGAR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Charaideo', 'AS_CHARAIDEO') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Lakhimpur', 'AS_LAKHIMPUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Dhemaji', 'AS_DHEMAJI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Dibrugarh', 'AS_DIBRUGARH') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (4, 'Tinsukia', 'AS_TINSUKIA') ON CONFLICT (code) DO NOTHING;

-- Regions (6)
-- Barak Valley: Karimganj, Hailakandi, Cachar
-- Hills: Dima Hasao, Karbi Anglong
-- Lower Assam: Dhubri, S.Salmara, Kokrajhar, Bongaigaon, Chirang, Goalpara, Barpeta, Bajali
-- Central Assam: Kamrup, Kamrup Metro, Nalbari, Baksa, Tamulpur, Darrang, Udalguri, Sonitpur, Biswanath
-- Nagaon-Hojai: Morigaon, Nagaon, Hojai, Golaghat
-- Upper Assam: Jorhat, Majuli, Sivasagar, Charaideo, Lakhimpur, Dhemaji, Dibrugarh, Tinsukia
INSERT INTO regions (state_id, name, code) VALUES (4, 'Barak Valley', 'AS_BARAKVALLEY') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (4, 'Hills', 'AS_HILLS') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (4, 'Lower Assam', 'AS_LOWERASSAM') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (4, 'Central Assam', 'AS_CENTRALASSAM') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (4, 'Nagaon-Hojai', 'AS_NAGAONHOJAI') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (4, 'Upper Assam', 'AS_UPPERASSAM') ON CONFLICT (state_id, code) DO NOTHING;

-- District assignments by const_no
-- 1-5: Karimganj
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_KARIMGANJ') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 1 AND 5;
-- 6-7: Hailakandi
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_HAILAKANDI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 6 AND 7;
-- 8-15: Cachar
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_CACHAR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 8 AND 15;
-- 16: Dima Hasao
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_DIMAHASAO') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no = 16;
-- 17-20: Karbi Anglong (West + East)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_KARBIANGLONG') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 17 AND 20;
-- 21-22: South Salmara-Mankachar
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_SOUTHSALMARA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 21 AND 22;
-- 23-27: Dhubri
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_DHUBRI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 23 AND 27;
-- 28-31: Kokrajhar
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_KOKRAJHAR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 28 AND 31;
-- 32-33: Bongaigaon + Chirang (Bijni)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_BONGAIGAON') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no = 32;
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_CHIRANG') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no = 33;
-- 34-38: Goalpara (Abhayapuri N/S, Dudhnai, Goalpara E/W)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_GOALPARA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 34 AND 38;
-- 39-42: Barpeta/Bajali (Jaleswar, Sorbhog, Bhabanipur, Patacharkuchi)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_BARPETA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 39 AND 42;
-- 43-47: Barpeta (Barpeta, Jania, Baghbar, Sarukhetri, Chenga)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_BARPETA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 43 AND 47;
-- 48-50: Kamrup (Boko, Chaygaon, Palasbari)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_KAMRUP') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 48 AND 50;
-- 51-55: Kamrup Metropolitan (Jalukbari, Dispur, Gauhati E/W, Hajo)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_KAMRUPMETRO') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 51 AND 55;
-- 56-57: Kamrup (Kamalpur, Rangiya)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_KAMRUP') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 56 AND 57;
-- 58: Tamulpur
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_TAMULPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no = 58;
-- 59-61: Nalbari
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_NALBARI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 59 AND 61;
-- 62-63: Baksa (Barama, Chapaguri)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_BAKSA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 62 AND 63;
-- 64-65: Udalguri (Panery, Kalaigaon)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_UDALGURI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 64 AND 65;
-- 66-68: Darrang (Sipajhar, Mangaldoi, Dalgaon)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_DARRANG') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 66 AND 68;
-- 69-70: Udalguri
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_UDALGURI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 69 AND 70;
-- 71-75: Sonitpur (Dhekiajuli, Barchalla, Tezpur, Rangapara, Sootea)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_SONITPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 71 AND 75;
-- 76-78: Biswanath (Biswanath, Behali, Gohpur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_BISWANATH') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 76 AND 78;
-- 79-82: Morigaon (Jagiroad, Marigaon, Laharighat, Raha)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_MORIGAON') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 79 AND 82;
-- 83-90: Nagaon (Dhing, Batadroba, Rupohihat, Nowgong, Barhampur, Samaguri, Kaliabor, Jamunamukh)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_NAGAON') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 83 AND 90;
-- 91-92: Hojai
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_HOJAI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 91 AND 92;
-- 93-96: Golaghat (Bokakhat, Sarupathar, Golaghat, Khumtai)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_GOLAGHAT') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 93 AND 96;
-- 97-98: Jorhat (Dergaon, Jorhat)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_JORHAT') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 97 AND 98;
-- 99: Majuli
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_MAJULI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no = 99;
-- 100-102: Jorhat (Titabar, Mariani, Teok)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_JORHAT') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 100 AND 102;
-- 103-108: Sivasagar + Charaideo (Amguri, Nazira, Mahmara, Sonari, Thowra, Sibsagar)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_SIVASAGAR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 103 AND 108;
-- 109-112: Lakhimpur (Bihpuria, Naoboicha, Lakhimpur, Dhakuakhana)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_LAKHIMPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 109 AND 112;
-- 113-114: Dhemaji
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_DHEMAJI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 113 AND 114;
-- 115-121: Dibrugarh (Moran, Dibrugarh, Lahowal, Duliajan, Tingkhong, Naharkatia, Chabua)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_DIBRUGARH') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 115 AND 121;
-- 122-126: Tinsukia (Tinsukia, Digboi, Margherita, Doom Dooma, Sadiya)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_TINSUKIA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 122 AND 126;

-- Region assignments
-- Barak Valley: ACs 1-15
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'AS_BARAKVALLEY') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 1 AND 15;
-- Hills: ACs 16-20
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'AS_HILLS') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 16 AND 20;
-- Lower Assam: ACs 21-47
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'AS_LOWERASSAM') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 21 AND 47;
-- Central Assam: ACs 48-78
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'AS_CENTRALASSAM') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 48 AND 78;
-- Nagaon-Hojai: ACs 79-96
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'AS_NAGAONHOJAI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 79 AND 96;
-- Upper Assam: ACs 97-126
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'AS_UPPERASSAM') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008') AND state_id = 4 AND const_no BETWEEN 97 AND 126;
