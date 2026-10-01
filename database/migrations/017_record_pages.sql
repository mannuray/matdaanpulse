-- Migration 017: admin record pages (parties, persons, candidates, constituencies)
--
--   * updated_at on the four tables, bumped by a BEFORE UPDATE trigger only when the row
--     actually changes (a no-op UPDATE keeps the old value). Coexists with the AFTER UPDATE
--     live-version triggers of migration 015, which compare their own columns only.
--   * parties.eci_recognition: National / State / Unrecognised, or NULL (not set).
--   * constituencies.phase is the only store of the polling phase: copy metadata->>'phase'
--     into the column where it is NULL. Non-numeric values are skipped.
--
-- Idempotent; no seed dependency.

ALTER TABLE parties        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE persons        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE candidates     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE constituencies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- jsonb comparison (not ROW(NEW.*) = ROW(OLD.*)) so a column type without an equality
-- operator can never make every UPDATE on the table fail.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
        NEW.updated_at := now();
    ELSE
        NEW.updated_at := OLD.updated_at;
    END IF;
    RETURN NEW;
END $$;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['parties', 'persons', 'candidates', 'constituencies'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_' || t || '_updated_at' AND tgrelid = t::regclass
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
                'trg_' || t || '_updated_at', t
            );
        END IF;
    END LOOP;
END $$;

ALTER TABLE parties ADD COLUMN IF NOT EXISTS eci_recognition VARCHAR(20);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_parties_eci_recognition') THEN
        ALTER TABLE parties ADD CONSTRAINT chk_parties_eci_recognition
            CHECK (eci_recognition IN ('National', 'State', 'Unrecognised'));
    END IF;
END $$;

-- phase is SMALLINT: copy only whole numbers that fit (1–4 digits, trimmed).
UPDATE constituencies
SET phase = btrim(metadata->>'phase')::smallint
WHERE phase IS NULL
  AND metadata ? 'phase'
  AND btrim(metadata->>'phase') ~ '^[0-9]{1,4}$';
