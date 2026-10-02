# Every candidate has a person: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `candidates.person_id` mandatory. Move every field the two records share onto the person, leaving the candidate with only candidacy facts. Replace unlink with change and split, and add an undoable merge that only a super admin can run.

**Architecture:** Database triggers do the work that every write path needs:
- a person is created for each inserted candidate that has none;
- a deferred check confirms every candidate has a person;
- a person left with no candidates is deleted.

With that in place, the seeds, importers and live paths need no logic of their own. The backend adds a merge log table plus change, split and undo endpoints. The admin pages are reworked around "always has a person".

**Tech stack:** PostgreSQL 15 triggers, Prisma, NestJS, React admin, React public site.

**Spec (binding):** `docs/superpowers/specs/2026-10-02-person-required-design.md`. Read all of it.

## Global constraints

- **Migration:** `database/migrations/018_person_required.sql`. It must be idempotent (`IF NOT EXISTS`, `DO` blocks, `CREATE OR REPLACE FUNCTION`, triggers created only if missing) and must not depend on seed data.
- **Database rebuilds:** `setup.sh` on an empty volume must succeed. Running it a second time must create 0 new persons and leave 0 candidates without a person.
- **Prisma:** `backend/prisma/schema.prisma` must match the SQL. Check with `prisma migrate diff`, with `DIRECT_URL` set.
- **Roles:** only SUPER_ADMIN can merge or undo a merge. SUPER_ADMIN and EDITOR can change a person or split.
- **Audit actions:** reuse the existing ones where they fit (`PERSON_MERGE`, `CANDIDATE_LINK_PERSON` for change person). Add `PERSON_MERGE_UNDO`, `CANDIDATE_SPLIT` and `PERSON_DELETE`, the last written when an admin action leaves a person empty. Add all three to the admin Audit logs labels.
- **Copy:** sentence case, IST dates, and the spelling "MatdaanPulse".
- **Commit trailer, verbatim:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Checks before every commit:**
  - admin: `npx vitest run && npm run build`
  - backend: `npx jest && npx tsc --noEmit -p tsconfig.json`
  - frontend, when touched: `npx vitest run`
- **Local DB:** `docker exec -i election_tracker_db psql -U admin -d election_tracker`.

## Review focus

1. **Re-running seeds creates no stray persons.** `ON CONFLICT DO NOTHING` skips rows, and Bihar candidates are re-pointed. Pin this with a DB test or script in Task 1: run the seed set twice and assert the person count is unchanged and there are no orphans.
2. **A bulk insert of about 3,000 candidates in one statement stays fast.** The per-row AFTER trigger must not run anything slower than a constant-time query per row. Measure it in Task 1 and report the time.
3. **Undo after a later move is refused cleanly.** Expect a 409 with the candidate names, never a partial restore. Pin this in Task 2.
4. **Merge, then undo, restores the record exactly:** the same person id, the same fields, the same contests, and the keeper's filled fields reverted. Pin this in Task 2.
5. **The live path:** the simulation `setup.ts` and admin "New candidate" both end with a person attached. Pin this in Tasks 1 and 3.

---

### Task 1: Migration 018, seeds, Prisma, DB tests

**Files:**
- `database/migrations/018_person_required.sql`
- `database/setup.sh`, only if migration discovery needs it
- the 19 `database/seed_*_vs_*.sql` files that list `metadata`
- the matching `scraper/src/generate-*.ts`
- `scraper/src/simulation/setup.ts`
- `backend/prisma/schema.prisma`
- a new DB-backed spec, following the existing `REQUIRE_DB_TESTS` pattern from Task 1 of the record-pages plan

**Steps:**
- [ ] **New columns.**
  - candidates: `age SMALLINT`, `assets BIGINT` (rupees), `liabilities BIGINT`, `criminal_cases SMALLINT`, each with a `CHECK (… >= 0)`.
  - persons: `bio TEXT`, `wikipedia_url TEXT`, `caste TEXT`, `religion TEXT`.
  - Copy into these columns from `metadata` wherever the keys exist and the values parse. `persons.metadata` keys may be `bio`, `wikipedia_url`, `caste` or `religion`. `candidates.metadata` keys may be `age`, `assets`, `liabilities` or `criminal_cases`.
  - Leave gender and education alone: they already exist on persons. If a candidate's metadata has `gender` or `education` and its person's column is NULL, copy the value up.
- [ ] **Backfill.**
  - Insert one person per candidate that has `person_id IS NULL`, set-based: name = the candidate name, `state_id` from the candidate's constituency.
  - Link them with one `UPDATE … FROM`. Map rows using a temporary table with `gen_random_uuid()` per candidate.
- [ ] **Triggers.**
  1. `candidates_create_person` AFTER INSERT FOR EACH ROW WHEN (NEW.person_id IS NULL): insert a person, then `UPDATE candidates SET person_id`.
  2. `candidates_require_person` CONSTRAINT TRIGGER AFTER INSERT OR UPDATE DEFERRABLE INITIALLY DEFERRED: raise when the row's current `person_id` is still NULL. Re-read the row by id, because NEW is stale.
  3. `candidates_delete_orphan_person` AFTER UPDATE OF person_id OR DELETE: when `OLD.person_id IS DISTINCT FROM NEW.person_id`, or on delete, delete `OLD.person_id` if no candidate references it.
- [ ] **Foreign key.** Change the `person_id` FK to `ON DELETE RESTRICT`. Do not add a column-level NOT NULL; enforcement is the deferred trigger (spec, rule 2). Prisma marks the field required, because rows are never NULL after a commit.
- [ ] **Merge log.** Create the `person_merges` table exactly as the spec lists it, with an index on `keeper_id`.
- [ ] **Drop the JSON columns.** Drop `candidates.metadata` and `persons.metadata` as the last statements, guarded with `IF EXISTS`.
- [ ] **Seeds and generators.**
  - Remove `metadata` from the 19 seed column lists and drop the trailing `'{}'` value from each row. Do this mechanically and verify every removed value was exactly `'{}'`.
  - Make the same change in the generators and in `simulation/setup.ts`.
  - Check every other `INSERT INTO candidates` and `INSERT INTO persons` (seeds, generators, backend services) for references to metadata.
- [ ] **Rebuild and measure.**
  - Rebuild a throwaway DB from scratch with `setup.sh`, using a temporary database name on the same server and env overrides; check `setup.sh` for the variables it reads.
  - Run it twice. Report the person count after each run, the number of orphans, and the number of candidates without a person.
  - Time the largest single seed insert and report it.
  - Apply 018 to the main local DB.
- [ ] **DB specs:**
  - insert without a person auto-creates one;
  - `ON CONFLICT DO NOTHING` on an existing id creates no person;
  - re-pointing a candidate deletes the now-empty person;
  - deleting a candidate deletes its now-empty person;
  - a commit with a NULL person fails;
  - 018 run twice is a no-op.
- [ ] Commit.

### Task 2: Backend: field moves, merge log and undo, change person, split

**Files:** `backend/src/modules/candidates/*` (persons.service, candidates.service, dto/*), `backend/src/modules/admin/controllers/admin-{persons,candidates}.controller.ts`, `backend/src/modules/admin/dto/admin-response.dto.ts`, `backend/src/modules/audit-log/*`, the public candidate and person DTOs, and the specs.

- [ ] **Candidate DTOs.** Remove `metadata`, gender and education from candidate input and response DTOs; add `age`, `assets`, `liabilities` and `criminal_cases`. Input is validated as integers ≥ 0, and `emptyToNull` turns blanks into null.
- [ ] **Person DTOs.** Person input and response DTOs use the `bio`, `wikipedia_url`, `caste` and `religion` columns; delete the `metadata?.bio` transforms.
- [ ] **Merge.** `merge(duplicateId, keeperId, userId)`, in one transaction:
  - snapshot the duplicate row;
  - fill the keeper's NULL fields from the duplicate, recording `filled_fields` (field to previous value, which is null);
  - move the candidates;
  - let the orphan trigger delete the duplicate;
  - insert into `person_merges`;
  - write the audit row.
  - Keep the existing argument order and the SUPER_ADMIN guard.
- [ ] **Undo.** `undoMerge(mergeId, userId)`, SUPER_ADMIN only, in one transaction:
  - 404 if the merge doesn't exist; 409 if it has already been undone;
  - 409 if any of the logged candidates is no longer on the keeper, with a message naming them;
  - recreate the duplicate with its original id and fields;
  - restore the keeper's `filled_fields` (only where the keeper still holds the filled value);
  - move the logged candidates back;
  - set `undone_at` and `undone_by`;
  - write the audit row `PERSON_MERGE_UNDO`.
  - Route: `POST /admin/persons/merges/:id/undo`.
- [ ] **Change person.** `PUT /admin/candidates/:id/person { person_id }` (SUPER_ADMIN, EDITOR):
  - 404 if the person doesn't exist; a no-op if it's the same person;
  - write the audit row `CANDIDATE_LINK_PERSON`;
  - if the old person was deleted by the trigger, also write `PERSON_DELETE` with that person's snapshot. Take the snapshot before the move.
- [ ] **Split.** `POST /admin/candidates/:id/split`:
  - create a person from the candidate (name, the seat's state) and move the candidate to it;
  - write the audit row `CANDIDATE_SPLIT`, plus `PERSON_DELETE` if the old person was left empty;
  - return the new person id.
- [ ] **Remove unlink.** Remove `DELETE /admin/candidates/:id/link-person` and the service unlink. `PUT …/link-person` becomes an alias of change person, or is removed if the admin no longer calls it; check that.
- [ ] **Person detail.** `GET /admin/persons/:id` gains `merges: Array<{ id, duplicate_name, candidate_count, merged_at, merged_by: string|null, undoable: boolean }>`, newest first, including undone ones (`undoable = false`).
- [ ] **Contests filter.** The admin persons list accepts `contests=1|2plus`.
- [ ] **Other references.** Remove every remaining read of `candidates.metadata` and `persons.metadata` in the backend: auto-link, search, seat-result, the constituency analysis code, and so on.
- [ ] **Specs:**
  - review focus 3 and 4;
  - merge fills only NULL fields;
  - undo restores the keeper's filled fields and leaves fields the keeper changed after the merge untouched;
  - split and change delete the orphan and audit it;
  - the role guards;
  - DTO validation.
- [ ] Commit.

### Task 3: Admin: candidate and person pages, persons list, audit labels

**Files:** `admin/src/types/index.ts` and services; `components/entity/candidates/*` (CandidateRecord, CandidateMasterCard, the affidavit card), `useCandidateEdit`, `useCandidateManager`, `CandidateCreate…`; `components/entity/persons/*`, `usePersonEdit`, `pages/Persons.tsx`; `utils/audit.ts`; tests.

- [ ] **Candidate Affidavit card:** age, assets (keep the crore/lakh helper), liabilities (same helper) and criminal cases, all typed numbers. Blank is null; 0 stays 0.
- [ ] **Candidate Master record card:**
  - Always show the person: avatar, name, "N contests · first YYYY", and "Open person →".
  - Add a **Change person** button. It opens a search of persons, reusing the existing search, and saves with a confirm.
  - Add a **Split into new person** button, with a confirm: "This contest moves to a new person record." After it succeeds, show the new person.
  - The old suggested matches become **Possible duplicates**: rows that link to the other candidate's person page, where merge lives. Drop the "Link selected" flow.
  - Remove the unlink and "create master record" UI.
- [ ] **Person page:**
  - The Profile card gains editable caste and religion, which replace the read-only "Census tags".
  - Bio and Wikipedia save to the columns.
  - Add a **Merge history** card that lists `merges`: "<duplicate name> · N contests · merged <IST> by <name>". It has an **Undo** button for SUPER_ADMIN when `undoable`, with a confirm that names what will be restored, then a refresh. Show the "Undone" label otherwise.
  - Merge shows a success toast that mentions undo.
- [ ] **Persons list:** add a "Contests" filter (All / 1 contest / 2 or more) and keep it in the list state.
- [ ] **Audit labels:**
  - "Merge undone" for `PERSON_MERGE_UNDO`;
  - "Contest split to new person" for `CANDIDATE_SPLIT`;
  - "Person deleted (no contests left)" for `PERSON_DELETE`;
  - relabel `CANDIDATE_LINK_PERSON` to "Candidate moved to person".
- [ ] **Tests:**
  - the change, split and undo flows, including that EDITOR doesn't see Undo;
  - the affidavit null and 0 handling;
  - the contests filter;
  - no remaining "Unlink" text.
- [ ] Commit.

### Task 4: Public site, docs, about data

**Files:** `frontend/src/model/types/index.ts`, `frontend/src/pages/PersonDetail.tsx` (it reads `person.metadata?.wikipedia_url`), anything else in `frontend/src` that reads candidate or person metadata, `docs/FEATURES.md`, `CLAUDE.md` (Database setup: the person trigger; seeds no longer carry candidate metadata), `docs/design/admin/NOTES.md`.

- [ ] Switch the public reads to the new top-level fields (`wikipedia_url`, `bio`, `caste`/`religion` if shown). Keep their tests passing.
- [ ] **Docs:** a FEATURES "Persons and candidates" section covering:
  - the model table from the spec;
  - the triggers;
  - merge and undo;
  - change and split;
  - the contests filter.
  - Also add a CLAUDE.md line: "every candidate has a person; inserts without one get an auto-created person (trigger, migration 018); never write `metadata` on candidates or persons, as those columns are gone."
- [ ] Commit.
