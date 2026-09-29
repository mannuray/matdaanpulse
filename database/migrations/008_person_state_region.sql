-- Regions table + state/region columns on persons
BEGIN;

-- Regions table (e.g., Bihar's Mithila, Magadh, Seemanchal)
CREATE TABLE IF NOT EXISTS regions (
    id SERIAL PRIMARY KEY,
    state_id INT NOT NULL REFERENCES states(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    UNIQUE(state_id, code)
);

-- Person state/region tagging
ALTER TABLE persons ADD COLUMN IF NOT EXISTS state_id INT REFERENCES states(id);
ALTER TABLE persons ADD COLUMN IF NOT EXISTS region_id INT REFERENCES regions(id);

CREATE INDEX IF NOT EXISTS idx_persons_state ON persons(state_id);
CREATE INDEX IF NOT EXISTS idx_persons_region ON persons(region_id);
CREATE INDEX IF NOT EXISTS idx_regions_state ON regions(state_id);

-- Seed Bihar regions (state code 'BR'). Only inserts when the Bihar state row exists,
-- so this migration also succeeds on a fresh, unseeded database. On a fresh build the
-- same rows are (re)inserted by seed_bihar_person_regions.sql, which depends on them.
INSERT INTO regions (state_id, name, code)
SELECT s.id, v.name, v.code
FROM states s
CROSS JOIN (VALUES
  ('Mithila', 'mithila'),
  ('Magadh', 'magadh'),
  ('Bhojpur', 'bhojpur'),
  ('Seemanchal', 'seemanchal'),
  ('Tirhut', 'tirhut'),
  ('Kosi', 'kosi'),
  ('Saran', 'saran'),
  ('Shahabad', 'shahabad'),
  ('Ang', 'ang')
) AS v(name, code)
WHERE s.code = 'BR'
ON CONFLICT (state_id, code) DO NOTHING;

COMMIT;
