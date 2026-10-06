# Phase 4B-1: Sikkim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sikkim's four assembly elections since the 2008 delimitation (2009, 2014, 2019, 2024) on the site with real ECI results, districts/regions and person links; 2024 at current-track depth (leaders, top-party profiles, top-4 photos, affidavits, party units); then deployed to production.

**Architecture:** The Phase 4A pipeline in `scraper/src/bihar/` (registry `p4` → fetch → parse → cross-check → `scraper/data/sk/vs-<year>.json` → seeds) plus two Sikkim additions: `(BL)` read as ST, and a fixed per-state seat-type table that overrides (and is checked against) the files' inconsistent labels. Party units for Sikkim go in a new run-once `seed_party_units_v2.sql` (v1 is frozen on production).

**Tech Stack:** TypeScript (ts-node, vitest) scraper, SheetJS, `pdftotext -layout`; PostgreSQL seeds via `database/setup.sh`; S3 media; React frontend (vitest, MVVM).

**Spec:** `docs/superpowers/specs/2026-10-06-phase4b-sikkim-design.md`. Template: `docs/superpowers/plans/2026-10-05-phase4a-dl-hr-jh-od.md`. How-to: `docs/SEEDING_PLAYBOOK.md`.

## Global Constraints

- Seeds: `ON CONFLICT DO NOTHING`, `results.election_id` set, never `TRUNCATE`; UPDATEs keyed by `const_no` scoped to the election ids; run-once seeds guarded by `seed_runs` and frozen once shipped (`seed_party_units_v1.sql` must not change).
- Delimitation `'2008'`; election ids `a0300000-0000-4000-8000-00000000<year>`; const prefix `SK_VS<yy>_`; state id 30; 32 seats; reserved SC 2, ST 12.
- Seat types from the fixed table: SC = AC 8, 18; ST = AC 1, 5, 6, 9, 16, 21, 23, 24, 27, 29, 30, 31; the rest GEN (incl. AC 32 Sangha).
- 2009/2014/2019 results only; 2024 current track (leaders and party lists user-approved before seeding).
- Existing party ids reused (SDF, SKM, CAP1, BJP, INC, …).
- Shipped seeds must not change: after every regeneration `git diff --stat -- database/` shows only new `seed_sk_*` files, `seed_party_lineage.sql`, `seed_party_units_v2.sql`, `setup.sh`, `seed_party_symbols.sql`.
- Images on S3 with an `image_credits` row each; never hotlinked.
- Update `frontend/src/model/about/about.ts`, `docs/FEATURES.md`, `CLAUDE.md`, `docs/DEPLOYMENT.md`, `docs/SEEDING_PLAYBOOK.md`.
- Production only in Task 9: Neon backup branch first, `setup.sh` on prod twice (direct host, not `-pooler`), Render deploy by CLI (auto-deploy does not trigger), checks.

## Review Focus

1. **Seat types across files that label differently.** Expected: every year 2 SC / 12 ST / 18 GEN; a label that contradicts the table (e.g. `(SC)` on a table-ST seat) is a parse error, a missing label is not.
2. **Sangha (AC 32) without a map shape.** Expected: 32 seats in tallies and lists, the map colours 31 and does not crash; the 5 unnumbered map slivers stay grey; the seat page works.
3. **`(BL)` in names.** Expected: stripped from the stored name like `(SC)` (type ST), so 2009–2024 names match for person links and the map; AC 1's 2024 spelling "Yuksom-Tashiding" kept as ECI wrote it.
4. **2019 file names with spaces** (`8-Constituency Data Summery .xls`). Expected: fetched and loaded by the exact names.
5. **Party units v2 alongside v1.** Expected: v2 adds only Sikkim units/roles, runs once, and an upgraded production copy (v1 already run) gains them.

---

### Task 1: Registry, seat-type table, fetch

**Files:** Modify `scraper/src/bihar/elections.ts`, `scraper/src/bihar/names.ts`, `scraper/src/bihar/normalize.ts`; Test `scraper/src/bihar/__tests__/elections.test.ts`, `__tests__/names.test.ts`, `__tests__/normalize.test.ts`

**Interfaces:**
- Produces: `StateCode` adds `'SK'`; `STATES.SK` (slug `sk`, id 30, 32 seats, reserved 2/12, `seatTypes: Record<number, SeatType>`); `StateConfig.seatTypes?: Record<number, SeatType>` (listed seats get that type, unlisted seats GEN); 4 `ElectionConfig` via `p4`; 2024 with `resultsSite { base: 'https://results.eci.gov.in/AcResultGenJune2024/', eciCode: 'S21' }`, `myneta: 'sikkim2024'`.

- [ ] **Step 1: Failing tests**

```ts
// elections.test.ts
it('registers Sikkim 2009-2024', () => {
  expect(electionsOf('SK').map(e => [e.year, e.docid ?? e.category, e.newElection?.resultDate, e.expectedPhases])).toEqual([
    [2009, 3364, '2009-05-16', 1], [2014, 3365, '2014-05-16', 1], [2019, 11677, '2019-05-23', 1], [2024, 5, '2024-06-02', 1]]);
  expect(electionOf('SK', 2024)).toMatchObject({ electionId: 'a0300000-0000-4000-8000-000000002024', constPrefix: 'SK_VS24_',
    resultsSite: { eciCode: 'S21' }, myneta: 'sikkim2024', newElection: { reserved: { sc: 2, st: 12 } } });
  expect(Object.entries(STATES.SK.seatTypes!).filter(([, t]) => t === 'ST').length).toBe(12);
});
// names.test.ts
it('reads (BL) as ST and strips it', () => {
  expect(splitAcName('6- Daramdin(BL)')).toEqual({ name: 'Daramdin', type: 'ST' });
  expect(splitAcName('1-YUKSOM-TASHIDING-(BL)')).toEqual({ name: 'YUKSOM-TASHIDING', type: 'ST' });
  expect(splitAcName('Yoksam-tashiding (BL)-ST')).toEqual({ name: 'Yoksam-tashiding', type: 'ST' });
  expect(splitAcName('Sangha-GEN')).toEqual({ name: 'Sangha', type: 'GEN' });
});
// normalize.test.ts
it('a state seat-type table sets every type and refuses a contradicting label', () => {
  // seats parsed with labels null / 'ST' / 'SC'; table { 2: 'ST', 3: 'ST' }
  // → seat 1 GEN, seat 2 ST (no label), seat 3 labelled SC → error "SK seat 3: file says SC, table says ST"
});
```

Write the normalize test with the existing test's raw-election builder (copy its helper); update the registry-length test (+4).

- [ ] **Step 2: Run** `cd scraper && npx vitest run src/bihar/__tests__/{elections,names,normalize}.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** `splitAcName`: marker regex also accepts `BL` (→ `ST`) and a `-` before the bracket or a trailing `-GEN|-SC|-ST` suffix (`(BL)-ST`, `-(BL)`, `Sangha-GEN`). `normalize`: when `STATES[st].seatTypes` is set, `type = table[no] ?? 'GEN'`, and a non-null parsed type that differs is an error. `STATES.SK` via `state('SK','sk','Sikkim',30,32,2,12)` plus `seatTypes`. Elections:

```ts
p4('SK', 2009, { docid: 3364 }, 1, '2009-05-16', pdf(2009)), p4('SK', 2014, { docid: 3365 }, 1, '2014-05-16', pdf(2014)),
p4('SK', 2019, { docid: 11677 }, 1, '2019-05-23', { detailed: '2019/10-Detailed Results.xls', summary: '2019/8-Constituency Data Summery .xls',
  parties: '2019/3-List Of Political Parties Participated.xls', performance: '2019/5-Performance of Political Parties.xls' }),
p4('SK', 2024, { category: 5 }, 1, '2024-06-02', xs(2024, 'xlsx', '-', '', 'Constituency-Data-Summery-Report'),
  { base: 'https://results.eci.gov.in/AcResultGenJune2024/', eciCode: 'S21', myneta: 'sikkim2024' }),
```

(file names as `fetch-cli` saves them; adjust the 2019 keys to the `files` shape `xs()` returns.)
- [ ] **Step 4: Fetch** `npx ts-node src/bihar/fetch-cli.ts SK`; confirm the saved names match the registry.
- [ ] **Step 5: Run** the tests and `npm test` — PASS. Commit `feat(seed): Sikkim registry (2009-2024), (BL) seats as ST, fixed seat-type table`.

---

### Task 2: Parse and results

**Files:** Create `scraper/data/sk/vs-{2009,2014,2019,2024}.json`, `manifest-*.json`, `party-overrides.json` (if needed), `database/seed_sk_vs_{parties,2009,2014,2019,2024}.sql`; Modify `scraper/src/bihar/pdf-report.ts` only if a Sikkim PDF layout fails (fixture test first), `database/setup.sh`, `scraper/data/parties/lineage.json`, `database/seed_party_lineage.sql`

- [ ] **Step 1: Parse** `npx ts-node src/bihar/parse-cli.ts SK 2009 2014 2019 2024`. Expected per year: `Sikkim <year>: 32 seats, <n> candidates, 0 problems`. Each deviation: real lines into a fixture test, watch it fail, fix.
- [ ] **Step 2: Re-parse every earlier state/year** — `git status --short scraper/data` shows only `sk`.
- [ ] **Step 3: Parties** `npx ts-node src/bihar/suggest-parties-cli.ts SK 2009 2014 2019 2024`; map to existing ids (SDF, SKM, CAP1, BJP, INC, …), check new ids against the DB by normalised name.
- [ ] **Step 4: Manifests** `alliances` only where pre-poll and sourced (expect none; SKM–BJP 2019 was post-poll), majority 17, `geo` `/geo/sk_ac_2008.geojson`, history/compare within Sikkim, `delimitation_era: "2008"`.
- [ ] **Step 5: Generate** `npx ts-node src/bihar/generate-cli.ts SK`. Check winners against ECI's Performance of Political Parties: 2024 SKM 31 SDF 1; 2019 SKM 17 SDF 15; 2014 SDF 22 SKM 10; 2009 SDF 32. A mismatch: find the seat, fix the cause.
- [ ] **Step 6: Lineage** add `SKM ← SDF, breakaway, <sourced founding date>, state null, is_successor false, note, source_url` to `lineage.json`; `npx ts-node src/party-model-cli.ts` (lineage seed gains one line; units v1 unchanged — `git diff --stat database/seed_party_units_v1.sql` empty).
- [ ] **Step 7: Wire** after the Phase 4A loop: `run seed_sk_vs_parties.sql; for y in 2009 2014 2019 2024; do run "seed_sk_vs_${y}.sql"; done`. Setup twice — exit 0. Commit `data(sk): Sikkim 2009-2024 from the ECI statistical reports (all candidates)`.

---

### Task 3: Districts and regions

**Files:** Create `scraper/data/sk/districts.json`, `database/seed_sk_districts_regions.sql`; Modify `database/setup.sh`

- [ ] **Step 1: Data** (sourced): 6 districts (Gangtok, Mangan, Namchi, Gyalshing, Pakyong, Soreng), seat → district; regions = 4 old districts (East, West, North, South) listing their current districts (Gangtok + Pakyong → East; Mangan → North; Namchi → South; Gyalshing + Soreng → West). Sangha → Gangtok / East (administrative choice, noted). Checks: seats 1..32 each in one district; region seat totals.
- [ ] **Step 2: Generate** `npx ts-node src/bihar/regions-cli.ts SK`; wire after the Phase 4A districts loop; setup twice; 0 Sikkim VS seats without district/region. Commit `feat(seed): Sikkim districts (6) and regions (the 4 former districts), sourced`.

---

### Task 4: Person links

- [ ] **Step 1:** `npx ts-node src/bihar/links-cli.ts SK` (v1, years ≤ 2019) and `npx ts-node src/bihar/links-cli.ts SK 2024` (v2); review samples (ages fit; same party or a known switch, e.g. SDF → SKM/BJP).
- [ ] **Step 2:** wire v1 after the districts seeds, v2 after the Phase 4A v2 line; setup twice. Commit `feat(seed): link Sikkim politicians across 2009-2024 (run-once)`.

---

### Task 5: Leaders (curated, user-approved)

**Files:** Create `scraper/data/sk/leaders.json`, `leader-profiles.json`, `database/seed_sk_leaders.sql`; Modify `database/setup.sh`

- [ ] **Step 1: Research**: CM Prem Singh Tamang (Golay), Speaker, cabinet ministers who contested 2024, SDF's Pawan Chamling (lost both seats) and its one MLA, party chiefs; seat ids, roles, `sources`. `leaders-cli.ts SK 2024 --check` — no problems.
- [ ] **Step 2: Show the list to the user and wait for approval.**
- [ ] **Step 3:** `profiles-cli.ts SK`, `leaders-cli.ts SK 2024`; wire; setup twice; `leaders-check-cli.ts SK` no rows. Commit `feat(seed): Sikkim 2024 leaders (curated, user-approved)`.

---

### Task 6: Top parties and party units (user-reviewed)

**Files:** Create `scraper/data/sk/parties-2024.json`, `scraper/data/parties/units-5.json`, `database/seed_sk_party_profiles.sql`, `database/seed_party_units_v2.sql`; Modify `scraper/src/party-model.ts`, `scraper/src/party-model-cli.ts`, `database/setup.sh`; Test `scraper/src/__tests__/party-model.test.ts`

**Interfaces:**
- Produces: `emitUnitsSeed(units, parties, states, candidateFor, name = 'seed_party_units_v1')`; the CLI writes v1 from `units-1..4.json` (unchanged bytes) and v2 from `units-5.json`.

- [ ] **Step 1: Failing test**

```ts
it('names the run-once marker (v2 for units added after v1 shipped)', () => {
  const sql = emitUnitsSeed(units, parties, states, () => null, 'seed_party_units_v2');
  expect(sql).toContain("seed_party_units_v2");
  expect(sql).not.toContain("seed_party_units_v1");
});
```

- [ ] **Step 2: Run** `npx vitest run src/__tests__/party-model.test.ts` — FAIL. **Step 3: Implement** the parameter; the CLI splits the files (`units-[1-4]` → v1, `units-5` → v2). **Step 4: Run** — PASS; regenerate; `git diff --stat database/seed_party_units_v1.sql` empty.
- [ ] **Step 5: Research** top parties of 2024 (seat won, 1 %+ vote): profiles as playbook §7 (skip already profiled); units for SKM, SDF, BJP, INC, CAP1 in Sikkim (recognition, office, state president, legislature leader, sourced dates or null).
- [ ] **Step 6: Review page** — contact sheet on the dev server with profiles and units; **show to the user and wait for approval**; remove after.
- [ ] **Step 7:** `party-profiles-cli.ts SK`, `party-model-cli.ts`; wire profiles after the Phase 4A profiles loop and `seed_party_units_v2.sql` right after v1; setup twice. Commit `feat(seed): Sikkim top parties and party units (researched, user-reviewed)`.

---

### Task 7: Candidate photos (top 4) and winners' affidavits

- [ ] **Step 1:** `nohup npx ts-node src/bihar/photos-cli.ts SK > photos-sk.log 2>&1 &` (Wayback fallback). Expected matched ≈ 4 × 32 (fewer where a seat had < 4 candidates); unmatched listed.
- [ ] **Step 2:** `npx ts-node src/bihar/affidavits-cli.ts SK` — compare MyNeta winners count with 32; unmatched checked by hand.
- [ ] **Step 3:** wire photos then affidavits after the leaders seed; setup twice. Commit `feat(seed): Sikkim 2024 top-4 candidate photos and winners' affidavits`.

---

### Task 8: Verify, document

**Files:** Modify `scraper/src/bihar/bihar-snapshot.sql` (state id 30), `frontend/src/model/about/about.ts`, `frontend/src/pages/__tests__/About.test.tsx`, `docs/FEATURES.md`, `CLAUDE.md`, `docs/DEPLOYMENT.md`, `docs/SEEDING_PLAYBOOK.md`

- [ ] **Step 1: About** — 4 rows (real, all candidates; a Sangha note); About test expects Sikkim's years (RED, then GREEN).
- [ ] **Step 2: Two-DB check** from a fresh production copy (`pg_dump` prod → `et_prod`; `SRC_DB=et_prod scraper/src/bihar/two-db-check.sh`) — `rerun: same`; the copy gains the Sikkim units (v2).
- [ ] **Step 3: Checks**: one WON per seat; seat types 2/12/18 each year; regions' totals; map colours 31 seats.
- [ ] **Step 4: Browser** — Sikkim 2024 dashboard (map, Regions layer vs 2019, leaders strip), Sangha seat page, one BL seat page (photos, affidavit), party dialog for SKM (Sikkim unit, "formed by leaders who left SDF"), About.
- [ ] **Step 5: Docs** — FEATURES, CLAUDE (seed order lines, Sikkim in the state lists), DEPLOYMENT, playbook (traps: inconsistent seat-type labels → fixed table, non-territorial seat, file names with spaces, the statistical-reports listing that gives old-site docids).
- [ ] **Step 6: All suites** (scraper, backend, frontend + lint, admin). Commit `docs: Sikkim data (About, features, seed order, deployment, playbook)`.

---

### Task 9: Final review, merge, production

- [ ] **Step 1:** Final whole-branch review (fresh reviewer, most capable model); one fix pass for Critical/Important (RED→GREEN, suites green).
- [ ] **Step 2:** Merge to `main`, push (Vercel).
- [ ] **Step 3:** Neon backup branch `backup-before-sikkim-<date>`; `setup.sh` on production twice via the direct host (exit 0); prod checks: 4 Sikkim elections × 32 seats, 0 untagged seats, `seed_party_units_v2` marker present.
- [ ] **Step 4:** `render deploys create srv-dav07gl9fdbs73aluc2g --commit <sha> --confirm`, wait for `live` (only if backend files changed); the site shows Sikkim.
