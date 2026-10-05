# Phase 3A: five states' history (2012-2022) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Goa, Manipur, Punjab, Uttarakhand and Uttar Pradesh 2012/2017/2022 on the site, results only: every candidate + NOTA with real ECI votes, manifests, districts/regions, person links, About.

**Architecture:** The state-aware pipeline in `scraper/src/bihar/` (registry → fetch → parse → ECI-internal cross-check → `scraper/data/<slug>/vs-<year>.json` → seeds) with Phase 2B's new-election path for all 15 elections (none exists in the DB). A generalised districts/regions generator (from Phase 2B's Assam one) tags seats per state. The frontend gains a seat-number fallback for Vidhan Sabha map matching.

**Tech Stack:** TypeScript (ts-node, vitest) scraper, SheetJS, `pdftotext -layout`; PostgreSQL seeds via `database/setup.sh`; React frontend (vitest, MVVM).

**Spec:** `docs/superpowers/specs/2026-10-05-phase3a-five-states-history-design.md`. How-to: `docs/SEEDING_PLAYBOOK.md` (historical track).

## Global Constraints

- Seeds: `ON CONFLICT DO NOTHING`, `results.election_id` set, never `TRUNCATE`; constituency UPDATEs keyed by `const_no` scoped to the election(s); run-once seeds guarded by `seed_runs` and frozen once shipped.
- Results only (no leaders, photos, party profiles, affidavits); 2022 included.
- Existing party ids are reused; `generate-cli` refuses while a manifest alliance party has no candidate.
- Bihar's and the 2011-2026 states' seeds must not change (`git diff --stat -- database/seed_{bihar,as,kl,py,tn,wb}*` empty after every regeneration).
- Regions exactly as the spec §2 lists them; UP = the seven Lokniti-CSDS regions.
- Frontend: MVVM boundaries (`npm run lint`), i18n key parity across en/hi/ta/mr.
- Update `frontend/src/model/about/about.ts`, `docs/FEATURES.md`, `CLAUDE.md`, `docs/DEPLOYMENT.md`, `docs/SEEDING_PLAYBOOK.md` with the data.

## Review Focus

1. **UP 2012's reserved seats differ from 2017/2022 (85 SC / 0 ST vs 84 SC / 2 ST).** Expected: each election validates against its own counts; seat history still follows the seat number.
2. **2012 PDFs (UP: 663 pages) with re-polls** (Manipur 8 ACs, Punjab 1, UP 6). Expected: one result per seat (the re-poll's), the re-poll date counted as a poll date, no seat duplicated or dropped.
3. **Map features whose names differ from ECI's seat names.** Expected: every seat coloured (seat-number fallback for VS maps), no feature matched to the wrong seat.
4. **Goa regions by seat number, not district** (Ponda's seats). Expected: North 1-20, South 21-40.
5. **New parties vs existing ids** (BSP, SP, RLD, AAP, SAD, INLD-style names; Manipur's NPF/NPP; UP's many small parties). Expected: existing ids kept, 0 alliance gaps.

---

### Task 1: Registry for the five states and 15 elections

**Files:** Modify `scraper/src/bihar/elections.ts`; Test `scraper/src/bihar/__tests__/elections.test.ts`

**Interfaces:**
- Produces: `StateCode` adds `'GA' | 'MN' | 'PB' | 'UK' | 'UP'`; `STATES` entries (slug ga/mn/pb/uk/up; state ids 9, 21, 28, 35, 34; seats 40/60/117/70/403; reserved 2008: GA 1/0, MN 1/19, PB 34/0, UK 13/2, UP 84/2); 15 `ElectionConfig` with `newElection: { name, delimitation: '2008', resultDate, reserved }` and docids.

- [ ] **Step 1: Failing test**

```ts
describe('Phase 3A states', () => {
  it('registers 15 new elections with their own reserved counts', () => {
    expect(electionsOf('UP').map(e => [e.year, e.docid, e.newElection?.reserved])).toEqual([
      [2012, 3262, { sc: 85, st: 0 }], [2017, 3471, { sc: 84, st: 2 }], [2022, 14185, { sc: 84, st: 2 }]]);
    expect(electionOf('GA', 2012)).toMatchObject({ electionId: 'a0090000-0000-4000-8000-000000002012', constPrefix: 'GA_VS12_',
      newElection: { delimitation: '2008', resultDate: '2012-03-06' } });
    expect((['GA', 'MN', 'PB', 'UK'] as const).map(s => electionsOf(s).map(e => e.docid))).toEqual([
      [3856, 3862, 14168], [3712, 3713, 14166], [3455, 3614, 14165], [3231, 3470, 14169]]);
  });
});
```

Also update the registry-length test to `4 + 15 + 5 + 15`.

- [ ] **Step 2: Run** `cd scraper && npx vitest run src/bihar/__tests__/elections.test.ts` — Expected: FAIL (state code unknown).

- [ ] **Step 3: Implement.** `STATE_CODES` + `STATES` entries via the existing `state(...)` helper; a helper

```ts
/** A 2012-2022 election of a Phase 3A state: old-site report, no old seed (new-election path), its own reserved counts. */
const p3 = (code: StateCode, stateHex: string, year: number, docid: number, expectedPhases: number, reserved: { sc: number; st: number }, files: YearConfig['files']): ElectionConfig => ({
  ...hist(code, year, `a0${stateHex}0000-0000-4000-8000-00000000${year}`, docid, expectedPhases, files),
  newElection: { name: `${STATES[code].name} Vidhan Sabha ${year}`, delimitation: '2008', resultDate: { 2012: '2012-03-06', 2017: '2017-03-11', 2022: '2022-03-10' }[year]!, reserved },
});
```

(`stateHex` = the two-digit state id: `09`, `21`, `28`, `35`, `34`). Files: 2012 `{ pdf: '2012/2012.pdf' }`; 2017 and 2022 the saved XLSX names (set after Step 4's fetch). Phases from the report (spec §3; re-poll and adjourned-poll dates count): starting values GA 1/1/1, MN 1/2/2, PB 1/1/1, UK 1/2/1, UP 7/8/7 — correct them to what the parse reports and ledger.

- [ ] **Step 4: Fetch** `for s in GA MN UK PB UP; do npx ts-node src/bihar/fetch-cli.ts $s; done`; set the registry file names to the saved ones (keyword match: "Detailed Results", "Constituency Data Summ…", "List Of Political Parties Participated", "Performance of Pol…").
- [ ] **Step 5: Run** the test and `npm test` — PASS. Commit `feat(seed): registry + fetch for Goa, Manipur, Punjab, Uttarakhand, UP 2012-2022`.

---

### Task 2: Results per state (Goa → Manipur → Uttarakhand → Punjab → UP)

**Files:** Create `scraper/data/<slug>/vs-{2012,2017,2022}.json`, `manifest-{2012,2017,2022}.json`, `database/seed_<slug>_vs_{parties,2012,2017,2022}.sql`; Modify parsers only with fixture tests; `scraper/data/parties/party-map.json`, `database/setup.sh`.

Per state:

- [ ] **Step 1: Parse** `npx ts-node src/bihar/parse-cli.ts <ST> 2012 2017 2022`. Expected: `<State> <year>: <seats> seats, <n> candidates, 0 problems`. 2012 is the PDF path (2011 layout). Any deviation: 3–5 real lines into a fixture test, watch it fail, fix, re-run. Re-polled seats: the report's seat block is the re-poll; the cross-check must pass with one result per seat.
- [ ] **Step 2: Parties** `npx ts-node src/bihar/suggest-parties-cli.ts <ST> 2012 2017 2022`; every suffixed suggestion and every new id checked against the DB by normalised name (the Phase 2B script); map to existing ids where it is the same party.
- [ ] **Step 3: Manifests** `scraper/data/<slug>/manifest-<year>.json` per election: `alliances` (pre-poll, sourced in `_sources`; e.g. UP 2022 SP+RLD+SBSP vs BJP+Apna Dal(S)+NISHAD; UP 2017 BJP+AD(S)+SBSP vs SP+INC; Punjab 2017 SAD+BJP; Punjab 2022 AAP, INC, SAD+BSP, BJP+PLC+SAD(S)), `milestones` majority (GA 21, MN 31, PB 59, UK 36, UP 202), `geo` (`/geo/<slug>_ac_2008.geojson`, centre, zoom), `history`/`history_years`/`compare_with` (2017: [2012]; 2022: [2012, 2017], compare [2017]), `delimitation_era: "2008"`. Research per state with sources (an agent may do it); show nothing to the user unless an alliance is unclear.
- [ ] **Step 4: Generate** `npx ts-node src/bihar/generate-cli.ts <ST>` — Expected: three new year seeds, no alliance gaps, nothing else in `database/` changes.
- [ ] **Step 5: Check** winners per party against ECI's party tallies (Performance of Political Parties "won"); e.g. UP 2022 BJP 255, SP 111; UP 2017 BJP 312, SP 47, BSP 19; UP 2012 SP 224, BSP 80; Punjab 2022 AAP 92; Punjab 2017 INC 77; Uttarakhand 2022 BJP 47; Goa 2022 BJP 20; Manipur 2022 BJP 32.
- [ ] **Step 6: Wire** `setup.sh`: a loop after the 2011-2026 states: `for st in ga mn uk pb up; do run "seed_${st}_vs_parties.sql"; for y in 2012 2017 2022; do run "seed_${st}_vs_${y}.sql"; done; done`. Setup twice locally — exit 0.
- [ ] **Step 7: Commit per state** `data(<st>): <State> 2012-2022 from the ECI statistical reports (all candidates)`.

---

### Task 3: Districts and regions per state

**Files:** Create `scraper/src/bihar/regions.ts` (generalised from `regions-2026.ts`), `scraper/src/bihar/regions-cli.ts`, `scraper/data/<slug>/districts.json` (×5), `database/seed_<slug>_districts_regions.sql` (×5); Modify `database/setup.sh`; Test `scraper/src/bihar/__tests__/regions.test.ts`

**Interfaces:**
- Produces: `emitStateRegions(o: { stateId: number; stateName: string; districts: { code: string; name: string }[]; regions: { code: string; name: string; districts: string[] }[]; seats: Record<number, string>; electionIds: string[] }): string` — inserts districts/regions (`ON CONFLICT DO NOTHING`), then one UPDATE per seat number scoped to `election_id IN (<ids>)`; throws on a seat without a district, a district without a region, or a seat count different from the state's.

- [ ] **Step 1: Failing test** — a two-district, two-region fixture: the SQL contains the district and region INSERTs, `UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'GA_NORTHGOA'), region_id = (SELECT id FROM regions WHERE state_id = 9 AND code = 'GA_NORTH') WHERE election_id IN ('a','b') AND const_no = 1;`, and throws `seat 2 has no district` when a seat is missing.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** as specified. **Step 4: Run** — PASS.
- [ ] **Step 5: Data** `scraper/data/<slug>/districts.json` = `{ "sources": [...], "districts": [{ "code", "name" }], "regions": [{ "code", "name", "districts": [...] }], "seats": { "<no>": "<district code>" } }`. Seat → district from Wikipedia's "List of constituencies of the <State> Legislative Assembly" (2008 delimitation), current district names (e.g. Manipur's 2016 districts; UP's Sambhal, Shamli, Hapur, Amethi, Kasganj), cross-checked against the report's seat names. Region groupings exactly as spec §2; Goa: districts North Goa / South Goa by seat number (1-20 / 21-40). UP's seven regions:
  - Rohilkhand: Bijnor, Moradabad, Sambhal, Rampur, Amroha, Budaun, Bareilly, Pilibhit, Shahjahanpur
  - Awadh: Lakhimpur Kheri, Sitapur, Hardoi, Unnao, Lucknow, Rae Bareli, Amethi, Sultanpur, Pratapgarh, Barabanki, Ayodhya
  - Purvanchal: Kaushambi, Prayagraj, Ambedkar Nagar, Azamgarh, Mau, Ballia, Jaunpur, Ghazipur, Chandauli, Varanasi, Bhadohi, Mirzapur, Sonbhadra
  - Paschim: Saharanpur, Muzaffarnagar, Shamli, Meerut, Baghpat, Ghaziabad, Hapur, Gautam Buddha Nagar, Bulandshahr
  - Doab: Aligarh, Hathras, Mathura, Agra, Firozabad, Etah, Kasganj, Mainpuri, Farrukhabad, Kannauj, Etawah, Auraiya, Kanpur Dehat, Kanpur Nagar, Fatehpur
  - Bundelkhand: Jhansi, Lalitpur, Jalaun, Hamirpur, Mahoba, Banda, Chitrakoot
  - North-East: Bahraich, Shravasti, Balrampur, Gonda, Siddharthnagar, Basti, Sant Kabir Nagar, Maharajganj, Gorakhpur, Kushinagar, Deoria
  Expected seat totals: UP 44/52/73/73/19/81/61; Punjab 25/23/69; UK 41/29; MN 40/20; GA 20/20 — a mismatch is investigated, not forced.
- [ ] **Step 6: Generate + wire** `npx ts-node src/bihar/regions-cli.ts <ST>` per state; `setup.sh` runs `seed_<st>_districts_regions.sql` after the year seeds. Setup twice; `SELECT count(*) FROM constituencies k JOIN elections e ON e.id=k.election_id WHERE e.state_id IN (9,21,28,34,35) AND (k.district_id IS NULL OR k.region_id IS NULL)` = 0.
- [ ] **Step 7: Commit** `feat(seed): districts and regions for Goa, Manipur, Punjab, Uttarakhand, UP (sourced)`.

---

### Task 4: Maps — numbering check and seat-number fallback

**Files:** Modify `scraper/src/bihar/geo-cli.ts` (numbering check against a local map file for these states), `frontend/src/model/geo/featureMatch.ts`; Test `frontend/src/model/geo/__tests__/featureMatch.test.ts`

- [ ] **Step 1: Failing test** — `matchFeaturesToSeats` with a VS feature `{ ac_no: 5, ac_name: 'MARCAIM' }` and a seat `GA_VS22_5_MARCAIM_X` named differently ("Marcaim (X)") matches by number when the option `{ byNumber: true }` is set, and does not match a feature whose number has no seat; LS behaviour unchanged (no option).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement**: after the name lookup fails, `byNumber` looks up `NO:<ac_no>` (a lookup key added for seats whose id carries a const number); `useMapVM` passes `byNumber: isVS`. **Step 4: Run** — PASS; frontend suite + lint.
- [ ] **Step 5: Check** per state: print map ac_no/ac_name vs our 2022 seat names (`numberingMismatches`); every feature number has a seat; differences are spelling only. Browser: each state's 2022 map fully coloured.
- [ ] **Step 6: Commit** `fix(frontend): Vidhan Sabha map features match their seat by number when names differ`.

---

### Task 5: Person links per state

- [ ] **Step 1:** `for s in GA MN UK PB UP; do npx ts-node src/bihar/links-cli.ts $s; done` → `seed_<slug>_person_links_v1.sql`; review samples (ages fit).
- [ ] **Step 2:** `setup.sh`: `for st in ga mn uk pb up; do run "seed_${st}_person_links_v1.sql"; done` after the districts seeds; setup twice.
- [ ] **Step 3: Commit** `feat(seed): link politicians across 2012-2022 in five states (run-once)`.

---

### Task 6: Verify, document

- [ ] **Step 1: About** — 15 rows (house VS, ECI statistical report, quality real, `all_candidates`); About test expects them (RED then GREEN).
- [ ] **Step 2:** `bihar-snapshot.sql` state list adds 9, 21, 28, 34, 35; two-DB check from a fresh copy of production (`pg_dump` prod → `et_prod`, `SRC_DB=et_prod two-db-check.sh`): rerun same, all tables same.
- [ ] **Step 3: Browser** — each state's 2022 dashboard (map coloured, Regions layer with its regions, Summary vs 2017), one seat page per state (all candidates).
- [ ] **Step 4: Docs** — FEATURES (Phase 3A data), CLAUDE (seed order: the new loop and seeds), DEPLOYMENT (Phase 3A paragraph; seat analysis later), playbook (new traps).
- [ ] **Step 5:** all suites + lint; commit `docs: five states' 2012-2022 data (About, features, seed order, deployment)`.
