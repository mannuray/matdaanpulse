# Every candidate has a person: design

**Status:** approved 2026-10-02 (revised after a seed audit: AFTER-insert trigger, deferred NOT NULL, orphan-delete trigger, seeds drop `metadata`). **Owner decisions** (user, 2026-10-02):
- Candidate and person stay separate records.
- Every candidate must point to a person, and duplicates are fixed by merging.
- Anything the two have in common belongs to the person. The candidate holds only facts about that one candidacy.
- Undo merge exists and is super admin only.
- (Final review, 2026-10-02) Change person that moves a person's last contest is a real merge (logged, undoable); editors may do it, undo stays super admin only.

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
- `bio`, `wikipedia_url`, `caste` and `religion` move out of `persons.metadata` into columns. `caste` and `religion` are admin-only: the public person profile does not expose them.
- Both `metadata` columns are empty in the current data, so nothing needs copying. The migration still copies any keys it finds once, in case production differs, and archives every non-empty value. It keeps the JSON columns (expand only); a later migration drops them once this release is live everywhere.

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
   - When it is the person's last contest, it is a merge of that person into the target (rule 3): logged, the target's empty fields filled, undoable by a super admin. Editors may do it; the confirm says it will merge.
   - With two or more contests it is a plain move.
6. **Split** (on the Candidate page) moves one candidacy to a new person created from it. This replaces "Unlink", because "no person" is no longer a valid state. Split is refused (409, "This is the person's only contest") when the candidacy is its person's only one.
7. **Empty persons are deleted by the database**, with an audit row when the change came from the admin.
   - An `AFTER UPDATE OF person_id` / `AFTER DELETE` trigger on `candidates` deletes the old person once no candidates point to it.
   - It covers change person, split and merge (the duplicate disappears as its last candidate moves; the merge log has already snapshotted it).
   - It also covers `seed_bihar_persons.sql`, which re-points Bihar candidates from their auto-created persons to the curated ones (once; see Seeds).

## Migration (018)

All steps are idempotent:
0. Create `seed_runs(name, ran_at)`: run-once markers for seeds and one-off data steps.
1. Add the new columns (and re-add the `metadata` columns, empty, where an earlier draft of 018 dropped them).
2. Copy any metadata keys into them, once (marker `migration_018_metadata_copy`), so a value cleared later in the admin is not refilled by the next deploy.
3. Create one person for each candidate with no `person_id`, using the ballot name and the seat's state, and link them. This is one set-based `INSERT … SELECT` plus an `UPDATE`, about 11.4k rows locally, so there are no long locks.
4. Set `person_id` NOT NULL and the FK to RESTRICT.
5. Create the trigger.
6. Create the `person_merges` table (`id`, `keeper_id`, `keeper_ref`, `duplicate` JSONB, `candidate_ids` UUID[], `filled_fields` JSONB, `merged_by`, `merged_at`, `undone_at`, `undone_by`).
   - `keeper_id` is a nullable FK (ON DELETE SET NULL). `keeper_ref` is the original keeper id, NOT NULL with no FK. History and undo use `keeper_ref`, so a chain of merges (X into K, then K into Z) can be undone newest first.
   - Undo refuses (409) while no person with id `keeper_ref` exists. An undo that recreates a person re-points `keeper_id` on older merges whose `keeper_ref` is that person.
7. Archive every non-empty `candidates.metadata` / `persons.metadata` value (moved keys included) into `candidate_metadata_archive` / `person_metadata_archive`, once per row. The columns are **not** dropped: the previous backend still selects them during the deploy. They are nullable and `@ignore` in `schema.prisma`; a later migration drops them.
   - 19 seed files inserted `candidates (…, metadata)`, and every value was `'{}'`.
   - Those files, their generators in `scraper/src/generate-*.ts`, and `scraper/src/simulation/setup.ts` no longer write the column. This is a mechanical change; the rows themselves are unchanged.

**Seeds:**
- On a fresh DB, the VS seeds' inserts create one person per candidate.
- `seed_bihar_persons.sql` then re-points 958 Bihar candidates to the curated persons, and the empty auto persons are deleted.
- Re-running `setup.sh` creates no persons: conflicting inserts are skipped.
- `seed_bihar_persons.sql` and `seed_bihar_person_regions.sql` are run-once, so a deploy never undoes admin merges, splits, person changes or region edits. Each runs only when it has no `seed_runs` row and none of its curated persons already exists or appears in `person_merges` (for the regions file: none has a state or region yet), so production, where they ran long ago, only gets the marker. `seed_party_recognition.sql` and `seed_election_result_dates.sql` are run-once by marker only.

## API and UI

- **Backend:**
  - Candidate DTOs drop `gender` and `education` and gain typed affidavit fields.
  - Person DTOs gain the typed identity fields.
  - New endpoints: `POST /admin/persons/merges/:id/undo`, `PUT /admin/candidates/:id/person` (change), `POST /admin/candidates/:id/split`.
  - `DELETE /admin/candidates/:id/link-person` is removed.
  - `GET /admin/persons/:id` lists merges that can still be undone.
  - `PUT /admin/candidates/:id/person` returns `merge_id` when moving the last contest merged the person.
  - The public `GET /search/candidates` returns the public candidate summary plus `election_id` (no affidavit).
  - The public `/candidates/persons/:id` keeps its shape.
- **Admin, Candidate page:**
  - The Affidavit card shows only age, assets, liabilities and criminal cases.
  - The Master record card always shows a person, with "Change person" and "Split into new person".
  - The name-match suggestions become "Possible duplicates → open merge".
- **Admin, Person page:**
  - Holds the identity fields.
  - Merge as today.
  - A new "Merge history" card with "Undo" (super admin).
- **Admin, Persons list:** a "Contests" filter (1 / 2+ / None), so the single-contest persons don't crowd the list.
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
- **Change and split:** both write audit rows. Change person of a last contest writes a merge log that undo reverses; of one of several contests it is a plain move.
- **Search:** a hit with affidavit amounts is a 200 with no affidavit fields.
- **Seeds:** `setup.sh` on an empty DB, then again, ends with 0 candidates without a person and no duplicate persons. A split, a merge and a state edit on Bihar persons survive a re-run, with or without the `seed_runs` markers.
