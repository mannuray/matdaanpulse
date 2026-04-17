-- Kerala: Districts, Regions, and constituency assignments
-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_kl_districts_regions.sql

-- Districts (14)
INSERT INTO districts (state_id, name, code) VALUES (16, 'Thiruvananthapuram', 'KL_THIRUVANANTHAPURAM') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (16, 'Kollam', 'KL_KOLLAM') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (16, 'Pathanamthitta', 'KL_PATHANAMTHITTA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (16, 'Alappuzha', 'KL_ALAPPUZHA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (16, 'Kottayam', 'KL_KOTTAYAM') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (16, 'Idukki', 'KL_IDUKKI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (16, 'Ernakulam', 'KL_ERNAKULAM') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (16, 'Thrissur', 'KL_THRISSUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (16, 'Palakkad', 'KL_PALAKKAD') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (16, 'Malappuram', 'KL_MALAPPURAM') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (16, 'Kozhikode', 'KL_KOZHIKODE') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (16, 'Wayanad', 'KL_WAYANAD') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (16, 'Kannur', 'KL_KANNUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (16, 'Kasaragod', 'KL_KASARAGOD') ON CONFLICT (code) DO NOTHING;

-- Regions (5)
-- South Kerala: Thiruvananthapuram, Kollam, Pathanamthitta
-- Central Travancore: Alappuzha, Kottayam, Idukki
-- Central Kerala: Ernakulam, Thrissur
-- Malabar South: Palakkad, Malappuram
-- Malabar North: Kozhikode, Wayanad, Kannur, Kasaragod
INSERT INTO regions (state_id, name, code) VALUES (16, 'South Kerala', 'KL_SOUTHKERALA') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (16, 'Central Travancore', 'KL_CENTRALTRAVANCORE') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (16, 'Central Kerala', 'KL_CENTRALKERALA') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (16, 'Malabar South', 'KL_MALABARSOUTH') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (16, 'Malabar North', 'KL_MALABARNORTH') ON CONFLICT (state_id, code) DO NOTHING;

-- District assignments by const_no (Kerala has 140 ACs, numbered 1-140 north to south)
-- 1-3: Kasaragod (Manjeshwar, Kasaragod, Udma)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_KASARAGOD') WHERE state_id = 16 AND const_no BETWEEN 1 AND 3;
-- 4-11: Kannur (Kanhangad, Thrikaripur, Payyanur, Kalliasseri, Taliparamba, Irikkur, Azhikode, Kannur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_KASARAGOD') WHERE state_id = 16 AND const_no BETWEEN 4 AND 5;
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_KANNUR') WHERE state_id = 16 AND const_no BETWEEN 6 AND 15;
-- 4-5 Kanhangad+Thrikaripur are actually Kasaragod district
-- 6-15: Kannur (Payyanur, Kalliasseri, Taliparamba, Irikkur, Azhikode, Kannur, Dharmadom, Mattannur, Peravoor, Kuthuparamba)
-- 16-18: Wayanad (Mananthavady, Sulthan Bathery, Kalpetta)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_WAYANAD') WHERE state_id = 16 AND const_no BETWEEN 16 AND 18;
-- 19-25: Kozhikode (Vatakara, Kuttiadi, Nadapuram, Quilandy, Perambra, Balusseri, Elathur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_KOZHIKODE') WHERE state_id = 16 AND const_no BETWEEN 19 AND 25;
-- 26-28: Kozhikode city (Kozhikode North, Kozhikode South, Beypore)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_KOZHIKODE') WHERE state_id = 16 AND const_no BETWEEN 26 AND 28;
-- 29-30: Kozhikode (Kunnamangalam, Koduvally)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_KOZHIKODE') WHERE state_id = 16 AND const_no BETWEEN 29 AND 30;
-- 31-40: Malappuram (Thiruvambady, Kondotty, Eranad, Nilambur, Wandoor, Manjeri, Perinthalmanna, Mankada, Malappuram, Vengara)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_MALAPPURAM') WHERE state_id = 16 AND const_no BETWEEN 31 AND 40;
-- 41-44: Malappuram (Vallikkunnu, Tirurangadi, Tanur, Tirur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_MALAPPURAM') WHERE state_id = 16 AND const_no BETWEEN 41 AND 44;
-- 45-46: Malappuram (Kottakkal, Thavanur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_MALAPPURAM') WHERE state_id = 16 AND const_no BETWEEN 45 AND 46;
-- 47-48: Palakkad (Ponnani, Thrithala)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_PALAKKAD') WHERE state_id = 16 AND const_no BETWEEN 47 AND 48;
-- 49-58: Palakkad (Ottapalam, Shoranur, Kongad, Mannarkkad, Malampuzha, Palakkad, Tarur, Chittur, Nenmara, Alathur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_PALAKKAD') WHERE state_id = 16 AND const_no BETWEEN 49 AND 58;
-- 59-68: Thrissur (Chelakkara, Kunnamkulam, Guruvayur, Manalur, Wadakkanchery, Ollur, Thrissur, Nattika, Kaipamangalam, Irinjalakuda)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_THRISSUR') WHERE state_id = 16 AND const_no BETWEEN 59 AND 68;
-- 69-70: Thrissur (Puthukkad, Chalakudy)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_THRISSUR') WHERE state_id = 16 AND const_no BETWEEN 69 AND 70;
-- 71-80: Ernakulam (Kodungallur, Perumbavoor, Angamaly, Aluva, Kalamassery, Paravur, Vypin, Kochi, Thrippunithura, Ernakulam)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_ERNAKULAM') WHERE state_id = 16 AND const_no BETWEEN 71 AND 80;
-- 81-84: Ernakulam (Thrikkakara, Kunnathunad, Piravom, Muvattupuzha)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_ERNAKULAM') WHERE state_id = 16 AND const_no BETWEEN 81 AND 84;
-- 85-89: Idukki (Kothamangalam, Devikulam, Udumbanchola, Thodupuzha, Idukki)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_ERNAKULAM') WHERE state_id = 16 AND const_no = 85;
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_IDUKKI') WHERE state_id = 16 AND const_no BETWEEN 86 AND 89;
-- 90-95: Kottayam (Peerumade, Pala, Kaduthuruthy, Vaikom, Ettumanoor, Kottayam)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_IDUKKI') WHERE state_id = 16 AND const_no = 90;
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_KOTTAYAM') WHERE state_id = 16 AND const_no BETWEEN 91 AND 95;
-- 96-97: Kottayam (Puthuppally, Changanassery)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_KOTTAYAM') WHERE state_id = 16 AND const_no BETWEEN 96 AND 97;
-- 98-103: Pathanamthitta (Kanjirappally, Thiruvalla, Ranni, Aranmula, Konni, Adoor)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_KOTTAYAM') WHERE state_id = 16 AND const_no = 98;
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_PATHANAMTHITTA') WHERE state_id = 16 AND const_no BETWEEN 99 AND 103;
-- 104-109: Alappuzha (Karunagappally, Kunnathur, Kottarakkara, Pathanapuram, Punalur, Chadayamangalam) — wait, these are Kollam
-- Let me re-check. Kerala ACs numbered north to south:
-- 104-108: Alappuzha (Mavelikkara, Chengannur, Haripad, Kayamkulam, Alappuzha)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_PATHANAMTHITTA') WHERE state_id = 16 AND const_no = 104;
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_ALAPPUZHA') WHERE state_id = 16 AND const_no BETWEEN 105 AND 112;
-- 105-112: Alappuzha (Mavelikkara, Chengannur, Haripad, Kayamkulam, Ambalapuzha, Alappuzha, Cherthala, Aroor)
-- 113-118: Kollam (Karunagappally, Kunnathur, Kottarakkara, Pathanapuram, Punalur, Chadayamangalam)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_KOLLAM') WHERE state_id = 16 AND const_no BETWEEN 113 AND 118;
-- 119-124: Kollam (Kundara, Kollam, Eravipuram, Chathannoor, Chavara, Attingal)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_KOLLAM') WHERE state_id = 16 AND const_no BETWEEN 119 AND 123;
-- 124-140: Thiruvananthapuram
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'KL_THIRUVANANTHAPURAM') WHERE state_id = 16 AND const_no BETWEEN 124 AND 140;

-- Region assignments
-- Malabar North: ACs 1-18 (Kasaragod, Kannur, Wayanad)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'KL_MALABARNORTH') WHERE state_id = 16 AND const_no BETWEEN 1 AND 18;
-- Malabar South: ACs 19-58 (Kozhikode, Malappuram, Palakkad)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'KL_MALABARSOUTH') WHERE state_id = 16 AND const_no BETWEEN 19 AND 58;
-- Central Kerala: ACs 59-85 (Thrissur, Ernakulam)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'KL_CENTRALKERALA') WHERE state_id = 16 AND const_no BETWEEN 59 AND 85;
-- Central Travancore: ACs 86-112 (Idukki, Kottayam, Pathanamthitta, Alappuzha)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'KL_CENTRALTRAVANCORE') WHERE state_id = 16 AND const_no BETWEEN 86 AND 112;
-- South Kerala: ACs 113-140 (Kollam, Thiruvananthapuram)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'KL_SOUTHKERALA') WHERE state_id = 16 AND const_no BETWEEN 113 AND 140;
