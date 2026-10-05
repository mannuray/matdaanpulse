BEGIN;

-- Run once (seed_runs). Corrects a curated merge in seed_bihar_persons.sql: Pipra (AC 17) 2025 had two candidates named
-- Rajmangal Prasad — the CPI(M) candidate (52) and an independent (77) — and both were put on one person. The
-- independent gets a person of his own. Skipped when an admin has already separated them.
SELECT NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_bihar_person_fixes_v1')
   AND EXISTS (SELECT 1 FROM candidates a JOIN candidates b ON a.person_id = b.person_id
               WHERE a.id = 'fc1624be-d427-4148-937d-e22698c62377' AND b.id = '839e3de1-aa8d-4f51-8ad1-b95cfaff8206')
   AS seed_apply \gset
\if :seed_apply

WITH p AS (INSERT INTO persons (name) SELECT name FROM candidates WHERE id = 'fc1624be-d427-4148-937d-e22698c62377' RETURNING id)
UPDATE candidates SET person_id = (SELECT id FROM p) WHERE id = 'fc1624be-d427-4148-937d-e22698c62377';

\endif
INSERT INTO seed_runs (name) VALUES ('seed_bihar_person_fixes_v1') ON CONFLICT (name) DO NOTHING;

COMMIT;
