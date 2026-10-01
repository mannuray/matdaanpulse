# Admin record pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parties, Persons, Candidates and Constituencies stop using the 400px side panel. Each list becomes a full-width table, and a row opens a full record page (form on the left, related info on the right). The new data behind the right-hand cards is added.

**Architecture:**
- **Routing:** the route stays `/x/:id` via `useEntityRoute`. When an id is open, the list page renders a shared `RecordPage` layout instead of the table, and the table's search and filters are kept for the way back.
- **Creating:** create flows (parties, candidates) move into `FormDialog`.
- **Backend:** adds read endpoints for the derived data (party usage, a candidate's seat result, constituency history), one migration (`updated_at` + party ECI recognition + canonical phase), and audit rows for entity edits so each page can show "Last edited by".

**Tech stack:** NestJS + Prisma (PostgreSQL), React 18 + Vite + Tailwind v4 (preflight on) + Radix, Vitest/Jest.

**Spec:** there is no separate spec file. The decisions below were agreed with the user on 2026-10-02 and are the binding spec. Designs: `docs/design/admin/{party,person,candidate,constituency}-record.{png,html}`; the PNGs are the visual reference. Earlier admin spec: `docs/superpowers/specs/2026-10-01-admin-redesign-design.md`.

## Decisions (binding)

1. **Record pages:**
   - Clicking a row opens a full record page at the existing URL `/parties/:id`, `/persons/:id`, `/candidates/:id` or `/constituencies/:id`.
   - "← Parties" (etc.) returns to the list with its search, filters and page kept (the query string is preserved, as `useEntityRoute` does today).
   - The sidebar and top bar are unchanged.
   - There are no side panels on these four lists.
2. **Page layout (shared):**
   - Back link.
   - Header: a leading visual (colour swatch, photo, or number chip), the title, small tags, and a muted meta line. On the right: the dirty status ("Unsaved changes" with an amber dot, or "No changes"), Cancel (reverts) and Save changes.
   - Body: two columns, `2fr 1fr`, 24px gap. Left holds the form cards; right holds the related cards.
   - Cards are white with a 1px `line` border, `rounded-card`, a sentence-case title and an optional muted subtitle.
   - Every section is visible (no accordions).
   - The header wraps instead of overlapping when the title or meta is long.
3. **Unsaved guard:** keep the current guard. `useUnsavedGuard(dirty)` stays on, and "Discard unsaved changes?" is asked on the back link, sidebar links, the election picker, ⌘K and closing the tab.
4. **Create:** "New party" and "New candidate" open `components/ui/FormDialog`, with the same fields as today's create panels. After creating, the new record page opens. Persons and constituencies have no create flow, as today.
5. **What to drop from the Stitch screens:**
   - Settings, Documentation and "Cluster" in the sidebar.
   - The "Chief Returning Officer" user label.
   - ALL-CAPS group labels.
   - "Archive party", "Created by" as a separate field (replaced by "Last edited by"), ECI candidate serial, nomination date, per-candidate "Certified", "View full archive", "Voter elasticity" as a label (replaced by the volatility line below).
   - Party "ECI registration" becomes the new ECI recognition field.
6. **New data (agreed):**
   - **Last updated:** `updated_at TIMESTAMPTZ` on `parties`, `persons`, `candidates`, `constituencies`, set by a trigger on every UPDATE and defaulting to `now()`. The trigger runs only when the row actually changes (`IS DISTINCT FROM`).
   - **Last edited by:** admin edits of these four entities write audit rows. Actions: `PARTY_CREATE`, `PARTY_UPDATE`, `PERSON_UPDATE`, `PERSON_MERGE`, `CANDIDATE_CREATE`, `CANDIDATE_UPDATE`, `CANDIDATE_LINK_PERSON`, `CANDIDATE_UNLINK_PERSON`, `CONSTITUENCY_UPDATE`. Entity types: `party`, `person`, `candidate`, `constituency`. `old_value` and `new_value` hold only the changed fields. Each admin detail response gains `last_edit: { at: string; by: string | null } | null`, the newest audit row for that entity, where `by` is the user's name. The Audit logs page lists the new actions in its action filter, with readable labels.
   - **Party ECI recognition:** `parties.eci_recognition VARCHAR(20) NULL` with `CHECK (eci_recognition IN ('National','State','Unrecognised'))`. It is editable on the party page (select: Not set / National / State / Unrecognised) and is a filter on the Parties list. A new seed, `database/seed_party_recognition.sql`, sets `National` for BJP, INC, BSP, CPI(M), AAP and NPP, only where the value is NULL and only for party ids that exist.
   - **Polling phase canonical:** the `constituencies.phase` column is the only store. The migration copies `metadata->>'phase'` into `phase` where the column is NULL. The admin reads and writes the column, and stops writing `metadata.phase`.
7. **Derived data (agreed):**
   - **Party usage:** per election, the candidate count and wins; totals "N candidates · M elections". The card links each election row to `/candidates?election=<id>`.
   - **Person:** the contests count, the first year, a Won/Lost badge per contest (`WON` → Won; any other status on a Finalized election → Lost; otherwise the status text as is), and an Incumbent tag.
   - **Candidate result strip** (read only): votes, vote share (votes ÷ total votes in the seat), position (rank by votes), status badge, and margin. The margin is `results.margin` for the winner; for others it is the vote gap to the winner, shown as negative. Also a "Result declared" badge when the election is Finalized, and an "Other candidates in <seat>" list: rank, name, party, votes and share, with the current candidate highlighted and NOTA last. When the votes are all 0 or missing (for example TN 2021, which has margins only), show "No vote counts recorded" and still list the candidates.
   - **Constituency:** seat history read from results across elections with the same state, election type and `const_no`, newest first: year, winning party, winner, margin, turnout (where known). It does not depend on "Compute analysis". The volatility line reads "Party changed K times in N elections". Reservation (`type`: GEN/SC/ST) becomes an editable select. Turnout for this election comes from `voter_turnout`. The Analysis card shows what `constituency_analysis` holds (dominance, incumbency, notes) and the computed time, or "Not computed yet" with a hint to use Compute analysis.

## Global constraints

- Sentence case for all copy. Brand spelling "MatdaanPulse". IST for every date and time shown (`admin/src/utils/time.ts`).
- Tailwind only scans `src/components`, `src/pages`, `src/context`, `src/App.tsx`. No legacy CSS (`src/theme/legacy-free.test.ts`).
- Migrations are idempotent (`IF NOT EXISTS` / `DO` blocks) and never depend on seed data. Seeds update only NULLs and never `TRUNCATE`. `backend/prisma/schema.prisma` must match the SQL. The new migration is `database/migrations/017_record_pages.sql`, and `setup.sh` runs it (check how migrations are discovered there). The new seed runs after `seed_party_symbols.sql` in `setup.sh`, and is added to the seed order in `CLAUDE.md`.
- Admin roles are as today: SUPER_ADMIN and EDITOR edit, and person merge is SUPER_ADMIN only.
- Each audit row is written in the same transaction as the change when the service already uses one; otherwise immediately after a successful write. A failed audit write must not fail the user's save: catch it and log a warning.
- Commit trailer, verbatim: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Admin checks before every commit: `cd admin && npx vitest run && npm run build`. Backend: `cd backend && npx jest && npx tsc --noEmit -p tsconfig.json`.

## Review focus

1. **Back navigation keeps the list state:** open a record from page 3 of a filtered list, press "← Parties", and you land on page 3 with the same filter. Pin this with a test in Task 4.
2. **The guard on leaving a dirty record page:** the back link, a sidebar link and the election picker all ask "Discard unsaved changes?", and Cancel keeps you on the page. Pin this in Task 4.
3. **A seat with no vote counts** (TN 2021 margins only, or a seat not yet counted) must not divide by zero or show NaN%. Pin this with backend and admin tests in Tasks 2 and 6.
4. **A constituency id that doesn't parse, or a seat with no earlier elections:** history is an empty list with a "No earlier elections for this seat" message, never a 500. Pin this in Tasks 2 and 7.
5. **An audit write failing must not fail the save,** and `last_edit` is null for records never edited. Pin this in Task 1.

---

### Task 1: Migration, Prisma, audit rows, `last_edit`

**Files:**
- Create `database/migrations/017_record_pages.sql` and `database/seed_party_recognition.sql`.
- Modify `database/setup.sh`, `backend/prisma/schema.prisma`, `CLAUDE.md` (seed order + key data files).
- Modify the backend services and controllers for parties, persons, candidates and constituencies under `backend/src/modules/**`, plus their response DTOs. Add or extend their spec files.

**Interfaces:**
- **Produces:**
  - `updated_at` (ISO string) on every admin detail response for party, person, candidate and constituency.
  - `last_edit: { at: string; by: string | null } | null` on the same responses.
  - `eci_recognition: 'National' | 'State' | 'Unrecognised' | null` on party responses (public and admin), accepted by the create and update DTOs (validated with `IsIn`, nullable).
  - The admin party list accepts an `eci_recognition` query filter, including the value `none` for NULL.
  - Constituency responses expose the `phase` column, and the update DTO accepts `phase`.
- A helper `AuditLogService.lastEdit(entityType, entityId): Promise<{at, by} | null>`.

- [ ] Write `017_record_pages.sql`:
  - add `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` to the 4 tables (IF NOT EXISTS);
  - one shared trigger function `set_updated_at()` that sets `NEW.updated_at = now()` only when `NEW IS DISTINCT FROM OLD` (comparing all columns except `updated_at`, e.g. `ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*)` after aligning `updated_at`);
  - `BEFORE UPDATE` triggers, created in `DO` blocks guarded by `pg_trigger` lookups;
  - `parties.eci_recognition` with its CHECK constraint, guarded;
  - `UPDATE constituencies SET phase = metadata->>'phase' WHERE phase IS NULL AND metadata ? 'phase'`. Check the column type of `phase` and cast as needed.
  - Watch for live-version trigger interaction: migration 015 bumps the live version on parties and candidates writes, which is fine.
- [ ] Write `seed_party_recognition.sql`. Look up the real party ids in `database/seed*.sql` for BJP, INC, BSP, CPI(M) (it may be `CPM` or `CPI(M)`), AAP and NPP. Wire it into `setup.sh` after party symbols. Apply both files to the local DB twice; the second run must change nothing.
- [ ] Sync `schema.prisma` (`updated_at DateTime @default(now()) @db.Timestamptz(6)`, `eci_recognition String? @db.VarChar(20)`), then run `npx prisma generate`.
- [ ] Audit writes in each update, create, merge and link service method, with only the changed fields. Add `lastEdit` and include `last_edit` and `updated_at` in the detail responses.
- [ ] Tests:
  - every write path creates exactly one audit row with the right action;
  - an audit failure still returns success;
  - `last_edit` is null when there are no rows;
  - the party DTO rejects `eci_recognition: 'Foo'`;
  - the list filter covers `National` and `none`.
- [ ] Commit.

### Task 2: Derived read endpoints

**Files:** the backend admin controllers and services for parties, candidates and constituencies, plus their spec files.

**Interfaces (produces), all under the existing admin auth (SUPER_ADMIN, EDITOR):**
- `GET /admin/parties/:id/usage` returns `{ totals: { candidates: number; elections: number; wins: number }, elections: Array<{ election_id: string; name: string; type: 'LS'|'VS'; year: number; candidates: number; wins: number }> }`, newest year first. It returns 404 when the party is missing.
- `GET /admin/candidates/:id/result` returns `{ declared: boolean; total_votes: number; candidate: SeatRow | null; seat: SeatRow[] }`.
  - `SeatRow = { candidate_id; name; party_id: string|null; votes: number|null; share: number|null; position: number|null; status: string|null; margin: number|null }`.
  - `seat` is ordered by votes desc, with NOTA last. `share` is a 0–100 number with 1 decimal, and null when `total_votes` is 0.
  - `margin` follows Decision 7.
  - `declared` is true when the election status is `Finalized`.
- `GET /admin/constituencies/:id/history` returns `{ volatility: { elections: number; changes: number }, rows: Array<{ election_id; year; type; winner: string|null; party_id: string|null; margin: number|null; turnout: number|null; is_current: boolean }> }`, newest first.
  - It matches on the same state, election type and `const_no` (use the existing `extractConstNo` or the column).
  - An unknown id returns 404. A seat with no matches returns `rows: [current only]` or `[]`, never 500.

- [ ] Write failing service tests first:
  - a seat with votes;
  - a seat with all-zero or null votes (share null, positions by margin or null, no NaN);
  - a NOTA row;
  - the history of a seat across 3 elections with one party change (changes = 1);
  - an id that doesn't parse;
  - party usage totals.
- [ ] Implement with Prisma queries (raw SQL only if a GROUP BY needs it), then add the controllers and DTOs.
- [ ] Add a short "Admin API" note in `docs/FEATURES.md`. Commit.

### Task 3: Shared `RecordPage` layout + admin services/types

**Files:**
- Create `admin/src/components/record/RecordPage.tsx`, `RecordCard.tsx` and `record.test.tsx`.
- Modify `admin/src/types/index.ts`, and add service functions for the 3 endpoints from Task 2 plus the new fields: `getPartyUsage`, `getCandidateResult`, `getConstituencyHistory`.
- `@source` already covers `src/components`.

**Interfaces (produces):**
- `RecordPage` props: `{ backLabel: string; onBack: () => void; leading?: ReactNode; title: ReactNode; tags?: ReactNode; meta?: ReactNode; dirty: boolean; saving: boolean; canSave?: boolean; onCancel: () => void; onSave: () => void; saveLabel?: string; headerActions?: ReactNode; main: ReactNode; aside: ReactNode; loading?: boolean; error?: ReactNode }`.
  - It renders the back link as a `<button>`, the header with the dirty status, Cancel/Save, and `headerActions` before Cancel, then the 2fr/1fr grid.
  - It scrolls itself (`h-full overflow-y-auto`).
  - Pressing Enter in a form input inside `main` submits through `onSave` when dirty. Wrap `main` in a `<form>`.
- `RecordCard` props: `{ title: string; subtitle?: string; action?: ReactNode; children }`.
- `RecordMeta`: a small key/value list for the "Record" card, with `id` (monospace + copy button), "Last updated" (IST) and "Last edited by" ("Mannu K · 2 Oct 2026, 14:32", or "No edits recorded").

- [ ] Tests:
  - the header wraps (the class contract allows wrapping);
  - Save is disabled when the page is clean or `canSave` is false;
  - Cancel calls `onCancel`;
  - Enter submits only when dirty;
  - the back link calls `onBack`;
  - `RecordMeta` with a null `last_edit` shows "No edits recorded".
- [ ] Commit.

### Task 4: Parties: full-width list, record page, create dialog, ECI recognition

**Files:** `admin/src/pages/Parties.tsx`, `admin/src/components/entity/parties/*`, `usePartyEdit`, `usePartyManager`, tests.

- The list has no side panel. Add a column for ECI recognition (badge or "–") and a filter select (All / National / State / Unrecognised / Not set).
- When `route.id` is set (not `new`), render the Party `RecordPage` instead of the list:
  - left cards: Identity, Organisation, Links, About;
  - right cards: Symbols (existing `SymbolField`), Usage (`getPartyUsage`; rows link to `/candidates?election=`; "View candidates →"), Record (`RecordMeta`).
  - header: colour swatch, name, abbreviation tag, meta "N candidates · M elections", and the ECI recognition tag when set.
  - the ECI recognition select goes in the Identity card.
- Create: `route.isNew` opens a `FormDialog` over the list with the current `PartyCreatePanel` fields. On success it opens `/parties/<id>`.
- The back link calls `route.close()`, which keeps the query string and goes through the guard.
- Delete `PartyPanel.tsx` if it is no longer used, and move any helpers into the new files.
- [ ] Tests:
  - back navigation keeps `?page=3&…` (Review focus 1);
  - a dirty page asks on back, sidebar and picker, and Cancel stays (Review focus 2);
  - the Usage card renders totals;
  - the ECI recognition filter and field save `eci_recognition`;
  - create opens the new record.
- [ ] Commit.

### Task 5: Persons record page

**Files:** `admin/src/pages/Persons.tsx`, `components/entity/persons/*`, `usePersonEdit`, tests.

- Left cards: Profile (name, DOB, gender, education, photo URL), Links (Wikipedia + "Open" button), Biography.
- Right cards:
  - Election history: a timeline, newest first, with election short name, seat, party dot and abbreviation, the Won/Lost badge (Decision 7) and an Incumbent tag; each row links to the candidate page.
  - Merge duplicate: SUPER_ADMIN only, keep the existing behaviour and confirm.
  - Record.
- The header shows the photo (or initial), the name, and meta "N contests · first YYYY · id <short>".
- Read-only caste and religion stay, as a small "Census tags" line in Profile if present.
- [ ] Tests:
  - history badges for a WON row, a non-WON row on a Finalized election, and a Live election;
  - merge is hidden for EDITOR;
  - the dirty guard on back.
- [ ] Commit.

### Task 6: Candidates record page + create dialog

**Files:** `admin/src/pages/Candidates.tsx`, `components/entity/candidates/*`, `useCandidateEdit`, `useCandidateManager`, tests.

- The list stays per seat as today, full width, with no panel.
- Left cards:
  - Candidate: name, party select, Incumbent toggle (editable).
  - Affidavit: age, gender, education, criminal cases, assets with a "₹X crore" helper.
  - Result: read only, from `getCandidateResult`: votes, share with a bar, position + status badge, margin. Add the "Result declared" badge, or the empty state "No vote counts recorded".
- Right cards:
  - Master record: the existing link, unlink, search and create-master behaviour and the suggested matches.
  - Other candidates in <seat>: the highlighted current row; clicking a row opens that candidate.
  - Record.
- The header shows the photo or initial, the name, a party chip, an Incumbent tag, and meta "<election short> · <no> <seat>". The back label is "Candidates · <no> <seat>".
- "New candidate" opens a `FormDialog` with the current `CandidateCreatePanel` fields.
- [ ] Tests:
  - the result strip with votes;
  - a zero-votes seat shows no NaN (Review focus 3);
  - clicking another candidate navigates;
  - unlink still asks;
  - create opens the new record.
- [ ] Commit.

### Task 7: Constituencies record page

**Files:** `admin/src/pages/Constituencies.tsx`, `components/entity/constituencies/*`, `useConstituencyEditor`, tests.

- Left cards:
  - Seat: const no, polling phase (the column), reservation select (GEN/SC/ST → `type`), district, region.
  - Demographics: a 4-column numeric grid with units, then dominant castes and religions.
  - Tags: the existing chip editor with suggestions.
- Right cards:
  - Seat history: from `getConstituencyHistory`, with the volatility line and the current row marked; empty-state copy per Review focus 4.
  - Analysis: `constituency_analysis` data or "Not computed yet".
  - Record: id, state code, turnout for this election, Last updated / edited.
- The header shows the number chip, the name, the reservation tag, meta "<district> district · <region> region · <election short>", and `headerActions` = an outline "Candidates in this seat →" button that goes to `/candidates?election=…&seat=…` (use whatever query the Candidates page reads today).
- The list keeps bulk tagging and Compute analysis.
- [ ] Tests:
  - phase saves to the column;
  - reservation saves `type`;
  - history renders with volatility;
  - an empty history shows the message;
  - the "Candidates in this seat" link carries the seat.
- [ ] Commit.

### Task 8: Audit labels, docs, cleanup

**Files:** `admin/src/pages/AuditLogs.tsx` (action filter options + labels), `docs/FEATURES.md`, `docs/design/admin/NOTES.md`, `CLAUDE.md` (the admin line: entity pages use `RecordPage`, and the side panel stays for Feedback, Users and Audit logs only), and dead code: `Sheet` users and any panel files left over.

- [ ] Add the new actions to the Audit logs filter with readable labels (e.g. "Party edited", "Person merged"), and test it.
- [ ] Update the docs; note the dropped Stitch items in NOTES.md.
- [ ] Run the full checks (admin + backend). Commit.
