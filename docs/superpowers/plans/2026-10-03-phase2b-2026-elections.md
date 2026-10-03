# Phase 2B: the five 2026 elections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assam, Kerala, Puducherry, Tamil Nadu and West Bengal 2026 are on the site at Bihar 2025's depth: every candidate + NOTA with real ECI votes, electors and turnout, maps (Assam on its 2023 map), manifests with alliances, leaders, top parties, top-4 photos, winners' affidavits, and Assam's statewide + regional comparison with 2021.

**Architecture:** The Phase 2A pipeline (`scraper/src/bihar/`: registry → fetch → parse → ECI-internal cross-check → `scraper/data/<slug>/vs-2026.json` → generated seeds) gains a *new-election* path: no old seed exists, so the elections row, constituencies and manifest are emitted from the registry, the parsed report and a curated `manifest-2026.json`. The Bihar-only current-track tools (leaders, photos, affidavits, party profiles) become state-aware with Bihar's output byte-identical. A small region-comparison view is added (backend endpoint + a "Regions" tab) for elections whose boundaries changed.

**Tech Stack:** TypeScript (ts-node, vitest) scraper; SheetJS; NestJS + Prisma backend (jest); React + Vite frontend (vitest, MVVM); PostgreSQL 15 seeds via `database/setup.sh`; Vercel Blob; mapshaper (new scraper dev dependency).

**Spec:** `docs/superpowers/specs/2026-10-03-phase2-five-states-design.md` (§5 current track, §6 Assam comparisons, §7 code changes, §9 done-when). How-to: `docs/SEEDING_PLAYBOOK.md` (current track, §1–§8).

**Spec deltas found while planning (2026-10-03), ruled here:**
- §3 says the May 2026 statistical reports are not published. They are (ECI `election-result?category_id=` 23 Assam, 24 Kerala, 25 Puducherry, 26 Tamil Nadu, 28 West Bengal *including AC 144 Falta*; 27 is WB without Falta, unused). Results therefore come from the statistical report (electors, turnout, internal cross-check), exactly like Bihar 2025; the results site (`https://results.eci.gov.in/ResultAcGenMay2026/`, live) is used for candidate photos and as a cross-check of seat winners. No `_v2` correction is needed later.
- Assam 2023 delimitation: 126 seats, **9 SC** (24, 30, 34, 52, 61, 71, 75, 120, 126) and **19 ST** (2, 3, 13, 15, 19, 28, 42, 43, 46, 77, 78, 80, 98, 108–113), from ECI's 2026 Constituency Data Summary. The registry's Assam reserved counts (8/16) are the 2008 values, so 2026 carries its own.
- Seat analysis is **not** recomputed in this plan: the user decided (2026-10-03) to recompute once all elections are loaded. DEPLOYMENT lists 2026 ids for that later step.

## Global Constraints

- Seeds: `ON CONFLICT DO NOTHING`, set `results.election_id`, never `TRUNCATE`; a seed whose rows admins edit later is run-once (`seed_runs`, `scraper/src/seed-run-once.ts`) and frozen once shipped (a later fix is `_v2`). `setup.sh` re-runs every seed on every deploy.
- Constituency UPDATEs keyed by `const_no` are scoped to the election (LS/VS overlap; Assam 2008 vs 2023 numbering overlap).
- `elections.delimitation`: `'2008'` for KL/PY/TN/WB 2026, `'2023'` for Assam 2026. Comparisons only within the same type, state and delimitation.
- Map files: `frontend/public/geo/<code>_ac_<era>.geojson`; a redraw adds a new file (`as_ac_2023.geojson`), never edits one in place; properties `ac_no`, `ac_name`, `ac_category`, `st_name` like `as_ac_2008.geojson`.
- Photos and leader images: downloaded once → Vercel Blob (`BLOB_READ_WRITE_TOKEN` in `scraper/.env`) → `image_credits`; never hotlink.
- Effort follows public profile: leaders and top parties are short curated lists **shown to the user and approved before seeding**; bulk data only by scripts.
- Bihar's generated seeds must regenerate byte-identical after every refactor (`git diff --stat -- database/seed_bihar*` empty).
- Frontend: MVVM import direction (`npm run lint`); Tailwind classes only in `src/views` (or files listed via `@source`).
- Party ids: an ECI party that already exists in the DB keeps its id (no `_XX` fork); `generate-cli` refuses while a manifest alliance party has no candidate.
- Update `frontend/src/model/about/about.ts`, `docs/FEATURES.md`, `CLAUDE.md` (seed order), `docs/DEPLOYMENT.md`, `docs/SEEDING_PLAYBOOK.md` in the same change as the data.

## Review Focus

1. **Assam 2026 joined to 2008-era seats anywhere** (person links by seat number, the old Assam districts/regions seed tagging by const_no, `compare_with`/`history`, swing). Expected: no seat-level link at all; only the statewide and region comparison. Pinned in Tasks 4, 5, 6.
2. **West Bengal Falta (AC 144) re-poll.** Expected: one AC 144 with the re-poll result (BJP, Debangshu Panda), 294 seats, the re-poll date counted as its own poll date. Pinned in Task 3.
3. **New 2026 parties vs existing ids** (TVK, AJUP, AISF, Raijor Dal, LJK, NYMK; and old ones like KEC, KECJ, BOPF). Expected: existing parties keep their ids; new ones get one bare record; alliance gaps = 0. Pinned in Task 3.
4. **Photo matching** (ECI photo filenames are not name keys, e.g. Jayanta Kumar Das → `SRIJA-…jpg`). Expected: matched by exact votes + name check per card; a candidate without a match gets no photo, never another's. Pinned in Task 10.
5. **MyNeta rows hidden in obfuscated scripts** (~11 %) and duplicate seat names. Expected: decoded rows included; unmatched winners reported, never matched to the wrong seat. Pinned in Task 11.

---

## File Structure

| File | Responsibility |
|---|---|
| `scraper/src/bihar/elections.ts` | registry: 2026 entries (`category`, `newElection`, `resultsSite`, `myneta`, `delimitation`, `resultDate`, `reserved`) |
| `scraper/src/bihar/new-election.ts` (new) | `newElectionSeed()`: elections row + constituencies + manifest for an election with no old seed |
| `scraper/src/bihar/normalize.ts` | seat `name` for new elections |
| `scraper/src/bihar/fetch-cli.ts` | fetch by registry `category` (any state) |
| `scraper/src/bihar/generate-cli.ts` | uses `newElectionSeed` when the year seed does not exist yet |
| `scraper/src/bihar/geo.ts` + `geo-cli.ts` (new) | ECI `ac/<code>.js` → normalised, simplified GeoJSON; numbering check |
| `scraper/data/<slug>/manifest-2026.json` (new ×5) | curated alliances (with sources), milestones, history ids |
| `scraper/data/as/districts-2026.json` (new) | Assam 2023 seat → district (sourced) |
| `scraper/src/bihar/regions-2026.ts` + CLI (new) | `seed_as_2026_districts_regions.sql` |
| `database/seed_as_districts_regions.sql` | scoped to Assam's 2008-delimitation elections |
| `backend/src/modules/results/results.service.ts`, `elections.controller.ts` | `GET /elections/:id/region-shares` |
| `frontend/src/model/derive/regionComparison.ts` (new) | pure comparison of two elections' region shares |
| `frontend/src/viewmodels/tiles/useRegionComparisonVM.ts` (new) | loads current + previous election shares |
| `frontend/src/views/dashboard/RegionsTab.tsx` (new) | the table; a tab in `StandingsTile` |
| `scraper/src/bihar/links.ts` | links only within the same delimitation; links `_v2` for 2026 |
| `scraper/src/bihar/{leaders-data,leaders-seed,photos,affidavits,party-profiles}.ts` + CLIs | state-aware (state code argument), Bihar defaults unchanged |
| `database/seed_<st>_vs_2026.sql`, `seed_<st>_person_links_v2.sql`, `seed_<st>_leaders.sql`, `seed_<st>_candidate_photos.sql`, `seed_<st>_affidavits.sql`, `seed_<st>_party_profiles.sql` | generated |

---

### Task 1: Registry for 2026 and fetching by category

**Files:**
- Modify: `scraper/src/bihar/elections.ts`, `scraper/src/bihar/fetch-cli.ts`
- Test: `scraper/src/bihar/__tests__/elections.test.ts`

**Interfaces:**
- Produces: `ElectionConfig` fields `category?: number; newElection?: { name: string; delimitation: string; resultDate: string; reserved?: { sc: number; st: number } }; resultsSite?: { base: string; eciCode: string }; myneta?: string`; `ECI_RESULTS_2026 = 'https://results.eci.gov.in/ResultAcGenMay2026/'`; `electionOf(s, 2026)` for the five states.

- [ ] **Step 1: Write the failing test** (append to `elections.test.ts`)

```ts
describe('2026 elections', () => {
  it('registers the five 2026 elections from the new-site reports with their own delimitation', () => {
    const as = electionOf('AS', 2026);
    expect(as).toMatchObject({ electionId: 'f6a7b8c9-d0e1-2345-f012-567890122026', constPrefix: 'AS_VS26_', category: 23,
      newElection: { delimitation: '2023', reserved: { sc: 9, st: 19 } }, resultsSite: { eciCode: 'S03' }, myneta: 'assam2026' });
    expect(electionOf('WB', 2026)).toMatchObject({ category: 28, resultsSite: { eciCode: 'S25' }, newElection: { delimitation: '2008' } });
    expect(['KL', 'PY', 'TN'].map(s => electionOf(s as 'KL', 2026).category)).toEqual([24, 25, 26]);
    expect(electionsOf('AS').map(e => e.year)).toEqual([2011, 2016, 2021, 2026]);
  });
  it('keeps every 2026 election id unique', () => {
    expect(new Set(ELECTIONS.map(e => e.electionId)).size).toBe(ELECTIONS.length);
  });
});
```

- [ ] **Step 2: Run it** — `cd scraper && npx vitest run src/bihar/__tests__/elections.test.ts` — Expected: FAIL (`no election AS 2026 in the registry`).

- [ ] **Step 3: Implement.** In `elections.ts` add the fields to `ElectionConfig` (JSDoc each), `export const ECI_RESULTS_2026 = 'https://results.eci.gov.in/ResultAcGenMay2026/';`, a helper and five entries:

```ts
/** A 2026 election: new-site statistical report (category), no old seed, results site for photos, MyNeta for affidavits. */
const y2026 = (code: StateCode, electionId: string, category: number, eciCode: string, myneta: string, expectedPhases: number,
  delimitation: string, reserved?: { sc: number; st: number }): ElectionConfig => ({
  state: code, year: 2026, electionId, constPrefix: `${code}_VS26_`, expectedPhases, category,
  source: { title: `ECI Statistical Report, ${STATES[code].name} Legislative Assembly 2026`, url: `https://www.eci.gov.in/eci-backend/public/api/election-result?category_id=${category}` },
  files: { detailed: '2026/10-Detailed_Results.xlsx', summary: '2026/8-Constituency_Data_Summary.xlsx',
    parties: '2026/3-List_Of_Political_Parties_Participated.xlsx', performance: '2026/5-Performance_of_Political_Parties.xlsx' },
  newElection: { name: `${STATES[code].name} Vidhan Sabha 2026`, delimitation, resultDate: '2026-05-04', ...(reserved ? { reserved } : {}) },
  resultsSite: { base: ECI_RESULTS_2026, eciCode }, myneta,
});
```

Entries (append to `ELECTIONS`): `y2026('AS', 'f6a7b8c9-d0e1-2345-f012-567890122026', 23, 'S03', 'assam2026', 1, '2023', { sc: 9, st: 19 })`, `y2026('KL', 'a7b8c9d0-e1f2-3456-0123-678901232026', 24, 'S11', 'kerala2026', 1, '2008')`, `y2026('PY', 'b1c2d3e4-f5a6-7890-1234-567890ab2026', 25, 'U07', 'puducherry2026', 1, '2008')`, `y2026('TN', 'e5f6a7b8-c9d0-1234-ef01-456789012026', 26, 'S22', 'tamilnadu2026', 1, '2008')`, `y2026('WB', 'd4e5f6a7-b8c9-0123-def0-345678901026', 28, 'S25', 'westbengal2026', 3, '2008')`. (Phases: the report's distinct poll dates decide; if `parse-cli` reports a phase-count mismatch, set the count it lists and ledger a ruling. WB: two phases + the Falta re-poll.) The file names are what `fetchNew` saves (timestamp suffix stripped); after fetching, correct any name that differs and ledger it.

In `fetch-cli.ts` replace the Bihar-2025 branch with `else if (e.category) await fetchNew(String(e.year), e.category);` and give Bihar 2025's registry entry `category: 16`.

- [ ] **Step 4: Run** the test file and the whole suite (`npm test`). Expected: PASS; Bihar entries unchanged.

- [ ] **Step 5: Fetch** `for s in AS KL PY TN WB; do npx ts-node src/bihar/fetch-cli.ts $s 2026; done`. Expected: four XLSX per state under `scraper/data/raw/<slug>/2026/` (plus the other reports). Fix registry file names to what was saved.

- [ ] **Step 6: Commit** `git add scraper/src/bihar/elections.ts scraper/src/bihar/fetch-cli.ts scraper/src/bihar/__tests__/elections.test.ts && git commit -m "feat(seed): registry + fetch for the five 2026 elections"`

---

### Task 2: New-election seed path

**Files:**
- Create: `scraper/src/bihar/new-election.ts`
- Modify: `scraper/src/bihar/types.ts` (`SeatJson.name?: string`), `scraper/src/bihar/normalize.ts`, `scraper/src/bihar/crosscheck.ts` (reserved counts from `cfg.newElection.reserved` when set), `scraper/src/bihar/generate-cli.ts`
- Test: `scraper/src/bihar/__tests__/new-election.test.ts`, `normalize.test.ts`, `crosscheck.test.ts`

**Interfaces:**
- Consumes: Task 1 `ElectionConfig.newElection`.
- Produces: `constIdFor(prefix: string, constNo: number, name: string): string` (`AS_VS26_33_DISPUR`); `newElectionSeed(cfg: ElectionConfig, json: ElectionJson, manifestJson: string | null): ExistingSeed`.

- [ ] **Step 1: Failing tests** (`new-election.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { constIdFor, newElectionSeed } from '../new-election';
import { electionOf } from '../elections';
import type { ElectionJson } from '../types';

const json = { year: 2026, electionId: 'f6a7b8c9-d0e1-2345-f012-567890122026', source: { title: 't', url: 'u', retrieved: '2026-10-03' }, parties: [],
  seats: [{ constNo: 33, name: 'Dispur', type: 'GEN', electors: 244988, voters: 1, turnout: 1, phase: 1, pollDate: '2026-04-09', candidates: [] },
          { constNo: 1, name: "Gossaigaon", type: 'GEN', electors: 1, voters: 1, turnout: 1, phase: 1, pollDate: '2026-04-09', candidates: [] }] } as unknown as ElectionJson;

describe('constIdFor', () => {
  it('upper-cases the name and joins words with _ (the legacy id convention)', () => {
    expect(constIdFor('AS_VS26_', 33, 'Dispur')).toBe('AS_VS26_33_DISPUR');
    expect(constIdFor('KL_VS26_', 1, "Ma'njeshwar (SC)")).toBe('KL_VS26_1_MANJESHWAR_SC');
  });
});

describe('newElectionSeed', () => {
  const seed = newElectionSeed(electionOf('AS', 2026), json, '{"alliances":[]}');
  it('inserts the election as Finalized with its delimitation and counting date', () => {
    expect(seed.electionSql).toBe("INSERT INTO elections (id, name, type, state_id, year, status, tentative_next_date, delimitation) VALUES ('f6a7b8c9-d0e1-2345-f012-567890122026', 'Assam Vidhan Sabha 2026', 'VS', 4, 2026, 'Finalized', '2026-05-04', '2023') ON CONFLICT (id) DO NOTHING;");
  });
  it('lists every seat as a constituency with no old candidates', () => {
    expect(seed.constituencies).toEqual([{ id: 'AS_VS26_33_DISPUR', constNo: 33, name: 'Dispur' }, { id: 'AS_VS26_1_GOSSAIGAON', constNo: 1, name: 'Gossaigaon' }]);
    expect(seed.candidates).toEqual([]);
    expect(seed.manifestJson).toBe('{"alliances":[]}');
  });
  it('fails on a seat without a name', () => {
    expect(() => newElectionSeed(electionOf('AS', 2026), { ...json, seats: [{ ...json.seats[0], name: undefined }] } as ElectionJson, null)).toThrow(/seat 33 has no name/);
  });
});
```

Also add to `normalize.test.ts` a case: a config with `newElection` copies `displayName(acName)` into `seat.name` ("DISPUR" → "Dispur"); without `newElection` the seat has no `name` key (existing JSON unchanged). And to `crosscheck.test.ts`: `validateElection` with `newElection.reserved {sc: 9, st: 19}` accepts 9 SC + 19 ST and rejects 8 SC.

- [ ] **Step 2: Run** `npx vitest run src/bihar/__tests__/new-election.test.ts src/bihar/__tests__/normalize.test.ts src/bihar/__tests__/crosscheck.test.ts` — Expected: FAIL (module missing; `name` absent; reserved 8/16 used).

- [ ] **Step 3: Implement**

```ts
// scraper/src/bihar/new-election.ts
/** An election with no old seed (2026): the elections row, constituencies and manifest come from the registry and the report. */
import { STATES, type ElectionConfig } from './elections';
import type { ExistingSeed } from './existing-seed';
import type { ElectionJson } from './types';
import { q } from './sql';

export function constIdFor(prefix: string, constNo: number, name: string): string {
  return `${prefix}${constNo}_${name.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim().replace(/\s+/g, '_')}`;
}

export function newElectionSeed(cfg: ElectionConfig, json: ElectionJson, manifestJson: string | null): ExistingSeed {
  const n = cfg.newElection;
  if (!n) throw new Error(`${cfg.state} ${cfg.year} is not a new election`);
  const st = STATES[cfg.state];
  return {
    electionSql: `INSERT INTO elections (id, name, type, state_id, year, status, tentative_next_date, delimitation) VALUES (${q(cfg.electionId)}, ${q(n.name)}, 'VS', ${st.stateId}, ${cfg.year}, 'Finalized', ${q(n.resultDate)}, ${q(n.delimitation)}) ON CONFLICT (id) DO NOTHING;`,
    constituencies: json.seats.map(s => {
      if (!s.name) throw new Error(`seat ${s.constNo} has no name`);
      return { id: constIdFor(cfg.constPrefix, s.constNo, s.name), constNo: s.constNo, name: s.name };
    }),
    candidates: [],
    manifestJson,
  };
}
```

In `normalize.ts`, when `'newElection' in cfg && cfg.newElection`, set `name: displayName(rawSeat.acName)` on the seat (normalize takes `YearConfig`; widen the parameter to `ElectionConfig` — every caller already passes one). In `crosscheck.ts` use `cfg.newElection?.reserved ?? STATES[cfg.state].reserved`.

In `generate-cli.ts`: for each year, `const seedFile = path.join(DB_DIR, state.yearSeed(y)); const cfg = electionOf(ST, y);` then

```ts
const manifestFile = path.join(DATA_DIR, `manifest-${y}.json`);
const seed = cfg.newElection && !fs.existsSync(seedFile)
  ? newElectionSeed(cfg, json, fs.existsSync(manifestFile) ? JSON.stringify(JSON.parse(fs.readFileSync(manifestFile, 'utf8'))) : null)
  : readExistingSeed(fs.readFileSync(seedFile, 'utf8'));
```

and skip the `changedRows` check for a plan whose year seed did not exist before this run. Once `seed_<st>_vs_2026.sql` exists, later runs read it like any other (the manifest then comes from the seed; a manifest change after shipping needs a run-once fix seed, as in Phase 2A).

- [ ] **Step 4: Run** the three test files, then `npm test` and `npx tsc --noEmit -p .`. Expected: all PASS. Regenerate Bihar and the five states' 2011–21 seeds (`for s in BR AS KL PY TN WB; do npx ts-node src/bihar/generate-cli.ts $s; done` — only after Task 3's JSON exists does 2026 appear; before that, temporarily skip: run it now only for `BR`) and confirm `git status --short database` is empty.

- [ ] **Step 5: Commit** `git commit -m "feat(seed): new-election path (elections row, constituencies, manifest from the registry)"` with the files above.

---

### Task 3: The five 2026 results (per state: PY, KL, TN, WB, AS)

**Files:**
- Create: `scraper/data/<slug>/vs-2026.json`, `scraper/data/<slug>/manifest-2026.json`, `database/seed_<slug>_vs_2026.sql` (×5)
- Modify: `scraper/src/bihar/xls-report.ts` (only if a header/layout deviates; fixture test first), `scraper/data/parties/party-map.json`, `scraper/data/<slug>/party-overrides.json`, `database/seed_<slug>_vs_parties.sql`, `database/setup.sh`
- Test: `scraper/src/bihar/__tests__/xls-report.test.ts` (fixture rows from the 2026 file for any deviation)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `seed_<slug>_vs_2026.sql` with constituency ids `<ST>_VS26_<no>_<NAME>`; the five manifests.

Per state, in the order PY → KL → TN → WB → AS:

- [ ] **Step 1: Parse.** `npx ts-node src/bihar/parse-cli.ts <ST> 2026`. Expected: `<State> 2026: <seats> seats, <n> candidates, 0 problems`. The 2026 Detailed Results header is `STATE/UT NAME, AC NO., AC NAME, CANDIDATE NAME, GENDER, AGE, CATEGORY, PARTY, SYMBOL, GENERAL, POSTAL, TOTAL, …, TOTAL ELECTORS` with names like `"1 Pradyut Bordoloi"` (Bihar 2025's layout; `stripSerial` handles the rank). For any failure: copy 3–5 real rows into a fixture test in `xls-report.test.ts`, watch it fail, fix the parser, re-run. Never add a cross-check exception for a parser bug.

- [ ] **Step 2: Parties.** `npx ts-node src/bihar/suggest-parties-cli.ts <ST> 2026`. For every suggested *suffixed* id, check the DB for the same party under an existing id (`SELECT id, name FROM parties WHERE name ILIKE '%<word>%'`); map it to the existing id (shared map entry, or `data/<slug>/party-overrides.json`, which also takes a full entry). Only genuinely new parties get a new bare record. Known new 2026 parties: TVK (Tamilaga Vettri Kazhagam), AJUP, AISF, RJRD (Raijor Dal), LJK, NYMK — check each against the DB first.

- [ ] **Step 3: Manifest** `scraper/data/<slug>/manifest-2026.json`, curated with sources in a `_sources` array (stripped before emitting: `generate-cli` keeps only known keys `alliances, leaders, cabinet, tracked, vip_seats, milestones, compare_with, history, history_years, geo, delimitation_era`). Content:
  - `alliances`: the pre-poll alliances with ids matching the 2021 manifest where the alliance continues (e.g. Kerala `UDF`, `LDF`, `NDA`; Tamil Nadu `DMKALL`, `ADMK`, plus TVK's front; WB `TMC`, `NDA`, `LFINC`; Assam `NDA` and the Congress-led front; Puducherry `NDA` and the DMK–INC front), parties by our ids, colours as in 2021.
  - `milestones`: `[{ "label": "Majority", "value": <floor(seats/2)+1> }]` (AS 64, KL 71, PY 16, TN 118, WB 148).
  - `compare_with` / `history` / `history_years`: KL/PY/TN/WB → the 2021, 2016, 2011 ids of that state (`history_years` `[2021, 2016, 2011]`); **Assam: none** (2023 delimitation).
  - `geo`: copy the state's 2021 manifest `geo`, except Assam `map_url: "/geo/as_ac_2023.geojson"` (Task 4).
  - `tracked`: the alliance ids; `leaders`/`cabinet`: `[]` (Task 8 fills them).
  - `delimitation_era`: `"2023"` (Assam) / `"2008"`.

- [ ] **Step 4: Generate.** `npx ts-node src/bihar/generate-cli.ts <ST>`. Expected: `2026: 0 matched, 0 unmatched, 0 low-similarity, 0 deleted`, no alliance gaps, `Wrote … seed_<slug>_vs_2026.sql`, and **no change** to the 2011–21 seeds or the frozen corrections seed (`git diff --stat database/seed_<slug>_vs_20{11,16,21}.sql database/seed_<slug>_corrections_v1.sql` empty).

- [ ] **Step 5: Check against the declared results.** Load the seed into a scratch DB (or the local DB after Step 6) and compare the winners per party with ECI's party tally pages (`partywiseresult-<code>.htm`): Assam BJP 82, INC 19, BOPF 10, AGP 10, AIUDF 2, RJRD 2, AITC 1; Kerala INC 63, CPI(M) 26, IUML 22, CPI 8, KEC 7, RSP 3, BJP 3, RJD 1, RMPI 1, KEC(J) 1, CMP 1, IND 4; Tamil Nadu TVK 108, DMK 59, ADMK 47, INC 5, PMK 4, IUML 2, CPI 2, VCK 2, CPI(M) 2, BJP 1, DMDK 1, AMMK 1; West Bengal BJP 208 (incl. Falta), AITC 80, INC 2, AJUP 2, CPI(M) 1, AISF 1; Puducherry AINRC 12, DMK 5, BJP 4, TVK 2, INC 1, LJK 1, ADMK 1, NYMK 1, IND 3. Also WB: one seat 144 (Falta) won by Debangshu Panda (BJP); 294 seats. Any mismatch is investigated (parser or party mapping), never patched in the JSON.

- [ ] **Step 6: Wire** in `database/setup.sh`: the per-state loop's years become `2011 2016 2021 2026`. Run `DATABASE_URL=postgresql://admin:password123@localhost:3083/election_tracker database/setup.sh` twice. Expected: exit 0 both times; `SELECT count(*) FROM constituencies k JOIN elections e ON e.id=k.election_id WHERE e.year=2026` = 824 (126+140+30+234+294); one WON per seat.

- [ ] **Step 7: Commit per state** `git commit -m "data(<st>): <State> 2026 from the ECI statistical report (all candidates)"`.

---

### Task 4: Maps and Assam 2026 districts/regions

**Files:**
- Create: `scraper/src/bihar/geo.ts`, `scraper/src/bihar/geo-cli.ts`, `frontend/public/geo/as_ac_2023.geojson`, `scraper/data/as/districts-2026.json`, `scraper/src/bihar/regions-2026.ts`, `scraper/src/bihar/regions-2026-cli.ts`, `database/seed_as_2026_districts_regions.sql`
- Modify: `database/seed_as_districts_regions.sql` (scope), `database/setup.sh`, `scraper/package.json` (dev dependency `mapshaper`)
- Test: `scraper/src/bihar/__tests__/geo.test.ts`, `scraper/src/bihar/__tests__/regions-2026.test.ts`

**Interfaces:**
- Produces: `parseEciAcJs(js: string): FeatureCollection`; `normaliseFeatures(fc, stName, types: Record<number, 'GEN'|'SC'|'ST'>): FeatureCollection` (properties `ac_no, ac_name, ac_category, st_name`); `numberingMismatches(fc, names: Record<number, string>): string[]`; `emitRegions2026(rows: { constNo: number; district: string }[], districtRegion: Record<string, string>, electionId: string): string`.

- [ ] **Step 1: Failing tests** (`geo.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { normaliseFeatures, numberingMismatches, parseEciAcJs } from '../geo';

const js = 'var json_All_AC ={ "type": "FeatureCollection", "name": "AC-Boundary", "features": [' +
  '{"type":"Feature","properties":{"AC_NO":33,"AC_NAME":"DISPUR","FID":1,"ST_CODE":"S03","ST_NAME":"ASSAM"},"geometry":{"type":"Polygon","coordinates":[[[91,26],[91.1,26],[91.1,26.1],[91,26]]]}}] }';

describe('parseEciAcJs', () => {
  it('reads the GeoJSON out of ECI\'s JS variable', () => {
    expect(parseEciAcJs(js).features[0].properties).toMatchObject({ AC_NO: 33, AC_NAME: 'DISPUR' });
  });
});
describe('normaliseFeatures', () => {
  it('keeps only our property names, with the seat type', () => {
    expect(normaliseFeatures(parseEciAcJs(js), 'ASSAM', { 33: 'GEN' }).features[0].properties).toEqual({ ac_no: 33, ac_name: 'DISPUR', ac_category: 'GEN', st_name: 'ASSAM' });
  });
});
describe('numberingMismatches', () => {
  it('flags a seat whose ECI 2026 name is unlike our name for that number', () => {
    const fc = parseEciAcJs(js);
    expect(numberingMismatches(fc, { 33: 'Dispur' })).toEqual([]);
    expect(numberingMismatches(fc, { 33: 'Jalukbari' })).toEqual(['33: ECI "DISPUR" vs ours "Jalukbari"']);
  });
});
```

`regions-2026.test.ts`: `emitRegions2026([{ constNo: 33, district: 'AS_KAMRUPMETRO' }], { AS_KAMRUPMETRO: 'AS_CENTRALASSAM' }, 'f6a7…2026')` contains
`UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_KAMRUPMETRO'), region_id = (SELECT id FROM regions WHERE code = 'AS_CENTRALASSAM') WHERE election_id = 'f6a7…2026' AND const_no = 33;` and throws on a district with no region.

- [ ] **Step 2: Run** both — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement** `geo.ts`:

```ts
/** ECI results-site boundary files (`ac/<code>.js`: `var json_All_AC = <GeoJSON>`) → our map properties. */
import { similarity } from './names';
export interface Feature { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown }
export interface FeatureCollection { type: 'FeatureCollection'; features: Feature[] }

export function parseEciAcJs(js: string): FeatureCollection {
  const start = js.indexOf('{');
  if (start < 0) throw new Error('no GeoJSON object in the file');
  return JSON.parse(js.slice(start).replace(/;\s*$/, ''));
}

export function normaliseFeatures(fc: FeatureCollection, stName: string, types: Record<number, 'GEN' | 'SC' | 'ST'>): FeatureCollection {
  return { type: 'FeatureCollection', features: fc.features.map(f => {
    const no = Number(f.properties.AC_NO);
    if (!types[no]) throw new Error(`AC ${no} has no seat type`);
    return { type: 'Feature', properties: { ac_no: no, ac_name: String(f.properties.AC_NAME).toUpperCase(), ac_category: types[no], st_name: stName }, geometry: f.geometry };
  }) };
}

export function numberingMismatches(fc: FeatureCollection, names: Record<number, string>): string[] {
  return fc.features.flatMap(f => {
    const no = Number(f.properties.AC_NO), eci = String(f.properties.AC_NAME), ours = names[no];
    return ours !== undefined && similarity(eci.toUpperCase(), ours.toUpperCase()) < 0.6 ? [`${no}: ECI "${eci}" vs ours "${ours}"`] : [];
  });
}
```

`geo-cli.ts <ST>`: downloads `<resultsSite.base>ac/<eciCode>.js` to `scraper/data/raw/<slug>/2026/ac.js` (cached), seat types from `vs-2026.json`. For **AS**: writes the normalised collection to a temp file and runs `npx mapshaper <tmp> -simplify 8% keep-shapes -o precision=0.0001 frontend/public/geo/as_ac_2023.geojson` (target ≤ 600 KB; adjust the percentage and ledger it). For **KL/PY/TN/WB**: prints `numberingMismatches` against the 2021 constituency names from `seed_<slug>_vs_2021.sql`; expected none (the 2008 maps stay). `regions-2026.ts` as tested; `regions-2026-cli.ts` reads `scraper/data/as/districts-2026.json` (`{ "sources": [...], "seats": { "1": "AS_KOKRAJHAR", … } }`, all 126 seats, district codes from `seed_as_districts_regions.sql`; source: the 2023 delimitation order / Wikipedia's list of Assam assembly constituencies, recorded in `sources`) and the district→region grouping written in that seed's header comment, and writes `seed_as_2026_districts_regions.sql`.

- [ ] **Step 4: Scope the old Assam seed.** In `database/seed_as_districts_regions.sql` change every `WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS')` to `WHERE election_id IN (SELECT id FROM elections WHERE type = 'VS' AND state_id = 4 AND COALESCE(delimitation, '2008') = '2008')` (sed, then `grep -c "COALESCE(delimitation" database/seed_as_districts_regions.sql` = number of UPDATEs). In `setup.sh` add `run seed_as_2026_districts_regions.sql` right after the districts loop.

- [ ] **Step 5: Run** tests, `geo-cli.ts` for the five states, `regions-2026-cli.ts`, `setup.sh` twice on the local DB. Expected: tests PASS; `as_ac_2023.geojson` has 126 features numbered 1–126; no numbering mismatches for KL/PY/TN/WB; `SELECT count(*) FROM constituencies WHERE election_id='f6a7b8c9-d0e1-2345-f012-567890122026' AND (district_id IS NULL OR region_id IS NULL)` = 0; Assam 2021 tagging unchanged (`SELECT region_id, count(*) …` same before/after).

- [ ] **Step 6: Look** in the browser: `/election/f6a7b8c9-d0e1-2345-f012-567890122026` shows the 2023 map coloured by winner, Dispur at 33.

- [ ] **Step 7: Commit** `git commit -m "feat(geo): Assam 2023 map from ECI, 2026 districts/regions; old Assam tagging scoped to 2008 seats"`.

---

### Task 5: Region comparison for redrawn elections (spec §6)

**Files:**
- Modify: `backend/src/modules/results/results.service.ts`, `backend/src/modules/elections/elections.controller.ts`
- Create: `frontend/src/model/derive/regionComparison.ts`, `frontend/src/viewmodels/tiles/useRegionComparisonVM.ts`, `frontend/src/views/dashboard/RegionsTab.tsx`
- Modify: `frontend/src/model/api/election.service.ts` (`getRegionShares`), `frontend/src/views/dashboard/StandingsTile.tsx` (tab), `frontend/src/pages/StudioDashboard.tsx` (pass the VM), `frontend/src/i18n` locale files (`regions_tab`, `regions_approx_note`)
- Test: `backend/src/modules/results/results.service.spec.ts` (or a new `region-shares.spec.ts`), `frontend/src/model/derive/__tests__/regionComparison.test.ts`, `frontend/src/views/dashboard/__tests__/RegionsTab.test.tsx`

**Interfaces:**
- Produces: `GET /api/v1/elections/:id/region-shares` → `{ regions: { id: number; name: string; seats: number; parties: { party_id: string; votes: number; won: number }[] }[] }`; `compareRegions(cur: RegionShares, prev: RegionShares, curAlliances: Alliance[], prevAlliances: Alliance[]): RegionRow[]` where `RegionRow = { name: string; seats: [number, number]; groups: { id: string; label: string; color: string; share: [number | null, number | null]; won: [number, number] }[] }` (prev first, current second; share in % to one decimal); the statewide row is `name: 'Statewide'`, first.

- [ ] **Step 1: Failing backend test** — `getRegionShares(id)` maps the raw rows `[{ region_id: 1, region_name: 'Upper Assam', seats: 2n, party_id: 'BJP', votes: 100n, won: 2n }, { region_id: 1, region_name: 'Upper Assam', seats: 2n, party_id: 'INC', votes: 50n, won: 0n }]` (mock `prisma.$queryRaw`) to `{ regions: [{ id: 1, name: 'Upper Assam', seats: 2, parties: [{ party_id: 'BJP', votes: 100, won: 2 }, { party_id: 'INC', votes: 50, won: 0 }] }] }`. Run `cd backend && npx jest src/modules/results -t region` — Expected: FAIL.

- [ ] **Step 2: Implement** in `results.service.ts` (cached like vote-share, key `'region-shares'`):

```ts
async getRegionShares(id: string) {
  return this.cache.getOrSet(await this.versionedKey(id, 'region-shares'), CACHE_TTL.VOTE_SHARE, () => this.loadRegionShares(id));
}

private async loadRegionShares(id: string) {
  const rows: { region_id: number; region_name: string; seats: bigint; party_id: string; votes: bigint; won: bigint }[] = await this.prisma.$queryRaw`
    SELECT g.id AS region_id, g.name AS region_name,
           (SELECT count(*) FROM constituencies k2 WHERE k2.election_id = ${id}::uuid AND k2.region_id = g.id)::bigint AS seats,
           c.party_id, SUM(r.votes)::bigint AS votes, COUNT(*) FILTER (WHERE r.status = 'WON')::bigint AS won
    FROM results r JOIN candidates c ON c.id = r.candidate_id JOIN constituencies k ON k.id = r.const_id JOIN regions g ON g.id = k.region_id
    WHERE r.election_id = ${id}::uuid
    GROUP BY g.id, g.name, c.party_id ORDER BY g.name, votes DESC`;
  const byRegion = new Map<number, { id: number; name: string; seats: number; parties: { party_id: string; votes: number; won: number }[] }>();
  for (const r of rows) {
    const g = byRegion.get(r.region_id) ?? { id: r.region_id, name: r.region_name, seats: Number(r.seats), parties: [] };
    g.parties.push({ party_id: r.party_id, votes: Number(r.votes), won: Number(r.won) });
    byRegion.set(r.region_id, g);
  }
  return { regions: [...byRegion.values()] };
}
```

Controller: `@Get(':id/region-shares') getRegionShares(@Param('id', ParseUUIDPipe) id: string) { return this.resultsService.getRegionShares(id); }` (public, same caching headers as vote-share). Run the test — PASS.

- [ ] **Step 3: Failing model test** (`regionComparison.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { compareRegions } from '../regionComparison';

const prev = { regions: [{ id: 1, name: 'Upper Assam', seats: 2, parties: [{ party_id: 'BJP', votes: 60, won: 1 }, { party_id: 'INC', votes: 40, won: 1 }] }] };
const cur = { regions: [{ id: 1, name: 'Upper Assam', seats: 3, parties: [{ party_id: 'BJP', votes: 70, won: 3 }, { party_id: 'BOPF', votes: 10, won: 0 }, { party_id: 'INC', votes: 20, won: 0 }] }] };
const nda26 = [{ id: 'NDA', name: 'NDA', color: '#f80', parties: ['BJP', 'BOPF'] }, { id: 'INCALL', name: 'Congress+', color: '#19a', parties: ['INC'] }];
const nda21 = [{ id: 'NDA', name: 'NDA', color: '#f80', parties: ['BJP'] }, { id: 'MGB', name: 'MGB', color: '#19a', parties: ['INC', 'BOPF'] }];

describe('compareRegions', () => {
  it('compares each year\'s own alliances, matched by id, with a statewide row first', () => {
    const rows = compareRegions(cur, prev, nda26, nda21);
    expect(rows.map(r => r.name)).toEqual(['Statewide', 'Upper Assam']);
    const nda = rows[1].groups.find(g => g.id === 'NDA')!;
    expect(nda).toMatchObject({ share: [60, 80], won: [1, 3] });
    expect(rows[1].groups.find(g => g.id === 'INCALL')).toMatchObject({ share: [null, 20] });
    expect(rows[1].groups.find(g => g.id === 'MGB')).toMatchObject({ share: [40, null] });
    expect(rows[1].seats).toEqual([2, 3]);
  });
  it('puts parties in no alliance under Others', () => {
    const rows = compareRegions(cur, prev, [], []);
    expect(rows[0].groups).toEqual([{ id: 'OTHERS', label: 'Others', color: 'var(--color-fallback)', share: [100, 100], won: [2, 3] }]);
  });
});
```

Run `cd frontend && npx vitest run src/model/derive/__tests__/regionComparison.test.ts` — FAIL.

- [ ] **Step 4: Implement** `regionComparison.ts` (pure; no React):

```ts
export interface RegionShares { regions: { id: number; name: string; seats: number; parties: { party_id: string; votes: number; won: number }[] }[] }
export interface Alliance { id: string; name: string; color: string; parties: string[] }
export interface RegionRow { name: string; seats: [number, number]; groups: { id: string; label: string; color: string; share: [number | null, number | null]; won: [number, number] }[] }

type Tally = Map<string, { votes: number; won: number }>;
const groupOf = (alliances: Alliance[], party: string) => alliances.find(a => a.parties.includes(party))?.id ?? 'OTHERS';
function tally(parties: RegionShares['regions'][number]['parties'], alliances: Alliance[]): { t: Tally; total: number } {
  const t: Tally = new Map(); let total = 0;
  for (const p of parties) { const g = groupOf(alliances, p.party_id); const x = t.get(g) ?? { votes: 0, won: 0 }; x.votes += p.votes; x.won += p.won; t.set(g, x); total += p.votes; }
  return { t, total };
}
const pct = (v: number | undefined, total: number) => (v === undefined || total === 0 ? null : Math.round((v / total) * 1000) / 10);

export function compareRegions(cur: RegionShares, prev: RegionShares, curAlliances: Alliance[], prevAlliances: Alliance[]): RegionRow[] {
  const meta = new Map<string, { label: string; color: string }>([['OTHERS', { label: 'Others', color: 'var(--color-fallback)' }]]);
  for (const a of [...prevAlliances, ...curAlliances]) meta.set(a.id, { label: a.name, color: a.color });
  const all = (s: RegionShares) => ({ id: 0, name: 'Statewide', seats: s.regions.reduce((n, r) => n + r.seats, 0), parties: s.regions.flatMap(r => r.parties) });
  const pairs = [[all(prev), all(cur)], ...cur.regions.map(c => [prev.regions.find(p => p.name === c.name) ?? { ...c, seats: 0, parties: [] }, c])];
  return pairs.map(([p, c]) => {
    const a = tally(p.parties, prevAlliances), b = tally(c.parties, curAlliances);
    const ids = [...new Set([...a.t.keys(), ...b.t.keys()])].sort((x, y) => (x === 'OTHERS' ? 1 : y === 'OTHERS' ? -1 : (b.t.get(y)?.votes ?? 0) - (b.t.get(x)?.votes ?? 0)));
    return { name: c.name, seats: [p.seats, c.seats] as [number, number], groups: ids.map(id => ({ id, ...meta.get(id)!,
      share: [pct(a.t.get(id)?.votes, a.total), pct(b.t.get(id)?.votes, b.total)] as [number | null, number | null],
      won: [a.t.get(id)?.won ?? 0, b.t.get(id)?.won ?? 0] as [number, number] })) };
  });
}
```

Run — PASS. (Adjust the "Others" test expectation's order of keys only if `toEqual` reports a key-order difference — `toEqual` ignores key order, so none expected.)

- [ ] **Step 5: VM + view + wiring.**
  - `election.service.ts`: `export const getRegionShares = (id: string) => apiFetch<RegionShares>(`/elections/${id}/region-shares`);`
  - `useRegionComparisonVM(election, manifest)`: returns `null` unless the election is VS and the state's previous VS election (latest earlier year of the same state, from the elections list the dashboard already loads) has a **different** `delimitation`; otherwise loads both elections' region shares and both manifests' `alliances` (`getManifest(prevId)`) via `useApi` and returns `{ rows: compareRegions(...), prevYear, curYear, approxNote: true }`.
  - `RegionsTab.tsx`: a table per row: region name, seats `prev → cur`, then per group a cell `share[0]% → share[1]%` with the group colour dot (`—` for null), and the note `t('regions_approx_note', 'Regions are compared as a whole; a few seats straddle regions after the 2023 redraw, so this is approximate.')`. Tailwind classes only (file is under `src/views`).
  - `StandingsTile.tsx`: a fourth tab `'regions'` shown only when the VM is non-null (like `withSummary`), labelled `t('regions_tab', 'Regions')`.
  - `RegionsTab.test.tsx`: renders two rows from a fixed VM and shows `60% → 80%` and the approx note; StandingsTile test: the Regions tab is absent when the VM is null.
  - Run `cd frontend && npx vitest run && npm run lint` — PASS.

- [ ] **Step 6: Look** in the browser at Assam 2026: Standings → Regions shows Statewide + six regions with 2021 → 2026 shares; Bihar 2025 has no Regions tab.

- [ ] **Step 7: Commit** `git commit -m "feat: region comparison for elections after a redraw (Assam 2026 vs 2021)"`.

---

### Task 6: Person links for 2026

**Files:**
- Modify: `scraper/src/bihar/links.ts`, `scraper/src/bihar/links-cli.ts`, `scraper/src/bihar/elections.ts` (`StateConfig.linksSeedV2`)
- Create: `database/seed_{kl,py,tn,wb}_person_links_v2.sql`
- Test: `scraper/src/bihar/__tests__/links.test.ts`

**Interfaces:**
- Produces: `Candidacy.era: string` (delimitation); `groupCandidacies` links only candidacies of the same `era`; `onlyGroupsTouching(groups, year): LinkGroup[]`.

- [ ] **Step 1: Failing tests**

```ts
it('never links candidacies across delimitations (same seat number, different boundaries)', () => {
  const a = { candidateId: 'a', year: 2021, constNo: 33, name: 'Ram Das', partyId: 'BJP', age: 50, era: '2008' };
  const b = { candidateId: 'b', year: 2026, constNo: 33, name: 'Ram Das', partyId: 'BJP', age: 55, era: '2023' };
  expect(groupCandidacies([a, b])).toEqual([]);
});
it('keeps only the groups that include a candidacy of the given year (the v2 seed adds 2026 only)', () => {
  const g = (y: number) => ({ key: 'k' + y, confidence: 'high' as const, members: [{ candidateId: 'x' + y, year: y, constNo: 1, name: 'A B', partyId: 'P', age: 40, era: '2008' }] });
  expect(onlyGroupsTouching([g(2021), g(2026)], 2026).map(x => x.key)).toEqual(['k2026']);
});
```

- [ ] **Step 2: Run** `npx vitest run src/bihar/__tests__/links.test.ts` — FAIL.

- [ ] **Step 3: Implement**: add `era` to `Candidacy` (links-cli fills it from `electionOf(ST, y).newElection?.delimitation ?? '2008'`); in `groupCandidacies` key by `${era}:${constNo}` instead of `constNo`; add `onlyGroupsTouching`. `links-cli.ts <ST> 2026` writes `seed_<slug>_person_links_v2.sql` (name `seed_<slug>_person_links_v2`) from `onlyGroupsTouching(groups, 2026)`; the v1 files stay untouched (regenerating them must give no diff — check). Assam: the CLI prints "no seat-level links for a new delimitation" and writes no file. Same never-move rules as v1 (curated persons, merges, admin splits, admin-entered profiles).

- [ ] **Step 4: Run** tests (PASS), `for s in KL PY TN WB; do npx ts-node src/bihar/links-cli.ts $s 2026; done`, `git status --short database` shows only the four new v2 files. Review `scraper/data/<slug>/links-review.json` samples (ages fit). Wire in `setup.sh` after the v1 loop: `for st in kl py tn wb; do run "seed_${st}_person_links_v2.sql"; done`.

- [ ] **Step 5: Commit** `git commit -m "feat(seed): link 2026 candidates to their 2011-2021 persons (same delimitation only; run-once v2)"`.

---

### Task 7: State-aware current-track tools (Bihar output unchanged)

**Files:**
- Modify: `scraper/src/bihar/leaders-data.ts` (`LeaderYear = string`), `leaders-seed.ts`, `leaders-cli.ts`, `leaders-check-cli.ts`, `profiles-cli.ts`, `photos.ts`, `photos-cli.ts`, `affidavits.ts`, `affidavits-cli.ts`, `party-profiles.ts`, `party-profiles-cli.ts`
- Test: the existing tests of those modules + new cases below

**Interfaces:**
- Produces (Bihar defaults keep today's output):
  - `emitLeadersSeed(f, people, electionIds, opts: { stateId: number; stateName: string; seedName: string; years: string[] } = BIHAR_LEADERS)`
  - `emitPhotosSeed(rows, opts: { seedName: string; label: string } = BIHAR_PHOTOS)`
  - `emitAffidavitsSeed(byYear, opts: { seedName: string; label: string } = BIHAR_AFFIDAVITS)`; slugs from the registry (`myneta`) with `MYNETA_SLUGS` kept for Bihar
  - `emitPartyProfilesSeed(profiles, approved, removed, opts: { seedName: string; label: string } = BIHAR_PARTIES)`
  - CLIs take `<STATE> [year]` (default `BR`, Bihar's years) and read/write `scraper/data/<slug>/…`, `seed_<slug>_{leaders,candidate_photos,affidavits,party_profiles}.sql` (Bihar keeps its names).

- [ ] **Step 1: Failing tests**, one per module, e.g. leaders:

```ts
it('names the state and seed for another state', () => {
  const sql = emitLeadersSeed(file2026, people, { '2026': 'e5f6a7b8-c9d0-1234-ef01-456789012026' }, { stateId: 31, stateName: 'Tamil Nadu', seedName: 'seed_tn_leaders', years: ['2026'] });
  expect(sql).toContain("seed_runs WHERE name = 'seed_tn_leaders'");
  expect(sql).toContain('state_id = COALESCE(state_id, 31)');
  expect(sql).not.toMatch(/Bihar/);
});
```

and the same shape for photos (`seed_as_candidate_photos`, label "Assam 2026"), affidavits (`seed_kl_affidavits`) and party profiles (`seed_wb_party_profiles`).

- [ ] **Step 2: Run** the four test files — FAIL.

- [ ] **Step 3: Implement** the options with Bihar defaults; move the hard-coded 2025 results-site URLs in `photos-cli.ts` to the registry (`resultsSite`, adding `{ base: 'https://results.eci.gov.in/ResultAcGenNov2025/', eciCode: 'S04' }` to Bihar 2025). `bioFor` uses the state name.

- [ ] **Step 4: Verify Bihar unchanged**: run each Bihar CLI in its offline/emit mode (`leaders-cli.ts BR`, `affidavits-cli.ts BR` from its cache, `party-profiles-cli.ts BR`, `photos-cli.ts BR` with its saved `photos-2025.json`, no uploads) and `git diff --stat -- database/seed_bihar* database/seed_party_symbols.sql` → empty. All suites PASS.

- [ ] **Step 5: Commit** `git commit -m "refactor(seed): leaders, photos, affidavits, party profiles take a state (Bihar output unchanged)"`.

---

### Task 8: Leaders for the five states (curated, user-approved)

**Files:**
- Create: `scraper/data/<slug>/leaders.json`, `leader-profiles.json` (×5), `database/seed_<slug>_leaders.sql` (×5)
- Modify: `database/setup.sh`

- [ ] **Step 1: Research** (one agent per state is fine): CM, deputy CMs, Leader of the Opposition, the losing CM face, and up to 12 cabinet ministers **who contested 2026**, each with the seat (2026 const id) and `sources` (ministry articles, ECI). Known: Assam Himanta Biswa Sarma (BJP, CM); Kerala V.D. Satheesan (INC, CM); Tamil Nadu Vijay (TVK, CM); West Bengal Suvendu Adhikari (BJP, CM; won Bhabanipur against Mamata Banerjee); Puducherry N. Rangasamy (AINRC, CM). Validate: `npx ts-node src/bihar/leaders-cli.ts <ST> 2026 --check` (runs `validateLeaders`). Expected: no problems.

- [ ] **Step 2: Show the five lists to the user and wait for approval.** No seeding before.

- [ ] **Step 3: Profiles**: `BLOB_READ_WRITE_TOKEN=… npx ts-node src/bihar/profiles-cli.ts <ST>` (Wikidata photo + day-precision birth date + Commons licence → Blob `persons/<QID>/photo.<ext>`). Then `npx ts-node src/bihar/leaders-cli.ts <ST> 2026` writes `seed_<slug>_leaders.sql` (watchlists into the 2026 manifest only if empty, and into an open draft the same way).

- [ ] **Step 4: Wire + check**: `setup.sh` runs `seed_<st>_leaders.sql` after the person links (v2); run setup twice; `leaders-check-cli.ts <ST>` query returns no rows; the dashboard leaders strip shows each CM with photo.

- [ ] **Step 5: Commit** `git commit -m "feat(seed): 2026 leaders for AS, KL, PY, TN, WB (curated, user-approved)"`.

---

### Task 9: Top parties per state (researched, user-approved)

**Files:**
- Create: `scraper/data/<slug>/parties-2026.json` (×5), images under `frontend/public/symbols/{logos,eci}/`, `database/seed_<slug>_party_profiles.sql` (×5)
- Modify: `database/seed_party_symbols.sql` (rewritten by the CLI), `database/setup.sh`

- [ ] **Step 1: Pick** per state: parties that won a seat, got 1 %+ of the vote, or are alliance members (from `vs-2026.json`). Skip parties already profiled for Bihar 2025 (BJP, INC, CPI, CPI(M), …) unless a field is missing.
- [ ] **Step 2: Research** (`parties-2026.json`, playbook §7 fields, sources per field, Commons images with free licences only; colours from Wikipedia's party-colour template — check each new colour against the other parties on the same map, as with RJD/JD(U)).
- [ ] **Step 3: Review page**: a temporary contact sheet on the dev server (as for Bihar 2025); **show it to the user and wait for approval**; remove the page after.
- [ ] **Step 4: Emit** `npx ts-node src/bihar/party-profiles-cli.ts <ST>`; wire `seed_<st>_party_profiles.sql` after `seed_bihar_party_profiles.sql`; setup twice; spot-check TVK, AITC, AIUDF, IUML, AINRC marks on the dashboards.
- [ ] **Step 5: Commit** `git commit -m "feat(seed): 2026 top parties of the five states (researched, user-approved)"`.

---

### Task 10: Candidate photos (top 4 per seat)

**Files:**
- Create: `scraper/data/<slug>/photos-2026.json` (progress), `database/seed_<slug>_candidate_photos.sql` (×5)
- Modify: `scraper/src/live/__tests__/fixtures/` (one 2026 candidate-wise page), `database/setup.sh`
- Test: `scraper/src/bihar/__tests__/photos.test.ts`

- [ ] **Step 1: Failing test** — `parseCandidateDetailPage` on the saved 2026 fixture (`candidateswise-S0333.htm`) returns Pradyut Bordoloi with `votes: 103337`, `photo` ending `PRADY-2026-20260323102154.jpg`; `matchPhoto` matches a candidate named "Jayanta Kumar Das" to the card with his exact votes even though the file is `SRIJA-…jpg`, and returns `null` when no card has his votes and no unique close name.
- [ ] **Step 2: Run** — FAIL until the fixture/matching handle 2026 (fix only what fails).
- [ ] **Step 3: Run** `BLOB_READ_WRITE_TOKEN=… nohup npx ts-node src/bihar/photos-cli.ts <ST> 2026 > photos-<st>.log 2>&1 &` per state (resumable; ~4 × seats downloads, 240 px JPEG, Blob `persons/eci2026/<st>-<seat>-<serial>.jpg`, ECI credit "no licence stated"). Expected log: matched ≈ 4 × seats, the unmatched listed.
- [ ] **Step 4: Wire** after the leaders seeds; setup twice; seat pages show the top-4 photos.
- [ ] **Step 5: Commit** `git commit -m "feat(seed): 2026 top-4 candidate photos from the ECI results site (Blob, credited)"`.

---

### Task 11: Winners' affidavits (MyNeta)

**Files:**
- Modify: `scraper/src/bihar/affidavits.ts` (decode scripted rows)
- Create: `database/seed_<slug>_affidavits.sql` (×5)
- Test: `scraper/src/bihar/__tests__/affidavits.test.ts`

- [ ] **Step 1: Failing test** — `parseWinners` on a saved MyNeta snippet containing one plain row and one `<script>var _0x…;eval(…)</script>` row returns both rows; the decoder runs each script in `vm.runInNewContext` with `{ document: { write: (s) => out.push(s) } }` and a 1 s timeout, and parses the written `<tr>`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `decodeScriptedRows(html): string` (replaces each script block with what it writes), used by `parseWinners` before parsing. Duplicate seat names resolved by the winner's name (existing rule).
- [ ] **Step 4: Run** `npx ts-node src/bihar/affidavits-cli.ts <ST> 2026` per state. Expected: matched = seats minus a few, unmatched listed and checked by hand (by-election rows skipped). Wire after the photos; setup twice.
- [ ] **Step 5: Commit** `git commit -m "feat(seed): 2026 winners' affidavits from MyNeta (incl. scripted rows)"`.

---

### Task 12: Verify, document

**Files:**
- Modify: `scraper/src/bihar/bihar-snapshot.sql` (include 2026), `frontend/src/model/about/about.ts` + `frontend/src/pages/__tests__/About.test.tsx`, `docs/FEATURES.md`, `CLAUDE.md`, `docs/DEPLOYMENT.md`, `docs/SEEDING_PLAYBOOK.md`, `docs/UPCOMING_2026_ELECTIONS.md` (mark done / fix Assam delimitation)

- [ ] **Step 1: About** — five rows "<State> 2026": source ECI Statistical Report, quality `real`, flags `['all_candidates']`; About test expects them. Run `cd frontend && npx vitest run src/pages/__tests__/About.test.tsx` (RED first, then GREEN).
- [ ] **Step 2: Two-DB check** from the pre-branch backup (restore it as `et_before`, `SRC_DB=et_before scraper/src/bihar/two-db-check.sh`). Expected: `rerun: same`, constituencies/candidates/results/parties same.
- [ ] **Step 3: Checks on the local DB**: one WON per seat for all 2026 elections; alliance gaps 0; Assam 2026 has no `compare_with`/`history` and its seats show "new"; no Assam 2026 candidate shares a person with a 2008-era Assam candidacy except through leaders curation (`SELECT … WHERE` both years) — expected only curated leaders.
- [ ] **Step 4: Browser**: each 2026 dashboard (map, standings, leaders strip), one seat page per state (all candidates, photos, affidavit on the winner), Assam Regions tab, About.
- [ ] **Step 5: Docs** — FEATURES (2026 data, region comparison), CLAUDE seed order (2026 years, `seed_as_2026_districts_regions.sql`, links v2, per-state leaders/photos/affidavits/party profiles), DEPLOYMENT (Phase 2B paragraph: new seeds, publish/discard 2026 manifest drafts first, the 2026 ids for the *later* seat-analysis recompute), playbook (new traps found).
- [ ] **Step 6: All suites** (scraper, backend `--runInBand`, frontend, admin) + `npm run lint` (frontend). Commit `git commit -m "docs: 2026 data for five states (About, features, seed order, deployment)"`.
