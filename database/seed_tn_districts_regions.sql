-- Tamil Nadu: Districts, Regions, and constituency assignments
-- Applied by database/setup.sh after the VS result seeds. Constituency UPDATEs are scoped to
-- VS elections: VS const_no ranges must never tag Lok Sabha seats (whose const_no overlaps).

-- Districts (38)
INSERT INTO districts (state_id, name, code) VALUES (31, 'Thiruvallur', 'TN_THIRUVALLUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Chennai', 'TN_CHENNAI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Kancheepuram', 'TN_KANCHEEPURAM') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Chengalpattu', 'TN_CHENGALPATTU') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Vellore', 'TN_VELLORE') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Ranipet', 'TN_RANIPET') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Tirupattur', 'TN_TIRUPATTUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Tiruvannamalai', 'TN_TIRUVANNAMALAI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Viluppuram', 'TN_VILUPPURAM') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Kallakurichi', 'TN_KALLAKURICHI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Krishnagiri', 'TN_KRISHNAGIRI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Dharmapuri', 'TN_DHARMAPURI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Salem', 'TN_SALEM') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Namakkal', 'TN_NAMAKKAL') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Erode', 'TN_ERODE') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Tiruppur', 'TN_TIRUPPUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Coimbatore', 'TN_COIMBATORE') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'The Nilgiris', 'TN_NILGIRIS') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Dindigul', 'TN_DINDIGUL') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Karur', 'TN_KARUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Tiruchirappalli', 'TN_TIRUCHIRAPPALLI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Perambalur', 'TN_PERAMBALUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Ariyalur', 'TN_ARIYALUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Cuddalore', 'TN_CUDDALORE') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Mayiladuthurai', 'TN_MAYILADUTHURAI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Nagapattinam', 'TN_NAGAPATTINAM') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Thanjavur', 'TN_THANJAVUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Thiruvarur', 'TN_THIRUVARUR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Pudukkottai', 'TN_PUDUKKOTTAI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Sivaganga', 'TN_SIVAGANGA') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Madurai', 'TN_MADURAI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Theni', 'TN_THENI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Virudhunagar', 'TN_VIRUDHUNAGAR') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Ramanathapuram', 'TN_RAMANATHAPURAM') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Thoothukudi', 'TN_THOOTHUKUDI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Tenkasi', 'TN_TENKASI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Tirunelveli', 'TN_TIRUNELVELI') ON CONFLICT (code) DO NOTHING;
INSERT INTO districts (state_id, name, code) VALUES (31, 'Kanyakumari', 'TN_KANYAKUMARI') ON CONFLICT (code) DO NOTHING;

-- Regions (7)
-- Chennai Metro: Chennai, Thiruvallur, Chengalpattu, Kancheepuram
-- North TN: Vellore, Ranipet, Tirupattur, Tiruvannamalai
-- Kongu Nadu: Coimbatore, Erode, Tiruppur, Nilgiris, Namakkal, Karur, Dindigul
-- Salem-Dharmapuri: Salem, Dharmapuri, Krishnagiri, Kallakurichi, Viluppuram
-- Delta: Thanjavur, Thiruvarur, Nagapattinam, Mayiladuthurai, Tiruchirappalli, Perambalur, Ariyalur, Cuddalore, Pudukkottai
-- Southern TN: Madurai, Theni, Sivaganga, Virudhunagar, Ramanathapuram
-- Deep South: Thoothukudi, Tirunelveli, Tenkasi, Kanyakumari
INSERT INTO regions (state_id, name, code) VALUES (31, 'Chennai Metro', 'TN_CHENNAIMETRO') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (31, 'North Tamil Nadu', 'TN_NORTHTN') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (31, 'Kongu Nadu', 'TN_KONGUNADU') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (31, 'Salem-Dharmapuri', 'TN_SALEMDHARMAPURI') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (31, 'Delta', 'TN_DELTA') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (31, 'Southern Tamil Nadu', 'TN_SOUTHERNTN') ON CONFLICT (state_id, code) DO NOTHING;
INSERT INTO regions (state_id, name, code) VALUES (31, 'Deep South', 'TN_DEEPSOUTH') ON CONFLICT (state_id, code) DO NOTHING;

-- Assign district_id to Tamil Nadu constituencies (all elections with state_id=31)
-- AC 1-4: Thiruvallur
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_THIRUVALLUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 1 AND 4;
-- AC 5-9: Thiruvallur (Avadi, Poonamallee, Maduravoyal, Ambattur, Madavaram — part of Thiruvallur dist)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_THIRUVALLUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 5 AND 9;
-- AC 10-28: Chennai
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_CHENNAI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 10 AND 28;
-- AC 29-31: Chengalpattu (Sriperumbudur, Pallavaram, Tambaram)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_CHENGALPATTU') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 29 AND 33;
-- AC 34-37: Kancheepuram (Cheyyur, Madurantakam, Uthiramerur, Kancheepuram)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_KANCHEEPURAM') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 34 AND 37;
-- AC 38-39: Ranipet (Arakkonam, Sholingur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_RANIPET') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 38 AND 39;
-- AC 40-44: Vellore (Katpadi, Ranipet, Arcot, Vellore, Anaikattu)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_VELLORE') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 40 AND 44;
-- AC 45-48: Vellore (Kilvaithinankuppam, Gudiyattam, Vaniyambadi, Ambur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_VELLORE') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 45 AND 48;
-- AC 49-52: Tirupattur (Jolarpet, Tiruppattur, Uthangarai, Bargur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_TIRUPATTUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 49 AND 52;
-- AC 53-56: Krishnagiri (Krishnagiri, Veppanahalli, Hosur, Thalli)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_KRISHNAGIRI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 53 AND 56;
-- AC 57-61: Dharmapuri (Palacodu, Pennagaram, Dharmapuri, Pappireddippatti, Harur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_DHARMAPURI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 57 AND 61;
-- AC 62-68: Tiruvannamalai (Chengam, Tiruvannamalai, Kilpennathur, Kalasapakkam, Polur, Arani, Cheyyar)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_TIRUVANNAMALAI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 62 AND 68;
-- AC 69-73: Viluppuram (Vandavasi x2, Mailam, Tindivanam, Vanur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_VILUPPURAM') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 69 AND 75;
-- AC 76-80: Kallakurichi (Tirukkoyilur, Ulundurpettai, Rishivandiyam, Sankarapuram, Kallakurichi)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_KALLAKURICHI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 76 AND 80;
-- AC 81-90: Salem (Gangavalli, Attur, Yercaud, Omalur, Mettur, Edappadi, Sankari, Salem W/N/S)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_SALEM') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 81 AND 91;
-- AC 92-97: Namakkal (Rasipuram, Senthamangalam, Namakkal, Paramathi-Velur, Tiruchengodu, Kumarapalayam)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_NAMAKKAL') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 92 AND 97;
-- AC 98-107: Erode (Erode E/W, Modakkurichi, Dharapuram, Kangayam, Perundurai, Bhavani, Anthiyur, Gobichettipalayam, Bhavanisagar)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_ERODE') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 98 AND 107;
-- AC 108-110: The Nilgiris (Udhagamandalam, Gudalur, Coonoor)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_NILGIRIS') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 108 AND 110;
-- AC 111-124: Tiruppur + Coimbatore
-- 111-116: Tiruppur (Mettuppalayam, Avanashi, Tiruppur N/S, Palladam, Sulur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_TIRUPPUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 111 AND 116;
-- 117-122: Coimbatore (Kavundampalayam, Coimbatore N, Thondamuthur, Coimbatore S, Singanallur, Kinathukadavu)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_COIMBATORE') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 117 AND 122;
-- 123-124: Coimbatore (Pollachi, Valparai)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_COIMBATORE') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 123 AND 124;
-- AC 125-133: Dindigul (Udumalaipettai, Madathukulam, Palani, Oddanchatram, Athoor, Nilakkottai, Natham, Dindigul, Vedasandur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_DINDIGUL') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 125 AND 133;
-- AC 134-136: Karur (Aravakurichi, Karur, Krishnarayapuram)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_KARUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 134 AND 136;
-- AC 137-146: Tiruchirappalli (Kulithalai, Manapparai, Srirangam, Tiruchirappalli E/W, Thiruverumbur, Lalgudi, Manachanallur, Musiri, Thuraiyur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_TIRUCHIRAPPALLI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 137 AND 146;
-- AC 147-148: Perambalur (Perambalur, Kunnam)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_PERAMBALUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 147 AND 148;
-- AC 149-150: Ariyalur (Ariyalur, Jayankondam)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_ARIYALUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 149 AND 150;
-- AC 151-158: Cuddalore (Tittakudi, Vriddhachalam, Neyveli, Panruti, Cuddalore, Kurinjipadi, Bhuvanagiri, Chidambaram)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_CUDDALORE') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 151 AND 158;
-- AC 159-162: Mayiladuthurai (Kattumannarkoil, Sirkazhi, Mayiladuthurai, Poompuhar)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_MAYILADUTHURAI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 159 AND 162;
-- AC 163-165: Nagapattinam (Nagapattinam, Kilvelur, Vedaranyam)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_NAGAPATTINAM') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 163 AND 165;
-- AC 166-169: Thiruvarur (Thiruthuraipoondi, Mannargudi, Thiruvarur, Nannilam)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_THIRUVARUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 166 AND 169;
-- AC 170-178: Thanjavur (Thiruvidaimarudur, Kumbakonam, Papanasam, Thiruvaiyaru, Thanjavur, Orathanadu, Pattukkottai, Peravurani, Gandharvakottai)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_THANJAVUR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 170 AND 178;
-- AC 179-183: Pudukkottai (Viralimalai, Pudukkottai, Thirumayam, Alangudi, Aranthangi)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_PUDUKKOTTAI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 179 AND 183;
-- AC 184-187: Sivaganga (Karaikudi, Tiruppattur, Sivaganga, Manamadurai)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_SIVAGANGA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 184 AND 187;
-- AC 188-197: Madurai (Melur, Madurai East, Sholavandan, Madurai N/S/C/W, Thiruparankundram, Thirumangalam, Usilampatti)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_MADURAI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 188 AND 197;
-- AC 198-201: Theni (Andipatti, Periyakulam, Bodinayakanur, Cumbum)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_THENI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 198 AND 201;
-- AC 202-208: Virudhunagar (Rajapalayam, Srivilliputhur, Sattur, Sivakasi, Virudhunagar, Aruppukkottai, Tiruchuli)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_VIRUDHUNAGAR') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 202 AND 208;
-- AC 209-212: Ramanathapuram (Paramakudi, Tiruvadanai, Ramanathapuram, Mudhukulathur)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_RAMANATHAPURAM') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 209 AND 212;
-- AC 213-218: Thoothukudi (Vilathikulam, Thoothukkudi, Tiruchendur, Srivaikuntam, Ottapidaram, Kovilpatti)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_THOOTHUKUDI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 213 AND 218;
-- AC 219-223: Tenkasi (Sankarankovil, Vasudevanallur, Kadayanallur, Tenkasi, Alangulam)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_TENKASI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 219 AND 223;
-- AC 224-228: Tirunelveli (Tirunelveli, Ambasamudram, Palayamkottai, Nanguneri, Radhapuram)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_TIRUNELVELI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 224 AND 228;
-- AC 229-234: Kanyakumari (Kanniyakumari, Nagercoil, Colachel, Padmanabhapuram, Vilavancode, Killiyoor)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'TN_KANYAKUMARI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 229 AND 234;

-- Assign region_id to Tamil Nadu constituencies
-- Chennai Metro: ACs 1-33 (Thiruvallur, Chennai, Chengalpattu)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'TN_CHENNAIMETRO') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 1 AND 37;

-- North TN: ACs 38-68 (Ranipet, Vellore, Tirupattur, Tiruvannamalai) + Krishnagiri 53-56
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'TN_NORTHTN') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 38 AND 68;

-- Salem-Dharmapuri: ACs 57-61 (Dharmapuri), 53-56 (Krishnagiri), 69-91 (Viluppuram, Kallakurichi, Salem)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'TN_SALEMDHARMAPURI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 53 AND 61;
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'TN_SALEMDHARMAPURI') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 69 AND 91;

-- Kongu Nadu: ACs 92-133 (Namakkal, Erode, Nilgiris, Tiruppur, Coimbatore, Dindigul)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'TN_KONGUNADU') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 92 AND 133;

-- Delta: ACs 134-183 (Karur, Tiruchirappalli, Perambalur, Ariyalur, Cuddalore, Mayiladuthurai, Nagapattinam, Thiruvarur, Thanjavur, Pudukkottai)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'TN_DELTA') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 134 AND 183;

-- Southern TN: ACs 184-212 (Sivaganga, Madurai, Theni, Virudhunagar, Ramanathapuram)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'TN_SOUTHERNTN') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 184 AND 212;

-- Deep South: ACs 213-234 (Thoothukudi, Tenkasi, Tirunelveli, Kanyakumari)
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = 'TN_DEEPSOUTH') WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS') AND state_id = 31 AND const_no BETWEEN 213 AND 234;
