-- Add wikipedia URL and AI description to parties
ALTER TABLE parties ADD COLUMN IF NOT EXISTS wikipedia_url TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS description TEXT;
