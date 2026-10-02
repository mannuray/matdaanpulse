-- Migration 018: every candidate has a person (spec docs/superpowers/specs/2026-10-02-person-required-design.md)
--
--   1. Typed columns: the affidavit for one run on candidates (age, assets, liabilities,
--      criminal_cases; rupees, all >= 0) and identity on persons (bio, wikipedia_url, caste, religion).
--   2. Backfill: one person per candidate without one (name = ballot name, state = the seat's
--      state), set-based through a temp table of gen_random_uuid() per candidate.
--   3. Copy any metadata keys into the new columns (both metadata columns are empty locally;
--      production may differ). Candidate gender / education go up to the person where its
--      column is NULL. Runs after the backfill so every candidate has a person to copy into.
--   4. candidates.person_id FK -> ON DELETE RESTRICT (a person with candidates is merged, not deleted).
--   5. Triggers on candidates:
--        candidates_create_person         AFTER INSERT row trigger: creates the person for a row
--                                         actually inserted without one. AFTER, not BEFORE, so a row
--                                         skipped by ON CONFLICT DO NOTHING (the seeds) creates nothing.
--        candidates_require_person        deferred constraint trigger: a candidate may not commit
--                                         without a person. This is the NOT NULL rule; there is no
--                                         column-level NOT NULL, because the NULL must survive until
--                                         the AFTER INSERT trigger fills it.
--        candidates_delete_orphan_person  AFTER UPDATE OF person_id / DELETE: deletes the old person
--                                         once no candidate points to it.
--      They coexist with migration 015's statement-level live-version triggers (which compare name
--      and party only, so the person_id UPDATE never bumps a version) and 017's updated_at trigger.
--   6. person_merges: the merge log that undo reads. keeper_id is ON DELETE SET NULL, so the history
--      survives when the keeper is later merged away or emptied. keeper_ref (no FK, NOT NULL) keeps the
--      original keeper id: history and undo read it, so a chain (X into K, then K into Z) can be undone
--      in reverse. Undo refuses while no person with id keeper_ref exists; an undo that recreates a
--      person re-points keeper_id on the older logs whose keeper_ref is that person.
--   7. Archive every metadata object that still holds keys not moved into columns (e.g. the affidavit
--      generator's affidavit / affidavit_history) into candidate_metadata_archive /
--      person_metadata_archive, then drop candidates.metadata and persons.metadata, last.
--
-- Idempotent: every metadata read is in a DO block guarded by the column still existing, the
-- constraint trigger is created only if missing, the rest uses IF NOT EXISTS / CREATE OR REPLACE.
-- No seed dependency. One transaction, so a failure leaves the database as it was.

BEGIN;

-- 1. Columns ------------------------------------------------------------------------------------

ALTER TABLE candidates
    ADD COLUMN IF NOT EXISTS age            SMALLINT CONSTRAINT chk_candidates_age            CHECK (age >= 0),
    ADD COLUMN IF NOT EXISTS assets         BIGINT   CONSTRAINT chk_candidates_assets         CHECK (assets >= 0),
    ADD COLUMN IF NOT EXISTS liabilities    BIGINT   CONSTRAINT chk_candidates_liabilities    CHECK (liabilities >= 0),
    ADD COLUMN IF NOT EXISTS criminal_cases SMALLINT CONSTRAINT chk_candidates_criminal_cases CHECK (criminal_cases >= 0);

ALTER TABLE persons
    ADD COLUMN IF NOT EXISTS bio           TEXT,
    ADD COLUMN IF NOT EXISTS wikipedia_url TEXT,
    ADD COLUMN IF NOT EXISTS caste         TEXT,
    ADD COLUMN IF NOT EXISTS religion      TEXT;

-- 2. Backfill -----------------------------------------------------------------------------------

CREATE TEMP TABLE tmp_018_new_persons ON COMMIT DROP AS
SELECT c.id AS candidate_id, gen_random_uuid() AS person_id, c.name, k.state_id
FROM candidates c
LEFT JOIN constituencies k ON k.id = c.const_id
WHERE c.person_id IS NULL;

INSERT INTO persons (id, name, state_id)
SELECT person_id, name, state_id FROM tmp_018_new_persons;

UPDATE candidates c
SET person_id = t.person_id
FROM tmp_018_new_persons t
WHERE c.id = t.candidate_id AND c.person_id IS NULL;

DROP TABLE tmp_018_new_persons;

-- 3. Copy metadata keys (only while the columns exist) ------------------------------------------
-- Numbers parse only as plain digit strings short enough for the type (4 digits for SMALLINT,
-- 18 for BIGINT), so a junk or oversized value is skipped instead of aborting the migration.
-- CASE keeps the regex test ahead of the cast. A value already in a column is never overwritten.
-- The affidavit seed generator wrote metadata.affidavit.{age, total_assets, liabilities,
-- criminal_cases, education}, so the nested keys are read too (top-level keys win).

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'candidates' AND column_name = 'metadata') THEN
        EXECUTE $sql$
            WITH src AS (
                SELECT id,
                       btrim(COALESCE(metadata->>'age',            metadata#>>'{affidavit,age}'))            AS age,
                       btrim(COALESCE(metadata->>'assets',         metadata#>>'{affidavit,total_assets}'))   AS assets,
                       btrim(COALESCE(metadata->>'liabilities',    metadata#>>'{affidavit,liabilities}'))    AS liabilities,
                       btrim(COALESCE(metadata->>'criminal_cases', metadata#>>'{affidavit,criminal_cases}')) AS criminal_cases
                FROM candidates
                WHERE metadata IS NOT NULL AND metadata <> '{}'::jsonb
            )
            UPDATE candidates c SET
                age            = COALESCE(c.age,            CASE WHEN s.age            ~ '^[0-9]{1,4}$'  THEN s.age::smallint            END),
                assets         = COALESCE(c.assets,         CASE WHEN s.assets         ~ '^[0-9]{1,18}$' THEN s.assets::bigint           END),
                liabilities    = COALESCE(c.liabilities,    CASE WHEN s.liabilities    ~ '^[0-9]{1,18}$' THEN s.liabilities::bigint      END),
                criminal_cases = COALESCE(c.criminal_cases, CASE WHEN s.criminal_cases ~ '^[0-9]{1,4}$'  THEN s.criminal_cases::smallint END)
            FROM src s
            WHERE c.id = s.id
              AND (s.age IS NOT NULL OR s.assets IS NOT NULL OR s.liabilities IS NOT NULL OR s.criminal_cases IS NOT NULL)
        $sql$;

        -- gender / education belong to the person: copy up where the person's column is empty.
        -- Per field, the newest election's candidate that has a usable value decides.
        EXECUTE $sql$
            WITH vals AS (
                SELECT c.person_id, c.id, e.year,
                       NULLIF(btrim(c.metadata->>'gender'), '') AS gender,
                       NULLIF(btrim(COALESCE(c.metadata->>'education', c.metadata#>>'{affidavit,education}')), '') AS education
                FROM candidates c
                LEFT JOIN elections e ON e.id = c.election_id
                WHERE c.metadata IS NOT NULL AND c.metadata <> '{}'::jsonb
            ), src AS (
                SELECT person_id,
                       (array_agg(gender    ORDER BY year DESC NULLS LAST, id) FILTER (WHERE length(gender)    <= 10))[1]  AS gender,
                       (array_agg(education ORDER BY year DESC NULLS LAST, id) FILTER (WHERE length(education) <= 255))[1] AS education
                FROM vals
                GROUP BY person_id
            )
            UPDATE persons p SET
                gender    = COALESCE(p.gender,    s.gender),
                education = COALESCE(p.education, s.education)
            FROM src s
            WHERE p.id = s.person_id
              AND ((p.gender IS NULL AND s.gender IS NOT NULL) OR (p.education IS NULL AND s.education IS NOT NULL))
        $sql$;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'persons' AND column_name = 'metadata') THEN
        EXECUTE $sql$
            UPDATE persons SET
                bio           = COALESCE(bio,           CASE WHEN jsonb_typeof(metadata->'bio')           = 'string' THEN NULLIF(btrim(metadata->>'bio'), '')           END),
                wikipedia_url = COALESCE(wikipedia_url, CASE WHEN jsonb_typeof(metadata->'wikipedia_url') = 'string' THEN NULLIF(btrim(metadata->>'wikipedia_url'), '') END),
                caste         = COALESCE(caste,         CASE WHEN jsonb_typeof(metadata->'caste')         = 'string' THEN NULLIF(btrim(metadata->>'caste'), '')         END),
                religion      = COALESCE(religion,      CASE WHEN jsonb_typeof(metadata->'religion')      = 'string' THEN NULLIF(btrim(metadata->>'religion'), '')      END)
            WHERE metadata IS NOT NULL
              AND metadata ?| ARRAY['bio', 'wikipedia_url', 'caste', 'religion']
        $sql$;
    END IF;
END $$;

-- 4. person_id FK -> ON DELETE RESTRICT (same name) ---------------------------------------------

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint
               WHERE conrelid = 'candidates'::regclass AND conname = 'candidates_person_id_fkey' AND confdeltype <> 'r') THEN
        ALTER TABLE candidates DROP CONSTRAINT candidates_person_id_fkey;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'candidates'::regclass AND conname = 'candidates_person_id_fkey') THEN
        ALTER TABLE candidates ADD CONSTRAINT candidates_person_id_fkey
            FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
    END IF;
END $$;

-- 5. Triggers -----------------------------------------------------------------------------------

-- Constant time per row: one INSERT and one UPDATE by primary key.
CREATE OR REPLACE FUNCTION candidates_create_person() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    pid UUID;
BEGIN
    INSERT INTO persons (name, state_id)
    VALUES (NEW.name, (SELECT k.state_id FROM constituencies k WHERE k.id = NEW.const_id))
    RETURNING id INTO pid;
    UPDATE candidates SET person_id = pid WHERE id = NEW.id AND person_id IS NULL;
    RETURN NULL;
END $$;

CREATE OR REPLACE TRIGGER candidates_create_person
    AFTER INSERT ON candidates
    FOR EACH ROW WHEN (NEW.person_id IS NULL)
    EXECUTE FUNCTION candidates_create_person();

-- NEW is the row as it was when the event was queued; re-read it, since the AFTER INSERT
-- trigger (or a later statement) may have set person_id since. A row deleted later in the
-- same transaction is fine.
CREATE OR REPLACE FUNCTION candidates_require_person() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM candidates WHERE id = NEW.id AND person_id IS NULL) THEN
        RAISE EXCEPTION 'candidate % has no person', NEW.id
            USING ERRCODE = 'not_null_violation', TABLE = 'candidates', COLUMN = 'person_id';
    END IF;
    RETURN NULL;
END $$;

-- CREATE OR REPLACE does not apply to constraint triggers: create it only if missing.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
                   WHERE tgrelid = 'candidates'::regclass AND tgname = 'candidates_require_person') THEN
        CREATE CONSTRAINT TRIGGER candidates_require_person
            AFTER INSERT OR UPDATE ON candidates
            DEFERRABLE INITIALLY DEFERRED
            FOR EACH ROW WHEN (NEW.person_id IS NULL)
            EXECUTE FUNCTION candidates_require_person();
    END IF;
END $$;

-- OLD.person_id is NULL when the AFTER INSERT trigger fills a new row: nothing to delete.
-- On a multi-row move every row's check runs after the whole statement, so the person goes on
-- the first check and the rest find nothing.
CREATE OR REPLACE FUNCTION candidates_delete_orphan_person() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.person_id IS NULL THEN
        RETURN NULL;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.person_id IS NOT DISTINCT FROM OLD.person_id THEN
        RETURN NULL;
    END IF;
    DELETE FROM persons p
    WHERE p.id = OLD.person_id
      AND NOT EXISTS (SELECT 1 FROM candidates c WHERE c.person_id = OLD.person_id);
    RETURN NULL;
END $$;

CREATE OR REPLACE TRIGGER candidates_delete_orphan_person
    AFTER UPDATE OF person_id OR DELETE ON candidates
    FOR EACH ROW
    EXECUTE FUNCTION candidates_delete_orphan_person();

-- 6. Merge log ----------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS person_merges (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keeper_id     UUID REFERENCES persons(id) ON DELETE SET NULL,
    duplicate     JSONB NOT NULL,
    candidate_ids UUID[] NOT NULL,
    filled_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    merged_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    merged_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    undone_at     TIMESTAMPTZ,
    undone_by     UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_person_merges_keeper ON person_merges (keeper_id);

-- A database that ran an earlier draft of 018 has keeper_id NOT NULL ... ON DELETE CASCADE.
ALTER TABLE person_merges ALTER COLUMN keeper_id DROP NOT NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint
               WHERE conrelid = 'person_merges'::regclass AND conname = 'person_merges_keeper_id_fkey' AND confdeltype <> 'n') THEN
        ALTER TABLE person_merges DROP CONSTRAINT person_merges_keeper_id_fkey;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid = 'person_merges'::regclass AND conname = 'person_merges_keeper_id_fkey') THEN
        ALTER TABLE person_merges ADD CONSTRAINT person_merges_keeper_id_fkey
            FOREIGN KEY (keeper_id) REFERENCES persons(id) ON DELETE SET NULL ON UPDATE NO ACTION;
    END IF;
END $$;

-- keeper_ref: the original keeper id, kept when keeper_id is SET NULL. Backfilled from keeper_id, then
-- from the PERSON_MERGE audit row (entity_id = keeper, new_value.merge_id) for a row whose keeper is gone.
ALTER TABLE person_merges ADD COLUMN IF NOT EXISTS keeper_ref UUID;
UPDATE person_merges SET keeper_ref = keeper_id WHERE keeper_ref IS NULL AND keeper_id IS NOT NULL;
UPDATE person_merges m SET keeper_ref = a.entity_id::uuid
FROM audit_logs a
WHERE m.keeper_ref IS NULL AND a.action = 'PERSON_MERGE' AND a.entity_type = 'person'
  AND a.new_value->>'merge_id' = m.id::text;
ALTER TABLE person_merges ALTER COLUMN keeper_ref SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_person_merges_keeper_ref ON person_merges (keeper_ref);

-- 7. Archive leftover metadata, then drop the JSON columns, last -------------------------------
-- The whole object is archived when any key is left that no column took (the nested affidavit
-- also holds fields with no column, so it counts as left over). No FK: the archive outlives
-- deleted rows. Skipped once the column is gone; NOT EXISTS keeps a row from being archived twice.

CREATE TABLE IF NOT EXISTS candidate_metadata_archive (
    candidate_id UUID NOT NULL,
    metadata     JSONB NOT NULL,
    archived_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidate_metadata_archive_candidate ON candidate_metadata_archive (candidate_id);

CREATE TABLE IF NOT EXISTS person_metadata_archive (
    person_id   UUID NOT NULL,
    metadata    JSONB NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_person_metadata_archive_person ON person_metadata_archive (person_id);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'candidates' AND column_name = 'metadata') THEN
        EXECUTE $sql$
            INSERT INTO candidate_metadata_archive (candidate_id, metadata)
            SELECT c.id, c.metadata
            FROM candidates c
            WHERE jsonb_typeof(c.metadata) = 'object'
              AND (c.metadata - ARRAY['age', 'assets', 'liabilities', 'criminal_cases', 'gender', 'education']) <> '{}'::jsonb
              AND NOT EXISTS (SELECT 1 FROM candidate_metadata_archive a WHERE a.candidate_id = c.id)
        $sql$;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'persons' AND column_name = 'metadata') THEN
        EXECUTE $sql$
            INSERT INTO person_metadata_archive (person_id, metadata)
            SELECT p.id, p.metadata
            FROM persons p
            WHERE jsonb_typeof(p.metadata) = 'object'
              AND (p.metadata - ARRAY['bio', 'wikipedia_url', 'caste', 'religion']) <> '{}'::jsonb
              AND NOT EXISTS (SELECT 1 FROM person_metadata_archive a WHERE a.person_id = p.id)
        $sql$;
    END IF;
END $$;

ALTER TABLE candidates DROP COLUMN IF EXISTS metadata;
ALTER TABLE persons    DROP COLUMN IF EXISTS metadata;

COMMIT;
