# Phase 4A: Delhi, Haryana, Jharkhand, Odisha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every assembly election of Delhi, Haryana, Jharkhand and Odisha since the 2008 delimitation (17) on the site with real ECI results, districts/regions and person links; each state's latest election at current-track depth (leaders, top-party profiles, top-4 candidate photos, winners' affidavits); then deployed to production.

**Architecture:** The state-aware pipeline in `scraper/src/bihar/` (registry → fetch → parse → ECI-internal cross-check → `scraper/data/<slug>/vs-<year>.json` → seeds) with the Phase 3A new-election path for all 17. Parser additions for the pre-NOTA PDFs and Jharkhand 2014's malformed report; a per-seat region override for Delhi (regions = Lok Sabha seats); the results-site photo fetcher falls back to the Wayback Machine (the 2024/25 sites are offline). The current-track CLIs (leaders, party profiles, photos, affidavits) are reused as for the 2026 states.

**Tech Stack:** TypeScript (ts-node, vitest) scraper, SheetJS (`.xls`/`.xlsx`), `pdftotext -layout`; PostgreSQL seeds via `database/setup.sh`; S3 media (`scraper/src/media-store.ts`); React frontend (vitest, MVVM).

**Spec:** `docs/superpowers/specs/2026-10-05-phase4a-dl-hr-jh-od-design.md`. How-to: `docs/SEEDING_PLAYBOOK.md` (both tracks).

## Global Constraints

- Seeds: `ON CONFLICT DO NOTHING`, `results.election_id` set, never `TRUNCATE`; constituency UPDATEs keyed by `const_no` scoped to the election ids; run-once seeds guarded by `seed_runs` and frozen once shipped.
- Delimitation `'2008'` for all 17; election ids `a0<state id>0000-0000-4000-8000-00000000<year>` (DL 24, HR 11, JH 14, OD 26); const prefix `<ST>_VS<yy>_`.
- Earlier years results only; latest year (DL 2025, HR/JH/OD 2024) current track: leaders (user-approved), top parties (won a seat, 1 %+ of the vote, or alliance member; user-reviewed), **top-4 candidate photos per seat**, winners' affidavits.
- Existing party ids are reused; `generate-cli` refuses while a manifest alliance party has no candidate.
- Shipped seeds must not change (`git diff --stat -- database/` shows only new DL/HR/JH/OD files, `setup.sh`, `seed_party_symbols.sql` after every regeneration; restore old states' review files if a regeneration rewrites them).
- Regions as spec §2: Delhi = its 7 Lok Sabha seats, Haryana = 6 divisions, Jharkhand = 5 divisions, Odisha = 3 revenue divisions.
- Images on S3 with an `image_credits` row each; never hotlinked.
- Frontend: MVVM boundaries (`npm run lint`), i18n key parity across en/hi/ta/mr.
- Update `frontend/src/model/about/about.ts`, `docs/FEATURES.md`, `CLAUDE.md`, `docs/DEPLOYMENT.md`, `docs/SEEDING_PLAYBOOK.md`.
- Production only in Task 11, after the final review: Neon backup branch first, `setup.sh` on prod twice, Render deploy (auto-deploy is off), checks.

## Review Focus

1. **Pre-NOTA elections (DL 2008, HR/JH/OD 2009).** Expected: no NOTA candidate inserted, valid votes = candidates only, turnout from the summary; seat pages and swing work without a NOTA row.
2. **Jharkhand 2014's duplicated detailed block (~58 seats twice).** Expected: each seat once; identical repeats dropped, a repeat that differs is an error (never a silent pick).
3. **Odisha 2019 Patkura (AC 96, countermanded).** Expected: if no ECI source is found, the election has 146 seats, the map shows seat 96 as no result (no crash), seat 96's history skips 2019, About says so.
4. **Delhi regions are Lok Sabha seats, not districts.** Expected: seat → region independent of its district; each region's seats = the PC's 10 assembly seats.
5. **Latest-year links and leaders.** Expected: DL 2025 / HR, JH, OD 2024 candidates linked to their earlier persons (v2), leaders attach to those persons, no person spans two different people (ages fit).

---

### Task 1: Registry for the four states and 17 elections

**Files:** Modify `scraper/src/bihar/elections.ts`; Test `scraper/src/bihar/__tests__/elections.test.ts`

**Interfaces:**
- Produces: `StateCode` adds `'DL' | 'HR' | 'JH' | 'OD'`; `STATES` entries (slug dl/hr/jh/od; state ids 24, 11, 14, 26; seats 70/90/81/147; reserved DL 12/0, HR 17/0, JH 9/28, OD 24/33); 17 `ElectionConfig` with `newElection: { name, delimitation: '2008', resultDate, reserved }`; latest years carry `category`, `resultsSite`, `myneta`.

- [ ] **Step 1: Failing test**

```ts
describe('Phase 4A states', () => {
  it('registers 17 new elections with their own counting dates and sources', () => {
    expect(electionsOf('DL').map(e => [e.year, e.docid ?? e.category, e.newElection?.resultDate])).toEqual([
      [2008, 3876, '2008-12-08'], [2013, 3877, '2013-12-08'], [2015, 3878, '2015-02-10'], [2020, 12027, '2020-02-11'], [2025, 10, '2025-02-08']]);
    expect((['HR', 'JH', 'OD'] as const).map(s => electionsOf(s).map(e => e.docid ?? e.category))).toEqual([
      [3826, 3827, 11697, 6], [3786, 3787, 11813, 9], [3630, 3631, 11679, 4]]);
    expect(electionOf('OD', 2019)).toMatchObject({ electionId: 'a0260000-0000-4000-8000-000000002019', constPrefix: 'OD_VS19_', expectedPhases: 4 });
    expect(electionOf('JH', 2024)).toMatchObject({ resultsSite: { base: 'https://results.eci.gov.in/ResultAcGenNov2024/', eciCode: 'S27' }, myneta: 'jharkhand2024',
      newElection: { reserved: { sc: 9, st: 28 } } });
  });
});
```

Update the registry-length test to the new total (+17).

- [ ] **Step 2: Run** `cd scraper && npx vitest run src/bihar/__tests__/elections.test.ts` — Expected: FAIL (state code unknown).

- [ ] **Step 3: Implement.** `STATE_CODES` + `STATES` via `state(...)`; a helper taking the counting date per election (the year-keyed `COUNTING` map does not fit):

```ts
/** A Phase 4A election (2008-2025): old-site docid or new-site category, no old seed, its own counting date. */
const p4 = (code: StateCode, year: number, src: { docid: number } | { category: number }, expectedPhases: number, resultDate: string,
  files: YearConfig['files'], latest?: { base: string; eciCode: string; myneta: string }): ElectionConfig => {
  const id = `a0${String(STATES[code].stateId).padStart(2, '0')}0000-0000-4000-8000-00000000${year}`;
  const base = 'docid' in src ? hist(code, year, id, src.docid, expectedPhases, files)
    : { state: code, year, electionId: id, constPrefix: `${code}_VS${String(year).slice(2)}_`, expectedPhases, category: src.category, files,
        source: { title: `ECI Statistical Report, ${STATES[code].name} Legislative Assembly ${year}`, url: `https://www.eci.gov.in/eci-backend/public/api/election-result?category_id=${src.category}` } };
  return { ...base, newElection: { name: `${STATES[code].name} Vidhan Sabha ${year}`, delimitation: '2008', resultDate, reserved: STATES[code].reserved },
    ...(latest ? { resultsSite: { base: latest.base, eciCode: latest.eciCode }, myneta: latest.myneta } : {}) };
};
```

Values from spec §3 (phases: DL 2/1/1/1/1, HR 1/1/1/1, JH 5/5/5/2, OD 2/2/4/4). Files: PDFs `{ pdf: '<year>/<year>.pdf' }`; 2019/2020 `.xls` and 2024/2025 `.xlsx` names as `fetch-cli` saves them (DL 2020/OD 2019 `10-Detailed_Results.xls` …; HR/JH 2019 `0N-` prefixed; DL 2025/JH 2024 `10-Detailed_Results.xlsx`, `8-Constituency_Data_Summery_Report.xlsx`; HR/OD 2024 hyphenated `10-Detailed-Results.xlsx` …). Delhi's state name in `STATES`: "Delhi" (the DB row says "NCT OF Delhi"; election names use "Delhi Vidhan Sabha <year>"). OD 2019: `seats: 146, excludeSeats: [96]` unless Task 2 Step 5 finds the Patkura result.

- [ ] **Step 4: Fetch** `for s in DL HR JH OD; do npx ts-node src/bihar/fetch-cli.ts $s; done`; set file names to the saved ones (keyword match on "Detailed", "Summ", "Parties Participated", "Performance").
- [ ] **Step 5: Run** the test and `npm test` — PASS. Commit `feat(seed): registry + fetch for Delhi, Haryana, Jharkhand, Odisha (2008-2025)`.

---

### Task 2: Parser for the pre-NOTA PDFs, Jharkhand 2014 and the `.xls` sets

**Files:** Modify `scraper/src/bihar/pdf-report.ts` (and `xls-report.ts` only if a 2019 sheet fails); Create `scraper/data/jh/missing-summaries.json`, `scraper/data/<slug>/crosscheck-exceptions.json` as needed; Test `scraper/src/bihar/__tests__/pdf-report.test.ts`

**Interfaces:**
- Consumes: Task 1 registry.
- Produces: `parse-cli <ST> <years…>` → `scraper/data/<slug>/vs-<year>.json` with 0 problems for all 17.

- [ ] **Step 1: Failing fixture tests** — from `pdftotext -layout` of DL 2008 and HR 2009, copy one real seat block (header, candidate rows, TOTAL line, separate "Turn Out" line) and one summary block into `__tests__/fixtures/pdf-2009/`. Test: `parseDetailedText(fixture)` returns the seat with its candidates, `nota: null` (no NOTA row), total = sum of candidates; `parseSummaryText(summaryFixture)` returns electors, voters, poll date. From JH 2014 copy two seat blocks where the second repeats the first verbatim, plus one repeat with a changed vote: the first parses to one seat; the second throws `seat N appears twice with different results`.
- [ ] **Step 2: Run** `npx vitest run src/bihar/__tests__/pdf-report.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the layout detection for the pre-NOTA blocks (TOTAL and "Turn Out" on separate lines; summary field labels as the fixture shows) and `dedupeSeats` (drop exact repeats, throw on a differing repeat). Keep every existing fixture test green.
- [ ] **Step 4: Parse** `for s in DL HR JH OD; do npx ts-node src/bihar/parse-cli.ts $s <years>; done`. Expected: `<State> <year>: <seats> seats, <n> candidates, 0 problems` for each. Known: JH 2014 summary lacks seats 8, 22, 43, 55, 75, 77, 79 → `missing-summaries.json` (name, type, electors from the detailed block/ECI seat list, poll date by phase, source); OD 2014 highlights say 88/25/34 → the seats' own types (24/33) win (no fix file; note in crosscheck-exceptions with the source). Each further deviation: real lines into a fixture test, watch it fail, fix.
- [ ] **Step 5: Patkura** — search ECI for the 2019 Patkura (AC 96) adjourned-poll result (statistical report or results-site archive). Found: add it as the seat's block (poll date = its own phase) and set `seats: 147`. Not found: keep `excludeSeats: [96]`; ledger the ruling.
- [ ] **Step 6: Re-parse every earlier state/year** (BR, WB, TN, KL, AS, PY, GA, MN, UK, PB, UP) — Expected: `git status --short scraper/data` shows only the new states. Run `npm test` — PASS. Commit `feat(scraper): pre-NOTA PDF layout, duplicated seat blocks, Jharkhand 2014 missing summaries`.

---

### Task 3: Results per state (Delhi → Haryana → Jharkhand → Odisha)

**Files:** Create `scraper/data/<slug>/vs-<year>.json`, `manifest-<year>.json`, `database/seed_<slug>_vs_{parties,<years>}.sql`; Modify `scraper/data/parties/party-map.json` (or `<slug>/party-overrides.json`), `database/setup.sh`.

Per state:

- [ ] **Step 1: Parties** `npx ts-node src/bihar/suggest-parties-cli.ts <ST> <years>`; every suffixed suggestion and new id checked against the DB by normalised name; map to existing ids where it is the same party (AAP, BJP, INC, BSP, INLD, JJP, JMM, AJSU, JVM(P), RJD, JD(U), CPI(ML)L, BJD, …).
- [ ] **Step 2: Manifests** `scraper/data/<slug>/manifest-<year>.json`: `alliances` (pre-poll only, sourced in `_sources`; e.g. JH 2024 INDIA = JMM+INC+RJD+CPI(ML)L vs NDA = BJP+AJSU+JD(U)+LJP(RV); JH 2019 JMM+INC+RJD; HR 2024 INLD+BSP, JJP+ASP(KR); DL and OD mostly parties alone — research per election), `milestones` majority (DL 36, HR 46, JH 41, OD 74), `geo` (`/geo/<slug>_ac_2008.geojson`, centre, zoom), `history`/`history_years`/`compare_with` (all earlier years of the state; compare the previous), `delimitation_era: "2008"`.
- [ ] **Step 3: Generate** `npx ts-node src/bihar/generate-cli.ts <ST>` — Expected: new year seeds, no alliance gaps, no other `database/` change.
- [ ] **Step 4: Check winners** against ECI's party tallies: DL 2025 BJP 48 AAP 22; 2020 AAP 62 BJP 8; 2015 AAP 67 BJP 3; 2013 BJP 31 AAP 28 INC 8; 2008 INC 43 BJP 23. HR 2024 BJP 48 INC 37; 2019 BJP 40 INC 31 JJP 10; 2014 BJP 47 INLD 19 INC 15; 2009 INC 40 INLD 31. JH 2024 JMM 34 BJP 21 INC 16; 2019 JMM 30 BJP 25 INC 16; 2014 BJP 37 JMM 19; 2009 JMM 18 BJP 18 INC 14 JVM(P) 11. OD 2024 BJP 78 BJD 51 INC 14; 2019 BJD 112 BJP 23 INC 9 (of 146 if Patkura is excluded); 2014 BJD 117 INC 16 BJP 10; 2009 BJD 103 INC 27 BJP 6. A mismatch: find the seat, fix the cause, never the total.
- [ ] **Step 5: Wire** `setup.sh` after the Phase 3A loop (one line per state as it lands):

```bash
# Phase 4A states (new elections since the 2008 delimitation), their ECI parties first
run seed_dl_vs_parties.sql; for y in 2008 2013 2015 2020 2025; do run "seed_dl_vs_${y}.sql"; done
for st in hr jh od; do run "seed_${st}_vs_parties.sql"; for y in 2009 2014 2019 2024; do run "seed_${st}_vs_${y}.sql"; done; done
```

Setup twice — exit 0.
- [ ] **Step 6: Commit per state** `data(<st>): <State> <years> from the ECI statistical reports (all candidates)`.

---

### Task 4: Districts and regions (Delhi by Lok Sabha seat)

**Files:** Modify `scraper/src/bihar/regions.ts`, `scraper/src/bihar/regions-cli.ts`; Create `scraper/data/{dl,hr,jh,od}/districts.json`, `database/seed_{dl,hr,jh,od}_districts_regions.sql`; Modify `database/setup.sh`; Test `scraper/src/bihar/__tests__/regions.test.ts`

**Interfaces:**
- Consumes: `emitStateRegions(o: StateRegions)` (Phase 3A).
- Produces: `StateRegions.seatRegions?: Record<number, string>` — a seat's region code overriding its district's; `districts.json` may carry `"seatRegions": { "<no>": "<region code>" }` and then regions need no `districts` list.

- [ ] **Step 1: Failing test**

```ts
it('takes a seat\'s region from seatRegions when given (Delhi: regions are Lok Sabha seats)', () => {
  const sql = emitStateRegions({ ...base, regions: [{ code: 'GA_NORTH', name: 'North Goa', districts: [] }, { code: 'GA_SOUTH', name: 'South Goa', districts: [] }],
    seatRegions: { 1: 'GA_SOUTH', 2: 'GA_NORTH' } });
  expect(sql).toContain("region_id = (SELECT id FROM regions WHERE state_id = 9 AND code = 'GA_SOUTH') WHERE election_id IN ('a', 'b') AND const_no = 1;");
  expect(() => emitStateRegions({ ...base, regions: [], seatRegions: { 1: 'GA_X', 2: 'GA_X' } })).toThrow(/GA_X is not a region/);
});
```

- [ ] **Step 2: Run** `npx vitest run src/bihar/__tests__/regions.test.ts` — FAIL.
- [ ] **Step 3: Implement**: with `seatRegions`, each seat's region = `seatRegions[no]` (must be a listed region; every seat must have one) and the "district in no region" check is skipped; `regions-cli` passes `file.seatRegions` through.
- [ ] **Step 4: Data** (an agent may build it; sourced): per state `districts.json` = current districts, seat → district; regions — Haryana 6 divisions (Ambala, Faridabad, Gurugram, Hisar, Karnal, Rohtak), Jharkhand 5 divisions (Santhal Pargana, North Chotanagpur, South Chotanagpur, Kolhan, Palamu), Odisha 3 revenue divisions (Northern, Central, Southern), Delhi `seatRegions` = AC → PC (Chandni Chowk, North East Delhi, East Delhi, New Delhi, North West Delhi, West Delhi, South Delhi; 10 ACs each) with the 11 revenue districts as districts. Checks: every seat 1..N, each region's seat total, names vs `vs-<latest>.json`.
- [ ] **Step 5: Generate** `npx ts-node src/bihar/regions-cli.ts DL HR JH OD`; wire `for st in dl hr jh od; do run "seed_${st}_districts_regions.sql"; done` after the Phase 3A districts loop; setup twice; 0 VS seats of these states without district/region.
- [ ] **Step 6: Commit** `feat(seed): districts and regions for Delhi (by Lok Sabha seat), Haryana, Jharkhand, Odisha (sourced)`.

---

### Task 5: Person links (v1 history, v2 latest year)

- [ ] **Step 1:** `for s in DL HR JH OD; do npx ts-node src/bihar/links-cli.ts $s; done` (v1: years ≤ 2022) and `npx ts-node src/bihar/links-cli.ts DL 2025`, `… HR 2024`, `… JH 2024`, `… OD 2024` (v2). Review samples (ages fit across years; same party or a known switch).
- [ ] **Step 2:** `setup.sh`: v1 after the districts seeds (`for st in dl hr jh od; do run "seed_${st}_person_links_v1.sql"; done`), v2 after the 2026 states' v2 line; setup twice.
- [ ] **Step 3: Commit** `feat(seed): link politicians across 2008-2025 in Delhi, Haryana, Jharkhand, Odisha (run-once)`.

---

### Task 6: Results-site photos through the Wayback Machine

**Files:** Modify `scraper/src/bihar/photos-cli.ts` (page URL), `scraper/src/bihar/photos.ts`; Test `scraper/src/bihar/__tests__/photos.test.ts`

**Interfaces:**
- Produces: `pageUrls(site: { base: string; eciCode: string }, seat: number): string[]` — the live page first, then `https://web.archive.org/web/2025id_/<live url>` (the `id_` form returns the original bytes).

- [ ] **Step 1: Failing test**

```ts
it('tries the live results page, then its Wayback copy', () => {
  expect(pageUrls({ base: 'https://results.eci.gov.in/AcResultGenOct2024/', eciCode: 'S07' }, 12)).toEqual([
    'https://results.eci.gov.in/AcResultGenOct2024/candidateswise-S0712.htm',
    'https://web.archive.org/web/2025id_/https://results.eci.gov.in/AcResultGenOct2024/candidateswise-S0712.htm']);
});
```

Plus: `parseCandidateDetailPage` on one saved archived 2024 page (fixture from HR 2024) returns the candidates with votes and photo URLs (absolute `results.eci.gov.in/uploads1/candprofile/…`).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `pageUrls`; `photos-cli` tries each URL in turn (an Akamai "Access Denied" or non-candidate body counts as a miss); photo JPEGs fetched live. **Step 4: Run** — PASS; `npm test`.
- [ ] **Step 5: Commit** `feat(scraper): candidate photos from the archived results pages when the live site is gone`.

---

### Task 7: Leaders (curated, user-approved)

**Files:** Create `scraper/data/<slug>/leaders.json`, `leader-profiles.json`, `database/seed_<slug>_leaders.sql` (×4); Modify `database/setup.sh`

- [ ] **Step 1: Research** (one agent per state is fine): CM, deputy CM, Leader of the Opposition, the losing CM face, party chiefs, up to 12 cabinet ministers **who contested the latest election**, each with the seat (latest const id), roles and `sources`. Known: Delhi Rekha Gupta (BJP, CM), Atishi (AAP, LoP), Arvind Kejriwal (AAP, lost New Delhi); Haryana Nayab Singh Saini (BJP, CM), Bhupinder Singh Hooda (INC); Jharkhand Hemant Soren (JMM, CM), Babulal Marandi (BJP, LoP); Odisha Mohan Charan Majhi (BJP, CM), Naveen Patnaik (BJD, LoP). `--add-history` attaches their earlier candidacies. Validate `npx ts-node src/bihar/leaders-cli.ts <ST> <year> --check` — no problems.
- [ ] **Step 2: Show the four lists to the user and wait for approval.** No seeding before.
- [ ] **Step 3: Profiles** `npx ts-node src/bihar/profiles-cli.ts <ST>` (Wikidata photo + day-precision birth date + Commons licence → S3 `persons/<QID>/photo.<ext>`); then `leaders-cli.ts <ST> <year>` writes `seed_<slug>_leaders.sql`.
- [ ] **Step 4: Wire** after the v2 links; setup twice; `leaders-check-cli.ts <ST>` returns no rows; each dashboard's leaders strip shows the CM with photo.
- [ ] **Step 5: Commit** `feat(seed): leaders for Delhi 2025, Haryana, Jharkhand, Odisha 2024 (curated, user-approved)`.

---

### Task 8: Top parties (researched, user-reviewed)

**Files:** Create `scraper/data/<slug>/parties-<year>.json` (×4), images under `frontend/public/symbols/{logos,eci}/` (or S3 as the CLI does), `database/seed_<slug>_party_profiles.sql` (×4); Modify `database/seed_party_symbols.sql` (rewritten by the CLI), `database/setup.sh`

- [ ] **Step 1: Pick** per state from `vs-<latest>.json`: won a seat, 1 %+ of the vote, or alliance member; skip parties already profiled unless a field is missing (`SELECT … FROM parties WHERE description IS NOT NULL`).
- [ ] **Step 2: Research** playbook §7 fields with sources; Commons images, free licences only; colours from Wikipedia's party-colour template, checked against the other parties on the same map (AAP vs BJP vs INC; JMM vs JD(U); BJD vs INC).
- [ ] **Step 3: Review page** — a temporary contact sheet on the dev server; **show it to the user and wait for approval**; remove the page after.
- [ ] **Step 4: Emit** `npx ts-node src/bihar/party-profiles-cli.ts <ST>` (run once from a clean tree); wire `seed_<st>_party_profiles.sql` after the 2026 states' profiles; setup twice.
- [ ] **Step 5: Commit** `feat(seed): top parties of Delhi, Haryana, Jharkhand, Odisha (researched, user-reviewed)`.

---

### Task 9: Candidate photos (top 4) and winners' affidavits

**Files:** Create `scraper/data/<slug>/photos-<year>.json`, `database/seed_<slug>_candidate_photos.sql`, `database/seed_<slug>_affidavits.sql` (×4); Modify `database/setup.sh`

- [ ] **Step 1: Photos** `nohup npx ts-node src/bihar/photos-cli.ts <ST> > photos-<st>.log 2>&1 &` per state (resumable; S3 `persons/eci<year>/<slug>-<seat>-<serial>.jpg`, ECI credit "no licence stated"). Expected: matched ≈ 4 × seats; the unmatched listed and spot-checked.
- [ ] **Step 2: Affidavits** `npx ts-node src/bihar/affidavits-cli.ts <ST>` per state. First compare MyNeta's winners page count with the seats (the research saw 63/80/73/132 unique links for 70/90/81/147): if pages are paginated or split, fetch all parts; unmatched listed and checked by hand.
- [ ] **Step 3: Wire** photos then affidavits after the leaders seeds; setup twice; seat pages show the top-4 photos and the winner's affidavit.
- [ ] **Step 4: Commit** `feat(seed): top-4 candidate photos and winners' affidavits for Delhi 2025, Haryana, Jharkhand, Odisha 2024`.

---

### Task 10: Verify, document

**Files:** Modify `scraper/src/bihar/bihar-snapshot.sql` (state ids 24, 11, 14, 26), `frontend/src/model/about/about.ts`, `frontend/src/pages/__tests__/About.test.tsx`, `docs/FEATURES.md`, `CLAUDE.md`, `docs/DEPLOYMENT.md`, `docs/SEEDING_PLAYBOOK.md`

- [ ] **Step 1: About** — 17 rows (VS, ECI statistical report, `real`, `all_candidates`; OD 2019 `seats_postponed` if Patkura is excluded); About test expects the four states and each year (RED, then GREEN).
- [ ] **Step 2: Two-DB check** from a fresh copy of production (`pg_dump` prod → `et_prod`; `SRC_DB=et_prod scraper/src/bihar/two-db-check.sh`). Expected: `rerun: same`, all tables same.
- [ ] **Step 3: Checks**: one WON per seat in all 17; alliance gaps 0; regions' seat totals; map numbering per state (every seat coloured with `byNumber`).
- [ ] **Step 4: Browser** — each state's latest dashboard (map coloured, Regions layer with its regions vs the previous election, leaders strip), one seat page per state (all candidates, photos, affidavit), Delhi Regions = 7 PCs, About.
- [ ] **Step 5: Docs** — FEATURES (Phase 4A data), CLAUDE (seed order: the new loops, v2 links, current-track seeds), DEPLOYMENT (Phase 4A paragraph), playbook (new traps: pre-NOTA layout, duplicated blocks, archived results pages, counting dates per election).
- [ ] **Step 6: All suites** (scraper, backend `--runInBand`, frontend + lint, admin). Commit `docs: Delhi, Haryana, Jharkhand, Odisha data (About, features, seed order, deployment, playbook)`.

---

### Task 11: Final review, merge, production

- [ ] **Step 1:** Final whole-branch review (fresh reviewer, most capable model); one fix pass for Critical/Important (each RED→GREEN, suites green).
- [ ] **Step 2:** Merge to `main`, push (Vercel deploys frontend/admin).
- [ ] **Step 3:** Neon backup branch `backup-before-phase4a-<date>`; `setup.sh` on production twice (exit 0); checks on prod: 17 elections, seats per state, 0 untagged VS seats, run-once markers present.
- [ ] **Step 4:** Render deploy of `main` (`render deploys create <service> --commit <sha> --wait`); `/health/ready` 200; `region-shares` for each latest election returns its regions; the site shows the four states.
