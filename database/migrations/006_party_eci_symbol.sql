-- Add ECI election symbol URL column to parties table
ALTER TABLE parties ADD COLUMN IF NOT EXISTS eci_symbol_url TEXT;
