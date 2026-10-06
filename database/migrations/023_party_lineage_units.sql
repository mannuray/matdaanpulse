-- 023: party lineage (renames, mergers, splits) and per-state party units with leadership terms.
-- Spec: docs/superpowers/specs/2026-10-06-party-model-design.md. Idempotent; no seed-data dependency.

-- A lineage event: `party_id` came from `predecessor_id`.
--   rename  — one row, new ← old (is_successor true)
--   merger  — one row, absorber ← absorbed (is_successor true: the absorber carries the absorbed party's history)
--   split   — one row per faction ← the old party; exactly the ECI-recognised faction has is_successor true
--   breakaway — a new party founded by leaders who left (JJP from INLD): a note only, comparisons treat it as unrelated
-- state_id set = the event applies only to that state's comparisons (a state unit breaking away).
CREATE TABLE IF NOT EXISTS party_lineage (
    id             SERIAL PRIMARY KEY,
    party_id       VARCHAR(20) NOT NULL REFERENCES parties(id) ON UPDATE CASCADE,
    predecessor_id VARCHAR(20) NOT NULL REFERENCES parties(id) ON UPDATE CASCADE,
    kind           VARCHAR(10) NOT NULL,
    effective_date DATE NOT NULL,
    state_id       INTEGER REFERENCES states(id),
    is_successor   BOOLEAN NOT NULL DEFAULT false,
    note           TEXT,
    source_url     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT party_lineage_kind CHECK (kind IN ('rename', 'merger', 'split', 'breakaway')),
    CONSTRAINT party_lineage_not_self CHECK (party_id <> predecessor_id)
);
-- Databases that ran an earlier draft of this migration: allow 'breakaway'.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'party_lineage_kind' AND pg_get_constraintdef(oid) LIKE '%breakaway%') THEN
    ALTER TABLE party_lineage DROP CONSTRAINT IF EXISTS party_lineage_kind;
    ALTER TABLE party_lineage ADD CONSTRAINT party_lineage_kind CHECK (kind IN ('rename', 'merger', 'split', 'breakaway'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_party_lineage ON party_lineage (party_id, predecessor_id, COALESCE(state_id, 0));
CREATE INDEX IF NOT EXISTS idx_party_lineage_predecessor ON party_lineage (predecessor_id);

-- A party's unit in one state: ECI recognition there (a state party is recognised state by state) and its office.
CREATE TABLE IF NOT EXISTS party_units (
    party_id        VARCHAR(20) NOT NULL REFERENCES parties(id) ON UPDATE CASCADE,
    state_id        INTEGER NOT NULL REFERENCES states(id),
    eci_recognition VARCHAR(20),
    office          VARCHAR(255),
    website         TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (party_id, state_id),
    CONSTRAINT party_units_recognition CHECK (eci_recognition IS NULL OR eci_recognition IN ('National', 'State', 'Unrecognised'))
);

-- Who held a unit role, when. Current = to_date IS NULL. person_id links the person page when the person exists.
CREATE TABLE IF NOT EXISTS party_unit_roles (
    id          SERIAL PRIMARY KEY,
    party_id    VARCHAR(20) NOT NULL,
    state_id    INTEGER NOT NULL,
    role        VARCHAR(30) NOT NULL,
    person_id   UUID REFERENCES persons(id) ON DELETE SET NULL,
    person_name VARCHAR(255) NOT NULL,
    from_date   DATE,
    to_date     DATE,
    source_url  TEXT,
    FOREIGN KEY (party_id, state_id) REFERENCES party_units(party_id, state_id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT party_unit_roles_role CHECK (role IN ('state_president', 'legislature_leader'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_party_unit_roles ON party_unit_roles (party_id, state_id, role, person_name, COALESCE(from_date, DATE '1900-01-01'));
CREATE INDEX IF NOT EXISTS idx_party_unit_roles_person ON party_unit_roles (person_id);
