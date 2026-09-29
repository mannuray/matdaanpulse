-- West Bengal VS: New parties not already in DB
-- Run: docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_wb_parties.sql

INSERT INTO parties (id, name, color, symbol_url) VALUES ('SUCI', 'Socialist Unity Centre of India (Communist)', '#CC0000', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO parties (id, name, color, symbol_url) VALUES ('GJM', 'Gorkha Janmukti Morcha', '#006400', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO parties (id, name, color, symbol_url) VALUES ('GNLF', 'Gorkha National Liberation Front', '#228B22', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO parties (id, name, color, symbol_url) VALUES ('JKP', 'All India Jharkhand Party', '#808080', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO parties (id, name, color, symbol_url) VALUES ('JKPN', 'Jharkhand Party (Naren)', '#808080', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO parties (id, name, color, symbol_url) VALUES ('DSPP', 'Democratic Socialist Party (Prabodh Chandra)', '#CC0000', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO parties (id, name, color, symbol_url) VALUES ('RSMP', 'Rashtriya Secular Majlis Party', '#808080', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO parties (id, name, color, symbol_url) VALUES ('RCPIR', 'Revolutionary Communist Party of India (Rasik Bhatt)', '#CC0000', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO parties (id, name, color, symbol_url) VALUES ('CPIML', 'CPI(ML) Liberation', '#E5484D', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO parties (id, name, color, symbol_url) VALUES ('AMB', 'Amra Bangalee', '#808080', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO parties (id, name, color, symbol_url) VALUES ('KPPU', 'Kamatapur Peoples Party (United)', '#808080', NULL) ON CONFLICT (id) DO NOTHING;
