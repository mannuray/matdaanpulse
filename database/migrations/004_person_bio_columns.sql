-- Migration 004: Add bio columns to persons table
-- Promotes stable biographical data from candidates.metadata JSONB to typed columns on persons

ALTER TABLE persons ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE persons ADD COLUMN IF NOT EXISTS education VARCHAR(255);
ALTER TABLE persons ADD COLUMN IF NOT EXISTS date_of_birth DATE;
