# Phase 4B-2: Arunachal Pradesh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arunachal's four assembly elections (2009-2024, 60 seats) on the site with real ECI results, unopposed seats shown as such, districts/regions and person links; 2024 at current-track depth; then on production.

**Architecture:** The Sikkim pipeline (`scraper/src/bihar/` registry `p4` → fetch → parse → cross-check → `scraper/data/ar/vs-<year>.json` → seeds), plus parser support for unopposed seats and one product rule, `isUncontested`, applied in the frontend model (margins, turnout, Battle layer, seat page) and mirrored in the backend's seat result. Party units in a new run-once `seed_party_units_v3.sql`.

**Tech Stack:** TypeScript (ts-node, vitest/jest), SheetJS, `pdftotext -layout`; PostgreSQL seeds via `database/setup.sh`; S3 media; React (MVVM).

**Spec:** `docs/superpowers/specs/2026-10-06-phase4b-arunachal-design.md`. Template: `docs/superpowers/plans/2026-10-06-phase4b-sikkim.md`.

## Global Constraints

- Seeds: `ON CONFLICT DO NOTHING`, `results.election_id` set, never `TRUNCATE`; run-once seeds guarded by `seed_runs`; shipped seeds unchanged (`seed_party_units_v1/v2`, every non-AR seed except `seed_party_symbols.sql` and `setup.sh`).
- Delimitation `'2008'`; election ids `a0030000-0000-4000-8000-00000000<year>`; const prefix `AR_VS<yy>_`; state id 3; 60 seats; majority 31.
- Unopposed seat = one non-NOTA candidate, WON, 0 votes, no NOTA row, seat voters/turnout NULL. One rule (`isUncontested`) everywhere.
- 2009/2014/2019 results only; 2024 current track; leaders and parties user-approved before seeding.
- Regions = 2 Lok Sabha seats by seat (`seatRegions`); districts = current districts (sourced).
- Frontend MVVM boundaries (`npm run lint`), i18n parity en/hi/ta/mr.
- Production: Neon backup branch first; `setup.sh` twice via the direct host; Render deploy (CLI) because backend files change; checks.
- S3 CLIs: `set -a; . scraper/.env; set +a` plus `S3_BUCKET=matdaanpulse-media S3_REGION=ap-south-1 S3_PUBLIC_BASE_URL=https://matdaanpulse-media.s3.ap-south-1.amazonaws.com`.

## Review Focus

1. **An unopposed seat in every margin consumer.** Expected: never the "closest contest", not in margin buckets/averages, not a 0-margin swing; still counted in tallies and coloured for the winner.
2. **Turnout with unopposed seats.** Expected: state turnout averages skip seats with NULL voters (no 0% seats dragging the mean).
3. **Seat history across years where a seat was unopposed once.** Expected: the history row says "Elected unopposed", no margin, no swing for that pair.
4. **Live counting day.** Expected: a seat with one candidate at 0 votes while counting is NOT treated as unopposed unless declared (WON); LEADING/0 stays a normal seat.
5. **Units v3.** Expected: `units-6.json` → `seed_party_units_v3` only; v1/v2 bytes unchanged; an unmapped file still throws.

---

### Task 1: Registry, fetch

**Files:** Modify `scraper/src/bihar/elections.ts`; Test `scraper/src/bihar/__tests__/elections.test.ts`

- [ ] **Step 1: Failing test**

```ts
describe('Phase 4B Arunachal', () => {
  it('registers Arunachal 2009-2024', () => {
    expect(electionsOf('AR').map(e => [e.year, e.docid ?? e.category, e.newElection?.resultDate])).toEqual([
      [2009, 4039, '2009-10-22'], [2014, 4040, '2014-05-16'], [2019, 11675, '2019-05-23'], [2024, 3, '2024-06-02']]);
    expect(electionOf('AR', 2024)).toMatchObject({ electionId: 'a0030000-0000-4000-8000-000000002024', constPrefix: 'AR_VS24_',
      resultsSite: { base: 'https://results.eci.gov.in/AcResultGen2ndJune2024/', eciCode: 'S02' }, myneta: 'arunachal2024' });
  });
});
```

Registry-length test +4.
- [ ] **Step 2: Run** `cd scraper && npx vitest run src/bihar/__tests__/elections.test.ts` — FAIL.
- [ ] **Step 3: Implement** `STATES.AR = state('AR', 'ar', 'Arunachal Pradesh', 3, 60, <sc>, <st>)` (reserved from the 2024 Highlights) and four `p4` entries (`pdf(2009)`, `pdf(2014)`, 2019 `xs(...)` per the saved names, 2024 `xs(2024, 'xlsx', '-', '', 'Constituency-Data-Summery-Report')`); phases from each report.
- [ ] **Step 4: Fetch** `npx ts-node src/bihar/fetch-cli.ts AR`; align file names with what is saved.
- [ ] **Step 5:** tests + `npm test` PASS; commit `feat(seed): Arunachal registry (2009-2024)`.

### Task 2: Parse, unopposed seats, results

**Files:** Modify `scraper/src/bihar/{pdf-report,xls-report,normalize,crosscheck}.ts` as the reports require; Create `scraper/data/ar/*`, `database/seed_ar_vs_*.sql`; Modify `database/setup.sh`

- [ ] **Step 1:** Parse `npx ts-node src/bihar/parse-cli.ts AR 2009 2014 2019 2024`; for each problem copy the real lines into a fixture test, watch it fail, fix. Expected unopposed handling: the seat becomes `{ candidates: [{ …, votes: 0, status: 'WON' }], voters: null, turnout: null }`, `validateElection` accepts it (one candidate, no NOTA) and counts it; a seat-type table if labels contradict.
- [ ] **Step 2:** Re-parse every other state — only `ar` changes.
- [ ] **Step 3:** Parties (`suggest-parties-cli`), manifests (no alliances unless sourced; majority 31; geo `/geo/ar_ac_2008.geojson`), generate; winners and unopposed counts vs ECI Highlights per year.
- [ ] **Step 4:** Wire after Sikkim's line; setup twice; commit `data(ar): Arunachal 2009-2024 (all candidates; unopposed seats)`.

### Task 3: Unopposed seats in the product

**Files:** Create `frontend/src/model/derive/uncontested.ts`; Modify the model's margin/turnout consumers (`marginStats.ts`, `summary/{battle,keyStats,overview}.ts`, `mapFill.ts`, `seatView.ts`, `layerInsights.ts`, `intelligence.ts`/`seatInsights.ts` where they rank by margin), the seat page view model and view (label), i18n (4 languages); backend `modules/candidates/seat-result.ts` (+ DTO `uncontested`); Tests next to each.

- [ ] **Step 1: Failing tests**: `isUncontested` (declared one-candidate 0-vote seat → true; LEADING 0-vote → false; two candidates → false); closest-contest/margin buckets skip it; turnout average skips NULL; Battle layer fill for it = winner colour with the "unopposed" legend entry; seat page shows "Elected unopposed"; backend seat result exposes `uncontested: true` and `margin: null`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** one rule, imported everywhere; no view-level logic. **Step 4: Run** — PASS; full frontend + backend suites, lint.
- [ ] **Step 5:** commit `feat: seats won unopposed (counted, coloured for the winner, left out of margins and turnout)`.

### Task 4: Districts and regions

- [ ] `scraper/data/ar/districts.json` (sourced current districts; `seatRegions` = AC → Arunachal West / East from the Delimitation Order 2008), `regions-cli.ts AR`, wire, setup twice, 0 untagged seats; commit.

### Task 5: Person links

- [ ] `links-cli.ts AR` (v1) and `links-cli.ts AR 2024` (v2); review samples (2016 defectors keep one person across parties); wire; setup twice; commit.

### Task 6: Leaders (user-approved)

- [ ] Research (agent) → `scraper/data/ar/leaders.json` with 2024 candidacies and `ballot_name` where different; `--add-history`; hand-add multi-seat or unlinked earlier candidacies; `--check`. **Show the list to the user and wait for approval.** Then `profiles-cli.ts AR`, `leaders-cli.ts AR`; wire; `leaders-check-cli` no rows; commit.

### Task 7: Top parties and units v3 (user-reviewed)

- [ ] Failing test: `unitsSeedOf('units-6.json')` = `seed_party_units_v3`; `units-7.json` throws. Implement; regenerate (v1/v2 unchanged).
- [ ] Research profiles (BJP/INC profiled already; NPP, NCP, PPA as needed) and units (`units-6.json`); colours checked against the map; **show to the user and wait for approval**; `party-profiles-cli.ts AR`, `party-model-cli.ts`; wire profiles and v3; setup twice; commit.

### Task 8: Photos and affidavits

- [ ] `photos-cli.ts AR` (detached, S3 env), expect ≈ 4 × contested seats; `affidavits-cli.ts AR` vs 60 winners; wire; setup twice; commit.

### Task 9: Verify, document

- [ ] About: 4 rows + an `unopposed_seats` note (4 languages; test RED → GREEN). Snapshot state id 3. Two-DB check from a fresh prod copy. Browser: dashboard (60 seats coloured, unopposed in Battle layer), an unopposed seat page, Regions West/East, About. Docs: FEATURES, CLAUDE, DEPLOYMENT (incl. deferred recompute, backup), playbook (unopposed seats). All suites; commit.

### Task 10: Final review, merge, production

- [ ] Fresh reviewer (most capable model); one fix pass; merge; push; Neon backup `backup-before-arunachal-<date>`; setup twice on prod (direct host); Render deploy `render deploys create srv-dav07gl9fdbs73aluc2g --commit <sha> --confirm` and wait for `live`; prod checks.
