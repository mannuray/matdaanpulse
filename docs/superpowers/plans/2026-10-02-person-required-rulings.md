# Every candidate has a person: rulings made during execution

Decisions taken while running `2026-10-02-person-required.md`. For each one: what was decided, why, and what it costs if wrong.

## User decisions (2026-10-02)

- Candidate and person stay separate records.
- Every candidate has a person, and shared fields live on the person.
- Undo merge exists and is super admin only.
- Moving a person's last contest with "Change person" is a real merge. It is logged, fills empty fields, and can be undone. Editors may do it; only a super admin can undo it.

## Revised after the seed audit

- **AFTER INSERT trigger, not BEFORE.** The seeds use `ON CONFLICT DO NOTHING`, and a BEFORE trigger would create stray persons on every re-run.
- **NOT NULL is a deferred constraint trigger,** not a column NOT NULL. Never apply Prisma's suggested `SET NOT NULL` on `candidates.person_id`.
- **Orphan-delete trigger.** A person left with no candidates is deleted automatically.
- **Seeds no longer write `metadata`.** The 9,140 removed values were all `'{}'`.

## Data safety

- **Archive before moving.** 018 archives every non-empty metadata object into `candidate_metadata_archive` / `person_metadata_archive` before moving values into columns.
- **Expand/contract.** 018 does not drop the `metadata` columns, so an old backend keeps working mid-deploy. A later migration drops them once this release is live.
- **Merge log.** `person_merges.keeper_ref` holds the original keeper with no foreign key. Chained merges stay undoable.
- **Concurrent edits.** Merge and undo move only rows still on the expected person; otherwise they return 409 with a full rollback.
- **Split.** Splitting a person's only contest is refused (409).
- **Run-once seeds.** `seed_bihar_persons.sql`, `seed_bihar_person_regions.sql`, `seed_party_recognition.sql` and `seed_election_result_dates.sql` record a `seed_runs` marker.
  - The Bihar person seed also skips when its curated persons already exist.
  - The regions seed also skips when any curated person already has a state or region, or appears in the merge log.
  - Effect: later deploys never undo admin edits or merges. On the first production deploy the recognition and result-date seeds run once more.

## API

- **Caste and religion are admin-only.** They are not in the public API, so the public shape is unchanged. The user can override this.
- **`/search/candidates` uses a DTO.** No BigInt, no affidavit fields in public output.
- **Assets and liabilities** are BIGINT in the database and numbers in JSON (a shared helper).

## Accepted risks

- A rare foreign-key error when two admins move a person's last contest at the same moment. Retry.
- Archiving runs once per row.

## Follow-ups

- Scored duplicate matching.
- A migration that drops the `metadata` columns.
