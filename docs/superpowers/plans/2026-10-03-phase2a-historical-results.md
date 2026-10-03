# Phase 2A: Historical Results for Five States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real ECI results for every candidate in the 15 elections of Assam, West Bengal, Tamil Nadu, Kerala and
Puducherry since 2011, correcting the rows already in the DB, with cross-election person linking. This is the
historical track: results only.

**Architecture:** Make the Bihar pipeline (`scraper/src/bihar/`) state-aware via one election registry, keeping Bihar's
generated seeds byte-identical. Then run the same fetch → parse → ECI-internal cross-check → JSON → seeds flow per
state: a run-once corrections seed before the year seeds, plus a run-once person-links seed.

**Tech Stack:** TypeScript (ts-node, vitest) in `scraper/`, SheetJS, `pdftotext -layout`, PostgreSQL via psql, bash.

**Spec:** `docs/superpowers/specs/2026-10-03-phase2-five-states-design.md` (§2–§4, §7). How-to: `docs/SEEDING_PLAYBOOK.md`
(historical track). Worked example: `docs/superpowers/plans/2026-10-03-bihar-results-seeding.md`.

## Global Constraints

- **Historical track only:** results (every candidate + NOTA, votes, SC/ST, electors, turnout, phase), party mapping,
  corrections of existing rows, person linking, About page. No photos, leaders, party profiles, affidavits or candidate
  details.
- **Bihar must not change:** after the refactor, regenerating Bihar's seeds (`generate-cli.ts BR`, `links-cli.ts BR`)
  gives byte-identical files (`git diff --exit-code database/`).
- Seed rules (CLAUDE.md): seeds re-run every deploy; `ON CONFLICT DO NOTHING`; run-once via `runOnce` + `seed_runs`;
  never write `*.metadata`; keep existing candidate/result/constituency ids. Corrections seeds run **before** the year
  seeds, start with the pre-flight, and are **frozen** once generated (a later fix is `_v2`).
- Result conventions: votes = ECI total; WON/LOST; margin = top − second non-NOTA on every row; NOTA LOST;
  turnout = voters ÷ electors; phase = rank of poll date; all-caps names → Title Case.
- Election registry values (copied from the current seeds, verified 2026-10-03):

  | State | code / slug | state_id | seats | SC / ST (2008 delimitation) | const prefix | election ids |
  |---|---|---|---|---|---|---|
  | Assam | AS / as | 4 | 126 | 8 / 16 | AS_VS11_, AS_VS16_, AS_VS21_ | f6a7b8c9-d0e1-2345-f012-56789012{2011,2016,2021} |
  | Kerala | KL / kl | 16 | 140 | 14 / 2 | KL_VS11_, … | a7b8c9d0-e1f2-3456-0123-67890123{2011,2016,2021} |
  | Puducherry | PY / py | 27 | 30 | 5 / 0 | PY_VS11_, … | b1c2d3e4-f5a6-7890-1234-567890ab{2011,2016,2021} |
  | Tamil Nadu | TN / tn | 31 | 234 | 44 / 2 | TN_VS11_, … | e5f6a7b8-c9d0-1234-ef01-45678901{2011,2016,2021} |
  | West Bengal | WB / wb | 36 | 294 | 68 / 16 | WB_VS11_, … | d4e5f6a7-b8c9-0123-def0-34567890{1011,1016,1021} |

  (Exact ids: the year is appended as shown. Assam/Kerala/Puducherry/Tamil Nadu end in `2011`/`2016`/`2021`; West
  Bengal ends in `1011`/`1016`/`1021`.)
  ECI report docids: AS 4010/4017/13620, KL 3763/3767/13827, PY 3438/3474/13417, TN 3340/3473/13680,
  WB 3195/3469/14106 (2011/2016/2021). 2011 and 2016 are single PDFs, 2021 is XLSX.
- Expected distinct poll dates (for validation): WB 6 / 7 / 8, TN 1 / 2 / 1 (2016: two seats polled later), KL 1 / 1 / 1,
  AS 2 / 2 / 3, PY 1 / 1 / 1. **Confirm each from the report's "Schedule of Election" page while parsing; if a report
  differs, correct the registry and ledger a ruling** (the report is the source of truth). The same goes for SC/ST counts,
  confirmed from the report's Highlights.
- Seat counts: the registry value, except TN 2016, where the report's own seat count is used (232 or 234; see Task 5).
- Commands from `scraper/`: `npx vitest run <path>`, `npm run typecheck`, `npx ts-node src/bihar/<cli>.ts <STATE> [years]`.
  Local DB `postgresql://admin:password123@localhost:3083/election_tracker`.

## Review Focus

1. **Bihar regression from the refactor** (paths, names, the `_BR` suffix, header text). Expected: Bihar seeds
   byte-identical, and the Bihar tests unchanged and green. Pinned in Task 1 (the regeneration diff is part of the test step).
2. **State-specific report layouts** (names with initials like "K. PONMUDY", Malayalam/Bengali transliterations, wrapped
   party names, missing NOTA in 2011, reserved markers). Expected: every deviation gets a fixture test before its fix;
   the cross-check passes with no exception added for a parser bug. Pinned in Tasks 3–7.
3. **TN 2016 postponed seats and WB 2021's adjourned seats (AC 56/58).** Expected: the report's own data decides; no
   seat invented or dropped silently, and the seat count is ledgered. Pinned in Tasks 5 and 7.
4. **A party id from another state colliding with a new party** (e.g. an existing `JJP` vs a new West Bengal party).
   Expected: the suggester suffixes with the state code (`_WB`), never reuses an unrelated id. Pinned in Task 2.
5. **Old placeholder rows** (Assam 2021 "<PARTY> Candidate", PY 2021 winners only) matched to real candidates.
   Expected: matched by seat + party and renamed, or listed for a decision; never two rows for one candidate. Pinned in Task 8.

---

## File Structure

| File | Responsibility |
|---|---|
| `scraper/src/bihar/elections.ts` (new) | Registry: `STATES`, `ELECTIONS`, `electionsOf`, `electionOf`, file and seed names per state |
| `scraper/src/bihar/years.ts` | Keeps `YEARS` (Bihar) derived from the registry, for existing imports |
| `scraper/src/bihar/load.ts` | `dataDir(state)`, `rawDir(state)`, `loadRaw(state, year)`, shared `PARTY_DIR` |
| `scraper/src/bihar/crosscheck.ts` | `validateElection(e, cfg)` uses the registry's seats / reserved / phases |
| `scraper/src/bihar/emit.ts` | State id, labels and seed names from the registry |
| `scraper/src/bihar/{fetch,parse,generate,links,suggest-parties}-cli.ts`, `seeded.ts` | Take a state code |
| `scraper/src/bihar/party-map.ts` | Collision suffix = state code |
| `scraper/data/parties/party-map.json`, `party-aliases.json` | Shared across states (moved from `data/bihar/`) |
| `scraper/data/<slug>/vs-<year>.json`, `decisions.json`, `crosscheck-exceptions.json`, `supplement.json` | Per state |
| `database/seed_<slug>_vs_parties.sql`, `seed_<slug>_corrections_v1.sql`, `seed_<slug>_person_links_v1.sql` | New per state |
| `database/seed_<slug>_vs_<year>.sql` | Regenerated |
| `scraper/src/bihar/bihar-snapshot.sql`, `two-db-check.sh` | Cover all six states |

---

### Task 1: Election registry; state-aware pipeline; Bihar byte-identical

**Files:**
- Create: `scraper/src/bihar/elections.ts`, `scraper/src/bihar/__tests__/elections.test.ts`
- Modify: `years.ts`, `load.ts`, `crosscheck.ts`, `emit.ts`, `seeded.ts`, `parse-cli.ts`, `generate-cli.ts`, `links-cli.ts`,
  `suggest-parties-cli.ts`, `fetch-cli.ts`, `leaders-cli.ts`, `affidavits-cli.ts`, `photos-cli.ts`, `leaders-check-cli.ts`, `find-cli.ts`
- Move: `scraper/data/bihar/party-map.json`, `party-aliases.json` → `scraper/data/parties/` (`git mv`)
- Test: existing `crosscheck.test.ts`, `emit.test.ts` (adjust signatures), new `elections.test.ts`

**Interfaces:**
- Produces:

```ts
// elections.ts
export type StateCode = 'BR' | 'WB' | 'TN' | 'KL' | 'AS' | 'PY';
export interface StateConfig {
  code: StateCode; slug: string; name: string; stateId: number; seats: number; reserved: { sc: number; st: number };
  /** File names of the generated seeds (Bihar keeps its historical names). */
  partiesSeed: string; correctionsSeed: string; linksSeed: string; linksSeedName: string; yearSeed: (year: number) => string;
}
export interface ElectionConfig extends YearConfig { state: StateCode; expectedPhases: number; seats?: number }
export const STATES: Record<StateCode, StateConfig>;
export const ELECTIONS: ElectionConfig[];
export function electionsOf(state: StateCode): ElectionConfig[];          // ascending year
export function electionOf(state: StateCode, year: number): ElectionConfig; // throws when unknown
export function parseState(arg: string | undefined): StateCode;           // CLI helper; throws listing the codes
```

  Bihar values: `slug 'bihar'`, `partiesSeed 'seed_bihar_parties.sql'`, `correctionsSeed 'seed_bihar_corrections_v1.sql'`,
  `linksSeed 'seed_bihar_person_links_v2.sql'`, `linksSeedName 'seed_bihar_person_links_v2'`, `yearSeed y => 'seed_bihar_vs_${y}.sql'`,
  seats 243, reserved 38/2, phases 6/5/3/2. Other states: `seed_<slug>_vs_parties.sql`, `seed_<slug>_corrections_v1.sql`,
  `seed_<slug>_person_links_v1.sql` (name without `.sql`), `seed_<slug>_vs_<year>.sql`.
- `Year` in `types.ts` widens to `number` (the registry is the list of valid years).
- `load.ts`: `dataDir(state)`, `rawDir(state)`, `PARTY_DIR`, `loadRaw(state, year)`, `loadPartyLists(state)`.
- `crosscheck.ts`: `validateElection(e: ElectionJson, cfg: ElectionConfig): string[]` (seats = `cfg.seats ?? state.seats`).
- `emit.ts`: `Plan` gains `cfg: ElectionConfig`; `emitCorrections(plans, state: StateConfig)`; labels use `state.name`.
- `seeded.ts`: `loadSeeded(state, year)`.
- Every CLI takes the state code as its first argument (`npx ts-node src/bihar/parse-cli.ts WB 2011 2016 2021`).

- [ ] **Step 1: Failing test**

```ts
// scraper/src/bihar/__tests__/elections.test.ts
import { describe, it, expect } from 'vitest';
import { ELECTIONS, STATES, electionOf, electionsOf, parseState } from '../elections';

describe('election registry', () => {
  it('lists every state election once, with unique ids and prefixes', () => {
    expect(ELECTIONS).toHaveLength(4 + 15);
    expect(new Set(ELECTIONS.map(e => e.electionId)).size).toBe(ELECTIONS.length);
    expect(new Set(ELECTIONS.map(e => e.constPrefix)).size).toBe(ELECTIONS.length);
  });
  it('keeps Bihar exactly as before', () => {
    expect(electionsOf('BR').map(e => [e.year, e.electionId, e.constPrefix, e.expectedPhases])).toEqual([
      [2010, 'a1b2c3d4-e5f6-7890-abcd-111111111010', 'BR_VS10_', 6], [2015, 'a1b2c3d4-e5f6-7890-abcd-111111111015', 'BR_VS15_', 5],
      [2020, 'b2c3d4e5-f6a7-8901-bcde-123456789020', 'BR_VS20_', 3], [2025, 'c3d4e5f6-a7b8-9012-cdef-234567890abc', 'BR_VS_', 2],
    ]);
    expect(STATES.BR).toMatchObject({ stateId: 5, seats: 243, reserved: { sc: 38, st: 2 }, partiesSeed: 'seed_bihar_parties.sql', correctionsSeed: 'seed_bihar_corrections_v1.sql', linksSeedName: 'seed_bihar_person_links_v2' });
    expect(STATES.BR.yearSeed(2020)).toBe('seed_bihar_vs_2020.sql');
  });
  it('has the five states with their ids and seed names', () => {
    expect(electionOf('WB', 2021)).toMatchObject({ electionId: 'd4e5f6a7-b8c9-0123-def0-345678901021', constPrefix: 'WB_VS21_' });
    expect(electionOf('AS', 2011)).toMatchObject({ electionId: 'f6a7b8c9-d0e1-2345-f012-567890122011', constPrefix: 'AS_VS11_' });
    expect(STATES.TN).toMatchObject({ stateId: 31, seats: 234, reserved: { sc: 44, st: 2 }, correctionsSeed: 'seed_tn_corrections_v1.sql', linksSeedName: 'seed_tn_person_links_v1' });
    expect(STATES.KL.yearSeed(2016)).toBe('seed_kl_vs_2016.sql');
  });
  it('rejects unknown states and years', () => {
    expect(() => parseState('XX')).toThrow(/BR, WB, TN, KL, AS, PY/);
    expect(() => electionOf('KL', 2006)).toThrow(/KL 2006/);
  });
});
```

Run: `npx vitest run src/bihar/__tests__/elections.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement `elections.ts`** with the registry table from Global Constraints (sources: Bihar's existing `source`/`files`
  from `years.ts`; for the new states `source: { title: 'ECI Statistical Report, <State> Legislative Assembly <year>', url: OLD(docid) }`
  and `files` filled in Task 3 onwards. Until a state's files are fetched, use `{ pdf: '<year>/ECI_Statistical_Report_<CODE>_AE_<year>.pdf' }`
  for 2011/2016 and the XLSX set names for 2021 as they arrive). Rewrite `years.ts` as
  `export const YEARS = Object.fromEntries(electionsOf('BR').map(e => [e.year, e])) as Record<number, ElectionConfig>;` and keep the
  `YearConfig` interface there.

- [ ] **Step 3: Thread the state through the pipeline** (signatures above). Mechanical changes:
  - `load.ts`: `dataDir = (s) => path.resolve(__dirname, '../../data', STATES[s].slug)`, `rawDir = (s) => path.resolve(__dirname, '../../data/raw', STATES[s].slug)`,
    `PARTY_DIR = path.resolve(__dirname, '../../data/parties')`. Keep `DATA_DIR = dataDir('BR')` exported for the Bihar-only CLIs
    (leaders, profiles, photos, affidavits, party profiles), which are unchanged otherwise.
  - `crosscheck.ts`: drop `EXPECTED_PHASES`; `validateElection(e, cfg)` uses `cfg.seats ?? STATES[cfg.state].seats`,
    `STATES[cfg.state].reserved`, `cfg.expectedPhases`, with the same messages (`seats:`, `reserved:`, `phases:`).
  - `emit.ts`: `STATE_ID` → `STATES[plan.cfg.state].stateId`. Header and pre-flight strings use `state.name`
    (Bihar text identical: "Bihar Vidhan Sabha …", "% Bihar candidates …"). Corrections `name` = `correctionsSeed` without `.sql`.
  - `generate-cli.ts`, `seeded.ts`, `links-cli.ts`, `parse-cli.ts`, `suggest-parties-cli.ts`, `fetch-cli.ts`: first argument =
    state (`parseState(process.argv[2])`), all paths and seed names from the registry, party map from `PARTY_DIR`.
    `links-cli` passes `STATES[s].linksSeedName` to `emitLinksSeed(groups, name)` (new second parameter).
  - `party-map.ts`: `suggestEntries(lists, db, map, suffix = 'BR')`; the CLI passes the state code. Rename the `_BR` literal accordingly.
  - `git mv scraper/data/bihar/party-map.json scraper/data/bihar/party-aliases.json scraper/data/parties/`.
- [ ] **Step 4: Update the existing tests** for the new signatures (`validateElection(json, electionOf('BR', 2020))`,
  `Plan.cfg`, `emitLinksSeed(groups, 'seed_bihar_person_links_v2')`). Run `npx vitest run && npm run typecheck` → PASS.
- [ ] **Step 5: Bihar byte-identical**

```bash
npx ts-node src/bihar/generate-cli.ts BR && npx ts-node src/bihar/links-cli.ts BR && npx ts-node src/bihar/parse-cli.ts BR 2010 2015 2020 2025
git diff --exit-code ../database/ ../scraper/data/bihar/
```

Expected: exit 0 (no changes). Any diff is a refactor bug: fix the code, never the data.

- [ ] **Step 6: Commit** `refactor(scraper): state-aware seeding pipeline (election registry); Bihar output unchanged`.

---

### Task 2: Per-state fetch and party suggestions

**Files:** Modify `fetch-cli.ts` (docids from the registry: `fetchOld(state, year, docid)`), `suggest-parties-cli.ts`. Test: `party-map.test.ts`.

- [ ] **Step 1: Failing test** (add to `party-map.test.ts`):

```ts
  it('suffixes a colliding new id with the given state code', () => {
    const db = [{ id: 'JJP', name: 'Jannayak Janta Party', abbreviation: 'JJP', color: '#808080', recognition: null }];
    expect(suggestEntries([{ abbr: 'JJP', name: 'Jharkhand Jan Party', recognition: 'Unrecognised' }], db, {}, 'WB').add.JHARKHANDJANPARTY.id).toBe('JJP_WB');
  });
```

- [ ] **Step 2:** implement (Task 1 added the parameter; make sure `_${suffix}` is used everywhere `_BR` was). Run → PASS.
- [ ] **Step 3:** `fetch-cli.ts <STATE> [years]`: for each election, `fetchOld(slug, year, docid)` saving into `rawDir(state)/<year>/`.
  Record the saved file names in the registry `files` (2011/2016: the single PDF; 2021: Detailed Results, Constituency
  Data Summary, List of Political Parties Participated, Performance of Political Parties).
- [ ] **Step 4: Commit** `feat(scraper): per-state ECI report fetch and party suggestions`.

---

### Tasks 3–7: One state at a time (Puducherry, Kerala, Tamil Nadu, Assam, West Bengal)

Same procedure per state; smallest first, so layout surprises are cheap. Each state is one task and one commit.

**Files:** `scraper/data/<slug>/` (JSON, exceptions, supplement if needed), registry `files` entries, parser fixes in
`xls-report.ts` / `pdf-report.ts` with fixture tests.

- [ ] **Step 1: Fetch** `npx ts-node src/bihar/fetch-cli.ts <STATE>`. Expected: 3 report sets under `scraper/data/raw/<slug>/`.
- [ ] **Step 2: Confirm the registry from the reports:** seat count, SC/ST counts (Highlights), and distinct poll dates
  (Schedule of Election). Correct the registry where a report differs and ledger a ruling.
- [ ] **Step 3: Party map** `npx ts-node src/bihar/suggest-parties-cli.ts <STATE>`. Resolve problems as in Phase 1
  (duplicates → most-used id; collisions → `_<STATE>`). Expected exit 0.
- [ ] **Step 4: Parse** `npx ts-node src/bihar/parse-cli.ts <STATE> 2011 2016 2021`. Expected: each year prints the seat
  count and `0 problems`. For each problem:
  - a parser problem → copy the real lines into a fixture test in `pdf-report.test.ts` / `xls-report.test.ts` (RED), fix
    the parser (GREEN), re-run **all** parser tests (Bihar's must stay green);
  - an error in ECI's own tables → `crosscheck-exceptions.json` entry with what each table shows;
  - blank or missing seats in a report → `supplement.json` from archived ECI results pages (as for Bihar 2015).
- [ ] **Step 5: Spot-check** three seats per year by hand against the report (seat 1, a reserved seat, the last seat):
  winner, votes, NOTA, electors.
- [ ] **Step 6: Commit** `data(<slug>): <State> 2011-2021 from ECI statistical reports (cross-checked)`.

State notes:
- **Task 5 (Tamil Nadu):** 2016 had two seats polled later (Aravakurichi, Thanjavur). Use the report's seats. If the
  report has 232, set `seats: 232` on TN 2016 in the registry and ledger it. If it has 234, the two extra seats are new
  rows; the expected phases become 2.
- **Task 6 (Assam):** 2011/2016 old rows have all seats GEN; the corrections bring the real SC/ST. 2021 old rows have
  placeholder names; they are renamed through the corrections.
- **Task 7 (West Bengal):** docid 14106 is the report *including* AC 56 & 58 (polled later, in 2021). 2021 old rows
  already have every candidate, so expect mostly matched rows with corrected votes.

---

### Task 8: Generate the seeds per state, decisions, `setup.sh`

**Files:** generated `database/seed_<slug>_vs_parties.sql`, `seed_<slug>_corrections_v1.sql`, `seed_<slug>_vs_{2011,2016,2021}.sql`;
`scraper/data/<slug>/decisions.json`, `review-<year>.json`; `database/setup.sh`.

- [ ] **Step 1:** for each state: `npx ts-node src/bihar/generate-cli.ts <STATE>`. First run lists unmatched old rows. Decide
  each in `decisions.json` (`match` to an ECI serial when clearly the same person; `delete` when no ECI candidate fits),
  then look through `lowSimilarity`. **Show the user the counts and any `delete` entries before continuing** (deleting can
  delete an auto-created person).
- [ ] **Step 2:** re-run until the generator writes the files. The corrections seed is now frozen.
- [ ] **Step 3: `setup.sh`:** in the VS loop, per state, run `seed_<slug>_vs_parties.sql` then `seed_<slug>_corrections_v1.sql`
  before that state's year files:

```bash
for st in wb as kl tn py; do
  run "seed_${st}_vs_parties.sql"
  run "seed_${st}_corrections_v1.sql"
  for y in 2011 2016 2021; do run "seed_${st}_vs_${y}.sql"; done
done
```

  Keep the existing `seed_<st>_parties.sql` loop (hand-made state parties) before it.
- [ ] **Step 4:** fresh scratch DB: `database/setup.sh` succeeds; per election, winners = seats and row count = candidates +
  NOTA from the JSON (one query, as in Phase 1).
- [ ] **Step 5: Commit** `feat(seed): <states> 2011-2021 from ECI (all candidates, run-once corrections)`.

---

### Task 9: Person linking per state

- [ ] **Step 1:** `npx ts-node src/bihar/links-cli.ts <STATE>` for each state → `seed_<slug>_person_links_v1.sql` (same rules as
  Bihar: ages, single-word names, IND, the guards). Record the high / medium / review counts.
- [ ] **Step 2:** `setup.sh`: run the five links seeds after `seed_<st>_districts_regions.sql`.
- [ ] **Step 3:** sample 10 medium groups per state for plausibility; record them in the commit message.
- [ ] **Step 4: Commit** `feat(seed): link politicians across 2011-2021 in five states (run-once)`.

---

### Task 10: Checks, About, docs

- [ ] **Step 1:** `bihar-snapshot.sql`: replace `state_id = 5` with `state_id IN (5, 4, 16, 27, 31, 36)`, and include the state
  in the hashed columns. Run `scraper/src/bihar/two-db-check.sh` → all `same`, `rerun: same`.
- [ ] **Step 2:** `frontend/src/model/about/about.ts`: the 15 rows become `{ source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] }`
  (TN 2016 keeps `seats_postponed` if 232 seats). Run the frontend About tests, lint and tsc.
- [ ] **Step 3:** docs: `docs/FEATURES.md` (historical data for the five states; Known Limitations updated),
  `CLAUDE.md` (seed order per state), `docs/DEPLOYMENT.md` (post-deploy: recompute seat analysis for the 15 elections;
  pre-flight reconcile steps per state), `docs/SEEDING_PLAYBOOK.md` (new traps), `docs/SEEDING_NEXT_PHASE.md`.
- [ ] **Step 4:** upgrade the local DB (backup first), spot-check in the browser (a 2021 seat page per state shows every
  candidate), all suites green.
- [ ] **Step 5: Commit** `docs: five states' 2011-2021 data real (About, features, seed order, post-deploy)`.
