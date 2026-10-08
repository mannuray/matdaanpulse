# Party Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public party page: `/party/:id` (national view) and `/party/:id?state=XX` (state view), backed by one new endpoint `GET /parties/:id/record`.

**Architecture:** The backend reads stored seat analysis (`election_analysis.data`) for every Finalized VS election and returns the party's row per election (plus lineage-family rows, so the browser can compare across mergers), and for `?state=` the latest election's MLAs, seat flow and regions. The frontend is a studio MVVM page: pure derive (`model/derive/partyRecord.ts`) → page VM (`usePartyPageVM`) → views (`views/party/*`), reusing `PageShell`, `PartyMark`, `Avatar` and `useMapRendering`.

**Tech Stack:** NestJS + Prisma (jest), React + TypeScript + Vite (vitest, Testing Library), Tailwind v4, D3, i18next, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-party-page-design.md`

## Global Constraints

- Vidhan Sabha only; Finalized elections only ("final results only"; no live tallies).
- Routes: `/party/:id` national, `/party/:id?state=<state code>` state view; a party with one contested state opens on its state view.
- Scrolling profile page in the studio look; no accordions or expanders; MLAs list fully shown with a search box.
- Missing profile fields are left out (never "—"); missing photos use the initials avatar.
- Deltas compare only with the previous election in the same state with the same `delimitation`, lineage applied via `comparableParties.ts`; a redraw is a divider where seat Δ stops and vote-share Δ continues.
- Every new string in en / hi / mr / ta; new page keys use the `pty_` prefix.
- Views import only viewmodel types (`npm run lint` MVVM boundaries).
- IND and NOTA never link to a party page.
- Mockup corrections (spec §7): no live bar / studio tag / broadcast footer, no alliance block, no "view all", no ideology chips or registration id, sparklines in party colour, real boundary map, jump links Record · Map · Seat changes · MLAs · Regions, phones put the state unit first.

## Review Focus

1. A party whose record has elections in a state but no unit rows, no regions and no previous comparable election (e.g. AAP in Goa 2022): the state view must show only the sections with data, no empty cards, and the record table with "—" deltas.
2. `?state=` with an unknown or lower-case code (`?state=jh`, `?state=XX`): lower-case must work; unknown must fall back to the national view with the "no results in …" note, never a blank page.
3. A merger inside the comparison window where the predecessor did not contest the earlier election (family row absent): the delta must use only the party's own earlier total, not crash or double-count.
4. Very long MLA lists (UP, 250+) and long state lists: the page must stay fast (no per-row requests) and the search must filter by name and constituency, case-insensitively.
5. A party that exists but has `elections: []` (e.g. a new party): header, lineage and about render with the "No assembly results on MatdaanPulse yet." line; no chips, table or jump links.

Each line has its test in the owning task (Tasks 3, 4, 5).

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/modules/parties/party-record.ts` (create) | pure record builder from loaded rows |
| `backend/src/modules/parties/party-record.spec.ts` (create) | builder unit tests |
| `backend/src/modules/parties/parties.service.ts` (modify) | `record(id, state?)` loader; role photo; lineage source |
| `backend/src/modules/parties/parties.controller.ts` (modify) | `GET :id/record` before `:id` |
| `backend/src/modules/parties/dto/party-response.dto.ts` (modify) | `PartyRecordDto` family; `photo_url`, `source_url` |
| `backend/src/modules/parties/parties.module.ts` (check) | no new imports needed (Prisma only) |
| `backend/src/modules/parties/party-record.db.spec.ts` (create) | record vs analysis summary on local seeds |
| `frontend/src/model/types/index.ts` (modify) | `PartyRecord*` types; `photo_url` on roles; `source_url` on lineage |
| `frontend/src/model/api/party.service.ts` (create) | `getPartyRecord(id, state?)` |
| `frontend/src/model/derive/partyRecord.ts` (create) | headline, state rows, deltas, sparkline, record rows |
| `frontend/src/viewmodels/pages/usePartyPageVM.ts` (create) | fetch, view selection, redirect, search |
| `frontend/src/pages/PartyDetail.tsx` (create) | route component |
| `frontend/src/views/party/page/*.tsx` (create) | page sections |
| `frontend/src/views/party/page/PartyMapCard.tsx` (create) | map via `useMapRendering` |
| `frontend/src/App.tsx` (modify) | route |
| `frontend/src/viewmodels/tiles/usePartyDialogVM.ts`, `views/party/PartyDialog.tsx`, `model/derive/personPage.ts`, `viewmodels/pages/useConstituencyPageVM.ts` (modify) | entry links |
| `frontend/src/i18n/locales/{en,hi,mr,ta}.json` (modify) | `pty_` keys |
| `frontend/e2e/party.spec.ts` (create) | e2e |
| `docs/FEATURES.md`, `CLAUDE.md` (modify) | docs |

---

### Task 1: Role photos and lineage sources on the existing party endpoints

**Files:**
- Modify: `backend/src/modules/parties/parties.service.ts` (`toLineageEvent` ~:10, `findOne` ~:29)
- Modify: `backend/src/modules/parties/dto/party-response.dto.ts` (`LineageEventDto`, `PartyUnitRoleDto`)
- Modify: `frontend/src/model/types/index.ts` (`LineageEvent` ~:57, `PartyUnitRole` ~:67)
- Test: `backend/src/modules/parties/parties.service.spec.ts`, `backend/src/modules/parties/dto/party-response.dto.spec.ts`

**Interfaces:**
- Produces: `PartyUnitRoleDto.photo_url: string | null`; `LineageEventDto.source_url: string | null`; frontend `PartyUnitRole.photo_url?: string | null`, `LineageEvent.source_url?: string | null`.

- [ ] **Step 1: Failing tests.** In `parties.service.spec.ts` add (use the file's `make(over)` helper; the prisma mock must return roles with `persons` and lineage rows with `source_url`):

```ts
it('findOne: roles carry the person photo; lineage carries its source', async () => {
  const svc = make({
    parties: { findUnique: jest.fn().mockResolvedValue({ id: 'BJP', name: 'BJP', color: '#f80' }) },
    party_units: { findMany: jest.fn().mockResolvedValue([{ party_id: 'BJP', state_id: 9, eci_recognition: 'State', office: null, website: null,
      states: { name: 'Jharkhand' }, roles: [{ role: 'state_president', person_id: 'p1', person_name: 'A', from_date: null, to_date: null, persons: { photo_url: '/m/a.jpg' } }] }]) },
    party_lineage: { findMany: jest.fn().mockResolvedValue([{ party_id: 'BJP', predecessor_id: 'JVM', kind: 'merger', effective_date: new Date('2020-02-17'), state_id: 9, is_successor: true, note: null, source_url: 'https://x' }]) },
  });
  const r = await svc.findOne('BJP');
  expect(r.units[0].roles[0].photo_url).toBe('/m/a.jpg');
  expect(r.lineage[0].source_url).toBe('https://x');
});
```

In `party-response.dto.spec.ts` add a case that `plainToInstance(PartyDetailDto, {...role with photo_url, lineage with source_url}, { excludeExtraneousValues: true })` keeps both fields.

- [ ] **Step 2: Run, expect FAIL.** `cd backend && npx jest src/modules/parties` → the new expectations fail (undefined).

- [ ] **Step 3: Implement.**
  - `toLineageEvent`: add `source_url: e.source_url ?? null`.
  - `findOne`: `roles: { include: { persons: { select: { photo_url: true } } } }`; role mapper adds `photo_url: r.persons?.photo_url ?? null`.
  - DTOs: `@Expose() photo_url: string | null;` on `PartyUnitRoleDto`; `@Expose() source_url: string | null;` on `LineageEventDto`.
  - Frontend types: `photo_url?: string | null` on `PartyUnitRole`; `source_url?: string | null` on `LineageEvent`.

- [ ] **Step 4: Run, expect PASS.** `cd backend && npx jest src/modules/parties` and `cd frontend && npx tsc --noEmit -p .`

- [ ] **Step 5: Commit.** `git commit -m "feat(parties): role holder photos and lineage sources on the public party endpoints"`

---

### Task 2: `GET /parties/:id/record`

**Files:**
- Create: `backend/src/modules/parties/party-record.ts`, `backend/src/modules/parties/party-record.spec.ts`, `backend/src/modules/parties/party-record.db.spec.ts`
- Modify: `backend/src/modules/parties/parties.service.ts`, `parties.controller.ts`, `dto/party-response.dto.ts`

**Interfaces:**
- Consumes: `ElectionAnalysis`, `PartyRow`, `FlowRow`, `BreakdownRow` from `backend/src/common/seat-analysis/types.ts`; `manifestBits(raw)` from `backend/src/modules/constituencies/seat-analysis.loader.ts` (returns `{ government: string[] | null, ... }`).
- Produces (JSON, consumed by Task 3):

```ts
interface PartyRecordElection {
  election_id: string; state_id: number; state_code: string; state_name: string; year: number;
  date: string;                 // tentative_next_date (counting day) YYYY-MM-DD, else `${year}-07-01`
  delimitation: string | null;
  contested: number; won: number; votes: number; share: number;
  held: number; gained: number; lost: number; split_gained: number; split_lost: number;
  seats_total: number; largest: boolean; formed_government: boolean | null;
  family: { party_id: string; won: number; share: number }[];   // lineage-family members (not the party) in this election
}
interface PartyRecord {
  party_id: string;
  elections: PartyRecordElection[];   // newest first (date desc)
  lineage: LineageEvent[];             // family events (with source_url), oldest first
  state?: { code: string; election_id: string;
    mlas: { person_id: string | null; name: string; photo_url: string | null; const_id: string; const_name: string; margin: number | null }[];
    flow: { from: string; to: string; seats: number; split: boolean }[];
    regions: { region: string; seats: number; won: number }[] | null };
}
```

Ruling vs spec §2: adds `date` (lineage comparison window) and `family` (needed for "vs BJP + JVM(P)" deltas); `?state` extras are grouped under `state`.

- [ ] **Step 1: Failing builder tests** (`party-record.spec.ts`):

```ts
import { buildPartyRecord, familyIds } from './party-record';

const ev = (party_id: string, predecessor_id: string, kind = 'merger', date = '2020-02-17', state_id: number | null = 9) =>
  ({ party_id, predecessor_id, kind, effective_date: date, state_id, is_successor: true, note: null, source_url: null });
const row = (party_id: string, won: number, share = 10, contested = 50) =>
  ({ party_id, contested, won, votes: share * 1000, share, prev: null, held: 0, gained: 0, lost: 0, split_gained: 0, split_lost: 0 });
const el = (id: string, year: number, parties: any[], extra: any = {}) => ({
  id, state_id: 9, state_code: 'JH', state_name: 'Jharkhand', year, date: `${year}-12-01`, delimitation: '2008',
  seats_total: 81, government: ['BJP'], analysis: { parties: parties, flow: [], breakdowns: { region: [] } }, ...extra,
});

describe('buildPartyRecord', () => {
  it('one row per election the party contested, newest first; largest and formed_government', () => {
    const r = buildPartyRecord('BJP', [el('e14', 2014, [row('BJP', 37), row('JMM', 19)]), el('e19', 2019, [row('BJP', 25), row('JMM', 30)], { government: ['JMM'] })], []);
    expect(r.elections.map(e => e.election_id)).toEqual(['e19', 'e14']);
    expect(r.elections[0]).toMatchObject({ won: 25, largest: false, formed_government: false, seats_total: 81 });
    expect(r.elections[1]).toMatchObject({ won: 37, largest: true, formed_government: true });
  });
  it('skips elections where the party did not contest or analysis is missing; government null without a record', () => {
    const r = buildPartyRecord('BJP', [el('a', 2009, [row('JMM', 18)]), el('b', 2014, [row('BJP', 37)], { government: null }), { ...el('c', 2019, []), analysis: null }], []);
    expect(r.elections.map(e => e.election_id)).toEqual(['b']);
    expect(r.elections[0].formed_government).toBeNull();
  });
  it('family rows: lineage members present in the same election', () => {
    const lineage = [ev('BJP', 'JVM')];
    const r = buildPartyRecord('BJP', [el('e14', 2014, [row('BJP', 37), row('JVM', 8), row('JMM', 19)])], lineage);
    expect(r.elections[0].family).toEqual([{ party_id: 'JVM', won: 8, share: 10 }]);
    expect(r.lineage).toHaveLength(1);
  });
  it('familyIds follows predecessors and successors transitively', () => {
    expect([...familyIds('BJP', [ev('BJP', 'JVM'), ev('JVM', 'JVMX', 'rename', '2006-01-01'), ev('OTHER', 'ZZ')])].sort()).toEqual(['BJP', 'JVM', 'JVMX']);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (module missing): `cd backend && npx jest src/modules/parties/party-record.spec.ts`

- [ ] **Step 3: Implement `party-record.ts`:**

```ts
import type { ElectionAnalysis, PartyRow } from '../../common/seat-analysis/types';

export interface LineageRow { party_id: string; predecessor_id: string; kind: string; effective_date: string; state_id: number | null; is_successor: boolean; note: string | null; source_url: string | null }
export interface LoadedElection {
  id: string; state_id: number; state_code: string; state_name: string; year: number; date: string; delimitation: string | null;
  seats_total: number; government: string[] | null; analysis: Pick<ElectionAnalysis, 'parties' | 'flow' | 'breakdowns'> | null;
}

/** The party and every party linked to it by lineage, transitively (predecessors and successors). */
export function familyIds(partyId: string, lineage: LineageRow[]): Set<string> {
  const ids = new Set([partyId]);
  for (let grew = true; grew;) {
    grew = false;
    for (const e of lineage) {
      if (ids.has(e.party_id) && !ids.has(e.predecessor_id)) { ids.add(e.predecessor_id); grew = true; }
      if (ids.has(e.predecessor_id) && !ids.has(e.party_id)) { ids.add(e.party_id); grew = true; }
    }
  }
  return ids;
}

export function buildPartyRecord(partyId: string, elections: LoadedElection[], lineage: LineageRow[]) {
  const family = familyIds(partyId, lineage);
  const rows = elections.flatMap(e => {
    const parties: PartyRow[] = e.analysis?.parties ?? [];
    const own = parties.find(p => p.party_id === partyId);
    if (!own || own.contested <= 0) return [];
    const top = Math.max(...parties.map(p => p.won));
    return [{
      election_id: e.id, state_id: e.state_id, state_code: e.state_code, state_name: e.state_name, year: e.year, date: e.date,
      delimitation: e.delimitation, contested: own.contested, won: own.won, votes: own.votes, share: own.share,
      held: own.held, gained: own.gained, lost: own.lost, split_gained: own.split_gained, split_lost: own.split_lost,
      seats_total: e.seats_total, largest: own.won > 0 && own.won === top,
      formed_government: e.government ? e.government.includes(partyId) : null,
      family: parties.filter(p => p.party_id !== partyId && family.has(p.party_id)).map(p => ({ party_id: p.party_id, won: p.won, share: p.share })),
    }];
  }).sort((a, b) => b.date.localeCompare(a.date));
  return {
    party_id: partyId,
    elections: rows,
    lineage: lineage.filter(e => family.has(e.party_id) || family.has(e.predecessor_id)).sort((a, b) => a.effective_date.localeCompare(b.effective_date)),
  };
}

/** `?state` extras from the latest election's analysis. */
export function stateExtras(partyId: string, e: LoadedElection) {
  const flow = (e.analysis?.flow ?? []).filter(f => f.from === partyId || f.to === partyId);
  const region = e.analysis?.breakdowns?.region ?? [];
  const regions = region.length ? region.map(r => ({ region: r.group, seats: r.seats, won: r.parties.find(p => p.party_id === partyId)?.won ?? 0 }))
    .sort((a, b) => b.won - a.won) : null;
  return { flow, regions };
}
```

Add tests for `stateExtras` (flow filtered to the party; regions null when empty; sorted by won) and run them RED first, then GREEN.

- [ ] **Step 4: Service + controller + DTO.**

`parties.service.ts`:

```ts
async record(id: string, stateCode?: string) {
  const party = await this.prisma.parties.findUnique({ where: { id }, select: { id: true } });
  if (!party) throw new PartyNotFoundException(id);
  const els = await this.prisma.elections.findMany({
    where: { type: 'VS', status: 'Finalized', state_id: { not: null } },
    select: { id: true, state_id: true, year: true, tentative_next_date: true, delimitation: true, manifest_url: true,
      states: { select: { code: true, name: true } }, election_analysis: { select: { data: true } }, _count: { select: { constituencies: true } } },
  });
  const lineageRows = (await this.prisma.party_lineage.findMany()).map(toLineageEvent);
  const loaded: LoadedElection[] = els.map(e => ({
    id: e.id, state_id: e.state_id!, state_code: e.states!.code, state_name: e.states!.name, year: e.year,
    date: e.tentative_next_date ? e.tentative_next_date.toISOString().slice(0, 10) : `${e.year}-07-01`,
    delimitation: e.delimitation, seats_total: e._count.constituencies,
    government: manifestBits(e.manifest_url).government, analysis: (e.election_analysis?.data ?? null) as any,
  }));
  const rec = buildPartyRecord(id, loaded, lineageRows);
  if (!stateCode) return rec;
  const latest = rec.elections.find(e => e.state_code.toUpperCase() === stateCode.toUpperCase());
  if (!latest) return rec;
  const winners = await this.prisma.results.findMany({
    where: { election_id: latest.election_id, status: 'WON', candidates: { party_id: id } },
    select: { margin: true, const_id: true, constituencies: { select: { name: true } }, candidates: { select: { name: true, person_id: true, persons: { select: { photo_url: true } } } } },
  });
  const mlas = winners.map(w => ({ person_id: w.candidates.person_id, name: w.candidates.name, photo_url: w.candidates.persons?.photo_url ?? null,
    const_id: w.const_id, const_name: w.constituencies.name, margin: w.margin })).sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0));
  return { ...rec, state: { code: latest.state_code, election_id: latest.election_id, mlas, ...stateExtras(id, loaded.find(l => l.id === latest.election_id)!) } };
}
```

Check the exact Prisma relation names (`states`, `election_analysis`, `constituencies`, `candidates`, `persons`) against `schema.prisma` and adjust; ledger any rename. `manifestBits` import from `../constituencies/seat-analysis.loader` (pure function; no module import needed). Map `toLineageEvent` dates to `YYYY-MM-DD` as `findLineage` does.

Controller (before `@Get(':id')`):

```ts
@Get(':id/record')
@UseInterceptors(new MapToDtoInterceptor(PartyRecordDto))
record(@Param('id') id: string, @Query('state') state?: string) { return this.partiesService.record(id, state); }
```

DTOs in `party-response.dto.ts`: `PartyRecordFamilyDto`, `PartyRecordElectionDto`, `PartyRecordMlaDto`, `PartyRecordFlowDto`, `PartyRecordRegionDto`, `PartyRecordStateDto`, `PartyRecordDto`, every field `@Expose()`, nested arrays with `@Type(() => …)`, matching the interface above field by field.

Service unit test (`parties.service.spec.ts`): `record` of an unknown id throws `PartyNotFoundException`; with a mocked election + analysis returns one row; with `state='jh'` (lower case) returns `state.mlas` from mocked `results.findMany`, sorted by margin.

- [ ] **Step 5: DB test** `party-record.db.spec.ts` (copy the skip pattern of `modules/constituencies/seat-analysis.db.spec.ts`): build `PartiesService` on the real Prisma; `record('BJP','JH')`; take `elections[0]`; compare `won`, `contested`, `share` with `prisma.election_analysis.findUnique({ where: { election_id } }).data.parties.find(BJP)`; expect `state.mlas.length === elections[0].won`.

- [ ] **Step 6: Run.** `cd backend && npx jest src/modules/parties && npm run test:db -- party-record` → PASS. `curl -s localhost:3082/api/v1/parties/BJP/record?state=JH | head -c 400` (backend restarted) shows rows.

- [ ] **Step 7: Commit.** `git commit -m "feat(parties): GET /parties/:id/record (per-election record from stored seat analysis; MLAs, flow and regions for a state)"`

---

### Task 3: Frontend types, API and the pure derive

**Files:**
- Modify: `frontend/src/model/types/index.ts`
- Create: `frontend/src/model/api/party.service.ts`, `frontend/src/model/derive/partyRecord.ts`, `frontend/src/model/derive/__tests__/partyRecord.test.ts`

**Interfaces:**
- Consumes: Task 2 JSON; `carryForward(events, partyId, fromDate, toDate, stateId): string` from `model/derive/comparableParties.ts`.
- Produces:

```ts
// model/types: PartyRecordElection, PartyRecord (exactly Task 2's interfaces)
export function getPartyRecord(id: string, state?: string): Promise<PartyRecord>;   // party.service.ts, via apiFetch
export interface Delta { seats: number | null; share: number; vsLabel: string | null }  // seats null across a redraw
export function previousComparable(rows: PartyRecordElection[], row: PartyRecordElection): PartyRecordElection | null;
export function deltaOf(partyId: string, rows: PartyRecordElection[], row: PartyRecordElection, events: LineageEvent[], nameOf: (id: string) => string): Delta | null;
export function latestByState(rec: PartyRecord): PartyRecordElection[];          // one per state, sorted by won desc
export interface Headline { won: number; seats: number; statesWon: number; statesContested: number; governs: number | null; largest: number }
export function headline(rec: PartyRecord): Headline;
export function sparkline(rec: PartyRecord, stateId: number): number[];           // won, oldest → newest
export type RecordLine = { kind: 'election'; row: PartyRecordElection; delta: Delta | null }
  | { kind: 'event'; event: LineageEvent } | { kind: 'redraw'; delimitation: string | null; year: number };
export function recordLines(partyId: string, rec: PartyRecord, stateId: number, nameOf: (id: string) => string): RecordLine[];  // newest first
```

- [ ] **Step 1: Failing tests** (`partyRecord.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { previousComparable, deltaOf, latestByState, headline, sparkline, recordLines } from '../partyRecord';
import type { PartyRecord, PartyRecordElection, LineageEvent } from '../../types';

const e = (id: string, state_id: number, year: number, won: number, over: Partial<PartyRecordElection> = {}): PartyRecordElection => ({
  election_id: id, state_id, state_code: state_id === 9 ? 'JH' : 'GA', state_name: state_id === 9 ? 'Jharkhand' : 'Goa', year, date: `${year}-12-01`,
  delimitation: '2008', contested: 60, won, votes: 1, share: 30, held: 0, gained: 0, lost: 0, split_gained: 0, split_lost: 0,
  seats_total: 81, largest: false, formed_government: null, family: [], ...over });
const merger: LineageEvent = { party_id: 'BJP', predecessor_id: 'JVM', kind: 'merger', effective_date: '2020-02-17', state_id: 9, is_successor: true, note: null };
const rec = (elections: PartyRecordElection[], lineage: LineageEvent[] = []): PartyRecord => ({ party_id: 'BJP', elections, lineage });
const nameOf = (id: string) => (id === 'JVM' ? 'JVM(P)' : id);

describe('partyRecord', () => {
  it('previous comparable: same state and delimitation only', () => {
    const rows = [e('a', 9, 2024, 21), e('b', 9, 2019, 25), e('g', 3, 2022, 20), e('c', 9, 2005, 30, { delimitation: '1976' })];
    expect(previousComparable(rows, rows[0])?.election_id).toBe('b');
    expect(previousComparable(rows, rows[1])).toBeNull();   // only a different delimitation before it
  });
  it('delta adds merged predecessors to the earlier total and names them', () => {
    const rows = [e('a', 9, 2024, 21, { share: 33.2 }), e('b', 9, 2019, 25, { share: 33.4, family: [{ party_id: 'JVM', won: 3, share: 5.5 }] })];
    expect(deltaOf('BJP', rows, rows[0], [merger], nameOf)).toEqual({ seats: -7, share: 33.2 - 38.9, vsLabel: 'BJP + JVM(P) 2019' });
  });
  it('delta without a family row uses only the party’s own total', () => {
    const rows = [e('a', 9, 2024, 21), e('b', 9, 2019, 25)];
    expect(deltaOf('BJP', rows, rows[0], [merger], nameOf)).toEqual({ seats: -4, share: 0, vsLabel: null });
  });
  it('across a redraw: seats null, vote share continues', () => {
    const rows = [e('a', 9, 2024, 21, { delimitation: '2023', share: 35 }), e('b', 9, 2019, 25, { share: 30 })];
    expect(deltaOf('BJP', rows, rows[0], [], nameOf)).toEqual({ seats: null, share: 5, vsLabel: null });
  });
  it('latest per state sorted by won; headline sums', () => {
    const r = rec([e('a', 9, 2024, 21, { formed_government: false, largest: false }), e('b', 9, 2019, 25), e('g', 3, 2022, 20, { seats_total: 40, formed_government: true, largest: true })]);
    expect(latestByState(r).map(x => x.election_id)).toEqual(['a', 'g']);
    expect(headline(r)).toEqual({ won: 41, seats: 121, statesWon: 2, statesContested: 2, governs: 1, largest: 1 });
  });
  it('governs is null when no latest election has a government record', () => {
    expect(headline(rec([e('a', 9, 2024, 21)])).governs).toBeNull();
  });
  it('sparkline oldest → newest; record lines put events and redraws in place', () => {
    const r = rec([e('a', 9, 2024, 21), e('b', 9, 2019, 25), e('c', 9, 2005, 30, { delimitation: '1976' })], [merger]);
    expect(sparkline(r, 9)).toEqual([30, 25, 21]);
    expect(recordLines('BJP', r, 9, nameOf).map(l => l.kind)).toEqual(['election', 'event', 'election', 'redraw', 'election']);
  });
  it('a party with no elections: empty everything, no crash', () => {
    const r = rec([]);
    expect(latestByState(r)).toEqual([]);
    expect(headline(r)).toEqual({ won: 0, seats: 0, statesWon: 0, statesContested: 0, governs: null, largest: 0 });
  });
});
```

- [ ] **Step 2: Run, expect FAIL.** `cd frontend && npx vitest run src/model/derive/__tests__/partyRecord.test.ts`

- [ ] **Step 3: Implement** `partyRecord.ts`:

```ts
import { carryForward } from './comparableParties';
import type { LineageEvent, PartyRecord, PartyRecordElection } from '../types';

export interface Delta { seats: number | null; share: number; vsLabel: string | null }
export interface Headline { won: number; seats: number; statesWon: number; statesContested: number; governs: number | null; largest: number }
export type RecordLine = { kind: 'election'; row: PartyRecordElection; delta: Delta | null }
  | { kind: 'event'; event: LineageEvent } | { kind: 'redraw'; delimitation: string | null; year: number };

const older = (rows: PartyRecordElection[], row: PartyRecordElection) =>
  rows.filter(r => r.state_id === row.state_id && r.date < row.date).sort((a, b) => b.date.localeCompare(a.date));

export function previousComparable(rows: PartyRecordElection[], row: PartyRecordElection): PartyRecordElection | null {
  const prev = older(rows, row)[0];
  return prev && prev.delimitation != null && prev.delimitation === row.delimitation ? prev : null;
}

export function deltaOf(partyId: string, rows: PartyRecordElection[], row: PartyRecordElection, events: LineageEvent[], nameOf: (id: string) => string): Delta | null {
  const prev = older(rows, row)[0];
  if (!prev) return null;
  const merged = prev.family.filter(f => carryForward(events, f.party_id, prev.date, row.date, row.state_id) === partyId);
  const prevWon = prev.won + merged.reduce((s, f) => s + f.won, 0);
  const prevShare = prev.share + merged.reduce((s, f) => s + f.share, 0);
  const sameBoundaries = prev.delimitation != null && prev.delimitation === row.delimitation;
  return {
    seats: sameBoundaries ? row.won - prevWon : null,
    share: row.share - prevShare,
    vsLabel: merged.length ? `${[partyId, ...merged.map(f => f.party_id)].map(nameOf).join(' + ')} ${prev.year}` : null,
  };
}

export function latestByState(rec: PartyRecord): PartyRecordElection[] {
  const seen = new Map<number, PartyRecordElection>();
  for (const r of rec.elections) if (!seen.has(r.state_id)) seen.set(r.state_id, r);   // elections are newest first
  return [...seen.values()].sort((a, b) => b.won - a.won || a.state_name.localeCompare(b.state_name));
}

export function headline(rec: PartyRecord): Headline {
  const latest = latestByState(rec);
  const recorded = latest.filter(r => r.formed_government != null);
  return {
    won: latest.reduce((s, r) => s + r.won, 0), seats: latest.reduce((s, r) => s + r.seats_total, 0),
    statesWon: latest.filter(r => r.won > 0).length, statesContested: latest.length,
    governs: recorded.length ? recorded.filter(r => r.formed_government).length : null,
    largest: latest.filter(r => r.largest).length,
  };
}

export function sparkline(rec: PartyRecord, stateId: number): number[] {
  return rec.elections.filter(r => r.state_id === stateId).map(r => r.won).reverse();
}

export function recordLines(partyId: string, rec: PartyRecord, stateId: number, nameOf: (id: string) => string): RecordLine[] {
  const rows = rec.elections.filter(r => r.state_id === stateId);   // newest first
  const out: RecordLine[] = [];
  rows.forEach((row, i) => {
    out.push({ kind: 'election', row, delta: deltaOf(partyId, rows, row, rec.lineage, nameOf) });
    const prev = rows[i + 1];
    if (!prev) return;
    for (const ev of rec.lineage.filter(ev => (ev.state_id == null || ev.state_id === stateId) && ev.effective_date > prev.date && ev.effective_date <= row.date).reverse())
      out.push({ kind: 'event', event: ev });
    if (prev.delimitation !== row.delimitation) out.push({ kind: 'redraw', delimitation: row.delimitation, year: row.year });
  });
  return out;
}
```

Fix the redraw test expectation to the order this produces if the event and redraw fall between the same pair (the test pair 2019/2005 has only the redraw; 2024/2019 only the event). `party.service.ts`:

```ts
import { apiFetch } from './api-client';
import type { PartyRecord } from '../types';
export const getPartyRecord = (id: string, state?: string) =>
  apiFetch<PartyRecord>(`/parties/${encodeURIComponent(id)}/record${state ? `?state=${encodeURIComponent(state)}` : ''}`);
```

- [ ] **Step 4: Run, expect PASS**, then `npx vitest run && npm run lint`.

- [ ] **Step 5: Commit.** `git commit -m "feat(party page): record types, API and derive (headline, per-state latest, lineage-aware deltas, record lines)"`

---

### Task 4: Page VM, route and the national view

**Files:**
- Create: `frontend/src/viewmodels/pages/usePartyPageVM.ts`, `frontend/src/pages/PartyDetail.tsx`, `frontend/src/views/party/page/{PartyPageView,PartyHeader,HeadlineStrip,StateChips,StatesTable,LineageCard,AboutCard,Sparkline}.tsx`
- Test: `frontend/src/viewmodels/__tests__/partyPageVM.test.tsx`, `frontend/src/views/__tests__/partyPage.test.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/i18n/locales/*.json`

**Interfaces:**
- Consumes: `getParty(id)` (geo.service), `getPartyRecord` (Task 3), derive functions (Task 3), `useApi(fetcher, deps, {key})`.
- Produces:

```ts
export interface PartyPageVM {
  status: 'loading' | 'error' | 'notFound' | 'ready';
  party: PartyDetail | null;
  mark: string | null; color: string;
  view: 'national' | 'state';
  stateCode: string | null; missingState: string | null;     // ?state= the party never contested
  chips: { code: string; name: string; href: string; active: boolean }[];   // first "All states" href=/party/:id
  headline: Headline;
  states: { code: string; name: string; year: number; won: number; contested: number; seatsTotal: number; share: number;
            delta: Delta | null; spark: number[]; president: { name: string; personId: string | null; photo: string | null } | null; href: string }[];
  lineage: LineageEvent[];
  noResults: boolean;
  stateView: PartyStateView | null;                        // Task 5
  recordError: boolean; retry(): void;
  personHref(id: string): string; constHref(electionId: string, constId: string): string;
}
```

- [ ] **Step 1: Failing VM tests** (mock `model/api/geo.service` `getParty` and `model/api/party.service` `getPartyRecord`; `MemoryRouter` with `initialEntries`):
  - national: chips start with "All states" active; `states` sorted by won with `href` `/party/BJP?state=JH`;
  - `?state=jh` (lower case) → `view: 'state'`, `stateCode: 'JH'`;
  - `?state=KL` not contested → `view: 'national'`, `missingState: 'Kerala'` if the name is known from units else `'KL'`;
  - a party with one contested state and no `?state` → navigates to `?state=<code>` (`replace`);
  - `getParty` 404 → `status: 'notFound'`; `getPartyRecord` rejects → `status: 'ready'`, `recordError: true`;
  - `elections: []` → `noResults: true`, `chips` empty.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement the VM** following `usePersonPageVM.ts` (useApi with keys `party_${id}`, `party_record_${id}_${state ?? ''}`; `useSearchParams` for `state`; `useNavigate` for the one-state redirect in an effect; `useMemo` for derived fields; the president is the unit role `state_president` with `to_date == null`).

- [ ] **Step 4: Failing view tests** (`partyPage.test.tsx`, fixed VM objects in `MemoryRouter`, `import '../../i18n'`):
  - header shows name, abbreviation, recognition, founded/HQ only when present (render with `founded_year: null` → no "Founded" text);
  - headline "Holds 41 of 121 seats" and the caption "at each state's latest election"; governs cell shows "not recorded" when `governs: null`;
  - states table rows link to `/party/BJP?state=JH`; a "—" when `delta.seats === null`;
  - `noResults` shows "No assembly results on MatdaanPulse yet." and no table;
  - no element with text "View all".

- [ ] **Step 5: Implement the views** (Tailwind in `src/views`, so no `@source` line): `PageShell back={{ href: '/', label: t('back') }}` wrapper; `PartyHeader` (glow `style={{ background: color }}` blurred like PersonPageView :214, `PartyMark size={64}`); `HeadlineStrip` (4 cells, `grid-cols-2 lg:grid-cols-4`); `StateChips` (horizontal scroll row of `Link`s); `StatesTable` (`<table>` at `lg`, stacked rows below via `lg:hidden` / `hidden lg:table`); `Sparkline` (SVG 80×24 polyline, stroke = party colour); `LineageCard` (timeline list, "source ↗" link when `source_url`); `AboutCard` (`description`, plus an "Image credits" link to the public credits list (`/about`, where `GET /credits` is shown) — the per-image credit is not on `/parties/:id`; ruling vs spec §3.6, cost: one extra click). Route: `<Route path="/party/:id" element={<PartyDetail />} />`; `PartyDetail` = `<PartyPageView vm={usePartyPageVM(id)} />`.

- [ ] **Step 6: i18n** `pty_` keys in all four locales: `pty_not_found`, `pty_final_only`, `pty_holds` ("Holds {{won}} of {{seats}} seats"), `pty_latest_caption`, `pty_in_states`, `pty_contested_in`, `pty_governs`, `pty_not_recorded`, `pty_largest_in`, `pty_all_states`, `pty_state`, `pty_latest`, `pty_won_contested`, `pty_vote_share`, `pty_change`, `pty_trend`, `pty_president`, `pty_lineage`, `pty_source`, `pty_about`, `pty_image_credits`, `pty_no_results`, `pty_missing_state` ("{{party}} has no results in {{state}} yet"), `pty_retry`, `pty_founded`, `pty_hq`, `pty_leader`, `pty_website`.

- [ ] **Step 7: Run** `npx vitest run && npm run lint && npx tsc --noEmit -p .` → PASS. Open `http://localhost:3080/party/BJP` and check it renders against the local backend.

- [ ] **Step 8: Commit.** `git commit -m "feat(party page): route, view-model and national view (header, headline, chips, states table, lineage, about)"`

---

### Task 5: State view sections

**Files:**
- Create: `frontend/src/views/party/page/{StateHeaderExtra,JumpLinks,UnitCard,RecordCard,RecordChart,SeatChangesCard,MlasCard,RegionsCard}.tsx`
- Modify: `usePartyPageVM.ts` (`stateView`), `PartyPageView.tsx`, locales
- Test: extend `partyPageVM.test.tsx`, `partyPage.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface PartyStateView {
  code: string; name: string; electionId: string; year: number; won: number; seatsTotal: number; share: number; delta: Delta | null;
  recognition: string | null; office: string | null; website: string | null;
  president: RoleView | null; leader: RoleView | null; pastPresidents: { name: string; from: string | null; to: string | null }[];
  lines: RecordLine[]; chart: { year: number; won: number; share: number }[];   // oldest → newest
  changes: { held: number; gained: number; lost: number; gainedFrom: { party: string; seats: number; split: boolean }[];
             lostTo: { party: string; seats: number; split: boolean }[] } | null;   // null: first election on these boundaries
  mlas: { personId: string | null; name: string; photo: string | null; constId: string; constName: string; margin: number | null }[];
  query: string; setQuery(q: string): void; filteredMlas: PartyStateView['mlas'];
  regions: { region: string; seats: number; won: number }[] | null;
  sections: ('record' | 'map' | 'changes' | 'mlas' | 'regions')[];             // jump links, hidden ones dropped
}
interface RoleView { name: string; personId: string | null; photo: string | null; since: string | null }
```

`changes` is null when `previousComparable(rows, latest)` is null. `sections` always has 'record' and 'map'; 'changes' when `changes`; 'mlas' when `mlas.length`; 'regions' when `regions?.length`.

- [ ] **Step 1: Failing VM tests:** `stateView.filteredMlas` filters case-insensitively by name and constituency (`setQuery('ranchi')`); `changes` null without a comparable earlier election; `sections` drops 'regions' when `regions` is null; AAP-in-Goa-like fixture (no units, no regions, one election) → `president: null`, `sections: ['record','map','mlas']` (Review Focus 1).

- [ ] **Step 2: Run FAIL, implement the VM part, run PASS.**

- [ ] **Step 3: Failing view tests:** jump links render one link per `sections` entry with `href="#pty-<section>"`; `UnitCard` hidden when no president, leader or past holders; record table shows a divider row text "New boundaries from 2023" for a redraw line and the event text for an event line; a 300-MLA fixture renders all rows with no "show more" control (Review Focus 4); search input filters.

- [ ] **Step 4: Implement the views.** Two-column grid `lg:grid-cols-[minmax(0,1fr)_380px]`, left: RecordCard, `PartyMapCard` slot (Task 6; render a placeholder card `id="pty-map"` until then), MlasCard; right: UnitCard, SeatChangesCard, RegionsCard. Phone order via `order-*` classes: unit first. `JumpLinks`: sticky `top-[52px]` strip of anchor links; active link via `IntersectionObserver` on section ids (`pty-record`, `pty-map`, `pty-changes`, `pty-mlas`, `pty-regions`), guarded for jsdom (`typeof IntersectionObserver !== 'undefined'`). `RecordChart`: SVG bars (won) + polyline (share), party colour, no library.

- [ ] **Step 5: i18n** keys: `pty_jump_record`, `pty_jump_map`, `pty_jump_changes`, `pty_jump_mlas`, `pty_jump_regions`, `pty_unit`, `pty_state_president`, `pty_legislature_leader`, `pty_since`, `pty_past_presidents`, `pty_record`, `pty_new_boundaries` ("New boundaries from {{year}}"), `pty_vs` ("vs {{label}}"), `pty_changes_at` ("Seat changes at {{year}}"), `pty_held`, `pty_gained`, `pty_lost`, `pty_gained_from`, `pty_lost_to`, `pty_split`, `pty_first_on_boundaries`, `pty_mlas`, `pty_search_mlas` ("Search {{count}} MLAs"), `pty_margin`, `pty_regions`, `pty_seats_of` ("{{won}} / {{seats}} seats"), lineage event texts `pty_event_merger` ("{{from}} merged into {{to}}"), `pty_event_split`, `pty_event_rename`, `pty_event_breakaway`.

- [ ] **Step 6: Run** `npx vitest run && npm run lint` → PASS; check `/party/BJP?state=JH` and `/party/JMM` locally.

- [ ] **Step 7: Commit.** `git commit -m "feat(party page): state view (unit, election record with lineage events and redraws, seat changes, MLAs with search, regions, jump links)"`

---

### Task 6: Map card

**Files:**
- Create: `frontend/src/views/party/page/PartyMapCard.tsx`, `frontend/src/model/derive/partyMap.ts`, tests
- Modify: `usePartyPageVM.ts` (map data), `PartyPageView.tsx`

**Interfaces:**
- Consumes: `getManifest(electionId)` and `ElectionService.getGeoJSON(url)` (`model/api/election.service.ts`); `getResults`-style seat list: reuse the endpoint the dashboard uses for an election's per-seat winners (the per-election results call the dashboard uses (find it in `model/api/election.service.ts`; it returns `ResultRow[]`) — ledger its exact name); `matchFeaturesToSeats(features, seats, { byNumber })` (`model/geo/featureMatch.ts`); `useMapRendering(props)` (`views/map/useMapRendering.ts`).
- Produces: `partySeatFills(partyId, rows: ResultRow[], color: string): Map<string, { color: string; opacity: number }>` — won → party colour opacity 1; contested and lost → party colour opacity 0.25; not contested → `var(--color-map-pending)`; VM `map: { electionId; year; years: { electionId: string; year: number }[]; setElection(id: string); status: 'loading'|'ready'|'error'; features; seatOf; fills; seatName(id): string } | null`.

- [ ] **Step 1: Failing test** for `partySeatFills` (won / lost / not contested) in `model/derive/__tests__/partyMap.test.ts`.
- [ ] **Step 2: Run FAIL, implement, PASS.**
- [ ] **Step 3: VM:** on state view, load the selected election's manifest (`geo.map_url`), geojson and result rows; year picker lists the state's record elections. Test with mocked services: switching year refetches.
- [ ] **Step 4: View:** `PartyMapCard` draws with `useMapRendering` (same props the dashboard passes), applies `fills` to `path.pc` like `MapCanvas` (fill, fill-opacity, `data-seat`), tooltip with the seat name and result, click → `navigate(constHref(electionId, constId))`. Test: renders `path.pc[data-seat]` for a 2-feature fixture with the right fills; click calls navigate.
- [ ] **Step 5: Run** `npx vitest run && npm run lint` → PASS; check the map on `/party/BJP?state=JH`, then pick 2019.
- [ ] **Step 6: Commit.** `git commit -m "feat(party page): where it won map (won / contested / not contested, year picker, seat links)"`

---

### Task 7: Entry links, e2e and docs

**Files:**
- Modify: `frontend/src/viewmodels/tiles/usePartyDialogVM.ts`, `frontend/src/views/party/PartyDialog.tsx`, `frontend/src/model/derive/personPage.ts` (:37 `partyHref`), `frontend/src/viewmodels/pages/useConstituencyPageVM.ts` (:126 `partyHref`), `frontend/src/views/person/PersonPageView.tsx` (header chip :239-242)
- Create: `frontend/e2e/party.spec.ts`
- Modify: `docs/FEATURES.md`, `CLAUDE.md`, locales (`party_full_page`)

- [ ] **Step 1: Failing tests:**
  - `usePartyDialogVM` exposes `pageHref: '/party/BJP?state=BR'` (from `src.election.state?.code`); `PartyDialog` renders a "Full party page →" link with that href;
  - `personPage` derive: `partyHref('BJP')` → `/party/BJP`, `partyHref('IND')` and `partyHref('NOTA')` → `null`;
  - constituency VM `partyHref` same rule;
  - person page header party chip is a link to `/party/<id>`.
- [ ] **Step 2: Run FAIL, implement, PASS** (`npx vitest run`). Update the existing tests that asserted `/election/…?party=` hrefs (they encode the old behaviour; the spec changes it).
- [ ] **Step 3: e2e** `frontend/e2e/party.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('party national view: states table and a chip to the state view', async ({ page }) => {
  await page.goto('/party/BJP');
  await expect(page.getByRole('heading', { level: 1, name: /Bharatiya Janata Party/i })).toBeVisible();
  await expect(page.getByText(/at each state's latest election/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Jharkhand/ }).first()).toBeVisible();
  await page.getByRole('link', { name: /Jharkhand/ }).first().click();
  await expect(page).toHaveURL(/\/party\/BJP\?state=JH/);
  await page.screenshot({ path: 'e2e/artifacts/party/national-desktop.png', fullPage: true });
});

test('party state view: record, map, MLAs search', async ({ page }) => {
  await page.goto('/party/BJP?state=JH');
  await expect(page.locator('#pty-record')).toBeVisible();
  await expect(page.locator('#pty-map path.pc[data-seat]').first()).toBeAttached({ timeout: 20_000 });
  const search = page.getByRole('searchbox');
  const before = await page.locator('#pty-mlas li').count();
  await search.fill('zzzz-no-match');
  await expect(page.locator('#pty-mlas li')).toHaveCount(0);
  await search.fill('');
  await expect(page.locator('#pty-mlas li')).toHaveCount(before);
  await page.screenshot({ path: 'e2e/artifacts/party/state-desktop.png', fullPage: true });
});

test('a one-state party opens on its state view', async ({ page }) => {
  await page.goto('/party/JMM');
  await expect(page).toHaveURL(/\/party\/JMM\?state=JH/);
});

test('unknown party: not found page', async ({ page }) => {
  await page.goto('/party/NOPE-PARTY');
  await expect(page.getByText(/Party not found/)).toBeVisible();
});

test('phone: national and state views', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/party/BJP');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({ path: 'e2e/artifacts/party/national-mobile.png', fullPage: true });
  await page.goto('/party/BJP?state=JH');
  await expect(page.locator('#pty-record')).toBeVisible();
  await page.screenshot({ path: 'e2e/artifacts/party/state-mobile.png', fullPage: true });
});
```

Run: `cd frontend && npx playwright test e2e/party.spec.ts` (dev servers running) → PASS; review the screenshots.
- [ ] **Step 4: Docs.** FEATURES.md: a "Party page (2026-10)" section (routes, endpoint, sections, entry links). CLAUDE.md frontend bullet: add the party page (`/party/:id`, `?state=`) beside the constituency and person pages; backend: `GET /parties/:id/record`.
- [ ] **Step 5: Run the whole suites** `cd frontend && npx vitest run && npm run lint`, `cd backend && npm run test:unit` → PASS.
- [ ] **Step 6: Commit.** `git commit -m "feat(party page): entry links from the party dialog, person and constituency pages; e2e; docs"`
