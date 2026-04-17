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

-- Seed Bihar regions (state_id = 5)
INSERT INTO regions (state_id, name, code) VALUES
  (5, 'Mithila', 'mithila'),
  (5, 'Magadh', 'magadh'),
  (5, 'Bhojpur', 'bhojpur'),
  (5, 'Seemanchal', 'seemanchal'),
  (5, 'Tirhut', 'tirhut'),
  (5, 'Kosi', 'kosi'),
  (5, 'Saran', 'saran'),
  (5, 'Shahabad', 'shahabad'),
  (5, 'Ang', 'ang')
ON CONFLICT (state_id, code) DO NOTHING;

COMMIT;
