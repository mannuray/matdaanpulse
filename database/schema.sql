-- MatdaanPulse — Base Schema
--
-- This is the BASE schema. It is idempotent (safe to re-run) and is followed by
-- migrations/001..NNN, which bring it to the current schema. Do not apply this file
-- on its own — use database/setup.sh, which applies schema → migrations → seeds
-- in the correct order.

-- Enums
DO $$ BEGIN
    CREATE TYPE election_type AS ENUM ('LS', 'VS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE election_status AS ENUM ('Upcoming', 'Live', 'Finalized');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE constituency_type AS ENUM ('GEN', 'SC', 'ST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE result_status AS ENUM ('LEADING', 'WON', 'TRAILING', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'EDITOR', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1. states
CREATE TABLE IF NOT EXISTS states (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    total_assembly_seats INT NOT NULL DEFAULT 0,
    total_ls_seats INT NOT NULL DEFAULT 0
);

-- 2. districts
CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    state_id INT NOT NULL REFERENCES states(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL
);

-- 3. elections
CREATE TABLE IF NOT EXISTS elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type election_type NOT NULL,
    state_id INT REFERENCES states(id),
    year INT NOT NULL,
    status election_status NOT NULL DEFAULT 'Upcoming',
    tentative_next_date DATE,
    manifest_url TEXT
);

-- 4. parties
CREATE TABLE IF NOT EXISTS parties (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(10),
    symbol_url TEXT,
    abbreviation VARCHAR(20),
    leader_name VARCHAR(255),
    founded_year INTEGER,
    headquarters VARCHAR(255),
    website TEXT
);

-- 5. constituencies
CREATE TABLE IF NOT EXISTS constituencies (
    id VARCHAR(100) PRIMARY KEY,
    election_id UUID NOT NULL REFERENCES elections(id),
    district_id INT REFERENCES districts(id),
    state_id INT REFERENCES states(id),
    name VARCHAR(255) NOT NULL,
    const_no INT NOT NULL,
    type constituency_type NOT NULL DEFAULT 'GEN',
    voter_turnout DECIMAL(5,2),
    phase SMALLINT,
    total_electors INT
);

-- 6. persons
CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}',
    photo_url TEXT,
    gender VARCHAR(10),
    education VARCHAR(255),
    date_of_birth DATE
);

-- 7. candidates
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID REFERENCES persons(id),
    election_id UUID NOT NULL REFERENCES elections(id),
    const_id VARCHAR(100) NOT NULL REFERENCES constituencies(id),
    party_id VARCHAR(20) REFERENCES parties(id),
    name VARCHAR(255) NOT NULL,
    is_incumbent BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'
);

-- 8. results
CREATE TABLE IF NOT EXISTS results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES candidates(id),
    const_id VARCHAR(100) NOT NULL REFERENCES constituencies(id),
    election_id UUID NOT NULL CONSTRAINT fk_results_election REFERENCES elections(id),
    votes INT NOT NULL DEFAULT 0,
    status result_status NOT NULL DEFAULT 'TRAILING',
    margin INT DEFAULT 0,
    round_no INT DEFAULT 0,
    last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 9. users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'VIEWER',
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 10. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_results_candidate_id ON results(candidate_id);
CREATE INDEX IF NOT EXISTS idx_results_const_status ON results(const_id, status);
CREATE INDEX IF NOT EXISTS idx_results_election_id ON results(election_id);
CREATE INDEX IF NOT EXISTS idx_results_election_status ON results(election_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_election_const ON candidates(election_id, const_id);
CREATE INDEX IF NOT EXISTS idx_candidates_const_id ON candidates(const_id);
CREATE INDEX IF NOT EXISTS idx_elections_type_year ON elections(type, year);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_constituencies_election_id ON constituencies(election_id);
CREATE INDEX IF NOT EXISTS idx_constituencies_state_id ON constituencies(state_id);
