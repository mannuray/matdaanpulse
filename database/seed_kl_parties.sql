-- Kerala parties not already in DB
-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_kl_parties.sql

INSERT INTO parties (id, name, abbreviation, color) VALUES
  ('MUL', 'Muslim League (IUML alias)', 'MUL', '#006400'),
  ('KECM', 'Kerala Congress (M)', 'KC(M)', '#8B0000'),
  ('KECJ', 'Kerala Congress (J)', 'KC(J)', '#A52A2A'),
  ('KECB', 'Kerala Congress (B)', 'KC(B)', '#CD5C5C'),
  ('KECST', 'Kerala Congress (Secular Thomas)', 'KC(ST)', '#B22222'),
  ('SJD', 'Socialist Janata Dal', 'SJD', '#FF8C00'),
  ('JPSS', 'Janata Party (Secular Samajwadi)', 'JPSS', '#DAA520'),
  ('KRSP', 'Kerala RSP', 'KRSP', '#FF4500'),
  ('CMPKSC', 'Communist Marxist Party (Kerala Socialist)', 'CMP', '#8B008B'),
  ('NSC', 'Nationalist Socialist Council', 'NSC', '#4169E1'),
  ('RMPI', 'Revolutionary Marxist Party of India', 'RMPI', '#DC143C'),
  ('JKC', 'Janadhipathya Kerala Congress', 'JKC', '#CD853F'),
  ('INCS', 'Indian National Congress (S)', 'INC(S)', '#00CED1'),
  ('KECAMG', 'Kerala Congress (Mani) AMG', 'KC(AMG)', '#800000'),
  ('IND2', 'Independent (2nd)', 'IND', '#808080')
ON CONFLICT (id) DO NOTHING;
