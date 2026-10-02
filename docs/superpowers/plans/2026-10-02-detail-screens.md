# Detail Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show party logos across the public site, replace the "seat click opens the map" behaviour with a seat dialog, add a party dialog, and rebuild the constituency and person pages in the studio style with the backend data they need.

**Architecture:** Backend adds fields to two existing public endpoints (constituency detail, person profile) and extends the seat-history analysis; no migration. Frontend follows the existing MVVM split: pure derivations in `src/model/derive`, data hooks in `src/viewmodels/data`, one VM hook per screen in `src/viewmodels/tiles` (dialogs) or `src/viewmodels/pages` (pages), presentational components in `src/views`. Live numbers always come from the versioned snapshot the dashboard already polls; detail endpoints give slow-changing data.

**Tech Stack:** NestJS + Prisma + Jest (backend); React 19 + TypeScript + Vite + Vitest + Testing Library + Playwright, Tailwind v4, Radix Dialog, d3 (frontend).

**Spec:** `docs/superpowers/specs/2026-10-02-detail-screens-design.md` (+ `docs/design/frontend/NOTES.md`, which lists required corrections to each Stitch screen; screenshots and Stitch HTML in `docs/design/frontend/`).

## Global Constraints

- Party mark order: `symbol_url` → `eci_symbol_url` → colour dot; an image that fails to load also falls back to the dot (spec D1).
- Colour stays wherever colour is the data: map fills, scoreboard blocs, vote-share bars, chart legends (D2).
- Live votes/status/margin come only from the dashboard's versioned snapshot (`useLiveSnapshot` / `src.data`), never from a new per-click uncached request (D5).
- Caste and religion are never sent by a public endpoint nor rendered (D6).
- No copy claiming ECI/ADR sourcing, live ECI feeds, AI analysis, confidence scores, ETAs or invented narratives; hide fields with no data instead of "—" (except empty table cells) (D9).
- Constituency and person pages scroll; the dashboard stays non-scrolling (D7).
- MVVM import rule (`npm run lint`): views may not import `src/model/api`, `src/model/derive`, `src/model/live`, `src/viewmodels/data` or `src/pages`; viewmodels may not import views.
- Every user-visible string goes through i18next; add keys to `frontend/src/i18n/locales/en.json` and `hi.json` (mr/ta fall back to en).
- Brand spelling: MatdaanPulse.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A seat with zero votes counted** (Upcoming / first round): share must be 0, no `NaN%`, no status pill, margin hidden — pinned in Task 8 (`buildSeatView` zero-vote test).
2. **Party without logo and ECI symbol, an independent (`party_id` null) and NOTA (`party_id` 'NOTA')**: dot fallback, no party dialog for null/NOTA, NOTA sorted last and never linked to a person page — pinned in Tasks 4, 8 and 11.
3. **Broken image URL** (deleted Blob, 404 `/symbols/...`): falls back to the dot / initials without a broken-image icon — pinned in Task 5 (`PartyMark` error test) and Task 9 (photo fallback).
4. **Unknown `?party=` / `?seat=` ids in a pasted link**: dropped from state and URL, nothing opens — pinned in Task 7.
5. **Person with no contests, no DOB and no affidavit**: header still renders; stats show 0 contests, win rate hidden, affidavit tile hidden — pinned in Task 12.

---

## File map

Backend
- Modify `backend/src/modules/constituencies/strategies/analysis-strategy.interface.ts` — add `SeatStats`, `seatStatsByElection`.
- Modify `backend/src/modules/constituencies/constituencies.service.ts` — winners get `votes`; build `seatStatsByElection`.
- Modify `backend/src/modules/constituencies/strategies/seat-history.strategy.ts` — `vote_share`, `runner_up`, `runner_up_party`.
- Create `backend/src/modules/constituencies/strategies/seat-history.strategy.spec.ts`.
- Modify `backend/src/modules/results/results.service.ts` — `getConstituencyDetail` fields.
- Create `backend/src/modules/results/dto/constituency-detail.dto.ts`, `backend/src/modules/results/constituency-detail.spec.ts`.
- Modify `backend/src/modules/elections/elections.controller.ts` — DTO interceptor on the detail route.
- Modify `backend/src/modules/candidates/persons.service.ts`, `dto/candidate-response.dto.ts`, `persons.service.spec.ts`.

Frontend
- `src/model/types/index.ts` — types.
- `src/model/derive/partyMeta.ts` (+ test) — `partyMark`, `buildPartyMeta`.
- `src/model/api/geo.service.ts` — `getParty`.
- `src/views/ui/PartyMark.tsx`, `src/views/ui/format.ts`, `src/views/ui/DetailDialog.tsx` (+ tests).
- `src/viewmodels/data/usePartyMeta.ts`; `src/viewmodels/sources/useDashboardSources.ts`; `src/viewmodels/__tests__/fixtures.ts`.
- `src/viewmodels/store/dashboardStore.ts`, `DashboardStoreProvider.tsx` (+ tests).
- `src/model/derive/seatView.ts` (+ test).
- `src/viewmodels/tiles/useSeatDialogVM.ts`, `src/views/seat/SeatDialog.tsx` (+ tests); delete `useSeatPanelVM.ts`, `views/map/SeatPanel.tsx`.
- `src/model/derive/partyElection.ts` (+ test), `src/viewmodels/tiles/usePartyDialogVM.ts`, `src/views/party/PartyDialog.tsx` (+ tests).
- `src/viewmodels/tiles/useStandingsVM.ts`, `useLeadersVM.ts`, `useMapVM.ts`; `src/views/dashboard/StandingsTile.tsx`, `LeadersStrip.tsx`, `DashboardGrid.tsx`; `src/views/map/MapTile.tsx`, `MapCanvas.tsx`; `src/pages/StudioDashboard.tsx`.
- `src/model/derive/personPage.ts` (+ test), `src/viewmodels/pages/useConstituencyPageVM.ts`, `usePersonPageVM.ts`, `src/views/constituency/*`, `src/views/person/*`, `src/views/page/PageShell.tsx`; rewrite `src/pages/ConstituencyDetail.tsx`, `src/pages/PersonDetail.tsx`.
- `frontend/e2e/dashboard.spec.ts`, new `frontend/e2e/detail.spec.ts`.
- Docs: `docs/FEATURES.md`, `CLAUDE.md`.

---

### Task 1: Seat history stores runner-up and winner share

**Files:**
- Modify: `backend/src/modules/constituencies/strategies/analysis-strategy.interface.ts`
- Modify: `backend/src/modules/constituencies/constituencies.service.ts:272-290` (winners map) and after it
- Modify: `backend/src/modules/constituencies/strategies/seat-history.strategy.ts`
- Test: `backend/src/modules/constituencies/strategies/seat-history.strategy.spec.ts`

**Interfaces:**
- Produces: `incumbency.seat_history[]` entries `{ year: number; party: string|null; candidate: string; margin: number; vote_share: number|null; runner_up: string|null; runner_up_party: string|null }` (frontend `SeatHistoryEntry`, Task 4).

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/constituencies/strategies/seat-history.strategy.spec.ts`:

```ts
import { SeatHistoryStrategy } from './seat-history.strategy';
import type { AnalysisContext, SeatStats } from './analysis-strategy.interface';

function ctx(over: Partial<AnalysisContext> = {}): AnalysisContext {
  const winners = new Map([
    ['e2020', new Map([['100', { party_id: 'BJP', candidate_name: 'A', margin: 300, votes: 600 }]])],
    ['e2025', new Map([['100', { party_id: 'RJD', candidate_name: 'B', margin: 50, votes: 0 }]])],
  ]);
  const stats = new Map<string, Map<string, SeatStats>>([
    ['e2020', new Map([['100', { total: 1000, runnerUp: { name: 'B', party_id: 'RJD' } }]])],
    ['e2025', new Map([['100', { total: 0, runnerUp: null }]])],
  ]);
  return {
    constId: 'BR_VS_100_X', constNo: '100', electionId: 'e2025', historyElectionIds: ['e2020'],
    electionYearMap: new Map([['e2020', 2020], ['e2025', 2025]]),
    winnersByElection: winners, resultsByConst: new Map(), candidatesByElectionConst: new Map(), manifest: null,
    seatStatsByElection: stats, ...over,
  };
}

describe('SeatHistoryStrategy', () => {
  it('stores the winner share and the runner-up for each election', () => {
    const { seat_history } = new SeatHistoryStrategy().execute(ctx());
    expect(seat_history[0]).toEqual({ year: 2020, party: 'BJP', candidate: 'A', margin: 300, vote_share: 60, runner_up: 'B', runner_up_party: 'RJD' });
  });

  it('a seat with no votes yet has a null share, not NaN', () => {
    const { seat_history } = new SeatHistoryStrategy().execute(ctx());
    expect(seat_history[1]).toMatchObject({ year: 2025, vote_share: null, runner_up: null, runner_up_party: null });
  });

  it('an election without stats for the seat still yields the winner', () => {
    const { seat_history } = new SeatHistoryStrategy().execute(ctx({ seatStatsByElection: new Map() }));
    expect(seat_history[0]).toMatchObject({ candidate: 'A', vote_share: null, runner_up: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/modules/constituencies/strategies/seat-history.strategy.spec.ts`
Expected: FAIL — TypeScript error, `seatStatsByElection` / `SeatStats` do not exist.

- [ ] **Step 3: Implement**

In `analysis-strategy.interface.ts` add before `AnalysisContext` and extend it:

```ts
/** Per election and seat (const_no): total votes cast and the second-placed candidate. */
export interface SeatStats {
  total: number;
  runnerUp: { name: string; party_id: string | null } | null;
}

export interface AnalysisContext {
  constId: string;
  constNo: string;
  electionId: string;
  historyElectionIds: string[];
  electionYearMap: Map<string, number>;
  winnersByElection: Map<string, Map<string, any>>;
  resultsByConst: Map<string, any[]>;
  candidatesByElectionConst: Map<string, Map<string, any[]>>;
  /** election id → const_no → totals (seat history: winner share, runner-up). */
  seatStatsByElection: Map<string, Map<string, SeatStats>>;
  manifest: any;
}
```

Replace `seat-history.strategy.ts`:

```ts
import { AnalysisStrategy, AnalysisContext } from './analysis-strategy.interface';

export class SeatHistoryStrategy implements AnalysisStrategy {
  name = 'history';

  execute(context: AnalysisContext) {
    const { constNo, historyElectionIds, electionId, winnersByElection, electionYearMap, seatStatsByElection } = context;
    const allElectionIds = [...historyElectionIds, electionId];

    const seat_history = allElectionIds.map(eid => {
      const w = winnersByElection.get(eid)?.get(constNo);
      if (!w) return null;
      const stats = seatStatsByElection.get(eid)?.get(constNo);
      const total = stats?.total ?? 0;
      return {
        year: electionYearMap.get(eid) || 0,
        party: w.party_id,
        candidate: w.candidate_name,
        margin: w.margin,
        vote_share: total > 0 ? Math.round(((w.votes ?? 0) / total) * 1000) / 10 : null,
        runner_up: stats?.runnerUp?.name ?? null,
        runner_up_party: stats?.runnerUp?.party_id ?? null,
      };
    }).filter(Boolean);

    return { seat_history };
  }
}
```

In `constituencies.service.ts` `computeAnalysis`: in the winners loop add `votes: w.votes || 0,` to the object set into `winnersByElection` (next to `margin`). Then, right after that loop, add:

```ts
    // Every result of these elections, highest votes first: per seat the total and the runner-up (seat history).
    const allResults = await this.prisma.results.findMany({
      where: { election_id: { in: allElectionIds } },
      select: { election_id: true, const_id: true, votes: true, candidates: { select: { name: true, party_id: true } } },
      orderBy: { votes: 'desc' },
    });
    const seatStatsByElection = new Map<string, Map<string, SeatStats>>();
    const seen = new Map<string, number>();
    for (const r of allResults) {
      const constNo = this.extractConstNo(r.const_id);
      if (!seatStatsByElection.has(r.election_id)) seatStatsByElection.set(r.election_id, new Map());
      const byConst = seatStatsByElection.get(r.election_id)!;
      const s = byConst.get(constNo) ?? { total: 0, runnerUp: null };
      s.total += r.votes || 0;
      const key = `${r.election_id}|${constNo}`;
      const rank = (seen.get(key) ?? 0) + 1;
      seen.set(key, rank);
      if (rank === 2) s.runnerUp = { name: r.candidates.name, party_id: r.candidates.party_id };
      byConst.set(constNo, s);
    }
```

Import `SeatStats` from `./strategies/analysis-strategy.interface` at the top, and add `seatStatsByElection,` to the `context: AnalysisContext = { ... }` literal.

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest src/modules/constituencies && npx tsc --noEmit -p tsconfig.json`
Expected: PASS, no type errors (other strategies ignore the new field).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/constituencies
git commit -m "feat(api): seat history stores winner share and runner-up

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Constituency detail endpoint — affidavits, trimmed party, region, last update, DTO

**Files:**
- Modify: `backend/src/modules/results/results.service.ts:194-239` (`getConstituencyDetail`)
- Create: `backend/src/modules/results/dto/constituency-detail.dto.ts`
- Modify: `backend/src/modules/elections/elections.controller.ts:129-135`
- Test: `backend/src/modules/results/constituency-detail.spec.ts`

**Interfaces:**
- Produces (JSON of `GET /api/v1/elections/:id/constituencies/:constId`):
  `{ id, election_id, name, const_no, type, voter_turnout: number|null, phase, total_electors, current_round, total_rounds, last_updated: string|null, state: {id,name}|null, district: {id,name}|null, region: {id,name}|null, candidates: [{ id, name, is_incumbent, votes, status, margin, person_id, person: {id, photo_url, wikipedia_url}|null, party: {id,name,abbreviation,color,symbol_url,eci_symbol_url}|null, age, assets: number|null, liabilities: number|null, criminal_cases }] }`

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/results/constituency-detail.spec.ts`:

```ts
import { plainToInstance } from 'class-transformer';
import { ResultsService } from './results.service';
import { ConstituencyDetailDto } from './dto/constituency-detail.dto';

const row = {
  id: 'BR_VS_100_X', election_id: 'e1', name: 'X', const_no: 100, type: 'SC', voter_turnout: '59.40', phase: 7,
  total_electors: 200000, current_round: 12, total_rounds: 24, metadata: { secret: 1 }, district_id: 1, state_id: 4, region_id: 2,
  districts: { id: 1, name: 'Patna', code: 'PAT', state_id: 4 }, states: { id: 4, name: 'Bihar', code: 'BR' }, regions: { id: 2, name: 'Magadh' },
  candidates: [
    { id: 'c2', name: 'Low', is_incumbent: false, person_id: 'p2', age: null, assets: null, liabilities: null, criminal_cases: null,
      parties: null, persons: { id: 'p2', photo_url: null, wikipedia_url: null },
      results: [{ votes: 10, status: 'TRAILING', margin: 0, last_updated: new Date('2026-02-27T05:00:00Z') }] },
    { id: 'c1', name: 'High', is_incumbent: true, person_id: 'p1', age: 64, assets: BigInt(48000000), liabilities: BigInt(3200000), criminal_cases: 1,
      parties: { id: 'BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP', color: '#f80', symbol_url: '/symbols/logos/BJP.svg', eci_symbol_url: null },
      persons: { id: 'p1', photo_url: 'https://x/p1.png', wikipedia_url: 'https://en.wikipedia.org/wiki/H' },
      results: [{ votes: 900, status: 'LEADING', margin: 890, last_updated: new Date('2026-02-27T06:00:00Z') }] },
  ],
};

function svc() {
  const prisma: any = { constituencies: { findFirst: jest.fn().mockResolvedValue(row) } };
  return { s: new ResultsService(prisma, {} as any, {} as any), prisma };
}

describe('getConstituencyDetail', () => {
  it('selects only the public party and person fields', async () => {
    const { s, prisma } = svc();
    await s.getConstituencyDetail('e1', 'BR_VS_100_X');
    const inc = prisma.constituencies.findFirst.mock.calls[0][0].include;
    expect(inc.candidates.include.parties.select).toEqual({ id: true, name: true, abbreviation: true, color: true, symbol_url: true, eci_symbol_url: true });
    expect(inc.candidates.include.persons.select).toEqual({ id: true, photo_url: true, wikipedia_url: true });
  });

  it('sorts by votes, carries the affidavit and the latest update, and the DTO makes it JSON-safe', async () => {
    const { s } = svc();
    const out = plainToInstance(ConstituencyDetailDto, await s.getConstituencyDetail('e1', 'BR_VS_100_X'), { excludeExtraneousValues: true });
    const json = JSON.parse(JSON.stringify(out));
    expect(json.candidates.map((c: any) => c.name)).toEqual(['High', 'Low']);
    expect(json.candidates[0]).toMatchObject({ age: 64, assets: 48000000, liabilities: 3200000, criminal_cases: 1, votes: 900, status: 'LEADING',
      party: { id: 'BJP', symbol_url: '/symbols/logos/BJP.svg' }, person: { id: 'p1', wikipedia_url: 'https://en.wikipedia.org/wiki/H' } });
    expect(json.voter_turnout).toBe(59.4);
    expect(json.region).toEqual({ id: 2, name: 'Magadh' });
    expect(json.district).toEqual({ id: 1, name: 'Patna' });
    expect(json.last_updated).toBe('2026-02-27T06:00:00.000Z');
    expect(json.metadata).toBeUndefined();
  });

  it('a seat with no results has last_updated null', async () => {
    const { s, prisma } = svc();
    prisma.constituencies.findFirst.mockResolvedValue({ ...row, candidates: row.candidates.map(c => ({ ...c, results: [] })) });
    const out = await s.getConstituencyDetail('e1', 'BR_VS_100_X');
    expect(out.last_updated).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/modules/results/constituency-detail.spec.ts`
Expected: FAIL — cannot find module `./dto/constituency-detail.dto`.

- [ ] **Step 3: Implement**

Create `backend/src/modules/results/dto/constituency-detail.dto.ts`:

```ts
import { Expose, Transform, Type } from 'class-transformer';
import { bigintTransform } from '../../../common/util/json-safe';

class PlaceDto {
  @Expose() id: number;
  @Expose() name: string;
}

class DetailPartyDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() abbreviation: string | null;
  @Expose() color: string | null;
  @Expose() symbol_url: string | null;
  @Expose() eci_symbol_url: string | null;
}

class DetailPersonDto {
  @Expose() id: string;
  @Expose() photo_url: string | null;
  @Expose() wikipedia_url: string | null;
}

class DetailCandidateDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() is_incumbent: boolean;
  @Expose() votes: number;
  @Expose() status: string | null;
  @Expose() margin: number;
  @Expose() person_id: string;
  @Expose() @Type(() => DetailPersonDto) person: DetailPersonDto | null;
  @Expose() @Type(() => DetailPartyDto) party: DetailPartyDto | null;
  @Expose() age: number | null;
  @Expose() @Transform(bigintTransform) assets: number | null;
  @Expose() @Transform(bigintTransform) liabilities: number | null;
  @Expose() criminal_cases: number | null;
}

/** Public constituency detail (slow-changing facts; live numbers come from the results snapshot). */
export class ConstituencyDetailDto {
  @Expose() id: string;
  @Expose() election_id: string;
  @Expose() name: string;
  @Expose() const_no: number;
  @Expose() type: 'GEN' | 'SC' | 'ST';
  @Expose() @Transform(({ value }) => (value == null ? null : Number(value))) voter_turnout: number | null;
  @Expose() phase: number | null;
  @Expose() total_electors: number | null;
  @Expose() current_round: number | null;
  @Expose() total_rounds: number | null;
  @Expose() @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value ?? null)) last_updated: string | null;
  @Expose() @Type(() => PlaceDto) state: PlaceDto | null;
  @Expose() @Type(() => PlaceDto) district: PlaceDto | null;
  @Expose() @Type(() => PlaceDto) region: PlaceDto | null;
  @Expose() @Type(() => DetailCandidateDto) candidates: DetailCandidateDto[];
}
```

Replace `getConstituencyDetail` in `results.service.ts`:

```ts
  async getConstituencyDetail(electionId: string, constId: string) {
    const constituency = await this.prisma.constituencies.findFirst({
      where: { id: constId, election_id: electionId },
      include: {
        districts: true,
        states: true,
        regions: { select: { id: true, name: true } },
        candidates: {
          include: {
            parties: { select: { id: true, name: true, abbreviation: true, color: true, symbol_url: true, eci_symbol_url: true } },
            persons: { select: { id: true, photo_url: true, wikipedia_url: true } },
            results: { where: { const_id: constId } },
          },
        },
      },
    });

    if (!constituency) throw new ConstituencyNotFoundException(constId);

    let lastUpdated: Date | null = null;
    const candidateResults = constituency.candidates
      .map(c => {
        const r = c.results[0];
        if (r?.last_updated && (!lastUpdated || r.last_updated > lastUpdated)) lastUpdated = r.last_updated;
        return {
          id: c.id,
          name: c.name,
          party: c.parties,
          is_incumbent: c.is_incumbent,
          votes: r?.votes || 0,
          status: r?.status || null,
          margin: r?.margin || 0,
          person_id: c.person_id,
          person: c.persons,
          age: c.age,
          assets: c.assets,
          liabilities: c.liabilities,
          criminal_cases: c.criminal_cases,
        };
      })
      .sort((a, b) => b.votes - a.votes);

    return {
      ...constituency,
      district: constituency.districts,
      state: constituency.states,
      region: constituency.regions,
      last_updated: lastUpdated,
      candidates: candidateResults,
    };
  }
```

In `elections.controller.ts` add imports `UseInterceptors` (from `@nestjs/common`, if not already), `MapToDtoInterceptor` from `'../common/interceptors/map-to-dto.interceptor'`, `ConstituencyDetailDto` from `'../results/dto/constituency-detail.dto'`, and decorate the route:

```ts
  @Get(':id/constituencies/:constId')
  @UseInterceptors(new MapToDtoInterceptor(ConstituencyDetailDto))
  getConstituencyDetail(
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest src/modules/results src/modules/elections && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/results backend/src/modules/elections/elections.controller.ts
git commit -m "feat(api): constituency detail carries affidavits, person wiki, region and last update through a DTO

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Person profile — affidavit, vote share, party marks, home place

**Files:**
- Modify: `backend/src/modules/candidates/persons.service.ts:92-147` (`findWithCandidates`)
- Modify: `backend/src/modules/candidates/dto/candidate-response.dto.ts` (`PersonProfileDto`)
- Test: `backend/src/modules/candidates/persons.service.spec.ts` (new `describe`)

**Interfaces:**
- Produces: each `candidates[]` entry gains `age, assets: number|null, liabilities: number|null, criminal_cases, vote_share: number|null, party_abbreviation, party_symbol_url, party_eci_symbol_url`; the profile exposes `state: {id,name}|null`, `district: {id,name}|null` (still no caste/religion).

- [ ] **Step 1: Write the failing test**

Append to `persons.service.spec.ts` (add `import { PersonProfileDto } from './dto/candidate-response.dto';` at the top):

```ts
describe('PersonsService.findWithCandidates (public profile)', () => {
  const full = {
    ...person, caste: 'X', religion: 'Y', states: { id: 4, name: 'Bihar' }, districts: { id: 1, name: 'Patna' },
    candidates: [
      { id: 'c1', name: 'Nitish Kumar', party_id: 'JDU', const_id: 'BR_VS_1_A', election_id: 'e1', is_incumbent: true,
        age: 74, assets: BigInt(16400000), liabilities: null, criminal_cases: 0,
        parties: { id: 'JDU', name: 'Janata Dal (United)', color: '#1fa37a', abbreviation: 'JD(U)', symbol_url: '/symbols/logos/JDU.svg', eci_symbol_url: '/symbols/eci/JDU.jpg' },
        constituencies: { name: 'A', const_no: 1 }, elections: { name: 'Bihar VS 2025', year: 2025, type: 'VS', status: 'Finalized' },
        results: [{ votes: 600, status: 'WON', margin: 200 }] },
      { id: 'c0', name: 'Nitish Kumar', party_id: 'JDU', const_id: 'BR_VS2020_1_A', election_id: 'e0', is_incumbent: false,
        age: null, assets: null, liabilities: null, criminal_cases: null, parties: null,
        constituencies: { name: 'A', const_no: 1 }, elections: { name: 'Bihar VS 2020', year: 2020, type: 'VS', status: 'Finalized' },
        results: [] },
    ],
  };
  function make2() {
    const prisma: any = {
      persons: { findUnique: jest.fn().mockResolvedValue(full) },
      results: { groupBy: jest.fn().mockResolvedValue([{ const_id: 'BR_VS_1_A', _sum: { votes: 1000 } }]) },
    };
    return { svc: new PersonsService(prisma, new AuditLogService(prisma)), prisma };
  }

  it('adds affidavit, vote share and party marks to each contest', async () => {
    const { svc } = make2();
    const out: any = await svc.findWithCandidates('p1');
    expect(out.candidates[0]).toMatchObject({ age: 74, assets: 16400000, liabilities: null, criminal_cases: 0, vote_share: 60,
      party_abbreviation: 'JD(U)', party_symbol_url: '/symbols/logos/JDU.svg', party_eci_symbol_url: '/symbols/eci/JDU.jpg' });
    expect(out.candidates[1]).toMatchObject({ vote_share: null, party_abbreviation: null, party_symbol_url: null });
  });

  it('the public DTO exposes home state/district and never caste or religion', async () => {
    const { svc } = make2();
    const json = JSON.parse(JSON.stringify(plainToInstance(PersonProfileDto, await svc.findWithCandidates('p1'), { excludeExtraneousValues: true })));
    expect(json.state).toEqual({ id: 4, name: 'Bihar' });
    expect(json.district).toEqual({ id: 1, name: 'Patna' });
    expect(json.caste).toBeUndefined();
    expect(json.religion).toBeUndefined();
    expect(json.candidates[0].assets).toBe(16400000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/modules/candidates/persons.service.spec.ts -t "public profile"`
Expected: FAIL — `vote_share` undefined, `state` undefined.

- [ ] **Step 3: Implement**

In `persons.service.ts` `findWithCandidates`, after the `if (!person) throw ...` line add:

```ts
    // Seat totals for the vote share of each contest (one grouped query).
    const constIds = [...new Set(person.candidates.map(c => c.const_id))];
    const totals = constIds.length
      ? await this.prisma.results.groupBy({ by: ['const_id'], where: { const_id: { in: constIds } }, _sum: { votes: true } })
      : [];
    const totalByConst = new Map(totals.map(t => [t.const_id, t._sum.votes ?? 0]));
```

and add to the object returned by `person.candidates.map((c) => { ... })`:

```ts
        age: c.age,
        assets: bigintToNumber(c.assets),
        liabilities: bigintToNumber(c.liabilities),
        criminal_cases: c.criminal_cases,
        vote_share: r && (totalByConst.get(c.const_id) ?? 0) > 0
          ? Math.round((r.votes / totalByConst.get(c.const_id)!) * 1000) / 10
          : null,
        party_abbreviation: c.parties?.abbreviation ?? null,
        party_symbol_url: c.parties?.symbol_url ?? null,
        party_eci_symbol_url: c.parties?.eci_symbol_url ?? null,
```

Import `bigintToNumber` from `'../../common/util/json-safe'`.

In `candidate-response.dto.ts` add a `PlaceMiniDto` and expose it on `PersonProfileDto`:

```ts
export class PlaceMiniDto {
  @Expose() id: number;
  @Expose() name: string;
}
```

and inside `PersonProfileDto`, after `wikipedia_url`:

```ts
  @Expose() @Type(() => PlaceMiniDto) state: PlaceMiniDto | null;
  @Expose() @Type(() => PlaceMiniDto) district: PlaceMiniDto | null;
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest src/modules/candidates && npx tsc --noEmit -p tsconfig.json`
Expected: PASS (existing admin tests unaffected).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/candidates
git commit -m "feat(api): person profile adds affidavit, vote share, party marks and home place

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend types and the party mark rule

**Files:**
- Modify: `frontend/src/model/types/index.ts`
- Create: `frontend/src/model/derive/partyMeta.ts`
- Modify: `frontend/src/model/api/geo.service.ts`
- Test: `frontend/src/model/derive/__tests__/partyMeta.test.ts`

**Interfaces:**
- Produces:
  - `partyMark(p: { symbol_url?: string|null; eci_symbol_url?: string|null } | null | undefined): string | null`
  - `interface PartyMeta { id: string; name: string; abbreviation: string|null; color: string|null; mark: string|null; eciRecognition: 'National'|'State'|'Unrecognised'|null }`
  - `buildPartyMeta(parties: Party[]): Map<string, PartyMeta>`
  - `isNota(partyId: string|null|undefined, name?: string): boolean`
  - `getParty(id: string): Promise<PartyDetail>`
  - Types `Party` (+ `abbreviation?`, `eci_recognition?`), `PartyDetail`, `CandidateResult` (+ affidavit, `person.wikipedia_url`), `Constituency` (+ `last_updated?`), `PersonCandidate` (+ fields from Task 3 and `election_type`, `election_status`), `SeatHistoryEntry`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/model/derive/__tests__/partyMeta.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { partyMark, buildPartyMeta, isNota } from '../partyMeta';

describe('partyMark', () => {
  it('prefers the logo, then the ECI symbol, then nothing', () => {
    expect(partyMark({ symbol_url: '/l.svg', eci_symbol_url: '/e.svg' })).toBe('/l.svg');
    expect(partyMark({ symbol_url: null, eci_symbol_url: '/e.svg' })).toBe('/e.svg');
    expect(partyMark({ symbol_url: '  ', eci_symbol_url: '' })).toBeNull();
    expect(partyMark(null)).toBeNull();
  });
});

describe('buildPartyMeta', () => {
  it('keys parties by id with abbreviation, mark and recognition', () => {
    const m = buildPartyMeta([{ id: 'BJP', name: 'Bharatiya Janata Party', color: '#f80', abbreviation: 'BJP', symbol_url: null, eci_symbol_url: '/e/BJP.svg', eci_recognition: 'National' }]);
    expect(m.get('BJP')).toEqual({ id: 'BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP', color: '#f80', mark: '/e/BJP.svg', eciRecognition: 'National' });
  });
});

describe('isNota', () => {
  it('matches the NOTA party id or name only', () => {
    expect(isNota('NOTA')).toBe(true);
    expect(isNota(null, 'nota')).toBe(true);
    expect(isNota(null, 'Independent')).toBe(false);
    expect(isNota('IND')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/model/derive/__tests__/partyMeta.test.ts`
Expected: FAIL — cannot resolve `../partyMeta`.

- [ ] **Step 3: Implement**

Create `frontend/src/model/derive/partyMeta.ts`:

```ts
import type { Party } from '../types';

export interface PartyMeta {
  id: string;
  name: string;
  abbreviation: string | null;
  color: string | null;
  /** Image URL: logo, else ECI ballot symbol, else null (draw the colour dot). */
  mark: string | null;
  eciRecognition: 'National' | 'State' | 'Unrecognised' | null;
}

const present = (s: string | null | undefined) => (s && s.trim() ? s : null);

/** D1: party logo → ECI ballot symbol → none. */
export function partyMark(p: { symbol_url?: string | null; eci_symbol_url?: string | null } | null | undefined): string | null {
  if (!p) return null;
  return present(p.symbol_url) ?? present(p.eci_symbol_url);
}

export function buildPartyMeta(parties: Party[]): Map<string, PartyMeta> {
  return new Map(parties.map(p => [p.id, {
    id: p.id, name: p.name, abbreviation: p.abbreviation ?? null, color: p.color, mark: partyMark(p), eciRecognition: p.eci_recognition ?? null,
  }]));
}

/** NOTA rows: party id 'NOTA' (seeds) or the name. Never a person link, never a party dialog, always last. */
export function isNota(partyId: string | null | undefined, name?: string): boolean {
  return partyId === 'NOTA' || (!!name && name.trim().toUpperCase() === 'NOTA');
}
```

In `frontend/src/model/types/index.ts`:

Replace `interface Party` with:

```ts
export interface Party {
  id: string;
  name: string;
  color: string | null;
  abbreviation?: string | null;
  symbol_url: string | null;
  eci_symbol_url: string | null;
  eci_recognition?: 'National' | 'State' | 'Unrecognised' | null;
}

export interface PartyDetail extends Party {
  leader_name: string | null;
  founded_year: number | null;
  headquarters: string | null;
  website: string | null;
  wikipedia_url: string | null;
  description: string | null;
}

/** A candidate's affidavit for one contest (rupees). */
export interface Affidavit {
  age: number | null;
  assets: number | null;
  liabilities: number | null;
  criminal_cases: number | null;
}

/** One entry of constituency_analysis.incumbency.seat_history (runner-up/share absent on rows computed before 2026-10). */
export interface SeatHistoryEntry {
  year: number;
  party: string | null;
  candidate: string;
  margin: number;
  vote_share?: number | null;
  runner_up?: string | null;
  runner_up_party?: string | null;
}
```

In `interface Constituency` add `last_updated?: string | null;`.

Replace `interface CandidateResult` with:

```ts
export interface CandidateResult extends Partial<Affidavit> {
  id: string;
  name: string;
  party: Party | null;
  is_incumbent: boolean;
  votes: number;
  vote_share?: number;
  status: string | null;
  margin: number;
  /** Every candidate has a person (migration 018); optional because not every response carries it. */
  person_id?: string;
  person?: { id: string; photo_url: string | null; wikipedia_url?: string | null } | null;
  isSplitter?: boolean;
}
```

Replace `interface PersonCandidate` with:

```ts
export interface PersonCandidate extends Partial<Affidavit> {
  id: string;
  name: string;
  party_id: string | null;
  party_name: string | null;
  party_color: string | null;
  party_abbreviation?: string | null;
  party_symbol_url?: string | null;
  party_eci_symbol_url?: string | null;
  election_name: string | null;
  election_year: number | null;
  election_type?: 'LS' | 'VS' | null;
  election_status?: 'Upcoming' | 'Live' | 'Finalized' | null;
  election_id: string;
  constituency_name: string | null;
  const_id: string;
  votes: number;
  vote_share?: number | null;
  status: string | null;
  margin: number;
  is_incumbent: boolean;
}
```

In `frontend/src/model/api/geo.service.ts` change the type import to `import type { State, Party, PartyDetail } from '../types';` and add:

```ts
export function getParty(id: string) {
  return apiFetch<PartyDetail>(`/parties/${encodeURIComponent(id)}`);
}
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/model && npx tsc --noEmit -p tsconfig.json`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/model
git commit -m "feat(fe): party mark rule, party meta and detail types

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `PartyMark`, money formatting and the dialog shell (views/ui)

**Files:**
- Create: `frontend/src/views/ui/PartyMark.tsx`, `frontend/src/views/ui/format.ts`, `frontend/src/views/ui/DetailDialog.tsx`, `frontend/src/views/ui/Avatar.tsx`
- Test: `frontend/src/views/ui/__tests__/PartyMark.test.tsx`, `frontend/src/views/ui/__tests__/format.test.ts`

**Interfaces:**
- Produces:
  - `<PartyMark mark={string|null} color={string|null} label={string} size?: 16|24|40|64 />`
  - `<Avatar name={string} photo={string|null} size?: number />` (initials fallback)
  - `formatRupees(n: number|null): string|null` (`₹4.8 Cr`, `₹32 L`, `₹8,500`), `formatIN(n: number): string` (Indian grouping)
  - `<DetailDialog open title onClose children labelledTitle?: ReactNode />` — centred Radix dialog on ≥1024px, `BottomSheet` below.

- [ ] **Step 1: Write the failing tests**

`frontend/src/views/ui/__tests__/PartyMark.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PartyMark } from '../PartyMark';
import { Avatar } from '../Avatar';

afterEach(cleanup);

describe('PartyMark', () => {
  it('renders the image with the party label as alt text', () => {
    render(<PartyMark mark="/symbols/logos/BJP.svg" color="#f80" label="BJP" />);
    expect(screen.getByRole('img', { name: 'BJP' })).toHaveAttribute('src', '/symbols/logos/BJP.svg');
  });

  it('falls back to the colour dot when there is no mark', () => {
    const { container } = render(<PartyMark mark={null} color="#f80" label="IND" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-party-dot]')).toHaveStyle({ background: '#f80' });
  });

  it('falls back to the dot when the image fails to load', () => {
    const { container } = render(<PartyMark mark="/missing.svg" color="#0a0" label="RJD" />);
    fireEvent.error(screen.getByRole('img', { name: 'RJD' }));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-party-dot]')).not.toBeNull();
  });
});

describe('Avatar', () => {
  it('shows initials when the photo is missing or broken', () => {
    const { rerender } = render(<Avatar name="Ram Kripal Yadav" photo={null} />);
    expect(screen.getByText('RY')).toBeInTheDocument();
    rerender(<Avatar name="Ram Kripal Yadav" photo="/x.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'Ram Kripal Yadav' }));
    expect(screen.getByText('RY')).toBeInTheDocument();
  });
});
```

`frontend/src/views/ui/__tests__/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatRupees, formatIN } from '../format';

describe('formatRupees', () => {
  it('uses crore, lakh and plain rupees', () => {
    expect(formatRupees(48000000)).toBe('₹4.8 Cr');
    expect(formatRupees(3200000)).toBe('₹32 L');
    expect(formatRupees(8500)).toBe('₹8,500');
    expect(formatRupees(0)).toBe('₹0');
    expect(formatRupees(null)).toBeNull();
  });
});

describe('formatIN', () => {
  it('groups digits the Indian way', () => {
    expect(formatIN(2014532)).toBe('20,14,532');
  });
});
```

(Check `frontend/vitest.config.*` / `src/setupTests.*` for `@testing-library/jest-dom`; if `toHaveAttribute` is unavailable, assert with `getAttribute` instead, matching the other view tests.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/views/ui`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`frontend/src/views/ui/format.ts`:

```ts
/** Indian digit grouping (20,14,532). */
export function formatIN(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

const trim = (x: number) => (Math.round(x * 10) / 10).toString();

/** Affidavit money: ₹4.8 Cr / ₹32 L / ₹8,500. */
export function formatRupees(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n >= 1e7) return `₹${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5)} L`;
  return `₹${formatIN(n)}`;
}
```

`frontend/src/views/ui/PartyMark.tsx`:

```tsx
import { useState } from 'react';
import { cn } from './cn';

const DOT: Record<number, string> = { 16: 'h-2.5 w-2.5', 24: 'h-3 w-3', 40: 'h-4 w-4', 64: 'h-6 w-6' };

/** D1: logo / ECI symbol image, else (or on load error) the party colour dot. */
export function PartyMark({ mark, color, label, size = 16, className }: { mark: string | null; color: string | null; label: string; size?: 16 | 24 | 40 | 64; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (mark && failed !== mark) {
    return (
      <img src={mark} alt={label} width={size} height={size} loading="lazy" onError={() => setFailed(mark)}
        className={cn('shrink-0 rounded-[0.25rem] bg-white/90 object-contain p-px', className)} style={{ width: size, height: size }} />
    );
  }
  return <span data-party-dot aria-label={label} role="img" className={cn('shrink-0 rounded-full', DOT[size], className)} style={{ background: color ?? 'var(--color-fallback)' }} />;
}
```

Note: the dot has `role="img"` + `aria-label` so both branches are found by the same accessible name; the test's `container.querySelector('img')` checks the `<img>` element, not the role.

`frontend/src/views/ui/Avatar.tsx`:

```tsx
import { useState } from 'react';
import { cn } from './cn';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ name, photo, size = 40, className }: { name: string; photo: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const style = { width: size, height: size };
  if (photo && failed !== photo) {
    return <img src={photo} alt={name} style={style} loading="lazy" onError={() => setFailed(photo)} className={cn('shrink-0 rounded-full object-cover', className)} />;
  }
  return <span aria-hidden style={style} className={cn('grid shrink-0 place-items-center rounded-full border border-line bg-tile-raised text-xs font-bold text-muted', className)}>{initials(name)}</span>;
}
```

`frontend/src/views/ui/DetailDialog.tsx`:

```tsx
import * as Dialog from '@radix-ui/react-dialog';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { BottomSheet } from './BottomSheet';

/** Seat / party dialog shell: centred on desktop, bottom sheet on mobile (spec D10). */
export function DetailDialog({ open, title, onClose, header, children }: { open: boolean; title: string; onClose(): void; header?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { if (open) opener.current = document.activeElement as HTMLElement | null; }, [open]);
  if (!desktop) {
    return <BottomSheet open={open} onOpenChange={o => { if (!o) onClose(); }} title={title}>{header}{children}</BottomSheet>;
  }
  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim backdrop-blur-sm" />
        <Dialog.Content aria-describedby={undefined} onCloseAutoFocus={e => { e.preventDefault(); opener.current?.focus(); }}
          className="studio-root fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(760px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-tile border border-line bg-tile shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-2xl font-bold uppercase tracking-wide text-ink">{title}</Dialog.Title>
              {header}
            </div>
            <Dialog.Close className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-tile-raised hover:text-ink" aria-label={t('studio_close')}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M4.3 4.3a1 1 0 011.4 0L10 8.6l4.3-4.3a1 1 0 111.4 1.4L11.4 10l4.3 4.3a1 1 0 01-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 01-1.4-1.4L8.6 10 4.3 5.7a1 1 0 010-1.4z" /></svg>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/views/ui && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/ui
git commit -m "feat(fe): PartyMark, Avatar, rupee formatting and the detail dialog shell

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Party meta in the dashboard sources

**Files:**
- Create: `frontend/src/viewmodels/data/usePartyMeta.ts`
- Modify: `frontend/src/viewmodels/sources/useDashboardSources.ts`
- Modify: `frontend/src/viewmodels/__tests__/fixtures.ts`
- Test: `frontend/src/viewmodels/__tests__/usePartyMeta.test.tsx`

**Interfaces:**
- Consumes: `buildPartyMeta`, `PartyMeta` (Task 4); `getParties` (`model/api/geo.service`); `useApi(fn, deps, { key })` (`viewmodels/data/useApi`).
- Produces: `usePartyMeta(): Map<string, PartyMeta>` (empty map until loaded, one cached request app-wide, key `'parties_all'`); `DashboardSources.partyMeta: Map<string, PartyMeta>`.

- [ ] **Step 1: Write the failing test**

`frontend/src/viewmodels/__tests__/usePartyMeta.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../model/api/geo.service', () => ({
  getParties: vi.fn().mockResolvedValue([{ id: 'BJP', name: 'Bharatiya Janata Party', color: '#f80', abbreviation: 'BJP', symbol_url: '/l.svg', eci_symbol_url: null }]),
}));

import { usePartyMeta } from '../data/usePartyMeta';

describe('usePartyMeta', () => {
  it('starts empty and fills from /parties', async () => {
    const { result } = renderHook(() => usePartyMeta());
    expect(result.current.size).toBe(0);
    await waitFor(() => expect(result.current.get('BJP')?.mark).toBe('/l.svg'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/viewmodels/__tests__/usePartyMeta.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`frontend/src/viewmodels/data/usePartyMeta.ts`:

```ts
import { useMemo } from 'react';
import { useApi } from './useApi';
import { getParties } from '../../model/api/geo.service';
import { buildPartyMeta, type PartyMeta } from '../../model/derive/partyMeta';

const EMPTY = new Map<string, PartyMeta>();

/** Every party's name, abbreviation and mark (one cached /parties call for the whole app). */
export function usePartyMeta(): Map<string, PartyMeta> {
  const { data } = useApi(() => getParties(), [], { key: 'parties_all' });
  return useMemo(() => (data ? buildPartyMeta(data) : EMPTY), [data]);
}
```

In `useDashboardSources.ts`: import `usePartyMeta` and `type PartyMeta` (`../../model/derive/partyMeta`), add to `DashboardSources`:

```ts
  /** Party abbreviation and mark (logo → ECI symbol) by party id. */
  partyMeta: Map<string, PartyMeta>;
```

call `const partyMeta = usePartyMeta();` near the top of `useDashboardSources`, and include `partyMeta` in the returned object.

In `fixtures.ts` add to the returned object (before `...over`):

```ts
    partyMeta: new Map([
      ['BJP', { id: 'BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP', color: '#FF7A1A', mark: '/symbols/logos/BJP.svg', eciRecognition: 'National' as const }],
      ['JDU', { id: 'JDU', name: 'Janata Dal (United)', abbreviation: 'JD(U)', color: '#1FA37A', mark: null, eciRecognition: 'State' as const }],
    ]),
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/viewmodels && npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/viewmodels
git commit -m "feat(fe): party meta (abbreviation + mark) in dashboard sources

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Store — seat no longer opens map focus; `?party=`

**Files:**
- Modify: `frontend/src/viewmodels/store/dashboardStore.ts`
- Modify: `frontend/src/viewmodels/store/DashboardStoreProvider.tsx`
- Modify: `frontend/src/pages/StudioDashboard.tsx` (pass `knownParties`)
- Test: `frontend/src/viewmodels/__tests__/dashboardStore.test.ts`

**Interfaces:**
- Produces: `DashboardUiState.selectedParty: string|null`; action `{ type: 'selectParty'; party: string|null }`; `parseUiParams(params, knownSeats, knownParties?: Set<string>|null)`; URL param `party`; `DashboardStoreProvider` prop `knownParties: Set<string>|null`.

- [ ] **Step 1: Update/write the failing tests**

In `dashboardStore.test.ts` replace the two tests at lines 16-22 with:

```ts
  it('selecting a seat opens the seat dialog only (no map focus)', () => {
    expect(dashboardReducer(initialUiState, { type: 'selectSeat', seat: 'X' })).toMatchObject({ selectedSeat: 'X', focus: null });
  });
  it('a seat picked inside the expanded map keeps the map focus under the dialog', () => {
    const s = dashboardReducer({ ...initialUiState, focus: 'map' }, { type: 'selectSeat', seat: 'X' });
    expect(s).toMatchObject({ selectedSeat: 'X', focus: 'map' });
  });
  it('closing focus leaves an open seat dialog alone', () => {
    const s = { ...initialUiState, focus: 'map' as const, selectedSeat: 'X' };
    expect(dashboardReducer(s, { type: 'focus', tile: null })).toMatchObject({ focus: null, selectedSeat: 'X' });
  });
  it('selectParty opens and closes the party dialog', () => {
    const s = dashboardReducer(initialUiState, { type: 'selectParty', party: 'BJP' });
    expect(s.selectedParty).toBe('BJP');
    expect(dashboardReducer(s, { type: 'selectParty', party: null }).selectedParty).toBeNull();
  });
```

Replace the round-trip tests (lines ~95-104) with:

```ts
  it('round-trips layer, seat, party and focus', () => {
    const s = { ...initialUiState, layer: 'swing' as const, selectedSeat: 'A', selectedParty: 'BJP', focus: 'map' as const };
    const p = serializeUiParams(s, new URLSearchParams('keep=1'));
    expect(p.toString()).toBe('keep=1&layer=swing&seat=A&party=BJP&focus=map');
    expect(parseUiParams(p, new Set(['A']), new Set(['BJP']))).toEqual({ layer: 'swing', selectedSeat: 'A', selectedParty: 'BJP', focus: 'map' });
  });
  it('drops unknown layer, focus, seat and party ids', () => {
    const p = new URLSearchParams('layer=bogus&focus=nope&seat=NOT_A_SEAT&party=NOPE');
    expect(parseUiParams(p, new Set(['A']), new Set(['BJP']))).toEqual({ layer: 'overview', selectedSeat: null, selectedParty: null, focus: null });
  });
  it('keeps a party id while the party list is still loading', () => {
    expect(parseUiParams(new URLSearchParams('party=BJP'), null, null).selectedParty).toBe('BJP');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/viewmodels/__tests__/dashboardStore.test.ts`
Expected: FAIL (focus still 'map', no `selectedParty`).

- [ ] **Step 3: Implement**

`dashboardStore.ts`:
- `DashboardUiState` add `selectedParty: string | null;`
- `DashboardAction` add `| { type: 'selectParty'; party: string | null }`
- `initialUiState` add `selectedParty: null`
- reducer cases:

```ts
    case 'selectSeat': return { ...s, selectedSeat: a.seat };
    case 'selectParty': return { ...s, selectedParty: a.party };
    case 'focus': return { ...s, focus: a.tile };
```

- `parseUiParams`:

```ts
export function parseUiParams(params: URLSearchParams, knownSeats: Set<string> | null, knownParties: Set<string> | null = null): Partial<DashboardUiState> {
  const layer = params.get('layer') as LayerId | null;
  const focus = params.get('focus') as FocusTile | null;
  const seat = params.get('seat');
  const party = params.get('party');
  return {
    layer: layer && ALL_LAYERS.includes(layer) ? layer : 'overview',
    selectedSeat: seat && (knownSeats === null || knownSeats.has(seat)) ? seat : null,
    selectedParty: party && (knownParties === null || knownParties.has(party)) ? party : null,
    focus: focus && FOCUS_TILES.includes(focus) ? focus : null,
  };
}
```

- `serializeUiParams`: delete keys `['layer', 'seat', 'party', 'focus']`; after the seat line add `if (s.selectedParty) p.set('party', s.selectedParty);`.

`DashboardStoreProvider.tsx`:
- add prop `knownParties: Set<string> | null`; pass it to both `parseUiParams(params, knownSeats, knownParties)` calls; add `knownParties` to the sync effect deps.
- `isOpen`: `Boolean(p.get('focus') || p.get('seat') || p.get('party'))`.
- state→URL effect deps: `[raw.layer, raw.selectedSeat, raw.selectedParty, raw.focus]`.

`StudioDashboard.tsx` `Loaded`:

```tsx
  const knownParties = useMemo(() => (sources.partyMeta.size ? new Set(sources.partyMeta.keys()) : null), [sources.partyMeta]);
  ...
      <DashboardStoreProvider allowedLayers={sources.availableLayers} knownSeats={knownSeats} knownParties={knownParties}>
```

Search for other `parseUiParams(` / `DashboardStoreProvider` uses in tests (`grep -rn "DashboardStoreProvider\|parseUiParams" src`) and pass `knownParties={null}` where a provider is rendered.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/viewmodels && npx tsc --noEmit -p tsconfig.json`
Expected: PASS. Fix any VM test that asserted `focus: 'map'` after `selectSeat` to expect `selectedSeat` only.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/viewmodels frontend/src/pages/StudioDashboard.tsx
git commit -m "feat(fe): seat selection no longer opens the map; ?party= in the dashboard URL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Seat view derivation (pure)

**Files:**
- Create: `frontend/src/model/derive/seatView.ts`
- Test: `frontend/src/model/derive/__tests__/seatView.test.ts`

**Interfaces:**
- Consumes: `ResultRow`, `CandidateResult`, `AnalysisEntry`, `SeatHistoryEntry` (types), `PartyMeta`, `isNota` (Task 4).
- Produces:

```ts
export type SeatPill = 'LEADING' | 'WON' | null;
export interface SeatCandidateView {
  key: string; name: string; partyId: string | null; partyLabel: string; mark: string | null; color: string;
  votes: number; share: number; pill: SeatPill; incumbent: boolean; photo: string | null;
  personId: string | null; nota: boolean; affidavit: { age: number|null; assets: number|null; liabilities: number|null; criminalCases: number|null } | null;
}
export interface SeatView { candidates: SeatCandidateView[]; others: { count: number; votes: number; share: number } | null; totalVotes: number; margin: number | null }
export function buildSeatView(rows: ResultRow[], o: { partyMeta: Map<string, PartyMeta>; partyColor: Map<string, string>; detail?: CandidateResult[] | null; limit?: number }): SeatView
export function seatHistory(analysis: AnalysisEntry | null, currentYear: number): SeatHistoryEntry[]
export type SeatNote = { kind: 'threeWay'; thirdVotes: number; margin: number } | { kind: 'spoiler'; party: string; votes: number; margin: number };
export function seatNotes(view: SeatView, analysis: AnalysisEntry | null): SeatNote[]
export function detailToRows(constId: string, detail: CandidateResult[]): ResultRow[]
```

- [ ] **Step 1: Write the failing test**

`frontend/src/model/derive/__tests__/seatView.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSeatView, seatHistory, seatNotes, detailToRows } from '../seatView';
import type { ResultRow, CandidateResult, AnalysisEntry } from '../../types';
import type { PartyMeta } from '../partyMeta';

const meta = new Map<string, PartyMeta>([['BJP', { id: 'BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP', color: '#f80', mark: '/l.svg', eciRecognition: 'National' }]]);
const color = new Map([['BJP', '#f80'], ['RJD', '#0a0']]);
const r = (party_id: string, candidate_name: string, votes: number, status: string, margin = 0): ResultRow => ({ const_id: 'S', party_id, candidate_name, votes, status, margin });

describe('buildSeatView', () => {
  const rows = [r('RJD', 'B', 300, 'TRAILING'), r('NOTA', 'NOTA', 50, 'TRAILING'), r('BJP', 'A', 500, 'LEADING', 200), r('IND', 'C', 150, 'TRAILING'), r('IND', 'D', 100, 'TRAILING')];

  it('ranks by votes, NOTA last, share of all votes, pill only for leader/winner', () => {
    const v = buildSeatView(rows, { partyMeta: meta, partyColor: color });
    expect(v.candidates.map(c => c.name)).toEqual(['A', 'B', 'C', 'D', 'NOTA']);
    expect(v.candidates[0]).toMatchObject({ share: 45.5, pill: 'LEADING', partyLabel: 'BJP', mark: '/l.svg' });
    expect(v.candidates[1].pill).toBeNull();
    expect(v.candidates[4]).toMatchObject({ nota: true, partyId: null, personId: null });
    expect(v.totalVotes).toBe(1100);
    expect(v.margin).toBe(200);
  });

  it('caps rows and sums the rest as others (NOTA counts as other when capped)', () => {
    const v = buildSeatView(rows, { partyMeta: meta, partyColor: color, limit: 2 });
    expect(v.candidates.map(c => c.name)).toEqual(['A', 'B']);
    expect(v.others).toEqual({ count: 3, votes: 300, share: 27.3 });
  });

  it('a seat with zero votes has 0% shares, no pills and no margin', () => {
    const v = buildSeatView([r('BJP', 'A', 0, 'TRAILING'), r('RJD', 'B', 0, 'TRAILING')], { partyMeta: meta, partyColor: color });
    expect(v.candidates.map(c => c.share)).toEqual([0, 0]);
    expect(v.candidates.every(c => c.pill === null)).toBe(true);
    expect(v.margin).toBeNull();
  });

  it('joins photo, person, incumbent and affidavit from the detail by party + name', () => {
    const detail: CandidateResult[] = [{ id: 'c1', name: 'a', party: null, is_incumbent: true, votes: 0, status: null, margin: 0, person_id: 'p1',
      person: { id: 'p1', photo_url: '/p1.png' }, age: 60, assets: 100, liabilities: 0, criminal_cases: 2 }];
    (detail[0] as CandidateResult).party = { id: 'BJP', name: 'x', color: null, symbol_url: null, eci_symbol_url: null };
    const v = buildSeatView(rows, { partyMeta: meta, partyColor: color, detail });
    expect(v.candidates[0]).toMatchObject({ photo: '/p1.png', personId: 'p1', incumbent: true, affidavit: { age: 60, assets: 100, liabilities: 0, criminalCases: 2 } });
    expect(v.candidates[1]).toMatchObject({ photo: null, personId: null, affidavit: null });
  });

  it('an independent without a party row uses its id as the label and the fallback colour', () => {
    const v = buildSeatView([r('IND', 'C', 10, 'LEADING')], { partyMeta: meta, partyColor: color });
    expect(v.candidates[0]).toMatchObject({ partyId: 'IND', partyLabel: 'IND', mark: null, color: 'var(--color-fallback)' });
  });
});

describe('seatHistory', () => {
  it('drops the current year and sorts newest first', () => {
    const a = { incumbency: { seat_history: [{ year: 2015, party: 'JDU', candidate: 'X', margin: 1 }, { year: 2025, party: 'BJP', candidate: 'A', margin: 2 }, { year: 2020, party: 'BJP', candidate: 'A', margin: 3, vote_share: 50.5 }] } } as unknown as AnalysisEntry;
    expect(seatHistory(a, 2025).map(h => h.year)).toEqual([2020, 2015]);
    expect(seatHistory(null, 2025)).toEqual([]);
  });
});

describe('seatNotes', () => {
  it('flags a 3-way contest when the third candidate out-polls the margin', () => {
    const v = buildSeatView([r('BJP', 'A', 500, 'LEADING', 200), r('RJD', 'B', 300, 'TRAILING'), r('IND', 'C', 250, 'TRAILING')], { partyMeta: meta, partyColor: color });
    expect(seatNotes(v, null)).toEqual([{ kind: 'threeWay', thirdVotes: 250, margin: 200 }]);
  });
  it('adds the spoiler from the analysis', () => {
    const v = buildSeatView([r('BJP', 'A', 500, 'WON', 200), r('RJD', 'B', 300, 'LOST')], { partyMeta: meta, partyColor: color });
    const a = { incumbency: { spoiler: { spoiler_party: 'VIP', spoiler_votes: 900, winner_margin: 200 } } } as unknown as AnalysisEntry;
    expect(seatNotes(v, a)).toEqual([{ kind: 'spoiler', party: 'VIP', votes: 900, margin: 200 }]);
  });
  it('no notes for an uncounted seat', () => {
    expect(seatNotes(buildSeatView([], { partyMeta: meta, partyColor: color }), null)).toEqual([]);
  });
});

describe('detailToRows', () => {
  it('turns detail candidates into result rows', () => {
    const rows = detailToRows('S', [{ id: 'c', name: 'A', party: { id: 'BJP', name: '', color: null, symbol_url: null, eci_symbol_url: null }, is_incumbent: false, votes: 5, status: 'WON', margin: 3 }]);
    expect(rows).toEqual([{ const_id: 'S', party_id: 'BJP', candidate_name: 'A', votes: 5, status: 'WON', margin: 3 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/model/derive/__tests__/seatView.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`frontend/src/model/derive/seatView.ts`:

```ts
import type { ResultRow, CandidateResult, AnalysisEntry, SeatHistoryEntry } from '../types';
import { isNota, type PartyMeta } from './partyMeta';

export type SeatPill = 'LEADING' | 'WON' | null;
export interface SeatCandidateView {
  key: string; name: string; partyId: string | null; partyLabel: string; mark: string | null; color: string;
  votes: number; share: number; pill: SeatPill; incumbent: boolean; photo: string | null;
  personId: string | null; nota: boolean;
  affidavit: { age: number | null; assets: number | null; liabilities: number | null; criminalCases: number | null } | null;
}
export interface SeatView { candidates: SeatCandidateView[]; others: { count: number; votes: number; share: number } | null; totalVotes: number; margin: number | null }

const pct = (votes: number, total: number) => (total > 0 ? Math.round((votes / total) * 1000) / 10 : 0);
const joinKey = (partyId: string | null | undefined, name: string) => `${partyId ?? ''}|${name.trim().toUpperCase()}`;

export function buildSeatView(rows: ResultRow[], o: { partyMeta: Map<string, PartyMeta>; partyColor: Map<string, string>; detail?: CandidateResult[] | null; limit?: number }): SeatView {
  const total = rows.reduce((s, r) => s + (Number(r.votes) || 0), 0);
  const byKey = new Map((o.detail ?? []).map(c => [joinKey(c.party?.id ?? null, c.name), c]));
  const sorted = [...rows].sort((a, b) => {
    const na = isNota(a.party_id, a.candidate_name), nb = isNota(b.party_id, b.candidate_name);
    if (na !== nb) return na ? 1 : -1;
    return (b.votes || 0) - (a.votes || 0);
  });
  const all = sorted.map((r, i): SeatCandidateView => {
    const nota = isNota(r.party_id, r.candidate_name);
    const d = byKey.get(joinKey(r.party_id, r.candidate_name));
    const m = r.party_id ? o.partyMeta.get(r.party_id) : undefined;
    const counted = total > 0;
    const hasAffidavit = !!d && [d.age, d.assets, d.liabilities, d.criminal_cases].some(x => x != null);
    return {
      key: `${i}-${r.party_id}-${r.candidate_name}`,
      name: r.candidate_name,
      partyId: nota ? null : r.party_id || null,
      partyLabel: nota ? '' : m?.abbreviation ?? r.party_id ?? '',
      mark: nota ? null : m?.mark ?? null,
      color: (r.party_id && o.partyColor.get(r.party_id)) || 'var(--color-fallback)',
      votes: Number(r.votes) || 0,
      share: pct(Number(r.votes) || 0, total),
      pill: counted && (r.status === 'WON' || r.status === 'LEADING') ? r.status : null,
      incumbent: !!d?.is_incumbent,
      photo: d?.person?.photo_url ?? null,
      personId: nota ? null : d?.person_id ?? d?.person?.id ?? null,
      nota,
      affidavit: hasAffidavit ? { age: d!.age ?? null, assets: d!.assets ?? null, liabilities: d!.liabilities ?? null, criminalCases: d!.criminal_cases ?? null } : null,
    };
  });
  const limit = o.limit ?? Infinity;
  const shown = all.slice(0, limit);
  const rest = all.slice(limit);
  const restVotes = rest.reduce((s, c) => s + c.votes, 0);
  const leaderRow = total > 0 ? sorted.find(r => r.status === 'WON' || r.status === 'LEADING') : undefined;
  return {
    candidates: shown,
    others: rest.length ? { count: rest.length, votes: restVotes, share: pct(restVotes, total) } : null,
    totalVotes: total,
    margin: leaderRow ? Number(leaderRow.margin) || null : null,
  };
}

export function seatHistory(analysis: AnalysisEntry | null, currentYear: number): SeatHistoryEntry[] {
  const list = (analysis?.incumbency as { seat_history?: SeatHistoryEntry[] } | undefined)?.seat_history ?? [];
  return list.filter(h => h.year !== currentYear).sort((a, b) => b.year - a.year);
}

export type SeatNote = { kind: 'threeWay'; thirdVotes: number; margin: number } | { kind: 'spoiler'; party: string; votes: number; margin: number };

export function seatNotes(view: SeatView, analysis: AnalysisEntry | null): SeatNote[] {
  const notes: SeatNote[] = [];
  const ranked = view.candidates.filter(c => !c.nota);
  if (view.totalVotes > 0 && view.margin != null && ranked.length >= 3 && ranked[2].votes > view.margin) {
    notes.push({ kind: 'threeWay', thirdVotes: ranked[2].votes, margin: view.margin });
  }
  const sp = (analysis?.incumbency as { spoiler?: { spoiler_party: string; spoiler_votes: number; winner_margin: number } } | undefined)?.spoiler;
  if (sp) notes.push({ kind: 'spoiler', party: sp.spoiler_party, votes: sp.spoiler_votes, margin: sp.winner_margin });
  return notes;
}

export function detailToRows(constId: string, detail: CandidateResult[]): ResultRow[] {
  return detail.map(c => ({ const_id: constId, party_id: c.party?.id ?? (isNota(null, c.name) ? 'NOTA' : 'IND'), candidate_name: c.name, votes: c.votes, status: c.status ?? 'PENDING', margin: c.margin }));
}
```

Note on the three-way test: the leader's margin (200) is compared with the third candidate's votes (250), matching the spec copy "margin smaller than the third candidate's votes". The "limit" test: with `limit: 2`, `others` covers C, D and NOTA (150+100+50 = 300, 27.3%).

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/model/derive/__tests__/seatView.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/model/derive
git commit -m "feat(fe): seat view derivation (ranking, shares, pills, history, notes)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Seat dialog (VM + view) replaces the map seat panel

**Files:**
- Create: `frontend/src/viewmodels/tiles/useSeatDialogVM.ts`, `frontend/src/views/seat/SeatDialog.tsx`
- Delete: `frontend/src/viewmodels/tiles/useSeatPanelVM.ts`, `frontend/src/views/map/SeatPanel.tsx`
- Modify: `frontend/src/views/map/MapTile.tsx` (remove `seatPanel` prop and its column), `frontend/src/views/dashboard/DashboardGrid.tsx`, `frontend/src/pages/StudioDashboard.tsx`
- Modify tests that used `SeatPanel`/`useSeatPanelVM`: `src/views/__tests__/watchlist.test.tsx`, `src/views/__tests__/mobile.test.tsx`, `src/viewmodels/__tests__/tileVMs.more.test.tsx`
- Modify: `frontend/src/i18n/locales/en.json`, `hi.json`
- Test: `frontend/src/viewmodels/__tests__/seatDialogVM.test.tsx`, `frontend/src/views/__tests__/seatDialog.test.tsx`

**Interfaces:**
- Consumes: `buildSeatView`, `seatHistory`, `seatNotes` (Task 8); `getConstituency`, `getConstituencyAnalysis`, `ElectionService.getConstituencyCacheKey` (`model/api/election.service`); `useApi`; `useSources()` (`partyMeta`, `data.constCandidates`, `data.partyColorMap`, `election`, `watchlist`, `addWatch`, `removeWatch`); `useDashboardStore()`.
- Produces:

```ts
export interface SeatDialogVM {
  seatId: string; name: string; constNo: number | null; type: 'GEN' | 'SC' | 'ST' | null; place: string | null;
  live: { kind: 'counting'; round: { current: number; total: number } | null } | { kind: 'declared' } | null;
  electors: number | null; turnout: number | null; phase: number | null;
  view: SeatView; history: SeatHistoryEntry[]; notes: SeatNote[];
  partyMeta: Map<string, PartyMeta>;
  detailState: 'loading' | 'ready' | 'error';
  fullPageHref: string; tracked: boolean;
  onToggleTrack(): void; onClose(): void; onOpenParty(id: string): void; personHref(id: string): string;
}
export function useSeatDialogVM(): SeatDialogVM | null
```

- [ ] **Step 1: Add i18n keys**

Add to `en.json` (and the Hindi values to `hi.json`, same keys):

| key | en | hi |
|---|---|---|
| `seat_electors` | Electors | मतदाता |
| `seat_turnout` | Turnout | मतदान |
| `seat_margin` | Margin | अंतर |
| `seat_phase` | Phase | चरण |
| `seat_phase_n` | Phase {{n}} | चरण {{n}} |
| `seat_counting` | Counting | मतगणना जारी |
| `seat_round` | Round {{current}}/{{total}} | राउंड {{current}}/{{total}} |
| `seat_declared` | Declared | घोषित |
| `seat_rank_candidate` | Rank & candidate | क्रम व उम्मीदवार |
| `seat_party` | Party | दल |
| `seat_votes` | Votes | वोट |
| `seat_share` | Share | हिस्सा |
| `seat_status` | Status | स्थिति |
| `seat_incumbent` | Incumbent | मौजूदा विधायक/सांसद |
| `seat_others` | +{{count}} others | +{{count}} अन्य |
| `seat_past_winners` | Past winners | पिछले विजेता |
| `seat_three_way` | 3-way contest: margin smaller than the third candidate's votes | त्रिकोणीय मुकाबला: अंतर तीसरे उम्मीदवार के वोटों से कम |
| `seat_spoiler` | {{party}} polled {{votes}} votes, more than the {{margin}} margin | {{party}} को {{votes}} वोट मिले, जो {{margin}} के अंतर से अधिक हैं |
| `seat_full_page` | Full constituency page | पूरा निर्वाचन क्षेत्र पृष्ठ |
| `seat_details_unavailable` | Details unavailable | विवरण उपलब्ध नहीं |
| `seat_nota` | NOTA | नोटा |

- [ ] **Step 2: Write the failing VM test**

`frontend/src/viewmodels/__tests__/seatDialogVM.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { makeSources } from './fixtures';
import { DashboardSourcesProvider } from '../sources/DashboardSourcesProvider';
import { DashboardStoreProvider, useDashboardStore } from '../store/DashboardStoreProvider';

const getConstituency = vi.fn();
const getConstituencyAnalysis = vi.fn();
vi.mock('../../model/api/election.service', async (orig) => ({
  ...(await orig<typeof import('../../model/api/election.service')>()),
  getConstituency: (...a: unknown[]) => getConstituency(...a),
  getConstituencyAnalysis: (...a: unknown[]) => getConstituencyAnalysis(...a),
}));

import { useSeatDialogVM } from '../tiles/useSeatDialogVM';

function wrap(url: string, sources = makeSources()) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>
      <DashboardSourcesProvider value={sources}>
        <DashboardStoreProvider allowedLayers={sources.availableLayers} knownSeats={null} knownParties={null}>{children}</DashboardStoreProvider>
      </DashboardSourcesProvider>
    </MemoryRouter>
  );
}

describe('useSeatDialogVM', () => {
  it('is null without a selected seat', () => {
    const { result } = renderHook(() => useSeatDialogVM(), { wrapper: wrap('/') });
    expect(result.current).toBeNull();
  });

  it('shows live rows at once and the facts once the detail arrives', async () => {
    getConstituency.mockResolvedValue({ id: 'BR_VS_1_SANDESH', name: 'Sandesh', const_no: 1, type: 'SC', total_electors: 2000, voter_turnout: 59.4, phase: 1,
      current_round: null, total_rounds: null, last_updated: null, state: { id: 4, name: 'Bihar' }, district: { id: 1, name: 'Bhojpur' }, candidates: [] });
    getConstituencyAnalysis.mockResolvedValue(null);
    const { result } = renderHook(() => useSeatDialogVM(), { wrapper: wrap('/?seat=BR_VS_1_SANDESH') });
    expect(result.current?.view.candidates.map(c => c.name)).toEqual(['RADHA CHARAN SAH', 'R']);
    expect(result.current?.detailState).toBe('loading');
    await waitFor(() => expect(result.current?.detailState).toBe('ready'));
    expect(result.current).toMatchObject({ name: 'Sandesh', type: 'SC', place: 'Bhojpur · Bihar', electors: 2000, turnout: 59.4, phase: 1, live: { kind: 'declared' } });
  });

  it('a failed detail keeps the live rows and reports error', async () => {
    getConstituency.mockRejectedValue(new Error('boom'));
    getConstituencyAnalysis.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSeatDialogVM(), { wrapper: wrap('/?seat=BR_VS_1_SANDESH') });
    await waitFor(() => expect(result.current?.detailState).toBe('error'));
    expect(result.current?.view.candidates).toHaveLength(2);
  });

  it('opening a party from the dialog selects it in the store', () => {
    getConstituency.mockResolvedValue(null);
    getConstituencyAnalysis.mockResolvedValue(null);
    const { result } = renderHook(() => ({ vm: useSeatDialogVM(), store: useDashboardStore() }), { wrapper: wrap('/?seat=BR_VS_1_SANDESH') });
    act(() => result.current.vm!.onOpenParty('JDU'));
    expect(result.current.store.state.selectedParty).toBe('JDU');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/viewmodels/__tests__/seatDialogVM.test.tsx`
Expected: FAIL — `../tiles/useSeatDialogVM` not found.

- [ ] **Step 4: Implement the VM**

`frontend/src/viewmodels/tiles/useSeatDialogVM.ts`:

```ts
import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { useApi } from '../data/useApi';
import { getConstituency, getConstituencyAnalysis, ElectionService } from '../../model/api/election.service';
import { displayNameFromConstId } from '../../model/geo/regionMatching';
import { buildSeatView, seatHistory, seatNotes, type SeatView, type SeatNote } from '../../model/derive/seatView';
import type { PartyMeta } from '../../model/derive/partyMeta';
import type { SeatHistoryEntry } from '../../model/types';

export interface SeatDialogVM {
  seatId: string; name: string; constNo: number | null; type: 'GEN' | 'SC' | 'ST' | null; place: string | null;
  live: { kind: 'counting'; round: { current: number; total: number } | null } | { kind: 'declared' } | null;
  electors: number | null; turnout: number | null; phase: number | null;
  view: SeatView; history: SeatHistoryEntry[]; notes: SeatNote[];
  partyMeta: Map<string, PartyMeta>;
  detailState: 'loading' | 'ready' | 'error';
  fullPageHref: string; tracked: boolean;
  onToggleTrack(): void; onClose(): void; onOpenParty(id: string): void; personHref(id: string): string;
}

const DIALOG_ROWS = 5;

export function useSeatDialogVM(): SeatDialogVM | null {
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const id = state.selectedSeat;
  const eid = src.election.id;
  // Refetch while open on every new live version, so the counting round follows the snapshot (CDN-cached ~60 s).
  const version = src.election.status === 'Live' ? src.data.liveVersion : null;
  const detail = useApi(() => (id ? getConstituency(eid, id) : Promise.resolve(null)), [eid, id, version], { key: id ? `${ElectionService.getConstituencyCacheKey(eid, id)}_v${version ?? ''}` : undefined });
  const analysis = useApi(() => (id ? getConstituencyAnalysis(eid, id).catch(() => null) : Promise.resolve(null)), [eid, id], { key: id ? `${ElectionService.getConstituencyCacheKey(eid, id)}_analysis` : undefined });
  const rows = id ? src.data.constCandidates.get(id) : undefined;
  const view = useMemo(
    () => buildSeatView(rows ?? [], { partyMeta: src.partyMeta, partyColor: src.data.partyColorMap, detail: detail.data?.candidates ?? null, limit: DIALOG_ROWS }),
    [rows, src.partyMeta, src.data.partyColorMap, detail.data],
  );
  if (!id) return null;
  const d = detail.data;
  const tracked = src.watchlist.some(w => w.const_id === id);
  const name = d?.name ?? displayNameFromConstId(id);
  const allDeclared = (rows ?? []).some(r => r.status === 'WON');
  const live: SeatDialogVM['live'] =
    src.election.status === 'Upcoming' ? null
    : src.election.status === 'Finalized' || allDeclared ? { kind: 'declared' }
    : { kind: 'counting', round: d?.current_round && d.total_rounds ? { current: d.current_round, total: d.total_rounds } : null };
  const fullAnalysis = analysis.data ?? null;
  return {
    seatId: id,
    name,
    constNo: d?.const_no ?? null,
    type: d?.type ?? rows?.[0]?.const_type ?? null,
    place: [d?.district?.name, d?.state?.name].filter(Boolean).join(' · ') || null,
    live,
    electors: d?.total_electors ?? null,
    turnout: d?.voter_turnout != null ? Number(d.voter_turnout) : null,
    phase: d?.phase ?? null,
    view,
    history: seatHistory(fullAnalysis, src.election.year),
    notes: seatNotes(view, fullAnalysis),
    partyMeta: src.partyMeta,
    detailState: detail.error ? 'error' : d ? 'ready' : 'loading',
    fullPageHref: `/election/${eid}/constituency/${id}`,
    tracked,
    onToggleTrack: () => (tracked ? src.removeWatch(id) : src.addWatch(id, name)),
    onClose: () => dispatch({ type: 'selectSeat', seat: null }),
    onOpenParty: pid => dispatch({ type: 'selectParty', party: pid }),
    personHref: pid => `/person/${pid}`,
  };
}
```

(`useApi` returns `{ data, loading, error, refetch }`; confirm the `error` field name in `viewmodels/data/useApi.ts` and adapt. Hooks are called before the early `return null` so hook order is stable.)

- [ ] **Step 5: Write the failing view test**

`frontend/src/views/__tests__/seatDialog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { SeatDialog } from '../seat/SeatDialog';
import type { SeatDialogVM } from '../../viewmodels/tiles/useSeatDialogVM';

beforeAll(() => { window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never; });
afterEach(cleanup);

const vm = (over: Partial<SeatDialogVM> = {}): SeatDialogVM => ({
  seatId: 'S', name: 'Patliputra', constNo: 30, type: 'SC', place: 'Patna · Bihar', live: { kind: 'counting', round: { current: 12, total: 24 } },
  electors: 2014532, turnout: 59.4, phase: 7,
  view: { totalVotes: 1000, margin: 200, others: { count: 4, votes: 20, share: 2 }, candidates: [
    { key: 'a', name: 'Ram Kripal Yadav', partyId: 'BJP', partyLabel: 'BJP', mark: '/l.svg', color: '#f80', votes: 600, share: 60, pill: 'LEADING', incumbent: true, photo: null, personId: 'p1', nota: false, affidavit: null },
    { key: 'b', name: 'Misa Bharti', partyId: 'RJD', partyLabel: 'RJD', mark: null, color: '#0a0', votes: 380, share: 38, pill: null, incumbent: false, photo: null, personId: null, nota: false, affidavit: null },
  ] },
  history: [{ year: 2020, party: 'BJP', candidate: 'X', margin: 1, vote_share: 50.5 }], notes: [{ kind: 'threeWay', thirdVotes: 300, margin: 200 }],
  partyMeta: new Map(), detailState: 'ready', fullPageHref: '/election/e/constituency/S', tracked: false,
  onToggleTrack: vi.fn(), onClose: vi.fn(), onOpenParty: vi.fn(), personHref: id => `/person/${id}`, ...over,
});

const renderIt = (v: SeatDialogVM) => render(<MemoryRouter><SeatDialog vm={v} /></MemoryRouter>);

describe('SeatDialog', () => {
  it('shows header facts, stats, ranked candidates and the full-page link', () => {
    renderIt(vm());
    const dlg = screen.getByRole('dialog', { name: 'Patliputra' });
    expect(within(dlg).getByText('No. 30 · SC')).toBeInTheDocument();
    expect(within(dlg).getByText('Patna · Bihar')).toBeInTheDocument();
    expect(within(dlg).getByText('20,14,532')).toBeInTheDocument();
    expect(within(dlg).getByText(/Round 12\/24/)).toBeInTheDocument();
    expect(within(dlg).getAllByText('Leading')).toHaveLength(1);
    expect(within(dlg).getByText('+4 others')).toBeInTheDocument();
    expect(within(dlg).getByRole('link', { name: /Full constituency page/ })).toHaveAttribute('href', '/election/e/constituency/S');
    expect(within(dlg).getByText(/3-way contest/)).toBeInTheDocument();
  });

  it('links a candidate with a person, opens the party dialog from the party cell', () => {
    const v = vm();
    renderIt(v);
    expect(screen.getByRole('link', { name: 'Ram Kripal Yadav' })).toHaveAttribute('href', '/person/p1');
    expect(screen.queryByRole('link', { name: 'Misa Bharti' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /BJP/ }));
    expect(v.onOpenParty).toHaveBeenCalledWith('BJP');
  });

  it('hides unknown stats and shows the unavailable line on error', () => {
    renderIt(vm({ electors: null, turnout: null, phase: null, detailState: 'error' }));
    expect(screen.queryByText('Electors')).toBeNull();
    expect(screen.getByText('Details unavailable')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Implement the view**

`frontend/src/views/seat/SeatDialog.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SeatDialogVM } from '../../viewmodels/tiles/useSeatDialogVM';
import { DetailDialog } from '../ui/DetailDialog';
import { PartyMark } from '../ui/PartyMark';
import { Avatar } from '../ui/Avatar';
import { formatIN } from '../ui/format';
import { STATUS_STYLE } from '../dashboard/statusStyle';
import { cn } from '../ui/cn';

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' }) {
  return (
    <div className="rounded-tile border border-line bg-page/40 px-3 py-2 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={cn('tabular font-display text-xl font-bold text-ink', tone === 'ok' && 'text-ok-text')}>{value}</div>
    </div>
  );
}

export function LiveChip({ live }: { live: SeatDialogVM['live'] }) {
  const { t } = useTranslation();
  if (!live) return null;
  if (live.kind === 'declared') return <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-muted">{t('seat_declared')}</span>;
  const parts = [t('seat_counting')];
  if (live.round) parts.push(t('seat_round', live.round));
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ok-text/40 bg-ok-tint px-2.5 py-0.5 text-xs font-semibold text-ok-text">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok-text" aria-hidden />{parts.join(' · ')}
    </span>
  );
}

export function SeatDialog({ vm }: { vm: SeatDialogVM | null }) {
  const { t } = useTranslation();
  if (!vm) return null;
  const stats = [
    vm.electors != null && <Stat key="e" label={t('seat_electors')} value={formatIN(vm.electors)} />,
    vm.turnout != null && <Stat key="t" label={t('seat_turnout')} value={`${vm.turnout}%`} />,
    vm.view.margin != null && <Stat key="m" label={t('seat_margin')} value={`+${formatIN(vm.view.margin)}`} tone="ok" />,
    vm.phase != null && <Stat key="p" label={t('seat_phase')} value={t('seat_phase_n', { n: vm.phase })} />,
  ].filter(Boolean);
  const header = (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
      {(vm.constNo != null || vm.type) && <span className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-ink">{[vm.constNo != null && `No. ${vm.constNo}`, vm.type && vm.type !== 'GEN' && vm.type].filter(Boolean).join(' · ')}</span>}
      {vm.place && <span>{vm.place}</span>}
      <LiveChip live={vm.live} />
      <button type="button" onClick={vm.onToggleTrack} aria-pressed={vm.tracked}
        className="rounded-full border border-line px-3 py-0.5 text-xs font-semibold text-muted hover:border-accent hover:text-ink aria-pressed:border-accent aria-pressed:text-accent">
        {vm.tracked ? t('studio_tracked') : t('studio_track')}
      </button>
    </div>
  );
  return (
    <DetailDialog open title={vm.name} onClose={vm.onClose} header={header}>
      {stats.length > 0 && <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{stats}</div>}
      {vm.detailState === 'error' && <p className="mb-2 text-xs text-muted">{t('seat_details_unavailable')}</p>}
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
          <th className="py-2 font-semibold">{t('seat_rank_candidate')}</th><th className="font-semibold">{t('seat_party')}</th>
          <th className="text-right font-semibold">{t('seat_votes')}</th><th className="pl-3 font-semibold">{t('seat_share')}</th><th className="text-right font-semibold">{t('seat_status')}</th>
        </tr></thead>
        <tbody>
          {vm.view.candidates.map((c, i) => (
            <tr key={c.key} className="border-b border-line/60">
              <td className="py-2"><div className="flex items-center gap-2">
                <span className="w-6 text-xs text-muted">#{i + 1}</span>
                <Avatar name={c.name} photo={c.photo} size={36} />
                {c.personId ? <Link to={vm.personHref(c.personId)} className="font-semibold text-ink hover:underline">{c.name}</Link> : <span className="font-semibold text-ink">{c.nota ? t('seat_nota') : c.name}</span>}
                {c.incumbent && <span className="rounded-full border border-accent/50 px-1.5 text-[10px] text-accent">{t('seat_incumbent')}</span>}
              </div></td>
              <td>{c.partyId ? (
                <button type="button" onClick={() => vm.onOpenParty(c.partyId!)} className="flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-tile-raised">
                  <PartyMark mark={c.mark} color={c.color} label={c.partyLabel} size={24} /><span className="text-ink">{c.partyLabel}</span>
                </button>) : null}</td>
              <td className="tabular text-right font-semibold text-ink">{formatIN(c.votes)}</td>
              <td className="pl-3"><div className="flex items-center gap-2"><span className="tabular w-12 text-xs text-ink">{c.share}%</span>
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-page"><span className="block h-full" style={{ width: `${c.share}%`, background: c.color }} /></span></div></td>
              <td className="text-right">{c.pill && <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold', STATUS_STYLE[c.pill])}>{t(`studio_status_${c.pill.toLowerCase()}`)}</span>}</td>
            </tr>
          ))}
          {vm.view.others && (
            <tr><td className="py-2 pl-8 text-muted">{t('seat_others', { count: vm.view.others.count })}</td><td /><td className="tabular text-right text-muted">{formatIN(vm.view.others.votes)}</td><td className="pl-3 text-xs text-muted">{vm.view.others.share}%</td><td /></tr>
          )}
        </tbody>
      </table>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {vm.history.length > 0 && <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t('seat_past_winners')}</span>}
        {vm.history.map(h => {
          const m = h.party ? vm.partyMeta.get(h.party) : undefined;
          return (
            <span key={h.year} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-xs text-ink">
              {h.year}<PartyMark mark={m?.mark ?? null} color={m?.color ?? null} label={m?.abbreviation ?? h.party ?? ''} />{m?.abbreviation ?? h.party}{h.vote_share != null && ` · ${h.vote_share}%`}
            </span>
          );
        })}
        <Link to={vm.fullPageHref} className="ml-auto text-sm font-semibold text-accent hover:underline">{t('seat_full_page')} →</Link>
      </div>
      {vm.notes.map(n => (
        <p key={n.kind} className="mt-3 rounded-tile border border-warn/50 bg-warn/10 px-3 py-2 text-xs text-warn-text">
          ⚠ {n.kind === 'threeWay' ? t('seat_three_way') : t('seat_spoiler', { party: n.party, votes: formatIN(n.votes), margin: formatIN(n.margin) })}
        </p>
      ))}
    </DetailDialog>
  );
}
```

Check the colour tokens exist in `src/theme/studio.css` (`ok-text`, `ok-tint`, `accent`, `warn`?). If there is no `warn` token, use the amber token the dashboard already uses for warnings (`grep -n "amber\|warn" src/theme/studio.css`) — do not add raw hex colours.

No "updated X ago" in the chip: the detail response can be minutes older than the snapshot votes beside it (CDN `s-maxage=60` + `stale-while-revalidate=300`), so a timestamp there would be misleading (D9).

- [ ] **Step 7: Wire it in and remove the seat panel**

- `MapTile.tsx`: remove the `seatPanel` prop from the signature and delete the wrapper that rendered it (line ~31), so the focus map uses the full width.
- `DashboardGrid.tsx`: replace `seatPanel: SeatPanelVM | null` in `DashboardViewProps` with `seatDialog: SeatDialogVM | null`; remove the `SeatPanel` import; `case 'map': return <MapTile vm={p.map} variant="focus" />;`; render `<SeatDialog vm={p.seatDialog} />` right after `{overlay}` in both the mobile and desktop return.
- `StudioDashboard.tsx`: `import { useSeatDialogVM } from '../viewmodels/tiles/useSeatDialogVM';` and pass `seatDialog={useSeatDialogVM()}` instead of `seatPanel={useSeatPanelVM()}`.
- `git rm frontend/src/viewmodels/tiles/useSeatPanelVM.ts frontend/src/views/map/SeatPanel.tsx`.
- In `watchlist.test.tsx`, `mobile.test.tsx` and `tileVMs.more.test.tsx`: remove the SeatPanel / useSeatPanelVM cases; move the "Track toggles the watchlist" assertion into `seatDialog.test.tsx` (`fireEvent.click(screen.getByRole('button', { name: /Track/ }))` → `onToggleTrack` called).

- [ ] **Step 8: Run tests**

Run: `cd frontend && npx vitest run && npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: PASS.

Before committing, add the `docs/FEATURES.md` entry for this task (CLAUDE.md: document every feature before or during implementation): seat dialog — opened by any seat click (map, search, leaders, stats, summary, watchlist), contents, live numbers from the snapshot and facts from the CDN-cached detail endpoint, counting round refreshed on each live version; party marks (logo → ECI symbol → dot).

- [ ] **Step 9: Commit**

```bash
git add docs/FEATURES.md -A frontend/src
git commit -m "feat(fe): seat dialog with results and constituency info replaces the map seat panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Party dialog and party marks in standings, leaders, watchlist and the map tooltip

**Files:**
- Create: `frontend/src/model/derive/partyElection.ts`, `frontend/src/viewmodels/tiles/usePartyDialogVM.ts`, `frontend/src/views/party/PartyDialog.tsx`
- Modify: `frontend/src/viewmodels/tiles/useStandingsVM.ts`, `useLeadersVM.ts`, `useMapVM.ts`; `frontend/src/views/dashboard/StandingsTile.tsx`, `LeadersStrip.tsx`, `DashboardGrid.tsx`; `frontend/src/views/map/MapCanvas.tsx`; `frontend/src/pages/StudioDashboard.tsx`; i18n files
- Test: `frontend/src/model/derive/__tests__/partyElection.test.ts`, `frontend/src/viewmodels/__tests__/partyDialogVM.test.tsx`, `frontend/src/views/__tests__/partyDialog.test.tsx`; update `watchlist.test.tsx` VM literals

**Interfaces:**
- Consumes: `PartyMeta`, `getParty` (Task 4); `useSources()`; `deriveLeaderCards`, `collectLeaderEntries` (`model/derive/leaders`).
- Produces:

```ts
// model/derive/partyElection.ts
export interface PartyElectionStats { won: number; leading: number; contested: number; votePct: number | null; alliance: { id: string; name: string } | null }
export function partyElectionStats(partyId: string, results: ResultRow[], votePct: Map<string, number>, alliances: { id: string; name: string; parties: string[] }[]): PartyElectionStats

// viewmodels/tiles/usePartyDialogVM.ts
export interface PartyDialogVM {
  id: string; name: string; abbreviation: string | null; mark: string | null; color: string | null;
  recognition: 'National' | 'State' | 'Unrecognised' | null;
  electionName: string; stats: PartyElectionStats; totalSeats: number; majority: number;
  profile: { leader: string | null; founded: number | null; hq: string | null; website: string | null; wikipedia: string | null; description: string | null } | null;
  keyCandidates: LeaderCard[];
  onClose(): void; onSelectSeat(id: string): void;
}
export function usePartyDialogVM(): PartyDialogVM | null
```

- `StandingsVM` and `LeadersVM` gain `markOf(partyId: string): string | null` and `onOpenParty(partyId: string): void`.
- `MapVM.seatInfo` result gains `mark: string | null`, `type: 'GEN'|'SC'|'ST'|null`.

- [ ] **Step 1: i18n keys** (en / hi)

| key | en | hi |
|---|---|---|
| `party_this_election` | This election — {{name}} | यह चुनाव — {{name}} |
| `party_won` | Won | जीते |
| `party_leading` | Leading | आगे |
| `party_contested` | Contested | लड़े |
| `party_vote_share` | Vote share | वोट हिस्सा |
| `party_majority` | Majority {{n}} | बहुमत {{n}} |
| `party_leader` | Leader | नेता |
| `party_founded` | Founded | स्थापना |
| `party_hq` | Headquarters | मुख्यालय |
| `party_alliance` | Alliance | गठबंधन |
| `party_website` | Website | वेबसाइट |
| `party_wikipedia` | Wikipedia | विकिपीडिया |
| `party_key_candidates` | Key candidates | प्रमुख उम्मीदवार |
| `party_recognition_National` | National party | राष्ट्रीय दल |
| `party_recognition_State` | State party | राज्य दल |
| `party_recognition_Unrecognised` | Unrecognised party | गैर-मान्यता प्राप्त दल |
| `party_details` | Party details: {{name}} | दल का विवरण: {{name}} |

- [ ] **Step 2: Write the failing derivation test**

`frontend/src/model/derive/__tests__/partyElection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { partyElectionStats } from '../partyElection';
import type { ResultRow } from '../../types';

const r = (const_id: string, party_id: string, status: string): ResultRow => ({ const_id, party_id, candidate_name: 'x', votes: 1, status, margin: 0 });

describe('partyElectionStats', () => {
  it('counts won, leading and contested seats, with vote share and alliance', () => {
    const rows = [r('A', 'RJD', 'WON'), r('B', 'RJD', 'LEADING'), r('C', 'RJD', 'TRAILING'), r('C', 'RJD', 'TRAILING'), r('A', 'BJP', 'LOST')];
    expect(partyElectionStats('RJD', rows, new Map([['RJD', 23.1]]), [{ id: 'MGB', name: 'Mahagathbandhan', parties: ['RJD'] }]))
      .toEqual({ won: 1, leading: 1, contested: 3, votePct: 23.1, alliance: { id: 'MGB', name: 'Mahagathbandhan' } });
  });
  it('a party with no rows has zeros and no alliance', () => {
    expect(partyElectionStats('X', [], new Map(), [])).toEqual({ won: 0, leading: 0, contested: 0, votePct: null, alliance: null });
  });
});
```

- [ ] **Step 3: Run it (FAIL), then implement**

Run: `cd frontend && npx vitest run src/model/derive/__tests__/partyElection.test.ts` → FAIL (module missing).

`frontend/src/model/derive/partyElection.ts`:

```ts
import type { ResultRow } from '../types';

export interface PartyElectionStats { won: number; leading: number; contested: number; votePct: number | null; alliance: { id: string; name: string } | null }

export function partyElectionStats(partyId: string, results: ResultRow[], votePct: Map<string, number>, alliances: { id: string; name: string; parties: string[] }[]): PartyElectionStats {
  const seats = new Set<string>();
  let won = 0, leading = 0;
  for (const r of results) {
    if (r.party_id !== partyId) continue;
    seats.add(r.const_id);
    if (r.status === 'WON') won++;
    else if (r.status === 'LEADING') leading++;
  }
  const a = alliances.find(x => x.parties.includes(partyId));
  return { won, leading, contested: seats.size, votePct: votePct.get(partyId) ?? null, alliance: a ? { id: a.id, name: a.name } : null };
}
```

Run again → PASS.

- [ ] **Step 4: Write the failing VM test**

`frontend/src/viewmodels/__tests__/partyDialogVM.test.tsx` (same wrapper as Task 9; mock `../../model/api/geo.service`):

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { makeSources } from './fixtures';
import { DashboardSourcesProvider } from '../sources/DashboardSourcesProvider';
import { DashboardStoreProvider, useDashboardStore } from '../store/DashboardStoreProvider';

const getParty = vi.fn();
vi.mock('../../model/api/geo.service', async (orig) => ({ ...(await orig<typeof import('../../model/api/geo.service')>()), getParty: (...a: unknown[]) => getParty(...a) }));

import { usePartyDialogVM } from '../tiles/usePartyDialogVM';

const wrap = (url: string) => ({ children }: { children: ReactNode }) => {
  const s = makeSources();
  return <MemoryRouter initialEntries={[url]}><DashboardSourcesProvider value={s}><DashboardStoreProvider allowedLayers={s.availableLayers} knownSeats={null} knownParties={null}>{children}</DashboardStoreProvider></DashboardSourcesProvider></MemoryRouter>;
};

describe('usePartyDialogVM', () => {
  it('combines meta, this election and the profile', async () => {
    getParty.mockResolvedValue({ id: 'JDU', name: 'Janata Dal (United)', leader_name: 'Nitish Kumar', founded_year: 2003, headquarters: null, website: null, wikipedia_url: null, description: null });
    const { result } = renderHook(() => usePartyDialogVM(), { wrapper: wrap('/?party=JDU') });
    expect(result.current).toMatchObject({ id: 'JDU', abbreviation: 'JD(U)', stats: { won: 2, contested: 2, alliance: { id: 'NDA' } }, totalSeats: 243, majority: 122 });
    await waitFor(() => expect(result.current?.profile?.leader).toBe('Nitish Kumar'));
    expect(result.current?.profile).toMatchObject({ founded: 2003, hq: null });
  });

  it('picking a key candidate closes the party and opens the seat', () => {
    getParty.mockResolvedValue(null);
    const { result } = renderHook(() => ({ vm: usePartyDialogVM(), s: useDashboardStore() }), { wrapper: wrap('/?party=JDU') });
    act(() => result.current.vm!.onSelectSeat('BR_VS_1_SANDESH'));
    expect(result.current.s.state).toMatchObject({ selectedParty: null, selectedSeat: 'BR_VS_1_SANDESH' });
  });
});
```

Run → FAIL (module missing).

- [ ] **Step 5: Implement the VM**

`frontend/src/viewmodels/tiles/usePartyDialogVM.ts`:

```ts
import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { useApi } from '../data/useApi';
import { getParty } from '../../model/api/geo.service';
import { partyElectionStats, type PartyElectionStats } from '../../model/derive/partyElection';
import { collectLeaderEntries, deriveLeaderCards, type LeaderCard } from '../../model/derive/leaders';

export interface PartyDialogVM {
  id: string; name: string; abbreviation: string | null; mark: string | null; color: string | null;
  recognition: 'National' | 'State' | 'Unrecognised' | null;
  electionName: string; stats: PartyElectionStats; totalSeats: number; majority: number;
  profile: { leader: string | null; founded: number | null; hq: string | null; website: string | null; wikipedia: string | null; description: string | null } | null;
  keyCandidates: LeaderCard[];
  onClose(): void; onSelectSeat(id: string): void;
}

export function usePartyDialogVM(): PartyDialogVM | null {
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const id = state.selectedParty;
  const { data: party } = useApi(() => (id ? getParty(id).catch(() => null) : Promise.resolve(null)), [id], { key: id ? `party_${id}` : undefined });
  const alliances = src.data.manifestData?.alliances ?? [];
  const stats = useMemo(() => (id ? partyElectionStats(id, src.data.results, src.votePct, alliances) : null), [id, src.data.results, src.votePct, alliances]);
  const keyCandidates = useMemo(
    () => (id ? deriveLeaderCards(collectLeaderEntries(src.data.manifestData, []), src.data.currentWinnerMap).filter(c => c.partyId === id) : []),
    [id, src.data.manifestData, src.data.currentWinnerMap],
  );
  if (!id || !stats) return null;
  const m = src.partyMeta.get(id);
  return {
    id,
    name: m?.name ?? src.data.partyNameMap.get(id) ?? id,
    abbreviation: m?.abbreviation ?? null,
    mark: m?.mark ?? null,
    color: src.data.partyColorMap.get(id) ?? m?.color ?? null,
    recognition: m?.eciRecognition ?? null,
    electionName: src.election.name,
    stats,
    totalSeats: src.totalSeats,
    majority: src.majority,
    profile: party ? { leader: party.leader_name, founded: party.founded_year, hq: party.headquarters, website: party.website, wikipedia: party.wikipedia_url, description: party.description } : null,
    keyCandidates,
    onClose: () => dispatch({ type: 'selectParty', party: null }),
    onSelectSeat: seat => { dispatch({ type: 'selectParty', party: null }); dispatch({ type: 'selectSeat', seat }); },
  };
}
```

(If the fixture's `manifestData.alliances` entries carry `name`, `stats.alliance` gets it; check `ManifestAlliance` in `model/types` and pass `{ id, name, parties }`.)

- [ ] **Step 6: Write the failing view test, then implement `PartyDialog`**

`frontend/src/views/__tests__/partyDialog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '../../i18n';
import { PartyDialog } from '../party/PartyDialog';
import type { PartyDialogVM } from '../../viewmodels/tiles/usePartyDialogVM';

beforeAll(() => { window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never; });
afterEach(cleanup);

const vm = (over: Partial<PartyDialogVM> = {}): PartyDialogVM => ({
  id: 'RJD', name: 'Rashtriya Janata Dal', abbreviation: 'RJD', mark: '/r.svg', color: '#0a0', recognition: 'State', electionName: 'Bihar Vidhan Sabha 2025',
  stats: { won: 52, leading: 23, contested: 143, votePct: 23.1, alliance: { id: 'MGB', name: 'Mahagathbandhan' } }, totalSeats: 243, majority: 122,
  profile: { leader: 'Tejashwi Yadav', founded: 1997, hq: null, website: 'https://rjd.co.in', wikipedia: null, description: null },
  keyCandidates: [{ key: 'k', name: 'Tejashwi Yadav', constId: 'S', constName: 'Raghopur', partyId: 'RJD', status: 'WON', margin: 10, custom: false }],
  onClose: vi.fn(), onSelectSeat: vi.fn(), ...over,
});

describe('PartyDialog', () => {
  it('shows mark, recognition, this election, the non-empty profile fields and key candidates', () => {
    const v = vm();
    render(<PartyDialog vm={v} />);
    expect(screen.getByRole('dialog', { name: 'Rashtriya Janata Dal' })).toBeInTheDocument();
    expect(screen.getByText('State party')).toBeInTheDocument();
    expect(screen.getByText('52')).toBeInTheDocument();
    expect(screen.getByText('23.1%')).toBeInTheDocument();
    expect(screen.getByText('1997')).toBeInTheDocument();
    expect(screen.getByText('Mahagathbandhan')).toBeInTheDocument();
    expect(screen.queryByText('Headquarters')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Tejashwi Yadav/ }));
    expect(v.onSelectSeat).toHaveBeenCalledWith('S');
  });

  it('hides the profile and key candidates when there are none', () => {
    render(<PartyDialog vm={vm({ profile: null, keyCandidates: [] })} />);
    expect(screen.queryByText('Leader')).toBeNull();
    expect(screen.queryByText('Key candidates')).toBeNull();
  });
});
```

`frontend/src/views/party/PartyDialog.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import type { PartyDialogVM } from '../../viewmodels/tiles/usePartyDialogVM';
import { DetailDialog } from '../ui/DetailDialog';
import { PartyMark } from '../ui/PartyMark';
import { STATUS_STYLE } from '../dashboard/statusStyle';
import { cn } from '../ui/cn';

function Big({ label, value, tone }: { label: string; value: string; tone?: boolean }) {
  return <div className="rounded-tile border border-line bg-page/40 px-3 py-2 text-center"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div><div className={cn('tabular font-display text-3xl font-bold', tone ? 'text-ok-text' : 'text-ink')}>{value}</div></div>;
}

export function PartyDialog({ vm }: { vm: PartyDialogVM | null }) {
  const { t } = useTranslation();
  if (!vm) return null;
  const { stats } = vm;
  const pct = (n: number) => `${(n / Math.max(vm.totalSeats, 1)) * 100}%`;
  const fields = vm.profile ? ([
    ['party_leader', vm.profile.leader], ['party_founded', vm.profile.founded?.toString() ?? null], ['party_hq', vm.profile.hq], ['party_alliance', stats.alliance?.name ?? null],
  ] as const).filter(([, v]) => v) : (stats.alliance ? [['party_alliance', stats.alliance.name] as const] : []);
  const links = vm.profile ? ([['party_website', vm.profile.website], ['party_wikipedia', vm.profile.wikipedia]] as const).filter(([, v]) => v) : [];
  const header = (
    <div className="mt-1 flex items-center gap-2 text-sm text-muted">
      <PartyMark mark={vm.mark} color={vm.color} label={vm.abbreviation ?? vm.id} size={40} />
      {vm.abbreviation && <span className="font-semibold text-ink">{vm.abbreviation}</span>}
      {vm.recognition && <span className="rounded-md border border-line px-2 py-0.5 text-xs">{t(`party_recognition_${vm.recognition}`)}</span>}
    </div>
  );
  return (
    <DetailDialog open title={vm.name} onClose={vm.onClose} header={header}>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{t('party_this_election', { name: vm.electionName })}</h3>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Big label={t('party_won')} value={String(stats.won)} tone /><Big label={t('party_leading')} value={String(stats.leading)} tone />
        <Big label={t('party_contested')} value={String(stats.contested)} />
        {stats.votePct != null && <Big label={t('party_vote_share')} value={`${stats.votePct}%`} />}
      </div>
      <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-page" role="img" aria-label={`${stats.won + stats.leading} / ${vm.totalSeats}`}>
        <span className="absolute inset-y-0 left-0" style={{ width: pct(stats.won), background: vm.color ?? 'var(--color-fallback)' }} />
        <span className="absolute inset-y-0 opacity-60 [background-image:repeating-linear-gradient(45deg,transparent_0_4px,rgba(0,0,0,.35)_4px_8px)]" style={{ left: pct(stats.won), width: pct(stats.leading), backgroundColor: vm.color ?? 'var(--color-fallback)' }} />
        <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: pct(vm.majority) }} />
      </div>
      <p className="mt-1 text-right text-xs text-muted">{t('party_majority', { n: vm.majority })}</p>
      {(fields.length > 0 || links.length > 0 || vm.profile?.description) && (
        <div className="mt-4 rounded-tile border border-line p-3">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {fields.map(([k, v]) => <div key={k}><dt className="text-[11px] uppercase tracking-wider text-muted">{t(k)}</dt><dd className="font-semibold text-ink">{v}</dd></div>)}
            {links.map(([k, v]) => <div key={k}><dt className="text-[11px] uppercase tracking-wider text-muted">{t(k)}</dt><dd><a href={v!} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{t(k)} ↗</a></dd></div>)}
          </dl>
          {vm.profile?.description && <p className="mt-3 text-sm text-muted">{vm.profile.description}</p>}
        </div>
      )}
      {vm.keyCandidates.length > 0 && (
        <>
          <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">{t('party_key_candidates')}</h3>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {vm.keyCandidates.map(c => (
              <button key={c.key} type="button" onClick={() => vm.onSelectSeat(c.constId)} className="rounded-tile border border-line p-2 text-left hover:bg-tile-raised">
                <div className="truncate font-semibold text-ink">{c.name}</div><div className="truncate text-xs text-muted">{c.constName}</div>
                <span className={cn('mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-bold', STATUS_STYLE[c.status])}>{t(`studio_status_${c.status.toLowerCase()}`)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </DetailDialog>
  );
}
```

Run `npx vitest run src/views/__tests__/partyDialog.test.tsx src/viewmodels/__tests__/partyDialogVM.test.tsx` → PASS.

- [ ] **Step 7: Marks and party buttons in the existing tiles**

`useStandingsVM.ts`: add to `StandingsVM` and the returned object:

```ts
  markOf(partyId: string): string | null;
  onOpenParty(partyId: string): void;
```
```ts
    markOf: id => src.partyMeta.get(id)?.mark ?? null,
    onOpenParty: id => dispatch({ type: 'selectParty', party: id }),
```

`useLeadersVM.ts`: same two members (`markOf`, `onOpenParty`).

`StandingsTile.tsx` `Row`: the row stays the lock/highlight button, but the colour dot becomes a separate details button in front of it (no nested buttons):

```tsx
function Row({ r, max, vm, wide }: { r: StandingRow; max: number; vm: StandingsVM; wide?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => vm.onOpenParty(r.id)} aria-label={t('party_details', { name: r.name })}
        className="grid h-9 w-8 shrink-0 place-items-center rounded-[0.5rem] hover:bg-tile-raised">
        <PartyMark mark={vm.markOf(r.id)} color={r.color} label={r.id} />
      </button>
      <button type="button" onClick={() => vm.onLockParty(r.id)} /* …existing handlers and classes unchanged… */>
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-semibold text-ink">{r.id}</span>
          <span className="truncate text-xs text-muted">{r.name}</span>
        </span>
        {/* bar, vote %, seats unchanged */}
      </button>
    </div>
  );
}
```

`WatchRow` (same file) and the leader cards in `LeadersStrip.tsx`: replace the colour dot `<span … rounded-full style={{ background: color }} />` with `<PartyMark mark={vm.markOf(c.partyId)} color={color} label={c.partyId} />`. (The watch row is already a seat button; the party dialog is reachable from the seat dialog, so no second button there.)

`useMapVM.ts` `seatInfo`: return also `mark: s.party ? src.partyMeta.get(s.party)?.mark ?? null : null, type: s.type ?? null` and update the `MapVM` type. `MapCanvas.tsx` tooltip:

```tsx
          <div className="flex items-center gap-2 font-display text-sm font-bold uppercase text-ink">{info.name}{info.type && info.type !== 'GEN' && <span className="rounded border border-line px-1 text-[10px]">{info.type}</span>}</div>
          {info.candidate && <div className="text-ink">{info.candidate}</div>}
          <div className="flex items-center gap-1.5 text-muted">{info.party && <PartyMark mark={info.mark} color={info.color} label={info.party} />}{info.party} · {info.status}{info.margin ? ` · +${info.margin.toLocaleString('en-IN')}` : ''}</div>
```

Wire the dialog: `DashboardGrid` gets `partyDialog: PartyDialogVM | null` and renders `<PartyDialog vm={p.partyDialog} />` next to `<SeatDialog …/>` in both layouts; `StudioDashboard` passes `partyDialog={usePartyDialogVM()}`.

Update VM literals in `watchlist.test.tsx` (and any other test building `StandingsVM`/`LeadersVM`/`MapVM` by hand: `grep -rln "onLockParty\|onRemoveCustom\|seatInfo" src`) with `markOf: () => null, onOpenParty: noop`, and `mark: null, type: null` for `seatInfo`. Add to `watchlist.test.tsx`:

```tsx
it('the party mark in a standings row opens the party dialog, the row still locks', () => {
  const onOpenParty = vi.fn(), onLockParty = vi.fn();
  render(<MemoryRouter><StandingsTile vm={{ ...standingsVM, onOpenParty, onLockParty, markOf: () => null }} variant="tile" watchlist={leadersVM()} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Party details: Party' }));
  expect(onOpenParty).toHaveBeenCalledWith('BJP');
  expect(onLockParty).not.toHaveBeenCalled();
});
```

- [ ] **Step 8: Run tests**

Run: `cd frontend && npx vitest run && npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: PASS.

Before committing, add the `docs/FEATURES.md` entry for this task (CLAUDE.md: document every feature before or during implementation): party dialog (`?party=`), opened from the mark button in standings and from party cells in the seat dialog; marks in standings, leaders, watchlist and the map tooltip.

- [ ] **Step 9: Commit**

```bash
git add docs/FEATURES.md -A frontend/src
git commit -m "feat(fe): party dialog; party marks in standings, leaders, watchlist and the map tooltip

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Page shell and the constituency page

**Files:**
- Create: `frontend/src/viewmodels/pages/useConstituencyPageVM.ts`
- Create: `frontend/src/views/page/PageShell.tsx`, `frontend/src/views/constituency/ConstituencyPageView.tsx`, `frontend/src/views/constituency/LocatorMap.tsx`
- Rewrite: `frontend/src/pages/ConstituencyDetail.tsx`
- Modify: `frontend/src/theme/studio.css` (no change needed if the page file has no classes — keep classes in views), i18n files
- Test: `frontend/src/viewmodels/__tests__/constituencyPageVM.test.tsx`, `frontend/src/views/__tests__/constituencyPage.test.tsx`

**Interfaces:**
- Consumes: `buildSeatView`, `seatHistory`, `seatNotes`, `detailToRows` (Task 8); `usePartyMeta` (Task 6); `useLiveSnapshot(electionId, enabled)` (`viewmodels/data/useLiveSnapshot`); `getElection`, `getConstituency`, `getConstituencyAnalysis`, `getManifest`, `ElectionService.getGeoJSON` (`model/api/election.service`); `matchFeaturesToSeats` (`model/geo/featureMatch`); `useLocalStorage`-backed watchlist: reuse the same storage key as the dashboard watchlist (find it in `useDashboardSources.ts`, `useLocalStorage('…')`).
- Produces:

```ts
export interface ConstituencyPageVM {
  status: 'loading' | 'error' | 'notFound' | 'ready';
  electionName: string; electionHref: string; stateName: string | null; districtName: string | null;
  name: string; constNo: number | null; type: 'GEN' | 'SC' | 'ST' | null;
  live: SeatDialogVM['live'];
  facts: { electors: number | null; votesPolled: number | null; turnout: number | null; phase: number | null; region: string | null; district: string | null; progress: { current: number; total: number } | null };
  view: SeatView;            // all candidates, NOTA last, no cap
  history: SeatHistoryEntry[]; dominance: string | null; notes: SeatNote[];
  partyMeta: Map<string, PartyMeta>;
  locator: { features: GeoFeature[]; seat: GeoFeature | null } | null;
  tracked: boolean; onToggleTrack(): void; shareText: string; personHref(id: string): string;
  /** For the page to sync the global election context on a direct load. */
  election: Election | null;
}
export function useConstituencyPageVM(electionId: string, constId: string): ConstituencyPageVM
```

- [ ] **Step 1: i18n keys** (en / hi)

| key | en | hi |
|---|---|---|
| `cp_head_to_head` | Head-to-head | आमने-सामने |
| `cp_seat_facts` | Seat facts | सीट तथ्य |
| `cp_votes_polled` | Votes polled | डाले गए वोट |
| `cp_region` | Region | क्षेत्र |
| `cp_district` | District | ज़िला |
| `cp_counting_progress` | Counting progress | मतगणना प्रगति |
| `cp_locator` | Locator | स्थान |
| `cp_all_candidates` | All candidates | सभी उम्मीदवार |
| `cp_age` | Age | आयु |
| `cp_assets` | Assets | संपत्ति |
| `cp_liabilities` | Liabilities | देनदारियाँ |
| `cp_criminal_cases` | Criminal cases | आपराधिक मामले |
| `cp_seat_history` | Seat history | सीट इतिहास |
| `cp_runner_up` | Runner-up: {{name}} | उपविजेता: {{name}} |
| `cp_insights` | Insights | विश्लेषण |
| `cp_not_found` | Constituency not found | निर्वाचन क्षेत्र नहीं मिला |
| `cp_back` | Back to results | परिणामों पर वापस |
| `cp_share` | Share | साझा करें |

- [ ] **Step 2: Write the failing VM test**

`frontend/src/viewmodels/__tests__/constituencyPageVM.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const api = {
  getElection: vi.fn(), getConstituency: vi.fn(), getConstituencyAnalysis: vi.fn(), getManifest: vi.fn(),
  getGeoJSON: vi.fn().mockResolvedValue({ type: 'FeatureCollection', features: [] }),
};
vi.mock('../../model/api/election.service', async (orig) => ({
  ...(await orig<typeof import('../../model/api/election.service')>()),
  getElection: (...a: unknown[]) => api.getElection(...a), getConstituency: (...a: unknown[]) => api.getConstituency(...a),
  getConstituencyAnalysis: (...a: unknown[]) => api.getConstituencyAnalysis(...a), getManifest: (...a: unknown[]) => api.getManifest(...a),
  ElectionService: { getCacheKey: (id: string, s?: string) => `e_${id}_${s}`, getConstituencyCacheKey: (e: string, c: string) => `c_${e}_${c}`, getGeoJSON: (u: string) => api.getGeoJSON(u) },
}));
vi.mock('../data/useLiveSnapshot', () => ({ useLiveSnapshot: () => ({ snapshot: null, connected: false, status: null, error: null, pollNow: () => {} }) }));
vi.mock('../data/usePartyMeta', () => ({ usePartyMeta: () => new Map() }));

import { useConstituencyPageVM } from '../pages/useConstituencyPageVM';
import { ApiError } from '../../model/api/api-client';

const detail = {
  id: 'S', election_id: 'e1', name: 'Patliputra', const_no: 30, type: 'SC', voter_turnout: 59.4, phase: 7, total_electors: 2000,
  current_round: null, total_rounds: null, last_updated: null, state: { id: 4, name: 'Bihar' }, district: { id: 1, name: 'Patna' }, region: { id: 2, name: 'Magadh' },
  candidates: [
    { id: 'n', name: 'NOTA', party: null, is_incumbent: false, votes: 20, status: 'LOST', margin: 0, person_id: 'pn', person: null },
    { id: 'a', name: 'A', party: { id: 'BJP', name: 'BJP', color: '#f80', symbol_url: null, eci_symbol_url: null }, is_incumbent: true, votes: 600, status: 'WON', margin: 220, person_id: 'p1', person: { id: 'p1', photo_url: null }, age: 64, assets: 1, liabilities: 0, criminal_cases: 0 },
    { id: 'b', name: 'B', party: { id: 'RJD', name: 'RJD', color: '#0a0', symbol_url: null, eci_symbol_url: null }, is_incumbent: false, votes: 380, status: 'LOST', margin: 0, person_id: 'p2', person: null },
  ],
};

describe('useConstituencyPageVM', () => {
  it('builds facts, the full ranked table with NOTA last, and history', async () => {
    api.getElection.mockResolvedValue({ id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', status: 'Finalized', year: 2025 });
    api.getConstituency.mockResolvedValue(detail);
    api.getConstituencyAnalysis.mockResolvedValue({ dominance: 'swing', incumbency: { seat_history: [{ year: 2020, party: 'BJP', candidate: 'A', margin: 5 }] } });
    api.getManifest.mockResolvedValue(null);
    const { result } = renderHook(() => useConstituencyPageVM('e1', 'S'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.view.candidates.map(c => c.name)).toEqual(['A', 'B', 'NOTA']);
    expect(result.current.facts).toMatchObject({ electors: 2000, votesPolled: 1000, turnout: 59.4, phase: 7, region: 'Magadh', district: 'Patna', progress: null });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.dominance).toBe('swing');
    expect(result.current.live).toEqual({ kind: 'declared' });
  });

  it('reports notFound on a 404', async () => {
    api.getElection.mockResolvedValue({ id: 'e1', name: 'x', type: 'VS', status: 'Finalized', year: 2025 });
    api.getConstituency.mockRejectedValue(new ApiError('Not found', 404));
    api.getConstituencyAnalysis.mockResolvedValue(null);
    api.getManifest.mockResolvedValue(null);
    const { result } = renderHook(() => useConstituencyPageVM('e1', 'NOPE'));
    await waitFor(() => expect(result.current.status).toBe('notFound'));
  });
});
```

(`apiFetch` throws `ApiError(message, status, …)` from `model/api/api-client.ts`; check its constructor arity and pass what it needs.)

Run → FAIL (module missing).

- [ ] **Step 3: Implement the VM**

`frontend/src/viewmodels/pages/useConstituencyPageVM.ts`:

```ts
import { useEffect, useMemo, useState } from 'react';
import { useApi } from '../data/useApi';
import { useLiveSnapshot } from '../data/useLiveSnapshot';
import { usePartyMeta } from '../data/usePartyMeta';
import { useLocalStorage } from '../data/useLocalStorage';
import { getElection, getConstituency, getConstituencyAnalysis, getManifest, ElectionService } from '../../model/api/election.service';
import { ApiError } from '../../model/api/api-client';
import { matchFeaturesToSeats } from '../../model/geo/featureMatch';
import type { GeoFeature } from '../../model/geo/geoHelpers';
import { buildSeatView, detailToRows, seatHistory, seatNotes, type SeatView, type SeatNote } from '../../model/derive/seatView';
import type { PartyMeta } from '../../model/derive/partyMeta';
import type { CustomWatch } from '../../model/derive/leaders';
import type { SeatHistoryEntry, Election } from '../../model/types';
import type { SeatDialogVM } from '../tiles/useSeatDialogVM';

const LS_PC = '/geo/india_pc.geojson';
const NOT_FOUND = 'NOT_FOUND' as const;

export interface ConstituencyPageVM { /* exactly as in Interfaces above */ }

export function useConstituencyPageVM(electionId: string, constId: string): ConstituencyPageVM {
  const partyMeta = usePartyMeta();
  const election = useApi(() => getElection(electionId), [electionId], { key: ElectionService.getCacheKey(electionId) });
  // useApi's error is a string, so a 404 is turned into a value here.
  const detailRes = useApi(() => getConstituency(electionId, constId).catch(e => { if (e instanceof ApiError && e.status === 404) return NOT_FOUND; throw e; }),
    [electionId, constId], { key: ElectionService.getConstituencyCacheKey(electionId, constId) });
  const detail = { ...detailRes, data: detailRes.data === NOT_FOUND ? null : detailRes.data };
  const analysis = useApi(() => getConstituencyAnalysis(electionId, constId).catch(() => null), [electionId, constId], { key: `${ElectionService.getConstituencyCacheKey(electionId, constId)}_analysis` });
  const manifest = useApi(() => getManifest(electionId).catch(() => null), [electionId], { key: ElectionService.getCacheKey(electionId, 'manifest') });
  const isLive = election.data?.status === 'Live';
  const live = useLiveSnapshot(electionId, isLive);
  const [watch, setWatch] = useLocalStorage<CustomWatch[]>(/* same key as useDashboardSources */ 'studio_watchlist', []);

  const d = detail.data;
  const rows = useMemo(() => {
    const snapRows = live.snapshot?.results.filter(r => r.const_id === constId);
    return snapRows && snapRows.length ? snapRows : d ? detailToRows(constId, d.candidates ?? []) : [];
  }, [live.snapshot, d, constId]);
  const partyColor = useMemo(() => new Map((d?.candidates ?? []).filter(c => c.party).map(c => [c.party!.id, c.party!.color ?? 'var(--color-fallback)'])), [d]);
  const view = useMemo(() => buildSeatView(rows, { partyMeta, partyColor, detail: d?.candidates ?? null }), [rows, partyMeta, partyColor, d]);

  const mapUrl = manifest.data?.draft?.geo?.map_url || (election.data?.type === 'LS' ? LS_PC : null);
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  useEffect(() => {
    if (!mapUrl) return;
    let on = true;
    ElectionService.getGeoJSON(mapUrl).then(fc => { if (on) setFeatures((fc?.features ?? []) as GeoFeature[]); }).catch(() => {});
    return () => { on = false; };
  }, [mapUrl]);
  const locator = useMemo(() => {
    if (!features.length || !d) return null;
    const m = matchFeaturesToSeats(features, [{ id: constId, name: d.name, state: d.state?.name }]);
    const seat = [...m.keys()][0] ?? null;
    // LS: show only the seat's state (features matched to nothing are other seats of India).
    return { features, seat };
  }, [features, d, constId]);

  const notFound = detailRes.data === NOT_FOUND;
  const status: ConstituencyPageVM['status'] = notFound ? 'notFound' : detail.error || election.error ? 'error' : d && election.data ? 'ready' : 'loading';
  const tracked = watch.some(w => w.const_id === constId);
  const allDeclared = rows.some(r => r.status === 'WON');
  const e = election.data;
  return {
    status,
    electionName: e?.name ?? '', electionHref: `/election/${electionId}`,
    stateName: d?.state?.name ?? null, districtName: d?.district?.name ?? null,
    name: d?.name ?? '', constNo: d?.const_no ?? null, type: d?.type ?? null,
    live: !e || e.status === 'Upcoming' ? null : e.status === 'Finalized' || allDeclared ? { kind: 'declared' }
      : { kind: 'counting', round: d?.current_round && d.total_rounds ? { current: d.current_round, total: d.total_rounds } : null },
    facts: {
      electors: d?.total_electors ?? null, votesPolled: view.totalVotes > 0 ? view.totalVotes : null,
      turnout: d?.voter_turnout != null ? Number(d.voter_turnout) : null, phase: d?.phase ?? null,
      region: d?.region?.name ?? null, district: d?.district?.name ?? null,
      progress: d?.current_round && d.total_rounds ? { current: d.current_round, total: d.total_rounds } : null,
    },
    view,
    history: seatHistory(analysis.data ?? null, e?.year ?? 0),
    dominance: analysis.data?.dominance ?? null,
    notes: seatNotes(view, analysis.data ?? null),
    partyMeta,
    locator,
    tracked,
    onToggleTrack: () => setWatch(tracked ? watch.filter(w => w.const_id !== constId) : [...watch, { const_id: constId, label: d?.name ?? constId }]),
    shareText: `${d?.name ?? ''} — ${e?.name ?? ''} · MatdaanPulse`,
    personHref: id => `/person/${id}`,
    election: e ?? null,
  };
}
```

Replace the placeholder interface comment with the full `ConstituencyPageVM` interface from the Interfaces block. Verify the manifest shape (`getManifest` returns `{ draft: ManifestData }` in the legacy page — `manifest?.draft`) and the watchlist storage key + `useLocalStorage` signature in `useDashboardSources.ts`; use the same key so tracking is shared with the dashboard. For LS, filter `locator.features` to the seat's state when the PC geojson carries a state property (`featureCategory(props)` in `model/geo/geoHelpers.ts`), so the locator shows a state, not all of India.

Run the VM test → PASS.

- [ ] **Step 4: Write the failing view test**

`frontend/src/views/__tests__/constituencyPage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { ConstituencyPageView } from '../constituency/ConstituencyPageView';
import type { ConstituencyPageVM } from '../../viewmodels/pages/useConstituencyPageVM';

afterEach(cleanup);

const cand = (o: Record<string, unknown>) => ({ key: String(o.name), partyId: 'BJP', partyLabel: 'BJP', mark: null, color: '#f80', votes: 0, share: 0, pill: null, incumbent: false, photo: null, personId: null, nota: false, affidavit: null, ...o });
const vm = (over: Partial<ConstituencyPageVM> = {}): ConstituencyPageVM => ({
  status: 'ready', electionName: 'Bihar Vidhan Sabha 2025', electionHref: '/election/e1', stateName: 'Bihar', districtName: 'Patna',
  name: 'Patliputra', constNo: 30, type: 'SC', live: { kind: 'declared' },
  facts: { electors: 2000, votesPolled: 1000, turnout: 59.4, phase: 7, region: 'Magadh', district: 'Patna', progress: null },
  view: { totalVotes: 1000, margin: 220, others: null, candidates: [
    cand({ name: 'A', votes: 600, share: 60, pill: 'WON', personId: 'p1', affidavit: { age: 64, assets: 48000000, liabilities: 3200000, criminalCases: 5 } }),
    cand({ name: 'B', partyId: 'RJD', partyLabel: 'RJD', votes: 380, share: 38 }),
    cand({ name: 'NOTA', partyId: null, partyLabel: '', nota: true, votes: 20, share: 2 }),
  ] },
  history: [{ year: 2020, party: 'BJP', candidate: 'A', margin: 5, vote_share: 50.5, runner_up: 'B', runner_up_party: 'RJD' }], dominance: 'swing', notes: [],
  partyMeta: new Map(), locator: null, tracked: false, onToggleTrack: vi.fn(), shareText: 'x', personHref: id => `/person/${id}`, election: null, ...over,
});
const renderIt = (v: ConstituencyPageVM) => render(<MemoryRouter><ConstituencyPageView vm={v} /></MemoryRouter>);

describe('ConstituencyPageView', () => {
  it('renders header, head-to-head, facts, the full table with affidavit columns and history', () => {
    renderIt(vm());
    expect(screen.getByRole('heading', { level: 1, name: 'Patliputra' })).toBeInTheDocument();
    expect(screen.getByText('No. 30 · SC')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(4); // header + 3
    expect(within(table).getByText('₹4.8 Cr')).toBeInTheDocument();
    expect(within(table).getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/Runner-up: B/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'A' })).toHaveAttribute('href', '/person/p1');
  });

  it('shows the not-found state', () => {
    renderIt(vm({ status: 'notFound' }));
    expect(screen.getByText('Constituency not found')).toBeInTheDocument();
  });

  it('hides empty tiles (no history, no notes, no locator)', () => {
    renderIt(vm({ history: [], notes: [], locator: null }));
    expect(screen.queryByText('Seat history')).toBeNull();
    expect(screen.queryByText('Insights')).toBeNull();
    expect(screen.queryByText('Locator')).toBeNull();
  });
});
```

Run → FAIL.

- [ ] **Step 5: Implement the views**

`frontend/src/views/page/PageShell.tsx` — the slim studio top bar for full pages (logo → `/`, back link) and a scrolling main column:

```tsx
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

export function PageShell({ back, children }: { back: { href: string; label: string }; children: ReactNode }) {
  return (
    <div className="studio-root min-h-dvh bg-page text-ink">
      <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-line bg-page/95 px-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold"><img src="/logo-mark.png" alt="" className="h-6 w-6" />MatdaanPulse</Link>
        <Link to={back.href} className="ml-auto text-sm text-muted hover:text-ink">← {back.label}</Link>
      </header>
      <main className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-4 lg:px-6">{children}</main>
    </div>
  );
}
```

`frontend/src/views/constituency/LocatorMap.tsx` — small d3 SVG (views may import d3, as `views/map` does):

```tsx
import { useMemo } from 'react';
import { geoMercator, geoPath } from 'd3';
import type { GeoFeature } from '../../model/geo/geoHelpers';

const W = 240, H = 200;

export function LocatorMap({ features, seat, label }: { features: GeoFeature[]; seat: GeoFeature | null; label: string }) {
  const paths = useMemo(() => {
    const fc = { type: 'FeatureCollection' as const, features };
    const proj = geoMercator().fitExtent([[6, 6], [W - 6, H - 6]], fc);
    const path = geoPath(proj);
    return features.map((f, i) => ({ key: i, d: path(f) ?? '', on: f === seat }));
  }, [features, seat]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {paths.map(p => <path key={p.key} d={p.d} className={p.on ? 'fill-accent stroke-accent' : 'fill-tile-raised stroke-line'} strokeWidth={0.5} />)}
    </svg>
  );
}
```

`frontend/src/views/constituency/ConstituencyPageView.tsx` — composes the agreed tiles. Use `Tile`-like markup consistent with `views/dashboard/Tile.tsx` (`rounded-tile border border-line bg-tile p-4`), `PartyMark`, `Avatar`, `formatIN`, `formatRupees`, `LiveChip` (export it from `views/seat/SeatDialog.tsx`), `ShareMenu` (`views/dashboard/ShareMenu`). Structure:

```tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ConstituencyPageVM } from '../../viewmodels/pages/useConstituencyPageVM';
import { PageShell } from '../page/PageShell';
import { PartyMark } from '../ui/PartyMark';
import { Avatar } from '../ui/Avatar';
import { formatIN, formatRupees } from '../ui/format';
import { LiveChip } from '../seat/SeatDialog';
import { ShareMenu } from '../dashboard/ShareMenu';
import { LocatorMap } from './LocatorMap';
import { STATUS_STYLE } from '../dashboard/statusStyle';
import { cn } from '../ui/cn';

const tile = 'rounded-tile border border-line bg-tile p-4';
const h2 = 'mb-3 font-display text-sm font-bold uppercase tracking-wider text-ink';

export function ConstituencyPageView({ vm }: { vm: ConstituencyPageVM }) {
  const { t } = useTranslation();
  const back = { href: vm.electionHref, label: t('cp_back') };
  if (vm.status !== 'ready') {
    return <PageShell back={back}><p className="py-16 text-center text-muted">{vm.status === 'notFound' ? t('cp_not_found') : vm.status === 'error' ? t('error_occurred') : t('loading')}</p></PageShell>;
  }
  const [lead, second] = vm.view.candidates.filter(c => !c.nota);
  const facts = ([
    ['seat_electors', vm.facts.electors != null ? formatIN(vm.facts.electors) : null],
    ['cp_votes_polled', vm.facts.votesPolled != null ? formatIN(vm.facts.votesPolled) : null],
    ['seat_turnout', vm.facts.turnout != null ? `${vm.facts.turnout}%` : null],
    ['seat_phase', vm.facts.phase != null ? t('seat_phase_n', { n: vm.facts.phase }) : null],
    ['cp_region', vm.facts.region], ['cp_district', vm.facts.district],
  ] as const).filter(([, v]) => v);
  return (
    <PageShell back={back}>
      <nav className="text-xs uppercase tracking-wider text-muted">{[vm.electionName, vm.stateName, vm.districtName].filter(Boolean).join(' › ')}</nav>
      <div className="flex flex-wrap items-center gap-3 border-b border-line pb-3">
        <h1 className="font-display text-4xl font-bold uppercase lg:text-5xl">{vm.name}</h1>
        {(vm.constNo != null || vm.type) && <span className="rounded-md border border-line px-2 py-0.5 font-mono text-xs">{[vm.constNo != null && `No. ${vm.constNo}`, vm.type && vm.type !== 'GEN' && vm.type].filter(Boolean).join(' · ')}</span>}
        <LiveChip live={vm.live} />
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={vm.onToggleTrack} aria-pressed={vm.tracked} className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white aria-pressed:bg-tile-raised aria-pressed:text-accent">{vm.tracked ? t('studio_tracked') : t('studio_track')}</button>
          <ShareMenu text={vm.shareText} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
        {lead && (
          <section className={tile} aria-label={t('cp_head_to_head')}>
            <h2 className={h2}>{t('cp_head_to_head')}</h2>
            <div className="flex items-start justify-between gap-4">
              {[lead, second].filter(Boolean).map((c, i) => (
                <div key={c!.key} className={cn('flex items-center gap-3', i === 1 && 'flex-row-reverse text-right')}>
                  <Avatar name={c!.name} photo={c!.photo} size={72} />
                  <div>
                    {c!.pill && <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold', STATUS_STYLE[c!.pill])}>{t(`studio_status_${c!.pill.toLowerCase()}`)}</span>}
                    <div className="text-lg font-semibold">{c!.name}</div>
                    <div className={cn('flex items-center gap-1.5 text-sm text-muted', i === 1 && 'justify-end')}><PartyMark mark={c!.mark} color={c!.color} label={c!.partyLabel} />{c!.partyLabel}</div>
                    <div className="tabular font-display text-3xl font-bold">{formatIN(c!.votes)}</div>
                    <div className="text-sm" style={{ color: c!.color }}>{c!.share}%</div>
                  </div>
                </div>
              ))}
            </div>
            {vm.view.totalVotes > 0 && (
              <>
                <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-page">
                  <span style={{ width: `${lead.share}%`, background: lead.color }} />
                  <span className="flex-1" />
                  {second && <span style={{ width: `${second.share}%`, background: second.color }} />}
                </div>
                {vm.view.margin != null && <p className="mt-2 text-right text-sm font-semibold text-ok-text">{t('seat_margin')} +{formatIN(vm.view.margin)}</p>}
              </>
            )}
          </section>
        )}
        {facts.length > 0 && (
          <section className={tile}>
            <h2 className={h2}>{t('cp_seat_facts')}</h2>
            <dl className="divide-y divide-line text-sm">{facts.map(([k, v]) => <div key={k} className="flex justify-between py-2"><dt className="text-muted">{t(k)}</dt><dd className="tabular font-semibold">{v}</dd></div>)}</dl>
            {vm.facts.progress && (
              <div className="mt-3"><div className="flex justify-between text-xs text-muted"><span>{t('cp_counting_progress')}</span><span>{vm.facts.progress.current}/{vm.facts.progress.total}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-page"><span className="block h-full bg-accent" style={{ width: `${(vm.facts.progress.current / vm.facts.progress.total) * 100}%` }} /></div></div>
            )}
          </section>
        )}
        {vm.locator && (
          <section className={tile}><h2 className={h2}>{t('cp_locator')}</h2><LocatorMap features={vm.locator.features} seat={vm.locator.seat} label={vm.name} /></section>
        )}
      </div>

      <section className={cn(tile, 'overflow-x-auto p-0')}>
        <h2 className={cn(h2, 'px-4 pt-4')}>{t('cp_all_candidates')}</h2>
        <table className="w-full min-w-[880px] text-sm">
          <thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
            <th className="px-4 py-2">#</th><th>{t('seat_rank_candidate')}</th><th>{t('seat_party')}</th><th className="text-right">{t('seat_votes')}</th><th className="pl-3">{t('seat_share')}</th>
            <th>{t('seat_status')}</th><th className="text-right">{t('cp_age')}</th><th className="text-right">{t('cp_assets')}</th><th className="text-right">{t('cp_liabilities')}</th><th className="pr-4 text-right">{t('cp_criminal_cases')}</th>
          </tr></thead>
          <tbody>
            {vm.view.candidates.map((c, i) => (
              <tr key={c.key} className="border-b border-line/60">
                <td className="px-4 py-2 text-muted">{c.nota ? '' : i + 1}</td>
                <td><div className="flex items-center gap-2"><Avatar name={c.name} photo={c.photo} size={32} />
                  {c.personId ? <Link to={vm.personHref(c.personId)} className="font-semibold hover:underline">{c.name}</Link> : <span className="font-semibold">{c.nota ? t('seat_nota') : c.name}</span>}
                  {c.incumbent && <span className="rounded-full border border-accent/50 px-1.5 text-[10px] text-accent">{t('seat_incumbent')}</span>}</div></td>
                <td>{c.partyId && <span className="flex items-center gap-1.5"><PartyMark mark={c.mark} color={c.color} label={c.partyLabel} size={24} />{c.partyLabel}</span>}</td>
                <td className="tabular text-right font-semibold">{formatIN(c.votes)}</td>
                <td className="pl-3"><span className="tabular mr-2 text-xs">{c.share}%</span><span className="inline-block h-1.5 w-24 overflow-hidden rounded-full bg-page align-middle"><span className="block h-full" style={{ width: `${c.share}%`, background: c.color }} /></span></td>
                <td>{c.pill && <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold', STATUS_STYLE[c.pill])}>{t(`studio_status_${c.pill.toLowerCase()}`)}</span>}</td>
                <td className="tabular text-right">{c.affidavit?.age ?? ''}</td>
                <td className="tabular text-right">{formatRupees(c.affidavit?.assets ?? null) ?? ''}</td>
                <td className="tabular text-right">{formatRupees(c.affidavit?.liabilities ?? null) ?? ''}</td>
                <td className="pr-4 text-right">{c.affidavit?.criminalCases != null && (c.affidavit.criminalCases > 0
                  ? <span className="rounded-md bg-warn/15 px-1.5 py-0.5 text-xs font-bold text-warn-text">{c.affidavit.criminalCases}</span>
                  : <span className="text-muted">0</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {(vm.history.length > 0 || vm.notes.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {vm.history.length > 0 && (
            <section className={tile}>
              <h2 className={cn(h2, 'flex items-center gap-2')}>{t('cp_seat_history')}{vm.dominance && <span className="rounded-md border border-warn/50 px-1.5 text-[11px] text-warn-text">{t(`studio_chip_${vm.dominance}`, vm.dominance)}</span>}</h2>
              <ol className="flex flex-col gap-2">
                {vm.history.map(h => {
                  const m = h.party ? vm.partyMeta.get(h.party) : undefined;
                  return (
                    <li key={h.year} className="rounded-tile border border-line p-3">
                      <div className="flex justify-between"><span className="font-display font-bold">{h.year}</span><span className="tabular text-sm text-ok-text">+{formatIN(h.margin)}</span></div>
                      <div className="mt-1 flex items-center gap-1.5"><PartyMark mark={m?.mark ?? null} color={m?.color ?? null} label={m?.abbreviation ?? h.party ?? ''} /><span className="font-semibold">{h.candidate}</span><span className="text-muted">({m?.abbreviation ?? h.party})</span>{h.vote_share != null && <span className="ml-auto text-sm">{h.vote_share}%</span>}</div>
                      {h.runner_up && <div className="mt-0.5 text-xs text-muted">{t('cp_runner_up', { name: `${h.runner_up}${h.runner_up_party ? ` (${vm.partyMeta.get(h.runner_up_party)?.abbreviation ?? h.runner_up_party})` : ''}` })}</div>}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
          {vm.notes.length > 0 && (
            <section className={tile}>
              <h2 className={h2}>{t('cp_insights')}</h2>
              {vm.notes.map(n => <p key={n.kind} className="mb-2 rounded-tile border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-warn-text">⚠ {n.kind === 'threeWay' ? t('seat_three_way') : t('seat_spoiler', { party: n.party, votes: formatIN(n.votes), margin: formatIN(n.margin) })}</p>)}
            </section>
          )}
        </div>
      )}
    </PageShell>
  );
}
```

(With `partyMeta` empty the runner-up line reads "Runner-up: B (RJD)", hence the regex in the test.)

Rewrite `frontend/src/pages/ConstituencyDetail.tsx`:

```tsx
import { useParams } from 'react-router-dom';
import { useConstituencyPageVM } from '../viewmodels/pages/useConstituencyPageVM';
import { ConstituencyPageView } from '../views/constituency/ConstituencyPageView';

export default function ConstituencyDetail() {
  const { electionId = '', constId = '' } = useParams<{ electionId: string; constId: string }>();
  return <ConstituencyPageView vm={useConstituencyPageVM(electionId, constId)} />;
}
```

The legacy page synced the global election context (`setElection`, `setElectionType`, `setSelectedStateId` from `useElection`) on a direct load. Keep that in the page component, not the VM (so the VM test needs no provider): in `ConstituencyDetail.tsx` read `useElection()` from `viewmodels/data/useElection`, fetch nothing extra — the VM exposes `election: Election | null` (add it to `ConstituencyPageVM`) — and run the same `useEffect` as the legacy page when `vm.election` arrives and differs from the context.

- [ ] **Step 6: Run tests**

Run: `cd frontend && npx vitest run && npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: PASS.

Before committing, add the `docs/FEATURES.md` entry for this task (CLAUDE.md: document every feature before or during implementation): studio constituency page (head-to-head, seat facts, locator, all candidates with affidavit columns, seat history with runner-up/share, insights).

- [ ] **Step 7: Commit**

```bash
git add docs/FEATURES.md -A frontend/src
git commit -m "feat(fe): studio constituency page (head-to-head, facts, locator, affidavits, history)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Person page

**Files:**
- Create: `frontend/src/model/derive/personPage.ts`, `frontend/src/viewmodels/pages/usePersonPageVM.ts`, `frontend/src/views/person/PersonPageView.tsx`, `frontend/src/views/person/AffidavitChart.tsx`
- Rewrite: `frontend/src/pages/PersonDetail.tsx`
- Modify: i18n files
- Test: `frontend/src/model/derive/__tests__/personPage.test.ts`, `frontend/src/views/__tests__/personPage.test.tsx`

**Interfaces:**
- Consumes: `PersonDetail`, `PersonCandidate` (Task 4 types), `partyMark`, `isNota` (Task 4), `getPerson` (`model/api/person.service`).
- Produces:

```ts
// model/derive/personPage.ts
export type ContestStatus = 'LEADING' | 'TRAILING' | 'WON' | 'LOST' | 'PENDING';
export interface ContestView { key: string; year: number | null; electionName: string; constituency: string; constHref: string; partyId: string | null; partyLabel: string; mark: string | null; color: string;
  status: ContestStatus; votes: number; share: number | null; margin: number | null; firstUnderParty: boolean }
export interface PersonStats { contests: number; wins: number; winRate: number | null; parties: string[]; switches: { from: string; to: string; year: number }[] }
export interface AffidavitPoint { year: number; assets: number | null; liabilities: number | null; criminalCases: number | null }
export function contestStatus(c: PersonCandidate): ContestStatus
export function contestViews(cands: PersonCandidate[]): ContestView[]        // newest first
export function personStats(cands: PersonCandidate[]): PersonStats
export function affidavitSeries(cands: PersonCandidate[]): AffidavitPoint[]  // oldest first, only contests with any value
export function ageFrom(dob: string | null, today?: Date): number | null

// viewmodels/pages/usePersonPageVM.ts
export interface PersonPageVM {
  status: 'loading' | 'error' | 'notFound' | 'ready';
  name: string; photo: string | null; currentParty: { label: string; mark: string | null; color: string } | null;
  facts: { age: number | null; gender: string | null; education: string | null; home: string | null }; wikipedia: string | null; bio: string | null;
  incumbent: boolean; stats: PersonStats; contests: ContestView[]; affidavit: AffidavitPoint[]; latest: AffidavitPoint | null;
}
export function usePersonPageVM(id: string): PersonPageVM
```

- [ ] **Step 1: i18n keys** (en / hi)

| key | en | hi |
|---|---|---|
| `pp_contests` | Contests | चुनाव लड़े |
| `pp_wins` | Wins | जीत |
| `pp_win_rate` | Win rate | जीत दर |
| `pp_parties` | Parties | दल |
| `pp_switch` | {{from}} → {{to}} in {{year}} | {{year}} में {{from}} → {{to}} |
| `pp_timeline` | Contest timeline | चुनावी सफ़र |
| `pp_first_under` | First contest under {{party}} | {{party}} से पहला चुनाव |
| `pp_affidavit` | Affidavit | शपथपत्र |
| `pp_latest_assets` | Latest assets | नवीनतम संपत्ति |
| `pp_latest_liabilities` | Latest liabilities | नवीनतम देनदारियाँ |
| `pp_age` | Age {{n}} | आयु {{n}} |
| `pp_lost` | Lost | हारे |
| `pp_not_found` | Person not found | व्यक्ति नहीं मिला |
| `pp_gender_M` | Male | पुरुष |
| `pp_gender_F` | Female | महिला |
| `pp_gender_O` | Other | अन्य |

(Check stored `persons.gender` values — `grep -rn "gender" database/seed_bihar_persons.sql | head` — and key the labels to them; fall back to the raw value.)

- [ ] **Step 2: Write the failing derivation test**

`frontend/src/model/derive/__tests__/personPage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { contestStatus, contestViews, personStats, affidavitSeries, ageFrom } from '../personPage';
import type { PersonCandidate } from '../../types';

const c = (o: Partial<PersonCandidate>): PersonCandidate => ({ id: 'x', name: 'N', party_id: 'BJP', party_name: 'BJP', party_color: '#f80', election_name: 'E', election_year: 2020, election_id: 'e', constituency_name: 'S', const_id: 'S', votes: 1, status: 'WON', margin: 1, is_incumbent: false, election_status: 'Finalized', ...o });

describe('contestStatus', () => {
  it('Lost only once the election is finalized', () => {
    expect(contestStatus(c({ status: 'TRAILING', election_status: 'Live' }))).toBe('TRAILING');
    expect(contestStatus(c({ status: 'LOST', election_status: 'Finalized' }))).toBe('LOST');
    expect(contestStatus(c({ status: null, election_status: 'Finalized' }))).toBe('LOST');
    expect(contestStatus(c({ status: null, election_status: 'Upcoming' }))).toBe('PENDING');
    expect(contestStatus(c({ status: 'LEADING', election_status: 'Live' }))).toBe('LEADING');
  });
});

describe('personStats', () => {
  const cands = [c({ election_year: 2025, status: 'LEADING', election_status: 'Live', party_id: 'BJP' }), c({ election_year: 2014, party_id: 'BJP' }), c({ election_year: 2009, status: 'LOST', party_id: 'RJD' })];
  it('counts contests and decided wins; detects the party switch', () => {
    expect(personStats(cands)).toEqual({ contests: 3, wins: 1, winRate: 50, parties: ['BJP', 'RJD'], switches: [{ from: 'RJD', to: 'BJP', year: 2014 }] });
  });
  it('no contests: zeros and no win rate', () => {
    expect(personStats([])).toEqual({ contests: 0, wins: 0, winRate: null, parties: [], switches: [] });
  });
});

describe('contestViews', () => {
  it('newest first, marks the first contest under a new party, links the seat', () => {
    const v = contestViews([c({ election_year: 2009, party_id: 'RJD', const_id: 'A', election_id: 'e09' }), c({ election_year: 2014, party_id: 'BJP', party_symbol_url: '/b.svg', vote_share: 39.1 })]);
    expect(v.map(x => x.year)).toEqual([2014, 2009]);
    expect(v[0]).toMatchObject({ firstUnderParty: true, mark: '/b.svg', share: 39.1 });
    expect(v[1]).toMatchObject({ firstUnderParty: false, constHref: '/election/e09/constituency/A' });
  });
});

describe('affidavitSeries', () => {
  it('oldest first, skipping contests without affidavit values', () => {
    expect(affidavitSeries([c({ election_year: 2025, assets: 48000000, liabilities: 3200000, criminal_cases: 1 }), c({ election_year: 2014 }), c({ election_year: 2009, assets: 11000000 })]))
      .toEqual([{ year: 2009, assets: 11000000, liabilities: null, criminalCases: null }, { year: 2025, assets: 48000000, liabilities: 3200000, criminalCases: 1 }]);
  });
});

describe('ageFrom', () => {
  it('computes whole years and handles a missing date', () => {
    expect(ageFrom('1958-10-03', new Date('2026-10-02'))).toBe(67);
    expect(ageFrom('1958-10-02', new Date('2026-10-02'))).toBe(68);
    expect(ageFrom(null)).toBeNull();
  });
});
```

Run → FAIL.

- [ ] **Step 3: Implement the derivation**

`frontend/src/model/derive/personPage.ts`:

```ts
import type { PersonCandidate } from '../types';
import { partyMark } from './partyMeta';

export type ContestStatus = 'LEADING' | 'TRAILING' | 'WON' | 'LOST' | 'PENDING';
export interface ContestView { key: string; year: number | null; electionName: string; constituency: string; constHref: string; partyId: string | null; partyLabel: string; mark: string | null; color: string;
  status: ContestStatus; votes: number; share: number | null; margin: number | null; firstUnderParty: boolean }
export interface PersonStats { contests: number; wins: number; winRate: number | null; parties: string[]; switches: { from: string; to: string; year: number }[] }
export interface AffidavitPoint { year: number; assets: number | null; liabilities: number | null; criminalCases: number | null }

const byYearDesc = (a: PersonCandidate, b: PersonCandidate) => (b.election_year ?? 0) - (a.election_year ?? 0);

export function contestStatus(c: PersonCandidate): ContestStatus {
  if (c.status === 'WON' || c.status === 'LEADING') return c.status;
  if (c.election_status === 'Finalized') return c.status === 'WON' ? 'WON' : 'LOST';
  if (c.status === 'TRAILING') return 'TRAILING';
  return 'PENDING';
}

export function contestViews(cands: PersonCandidate[]): ContestView[] {
  const asc = [...cands].sort((a, b) => -byYearDesc(a, b));
  const first = new Set<string>();
  let prev: string | null = null;
  asc.forEach(c => { if (prev !== null && c.party_id && c.party_id !== prev) first.add(c.id + c.election_id); prev = c.party_id ?? prev; });
  return [...cands].sort(byYearDesc).map(c => ({
    key: c.id + c.election_id, year: c.election_year, electionName: c.election_name ?? '', constituency: c.constituency_name ?? '',
    constHref: `/election/${c.election_id}/constituency/${c.const_id}`,
    partyId: c.party_id, partyLabel: c.party_abbreviation ?? c.party_id ?? '', mark: partyMark({ symbol_url: c.party_symbol_url, eci_symbol_url: c.party_eci_symbol_url }),
    color: c.party_color ?? 'var(--color-fallback)', status: contestStatus(c), votes: c.votes, share: c.vote_share ?? null,
    margin: c.margin || null, firstUnderParty: first.has(c.id + c.election_id),
  }));
}

export function personStats(cands: PersonCandidate[]): PersonStats {
  const decided = cands.filter(c => c.election_status === 'Finalized' || c.status === 'WON');
  const wins = cands.filter(c => c.status === 'WON').length;
  const parties: string[] = [];
  for (const c of [...cands].sort(byYearDesc)) if (c.party_id && !parties.includes(c.party_id)) parties.push(c.party_id);
  const switches: PersonStats['switches'] = [];
  const asc = [...cands].sort((a, b) => -byYearDesc(a, b));
  for (let i = 1; i < asc.length; i++) {
    const a = asc[i - 1].party_id, b = asc[i].party_id;
    if (a && b && a !== b) switches.push({ from: a, to: b, year: asc[i].election_year ?? 0 });
  }
  return { contests: cands.length, wins, winRate: decided.length ? Math.round((wins / decided.length) * 100) : null, parties, switches };
}

export function affidavitSeries(cands: PersonCandidate[]): AffidavitPoint[] {
  return [...cands].sort((a, b) => -byYearDesc(a, b))
    .filter(c => [c.assets, c.liabilities, c.criminal_cases].some(x => x != null))
    .map(c => ({ year: c.election_year ?? 0, assets: c.assets ?? null, liabilities: c.liabilities ?? null, criminalCases: c.criminal_cases ?? null }));
}

export function ageFrom(dob: string | null, today: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}
```

Win-rate definition (test): wins ÷ decided contests (finalized, or already won) → 1 of 2 = 50 %. The ongoing Live contest is not counted.

Run → PASS.

- [ ] **Step 4: VM, view test, views**

`frontend/src/viewmodels/pages/usePersonPageVM.ts`:

```ts
import { useMemo } from 'react';
import { useApi } from '../data/useApi';
import { getPerson } from '../../model/api/person.service';
import { ApiError } from '../../model/api/api-client';
import { ageFrom, affidavitSeries, contestViews, personStats, type ContestView, type PersonStats, type AffidavitPoint } from '../../model/derive/personPage';

const NOT_FOUND = 'NOT_FOUND' as const;

export interface PersonPageVM { /* exactly as in Interfaces above */ }

export function usePersonPageVM(id: string): PersonPageVM {
  // useApi's error is a string, so a 404 is turned into a value here.
  const { data: raw, error } = useApi(() => getPerson(id).catch(e => { if (e instanceof ApiError && e.status === 404) return NOT_FOUND; throw e; }), [id], { key: `person_${id}` });
  return useMemo((): PersonPageVM => {
    const notFound = raw === NOT_FOUND;
    const p = raw === NOT_FOUND ? null : raw;
    const cands = p?.candidates ?? [];
    const contests = contestViews(cands);
    const affidavit = affidavitSeries(cands);
    const latestContest = contests[0];
    return {
      status: notFound ? 'notFound' : error ? 'error' : p ? 'ready' : 'loading',
      name: p?.name ?? '', photo: p?.photo_url ?? null,
      currentParty: latestContest?.partyId ? { label: latestContest.partyLabel, mark: latestContest.mark, color: latestContest.color } : null,
      facts: { age: ageFrom(p?.date_of_birth ?? null), gender: p?.gender ?? null, education: p?.education ?? null, home: [p?.district?.name, p?.state?.name].filter(Boolean).join(', ') || null },
      wikipedia: p?.wikipedia_url ?? null, bio: p?.bio ?? null,
      incumbent: !!cands.slice().sort((a, b) => (b.election_year ?? 0) - (a.election_year ?? 0))[0]?.is_incumbent,
      stats: personStats(cands), contests, affidavit, latest: affidavit[affidavit.length - 1] ?? null,
    };
  }, [raw, error]);
}
```

(Confirm `getPerson` lives in `model/api/person.service.ts` and returns `PersonDetail`.)

`frontend/src/views/__tests__/personPage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { PersonPageView } from '../person/PersonPageView';
import type { PersonPageVM } from '../../viewmodels/pages/usePersonPageVM';

afterEach(cleanup);
const base: PersonPageVM = {
  status: 'ready', name: 'Ram Kripal Yadav', photo: null, currentParty: { label: 'BJP', mark: null, color: '#f80' },
  facts: { age: 67, gender: 'M', education: 'Post Graduate', home: 'Patna, Bihar' }, wikipedia: 'https://en.wikipedia.org/wiki/R', bio: 'A long bio.',
  incumbent: true, stats: { contests: 2, wins: 1, winRate: 50, parties: ['BJP', 'RJD'], switches: [{ from: 'RJD', to: 'BJP', year: 2014 }] },
  contests: [{ key: 'a', year: 2014, electionName: 'Lok Sabha 2014', constituency: 'Patliputra', constHref: '/election/e/constituency/P', partyId: 'BJP', partyLabel: 'BJP', mark: null, color: '#f80', status: 'WON', votes: 383266, share: 39.1, margin: 40322, firstUnderParty: true }],
  affidavit: [{ year: 2014, assets: 22000000, liabilities: null, criminalCases: 0 }], latest: { year: 2014, assets: 22000000, liabilities: null, criminalCases: 0 },
};

describe('PersonPageView', () => {
  it('renders profile, stats with the switch, timeline and affidavit', () => {
    render(<MemoryRouter><PersonPageView vm={base} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Ram Kripal Yadav' })).toBeInTheDocument();
    expect(screen.getByText('Age 67')).toBeInTheDocument();
    expect(screen.getByText('A long bio.')).toBeInTheDocument();
    expect(screen.getByText('RJD → BJP in 2014')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Lok Sabha 2014/ })).toHaveAttribute('href', '/election/e/constituency/P');
    expect(screen.getByText('First contest under BJP')).toBeInTheDocument();
    expect(screen.getAllByText('₹2.2 Cr').length).toBeGreaterThan(0);
  });

  it('a person with no contests, DOB or affidavit still shows the header', () => {
    render(<MemoryRouter><PersonPageView vm={{ ...base, currentParty: null, facts: { age: null, gender: null, education: null, home: null }, wikipedia: null, bio: null,
      incumbent: false, stats: { contests: 0, wins: 0, winRate: null, parties: [], switches: [] }, contests: [], affidavit: [], latest: null }} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Ram Kripal Yadav' })).toBeInTheDocument();
    expect(screen.queryByText('Win rate')).toBeNull();
    expect(screen.queryByText('Affidavit')).toBeNull();
    expect(screen.queryByText(/Age/)).toBeNull();
  });
});
```

`frontend/src/views/person/AffidavitChart.tsx` — inline SVG grouped bars (assets, liabilities) per year, no chart library:

```tsx
import type { PersonPageVM } from '../../viewmodels/pages/usePersonPageVM';

const W = 320, H = 120, PAD = 18;

export function AffidavitChart({ points, label }: { points: PersonPageVM['affidavit']; label: string }) {
  const max = Math.max(1, ...points.flatMap(p => [p.assets ?? 0, p.liabilities ?? 0]));
  const slot = (W - PAD * 2) / Math.max(points.length, 1);
  const bw = Math.min(14, slot / 3);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {points.map((p, i) => {
        const x = PAD + i * slot + slot / 2;
        return (
          <g key={p.year}>
            {p.assets != null && <rect x={x - bw - 1} y={y(p.assets)} width={bw} height={H - PAD - y(p.assets)} className="fill-accent" />}
            {p.liabilities != null && <rect x={x + 1} y={y(p.liabilities)} width={bw} height={H - PAD - y(p.liabilities)} className="fill-live" />}
            <text x={x} y={H - 4} textAnchor="middle" className="fill-muted text-[9px]">{p.year}</text>
          </g>
        );
      })}
    </svg>
  );
}
```

`frontend/src/views/person/PersonPageView.tsx` — header (photo `Avatar` 160/96 px with the current-party `PartyMark` badge, `h1` name, party label, facts line built from the non-null facts: `t('pp_age', { n })`, gender label, education, home; Wikipedia link; full bio), stats row (Contests, Wins, Win rate only when `winRate != null` → `${winRate}%`, Parties count with `t('pp_switch', last switch)` under it when there is a switch), contest timeline (one `Link` card per contest to `constHref`, accessible name = `${electionName} · ${constituency}`; party mark + label; status pill using `STATUS_STYLE` with `pp_lost` / `studio_status_*`; votes, share %, margin; `t('pp_first_under', { party })` line when `firstUnderParty`), affidavit tile only when `affidavit.length > 0` (latest assets/liabilities via `formatRupees`, criminal cases chip amber when > 0, `AffidavitChart`, and the per-year list). Layout: desktop two columns (`lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`, timeline left, affidavit right), mobile one column. Wrap in `PageShell` with `back={{ href: '/', label: t('back') }}`; non-ready states mirror the constituency page (`pp_not_found`, `error_occurred`, `loading`). Use the same tile/heading classes as Task 11.

Rewrite `frontend/src/pages/PersonDetail.tsx`:

```tsx
import { useParams } from 'react-router-dom';
import { usePersonPageVM } from '../viewmodels/pages/usePersonPageVM';
import { PersonPageView } from '../views/person/PersonPageView';

export default function PersonDetail() {
  const { id = '' } = useParams<{ id: string }>();
  return <PersonPageView vm={usePersonPageVM(id)} />;
}
```

- [ ] **Step 5: Run tests**

Run: `cd frontend && npx vitest run && npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: PASS.

Before committing, add the `docs/FEATURES.md` entry for this task (CLAUDE.md: document every feature before or during implementation): studio person page (profile, stats incl. party switches, contest timeline, affidavit trend); caste/religion never public.

- [ ] **Step 6: Commit**

```bash
git add docs/FEATURES.md -A frontend/src
git commit -m "feat(fe): studio person page (profile, stats, contest timeline, affidavit trend)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Remove legacy detail code, e2e, docs

**Files:**
- Delete (only if no importer remains): `frontend/src/components/organisms/CandidateTable.tsx`, `frontend/src/components/organisms/ConstituencyModalSubComponents.tsx`, `frontend/src/components/molecules/CandidateCard.tsx`, `frontend/src/components/atoms/PartyIcon.tsx`, `frontend/src/components/atoms/partySymbols.tsx`, `frontend/src/hooks/useConstituencyDetail.ts`, `frontend/src/hooks/usePersonProfile.ts`, `frontend/src/viewmodels/data/useConstituencyDetail.ts`, `frontend/src/viewmodels/data/usePersonProfile.ts`, `frontend/src/services/partySymbolCache.ts`, `frontend/src/model/api/partySymbolCache.ts` and their tests
- Modify: `frontend/e2e/dashboard.spec.ts`; Create: `frontend/e2e/detail.spec.ts`
- Modify: `docs/FEATURES.md`, `CLAUDE.md`

- [ ] **Step 1: Delete legacy files that nothing imports any more**

For each file in the list run (example for one):

```bash
cd frontend && f=components/organisms/CandidateTable; grep -rln "$f\|$(basename $f)'" src --include='*.ts' --include='*.tsx' | grep -v "src/$f"
```

No output → `git rm src/$f.tsx` (and its `__tests__` file if any). Output → keep the file. Then `npx tsc --noEmit -p tsconfig.json` must pass.

- [ ] **Step 2: Update e2e**

In `frontend/e2e/dashboard.spec.ts`:
- `track a seat in the map focus …` (line ~101): open with `?seat=BR_VS_100_BARAULI` (no `focus=map`), expect `page.getByRole('dialog', { name: /Barauli/i })`, click `Track` inside it, close, then check the Watchlist tab as before.
- `legacy ConstituencyDetail (reached from the seat panel) …` (line ~477): rename to `constituency page (reached from the seat dialog) in dark and light`; open `?seat=BR_VS_100_BARAULI`, click the dialog's `Full constituency page` link, expect `getByRole('heading', { level: 1, name: /Barauli/i })` and the `All candidates` table; keep the screenshots per theme (update snapshots with `--update-snapshots` once, review them).
- Delete `map focus seat list: rank numbers stay inside the panel` (the panel no longer exists); add an equivalent check that the seat dialog's rank column stays inside the dialog box (`boundingBox` of the first `#1` cell within the dialog's box).

Create `frontend/e2e/detail.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const BIHAR = process.env.E2E_BIHAR_ELECTION_ID ?? ''; // reuse however dashboard.spec.ts resolves the Bihar 2025 id

test('clicking a seat on the map opens the seat dialog, not the map focus', async ({ page }) => {
  await page.goto(`/election/${BIHAR}`);
  await page.locator('svg[aria-label="Constituency map"] path.seat').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/seat=/);
  await expect(page).not.toHaveURL(/focus=map/);
  await expect(page.getByRole('dialog').getByRole('link', { name: /Full constituency page/ })).toBeVisible();
});

test('a party opens the party dialog from standings and the URL carries ?party=', async ({ page }) => {
  await page.goto(`/election/${BIHAR}`);
  await page.getByRole('button', { name: /^Party details:/ }).first().click();
  await expect(page).toHaveURL(/party=/);
  await expect(page.getByRole('dialog')).toContainText('This election');
});

test('person page renders the profile and the contest timeline', async ({ page }) => {
  await page.goto(`/election/${BIHAR}?seat=BR_VS_100_BARAULI`);
  await page.getByRole('dialog').getByRole('link').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Contest timeline')).toBeVisible();
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the seat dialog is a bottom sheet', async ({ page }) => {
    await page.goto(`/election/${BIHAR}?seat=BR_VS_100_BARAULI`);
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    const box = (await sheet.boundingBox())!;
    expect(box.y + box.height).toBeGreaterThan(830);
  });
});
```

Resolve `BIHAR` and the seat path selector exactly as `dashboard.spec.ts` does (copy its constant/helper; check the class or attribute the map uses for seat paths in `useMapRendering.ts`).

Run (dev servers running: backend :3082, frontend :3080): `cd frontend && npm run e2e -- e2e/detail.spec.ts e2e/dashboard.spec.ts`
Expected: PASS.

- [ ] **Step 3: Docs**

`docs/FEATURES.md` — the feature entries were written in Tasks 9–12; check they read as one "Detail screens" section. Under Known Limitations add: affidavit columns only where admins/seeds filled them; seat-history runner-up/share appear after the next analysis recompute; the counting round in the seat dialog can trail the vote numbers by up to a few minutes (CDN cache); turnout and vote-share change vs the previous election are not shown (no source yet).

`CLAUDE.md` — in the Frontend bullet, add: "Constituency (`/election/:id/constituency/:constId`) and person (`/person/:id`) pages are studio MVVM pages (`src/viewmodels/pages`, `src/views/constituency`, `src/views/person`); party marks render through `views/ui/PartyMark` (logo → ECI symbol → dot)."

- [ ] **Step 4: Full verification**

Run:
```bash
cd backend && npx jest && npx tsc --noEmit -p tsconfig.json
cd ../frontend && npx vitest run && npm run lint && npm run build
```
Expected: all PASS. Then open the app (`/election/<Bihar 2025>`), click a seat, a party, the full page and a person, in dark and light, desktop and 390 px, and compare with `docs/design/frontend/*.png` and the fix lists in `NOTES.md`.

- [ ] **Step 5: Commit**

```bash
git add -A frontend backend docs CLAUDE.md
git commit -m "chore: remove legacy detail components; e2e and docs for the detail screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Spec deviations (decided while planning)

- **Analysis comes from the existing `GET /elections/:id/constituencies/:constId/analysis`** instead of being added to the detail endpoint (the endpoint already exists and is CDN-cached; no duplication).
- **Counting round comes from the constituency detail endpoint** (class-level `CACHE_CONTROL.PUBLIC`: `s-maxage=60, stale-while-revalidate=300`), not the live snapshot: the snapshot has no round fields and round changes do not bump the live version, so adding them would need a migration (spec: no migration). The open dialog refetches it on every new live version, but the CDN can still serve it up to ~6 min old; votes/status stay live. Not shown in the map tooltip.
- **No "updated X ago" label** in the seat dialog / page chip (the spec mock-up had one): that time would come from the same cached response and could sit next to newer vote numbers (D9).
- **Party "vote share change vs the previous election" and the constituency "turnout change" are not shown**: no source for the previous values exists yet (spec: "when known").
- **Standings rows**: the row keeps its existing click = lock/highlight; the party mark in front of the row is a separate "Party details" button that opens the dialog (nested buttons are invalid HTML).
