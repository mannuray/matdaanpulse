-- Assam parties not already in DB
-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_as_parties.sql

INSERT INTO parties (id, name, abbreviation, color) VALUES
  ('BOPF', 'Bodoland People''s Front', 'BOPF', '#2E7D32'),
  ('UPPL', 'United People''s Party Liberal', 'UPPL', '#00BCD4')
ON CONFLICT (id) DO NOTHING;

-- AITC maps to existing TMC
