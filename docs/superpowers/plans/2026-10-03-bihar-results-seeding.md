# Bihar Results Seeding (Phase 1, Plan 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Bihar Vidhan Sabha 2010/2015/2020/2025 results with complete, real ECI data: every candidate and NOTA,
real votes, correct SC/ST, electors, turnout and phase, plus the party rows. Upgrade production DBs safely and keep
fresh `setup.sh` builds identical to upgraded ones.

**Architecture:** A new `scraper/src/bihar/` module goes fetch → parse (ECI XLS/XLSX via SheetJS, ECI PDFs via
`pdftotext -layout`) → ECI-internal cross-check → normalised JSON committed under `scraper/data/bihar/` → SQL
generators. The generators rewrite `database/seed_bihar_vs_<year>.sql`, reusing the existing candidate and result UUIDs
for matched rows, and emit `seed_bihar_parties.sql` plus a run-once `seed_bihar_corrections_v1.sql`. On an existing DB
the corrections seed brings old rows to their final values before the year seeds run.

**Tech Stack:** TypeScript (ts-node, vitest) in `scraper/`, SheetJS `xlsx` 0.20.3 (CDN tarball), poppler `pdftotext`,
PostgreSQL 15 via psql, bash.

**Spec:** `docs/superpowers/specs/2026-10-03-bihar-seeding-design.md` (sections 1–4 and the party rows of section 5).
Out of this plan, each a later plan: party symbol images, `image_credits`, `person_id` in manifests, person linking v2,
leader photos, MyNeta affidavits.

## Global Constraints

- Only `database/setup.sh` builds a DB. Seeds re-run on every deploy: `ON CONFLICT DO NOTHING`, never `TRUNCATE`,
  set `results.election_id`, scope every constituency UPDATE by election (here: by constituency id, which embeds the election).
- Rows admins edit later → run-once seed with a `seed_runs` marker via `scraper/src/seed-run-once.ts` (`runOnce`).
- Every candidate needs a `results` row (ingest relies on it). Every candidate gets a person (trigger, migration 018).
- Never write `candidates.metadata` / `persons.metadata` (treated as gone).
- Result conventions = the ingest rule (`backend/src/modules/ingest/seat-rules.ts` `deriveRows`): status `WON` for the
  top non-NOTA candidate, `LOST` for everyone else including NOTA. `margin` = top − second non-NOTA votes, written on
  **every** row of the seat. `round_no` 0.
- Votes = ECI `TOTAL` (general + postal).
- Display names: a name that is entirely upper case (2010/2015 PDFs, some 2025 rows) becomes Title Case
  (`displayName`). Mixed-case names are kept exactly as ECI wrote them.
- `voter_turnout` = summary voters total ÷ summary electors total × 100, rounded to 2 decimals, the same for all years.
- `phase` = 1-based rank of the seat's poll date among the year's distinct poll dates. Expected phase counts:
  2010 → 6, 2015 → 5, 2020 → 3, 2025 → 2.
- Reserved seats every year (2008 delimitation): 38 SC, 2 ST, 203 GEN. 243 seats every year.
- Fetching: browser User-Agent `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36`,
  2 s between requests, raw files under `scraper/data/raw/bihar/<year>/` (gitignored).
- Existing election ids: 2010 `a1b2c3d4-e5f6-7890-abcd-111111111010`, 2015 `a1b2c3d4-e5f6-7890-abcd-111111111015`,
  2020 `b2c3d4e5-f6a7-8901-bcde-123456789020`, 2025 `c3d4e5f6-a7b8-9012-cdef-234567890abc`. Bihar `state_id` = 5.
  Constituency id prefixes: `BR_VS10_`, `BR_VS15_`, `BR_VS20_`, `BR_VS_` (2025). Never change an existing id.
- The published manifest is `elections.manifest_url` (JSON text). Seeds may set it only `WHERE manifest_url IS NULL`.
- Local DB: `postgresql://admin:password123@localhost:3083/election_tracker` (docker, Postgres 15).
- Run scraper commands from `scraper/`: `npx vitest run <path>`, `npx ts-node src/bihar/<cli>.ts`, `npm run typecheck`.

## Review Focus

1. **Existing DB, new candidate shares seat + party with an old unmatched row.** The partial unique index
   `uq_candidates_election_const_party` would make the year seed skip the new candidate without an error, and its result insert
   would then fail the FK and abort the deploy. Expected: the generator refuses to emit until every unmatched old row has a decision,
   and the corrections seed applies it before the year seeds. Pinned in Task 7 (matcher test) and Task 9 (two-DB check).
2. **`setup.sh` run twice on an upgraded DB.** Expected: the second run changes nothing (marker present, inserts conflict).
   Pinned in Task 9: the check runs setup twice on the upgrade copy.
3. **PDF continuation lines that wrap the party column** (`CPI(ML)` + `(L)`). Expected: joined to `CPI(ML)(L)`, never
   a partial or unknown party. Pinned in Task 3.
4. **Same ECI abbreviation meaning different parties across years / one party under two ids (VIP vs VSIP).** Expected:
   mapping goes abbreviation → that year's full name → our id, and an ambiguous or colliding id stops the suggest script.
   Pinned in Task 5.
5. **Old row matched to a different person** (estimated 2010–2020 names). Expected: low-similarity matches are listed
   in the review file. Auto-created persons are renamed only when they have a single candidacy and still carry the
   old name. Pinned in Task 7 (similarity) and Task 8 (person rename SQL test).

---

## File Structure

| File | Responsibility |
|---|---|
| `scraper/src/bihar/types.ts` | Shared types: raw parse output, normalised JSON, party entries |
| `scraper/src/bihar/names.ts` | AC name / reservation split, serial strip, display casing, sex, dates, similarity |
| `scraper/src/bihar/xls-report.ts` | Row-array parsers for the XLS/XLSX reports (2020, 2025) |
| `scraper/src/bihar/pdf-report.ts` | Text parsers for the `pdftotext -layout` output (2010, 2015) |
| `scraper/src/bihar/crosscheck.ts` | ECI-internal cross-check + seat validation rules |
| `scraper/src/bihar/party-map.ts` | Abbreviation → full name → our party id |
| `scraper/src/bihar/years.ts` | Per-year config (election id, files, prefixes) |
| `scraper/src/bihar/load.ts` | Reads raw files for a year into `RawElection` (SheetJS / pdftotext) |
| `scraper/src/bihar/normalize.ts` | `RawElection` + party map → `ElectionJson` (status, turnout, phase) |
| `scraper/src/bihar/fetch-cli.ts` | Downloads the ECI reports (reproducibility) |
| `scraper/src/bihar/suggest-parties-cli.ts` | Proposes `party-map.json` entries from the local DB |
| `scraper/src/bihar/parse-cli.ts` | Year → cross-checked `scraper/data/bihar/vs-<year>.json` |
| `scraper/src/bihar/existing-seed.ts` | Reads ids/rows out of the current `seed_bihar_vs_<year>.sql` |
| `scraper/src/bihar/match.ts` | Matches new candidates to old rows; decisions; deterministic UUIDs |
| `scraper/src/bihar/sql.ts` | SQL literal helpers |
| `scraper/src/bihar/emit.ts` | Emits the parties, year and corrections seeds |
| `scraper/src/bihar/generate-cli.ts` | Runs matching + emit for all years, writes review files |
| `scraper/src/bihar/two-db-check.sh` + `bihar-snapshot.sql` | Fresh vs upgraded DB comparison |
| `scraper/data/bihar/*.json` | Committed: `vs-<year>.json`, `party-map.json`, `decisions.json`, `review-<year>.json`, `crosscheck-exceptions.json` |
| `database/seed_bihar_parties.sql`, `database/seed_bihar_corrections_v1.sql` | New generated seeds |
| `database/seed_bihar_vs_{2010,2015,2020,2025}.sql` | Regenerated |
| `database/setup.sh` | New seed order |
| Old generators `scraper/src/generate-bihar-vs-{,2010-,2015-,2020-}seed.ts` | Deleted (superseded; data now in JSON) |

Tests live in `scraper/src/bihar/__tests__/` (vitest picks up `src/**/__tests__/**/*.test.ts`).

---

### Task 1: Module scaffold: dependency, types, name helpers

**Files:**
- Modify: `scraper/package.json` (dependency)
- Create: `scraper/src/bihar/types.ts`, `scraper/src/bihar/names.ts`
- Test: `scraper/src/bihar/__tests__/names.test.ts`

**Interfaces:**
- Produces (types.ts):

```ts
export type Year = 2010 | 2015 | 2020 | 2025;
export type SeatType = 'GEN' | 'SC' | 'ST';
export type Sex = 'M' | 'F' | 'O';
export type Recognition = 'National' | 'State' | 'Unrecognised';

export interface RawCandidate { serial: number; name: string; sex: Sex | null; age: number | null; party: string; general: number; postal: number; total: number }
/** One seat from Detailed Results. `party` values are that year's ECI abbreviations. NOTA is kept out of candidates. */
export interface RawSeat { constNo: number; acName: string; type: SeatType | null; electors: number; candidates: RawCandidate[]; nota: number | null; totalVotes: number }
export interface SummaryPick { party: string; name: string; votes: number }
/** One seat from Constituency Data Summary. `winner.party` is a full name (XLS) or an abbreviation (PDF). */
export interface SeatSummary { constNo: number; name: string; type: SeatType; electors: number; voters: number; contested: number; totalValid: number; nota: number | null; pollDate: string; winner: SummaryPick; runnerUp: SummaryPick; margin: number }
export interface PartyListEntry { abbr: string; name: string; recognition: Recognition }
export interface PartyPerformance { abbr: string; contested: number; won: number; votes: number }
export interface RawElection { year: Year; seats: RawSeat[]; summaries: SeatSummary[]; parties: PartyListEntry[]; performance: PartyPerformance[] }

/** Our party row, as seeded. */
export interface PartyEntry { id: string; name: string; abbreviation: string | null; color: string; recognition: Recognition | null }
/** party-map.json: normName(ECI full name) → our party. */
export type PartyMap = Record<string, PartyEntry>;

export interface CandidateJson { serial: number; name: string; partyId: string; sex: Sex | null; age: number | null; votes: number; status: 'WON' | 'LOST' }
export interface SeatJson { constNo: number; type: SeatType; electors: number; voters: number; turnout: number; phase: number; pollDate: string; candidates: CandidateJson[] }
export interface ElectionJson { year: Year; electionId: string; source: { title: string; url: string; retrieved: string }; parties: PartyEntry[]; seats: SeatJson[] }
```

- Produces (names.ts): `splitAcName(raw: string): { name: string; type: SeatType | null }`,
  `stripSerial(raw: string): { serial: number | null; name: string }`, `displayName(raw: string): string`,
  `sexOf(v: unknown): Sex | null`, `isoDate(raw: string): string`, `similarity(a: string, b: string): number` (0..1),
  re-export `normName` from `../live/adapters/eci-mapping`.

- [ ] **Step 1: Add the SheetJS dependency**

Run from `scraper/`: `npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
Expected: `package.json` dependencies gain `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`. The npm
registry's `xlsx` (0.18.5) is outdated and has known advisories; the CDN build is SheetJS's official distribution.

- [ ] **Step 2: Write `types.ts`** with exactly the block above.

- [ ] **Step 3: Write the failing test**

```ts
// scraper/src/bihar/__tests__/names.test.ts
import { describe, it, expect } from 'vitest';
import { splitAcName, stripSerial, displayName, sexOf, isoDate, similarity } from '../names';

describe('names', () => {
  it('splits reservation markers, including the doubled 2015 form', () => {
    expect(splitAcName('RAMNAGAR (SC)')).toEqual({ name: 'RAMNAGAR', type: 'SC' });
    expect(splitAcName('Ramnagar (SC) (SC)')).toEqual({ name: 'Ramnagar', type: 'SC' });
    expect(splitAcName('Valmikinagar')).toEqual({ name: 'Valmikinagar', type: null });
  });
  it('strips the serial number in front of a candidate name', () => {
    expect(stripSerial('1 Dhirendra Pratap Singh alias Rinku singh')).toEqual({ serial: 1, name: 'Dhirendra Pratap Singh alias Rinku singh' });
    expect(stripSerial('  12 NOTA ')).toEqual({ serial: 12, name: 'NOTA' });
  });
  it('title-cases all-caps names and keeps mixed case', () => {
    expect(displayName('RAJESH  SINGH')).toBe('Rajesh Singh');
    expect(displayName('MD. KAMRAN')).toBe('Md. Kamran');
    expect(displayName('DHIRENDRA PRATAP SINGH ALIAS RINKU SINGH')).toBe('Dhirendra Pratap Singh Alias Rinku Singh');
    expect(displayName('Dhirendra Pratap Singh alias Rinku singh')).toBe('Dhirendra Pratap Singh alias Rinku singh');
  });
  it('reads sex in all ECI spellings', () => {
    expect(sexOf('MALE')).toBe('M'); expect(sexOf(' F ')).toBe('F'); expect(sexOf('THIRD GENDER')).toBe('O');
    expect(sexOf('TG')).toBe('O'); expect(sexOf('')).toBeNull(); expect(sexOf(null)).toBeNull();
  });
  it('normalises poll dates', () => {
    expect(isoDate('2020-11-07')).toBe('2020-11-07');
    expect(isoDate('28-Oct-2010')).toBe('2010-10-28');
    expect(isoDate('1-Nov-2015')).toBe('2015-11-01');
    expect(() => isoDate('soon')).toThrow();
  });
  it('scores name similarity', () => {
    expect(similarity('Rajesh Singh', 'RAJESH SINGH')).toBe(1);
    expect(similarity('Mukesh Kumar Kushwaha', 'Mukesh Kushwaha')).toBeGreaterThan(0.6);
    expect(similarity('Rajesh Singh', 'Bhagirathi Devi')).toBeLessThan(0.3);
  });
});
```

- [ ] **Step 4: Run it to make sure it fails**

Run: `npx vitest run src/bihar/__tests__/names.test.ts`
Expected: FAIL, cannot find module `../names`.

- [ ] **Step 5: Implement `names.ts`**

```ts
import { normName } from '../live/adapters/eci-mapping';
import type { SeatType, Sex } from './types';

export { normName };

/** "RAMNAGAR (SC)" / "Ramnagar (SC) (SC)" → name + type; no marker → type null. */
export function splitAcName(raw: string): { name: string; type: SeatType | null } {
  let s = raw.replace(/\s+/g, ' ').trim();
  let type: SeatType | null = null;
  for (let m = /\s*\((GEN|SC|ST)\)\s*$/i.exec(s); m; m = /\s*\((GEN|SC|ST)\)\s*$/i.exec(s)) {
    type = m[1].toUpperCase() as SeatType;
    s = s.slice(0, m.index).trim();
  }
  return { name: s, type };
}

export function stripSerial(raw: string): { serial: number | null; name: string } {
  const m = /^\s*(\d+)\s+(.*?)\s*$/.exec(raw);
  return m ? { serial: Number(m[1]), name: m[2] } : { serial: null, name: raw.trim() };
}

/** All-caps names (2010/2015 PDFs) become Title Case; mixed-case names are kept as ECI wrote them. */
export function displayName(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').trim();
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s.(\-'])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
}

export function sexOf(v: unknown): Sex | null {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return null;
  if (s === 'M' || s === 'MALE') return 'M';
  if (s === 'F' || s === 'FEMALE') return 'F';
  return 'O';
}

const MONTHS: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };

export function isoDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
  if (m && MONTHS[m[2].toUpperCase()]) return `${m[3]}-${MONTHS[m[2].toUpperCase()]}-${m[1].padStart(2, '0')}`;
  throw new Error(`unrecognised date: ${raw}`);
}

/** Dice coefficient over character bigrams of the normalised names (spaces removed). */
export function similarity(a: string, b: string): number {
  const grams = (s: string) => {
    const t = normName(s).replace(/\s/g, '');
    const out = new Map<string, number>();
    for (let i = 0; i < t.length - 1; i++) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) ?? 0) + 1);
    return out;
  };
  const ga = grams(a), gb = grams(b);
  let inter = 0, total = 0;
  for (const [g, n] of ga) { inter += Math.min(n, gb.get(g) ?? 0); total += n; }
  for (const n of gb.values()) total += n;
  return total === 0 ? 0 : (2 * inter) / total;
}
```

- [ ] **Step 6: Run the test and typecheck**

Run: `npx vitest run src/bihar/__tests__/names.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add scraper/package.json scraper/package-lock.json scraper/src/bihar/types.ts scraper/src/bihar/names.ts scraper/src/bihar/__tests__/names.test.ts .gitignore
git commit -m "feat(scraper): bihar seeding module scaffold (types, name helpers, SheetJS)"
```

---

### Task 2: XLS/XLSX report parsers (2020, 2025)

**Files:**
- Create: `scraper/src/bihar/xls-report.ts`
- Test: `scraper/src/bihar/__tests__/xls-report.test.ts`

**Interfaces:**
- Consumes: types and `splitAcName`, `stripSerial`, `sexOf`, `isoDate` from Task 1.
- Produces: `type Row = unknown[]`;
  `parseDetailedRows(rows: Row[]): RawSeat[]`; `parseSummaryRows(rows: Row[]): SeatSummary`;
  `parsePartyListRows(rows: Row[]): PartyListEntry[]`; `parsePerformanceRows(rows: Row[]): PartyPerformance[]`.
  Rows are what `XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })` returns.

- [ ] **Step 1: Write the failing test.** The fixture rows are copied from the real 2020/2025 files.

```ts
// scraper/src/bihar/__tests__/xls-report.test.ts
import { describe, it, expect } from 'vitest';
import { parseDetailedRows, parseSummaryRows, parsePartyListRows, parsePerformanceRows } from '../xls-report';

const H2020 = [' STATE/UT NAME ', ' AC NO. ', ' AC NAME ', ' CANDIDATE NAME ', ' SEX ', ' AGE ', ' CATEGORY ', ' PARTY ', ' SYMBOL ', ' GENERAL ', ' POSTAL ', ' TOTAL ', ' % VOTES POLLED ', ' TOTAL ELECTORS ', null];
const D2020 = [
  ['10 - Detailed Results', null], [null, null, null, null, null, null, null, null, null, ' VALID VOTES POLLED '], H2020,
  ['Bihar', 1, 'Valmikinagar', '1 Dhirendra Pratap Singh alias Rinku singh', 'MALE', 40, 'GENERAL', 'JD(U)', 'Arrow', 74777, 129, 74906, 38.3, 331874, null],
  ['Bihar', 1, 'Valmikinagar', '2 Rajesh Singh', 'MALE', 42, 'GENERAL', 'INC', 'Hand', 52952, 369, 53321, 27.2, 331874, null],
  ['Bihar', 1, 'Valmikinagar', '3 NOTA', '', '', '', 'NOTA', 'NOTA', 8088, 2, 8090, 4.1, 331874, null],
  [' TURNOUT ', ' TOTAL : ', '', '', '', '', '', '', '', 135817, 500, 136317, 41.1, '', null],
  ['Bihar', 2, 'Ramnagar', '1 Bhagirathi Devi', 'FEMALE', 60, 'SC', 'BJP', 'Lotus', 75000, '', 75000, 50, 300000, null],
  [' TURNOUT ', ' TOTAL : ', '', '', '', '', '', '', '', 75000, 0, 75000, 25, '', null],
];
const D2025 = [
  ['10 - Detailed Results'], [null], [null, null, null, null, null, null, null, null, null, 'TOTAL VALID VOTES POLLED + NOTA'],
  ['STATE/UT NAME', 'AC NO.', 'AC NAME', 'CANDIDATE NAME', 'GENDER', 'AGE', 'CATEGORY', 'PARTY', 'SYMBOL', 'GENERAL', 'POSTAL', 'TOTAL', 'OVER VALID VOTES + NOTA', 'OVER TOTAL ELECTORS', 'TOTAL ELECTORS'],
  ['Bihar', 2, 'RAMNAGAR (SC)', '1 Nand Kishor Ram', 'MALE', 50, 'SC', 'BJP', 'Lotus', 115000, 214, 115214, 50, 33, 340000],
  ['Bihar', 2, 'RAMNAGAR (SC)', '2 Nota', null, null, null, 'NOTA', 'NOTA', 6391, 9, 6400, 2.7, 1.9, 340000],
  ['TURN OUT', null, null, null, null, null, 'TOTAL:', null, null, 121391, 223, 121614, '-', 70.49, null],
];

describe('parseDetailedRows', () => {
  it('reads 2020 seats, trimming cells, keeping NOTA apart and treating blank postal as 0', () => {
    const seats = parseDetailedRows(D2020);
    expect(seats).toHaveLength(2);
    expect(seats[0]).toMatchObject({ constNo: 1, acName: 'Valmikinagar', type: null, electors: 331874, nota: 8090, totalVotes: 136317 });
    expect(seats[0].candidates).toEqual([
      { serial: 1, name: 'Dhirendra Pratap Singh alias Rinku singh', sex: 'M', age: 40, party: 'JD(U)', general: 74777, postal: 129, total: 74906 },
      { serial: 2, name: 'Rajesh Singh', sex: 'M', age: 42, party: 'INC', general: 52952, postal: 369, total: 53321 },
    ]);
    expect(seats[1].candidates[0]).toMatchObject({ sex: 'F', postal: 0, total: 75000 });
  });
  it('reads 2025 seats with the reservation in the AC name', () => {
    const [s] = parseDetailedRows(D2025);
    expect(s).toMatchObject({ constNo: 2, acName: 'RAMNAGAR', type: 'SC', electors: 340000, nota: 6400, totalVotes: 121614 });
    expect(s.candidates).toHaveLength(1);
  });
  it('fails when a seat has no TURNOUT row', () => {
    expect(() => parseDetailedRows(D2020.slice(0, 5))).toThrow(/no TURNOUT row/);
  });
});

const S2020 = [
  ['8 - CONSTITUENCY DATA - SUMMARY'], ['State/UT', 'S04-Bihar', 'Constituency Name', '2-Ramnagar-SC'],
  ['I. Candidates', null, 'Men', 'Woman', 'Third Gender', 'Total'], [null, '4. Contested', 11, 1, 0, 12],
  ['II. Electors'], [null, '4. Total', 178445, 153395, 34, 331874],
  ['III. VOTERS'], [null, '4. Postal', null, null, null, 885], [null, '5. Total', 95628, 99278, 0, 195791],
  ['III. Polling Percentage', null, null, null, null, 59],
  ['IV. Votes'], [null, '3.Total valid votes polled on evm', null, null, null, 186818], [null, '7. Total Valid Votes Polled', null, null, null, 187399],
  [null, "9. VOTES POLLED FOR 'NOTA' (INCLUDING POSTAL)", null, null, null, 8090],
  ['VI. Dates'], [null, 'Polling', null, 'Counting', null, 'Declaration Of Result'], [null, '2020-11-07', null, '2020-11-10', null, '2020-11-10'],
  ['VII. Result'], [null, null, null, 'Party', 'Candidate', 'Votes'],
  [null, 'Winner', null, 'Bharatiya Janata Party', 'Bhagirathi Devi', 75423], [null, 'Runner-Up', null, 'Indian National Congress', 'Rajesh Ram', 59627],
  [null, 'Margin', null, 15796, '( 8.48 % of Total Votes)', null],
];

describe('parseSummaryRows', () => {
  it('reads the 2020 summary sheet', () => {
    expect(parseSummaryRows(S2020)).toEqual({
      constNo: 2, name: 'Ramnagar', type: 'SC', electors: 331874, voters: 195791, contested: 12, totalValid: 187399, nota: 8090,
      pollDate: '2020-11-07', winner: { party: 'Bharatiya Janata Party', name: 'Bhagirathi Devi', votes: 75423 },
      runnerUp: { party: 'Indian National Congress', name: 'Rajesh Ram', votes: 59627 }, margin: 15796,
    });
  });
  it('accepts the 2025 label form "2-RAMNAGAR-(SC)"', () => {
    const rows = S2020.map((r, i) => (i === 1 ? ['State/UT', 'S04-Bihar', 'Constituency Name', '2-RAMNAGAR-(SC)'] : r));
    expect(parseSummaryRows(rows)).toMatchObject({ constNo: 2, name: 'RAMNAGAR', type: 'SC' });
  });
});

describe('party list and performance', () => {
  it('reads the party list with recognition from section rows', () => {
    const rows = [
      ['3 - List Of Political Parties Participated'], [' PARTY TYPE ', ' ABBREVIATION ', ' PARTY '], [' NATIONAL PARTIES '],
      [1, 'BJP', 'Bharatiya Janata Party'], [' STATE PARTIES '], [7, 'JD(U)', 'Janata Dal  (United)'],
      [' STATE PARTIES - OTHER STATE '], [9, 'SHS', 'Shivsena'], [' REGISTERED(Unrecognised) PARTIES '], [20, 'JAPL', 'Jan Adhikar Party (Loktantrik)'],
    ];
    expect(parsePartyListRows(rows)).toEqual([
      { abbr: 'BJP', name: 'Bharatiya Janata Party', recognition: 'National' },
      { abbr: 'JD(U)', name: 'Janata Dal (United)', recognition: 'State' },
      { abbr: 'SHS', name: 'Shivsena', recognition: 'State' },
      { abbr: 'JAPL', name: 'Jan Adhikar Party (Loktantrik)', recognition: 'Unrecognised' },
    ]);
  });
  it('reads party performance rows and skips subtotals', () => {
    const rows = [
      ['5 - Performance of Political Parties'], [null, null, 'SEATS'], ['PARTY TYPE', 'ABBREVIATION', 'CONTESTED', 'WON', 'FD', 'VOTES', '%'],
      ['NATIONAL PARTIES'], [1, 'BJP', 110, 74, 3, 8202067, '19.46%', 42.56], [null, null, 841, 96, 698, 9382666, '32.29'],
    ];
    expect(parsePerformanceRows(rows)).toEqual([{ abbr: 'BJP', contested: 110, won: 74, votes: 8202067 }]);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/bihar/__tests__/xls-report.test.ts`
Expected: FAIL, cannot find module `../xls-report`.

- [ ] **Step 3: Implement `xls-report.ts`**

```ts
import type { PartyListEntry, PartyPerformance, RawSeat, Recognition, SeatSummary, SeatType, SummaryPick } from './types';
import { isoDate, sexOf, splitAcName, stripSerial } from './names';

export type Row = unknown[];

const cell = (v: unknown): unknown => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v);
const text = (v: unknown): string => String(cell(v) ?? '');
const blank = (v: unknown): boolean => { const c = cell(v); return c === null || c === undefined || c === ''; };
const num = (v: unknown): number => {
  if (blank(v)) return 0;
  const c = cell(v);
  const n = typeof c === 'number' ? c : Number(String(c).replace(/,/g, ''));
  if (!Number.isFinite(n)) throw new Error(`not a number: ${String(v)}`);
  return n;
};
const lastNum = (r: Row): number => {
  for (let i = r.length - 1; i >= 0; i--) if (!blank(r[i]) && Number.isFinite(Number(cell(r[i])))) return Number(cell(r[i]));
  throw new Error(`no number in row: ${JSON.stringify(r)}`);
};

export function parseDetailedRows(rows: Row[]): RawSeat[] {
  const hi = rows.findIndex(r => r.some(c => text(c).toUpperCase() === 'CANDIDATE NAME'));
  if (hi < 0) throw new Error('Detailed Results: header row not found');
  const h = rows[hi].map(c => text(c).toUpperCase());
  const col = (...names: string[]): number => {
    const i = h.findIndex(x => names.includes(x));
    if (i < 0) throw new Error(`Detailed Results: missing column ${names[0]}`);
    return i;
  };
  const C = { no: col('AC NO.'), ac: col('AC NAME'), name: col('CANDIDATE NAME'), sex: col('SEX', 'GENDER'), age: col('AGE'),
    party: col('PARTY'), general: col('GENERAL'), postal: col('POSTAL'), total: col('TOTAL'), electors: col('TOTAL ELECTORS') };
  const seats: RawSeat[] = [];
  let cur: RawSeat | null = null;
  for (const r of rows.slice(hi + 1)) {
    if (text(r[0]).toUpperCase().replace(/\s/g, '').startsWith('TURNOUT')) {
      if (!cur) throw new Error('Detailed Results: TURNOUT row before any candidate');
      cur.totalVotes = num(r[C.total]);
      seats.push(cur);
      cur = null;
      continue;
    }
    if (blank(r[C.no])) continue;
    const constNo = num(r[C.no]);
    if (!cur) {
      const ac = splitAcName(text(r[C.ac]));
      cur = { constNo, acName: ac.name, type: ac.type, electors: num(r[C.electors]), candidates: [], nota: null, totalVotes: 0 };
    } else if (cur.constNo !== constNo) {
      throw new Error(`Detailed Results: seat ${cur.constNo} has no TURNOUT row before seat ${constNo}`);
    }
    const party = text(r[C.party]);
    const total = num(r[C.total]);
    if (party.toUpperCase() === 'NOTA') { cur.nota = total; continue; }
    const { serial, name } = stripSerial(text(r[C.name]));
    cur.candidates.push({ serial: serial ?? cur.candidates.length + 1, name, sex: sexOf(cell(r[C.sex])), age: blank(r[C.age]) ? null : num(r[C.age]),
      party, general: num(r[C.general]), postal: num(r[C.postal]), total });
  }
  if (cur) throw new Error(`Detailed Results: seat ${cur.constNo} has no TURNOUT row`);
  return seats;
}

export function parseSummaryRows(rows: Row[]): SeatSummary {
  const label = text(rows[1]?.[3]);
  const m = /^(\d+)-(.+)-\(?(GEN|SC|ST)\)?$/i.exec(label);
  if (!m) throw new Error(`Summary: unrecognised constituency label "${label}"`);
  let section = '';
  const found: Record<string, number> = {};
  let pollDate = '';
  const picks: Record<string, SummaryPick> = {};
  let margin: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const head = text(r[0]);
    if (/^(I|II|III|IV|V|VI|VII)\./i.test(head)) section = head.toUpperCase();
    const lbl = text(r[1]);
    if (section.startsWith('I.') && /contested/i.test(lbl)) found.contested = lastNum(r);
    if (section.startsWith('II.') && /total/i.test(lbl)) found.electors = lastNum(r);
    if (section.startsWith('III. VOTERS') && /total/i.test(lbl)) found.voters = lastNum(r);
    if (section.startsWith('IV.') && /^7\.\s*total valid votes polled/i.test(lbl)) found.totalValid = lastNum(r);
    if (section.startsWith('IV.') && /'NOTA' \(INCLUDING POSTAL\)/i.test(lbl)) found.nota = lastNum(r);
    if (section.startsWith('VI.') && /^polling$/i.test(lbl)) pollDate = isoDate(text(rows[i + 1]?.[1]));
    if (section.startsWith('VII.') && /^(winner|runner-up)$/i.test(lbl)) picks[lbl.toLowerCase()] = { party: text(r[3]), name: text(r[4]), votes: num(r[5]) };
    if (section.startsWith('VII.') && /^margin$/i.test(lbl)) margin = num(r[3]);
  }
  for (const k of ['contested', 'electors', 'voters', 'totalValid']) if (found[k] === undefined) throw new Error(`Summary ${label}: ${k} not found`);
  if (!pollDate || !picks.winner || !picks['runner-up'] || margin === null) throw new Error(`Summary ${label}: dates/result not found`);
  return { constNo: Number(m[1]), name: m[2].trim(), type: m[3].toUpperCase() as SeatType, electors: found.electors, voters: found.voters,
    contested: found.contested, totalValid: found.totalValid, nota: found.nota ?? null, pollDate, winner: picks.winner, runnerUp: picks['runner-up'], margin };
}

export function recognitionOf(section: string): Recognition | null {
  const s = section.toUpperCase();
  if (s.startsWith('NATIONAL PARTIES')) return 'National';
  if (s.startsWith('STATE PARTIES')) return 'State';
  if (s.startsWith('REGISTERED')) return 'Unrecognised';
  return null;
}

export function parsePartyListRows(rows: Row[]): PartyListEntry[] {
  const out: PartyListEntry[] = [];
  let rec: Recognition | null = null;
  for (const r of rows) {
    const first = text(r[0]);
    const sec = recognitionOf(first);
    if (sec) { rec = sec; continue; }
    if (/^\d+$/.test(first) && rec && !blank(r[1]) && !blank(r[2])) out.push({ abbr: text(r[1]), name: text(r[2]), recognition: rec });
  }
  if (!out.length) throw new Error('Party list: no rows');
  return out;
}

export function parsePerformanceRows(rows: Row[]): PartyPerformance[] {
  const out: PartyPerformance[] = [];
  for (const r of rows) {
    if (!/^\d+$/.test(text(r[0])) || blank(r[1])) continue;
    out.push({ abbr: text(r[1]), contested: num(r[2]), won: num(r[3]), votes: num(r[5]) });
  }
  if (!out.length) throw new Error('Performance: no rows');
  return out;
}
```

Note: `cell` collapses inner whitespace, which is why the test expects `'Janata Dal (United)'` from `'Janata Dal  (United)'`.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/bihar/__tests__/xls-report.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/bihar/xls-report.ts scraper/src/bihar/__tests__/xls-report.test.ts
git commit -m "feat(scraper): parse ECI XLS statistical reports (detailed results, summary, parties)"
```

---

### Task 3: PDF report parsers (2010, 2015)

**Files:**
- Create: `scraper/src/bihar/pdf-report.ts`
- Test: `scraper/src/bihar/__tests__/pdf-report.test.ts`

**Interfaces:**
- Consumes: types, `splitAcName`, `sexOf`, `isoDate` (Task 1); `recognitionOf` (Task 2, exported from `xls-report.ts`).
- Produces: `parseDetailedText(text: string): RawSeat[]`, `parseSummaryText(text: string): SeatSummary[]`,
  `parsePartyListText(text: string): PartyListEntry[]`, `parsePerformanceText(text: string): PartyPerformance[]`.
  Input is the whole `pdftotext -layout <pdf> -` output.

- [ ] **Step 1: Write the failing test.** The fixtures are real `pdftotext -layout` lines; column positions matter, so
  keep the spacing exactly as written.

```ts
// scraper/src/bihar/__tests__/pdf-report.test.ts
import { describe, it, expect } from 'vitest';
import { parseDetailedText, parseSummaryText, parsePartyListText, parsePerformanceText } from '../pdf-report';

const DETAILED_2015 = `
                           Election Commission of India- State Election, 2015 to the Legislative Assembly Of Bihar
                                            DETAILED RESULTS
                                                                                           VALID VOTES POLLED
                                                                                                                              % VOTES
           CANDIDATE NAME            SEX     AGE CATEGORY         PARTY SYMBOL              GENERAL         POSTAL TOTAL       POLLED


Constituency          1. Valmiki Nagar                                                   TOTAL ELECTORS :              295342

     1 DHIRENDRA PRATAP                 M     35      GEN           IND     Cauliflowe         66754         106     66860      36.17
       SINGH ALIAS RINKU SINGH                                                  r
     2 IRSHAD HUSSAIN                   M     39      GEN           INC        Hand            33106         174     33280      18.01
     7 None of the Above                                           NOTA        NOTA             6766            1     6767       3.66
    13 VISHNUDEO PRASAD                 M     33      GEN        CPI(ML)     Flag with          1466            0     1466       0.79
       YADAV                                                       (L)        Three
                                                                               Stars
 TURNOUT                                           TOTAL:                                     107712         281     107993      62.58

Constituency          2. Ramnagar (SC) (SC)                                              TOTAL ELECTORS :              250000

     1 BHAGIRATHI DEVI                  F     60      SC            BJP        Lotus           70000          100     70100      60.00
 TURNOUT                                           TOTAL:                                      70000         100      70100      28.04
`;

const DETAILED_2010 = `
Constituency          1. Valmiki Nagar                                               TOTAL ELECTORS :                 240418

     1 RAJESH SINGH                      M       37       GEN         JD(U)                  42272           17     42289      29.43

     2 MUKESH KUMAR KUSHWAHA             M       34       GEN         RJD                    27606           12     27618      19.22
 TURNOUT                                           TOTAL:                                     69878           29     69907      29.08
`;

describe('parseDetailedText', () => {
  it('reads 2015 seats with wrapped names and wrapped party abbreviations', () => {
    const seats = parseDetailedText(DETAILED_2015);
    expect(seats).toHaveLength(2);
    expect(seats[0]).toMatchObject({ constNo: 1, acName: 'Valmiki Nagar', type: null, electors: 295342, nota: 6767, totalVotes: 107993 });
    expect(seats[0].candidates.map(c => [c.name, c.party, c.total])).toEqual([
      ['DHIRENDRA PRATAP SINGH ALIAS RINKU SINGH', 'IND', 66860],
      ['IRSHAD HUSSAIN', 'INC', 33280],
      ['VISHNUDEO PRASAD YADAV', 'CPI(ML)(L)', 1466],
    ]);
    expect(seats[0].candidates[0]).toMatchObject({ serial: 1, sex: 'M', age: 35, general: 66754, postal: 106 });
    expect(seats[1]).toMatchObject({ constNo: 2, acName: 'Ramnagar', type: 'SC' });
  });
  it('reads 2010 seats (no symbol column, no NOTA)', () => {
    const [s] = parseDetailedText(DETAILED_2010);
    expect(s.nota).toBeNull();
    expect(s.candidates.map(c => [c.name, c.party, c.total])).toEqual([['RAJESH SINGH', 'JD(U)', 42289], ['MUKESH KUMAR KUSHWAHA', 'RJD', 27618]]);
  });
  it('fails on a candidate line it cannot read inside a seat', () => {
    expect(() => parseDetailedText(DETAILED_2010.replace('M       37', 'X       37'))).toThrow(/candidate line/);
  });
});

const SUMMARY_2015 = `
     CONSTITUENCY :                   1- Valmiki Nagar
       4. CONTESTED                                           13                         1                         0                   14
II.    ELECTORS
       1. GENERAL(Other than OVERSEAS)                     155000                   140000                           0               295000
       4. TOTAL                                         155200                   140142                           0               295342
III. VOTERS
       1. GENERAL(Other than OVERSEAS)                     92536                    91824                          0               184360
       5. TOTAL                                                                                                                    184960
III(A). POLLING PERCENTAGE                         62.63
IV. VOTES
       3. TOTALVALID VOTES POLLED ON EVM                                                                                           177594
       7.TOTAL VALID VOTES POLLED                                                                                                  178067
       9.VOTES POLLED FOR 'NOTA' (INCLUDING POSTAL)                                                                                  6767
VI. DATES
                  POLLING                                           COUNTING                                 DECLARATION OF RESULT
                  01-Nov-2015                                       8-Nov-2015                               8-Nov-2015
VII. RESULT
                   PARTY                           CANDIDATE                                                              VOTES
WINNER             IND                             Dhirendra Pratap Singh Alias Rinku Singh                                66860
RUNNER-UP          INC                             Irshad Hussain                                                         33280
MARGIN              33580                ( 18.86%     of Total Valid Votes)
     CONSTITUENCY :                  2- Ramnagar (SC)
       4. CONTESTED                                           10                         0                         0                   10
II.    ELECTORS
       3. TOTAL                                         131469                   108949                           0               240418
III. VOTERS
       4. TOTAL                                                                                                                   143701
IV. VOTES
        3. TOTAL VALID VOTES POLLED                                                                                               143698
VI. DATES
                  POLLING                                          COUNTING                                 DECLARATION OF RESULT
                  28-Oct-2010                                      24-Nov-2010                              24-Nov-2010
VII. RESULT
WINNER             BJP                           Bhagirathi Devi                                                          51993
RUNNER-UP          RJD                           Narottam Ram                                                             20003
MARGIN              31990                ( 22.26%     of Total Valid Votes)
`;

describe('parseSummaryText', () => {
  it('reads 2015 and 2010 style summary blocks', () => {
    const [a, b] = parseSummaryText(SUMMARY_2015);
    expect(a).toEqual({ constNo: 1, name: 'Valmiki Nagar', type: 'GEN', electors: 295342, voters: 184960, contested: 14, totalValid: 178067, nota: 6767,
      pollDate: '2015-11-01', winner: { party: 'IND', name: 'Dhirendra Pratap Singh Alias Rinku Singh', votes: 66860 },
      runnerUp: { party: 'INC', name: 'Irshad Hussain', votes: 33280 }, margin: 33580 });
    expect(b).toMatchObject({ constNo: 2, name: 'Ramnagar', type: 'SC', electors: 240418, voters: 143701, totalValid: 143698, nota: null, pollDate: '2010-10-28' });
  });
});

const PARTIES_2010 = `
    PARTY TYPE     ABBREVIATION             PARTY
NATIONAL PARTIES
          1.       BJP                      Bharatiya Janata Party
          4.       CPM                      Communist Party of India (Marxist)
STATE PARTIES
          7.       JD(U)                    Janata Dal (United)
REGISTERED(Unrecognised) PARTIES
         20.       ABJS                     Akhil Bharatiya Jan Sangh
                                            (Rashtriya)
     OTHER ABBREVIATIONS AND DESCRIPTION
          1.       IND                      Independent
`;

const PERFORMANCE_2010 = `
                         PERFORMANCE OF POLITICAL PARTIES
NATIONAL PARTIES
   1.   BJP                            102              91           2            4790436              16.49%      39.56
   2.   BSP                            239               0          236           933947                  3.21%    3.27
                                       841              96          698           9382666               32.29
                         CANDIDATE DATA SUMMARY
   1.   NOT                            1                1            1            1
`;

describe('party list and performance (PDF)', () => {
  it('reads the party list and joins wrapped names, stopping at the next section', () => {
    expect(parsePartyListText(PARTIES_2010)).toEqual([
      { abbr: 'BJP', name: 'Bharatiya Janata Party', recognition: 'National' },
      { abbr: 'CPM', name: 'Communist Party of India (Marxist)', recognition: 'National' },
      { abbr: 'JD(U)', name: 'Janata Dal (United)', recognition: 'State' },
      { abbr: 'ABJS', name: 'Akhil Bharatiya Jan Sangh (Rashtriya)', recognition: 'Unrecognised' },
    ]);
  });
  it('reads party performance until the next section', () => {
    expect(parsePerformanceText(PERFORMANCE_2010)).toEqual([
      { abbr: 'BJP', contested: 102, won: 91, votes: 4790436 },
      { abbr: 'BSP', contested: 239, won: 0, votes: 933947 },
    ]);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/bihar/__tests__/pdf-report.test.ts`
Expected: FAIL, cannot find module `../pdf-report`.

- [ ] **Step 3: Implement `pdf-report.ts`**

```ts
import type { PartyListEntry, PartyPerformance, RawCandidate, RawSeat, Recognition, SeatSummary, SeatType, SummaryPick } from './types';
import { isoDate, sexOf, splitAcName } from './names';
import { recognitionOf } from './xls-report';

const SEAT_RE = /^\s*Constituency\s+(\d+)\.\s+(.+?)\s{2,}TOTAL ELECTORS\s*:\s*(\d+)/;
const TURNOUT_RE = /^\s*TURNOUT\s+TOTAL:\s+(\d+)\s+(\d+)\s+(\d+)/;
/** serial, middle (name … party [symbol]), general, postal, total, % */
const CAND_RE = /^\s*(\d+)\s+(.*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+\.\d+)\s*$/;
const NOISE_RE = /Election Commission of India|DETAILED RESULTS|VALID VOTES POLLED|^\s*% VOTES|CANDIDATE NAME|^\s*POLLED\s*$|Page \d+ of \d+/i;

interface Fragment { col: number; text: string }
/** Split a line into fragments separated by 2+ spaces, with their start columns. */
function fragments(line: string): Fragment[] {
  const out: Fragment[] = [];
  const re = /\S+(?: \S+)*/g;
  for (let m = re.exec(line); m; m = re.exec(line)) out.push({ col: m.index, text: m[0] });
  return out;
}

interface Cols { sex: number; party: number; partyEnd: number; symbol: number }

function readCandidate(line: string, m: RegExpExecArray): { cand: RawCandidate; cols: Cols | null } {
  const midStart = line.indexOf(m[2], line.indexOf(m[1]) + m[1].length);
  const frags = fragments(m[2]).map(f => ({ col: f.col + midStart, text: f.text }));
  const general = Number(m[3]), postal = Number(m[4]), total = Number(m[5]);
  if (frags.length >= 3 && frags[frags.length - 2].text === 'NOTA') {
    return { cand: { serial: Number(m[1]), name: 'NOTA', sex: null, age: null, party: 'NOTA', general, postal, total }, cols: null };
  }
  // name … sex age category party [symbol]: the sex fragment may be glued to the age ("M 37" when spaced by one).
  const flat = frags.flatMap(f => (/^(M|F|O|TG)\s+\d+$/.test(f.text) ? f.text.split(/\s+/).map((t, i) => ({ col: f.col + (i ? f.text.indexOf(t, 1) : 0), text: t })) : [f]));
  const si = flat.findIndex((f, i) => i > 0 && /^(M|F|O|TG)$/.test(f.text) && /^\d+$/.test(flat[i + 1]?.text ?? '') && /^(GEN|SC|ST)$/.test(flat[i + 2]?.text ?? ''));
  if (si < 1 || !flat[si + 3]) throw new Error(`Detailed Results: cannot read candidate line: ${line.trim()}`);
  const party = flat[si + 3];
  const symbol = flat[si + 4];
  return {
    cand: { serial: Number(m[1]), name: flat.slice(0, si).map(f => f.text).join(' '), sex: sexOf(flat[si].text), age: Number(flat[si + 1].text),
      party: party.text, general, postal, total },
    cols: { sex: flat[si].col, party: party.col, partyEnd: party.col + party.text.length, symbol: symbol ? symbol.col : Number.POSITIVE_INFINITY },
  };
}

export function parseDetailedText(text: string): RawSeat[] {
  const seats: RawSeat[] = [];
  let cur: RawSeat | null = null;
  let last: { cand: RawCandidate; cols: Cols } | null = null;
  for (const line of text.split('\n')) {
    const s = SEAT_RE.exec(line);
    if (s) {
      if (cur) throw new Error(`Detailed Results: seat ${cur.constNo} has no TURNOUT row before seat ${s[1]}`);
      const ac = splitAcName(s[2]);
      cur = { constNo: Number(s[1]), acName: ac.name, type: ac.type, electors: Number(s[3]), candidates: [], nota: null, totalVotes: 0 };
      last = null;
      continue;
    }
    if (!cur) continue;
    const t = TURNOUT_RE.exec(line);
    if (t) { cur.totalVotes = Number(t[3]); seats.push(cur); cur = null; last = null; continue; }
    if (!line.trim() || NOISE_RE.test(line)) continue;
    const c = CAND_RE.exec(line);
    if (c) {
      const { cand, cols } = readCandidate(line, c);
      if (cand.party === 'NOTA') { cur.nota = cand.total; last = null; continue; }
      cur.candidates.push(cand);
      last = cols ? { cand, cols } : null;
      continue;
    }
    if (!last) throw new Error(`Detailed Results: unexpected line in seat ${cur.constNo}: ${line.trim()}`);
    for (const f of fragments(line)) {
      if (f.col < last.cols.sex - 1) last.cand.name += ` ${f.text}`;
      else if (f.col >= last.cols.party - 3 && f.col < Math.min(last.cols.symbol, last.cols.partyEnd + 3)) last.cand.party += f.text;
    }
  }
  if (cur) throw new Error(`Detailed Results: seat ${cur.constNo} has no TURNOUT row`);
  for (const seat of seats) for (const c of seat.candidates) c.name = c.name.replace(/\s+/g, ' ').trim();
  return seats;
}

const lastNumber = (line: string): number => {
  const m = /(\d+(?:\.\d+)?)\s*$/.exec(line);
  if (!m) throw new Error(`no trailing number: ${line.trim()}`);
  return Number(m[1]);
};

export function parseSummaryText(text: string): SeatSummary[] {
  const lines = text.split('\n');
  const out: SeatSummary[] = [];
  let block: string[] | null = null;
  const flush = () => { if (block) out.push(readSummaryBlock(block)); };
  for (const line of lines) {
    if (/^\s*CONSTITUENCY\s*:\s*\d+-/.test(line)) { flush(); block = [line]; continue; }
    if (block) block.push(line);
  }
  flush();
  return out;
}

function readSummaryBlock(lines: string[]): SeatSummary {
  const head = /^\s*CONSTITUENCY\s*:\s*(\d+)-\s*(.+?)\s*$/.exec(lines[0])!;
  const ac = splitAcName(head[2]);
  let section = '';
  const f: Record<string, number> = {};
  let pollDate = '';
  const picks: Record<string, SummaryPick> = {};
  let margin: number | null = null;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    const sec = /^\s*(I|II|III|III\(A\)|IV|V|VI|VII)\.\s*(\S.*)?$/.exec(l);
    if (sec) section = `${sec[1]}. ${(sec[2] ?? '').trim()}`.toUpperCase();
    if (/4\.\s*CONTESTED/.test(l)) f.contested = lastNumber(l);
    if (section.startsWith('II.') && /\d\.\s*TOTAL\b/.test(l)) f.electors = lastNumber(l);
    if (section.startsWith('III. VOTERS') && /\d\.\s*TOTAL\b/.test(l)) f.voters = lastNumber(l);
    if (section.startsWith('IV.') && /TOTAL ?VALID VOTES POLLED\s+\d+\s*$/.test(l)) f.totalValid = lastNumber(l);
    if (section.startsWith('IV.') && /VOTES POLLED FOR 'NOTA'/.test(l)) f.nota = lastNumber(l);
    if (section.startsWith('VI.') && /^\s*POLLING\s+COUNTING/.test(l)) {
      const d = /(\d{1,2}-[A-Za-z]{3}-\d{4})/.exec(lines[i + 1] ?? '');
      if (d) pollDate = isoDate(d[1]);
    }
    const p = /^(WINNER|RUNNER-UP)\s+(\S+)\s+(.+?)\s+(\d+)\s*$/.exec(l);
    if (p) picks[p[1]] = { party: p[2], name: p[3].trim(), votes: Number(p[4]) };
    const mg = /^MARGIN\s+(\d+)/.exec(l);
    if (mg) margin = Number(mg[1]);
  }
  const label = `${head[1]}-${head[2]}`;
  for (const k of ['contested', 'electors', 'voters', 'totalValid']) if (f[k] === undefined) throw new Error(`Summary ${label}: ${k} not found`);
  if (!pollDate || !picks.WINNER || !picks['RUNNER-UP'] || margin === null) throw new Error(`Summary ${label}: dates/result not found`);
  return { constNo: Number(head[1]), name: ac.name, type: (ac.type ?? 'GEN') as SeatType, electors: f.electors, voters: f.voters, contested: f.contested,
    totalValid: f.totalValid, nota: f.nota ?? null, pollDate, winner: picks.WINNER, runnerUp: picks['RUNNER-UP'], margin };
}

export function parsePartyListText(text: string): PartyListEntry[] {
  const out: PartyListEntry[] = [];
  let inList = false;
  let rec: Recognition | null = null;
  let nameCol = -1;
  for (const line of text.split('\n')) {
    if (/PARTY TYPE\s+ABBREVIATION\s+PARTY/.test(line)) { inList = true; continue; }
    if (!inList) continue;
    if (/OTHER ABBREVIATIONS|HIGHLIGHTS|LIST OF SUCCESSFUL|PERFORMANCE OF POLITICAL/i.test(line)) break;
    const sec = recognitionOf(line.trim());
    if (sec) { rec = sec; continue; }
    const m = /^\s*(\d+)\.\s+(\S+)\s{2,}(.+?)\s*$/.exec(line);
    if (m && rec) { nameCol = line.indexOf(m[3], line.indexOf(m[2]) + m[2].length); out.push({ abbr: m[2], name: m[3], recognition: rec }); continue; }
    const cont = /^(\s*)(\S.*?)\s*$/.exec(line);
    if (cont && out.length && nameCol >= 0 && Math.abs(cont[1].length - nameCol) <= 2) out[out.length - 1].name += ` ${cont[2]}`;
  }
  if (!out.length) throw new Error('Party list: no rows');
  return out;
}

export function parsePerformanceText(text: string): PartyPerformance[] {
  const out: PartyPerformance[] = [];
  let inTable = false;
  for (const line of text.split('\n')) {
    if (/^\s*PERFORMANCE OF POLITICAL PARTIES\s*$/.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (/^\s*[A-Z][A-Z ]+SUMMARY\s*$/.test(line) || /LIST OF SUCCESSFUL|WOMEN CANDIDATES/i.test(line)) break;
    const m = /^\s*(\d+)\.\s+(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(line);
    if (m) out.push({ abbr: m[2], contested: Number(m[3]), won: Number(m[4]), votes: Number(m[6]) });
  }
  if (!out.length) throw new Error('Performance: no rows');
  return out;
}
```

The PDF has several "PERFORMANCE OF POLITICAL PARTIES" pages (one header per page). `inTable` stays on across page
headers until a different section starts, so every page's rows are read. Duplicate abbreviations from repeated subtotal lines
cannot occur because subtotal lines have no `N.` prefix.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/bihar/__tests__/pdf-report.test.ts && npm run typecheck`
Expected: PASS. If a fixture assertion fails on a column threshold, fix the threshold in `parseDetailedText` (the
fixture is real data), not the fixture.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/bihar/pdf-report.ts scraper/src/bihar/__tests__/pdf-report.test.ts
git commit -m "feat(scraper): parse ECI PDF statistical reports (2010/2015 layout text)"
```

---

### Task 4: ECI-internal cross-check and seat validation

**Files:**
- Create: `scraper/src/bihar/crosscheck.ts`
- Test: `scraper/src/bihar/__tests__/crosscheck.test.ts`

**Interfaces:**
- Consumes: `RawElection`, `PartyListEntry`, `ElectionJson` types; `normName`.
- Produces:
  - `interface CrossCheckException { year: number; key: string; reason: string }`.
  - `crossCheck(e: RawElection, exceptions: CrossCheckException[]): string[]`: error strings, each starting with its
    key `<check>:<constNo|abbr>` (e.g. `electors:42`, `party-votes:BJP`). An error whose key appears in `exceptions` for
    that year is dropped.
  - `validateElection(e: ElectionJson): string[]`: the generator rules.

- [ ] **Step 1: Write the failing test**

```ts
// scraper/src/bihar/__tests__/crosscheck.test.ts
import { describe, it, expect } from 'vitest';
import { crossCheck, validateElection } from '../crosscheck';
import type { ElectionJson, RawElection } from '../types';

function election(): RawElection {
  return {
    year: 2020,
    parties: [{ abbr: 'BJP', name: 'Bharatiya Janata Party', recognition: 'National' }, { abbr: 'INC', name: 'Indian National Congress', recognition: 'National' }],
    seats: [{ constNo: 2, acName: 'Ramnagar', type: null, electors: 1000, nota: 10, totalVotes: 610, candidates: [
      { serial: 1, name: 'A', sex: 'F', age: 60, party: 'BJP', general: 400, postal: 0, total: 400 },
      { serial: 2, name: 'B', sex: 'M', age: 50, party: 'INC', general: 200, postal: 0, total: 200 },
    ] }],
    summaries: [{ constNo: 2, name: 'Ramnagar', type: 'SC', electors: 1000, voters: 615, contested: 2, totalValid: 600, nota: 10, pollDate: '2020-11-07',
      winner: { party: 'Bharatiya Janata Party', name: 'A', votes: 400 }, runnerUp: { party: 'Indian National Congress', name: 'B', votes: 200 }, margin: 200 }],
    performance: [{ abbr: 'BJP', contested: 1, won: 1, votes: 400 }, { abbr: 'INC', contested: 1, won: 0, votes: 200 }],
  };
}

describe('crossCheck', () => {
  it('passes when the tables agree (party given by full name or abbreviation)', () => {
    expect(crossCheck(election(), [])).toEqual([]);
    const e = election(); e.summaries[0].winner.party = 'BJP'; e.summaries[0].runnerUp.party = 'INC';
    expect(crossCheck(e, [])).toEqual([]);
  });
  it('reports each mismatch with its key', () => {
    const e = election();
    e.seats[0].electors = 999; e.seats[0].candidates[1].total = 201; e.performance[0].won = 2;
    const errs = crossCheck(e, []);
    expect(errs.map(x => x.split(' ')[0])).toEqual(expect.arrayContaining(['electors:2', 'total-valid:2', 'runner-up:2', 'margin:2', 'party-won:BJP', 'party-votes:INC']));
  });
  it('drops errors listed as exceptions for the year', () => {
    const e = election(); e.seats[0].electors = 999;
    expect(crossCheck(e, [{ year: 2020, key: 'electors:2', reason: 'ECI tables disagree' }])).toEqual([]);
    expect(crossCheck(e, [{ year: 2015, key: 'electors:2', reason: 'other year' }])).toHaveLength(1);
  });
  it('reports seats missing from either table', () => {
    const e = election(); e.summaries = [];
    expect(crossCheck(e, [])[0]).toMatch(/^summary-missing:2/);
  });
});

function json(): ElectionJson {
  const seat = (constNo: number, type: 'GEN' | 'SC' | 'ST') => ({ constNo, type, electors: 1000, voters: 600, turnout: 60, phase: 1, pollDate: '2020-10-28', candidates: [
    { serial: 1, name: 'A', partyId: 'BJP', sex: 'M' as const, age: 40, votes: 400, status: 'WON' as const },
    { serial: 2, name: 'B', partyId: 'INC', sex: 'M' as const, age: 40, votes: 150, status: 'LOST' as const },
    { serial: 3, name: 'NOTA', partyId: 'NOTA', sex: null, age: null, votes: 50, status: 'LOST' as const },
  ] });
  const seats = Array.from({ length: 243 }, (_, i) => seat(i + 1, i < 38 ? 'SC' : i < 40 ? 'ST' : 'GEN'));
  return { year: 2020, electionId: 'x', source: { title: 't', url: 'u', retrieved: '2026-10-03' }, parties: [], seats };
}

describe('validateElection', () => {
  it('accepts a well-formed election (phase count per year)', () => {
    const e = json(); e.seats.forEach((s, i) => { s.phase = (i % 3) + 1; });
    expect(validateElection(e)).toEqual([]);
  });
  it('rejects two winners, wrong reservation counts, turnout out of range and wrong phase count', () => {
    const e = json();
    e.seats[0].candidates[1].status = 'WON';
    e.seats[50].type = 'SC';
    e.seats[60].turnout = 101;
    const errs = validateElection(e);
    expect(errs).toEqual(expect.arrayContaining([
      expect.stringMatching(/^winners:1/), expect.stringMatching(/^reserved:/), expect.stringMatching(/^turnout:61/), expect.stringMatching(/^phases:/),
    ]));
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/bihar/__tests__/crosscheck.test.ts`
Expected: FAIL, cannot find module `../crosscheck`.

- [ ] **Step 3: Implement `crosscheck.ts`**

```ts
import type { ElectionJson, RawElection, Year } from './types';
import { normName } from './names';

export interface CrossCheckException { year: number; key: string; reason: string }

export const EXPECTED_PHASES: Record<Year, number> = { 2010: 6, 2015: 5, 2020: 3, 2025: 2 };

export function crossCheck(e: RawElection, exceptions: CrossCheckException[]): string[] {
  const errs: string[] = [];
  const add = (key: string, msg: string) => errs.push(`${key} ${msg}`);
  const fullOf = (abbr: string) => e.parties.find(p => p.abbr === abbr)?.name ?? abbr;
  const sameParty = (abbr: string, summaryParty: string) => summaryParty === abbr || normName(fullOf(abbr)) === normName(summaryParty);

  const summaries = new Map(e.summaries.map(s => [s.constNo, s]));
  for (const s of e.summaries) if (!e.seats.some(x => x.constNo === s.constNo)) add(`detailed-missing:${s.constNo}`, 'summary seat absent from Detailed Results');
  for (const seat of e.seats) {
    const m = summaries.get(seat.constNo);
    const k = (c: string) => `${c}:${seat.constNo}`;
    if (!m) { add(k('summary-missing'), 'seat absent from Constituency Data Summary'); continue; }
    if (seat.type && seat.type !== m.type) add(k('type'), `detailed ${seat.type} vs summary ${m.type}`);
    if (seat.electors !== m.electors) add(k('electors'), `detailed ${seat.electors} vs summary ${m.electors}`);
    if (seat.candidates.length !== m.contested) add(k('contested'), `detailed ${seat.candidates.length} vs summary ${m.contested}`);
    const valid = seat.candidates.reduce((a, c) => a + c.total, 0);
    if (valid !== m.totalValid) add(k('total-valid'), `detailed ${valid} vs summary ${m.totalValid}`);
    if ((seat.nota ?? null) !== (m.nota ?? null)) add(k('nota'), `detailed ${seat.nota} vs summary ${m.nota}`);
    if (valid + (seat.nota ?? 0) !== seat.totalVotes) add(k('turnout-row'), `candidates+NOTA ${valid + (seat.nota ?? 0)} vs TURNOUT row ${seat.totalVotes}`);
    const ranked = [...seat.candidates].sort((a, b) => b.total - a.total);
    const [w, r] = ranked;
    if (!w || !sameParty(w.party, m.winner.party) || w.total !== m.winner.votes) add(k('winner'), `detailed ${w?.party} ${w?.total} vs summary ${m.winner.party} ${m.winner.votes}`);
    if (!r || !sameParty(r.party, m.runnerUp.party) || r.total !== m.runnerUp.votes) add(k('runner-up'), `detailed ${r?.party} ${r?.total} vs summary ${m.runnerUp.party} ${m.runnerUp.votes}`);
    if (w && r && w.total - r.total !== m.margin) add(k('margin'), `detailed ${w.total - r.total} vs summary ${m.margin}`);
  }
  for (const p of e.performance) {
    if (p.abbr === 'IND') continue; // independents are reported as one pseudo-party in some years; checked through seats
    const cands = e.seats.flatMap(s => s.candidates.filter(c => c.party === p.abbr));
    const won = e.seats.filter(s => [...s.candidates].sort((a, b) => b.total - a.total)[0]?.party === p.abbr).length;
    const votes = cands.reduce((a, c) => a + c.total, 0);
    if (cands.length !== p.contested) add(`party-contested:${p.abbr}`, `detailed ${cands.length} vs performance ${p.contested}`);
    if (won !== p.won) add(`party-won:${p.abbr}`, `detailed ${won} vs performance ${p.won}`);
    if (votes !== p.votes) add(`party-votes:${p.abbr}`, `detailed ${votes} vs performance ${p.votes}`);
  }
  const skip = new Set(exceptions.filter(x => x.year === e.year).map(x => x.key));
  return errs.filter(x => !skip.has(x.split(' ')[0]));
}

export function validateElection(e: ElectionJson): string[] {
  const errs: string[] = [];
  if (e.seats.length !== 243) errs.push(`seats: ${e.seats.length} seats, expected 243`);
  const count = (t: string) => e.seats.filter(s => s.type === t).length;
  if (count('SC') !== 38 || count('ST') !== 2) errs.push(`reserved: SC ${count('SC')} / ST ${count('ST')}, expected 38 / 2`);
  const phases = new Set(e.seats.map(s => s.phase)).size;
  if (phases !== EXPECTED_PHASES[e.year]) errs.push(`phases: ${phases} distinct phases, expected ${EXPECTED_PHASES[e.year]}`);
  for (const s of e.seats) {
    const real = s.candidates.filter(c => c.partyId !== 'NOTA');
    const winners = s.candidates.filter(c => c.status === 'WON');
    if (winners.length !== 1 || winners[0].partyId === 'NOTA') errs.push(`winners:${s.constNo} ${winners.length} winners`);
    const top = [...real].sort((a, b) => b.votes - a.votes);
    if (top.length > 1 && top[0].votes === top[1].votes) errs.push(`tie:${s.constNo}`);
    if (winners[0] && top[0] && winners[0] !== top[0]) errs.push(`winner-not-top:${s.constNo}`);
    if (!(s.turnout > 0 && s.turnout <= 100)) errs.push(`turnout:${s.constNo} ${s.turnout}`);
    if (!s.candidates.every(c => Number.isInteger(c.votes) && c.votes >= 0)) errs.push(`votes:${s.constNo}`);
  }
  return errs;
}
```

The spec's "vote shares sum to 100 %" check is implied: shares are computed from these same totals, so the
cross-check's `total-valid` and `turnout-row` equalities are the meaningful form of it.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/bihar/__tests__/crosscheck.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/bihar/crosscheck.ts scraper/src/bihar/__tests__/crosscheck.test.ts
git commit -m "feat(scraper): ECI-internal cross-check and seat validation for Bihar seeding"
```

---

### Task 5: Party mapping (abbreviation → full name → our id)

**Files:**
- Create: `scraper/src/bihar/party-map.ts`, `scraper/src/bihar/suggest-parties-cli.ts`
- Test: `scraper/src/bihar/__tests__/party-map.test.ts`

**Interfaces:**
- Consumes: `PartyListEntry`, `PartyEntry`, `PartyMap`, `Recognition`; `normName`.
- Produces:
  - `resolveParty(abbr: string, list: PartyListEntry[], map: PartyMap): PartyEntry | { unknown: string }`.
    `IND` → `{ id: 'IND', … }` and `NOTA` → `{ id: 'NOTA', … }` without a lookup.
  - `suggestEntries(lists: PartyListEntry[], db: PartyEntry[], map: PartyMap): { add: PartyMap; problems: string[] }`.
  - `suggest-parties-cli.ts`: reads the four years' lists (via `loadPartyLists` from Task 6's `load.ts`; this task
    ships the CLI after Task 6 lands, see Step 6). It merges suggestions into `scraper/data/bihar/party-map.json` and prints problems,
    exiting 1 if there are any.
- Constant `NEW_PARTY_COLOR = '#9CA3AF'` (neutral grey, matches the site's muted palette).

- [ ] **Step 1: Write the failing test**

```ts
// scraper/src/bihar/__tests__/party-map.test.ts
import { describe, it, expect } from 'vitest';
import { resolveParty, suggestEntries, NEW_PARTY_COLOR } from '../party-map';
import type { PartyEntry, PartyListEntry } from '../types';

const list2010: PartyListEntry[] = [{ abbr: 'CPM', name: 'Communist Party of India (Marxist)', recognition: 'National' }];
const list2020: PartyListEntry[] = [{ abbr: 'CPI(M)', name: 'Communist Party of India  (Marxist)', recognition: 'National' }];
const cpim: PartyEntry = { id: 'CPIM', name: 'Communist Party of India (Marxist)', abbreviation: 'CPI(M)', color: '#FF0000', recognition: 'National' };
const map = { 'COMMUNIST PARTY OF INDIA MARXIST': cpim };

describe('resolveParty', () => {
  it('maps different abbreviations of one party through the full name', () => {
    expect(resolveParty('CPM', list2010, map)).toBe(cpim);
    expect(resolveParty('CPI(M)', list2020, map)).toBe(cpim);
  });
  it('handles IND and NOTA without the list', () => {
    expect(resolveParty('IND', [], {})).toMatchObject({ id: 'IND' });
    expect(resolveParty('NOTA', [], {})).toMatchObject({ id: 'NOTA' });
  });
  it('reports abbreviations missing from the list and names missing from the map', () => {
    expect(resolveParty('XYZ', list2010, map)).toEqual({ unknown: 'abbreviation XYZ is not in this year\'s party list' });
    expect(resolveParty('CPM', list2010, {})).toEqual({ unknown: 'no party-map entry for "Communist Party of India (Marxist)" (CPM)' });
  });
});

describe('suggestEntries', () => {
  const db: PartyEntry[] = [
    cpim,
    { id: 'VIP', name: 'Vikassheel Insaan Party', abbreviation: null, color: '#808080', recognition: null },
    { id: 'VSIP', name: 'Vikassheel Insaan Party', abbreviation: null, color: '#808080', recognition: null },
    { id: 'JJP', name: 'Jannayak Janta Party', abbreviation: 'JJP', color: '#808080', recognition: null },
  ];
  it('reuses an existing party with the same name', () => {
    expect(suggestEntries(list2020, db, {}).add).toEqual({ 'COMMUNIST PARTY OF INDIA MARXIST': cpim });
  });
  it('proposes a new party from the abbreviation with grey colour and list recognition', () => {
    const r = suggestEntries([{ abbr: 'JAPL', name: 'Jan Adhikar Party (Loktantrik)', recognition: 'Unrecognised' }], db, {});
    expect(r.add['JAN ADHIKAR PARTY LOKTANTRIK']).toEqual({ id: 'JAPL', name: 'Jan Adhikar Party (Loktantrik)', abbreviation: 'JAPL', color: NEW_PARTY_COLOR, recognition: 'Unrecognised' });
    expect(r.problems).toEqual([]);
  });
  it('flags a name held by two ids and an id taken by a different party', () => {
    const r = suggestEntries([
      { abbr: 'VSIP', name: 'Vikassheel Insaan Party', recognition: 'Unrecognised' },
      { abbr: 'JJP', name: 'Jagrook Janta Party', recognition: 'Unrecognised' },
    ], db, {});
    expect(r.problems).toEqual([
      'ambiguous: "Vikassheel Insaan Party" matches VIP, VSIP; add the entry by hand',
      'collision: id JJP for "Jagrook Janta Party" already belongs to "Jannayak Janta Party"; add the entry by hand',
    ]);
  });
  it('keeps entries already in the map', () => {
    expect(suggestEntries(list2020, db, map).add).toEqual({});
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/bihar/__tests__/party-map.test.ts`
Expected: FAIL, cannot find module `../party-map`.

- [ ] **Step 3: Implement `party-map.ts`**

```ts
import type { PartyEntry, PartyListEntry, PartyMap } from './types';
import { normName } from './names';

export const NEW_PARTY_COLOR = '#9CA3AF';
const IND: PartyEntry = { id: 'IND', name: 'Independent', abbreviation: 'IND', color: '#808080', recognition: null };
const NOTA: PartyEntry = { id: 'NOTA', name: 'None of the Above', abbreviation: 'NOTA', color: '#808080', recognition: null };
const abbrKey = (s: string) => s.replace(/\s/g, '').toUpperCase();

export function resolveParty(abbr: string, list: PartyListEntry[], map: PartyMap): PartyEntry | { unknown: string } {
  const a = abbrKey(abbr);
  if (a === 'IND') return IND;
  if (a === 'NOTA') return NOTA;
  const entry = list.find(p => abbrKey(p.abbr) === a);
  if (!entry) return { unknown: `abbreviation ${abbr} is not in this year's party list` };
  const hit = map[normName(entry.name)];
  return hit ?? { unknown: `no party-map entry for "${entry.name.replace(/\s+/g, ' ')}" (${abbr})` };
}

export function suggestEntries(lists: PartyListEntry[], db: PartyEntry[], map: PartyMap): { add: PartyMap; problems: string[] } {
  const add: PartyMap = {};
  const problems: string[] = [];
  for (const p of lists) {
    const key = normName(p.name);
    if (map[key] || add[key] || ['IND', 'NOTA'].includes(abbrKey(p.abbr))) continue;
    const name = p.name.replace(/\s+/g, ' ').trim();
    const same = db.filter(d => normName(d.name) === key);
    if (same.length > 1) { problems.push(`ambiguous: "${name}" matches ${same.map(d => d.id).join(', ')}; add the entry by hand`); continue; }
    if (same.length === 1) { add[key] = same[0]; continue; }
    const id = abbrKey(p.abbr).replace(/[^A-Z0-9]/g, '').slice(0, 20);
    const taken = db.find(d => d.id === id) ?? Object.values(add).find(d => d.id === id);
    if (taken) { problems.push(`collision: id ${id} for "${name}" already belongs to "${taken.name}"; add the entry by hand`); continue; }
    add[key] = { id, name, abbreviation: p.abbr.trim(), color: NEW_PARTY_COLOR, recognition: p.recognition };
  }
  return { add, problems };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/bihar/__tests__/party-map.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/bihar/party-map.ts scraper/src/bihar/__tests__/party-map.test.ts
git commit -m "feat(scraper): map ECI party abbreviations to party ids via full names"
```

- [ ] **Step 6: (after Task 6 Step 4) write `suggest-parties-cli.ts`**

```ts
/** Propose party-map.json entries for every party in the four Bihar party lists. Usage: npx ts-node src/bihar/suggest-parties-cli.ts */
import * as fs from 'fs';
import { Client } from 'pg';
import { suggestEntries } from './party-map';
import { loadPartyLists, DATA_DIR } from './load';
import type { PartyEntry, PartyMap } from './types';

async function main() {
  const file = `${DATA_DIR}/party-map.json`;
  const map: PartyMap = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgresql://admin:password123@localhost:3083/election_tracker' });
  await db.connect();
  const rows = (await db.query<PartyEntry>('SELECT id, name, abbreviation, color, eci_recognition AS recognition FROM parties ORDER BY id')).rows;
  await db.end();
  const lists = await loadPartyLists();
  const used = lists.filter(p => p.used); // only parties that fielded a Bihar candidate
  const { add, problems } = suggestEntries(used, rows, map);
  const merged = Object.fromEntries(Object.entries({ ...map, ...add }).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(file, JSON.stringify(merged, null, 2) + '\n');
  console.log(`party-map.json: ${Object.keys(add).length} added, ${Object.keys(merged).length} total`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(problems.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
```

---

### Task 6: Year config, loader, normaliser, fetch and parse CLIs; produce the JSON

**Files:**
- Create: `scraper/src/bihar/years.ts`, `scraper/src/bihar/load.ts`, `scraper/src/bihar/normalize.ts`,
  `scraper/src/bihar/fetch-cli.ts`, `scraper/src/bihar/parse-cli.ts`
- Create (data, committed): `scraper/data/bihar/party-map.json`, `scraper/data/bihar/crosscheck-exceptions.json`,
  `scraper/data/bihar/vs-{2010,2015,2020,2025}.json`
- Test: `scraper/src/bihar/__tests__/normalize.test.ts`

**Interfaces:**
- Consumes: all parsers (Tasks 2–3), `crossCheck`/`validateElection` (Task 4), `resolveParty` (Task 5).
- Produces:
  - `years.ts`: `interface YearConfig { year: Year; electionId: string; constPrefix: string; source: { title: string; url: string };
    files: { pdf: string } | { detailed: string; summary: string; parties: string; performance: string } }`, `YEARS: Record<Year, YearConfig>`.
  - `load.ts`: `DATA_DIR` (abs path of `scraper/data/bihar`), `RAW_DIR` (abs path of `scraper/data/raw/bihar`),
    `loadRaw(year: Year): RawElection`, `loadPartyLists(): Promise<(PartyListEntry & { used: boolean })[]>`.
  - `normalize.ts`: `normalize(raw: RawElection, cfg: YearConfig, map: PartyMap, retrieved: string): { json: ElectionJson; errors: string[] }`.

- [ ] **Step 1: Write `years.ts`**

```ts
import type { Year } from './types';

export interface YearConfig {
  year: Year; electionId: string; constPrefix: string;
  source: { title: string; url: string };
  files: { pdf: string } | { detailed: string; summary: string; parties: string; performance: string };
}

const OLD = (docid: number) => `https://www.eci.gov.in/eci-backend/public/api/old-site-statistical-report-data?docid=${docid}`;

export const YEARS: Record<Year, YearConfig> = {
  2010: { year: 2010, electionId: 'a1b2c3d4-e5f6-7890-abcd-111111111010', constPrefix: 'BR_VS10_',
    source: { title: 'ECI Statistical Report, Bihar Legislative Assembly 2010', url: OLD(3903) },
    files: { pdf: '2010/ECI_Statistical_Report_Bihar_AE_2010.pdf' } },
  2015: { year: 2015, electionId: 'a1b2c3d4-e5f6-7890-abcd-111111111015', constPrefix: 'BR_VS15_',
    source: { title: 'ECI Statistical Report, Bihar Legislative Assembly 2015', url: OLD(3904) },
    files: { pdf: '2015/ECI_Statistical_Report_Bihar_AE_2015.pdf' } },
  2020: { year: 2020, electionId: 'b2c3d4e5-f6a7-8901-bcde-123456789020', constPrefix: 'BR_VS20_',
    source: { title: 'ECI Statistical Report, Bihar Legislative Assembly 2020', url: OLD(12787) },
    files: { detailed: '2020/10_-_Detailed_Results.xls', summary: '2020/8_-_Constituency_Data_Summary.xlsx',
      parties: '2020/3_-_List_Of_Political_Parties_Participated.xls', performance: '2020/5-Performance_of_Political_Parties.xlsx' } },
  2025: { year: 2025, electionId: 'c3d4e5f6-a7b8-9012-cdef-234567890abc', constPrefix: 'BR_VS_',
    source: { title: 'ECI Statistical Report, Bihar Legislative Assembly 2025', url: 'https://www.eci.gov.in/eci-backend/public/api/election-result?category_id=16' },
    files: { detailed: '2025/10-Detailed_Results.xlsx', summary: '2025/8-Constituency_Data_Summery_Report.xlsx',
      parties: '2025/3-List_Of_Political_Parties_Participated.xlsx', performance: '2025/5-Performance_of_Political_Parties.xlsx' } },
};
```

- [ ] **Step 2: Write `load.ts`**

```ts
import * as path from 'path';
import { execFileSync } from 'child_process';
import * as XLSX from 'xlsx';
import type { PartyListEntry, RawElection, Year } from './types';
import { YEARS } from './years';
import { parseDetailedRows, parsePartyListRows, parsePerformanceRows, parseSummaryRows, type Row } from './xls-report';
import { parseDetailedText, parsePartyListText, parsePerformanceText, parseSummaryText } from './pdf-report';

export const DATA_DIR = path.resolve(__dirname, '../../data/bihar');
export const RAW_DIR = path.resolve(__dirname, '../../data/raw/bihar');

const sheets = (file: string): Row[][] => {
  const wb = XLSX.readFile(path.join(RAW_DIR, file));
  return wb.SheetNames.map(n => XLSX.utils.sheet_to_json<Row>(wb.Sheets[n], { header: 1, defval: null }));
};
const pdfText = (file: string): string =>
  execFileSync('pdftotext', ['-layout', path.join(RAW_DIR, file), '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

export function loadRaw(year: Year): RawElection {
  const f = YEARS[year].files;
  if ('pdf' in f) {
    const t = pdfText(f.pdf);
    return { year, seats: parseDetailedText(t), summaries: parseSummaryText(t), parties: parsePartyListText(t), performance: parsePerformanceText(t) };
  }
  return {
    year,
    seats: parseDetailedRows(sheets(f.detailed)[0]),
    summaries: sheets(f.summary).map(parseSummaryRows),
    parties: parsePartyListRows(sheets(f.parties)[0]),
    performance: parsePerformanceRows(sheets(f.performance)[0]),
  };
}

/** Every year's party list, each entry marked `used` when that year has a candidate with its abbreviation. */
export async function loadPartyLists(): Promise<(PartyListEntry & { used: boolean })[]> {
  return (Object.keys(YEARS).map(Number) as Year[]).flatMap(y => {
    const raw = loadRaw(y);
    const used = new Set(raw.seats.flatMap(s => s.candidates.map(c => c.party.replace(/\s/g, '').toUpperCase())));
    return raw.parties.map(p => ({ ...p, used: used.has(p.abbr.replace(/\s/g, '').toUpperCase()) }));
  });
}
```

Note: the PDF summary parser reads every `CONSTITUENCY :` block in the whole text. Only Constituency Data Summary
pages use that form; the Detailed Results use `Constituency  N.`, so no section slicing is needed.

- [ ] **Step 3: Write the failing normaliser test**

```ts
// scraper/src/bihar/__tests__/normalize.test.ts
import { describe, it, expect } from 'vitest';
import { normalize } from '../normalize';
import { YEARS } from '../years';
import type { PartyMap, RawElection } from '../types';

const map: PartyMap = {
  'BHARATIYA JANATA PARTY': { id: 'BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP', color: '#FF6B00', recognition: 'National' },
};
const raw = (): RawElection => ({
  year: 2010,
  parties: [{ abbr: 'BJP', name: 'Bharatiya Janata Party', recognition: 'National' }],
  seats: [1, 2].map(n => ({ constNo: n, acName: 'X', type: null, electors: 2000, nota: null, totalVotes: 900, candidates: [
    { serial: 1, name: 'RAM PRASAD', sex: 'M' as const, age: 40, party: 'IND', general: 300, postal: 0, total: 300 },
    { serial: 2, name: 'SITA DEVI', sex: 'F' as const, age: 35, party: 'BJP', general: 600, postal: 0, total: 600 },
  ] })),
  summaries: [1, 2].map(n => ({ constNo: n, name: 'X', type: 'GEN' as const, electors: 2000, voters: 901, contested: 2, totalValid: 900, nota: null,
    pollDate: n === 1 ? '2010-10-28' : '2010-10-21', winner: { party: 'BJP', name: 'S', votes: 600 }, runnerUp: { party: 'IND', name: 'R', votes: 300 }, margin: 300 })),
  performance: [],
});

describe('normalize', () => {
  it('builds seats with statuses, display names, turnout and phase from poll date order', () => {
    const { json, errors } = normalize(raw(), YEARS[2010], map, '2026-10-03');
    expect(errors).toEqual([]);
    expect(json.parties.map(p => p.id).sort()).toEqual(['BJP', 'IND']);
    const [s1, s2] = json.seats;
    expect(s1).toMatchObject({ constNo: 1, type: 'GEN', electors: 2000, voters: 901, turnout: 45.05, phase: 2, pollDate: '2010-10-28' });
    expect(s2.phase).toBe(1);
    expect(s1.candidates).toEqual([
      { serial: 1, name: 'Ram Prasad', partyId: 'IND', sex: 'M', age: 40, votes: 300, status: 'LOST' },
      { serial: 2, name: 'Sita Devi', partyId: 'BJP', sex: 'F', age: 35, votes: 600, status: 'WON' },
    ]);
  });
  it('adds a NOTA candidate when the seat has NOTA votes', () => {
    const r = raw(); r.seats[0].nota = 25;
    const { json } = normalize(r, YEARS[2010], map, '2026-10-03');
    expect(json.seats[0].candidates.at(-1)).toEqual({ serial: 3, name: 'NOTA', partyId: 'NOTA', sex: null, age: null, votes: 25, status: 'LOST' });
  });
  it('collects unknown parties instead of throwing', () => {
    const { errors } = normalize(raw(), YEARS[2010], {}, '2026-10-03');
    expect(errors).toEqual(['party: no party-map entry for "Bharatiya Janata Party" (BJP)']);
  });
});
```

- [ ] **Step 4: Run it to make sure it fails, then implement `normalize.ts`**

Run: `npx vitest run src/bihar/__tests__/normalize.test.ts` → FAIL (module missing). Then:

```ts
import type { CandidateJson, ElectionJson, PartyEntry, PartyMap, RawElection, SeatJson } from './types';
import type { YearConfig } from './years';
import { displayName } from './names';
import { resolveParty } from './party-map';

export function normalize(raw: RawElection, cfg: YearConfig, map: PartyMap, retrieved: string): { json: ElectionJson; errors: string[] } {
  const errors = new Set<string>();
  const parties = new Map<string, PartyEntry>();
  const summaries = new Map(raw.summaries.map(s => [s.constNo, s]));
  const dates = [...new Set(raw.summaries.map(s => s.pollDate))].sort();
  const seats: SeatJson[] = [];
  for (const seat of [...raw.seats].sort((a, b) => a.constNo - b.constNo)) {
    const m = summaries.get(seat.constNo);
    if (!m) { errors.add(`summary: seat ${seat.constNo} missing`); continue; }
    const top = Math.max(...seat.candidates.map(c => c.total));
    const candidates: CandidateJson[] = seat.candidates.map(c => {
      const p = resolveParty(c.party, raw.parties, map);
      if ('unknown' in p) { errors.add(`party: ${p.unknown}`); return null; }
      if (p.id !== 'NOTA') parties.set(p.id, p);
      return { serial: c.serial, name: displayName(c.name), partyId: p.id, sex: c.sex, age: c.age, votes: c.total, status: c.total === top ? 'WON' : 'LOST' };
    }).filter((c): c is CandidateJson => c !== null);
    if (seat.nota !== null) candidates.push({ serial: seat.candidates.length + 1, name: 'NOTA', partyId: 'NOTA', sex: null, age: null, votes: seat.nota, status: 'LOST' });
    seats.push({ constNo: seat.constNo, type: m.type, electors: m.electors, voters: m.voters, turnout: Math.round((m.voters / m.electors) * 10000) / 100,
      phase: dates.indexOf(m.pollDate) + 1, pollDate: m.pollDate, candidates });
  }
  return {
    json: { year: raw.year, electionId: cfg.electionId, source: { ...cfg.source, retrieved }, parties: [...parties.values()].sort((a, b) => a.id.localeCompare(b.id)), seats },
    errors: [...errors],
  };
}
```

A tie for the top vote makes two `WON` rows; `validateElection` reports it (`winners:` / `tie:`), so nothing silently picks one.

Run: `npx vitest run src/bihar/__tests__/normalize.test.ts && npm run typecheck` → PASS.

- [ ] **Step 5: Write `fetch-cli.ts`** (reproducibility; the raw files already exist locally)

```ts
/**
 * Download the ECI statistical reports used for Bihar seeding into scraper/data/raw/bihar/<year>/.
 * Usage: npx ts-node src/bihar/fetch-cli.ts [year ...]   (skips files that already exist)
 */
import * as fs from 'fs';
import * as path from 'path';
import { RAW_DIR } from './load';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36';
const BASE = 'https://www.eci.gov.in/eci-backend/public';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const get = async (url: string) => { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r; };

async function save(year: string, name: string, url: string) {
  const out = path.join(RAW_DIR, year, name);
  if (fs.existsSync(out)) { console.log(`  have ${year}/${name}`); return; }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(await (await get(url)).arrayBuffer()));
  console.log(`  saved ${year}/${name}`);
  await sleep(2000);
}

/** 2025: new-site report list (each item has title + xlsx_url). Saved without ECI's timestamp suffix. */
async function fetchNew(year: string, categoryId: number) {
  const body = await (await get(`${BASE}/api/election-result?category_id=${categoryId}`)).json() as { results: { title: string; xlsx_url: string | null }[] };
  for (const r of body.results) if (r.xlsx_url) await save(year, path.basename(r.xlsx_url).replace(/_\d{9,}(\.\w+)$/, '$1'), r.xlsx_url.replace('public//', 'public/'));
}

/** Older years: old-site report attachments (download links are opaque /api/download?url=… values). */
async function fetchOld(year: string, docid: number) {
  const body = await (await get(`${BASE}/api/old-site-statistical-report-data?docid=${docid}`)).json() as
    { results: { data: { document_attach: { record_realname: string; record_location: string }[] }[] } };
  for (const d of body.results.data) for (const a of d.document_attach) {
    const url = a.record_location.startsWith('http') ? a.record_location : `https://www.eci.gov.in${a.record_location}`;
    await save(year, a.record_realname.replace(/\s+/g, '_'), url);
  }
}

const JOBS: Record<string, () => Promise<void>> = {
  2025: () => fetchNew('2025', 16), 2020: () => fetchOld('2020', 12787), 2015: () => fetchOld('2015', 3904), 2010: () => fetchOld('2010', 3903),
};

(async () => {
  const years = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);
  for (const y of years) { console.log(`Bihar ${y}`); await JOBS[y](); }
})().catch(e => { console.error(e); process.exit(1); });
```

The older years' saved names come from `record_realname`. The PDFs were saved earlier as
`ECI_Statistical_Report_Bihar_AE_<year>.pdf`; if `record_realname` differs, keep the existing name in `years.ts` and
note the real name in the commit message. Do not rename files silently.

- [ ] **Step 6: Smoke-test the fetcher against the cache**

Run: `npx ts-node src/bihar/fetch-cli.ts 2025`
Expected: `have 2025/…` for the files already present (or `saved` for missing ones). Network errors here are not
blocking for the rest of the plan; record them in the task report.

- [ ] **Step 7: Write `parse-cli.ts`**

```ts
/**
 * Parse one or more Bihar years from the raw ECI files into scraper/data/bihar/vs-<year>.json.
 * Fails (exit 1, nothing written for that year) on any cross-check or validation error.
 * Usage: npx ts-node src/bihar/parse-cli.ts 2020 [2010 2015 2025]
 */
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR, loadRaw } from './load';
import { YEARS } from './years';
import { normalize } from './normalize';
import { crossCheck, validateElection, type CrossCheckException } from './crosscheck';
import type { PartyMap, Year } from './types';

const readJson = <T>(name: string, fallback: T): T => {
  const f = path.join(DATA_DIR, name);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) as T : fallback;
};

let failed = false;
for (const y of process.argv.slice(2).map(Number) as Year[]) {
  const cfg = YEARS[y];
  if (!cfg) { console.error(`unknown year ${y}`); failed = true; continue; }
  const raw = loadRaw(y);
  const xErrs = crossCheck(raw, readJson<CrossCheckException[]>('crosscheck-exceptions.json', []));
  const { json, errors } = normalize(raw, cfg, readJson<PartyMap>('party-map.json', {}), new Date().toISOString().slice(0, 10));
  const all = [...xErrs, ...errors, ...(errors.length ? [] : validateElection(json))];
  console.log(`Bihar ${y}: ${raw.seats.length} seats, ${raw.seats.reduce((a, s) => a + s.candidates.length, 0)} candidates, ${all.length} problems`);
  for (const e of all) console.error(`  ${e}`);
  if (all.length) { failed = true; continue; }
  const prev = readJson<{ source?: { retrieved?: string } } | null>(`vs-${y}.json`, null);
  if (prev?.source?.retrieved) json.source.retrieved = prev.source.retrieved; // keep the first retrieval date so regeneration is diff-free
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, `vs-${y}.json`), JSON.stringify(json, null, 1) + '\n');
}
process.exit(failed ? 1 : 0);
```

- [ ] **Step 8: Build the party map**

Make sure the local DB is up (`docker compose up -d postgres`), then run `npx ts-node src/bihar/suggest-parties-cli.ts`.
Expected: `party-map.json` is written; problems are listed. Resolve each problem by adding an entry to
`scraper/data/bihar/party-map.json` by hand:
- *ambiguous* (e.g. Vikassheel Insaan Party → `VIP` / `VSIP`): pick the id the existing seeds use most for that party
  (`SELECT party_id, count(*) FROM candidates WHERE party_id IN ('VIP','VSIP') GROUP BY 1`), map the name to it, and
  note the duplicate id in the task report for the admin to merge later.
- *collision*: choose a new unique id (abbreviation + state suffix, e.g. `JJP_BR`; ≤ 20 chars, `[A-Z0-9_]`).
Re-run until it exits 0. Review the new entries' names; colours stay `#9CA3AF` except well-known parties already in the DB.

- [ ] **Step 9: Parse 2020 end to end**

Run (from `scraper/`): `mkdir -p data/bihar && { [ -f data/bihar/crosscheck-exceptions.json ] || echo '[]' > data/bihar/crosscheck-exceptions.json; } && npx ts-node src/bihar/parse-cli.ts 2020`
Expected: `Bihar 2020: 243 seats, ~3,733 candidates, 0 problems` and `data/bihar/vs-2020.json` exists.
If problems appear:
- a parser problem (e.g. a row shape not covered) → add a failing unit test reproducing the real row, fix the parser,
  re-run;
- a genuine disagreement between ECI's own tables → add `{ "year": 2020, "key": "<key>", "reason": "<what ECI shows in each table>" }`
  to `crosscheck-exceptions.json`. Never add an exception for a parser bug.

- [ ] **Step 10: Parse 2025, 2015, 2010** the same way (`npx ts-node src/bihar/parse-cli.ts 2025 2015 2010`), with
the same rules. The PDF years are where unit-test-first fixes are most likely.
Expected: each prints 243 seats and 0 problems. Spot-check three seats per year by hand against the PDF/XLS
(seat 1, a reserved seat, seat 243): winner, votes, NOTA, electors.

- [ ] **Step 11: Run all tests and commit**

```bash
npx vitest run && npm run typecheck
git add scraper/src/bihar/years.ts scraper/src/bihar/load.ts scraper/src/bihar/normalize.ts scraper/src/bihar/fetch-cli.ts scraper/src/bihar/parse-cli.ts scraper/src/bihar/suggest-parties-cli.ts scraper/src/bihar/__tests__/normalize.test.ts scraper/data/bihar/
git commit -m "feat(scraper): parse Bihar 2010-2025 ECI reports into cross-checked JSON"
```

---

### Task 7: Read the existing seeds and match old rows to new candidates

**Files:**
- Create: `scraper/src/bihar/existing-seed.ts`, `scraper/src/bihar/match.ts`
- Create (data, committed): `scraper/data/bihar/decisions.json` (starts as `{}`)
- Test: `scraper/src/bihar/__tests__/existing-seed.test.ts`, `scraper/src/bihar/__tests__/match.test.ts`

**Interfaces:**
- Consumes: `ElectionJson`, `similarity`.
- Produces:
  - `existing-seed.ts`: `interface OldConst { id: string; constNo: number; name: string }`,
    `interface OldCand { id: string; constId: string; partyId: string; name: string; resultId: string }`,
    `interface ExistingSeed { electionSql: string; constituencies: OldConst[]; candidates: OldCand[]; manifestJson: string | null }`,
    `parseTuples(line: string): (string | number | boolean | null)[]`, `readExistingSeed(sql: string): ExistingSeed`.
  - `match.ts`: `type Decision = { action: 'delete'; reason: string } | { action: 'match'; serial: number; reason: string }`,
    `interface Matched { old: OldCand; serial: number; similarity: number }`,
    `interface SeatMatch { constId: string; matched: Matched[]; unmatchedOld: OldCand[]; deleted: OldCand[] }`,
    `matchYear(json: ElectionJson, seed: ExistingSeed, decisions: Record<string, Decision>): SeatMatch[]`,
    `stableUuid(...parts: (string | number)[]): string`, `LOW_SIMILARITY = 0.5`.

- [ ] **Step 1: Write the failing tests**

```ts
// scraper/src/bihar/__tests__/existing-seed.test.ts
import { describe, it, expect } from 'vitest';
import { parseTuples, readExistingSeed } from '../existing-seed';

const SQL = `-- Bihar Vidhan Sabha 2010 Election Data
INSERT INTO elections (id, name, type, state_id, year, status, tentative_next_date) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-111111111010', 'Bihar Vidhan Sabha 2010', 'VS', 5, 2010, 'Finalized', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO constituencies (id, election_id, district_id, state_id, name, const_no, type, voter_turnout, phase, total_electors) VALUES
  ('BR_VS10_1_VALMIKI_NAGAR', 'a1b2c3d4-e5f6-7890-abcd-111111111010', NULL, 5, 'Valmiki Nagar', 1, 'GEN', NULL, NULL, NULL),
  ('BR_VS10_2_RAMNAGAR', 'a1b2c3d4-e5f6-7890-abcd-111111111010', NULL, 5, 'Ramnagar', 2, 'GEN', NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO candidates (id, person_id, election_id, const_id, party_id, name, is_incumbent) VALUES
  ('425b37f1-1ef2-4d0b-896a-d637694bbf62', NULL, 'a1b2c3d4-e5f6-7890-abcd-111111111010', 'BR_VS10_1_VALMIKI_NAGAR', 'JDU', 'Rajesh Singh', FALSE),
  ('6c11ea64-c8d2-451f-9367-86f346443a96', NULL, 'a1b2c3d4-e5f6-7890-abcd-111111111010', 'BR_VS10_1_VALMIKI_NAGAR', 'RJD', 'O''Brien, Mukesh', FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO results (id, candidate_id, const_id, votes, status, margin, round_no, election_id) VALUES
  ('478d66d8-a411-476e-96ba-7a832950fe3d', '425b37f1-1ef2-4d0b-896a-d637694bbf62', 'BR_VS10_1_VALMIKI_NAGAR', 64671, 'WON', 14671, 0, 'a1b2c3d4-e5f6-7890-abcd-111111111010'),
  ('db34d8dc-b26b-453e-965e-8d34ad4c307d', '6c11ea64-c8d2-451f-9367-86f346443a96', 'BR_VS10_1_VALMIKI_NAGAR', 50000, 'LOST', 14671, 0, 'a1b2c3d4-e5f6-7890-abcd-111111111010')
ON CONFLICT DO NOTHING;

-- Manifest
UPDATE elections SET manifest_url = '{"leaders":[{"name":"Nitish Kumar"}],"note":"it''s"}' WHERE id = 'a1b2c3d4-e5f6-7890-abcd-111111111010';
`;

describe('existing seed reader', () => {
  it('parses SQL tuples with quotes, NULL, numbers and booleans', () => {
    expect(parseTuples("  ('a''b', NULL, 5, 'x', FALSE),")).toEqual(["a'b", null, 5, 'x', false]);
  });
  it('reads constituencies, candidates with their result ids, the election statement and the manifest', () => {
    const s = readExistingSeed(SQL);
    expect(s.constituencies).toEqual([
      { id: 'BR_VS10_1_VALMIKI_NAGAR', constNo: 1, name: 'Valmiki Nagar' }, { id: 'BR_VS10_2_RAMNAGAR', constNo: 2, name: 'Ramnagar' },
    ]);
    expect(s.candidates).toEqual([
      { id: '425b37f1-1ef2-4d0b-896a-d637694bbf62', constId: 'BR_VS10_1_VALMIKI_NAGAR', partyId: 'JDU', name: 'Rajesh Singh', resultId: '478d66d8-a411-476e-96ba-7a832950fe3d' },
      { id: '6c11ea64-c8d2-451f-9367-86f346443a96', constId: 'BR_VS10_1_VALMIKI_NAGAR', partyId: 'RJD', name: "O'Brien, Mukesh", resultId: 'db34d8dc-b26b-453e-965e-8d34ad4c307d' },
    ]);
    expect(s.electionSql).toMatch(/^INSERT INTO elections[\s\S]*ON CONFLICT \(id\) DO NOTHING;$/);
    expect(s.manifestJson).toBe('{"leaders":[{"name":"Nitish Kumar"}],"note":"it\'s"}');
  });
  it('fails when a candidate has no result row', () => {
    expect(() => readExistingSeed(SQL.replace(/\n  \('db34d8dc[^\n]*\n/, '\n'))).toThrow(/no result row/);
  });
});
```

```ts
// scraper/src/bihar/__tests__/match.test.ts
import { describe, it, expect } from 'vitest';
import { matchYear, stableUuid } from '../match';
import type { ExistingSeed } from '../existing-seed';
import type { ElectionJson } from '../types';

const seed = (): ExistingSeed => ({
  electionSql: '', manifestJson: null,
  constituencies: [{ id: 'BR_VS10_1_X', constNo: 1, name: 'X' }],
  candidates: [
    { id: 'old-jdu', constId: 'BR_VS10_1_X', partyId: 'JDU', name: 'Rajesh Singh', resultId: 'r1' },
    { id: 'old-ind', constId: 'BR_VS10_1_X', partyId: 'IND', name: 'Deep Narayan Mahato', resultId: 'r2' },
    { id: 'old-rjd', constId: 'BR_VS10_1_X', partyId: 'RJD', name: 'Somebody Else', resultId: 'r3' },
  ],
});
const json = (): ElectionJson => ({ year: 2010, electionId: 'e', source: { title: '', url: '', retrieved: '' }, parties: [], seats: [{
  constNo: 1, type: 'GEN', electors: 1, voters: 1, turnout: 1, phase: 1, pollDate: '2010-10-21', candidates: [
    { serial: 1, name: 'Rajesh Singh', partyId: 'JDU', sex: 'M', age: 37, votes: 42289, status: 'WON' },
    { serial: 2, name: 'Mukesh Kumar Kushwaha', partyId: 'RJD', sex: 'M', age: 34, votes: 27618, status: 'LOST' },
    { serial: 5, name: 'Deep Narayan Mahato', partyId: 'IND', sex: 'M', age: 65, votes: 14047, status: 'LOST' },
    { serial: 7, name: 'Saket Kumar Pathak', partyId: 'IND', sex: 'M', age: 27, votes: 4428, status: 'LOST' },
  ] }] });

describe('matchYear', () => {
  it('matches by party when unique, IND only by name, and records similarity', () => {
    const [s] = matchYear(json(), seed(), {});
    expect(s.matched.map(m => [m.old.id, m.serial])).toEqual([['old-jdu', 1], ['old-ind', 5], ['old-rjd', 2]]);
    expect(s.matched.find(m => m.old.id === 'old-rjd')!.similarity).toBeLessThan(0.5); // flagged for review
    expect(s.unmatchedOld).toEqual([]);
  });
  it('leaves an IND row without a name match unmatched, and applies decisions', () => {
    const sd = seed(); sd.candidates[1].name = 'Unknown Person';
    expect(matchYear(json(), sd, {})[0].unmatchedOld.map(o => o.id)).toEqual(['old-ind']);
    const del = matchYear(json(), sd, { 'old-ind': { action: 'delete', reason: 'not in ECI' } })[0];
    expect(del.unmatchedOld).toEqual([]); expect(del.deleted.map(o => o.id)).toEqual(['old-ind']);
    const mt = matchYear(json(), sd, { 'old-ind': { action: 'match', serial: 7, reason: 'same person, misspelt' } })[0];
    expect(mt.matched.find(m => m.old.id === 'old-ind')!.serial).toBe(7);
  });
  it('fails on a decision that points at a missing serial', () => {
    expect(() => matchYear(json(), seed(), { 'old-ind': { action: 'match', serial: 99, reason: 'x' } })).toThrow(/serial 99/);
  });
});

describe('stableUuid', () => {
  it('is deterministic and UUID-shaped', () => {
    expect(stableUuid('bihar', 2010, 1, 7)).toBe(stableUuid('bihar', 2010, 1, 7));
    expect(stableUuid('bihar', 2010, 1, 7)).not.toBe(stableUuid('bihar', 2010, 1, 8));
    expect(stableUuid('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/bihar/__tests__/existing-seed.test.ts src/bihar/__tests__/match.test.ts`
Expected: FAIL, modules missing.

- [ ] **Step 3: Implement `existing-seed.ts`**

```ts
export interface OldConst { id: string; constNo: number; name: string }
export interface OldCand { id: string; constId: string; partyId: string; name: string; resultId: string }
export interface ExistingSeed { electionSql: string; constituencies: OldConst[]; candidates: OldCand[]; manifestJson: string | null }

type Val = string | number | boolean | null;

/** Values of one `(…)` tuple line from a generated INSERT … VALUES block. */
export function parseTuples(line: string): Val[] {
  const s = line.trim().replace(/,$/, '');
  if (!s.startsWith('(') || !s.endsWith(')')) throw new Error(`not a tuple: ${line}`);
  const out: Val[] = [];
  let i = 1;
  while (i < s.length - 1) {
    while (s[i] === ' ' || s[i] === ',') i++;
    if (s[i] === "'") {
      let v = ''; i++;
      for (;;) {
        if (s[i] === "'" && s[i + 1] === "'") { v += "'"; i += 2; continue; }
        if (s[i] === "'") { i++; break; }
        if (i >= s.length) throw new Error(`unterminated string: ${line}`);
        v += s[i++];
      }
      out.push(v);
    } else {
      const m = /^[^,)]+/.exec(s.slice(i))!;
      const tok = m[0].trim();
      i += m[0].length;
      out.push(tok === 'NULL' ? null : tok === 'TRUE' ? true : tok === 'FALSE' ? false : Number(tok));
    }
  }
  return out;
}

function block(sql: string, table: string): Val[][] {
  const start = sql.indexOf(`INSERT INTO ${table} (`);
  if (start < 0) return [];
  const lines = sql.slice(start).split('\n').slice(1);
  const rows: Val[][] = [];
  for (const l of lines) { if (!l.trim().startsWith('(')) break; rows.push(parseTuples(l)); }
  return rows;
}

export function readExistingSeed(sql: string): ExistingSeed {
  const e0 = sql.indexOf('INSERT INTO elections');
  const electionSql = sql.slice(e0, sql.indexOf('ON CONFLICT (id) DO NOTHING;', e0) + 'ON CONFLICT (id) DO NOTHING;'.length);
  const constituencies = block(sql, 'constituencies').map(r => ({ id: r[0] as string, constNo: r[5] as number, name: r[4] as string }));
  const results = new Map(block(sql, 'results').map(r => [r[1] as string, r[0] as string]));
  const candidates = block(sql, 'candidates').map(r => {
    const resultId = results.get(r[0] as string);
    if (!resultId) throw new Error(`candidate ${r[0]} has no result row`);
    return { id: r[0] as string, constId: r[3] as string, partyId: r[4] as string, name: r[5] as string, resultId };
  });
  const mm = /^UPDATE elections SET manifest_url = '((?:[^']|'')*)' WHERE id = /m.exec(sql);
  return { electionSql, constituencies, candidates, manifestJson: mm ? mm[1].replace(/''/g, "'") : null };
}
```

- [ ] **Step 4: Implement `match.ts`**

```ts
import { createHash } from 'crypto';
import type { ElectionJson } from './types';
import type { ExistingSeed, OldCand } from './existing-seed';
import { similarity } from './names';

export type Decision = { action: 'delete'; reason: string } | { action: 'match'; serial: number; reason: string };
export interface Matched { old: OldCand; serial: number; similarity: number }
export interface SeatMatch { constId: string; matched: Matched[]; unmatchedOld: OldCand[]; deleted: OldCand[] }
export const LOW_SIMILARITY = 0.5;
const NAME_MATCH = 0.6;

/** Name-based (v5-shaped) UUID from the given parts: regenerating a seed never changes ids. */
export function stableUuid(...parts: (string | number)[]): string {
  const h = createHash('sha1').update(parts.join('|')).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function matchYear(json: ElectionJson, seed: ExistingSeed, decisions: Record<string, Decision>): SeatMatch[] {
  const constByNo = new Map(seed.constituencies.map(c => [c.constNo, c.id]));
  return json.seats.map(seat => {
    const constId = constByNo.get(seat.constNo);
    if (!constId) throw new Error(`year ${json.year}: no existing constituency for seat ${seat.constNo}`);
    const olds = seed.candidates.filter(c => c.constId === constId);
    const taken = new Set<number>();
    const res: SeatMatch = { constId, matched: [], unmatchedOld: [], deleted: [] };
    const take = (old: OldCand, serial: number) => {
      const c = seat.candidates.find(x => x.serial === serial)!;
      taken.add(serial);
      res.matched.push({ old, serial, similarity: c.partyId === 'NOTA' ? 1 : similarity(old.name, c.name) });
    };
    for (const old of olds) {
      const d = decisions[old.id];
      if (d?.action === 'delete') res.deleted.push(old);
      if (d?.action === 'match') {
        if (!seat.candidates.some(c => c.serial === d.serial)) throw new Error(`decision for ${old.id}: seat ${seat.constNo} has no serial ${d.serial}`);
        take(old, d.serial);
      }
    }
    for (const old of olds) {
      if (decisions[old.id]) continue;
      const pool = seat.candidates.filter(c => c.partyId === old.partyId && !taken.has(c.serial));
      const best = pool.map(c => ({ c, s: similarity(old.name, c.name) })).sort((a, b) => b.s - a.s)[0];
      if (pool.length === 1 && old.partyId !== 'IND') take(old, pool[0].serial);
      else if (best && best.s >= NAME_MATCH) take(old, best.c.serial);
      else res.unmatchedOld.push(old);
    }
    res.matched.sort((a, b) => olds.indexOf(a.old) - olds.indexOf(b.old));
    return res;
  });
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/bihar/__tests__/existing-seed.test.ts src/bihar/__tests__/match.test.ts && npm run typecheck`
Expected: PASS. (The first test's expected match order is the old rows' order: jdu, ind, rjd.)

- [ ] **Step 6: Commit**

```bash
echo '{}' > scraper/data/bihar/decisions.json
git add scraper/src/bihar/existing-seed.ts scraper/src/bihar/match.ts scraper/src/bihar/__tests__/existing-seed.test.ts scraper/src/bihar/__tests__/match.test.ts scraper/data/bihar/decisions.json
git commit -m "feat(scraper): read existing Bihar seeds and match old rows to ECI candidates"
```

---

### Task 8: Emit the seeds (parties, years, run-once corrections) and wire `setup.sh`

**Files:**
- Create: `scraper/src/bihar/sql.ts`, `scraper/src/bihar/emit.ts`, `scraper/src/bihar/generate-cli.ts`
- Test: `scraper/src/bihar/__tests__/emit.test.ts`
- Generate: `database/seed_bihar_parties.sql`, `database/seed_bihar_corrections_v1.sql`, `database/seed_bihar_vs_{2010,2015,2020,2025}.sql`,
  `scraper/data/bihar/review-{2010,2015,2020,2025}.json`
- Modify: `database/setup.sh` (seed order + header comment)
- Delete: `scraper/src/generate-bihar-vs-seed.ts`, `scraper/src/generate-bihar-vs-2010-seed.ts`, `scraper/src/generate-bihar-vs-2015-seed.ts`, `scraper/src/generate-bihar-vs-2020-seed.ts`

**Interfaces:**
- Consumes: `ElectionJson`, `PartyEntry`, `ExistingSeed`, `SeatMatch`, `stableUuid`, `runOnce` (`scraper/src/seed-run-once.ts`).
- Produces:
  - `sql.ts`: `q(v: string | number | null): string` (SQL literal; strings single-quote-doubled, null → `NULL`).
  - `emit.ts`:
    - `interface Plan { json: ElectionJson; seed: ExistingSeed; matches: SeatMatch[] }`;
    - `seatMargin(seat: SeatJson): number`;
    - `candidateIds(plan: Plan): Map<string, { candidateId: string; resultId: string }>`, keyed `${constNo}:${serial}`.
      Matched → old ids; otherwise `stableUuid('bihar-vs', year, constNo, serial, 'candidate' | 'result')`;
    - `emitParties(parties: PartyEntry[]): string`;
    - `emitYear(plan: Plan): string`;
    - `emitCorrections(plans: Plan[]): string`.

- [ ] **Step 1: Write the failing test**

```ts
// scraper/src/bihar/__tests__/emit.test.ts
import { describe, it, expect } from 'vitest';
import { emitCorrections, emitParties, emitYear, seatMargin, candidateIds, type Plan } from '../emit';
import type { ElectionJson } from '../types';

const json: ElectionJson = { year: 2010, electionId: 'a1b2c3d4-e5f6-7890-abcd-111111111010', source: { title: 'ECI Statistical Report, Bihar 2010', url: 'https://eci', retrieved: '2026-10-03' },
  parties: [{ id: 'JDU', name: 'Janata Dal (United)', abbreviation: 'JD(U)', color: '#003366', recognition: 'State' }],
  seats: [{ constNo: 1, type: 'SC', electors: 240418, voters: 143701, turnout: 59.77, phase: 2, pollDate: '2010-10-28', candidates: [
    { serial: 1, name: 'Rajesh Singh', partyId: 'JDU', sex: 'M', age: 37, votes: 42289, status: 'WON' },
    { serial: 2, name: "Mukesh O'Kushwaha", partyId: 'RJD', sex: 'M', age: 34, votes: 27618, status: 'LOST' },
    { serial: 3, name: 'NOTA', partyId: 'NOTA', sex: null, age: null, votes: 500, status: 'LOST' },
  ] }] };
const plan = (): Plan => ({
  json,
  seed: { electionSql: "INSERT INTO elections (id) VALUES\n  ('a1b2c3d4-e5f6-7890-abcd-111111111010')\nON CONFLICT (id) DO NOTHING;", manifestJson: '{"a":"it\'s"}',
    constituencies: [{ id: 'BR_VS10_1_VALMIKI_NAGAR', constNo: 1, name: 'Valmiki Nagar' }],
    candidates: [
      { id: '11111111-1111-1111-1111-111111111111', constId: 'BR_VS10_1_VALMIKI_NAGAR', partyId: 'JDU', name: 'Rajesh Singh', resultId: '22222222-2222-2222-2222-222222222222' },
      { id: '33333333-3333-3333-3333-333333333333', constId: 'BR_VS10_1_VALMIKI_NAGAR', partyId: 'LJP', name: 'Gone Person', resultId: '44444444-4444-4444-4444-444444444444' },
    ] },
  matches: [{ constId: 'BR_VS10_1_VALMIKI_NAGAR', matched: [{ old: { id: '11111111-1111-1111-1111-111111111111', constId: 'BR_VS10_1_VALMIKI_NAGAR', partyId: 'JDU', name: 'Rajesh Singh', resultId: '22222222-2222-2222-2222-222222222222' }, serial: 1, similarity: 1 }],
    unmatchedOld: [], deleted: [{ id: '33333333-3333-3333-3333-333333333333', constId: 'BR_VS10_1_VALMIKI_NAGAR', partyId: 'LJP', name: 'Gone Person', resultId: '44444444-4444-4444-4444-444444444444' }] }],
});

describe('emit', () => {
  it('computes the seat margin without NOTA', () => { expect(seatMargin(json.seats[0])).toBe(14671); });
  it('reuses old ids for matched candidates and stable ids for new ones', () => {
    const ids = candidateIds(plan());
    expect(ids.get('1:1')).toEqual({ candidateId: '11111111-1111-1111-1111-111111111111', resultId: '22222222-2222-2222-2222-222222222222' });
    expect(ids.get('1:2')!.candidateId).toMatch(/^[0-9a-f-]{36}$/);
    expect(candidateIds(plan()).get('1:2')).toEqual(ids.get('1:2'));
  });
  it('emits parties as fill-only inserts', () => {
    expect(emitParties(json.parties)).toContain("INSERT INTO parties (id, name, abbreviation, color, eci_recognition) VALUES\n  ('JDU', 'Janata Dal (United)', 'JD(U)', '#003366', 'State')\nON CONFLICT (id) DO NOTHING;");
  });
  it('emits the year seed: kept election statement, constituency facts, candidates, results with the seat margin, gender fill, guarded manifest', () => {
    const sql = emitYear(plan());
    expect(sql).toContain("('a1b2c3d4-e5f6-7890-abcd-111111111010')\nON CONFLICT (id) DO NOTHING;");
    expect(sql).toContain("('BR_VS10_1_VALMIKI_NAGAR', 'a1b2c3d4-e5f6-7890-abcd-111111111010', NULL, 5, 'Valmiki Nagar', 1, 'SC', 59.77, 2, 240418)");
    expect(sql).toContain("('11111111-1111-1111-1111-111111111111', NULL, 'a1b2c3d4-e5f6-7890-abcd-111111111010', 'BR_VS10_1_VALMIKI_NAGAR', 'JDU', 'Rajesh Singh', FALSE, 37)");
    expect(sql).toContain("'Mukesh O''Kushwaha'");
    expect(sql).toContain("('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'BR_VS10_1_VALMIKI_NAGAR', 42289, 'WON', 14671, 0, 'a1b2c3d4-e5f6-7890-abcd-111111111010')");
    expect(sql).toMatch(/'NOTA', 'NOTA', FALSE, NULL\)/);
    expect(sql).toContain('AND p.gender IS NULL');
    expect(sql).toContain("UPDATE elections SET manifest_url = '{\"a\":\"it''s\"}' WHERE id = 'a1b2c3d4-e5f6-7890-abcd-111111111010' AND manifest_url IS NULL;");
    expect(sql).not.toContain('33333333-3333-3333-3333-333333333333');
    expect(sql).not.toMatch(/metadata/);
  });
  it('emits a run-once corrections seed: deletes, result/candidate/constituency updates, guarded person rename', () => {
    const sql = emitCorrections([plan()]);
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_bihar_corrections_v1')");
    expect(sql).toContain("EXISTS (SELECT 1 FROM constituencies WHERE election_id = 'a1b2c3d4-e5f6-7890-abcd-111111111010')");
    expect(sql).toContain("DELETE FROM results WHERE candidate_id IN ('33333333-3333-3333-3333-333333333333');");
    expect(sql).toContain("DELETE FROM candidates WHERE id IN ('33333333-3333-3333-3333-333333333333');");
    expect(sql).toContain("('22222222-2222-2222-2222-222222222222', 42289, 'WON', 14671)");
    expect(sql).toContain("('11111111-1111-1111-1111-111111111111', 'Rajesh Singh', 'JDU', 37, 'Rajesh Singh')");
    expect(sql).toContain('(SELECT count(*) FROM candidates c2 WHERE c2.person_id = p.id) = 1');
    expect(sql).toContain("('BR_VS10_1_VALMIKI_NAGAR', 'SC', 240418, 59.77, 2)");
    expect(sql.indexOf('DELETE FROM results')).toBeLessThan(sql.indexOf('UPDATE results'));
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/bihar/__tests__/emit.test.ts`
Expected: FAIL, module missing.

- [ ] **Step 3: Implement `sql.ts` and `emit.ts`**

```ts
// scraper/src/bihar/sql.ts
export const q = (v: string | number | null): string => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);
```

```ts
// scraper/src/bihar/emit.ts
import type { ElectionJson, PartyEntry, SeatJson } from './types';
import type { ExistingSeed } from './existing-seed';
import { stableUuid, type SeatMatch } from './match';
import { runOnce } from '../seed-run-once';
import { q } from './sql';

export interface Plan { json: ElectionJson; seed: ExistingSeed; matches: SeatMatch[] }
const STATE_ID = 5;

export function seatMargin(seat: SeatJson): number {
  const v = seat.candidates.filter(c => c.partyId !== 'NOTA').map(c => c.votes).sort((a, b) => b - a);
  return (v[0] ?? 0) - (v[1] ?? 0);
}

export function candidateIds(plan: Plan): Map<string, { candidateId: string; resultId: string }> {
  const ids = new Map<string, { candidateId: string; resultId: string }>();
  plan.json.seats.forEach((seat, i) => {
    const byserial = new Map(plan.matches[i].matched.map(m => [m.serial, m.old]));
    for (const c of seat.candidates) {
      const old = byserial.get(c.serial);
      ids.set(`${seat.constNo}:${c.serial}`, old ? { candidateId: old.id, resultId: old.resultId }
        : { candidateId: stableUuid('bihar-vs', plan.json.year, seat.constNo, c.serial, 'candidate'), resultId: stableUuid('bihar-vs', plan.json.year, seat.constNo, c.serial, 'result') });
    }
  });
  return ids;
}

const values = (rows: string[]) => rows.join(',\n');

export function emitParties(parties: PartyEntry[]): string {
  const rows = [...parties].sort((a, b) => a.id.localeCompare(b.id))
    .map(p => `  (${q(p.id)}, ${q(p.name)}, ${q(p.abbreviation)}, ${q(p.color)}, ${q(p.recognition)})`);
  return [
    '-- Bihar parties: every party that fielded a Bihar VS candidate 2010-2025 (generated by scraper/src/bihar/generate-cli.ts).',
    '-- Fill-only: existing rows (and admin edits) are never changed. Runs before the Bihar corrections and VS seeds.',
    '',
    'INSERT INTO parties (id, name, abbreviation, color, eci_recognition) VALUES',
    values(rows),
    'ON CONFLICT (id) DO NOTHING;',
    '',
  ].join('\n');
}

export function emitYear(plan: Plan): string {
  const { json, seed } = plan;
  const ids = candidateIds(plan);
  const constIds = new Map(plan.matches.map((m, i) => [json.seats[i].constNo, m.constId]));
  const names = new Map(seed.constituencies.map(c => [c.id, c.name]));
  const consts: string[] = [], cands: string[] = [], results: string[] = [], genders: string[] = [];
  for (const seat of json.seats) {
    const cid = constIds.get(seat.constNo)!;
    consts.push(`  (${q(cid)}, ${q(json.electionId)}, NULL, ${STATE_ID}, ${q(names.get(cid)!)}, ${seat.constNo}, ${q(seat.type)}, ${seat.turnout}, ${seat.phase}, ${seat.electors})`);
    const margin = seatMargin(seat);
    for (const c of seat.candidates) {
      const id = ids.get(`${seat.constNo}:${c.serial}`)!;
      cands.push(`  (${q(id.candidateId)}, NULL, ${q(json.electionId)}, ${q(cid)}, ${q(c.partyId)}, ${q(c.name)}, FALSE, ${q(c.age)})`);
      results.push(`  (${q(id.resultId)}, ${q(id.candidateId)}, ${q(cid)}, ${c.votes}, ${q(c.status)}, ${margin}, 0, ${q(json.electionId)})`);
      if (c.sex) genders.push(`  (${q(id.candidateId)}, ${q(c.sex)})`);
    }
  }
  const total = json.seats.reduce((a, s) => a + s.candidates.length, 0);
  return [
    `-- Bihar Vidhan Sabha ${json.year}: every candidate + NOTA, real votes.`,
    `-- Source: ${json.source.title} (${json.source.url}), retrieved ${json.source.retrieved}.`,
    '-- Generated by scraper/src/bihar/generate-cli.ts from scraper/data/bihar/vs-' + json.year + '.json. Do not edit by hand.',
    '-- Existing DBs are brought to these values first by seed_bihar_corrections_v1.sql (runs before this file).',
    '',
    seed.electionSql,
    '',
    `-- Constituencies (${json.seats.length})`,
    'INSERT INTO constituencies (id, election_id, district_id, state_id, name, const_no, type, voter_turnout, phase, total_electors) VALUES',
    values(consts),
    'ON CONFLICT DO NOTHING;',
    '',
    `-- Candidates (${total})`,
    'INSERT INTO candidates (id, person_id, election_id, const_id, party_id, name, is_incumbent, age) VALUES',
    values(cands),
    'ON CONFLICT DO NOTHING;',
    '',
    '-- Results (margin = seat margin on every row, NOTA excluded; the ingest rule)',
    'INSERT INTO results (id, candidate_id, const_id, votes, status, margin, round_no, election_id) VALUES',
    values(results),
    'ON CONFLICT DO NOTHING;',
    '',
    '-- Person gender from the ECI report, fill-only',
    'UPDATE persons p SET gender = v.sex',
    'FROM (VALUES',
    values(genders),
    ') AS v(candidate_id, sex)',
    'JOIN candidates c ON c.id = v.candidate_id::uuid',
    'WHERE p.id = c.person_id AND p.gender IS NULL;',
    '',
    ...(seed.manifestJson ? ['-- Manifest (only when none is published; admins edit it)',
      `UPDATE elections SET manifest_url = ${q(seed.manifestJson)} WHERE id = ${q(json.electionId)} AND manifest_url IS NULL;`, ''] : []),
  ].join('\n');
}

export function emitCorrections(plans: Plan[]): string {
  const body: string[] = [];
  for (const plan of plans) {
    const { json } = plan;
    const ids = candidateIds(plan);
    const deleted = plan.matches.flatMap(m => m.deleted.map(o => q(o.id)));
    const res: string[] = [], cand: string[] = [], cons: string[] = [];
    plan.json.seats.forEach((seat, i) => {
      const margin = seatMargin(seat);
      cons.push(`  (${q(plan.matches[i].constId)}, ${q(seat.type)}, ${seat.electors}, ${seat.turnout}, ${seat.phase})`);
      for (const m of plan.matches[i].matched) {
        const c = seat.candidates.find(x => x.serial === m.serial)!;
        res.push(`  (${q(ids.get(`${seat.constNo}:${c.serial}`)!.resultId)}, ${c.votes}, ${q(c.status)}, ${margin})`);
        cand.push(`  (${q(m.old.id)}, ${q(c.name)}, ${q(c.partyId)}, ${q(c.age)}, ${q(m.old.name)})`);
      }
    });
    body.push(`-- ${json.year}`);
    if (deleted.length) {
      body.push(`DELETE FROM results WHERE candidate_id IN (${deleted.join(', ')});`);
      body.push(`DELETE FROM candidates WHERE id IN (${deleted.join(', ')});`);
    }
    body.push(
      'UPDATE results r SET votes = v.votes, status = v.status::result_status, margin = v.margin',
      `FROM (VALUES\n${values(res)}\n) AS v(id, votes, status, margin) WHERE r.id = v.id::uuid;`,
      // persons first (they compare against the old candidate name), then candidates
      'UPDATE persons p SET name = v.name',
      `FROM (VALUES\n${values(cand)}\n) AS v(id, name, party_id, age, old_name)`,
      'JOIN candidates c ON c.id = v.id::uuid',
      'WHERE p.id = c.person_id AND p.name = v.old_name AND v.name <> v.old_name',
      '  AND (SELECT count(*) FROM candidates c2 WHERE c2.person_id = p.id) = 1;',
      'UPDATE candidates c SET name = v.name, party_id = v.party_id, age = v.age::smallint',
      `FROM (VALUES\n${values(cand)}\n) AS v(id, name, party_id, age, old_name) WHERE c.id = v.id::uuid;`,
      'UPDATE constituencies k SET type = v.type::constituency_type, total_electors = v.electors, voter_turnout = v.turnout, phase = v.phase::smallint',
      `FROM (VALUES\n${values(cons)}\n) AS v(id, type, electors, turnout, phase) WHERE k.id = v.id;`,
      '',
    );
  }
  return runOnce({
    name: 'seed_bihar_corrections_v1',
    comment: [
      'Run once (seed_runs). Brings the Bihar VS 2010-2025 rows of an existing DB to the real ECI values before the',
      'Bihar VS seeds run: deletes the old rows ECI does not have (decided in scraper/data/bihar/decisions.json),',
      'fixes votes/status/margin, candidate names/party/age, constituency type/electors/turnout/phase, and renames',
      'auto-created single-candidacy persons still carrying the old name. The VS seeds then insert the missing',
      'candidates. On a fresh DB there are no Bihar rows yet: the body is skipped and only the marker is written.',
      'Generated by scraper/src/bihar/generate-cli.ts. Do not edit by hand.',
    ],
    conditions: [`EXISTS (SELECT 1 FROM constituencies WHERE election_id = ${q(plans[0].json.electionId)})`],
    body,
  }).join('\n');
}
```

`emitCorrections` takes the guard from `plans[0]`. `generate-cli.ts` passes the plans in year order 2010, 2015, 2020,
2025; all four elections were seeded together, so the presence of 2010's rows marks an old-seeded DB.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/bihar/__tests__/emit.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Write `generate-cli.ts`**

```ts
/**
 * Generate the Bihar seeds from scraper/data/bihar/*.json and the current database/seed_bihar_vs_<year>.sql ids.
 * Writes review-<year>.json; refuses (exit 1) while any old row is unmatched without a decision.
 * Usage: npx ts-node src/bihar/generate-cli.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR } from './load';
import { readExistingSeed } from './existing-seed';
import { matchYear, LOW_SIMILARITY, type Decision } from './match';
import { emitCorrections, emitParties, emitYear, type Plan } from './emit';
import { validateElection } from './crosscheck';
import type { ElectionJson, PartyEntry, Year } from './types';

const DB_DIR = path.resolve(__dirname, '../../../database');
const YEARS_ORDER: Year[] = [2010, 2015, 2020, 2025];
const decisions: Record<string, Decision> = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'decisions.json'), 'utf8'));

const plans: Plan[] = [];
let blocked = 0;
for (const y of YEARS_ORDER) {
  const json: ElectionJson = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `vs-${y}.json`), 'utf8'));
  const errs = validateElection(json);
  if (errs.length) { console.error(`vs-${y}.json fails validation:\n  ${errs.join('\n  ')}`); process.exit(1); }
  const seed = readExistingSeed(fs.readFileSync(path.join(DB_DIR, `seed_bihar_vs_${y}.sql`), 'utf8'));
  const matches = matchYear(json, seed, decisions);
  const review = {
    unmatchedOld: matches.flatMap(m => m.unmatchedOld.map(o => ({ ...o, seat: m.constId, eci: json.seats.find(s => m.constId.includes(`_${s.constNo}_`))?.candidates.map(c => `${c.serial} ${c.name} (${c.partyId})`) }))),
    lowSimilarity: matches.flatMap((m, i) => m.matched.filter(x => x.similarity < LOW_SIMILARITY)
      .map(x => ({ oldId: x.old.id, oldName: x.old.name, newName: json.seats[i].candidates.find(c => c.serial === x.serial)!.name, party: x.old.partyId, seat: m.constId, similarity: Math.round(x.similarity * 100) / 100 }))),
    deleted: matches.flatMap(m => m.deleted.map(o => ({ ...o, reason: (decisions[o.id] as { reason: string }).reason }))),
  };
  fs.writeFileSync(path.join(DATA_DIR, `review-${y}.json`), JSON.stringify(review, null, 1) + '\n');
  console.log(`${y}: ${matches.reduce((a, m) => a + m.matched.length, 0)} matched, ${review.unmatchedOld.length} unmatched, ${review.lowSimilarity.length} low-similarity, ${review.deleted.length} deleted`);
  blocked += review.unmatchedOld.length;
  plans.push({ json, seed, matches });
}
if (blocked) { console.error(`${blocked} old rows need a decision in scraper/data/bihar/decisions.json (see review-<year>.json). Nothing written.`); process.exit(1); }

const parties = new Map<string, PartyEntry>();
for (const p of plans.flatMap(pl => pl.json.parties)) if (!['IND', 'NOTA'].includes(p.id)) parties.set(p.id, p);
fs.writeFileSync(path.join(DB_DIR, 'seed_bihar_parties.sql'), emitParties([...parties.values()]));
fs.writeFileSync(path.join(DB_DIR, 'seed_bihar_corrections_v1.sql'), emitCorrections(plans));
for (const p of plans) fs.writeFileSync(path.join(DB_DIR, `seed_bihar_vs_${p.json.year}.sql`), emitYear(p));
console.log('Wrote seed_bihar_parties.sql, seed_bihar_corrections_v1.sql, seed_bihar_vs_{2010,2015,2020,2025}.sql');
```

Note: the generator reads the old ids from the current seed files and then overwrites them. Re-running after
generation still works because the new files carry the same ids for matched rows plus stable ids for the rest, and
every row then matches itself. The corrections seed for that re-run would contain only no-op updates and no deletes,
so **commit the first generation's corrections seed** and treat it as frozen (Step 7).

- [ ] **Step 6: First run: review and decide**

Run: `npx ts-node src/bihar/generate-cli.ts`
Expected first time: `N old rows need a decision`. For each entry in `review-<year>.json` → `unmatchedOld`, add to
`scraper/data/bihar/decisions.json` either:
- `{ "<old id>": { "action": "match", "serial": <ECI serial>, "reason": "same person: <old> = <ECI name>" } }` when one of
  the listed ECI candidates is clearly the same person (spelling/alias differences);
- `{ "<old id>": { "action": "delete", "reason": "not an ECI candidate in this seat (old estimated data)" } }` otherwise.

Then also look through `lowSimilarity`. These are matched by party, but the names differ. If the old row is clearly a different person, either
re-point it with `match` to the right ECI serial, or use `delete` when no ECI candidate fits; a `delete` lets the
year seed insert the real candidate fresh. **Show the user the counts and a sample of `delete` and `lowSimilarity` entries before
continuing.** Deleting a candidate also deletes its person when that was its only candidacy, so the user decides. Re-run until
the generator writes the files.

- [ ] **Step 7: Freeze the corrections seed**

After the first successful generation, edit `generate-cli.ts` so it never overwrites an existing
`seed_bihar_corrections_v1.sql`:

```ts
const corrections = path.join(DB_DIR, 'seed_bihar_corrections_v1.sql');
if (!fs.existsSync(corrections)) fs.writeFileSync(corrections, emitCorrections(plans));
else console.log('seed_bihar_corrections_v1.sql exists (frozen run-once seed); not rewritten');
```

Replace the unconditional `writeFileSync` for the corrections seed with this. Rationale: a run-once seed already
applied in production must not change, and a later correction gets a new `_v2` file.

- [ ] **Step 8: Wire `setup.sh`**

In `database/setup.sh` replace

```bash
echo "==> Seeds: Vidhan Sabha results"
# Newest first: older Bihar files reference parties (LJP, HAMS) first defined in newer ones.
for y in 2025 2020 2015 2010; do run "seed_bihar_vs_${y}.sql"; done
```

with

```bash
echo "==> Seeds: Vidhan Sabha results"
# Bihar: parties first, then the run-once corrections (brings an old-seeded DB to the real ECI values and deletes the
# old rows ECI does not have, so the seat+party unique index cannot skip a new candidate), then the year files.
run seed_bihar_parties.sql
run seed_bihar_corrections_v1.sql
for y in 2025 2020 2015 2010; do run "seed_bihar_vs_${y}.sql"; done
```

and extend the header comment's seed list (`LS 2024 → state parties → VS results …`) with `(Bihar: parties → corrections → years)`.

- [ ] **Step 9: Delete the superseded generators**

```bash
git rm scraper/src/generate-bihar-vs-seed.ts scraper/src/generate-bihar-vs-2010-seed.ts scraper/src/generate-bihar-vs-2015-seed.ts scraper/src/generate-bihar-vs-2020-seed.ts
grep -rn "generate-bihar-vs" --include=*.ts --include=*.json --include=*.md . | grep -v node_modules
```

Expected: no remaining references in code, apart from historical docs (leave those). `eci-vs-adapter.ts` stays: the live
worker and simulation use it.

- [ ] **Step 10: Load into a scratch DB as a first check**

```bash
psql postgresql://admin:password123@localhost:3083/postgres -c "DROP DATABASE IF EXISTS et_gen_check" -c "CREATE DATABASE et_gen_check"
DATABASE_URL=postgresql://admin:password123@localhost:3083/et_gen_check database/setup.sh
psql postgresql://admin:password123@localhost:3083/et_gen_check -At -c "SELECT e.year, count(*) FILTER (WHERE r.status='WON'), count(*) FROM results r JOIN elections e ON e.id=r.election_id WHERE e.state_id=5 AND e.type='VS' GROUP BY 1 ORDER BY 1"
```

Expected: setup completes; each year shows 243 winners and a total equal to that year's candidates + NOTA in the JSON.

- [ ] **Step 11: Run all tests and commit**

```bash
cd scraper && npx vitest run && npm run typecheck && cd ..
git add scraper/src/bihar/sql.ts scraper/src/bihar/emit.ts scraper/src/bihar/generate-cli.ts scraper/src/bihar/__tests__/emit.test.ts scraper/data/bihar/ database/seed_bihar_parties.sql database/seed_bihar_corrections_v1.sql database/seed_bihar_vs_2010.sql database/seed_bihar_vs_2015.sql database/seed_bihar_vs_2020.sql database/seed_bihar_vs_2025.sql database/setup.sh
git commit -m "feat(seed): Bihar VS 2010-2025 from ECI statistical reports (all candidates, run-once corrections)"
```

---

### Task 9: Two-DB check (fresh vs upgraded, setup run twice)

**Files:**
- Create: `scraper/src/bihar/bihar-snapshot.sql`, `scraper/src/bihar/two-db-check.sh`

**Interfaces:**
- Consumes: the generated seeds and `setup.sh` (Task 8).
- Produces: `scraper/src/bihar/two-db-check.sh` exits 0 when a fresh build and an upgraded copy of the current local DB
  end up with identical Bihar VS constituencies, candidates and results. Output: one line per table, `same` / `DIFF`.

- [ ] **Step 1: Write `bihar-snapshot.sql`**

```sql
-- One md5 per Bihar VS table, over the columns the seeds own. Persons are excluded: an upgraded DB keeps admin and
-- multi-candidacy person names by design. Seat analysis is excluded: it is computed through the admin API after deploy.
WITH e AS (SELECT id FROM elections WHERE state_id = 5 AND type = 'VS')
SELECT 'constituencies', count(*), md5(string_agg(concat_ws('|', k.id, k.election_id, k.district_id, k.region_id, k.name, k.const_no, k.type, k.voter_turnout, k.phase, k.total_electors), E'\n' ORDER BY k.id))
  FROM constituencies k JOIN e ON e.id = k.election_id
UNION ALL
SELECT 'candidates', count(*), md5(string_agg(concat_ws('|', c.id, c.election_id, c.const_id, c.party_id, c.name, c.age), E'\n' ORDER BY c.id))
  FROM candidates c JOIN e ON e.id = c.election_id
UNION ALL
SELECT 'results', count(*), md5(string_agg(concat_ws('|', r.id, r.candidate_id, r.const_id, r.votes, r.status, r.margin, r.round_no), E'\n' ORDER BY r.id))
  FROM results r JOIN e ON e.id = r.election_id
UNION ALL
SELECT 'parties', count(*), md5(string_agg(p.id, ',' ORDER BY p.id))
  FROM parties p WHERE p.id IN (SELECT DISTINCT party_id FROM candidates c JOIN e ON e.id = c.election_id);
```

- [ ] **Step 2: Write `two-db-check.sh`**

```bash
#!/usr/bin/env bash
# Fresh build vs upgraded copy of the current DB must agree on Bihar VS data (constituencies, candidates, results).
# The upgraded copy runs setup.sh twice: the second run must change nothing.
# Usage: scraper/src/bihar/two-db-check.sh   (env: PG_BASE=postgresql://admin:password123@localhost:3083, SRC_DB=election_tracker)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BASE="${PG_BASE:-postgresql://admin:password123@localhost:3083}"
SRC="${SRC_DB:-election_tracker}"
SNAP="$ROOT/scraper/src/bihar/bihar-snapshot.sql"

fresh_db() { psql -X -q "$BASE/postgres" -c "DROP DATABASE IF EXISTS $1" -c "CREATE DATABASE $1"; }
snap() { psql -X -At -F ' ' "$BASE/$1" -f "$SNAP"; }

echo "==> fresh build"
fresh_db et_fresh
DATABASE_URL="$BASE/et_fresh" "$ROOT/database/setup.sh" >/dev/null

echo "==> upgraded copy of $SRC"
fresh_db et_upgrade
pg_dump --no-owner --no-privileges "$BASE/$SRC" | psql -X -q -v ON_ERROR_STOP=1 "$BASE/et_upgrade" >/dev/null
DATABASE_URL="$BASE/et_upgrade" "$ROOT/database/setup.sh" >/dev/null
first="$(snap et_upgrade)"
DATABASE_URL="$BASE/et_upgrade" "$ROOT/database/setup.sh" >/dev/null
second="$(snap et_upgrade)"

status=0
[[ "$first" == "$second" ]] && echo "rerun: same" || { echo "rerun: DIFF (second setup.sh run changed data)"; status=1; }
paste -d ' ' <(snap et_fresh) <(echo "$second") | while read -r t1 n1 h1 t2 n2 h2; do
  if [[ "$n1 $h1" == "$n2 $h2" ]]; then echo "$t1: same ($n1 rows)"; else echo "$t1: DIFF (fresh $n1, upgraded $n2)"; fi
done | tee /dev/stderr | grep -q DIFF && status=1
exit $status
```

- [ ] **Step 3: Run it**

Run: `chmod +x scraper/src/bihar/two-db-check.sh && scraper/src/bihar/two-db-check.sh`
Expected: `rerun: same`, then `constituencies: same (972 rows)`, `candidates: same (…)`, `results: same (…)`,
`parties: same (…)`, and exit 0.
If `candidates`/`results` differ: query both DBs for the seat with the differing rows
(`SELECT const_id, count(*) … GROUP BY 1 EXCEPT …`). The usual cause is an old row the corrections seed did not
handle; fix it through `decisions.json` (the corrections seed is not yet in production, so it may still be regenerated:
delete it, re-run `generate-cli.ts`, re-run this check). If `pg_dump` refuses because of a server/client version
mismatch, use the server's own dump:
`docker exec election_tracker_db pg_dump -U admin --no-owner --no-privileges election_tracker | psql … et_upgrade`.

- [ ] **Step 4: Spot-check the site**

With the local DB upgraded (`DATABASE_URL=postgresql://admin:password123@localhost:3083/election_tracker database/setup.sh`)
and the dev servers running, open Bihar 2020 and 2010 on the frontend (port 3080): the tally shows every party,
seat 1's page lists all candidates with NOTA, and reserved seats show SC/ST. Then recompute the seat analysis for the
four elections through the admin (Live Console → constituency analysis, or `POST /api/v1/admin/constituencies/analysis/compute/<electionId>`
with an admin token) and check that a seat page's history section reads sensibly.

- [ ] **Step 5: Commit, then clean up**

```bash
git add scraper/src/bihar/bihar-snapshot.sql scraper/src/bihar/two-db-check.sh
git commit -m "test(seed): fresh vs upgraded DB check for Bihar VS data"
psql postgresql://admin:password123@localhost:3083/postgres -c "DROP DATABASE IF EXISTS et_fresh" -c "DROP DATABASE IF EXISTS et_upgrade" -c "DROP DATABASE IF EXISTS et_gen_check"
```

---

### Task 10: About page, docs, and the post-deploy step

**Files:**
- Modify: `frontend/src/model/about/about.ts` (Bihar rows)
- Modify: `frontend/src/model/about/__tests__/*` only if a test pins the old Bihar rows
- Modify: `docs/FEATURES.md`, `CLAUDE.md` (seed order + key data files), `docs/SEEDING_NEXT_PHASE.md` (status), `docs/DEPLOYMENT.md` or `docs/LIVE_RUNBOOK.md` (post-deploy step; choose the file that already lists post-deploy steps)

**Interfaces:**
- Consumes: the finished data (Tasks 6–9).
- Produces: user-visible provenance that matches the seeds.

- [ ] **Step 1: Update `about.ts`**

Replace the four Bihar rows with:

```ts
  { house: 'VS', state: 'Bihar', year: 2025, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Bihar', year: 2020, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Bihar', year: 2015, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
  { house: 'VS', state: 'Bihar', year: 2010, source: ECI_STAT_REPORT, quality: 'real', notes: ['all_candidates'] },
```

and add next to the other source constants: `const ECI_STAT_REPORT = 'ECI statistical report';`.
If `ELECTIONS_IN` or other constants become unused, remove them (lint/typecheck will say).

- [ ] **Step 2: Run the frontend checks**

Run from `frontend/`: `npx vitest run src/model/about && npm run lint && npx tsc --noEmit`
Expected: PASS. If an about test asserts the old Bihar quality, update its expectation to the new rows (the test
pins data, and the data changed on purpose).

- [ ] **Step 3: Update docs**

- `docs/FEATURES.md`: add a "Bihar results data (ECI statistical reports)" entry. It covers the `scraper/src/bihar/` pipeline
  (fetch → parse → cross-check → JSON → seeds), the committed data files and what each is for, the run-once
  corrections seed (frozen; a later correction is `_v2`), `decisions.json`, the two-DB check, and the post-deploy seat
  analysis recompute. Remove Bihar from Known Limitations.
- `CLAUDE.md` → Database Setup seed order: replace "VS results (Bihar newest-first)" with
  "VS results (Bihar: `seed_bihar_parties.sql` → `seed_bihar_corrections_v1.sql` → years newest-first)". Under Key Data Files,
  add `scraper/data/bihar/` (committed ECI-derived JSON, regenerate seeds with `npx ts-node src/bihar/generate-cli.ts`).
- `docs/SEEDING_NEXT_PHASE.md` §2: mark Bihar 2010–2025 done (date, source), and note that TCPD is unreachable and the ECI
  internal cross-check replaces it.
- Post-deploy step (in whichever of `docs/DEPLOYMENT.md` / `docs/LIVE_RUNBOOK.md` already lists post-deploy steps): after the deploy
  that ships these seeds, recompute the seat analysis for the four Bihar elections (`POST /admin/constituencies/analysis/compute/:electionId`
  for each id in `scraper/src/bihar/years.ts`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/model/about docs/FEATURES.md CLAUDE.md docs/SEEDING_NEXT_PHASE.md docs/DEPLOYMENT.md docs/LIVE_RUNBOOK.md
git commit -m "docs: Bihar 2010-2025 now real ECI data (About page, features, seed order, post-deploy step)"
```

(Only stage the runbook/deployment file you actually changed.)
