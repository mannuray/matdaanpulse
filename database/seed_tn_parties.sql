-- Tamil Nadu parties not already in DB
-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_tn_parties.sql

INSERT INTO parties (id, name, abbreviation, color) VALUES
  ('PT', 'Puthiya Tamilagam', 'PT', '#9C27B0'),
  ('MAMAK', 'Manithaneya Makkal Katchi', 'MAMAK', '#795548'),
  ('KNMK', 'Kongu Nadu Munnetra Kazhagam', 'KNMK', '#607D8B'),
  ('MNM', 'Makkal Needhi Maiam', 'MNM', '#FF4081')
ON CONFLICT (id) DO NOTHING;
