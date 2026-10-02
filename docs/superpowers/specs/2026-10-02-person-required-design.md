# Every candidate has a person: design

**Status:** approved 2026-10-02 (revised after a seed audit: AFTER-insert trigger, deferred NOT NULL, orphan-delete trigger, seeds drop `metadata`). **Owner decisions** (user, 2026-10-02):
- Candidate and person stay separate records.
- Every candidate must point to a person, and duplicates are fixed by merging.
- Anything the two have in common belongs to the person. The candidate holds only facts about that one candidacy.
- Undo merge exists and is super admin only.

## Why

Only 958 of 12,379 candidates (8%, all in Bihar) are linked to a person today. Profiles and election history are empty for every other state and for the Lok Sabha. Every page also needs code for the "unlinked" case.

## Model

| Record | Holds | Fields |
|---|---|---|
| **Person**: who someone is, across all elections | Identity | `name` (canonical display name), `date_of_birth`, `gender`, `education` (highest known qualification), `photo_url`, `bio`, `wikipedia_url`, `caste`, `religion`, home `state_id` / `district_id` / `region_id` |
| **Candidate**: one run, in one seat, in one election | Candidacy only | `person_id` (required), `election_id`, `const_id`, `party_id`, `name` as filed on the ballot (results and live ingestion match on it), `is_incumbent`, affidavit for this run: `age` (age at nomination), `assets`, `liabilities`, `criminal_cases`. The result lives in `results`, as today. |

Changes from today:
- `gender` and `education` leave the candidate.
- The affidavit moves out of `candidates.metadata` into typed columns.
- `bio`, `wikipedia_url`, `caste` and `religion` move out of `persons.metadata` into columns.
- Both `metadata` columns are empty in the current data, so nothing needs copying. The migration still copies any keys it finds, in case production differs, and then drops the JSON columns.

**Why the ballot name stays on the candidate:** it is a fact about that one candidacy (spellings differ between affidavits), and result imports match on it. The person's `name` is the cleaned-up name used for display.

## Rules

1. **`candidates.person_id` is NOT NULL**, with `ON DELETE RESTRICT`. A person who still has candidates can't be deleted; you merge first.
2. **A person is created automatically**, but only for rows that are actually inserted.
   - An `AFTER INSERT` row trigger on `candidates` handles it. When `person_id` is null, it creates a person (name = ballot name, state = the seat's state) and sets `person_id`.
   - Why `AFTER` and not `BEFORE`: the seeds use `ON CONFLICT DO NOTHING`. A `BEFORE` trigger would fire for skipped rows too and create stray persons on every re-run. An `AFTER` trigger never fires for a skipped row.
   - Because a null `person_id` must survive until that trigger runs, NOT NULL is enforced by a deferred constraint trigger (`DEFERRABLE INITIALLY DEFERRED`). It raises at commit if any candidate still has no person.
   - The seeds, the scraper, the live simulation and the admin "New candidate" form keep working, and counting-day inserts never block.
3. **Merge** (super admin), from duplicate to keeper:
   - Moves every candidate to the keeper.
   - Fills the keeper's empty fields from the duplicate, but never overwrites values the keeper already has.
   - Deletes the duplicate.
   - Saves a merge log row with the duplicate's full person row and the list of candidate ids that moved.
4. **Undo merge** (super admin) is available from the keeper's Person page.
   - It recreates the duplicate with its original id and fields, moves the logged candidates back, and restores any keeper fields that the merge had filled.
   - It is allowed only if those candidates still belong to the keeper. If any were moved again afterwards, the undo is refused with a message naming them.
   - Each merge can be undone once, and both the merge and the undo are written to the audit log.
5. **Change person** (on the Candidate page) moves one candidacy to another existing person.
6. **Split** (on the Candidate page) moves one candidacy to a new person created from it. This replaces "Unlink", because "no person" is no longer a valid state.
7. **Empty persons are deleted by the database**, with an audit row when the change came from the admin.
   - An `AFTER UPDATE OF person_id` / `AFTER DELETE` trigger on `candidates` deletes the old person once no candidates point to it.
   - It covers change person, split and merge (the duplicate disappears as its last candidate moves; the merge log has already snapshotted it).
   - It also covers `seed_bihar_persons.sql`, which re-points Bihar candidates from their auto-created persons to the curated ones.

## Migration (018)

All steps are idempotent:
1. Add the new columns.
2. Copy any metadata keys into them.
3. Create one person for each candidate with no `person_id`, using the ballot name and the seat's state, and link them. This is one set-based `INSERT … SELECT` plus an `UPDATE`, about 11.4k rows locally, so there are no long locks.
4. Set `person_id` NOT NULL and the FK to RESTRICT.
5. Create the trigger.
6. Create the `person_merges` table (`id`, `keeper_id`, `duplicate` JSONB, `candidate_ids` UUID[], `filled_fields` JSONB, `merged_by`, `merged_at`, `undone_at`, `undone_by`).
7. Drop `candidates.metadata` and `persons.metadata` last, after the copy. `schema.prisma` is updated to match.
   - 19 seed files insert `candidates (…, metadata)`, and every value is `'{}'`.
   - Those files, their generators in `scraper/src/generate-*.ts`, and `scraper/src/simulation/setup.ts` drop the column. This is a mechanical change; the rows themselves are unchanged.

**Seeds:**
- On a fresh DB, the VS seeds' inserts create one person per candidate.
- `seed_bihar_persons.sql` then re-points 958 Bihar candidates to the curated persons, and the empty auto persons are deleted.
- Re-running `setup.sh` creates no persons: conflicting inserts are skipped, and re-pointing to the same person is a no-op.

## API and UI

- **Backend:**
  - Candidate DTOs drop `gender` and `education` and gain typed affidavit fields.
  - Person DTOs gain the typed identity fields.
  - New endpoints: `POST /admin/persons/merges/:id/undo`, `PUT /admin/candidates/:id/person` (change), `POST /admin/candidates/:id/split`.
  - `DELETE /admin/candidates/:id/link-person` is removed.
  - `GET /admin/persons/:id` lists merges that can still be undone.
  - The public `/candidates/persons/:id` keeps its shape.
- **Admin, Candidate page:**
  - The Affidavit card shows only age, assets, liabilities and criminal cases.
  - The Master record card always shows a person, with "Change person" and "Split into new person".
  - The name-match suggestions become "Possible duplicates → open merge".
- **Admin, Person page:**
  - Holds the identity fields.
  - Merge as today.
  - A new "Merge history" card with "Undo" (super admin).
- **Admin, Persons list:** a "Contests" filter (1 / 2+), so the single-contest persons don't crowd the list.
- **Public site:** every candidate now has a profile. `PersonDetail` already reads gender and education from the person, so no change is needed beyond the field names.

## Out of scope

Scored duplicate matching and a review queue (agreed for later). This change makes it a pure "suggest merges" tool.

## Testing

- **Migration:** idempotent; a second run is a no-op. Every candidate has a person afterwards. The trigger fires on insert without `person_id` and does nothing when it is set.
- **Merge and undo:**
  - Round trip restores ids, fields and candidates exactly.
  - Undo is refused after a later move.
  - Undo is super admin only.
  - Merging a person into itself is rejected.
- **Change and split:** an orphaned old person is deleted, and both write audit rows.
- **Seeds:** `setup.sh` on an empty DB, then again, ends with 0 candidates without a person and no duplicate persons.
