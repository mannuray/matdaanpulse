-- Add region_id to constituencies, district_id to persons
-- Both entities can belong to a district AND a region

-- Widen districts.code from varchar(10) to varchar(50)
ALTER TABLE districts ALTER COLUMN code TYPE varchar(50);

-- Constituencies: add region_id FK
ALTER TABLE constituencies ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES regions(id);
CREATE INDEX IF NOT EXISTS idx_constituencies_region_id ON constituencies(region_id);

-- Persons: add district_id FK
ALTER TABLE persons ADD COLUMN IF NOT EXISTS district_id INTEGER REFERENCES districts(id);
CREATE INDEX IF NOT EXISTS idx_persons_district ON persons(district_id);
