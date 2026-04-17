-- Puducherry parties not already in DB
-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_py_parties.sql

INSERT INTO parties (id, name, abbreviation, color) VALUES
  ('AINRC', 'All India N.R. Congress', 'AINRC', '#FF9933')
ON CONFLICT (id) DO NOTHING;
