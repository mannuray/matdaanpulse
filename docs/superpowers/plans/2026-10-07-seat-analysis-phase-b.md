# Seat Analysis Rework, Phase B: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The live half of the seat analysis. It adds:
- a pre-counting **baseline** per seat;
- a **seat timeline** written by the ingest;
- a bounded **trail** per seat in each live snapshot;
- a **live analysis** that runs in the browser with the same shared module;
- a swap of the dashboard's live/upcoming seat maps onto it, retiring the second engine.

It is data first: the new live signals (too close, momentum, upsets) are computed and exposed, but not drawn. The map
brainstorm designs their visuals next.

**Architecture:**
- **Shared module** (`seat-analysis/`, byte-identical in backend and frontend) gains:
  - `baselineOf(input)`: historical facts per seat, fixed before counting;
  - `analyseLive(baseline, seats)`: per-seat live state and live tallies, reusing `rank`, `relation`, `samePerson`.
- **Backend:**
  - stores the baseline in `election_analysis.baseline`, serves it at `GET /elections/:id/baseline`;
  - appends `seat_rounds` rows in the same transaction (and under the same seat lock) as every results write;
  - adds a ≤6-point trail per seat to the versioned snapshot, read in the snapshot's own RepeatableRead transaction.
- **Frontend:** runs `analyseLive` on baseline + snapshot.

**Tech Stack:** NestJS + Prisma + PostgreSQL 15, Jest; React + Vitest; ts-node scraper (simulation).

**Spec:** `docs/superpowers/specs/2026-10-07-seat-analysis-design.md` §5 (Phase B), with three decisions from
2026-10-07:
- **(a) Baseline lifecycle:** computed on demand (admin button / compute endpoint / CLI) and automatically when an
  election goes Live. `live:check` reports NOT READY if it is missing or older than the latest candidate change. There
  is no hook in candidate CRUD.
- **(b) Data first:** no new visuals; the map brainstorm follows.
- **(c) Trail point fields:** each point also carries `v` (votes counted), needed for "comeback".

## Global Constraints

- Work on branch `feat/seat-analysis-b` (create it from `main` before Task 1). Never push to `main` before Task 11.
- **Migrations:** idempotent (`IF NOT EXISTS` / `DO` blocks), no seed-data dependency, numbered `025_…`.
- **Prisma:** `backend/prisma/schema.prisma` in sync. Never apply the known drift (`candidates.person_id SET NOT NULL`,
  `metadata` drops). Don't run `prisma format`: it reflows unrelated models.
- **Shared module:** files are byte-identical in `backend/src/common/seat-analysis/` and
  `frontend/src/model/derive/seatAnalysis/` (only `lineage.ts` differs). Add every new shared file to both `SHARED`
  lists in the identical tests.
- **Timeline writes:**
  - one set-based SQL statement per batch;
  - inside the transaction that holds `lockSeats`;
  - in both `IngestService.write` and `SeatCorrectionService.correct`.
- **Snapshot trail:** read inside `loadSnapshot`'s RepeatableRead transaction; at most 6 points per seat, bounded in SQL.
- **Frontend:** `npm run lint` passes (MVVM boundaries); `model/` imports no React.
- **Degrade cleanly:** a missing baseline (404 / null), a snapshot without `trail`, or an older backend leaves the
  dashboard working, with the live/upcoming analysis maps simply empty.
- **Thresholds:** the too-close / momentum constants are **provisional**. They are tuned on synthetic simulation
  rounds, not real mid-count data; say so in docs.
- **Commits:** commit after every task, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Production:** nothing here touches it before Task 11, and every Task 11 step needs the user's go-ahead. Render
  deploys **only by CLI** (`render deploys create srv-dav07gl9fdbs73aluc2g --commit <sha> --wait`); a push deploys only
  Vercel.

## Review Focus

1. **Sequence races:** `seat_rounds.seq = last + 1` is computed under the seat lock. A batch that touches the same
   seat twice, or an ingest racing a correction, must never produce a duplicate `(election_id, const_id, seq)`. Pinned
   in Task 2 (DB spec: two writes in one transaction, then a correction).
2. **Snapshot consistency:** the trail must come from the same transaction as the version and results, so a snapshot
   never pairs version N's results with a later trail. Pinned in Task 3 (the trail is read via `tx`, unit test on the
   builder; a code-review item).
3. **Live = final:** for every finalized election, `analyseLive(baselineOf(input), final results)` must equal
   `analyse(input)` on winner, margin, outcome, swing, incumbent result, party held/gained/lost and flow. Pinned in
   Task 7 (DB spec over all local VS elections).
4. **Pre-count seats:** an Upcoming/Live seat with candidates but no votes gets call `not_started`, no outcome, and
   sitting MLA status `not_started`, never "lost". Pinned in Task 6.
5. **Missing pieces:** a baseline 404, a snapshot with no `trail`, and a seat absent from the baseline all degrade to
   empty / `counting`, with no crash. Pinned in Tasks 6 and 8.

---

## File structure

**Shared module:**
- `seat.ts`: export `makeCtx` (moved from `index.ts`) and `classOver`; fix `incumbent.won` = null without a winner.
- `match.ts`: add `strictSamePerson` (differing person_ids never match).
- `notes.ts`: export `switcherOf`, `heavyweightsOf` (heavyweights use `strictSamePerson`).
- `election.ts`: export `allianceOf`.
- `baseline.ts` (new): `baselineOf`.
- `live.ts` (new): `analyseLive`, the call / momentum constants.
- `types.ts`: add `SeatIn.electors`, and the `Baseline`, `SeatBaseline`, `SeatTrail`, `SeatLiveIn`, `SeatLive`,
  `LiveTally` types.
- `index.ts`: re-export the above.

**Backend:**
- `database/migrations/025_seat_rounds.sql`; `backend/prisma/schema.prisma`.
- `backend/src/modules/ingest/seat-rounds.ts` (new): `appendSeatRounds(tx, electionId, constIds, source)`.
- `ingest.service.ts`, `seat-correction.service.ts`: call it; roster gains `baseline` freshness.
- `results/results.service.ts`: trail in the snapshot; `getSeatRounds`.
- `constituencies/seat-analysis.loader.ts`: candidates left-joined to results; electors.
- `constituencies/seat-analysis.service.ts`: `computeBaseline`, `baseline`.
- `elections/elections.controller.ts`: `GET :id/baseline`, `GET :id/constituencies/:constId/rounds`.
- `admin/controllers/admin-constituencies.controller.ts`: compute dispatches final vs baseline.
- `admin/controllers/admin-elections.controller.ts`: baseline on transition to Live.

**Scraper:**
- `src/live/check.ts`, `src/live/types.ts`: baseline readiness.
- `src/simulation/setup.ts`: copy the delimitation.
- `src/simulation/tune-calls.ts` (new).

**Frontend:**
- `model/types/index.ts`: `ResultsSnapshot.trail`.
- `model/api/api.ts`: `getBaseline`.
- `viewmodels/data/useBaseline.ts` (new).
- `model/derive/liveMaps.ts` (new): live → dashboard maps.
- `viewmodels/data/useLiveAnalysis.ts` (new).
- `viewmodels/sources/useDashboardSources.ts`: the swap.
- `viewmodels/data/useHistoryAnalysis.ts` and `model/derive/intelligence.ts`: keep only marginTrend / partyTrend.

---

### Task 1: Migration 025 + Prisma

**Files:** Create `database/migrations/025_seat_rounds.sql`. Modify `backend/prisma/schema.prisma`.

**Interfaces:**
- Produces:
  - table `seat_rounds(election_id, const_id, seq, round_no, round_total, leader_candidate_id, runner_up_candidate_id, margin, votes_counted, declared, observed_at, source)`, PK `(election_id, const_id, seq)`;
  - `election_analysis.data` nullable;
  - `election_analysis.baseline_computed_at TIMESTAMPTZ`;
  - Prisma model `seat_rounds`.

- [ ] **Step 1: Write the migration**

```sql
-- 025: seat timeline + baseline bookkeeping (spec docs/superpowers/specs/2026-10-07-seat-analysis-design.md §5).
-- seat_rounds: one row per change of a seat's leader, runner-up, margin or declared state, appended in the same
-- transaction (under the same seat lock) as the results write, by the ingest and by admin seat corrections.
CREATE TABLE IF NOT EXISTS seat_rounds (
  election_id            UUID         NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  const_id               VARCHAR(100) NOT NULL REFERENCES constituencies(id) ON DELETE CASCADE,
  seq                    INTEGER      NOT NULL,
  round_no               INTEGER,
  round_total            INTEGER,
  leader_candidate_id    UUID,
  runner_up_candidate_id UUID,
  margin                 INTEGER,
  votes_counted          INTEGER      NOT NULL DEFAULT 0,
  declared               BOOLEAN      NOT NULL DEFAULT false,
  observed_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  source                 TEXT         NOT NULL,
  PRIMARY KEY (election_id, const_id, seq)
);
CREATE INDEX IF NOT EXISTS seat_rounds_latest ON seat_rounds (election_id, const_id, seq DESC);

-- An Upcoming election can have a baseline before any final analysis exists.
ALTER TABLE election_analysis ALTER COLUMN data DROP NOT NULL;
ALTER TABLE election_analysis ADD COLUMN IF NOT EXISTS baseline_computed_at TIMESTAMPTZ;
```

- [ ] **Step 2: Apply twice locally**

Run: `U=$(grep -E "^DATABASE_URL" .env | cut -d= -f2- | sed 's/?schema=public//'); for i in 1 2; do psql "$U" -q -v ON_ERROR_STOP=1 -f database/migrations/025_seat_rounds.sql && echo ok$i; done`
Expected: `ok1`, `ok2` (NOTICEs fine).

- [ ] **Step 3: Prisma (edit by hand; do not run `prisma format`)**

```prisma
/// Seat timeline (migration 025): one row per change of leader, runner-up, margin or declared state.
model seat_rounds {
  election_id            String         @db.Uuid
  const_id               String         @db.VarChar(100)
  seq                    Int
  round_no               Int?
  round_total            Int?
  leader_candidate_id    String?        @db.Uuid
  runner_up_candidate_id String?        @db.Uuid
  margin                 Int?
  votes_counted          Int            @default(0)
  declared               Boolean        @default(false)
  observed_at            DateTime       @default(now()) @db.Timestamptz(6)
  source                 String
  elections              elections      @relation(fields: [election_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  constituencies         constituencies @relation(fields: [const_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@id([election_id, const_id, seq])
  @@index([election_id, const_id, seq(sort: Desc)], map: "seat_rounds_latest")
}
```

Then:
- add `seat_rounds seat_rounds[]` to `elections` and to `constituencies`;
- in `election_analysis`, change `data Json` → `data Json?` and add `baseline_computed_at DateTime? @db.Timestamptz(6)`.

- [ ] **Step 4: Generate, drift check, type check**

Run: `cd backend && npx prisma generate >/dev/null && U=$(grep -E "^DATABASE_URL" ../.env | cut -d= -f2-) && DIRECT_URL=$U npx prisma migrate diff --from-url "$U" --to-schema-datamodel prisma/schema.prisma --script | grep -E "^(ALTER|CREATE|DROP)"; npx tsc --noEmit && echo TSC_OK`
Expected: only `ALTER TABLE "candidates" ALTER COLUMN "person_id" SET NOT NULL;`, then `TSC_OK`. If `tsc` fails where
`election_analysis.data` is read as non-null (`seat-analysis.service.ts` `summary`), keep the `?? null` cast.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/025_seat_rounds.sql backend/prisma/schema.prisma
git commit -m "feat(db): migration 025: seat_rounds timeline, election_analysis baseline bookkeeping"
```

---

### Task 2: Timeline writes (ingest + seat corrections)

**Files:**
- Create: `backend/src/modules/ingest/seat-rounds.ts`, `backend/src/modules/ingest/seat-rounds.db.spec.ts`
- Modify:
  - `backend/src/modules/ingest/ingest.service.ts` (end of `write`)
  - `backend/src/modules/ingest/seat-correction.service.ts` (inside `if (changed)`)

**Interfaces:**
- Produces: `appendSeatRounds(tx: { $executeRaw: PrismaService['$executeRaw'] }, electionId: string, constIds: string[], source: string, observedAt: Date): Promise<number>`.
  It appends one row per seat whose (leader, runner-up, margin, declared) differs from its latest row, and returns the
  number of rows inserted.

- [ ] **Step 1: Write the failing DB spec**

`seat-rounds.db.spec.ts`, following `ingest.db.spec.ts` (rolled back; skipped without a DB unless
`REQUIRE_DB_TESTS=1`):
```ts
/** appendSeatRounds against the local DB; every write is rolled back. */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { appendSeatRounds } from './seat-rounds';

config({ path: join(__dirname, '../../../.env') });
class Rollback extends Error {}
const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('seat timeline (DB)', () => {
  let prisma: PrismaClient | null = null;
  let seat: { election_id: string; const_id: string; cands: { id: string; party_id: string | null }[] } | null = null;
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const c = new PrismaClient();
    try {
      await c.$queryRaw`SELECT 1 FROM seat_rounds LIMIT 1`;
      const r = await c.results.findFirst({ where: { candidates: { party_id: { not: 'NOTA' } } }, select: { election_id: true, const_id: true } });
      if (r) seat = { ...r, cands: await c.candidates.findMany({ where: { election_id: r.election_id, const_id: r.const_id, NOT: { party_id: 'NOTA' } }, select: { id: true, party_id: true } }) };
      prisma = c;
    } catch { await c.$disconnect(); }
  });
  afterAll(async () => prisma?.$disconnect());

  async function run(name: string, body: (tx: any) => Promise<void>) {
    if (!prisma || !seat || seat.cands.length < 2) { if (REQUIRE_DB) throw new Error(`no DB (${name})`); console.warn(`SKIPPED (no DB): ${name}`); return; }
    await prisma.$transaction(async tx => { await body(tx); throw new Rollback(); }, { timeout: 30_000 }).catch(e => { if (!(e instanceof Rollback)) throw e; });
  }
  const setVotes = (tx: any, a: number, b: number, status: [string, string] = ['LEADING', 'TRAILING']) => tx.$executeRaw`
    UPDATE results SET votes = CASE candidate_id WHEN ${seat!.cands[0].id}::uuid THEN ${a} WHEN ${seat!.cands[1].id}::uuid THEN ${b} ELSE 0 END,
      status = (CASE candidate_id WHEN ${seat!.cands[0].id}::uuid THEN ${status[0]} WHEN ${seat!.cands[1].id}::uuid THEN ${status[1]} ELSE 'TRAILING' END)::result_status
    WHERE election_id = ${seat!.election_id}::uuid AND const_id = ${seat!.const_id}`;
  const rows = (tx: any) => tx.seat_rounds.findMany({ where: { election_id: seat!.election_id, const_id: seat!.const_id }, orderBy: { seq: 'asc' } });

  it('appends only on change; seq increases; a lead switch and a declaration are rows', () => run('append', async tx => {
    await tx.$executeRaw`DELETE FROM seat_rounds WHERE election_id = ${seat!.election_id}::uuid AND const_id = ${seat!.const_id}`;
    const at = new Date('2027-02-27T04:00:00Z');
    await setVotes(tx, 100, 50);
    expect(await appendSeatRounds(tx, seat!.election_id, [seat!.const_id], 'ingest', at)).toBe(1);
    expect(await appendSeatRounds(tx, seat!.election_id, [seat!.const_id], 'ingest', at)).toBe(0); // unchanged
    await setVotes(tx, 100, 150, ['TRAILING', 'LEADING']);
    await appendSeatRounds(tx, seat!.election_id, [seat!.const_id], 'ingest', at);
    await setVotes(tx, 300, 150, ['WON', 'LOST']);
    await appendSeatRounds(tx, seat!.election_id, [seat!.const_id], 'correction', at);
    const r = await rows(tx);
    expect(r.map((x: any) => [x.seq, x.leader_candidate_id, x.margin, x.declared, x.source])).toEqual([
      [1, seat!.cands[0].id, 50, false, 'ingest'], [2, seat!.cands[1].id, 50, false, 'ingest'], [3, seat!.cands[0].id, 150, true, 'correction'],
    ]);
    expect(r[2].votes_counted).toBe(450);
  }));

  it('two appends of the same seat in one transaction never duplicate a seq', () => run('seq', async tx => {
    await tx.$executeRaw`DELETE FROM seat_rounds WHERE election_id = ${seat!.election_id}::uuid AND const_id = ${seat!.const_id}`;
    await setVotes(tx, 10, 5); await appendSeatRounds(tx, seat!.election_id, [seat!.const_id, seat!.const_id], 'ingest', new Date());
    await setVotes(tx, 20, 5); await appendSeatRounds(tx, seat!.election_id, [seat!.const_id], 'ingest', new Date());
    expect((await rows(tx)).map((x: any) => x.seq)).toEqual([1, 2]);
  }));
});
```

- [ ] **Step 2: Run, see it fail**

Run: `cd backend && REQUIRE_DB_TESTS=1 npx jest --runInBand src/modules/ingest/seat-rounds.db.spec.ts`
Expected: FAIL (`Cannot find module './seat-rounds'`).

- [ ] **Step 3: Implement `seat-rounds.ts`**

```ts
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Seat timeline (migration 025): for each seat in `constIds`, append a row when its leader, runner-up, margin or
 * declared state differs from its latest row. One set-based statement. Call it inside the transaction that holds the
 * seat lock (`lockSeats`) and after the results write, so `seq = latest + 1` cannot race.
 * Leader = the WON/LEADING row, else the most votes; NOTA is never leader or runner-up; votes_counted includes NOTA.
 */
export async function appendSeatRounds(tx: Pick<PrismaService, '$executeRaw'>, electionId: string, constIds: string[], source: string, observedAt: Date): Promise<number> {
  const ids = [...new Set(constIds)];
  if (!ids.length) return 0;
  return tx.$executeRaw`
    WITH ranked AS (
      SELECT r.const_id, r.candidate_id, r.votes, r.status,
             row_number() OVER (PARTITION BY r.const_id ORDER BY (r.status IN ('WON', 'LEADING')) DESC, r.votes DESC, r.candidate_id) AS rn
      FROM results r JOIN candidates c ON c.id = r.candidate_id
      WHERE r.election_id = ${electionId}::uuid AND r.const_id = ANY(${ids}::varchar[]) AND c.party_id IS DISTINCT FROM 'NOTA'
    ),
    cur AS (
      SELECT k.const_id,
             (array_agg(k.candidate_id ORDER BY k.rn) FILTER (WHERE k.rn = 1))[1] AS leader,
             (array_agg(k.candidate_id ORDER BY k.rn) FILTER (WHERE k.rn = 2))[1] AS runner,
             max(k.votes) FILTER (WHERE k.rn = 1) - coalesce(max(k.votes) FILTER (WHERE k.rn = 2), 0) AS margin,
             bool_or(k.status = 'WON') AS declared,
             (SELECT coalesce(sum(r2.votes), 0) FROM results r2 WHERE r2.election_id = ${electionId}::uuid AND r2.const_id = k.const_id)::int AS counted
      FROM ranked k GROUP BY k.const_id
    ),
    last AS (
      SELECT DISTINCT ON (s.const_id) s.const_id, s.seq, s.leader_candidate_id, s.runner_up_candidate_id, s.margin, s.declared
      FROM seat_rounds s WHERE s.election_id = ${electionId}::uuid AND s.const_id = ANY(${ids}::varchar[])
      ORDER BY s.const_id, s.seq DESC
    )
    INSERT INTO seat_rounds (election_id, const_id, seq, round_no, round_total, leader_candidate_id, runner_up_candidate_id, margin, votes_counted, declared, observed_at, source)
    SELECT ${electionId}::uuid, cur.const_id, coalesce(last.seq, 0) + 1, k.current_round, k.total_rounds, cur.leader, cur.runner, cur.margin, cur.counted, cur.declared, ${observedAt}, ${source}
    FROM cur
    JOIN constituencies k ON k.id = cur.const_id
    LEFT JOIN last ON last.const_id = cur.const_id
    WHERE cur.counted > 0 AND (last.const_id IS NULL
       OR last.leader_candidate_id IS DISTINCT FROM cur.leader OR last.runner_up_candidate_id IS DISTINCT FROM cur.runner
       OR last.margin IS DISTINCT FROM cur.margin OR last.declared IS DISTINCT FROM cur.declared)`;
}
```

- [ ] **Step 4: Run the DB spec**

Run: `cd backend && REQUIRE_DB_TESTS=1 npx jest --runInBand src/modules/ingest/seat-rounds.db.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire it in**

- In `IngestService.write`, after the holds `DELETE`:
  ```ts
  if (applied.length) await appendSeatRounds(tx, electionId, applied.map(a => a.seat.const_id), 'ingest', observedAt);
  ```
  (`write` already runs inside the `lockSeats` transaction.)
- In `SeatCorrectionService.correct`, inside `if (changed) { … }` after the `seat_ingest_state` upsert:
  ```ts
  await appendSeatRounds(tx, electionId, [constId], 'correction', now);
  ```
- Import `appendSeatRounds` from `./seat-rounds` in both files.

- [ ] **Step 6: Extend the existing ingest DB spec**

In `ingest.db.spec.ts`, add a test. It applies one batch through `svc.write` (reuse an existing test's shape for a
2-candidate change), then asserts that `tx.seat_rounds.count({ where: { election_id, const_id } })` went up by 1, and
that a second identical write adds nothing. Run:
`cd backend && REQUIRE_DB_TESTS=1 npm run test:db 2>&1 | grep -E "^Tests:|✕"` → all pass; `npm run test:unit` → all pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/ingest
git commit -m "feat(live): seat timeline: appendSeatRounds in the ingest and seat-correction transactions (set-based, under the seat lock)"
```

---

### Task 3: Snapshot trail, rounds endpoint, simulation delimitation

**Files:**
- Modify:
  - `backend/src/modules/results/results.service.ts` (`ResultsSnapshot`, `loadSnapshot`, `buildSnapshot`, new `getSeatRounds`)
  - `backend/src/modules/elections/elections.controller.ts` (`GET :id/constituencies/:constId/rounds`)
  - `scraper/src/simulation/setup.ts`
- Test: `backend/src/modules/results/results.service.spec.ts` (or the spec that covers `buildSnapshot`; find it with `grep -rln buildSnapshot backend/src`); `backend/src/modules/elections/elections.http.spec.ts`

**Interfaces:**
- Produces:
  - `ResultsSnapshot.trail: Record<string, { points: { r: number | null; lp: string | null; m: number | null; v: number }[]; lc: number; pk: number | null }>`.
    Points are oldest → newest, at most 6; only seats with timeline rows appear.
  - `buildSnapshot(version, rows, seatStates, trails = [])`.
  - `GET /elections/:id/constituencies/:constId/rounds` → `{ seq, r, rt, lp, m, v, declared, at }[]`.

- [ ] **Step 1: Failing builder test**

```ts
it('buildSnapshot carries the per-seat trail; seats without timeline rows have none', () => {
  const s = buildSnapshot(7, [], [], [{ const_id: 'A', points: [{ r: 1, lp: 'BJP', m: 120, v: 900 }, { r: 2, lp: 'INC', m: 40, v: 1800 }], lc: 1, pk: 120 }]);
  expect(s.trail).toEqual({ A: { points: [{ r: 1, lp: 'BJP', m: 120, v: 900 }, { r: 2, lp: 'INC', m: 40, v: 1800 }], lc: 1, pk: 120 } });
  expect(buildSnapshot(7, []).trail).toEqual({});
});
```
Run: `cd backend && npx jest -t "trail"` → FAIL.

- [ ] **Step 2: Implement**

- `ResultsSnapshot` gains `trail: Record<string, SeatTrailDto>` with
  `export interface SeatTrailDto { points: { r: number | null; lp: string | null; m: number | null; v: number }[]; lc: number; pk: number | null }`.
- `buildSnapshot(…, trails: ({ const_id: string } & SeatTrailDto)[] = [])` adds
  `trail: Object.fromEntries(trails.map(({ const_id, ...t }) => [const_id, t]))` to its return.
- In `loadSnapshot`, inside the same `tx`, after `seatStates`:
  ```ts
  // Same RepeatableRead transaction as the version and results: a snapshot never pairs version N with another trail.
  const trails = await tx.$queryRaw<({ const_id: string } & SeatTrailDto)[]>`
    SELECT t.const_id,
           json_agg(json_build_object('r', t.round_no, 'lp', c.party_id, 'm', t.margin, 'v', t.votes_counted) ORDER BY t.seq) FILTER (WHERE t.rn <= 6) AS points,
           (count(*) FILTER (WHERE t.changed))::int AS lc,
           max(t.margin) AS pk
    FROM (
      SELECT s.*, row_number() OVER (PARTITION BY s.const_id ORDER BY s.seq DESC) AS rn,
             (lag(s.leader_candidate_id) OVER (PARTITION BY s.const_id ORDER BY s.seq) IS NOT NULL
              AND lag(s.leader_candidate_id) OVER (PARTITION BY s.const_id ORDER BY s.seq) IS DISTINCT FROM s.leader_candidate_id) AS changed
      FROM seat_rounds s WHERE s.election_id = ${id}::uuid
    ) t LEFT JOIN candidates c ON c.id = t.leader_candidate_id
    GROUP BY t.const_id`;
  ```
  Then pass `trails` to `buildSnapshot`.
- `getSeatRounds(electionId, constId)`:
  ```ts
  async getSeatRounds(electionId: string, constId: string) {
    const rows = await this.prisma.$queryRaw<{ seq: number; r: number | null; rt: number | null; lp: string | null; m: number | null; v: number; declared: boolean; at: Date }[]>`
      SELECT s.seq, s.round_no AS r, s.round_total AS rt, c.party_id AS lp, s.margin AS m, s.votes_counted AS v, s.declared, s.observed_at AS at
      FROM seat_rounds s LEFT JOIN candidates c ON c.id = s.leader_candidate_id
      WHERE s.election_id = ${electionId}::uuid AND s.const_id = ${constId} ORDER BY s.seq`;
    return rows;
  }
  ```
- Controller (next to the constituency routes):
  ```ts
  /** A seat's counting timeline (seat dialog sparkline); short CDN cache while counting. */
  @Get(':id/constituencies/:constId/rounds')
  async getSeatRounds(@Param('id', ParseUUIDPipe) id: string, @Param('constId') constId: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    applyCacheControl(req, res, CACHE_CONTROL.RESULTS_LATEST);
    return this.resultsService.getSeatRounds(id, constId);
  }
  ```
  Add an HTTP spec case: `GET /elections/<EID>/constituencies/A/rounds` → 200, `cache-control` = `RESULTS_LATEST`,
  body from the mocked `getSeatRounds`. Add `getSeatRounds` to the spec's `resultsService` mock.

- [ ] **Step 3: Simulation election copies the delimitation**

In `scraper/src/simulation/setup.ts`, add `delimitation` to the cloned election:
`INSERT INTO elections (id, name, type, state_id, year, status, tentative_next_date, manifest_url, delimitation) SELECT $1, …, manifest_url, delimitation FROM …`.
Keep the existing column order and add `delimitation` in both lists. Without it the simulation election has no
comparable history and an empty baseline.

- [ ] **Step 4: Run tests and the smoke**

Run: `cd backend && npx tsc --noEmit && npm run test:unit 2>&1 | grep -E "^Tests:|✕" && REQUIRE_DB_TESTS=1 npm run test:db 2>&1 | grep -E "^Tests:|✕"`
Expected: all pass. Then run the simulation smoke as `docs/LIVE_RUNBOOK.md` → Simulation describes:
`cd scraper && npm run sim:smoke` (it starts what it needs, or follow its usage line).
Expected: it passes. After it, check:
`psql "$U" -At -c "select count(*) from seat_rounds s join elections e on e.id=s.election_id where e.name like '%Simulation%'"` > 0.
Then `npm run sim:cleanup`.

- [ ] **Step 5: Commit**

```bash
git add backend/src scraper/src/simulation/setup.ts
git commit -m "feat(live): snapshot carries a bounded per-seat trail; seat rounds endpoint; simulation copies the delimitation"
```

---

### Task 4: Loader reads candidates without results; electors; two Phase A fixes

**Files:**
- Modify:
  - `backend/src/modules/constituencies/seat-analysis.loader.ts`
  - shared `types.ts`, `match.ts`, `seat.ts`, `notes.ts` (backend, then copy to the frontend)
  - `backend/src/common/seat-analysis/fixtures.ts`
- Test: `backend/src/common/seat-analysis/seat-analysis.spec.ts`

**Interfaces:**
- Produces:
  - `SeatIn.electors: number | null`;
  - `strictSamePerson(a: Who, b: Who): boolean`;
  - `Incumbency.won` is null when the seat the incumbent contests has no winner yet.

- [ ] **Step 1: Failing module tests (append to `seat-analysis.spec.ts`)**

```ts
describe('phase B fixes', () => {
  it('incumbent.won is null while the seat they contest has no winner', () => {
    const prev = el(2015, [seat(1, [['A', 'X', 50], ['B', 'Y', 40]])]);
    const inc = one(input(el(2020, [seat(1, [['A', 'X', 0, 'TRAILING'], ['C', 'Y', 0, 'TRAILING']])]), [prev])).incumbent;
    expect(inc).toMatchObject({ recontested: true, won: null });
  });
  it('a heavyweight never matches a namesake with a different person_id', () => {
    const cur = el(2020, [seat(1, [['Ram Kumar', 'BJP', 50, undefined, 'p2'], ['Z', 'INC', 40]])]);
    const s = one(input(cur, [], { heavyweights: [{ person_id: 'p1', name: 'Ram Kumar', party_id: 'BJP', reason: 'leader' }] }));
    expect(s.notes.filter(n => n.kind === 'heavyweight')).toEqual([]);
  });
});
```
Run: `cd backend && npx jest src/common/seat-analysis -t "phase B fixes"` → 2 FAIL.

- [ ] **Step 2: Implement the fixes**

- **`match.ts`:**
  ```ts
  /** Like samePerson, but two different person_ids never match (heavyweights: a namesake is not the leader). */
  export function strictSamePerson(a: Who, b: Who): boolean {
    if (a.person_id && b.person_id) return a.person_id === b.person_id;
    return samePerson(a, b);
  }
  ```
- **`notes.ts`** (heavyweights loop): use `strictSamePerson(h, c)` instead of `samePerson(h, c)`, and import it.
- **`seat.ts`** (`incumbencyOf`): `won: there?.winner ? there.winner === m.cand : null`.
- **`types.ts`:** add `electors: number | null;` to `SeatIn` (after `turnout`).
- **`fixtures.ts`** (`seat()`): add `electors: null` to the default object.

- [ ] **Step 3: Loader reads candidates left-joined to results, plus electors**

In `SeatAnalysisLoader.election()`, replace the `results.findMany` block with candidates + their result (one query):
```ts
const cands = await this.prisma.candidates.findMany({
  where: { election_id: id },
  select: { const_id: true, person_id: true, name: true, party_id: true, results: { select: { votes: true, status: true }, take: 1 } },
});
const byConst = new Map<string, SeatIn['candidates']>();
for (const c of cands) {
  const r = c.results[0];
  const list = byConst.get(c.const_id) ?? [];
  list.push({ person_id: c.person_id, name: c.name, party_id: c.party_id, votes: r?.votes ?? 0, status: r ? String(r.status) : 'PENDING' });
  byConst.set(c.const_id, list);
}
```
Also select `total_electors` in the constituencies query and set `electors: c.total_electors ?? null` on each seat.
`'PENDING'` matches neither WON nor LEADING, so a seat with no result has no winner. That was already the behaviour.

- [ ] **Step 4: Prove Phase A output is unchanged except where intended**

Run the module tests (all pass), then the deep-equal check against the stored rows (temporary file, deleted after):
```bash
cd backend && cat > tmp-eq.ts <<'EOF'
import { config } from 'dotenv';
import { isDeepStrictEqual } from 'util';
import { PrismaClient } from '@prisma/client';
import { SeatAnalysisLoader } from './src/modules/constituencies/seat-analysis.loader';
import { analyse } from './src/common/seat-analysis';
config({ path: '../.env' });
(async () => {
  const p = new PrismaClient(); const loader = new SeatAnalysisLoader(p as any); const diffs: string[] = []; let seats = 0;
  for (const e of await p.elections.findMany({ where: { type: 'VS' }, select: { id: true } })) {
    const out = JSON.parse(JSON.stringify(analyse(await loader.load(e.id))));
    const stored = new Map((await p.constituency_analysis.findMany({ where: { election_id: e.id }, select: { const_id: true, data: true } })).map(r => [r.const_id, r.data as any]));
    for (const s of out.seats) { seats++; const o = stored.get(s.const_id); if (!isDeepStrictEqual(s, o)) diffs.push(`${s.const_id}: ${JSON.stringify(s.incumbent?.won)} vs ${JSON.stringify(o?.incumbent?.won)}; hw ${s.notes.filter((n: any) => n.kind === 'heavyweight').length} vs ${o?.notes?.filter((n: any) => n.kind === 'heavyweight').length}`); }
  }
  console.log(`seats ${seats}, differing ${diffs.length}`); console.log(diffs.slice(0, 20).join('\n'));
  await p.$disconnect();
})();
EOF
npx ts-node --transpile-only tmp-eq.ts; rm tmp-eq.ts
```
Expected: every differing seat is explained by one of the two fixes (incumbent `won` false → null for a seat without a
winner, or a heavyweight note dropped for a namesake). Record the count in the ledger. **Any other difference is a
bug:** stop and debug, because the loader change must not change seats that have results.

- [ ] **Step 5: Copy to the frontend, run everything, recompute locally, commit**

```bash
for f in types match seat notes; do cp backend/src/common/seat-analysis/$f.ts frontend/src/model/derive/seatAnalysis/$f.ts; done
cd backend && npx tsc --noEmit && npx jest src/common/seat-analysis && cd ../frontend && npx vitest run src/model/derive/__tests__/seatAnalysis.test.ts && npx tsc --noEmit -p tsconfig.json
cd ../scraper && set -a && . ../.env && set +a && npx ts-node src/recompute-analysis-cli.ts --type VS | tail -1
cd .. && git add backend/src frontend/src && git commit -m "fix(analysis): loader reads candidates without results (baseline for Upcoming elections); incumbent.won null without a winner; heavyweights never match a namesake"
```

---

### Task 5: Shared module: `baselineOf`

**Files:**
- Modify (backend shared): `seat.ts` (move `makeCtx` here, add `classOver`), `index.ts`, `notes.ts`, `election.ts`, `types.ts`
- Create: `backend/src/common/seat-analysis/baseline.ts`
- Test: `backend/src/common/seat-analysis/baseline.spec.ts`

**Interfaces:**
- Consumes: `Ctx`, `seatOf`, `carry`, `incumbencyOf` (export it), `historyOf` (export it) from `seat.ts`;
  `switcherOf`, `heavyweightsOf` from `notes.ts`; `allianceOf` from `election.ts`.
- Produces:
  - `makeCtx(input: AnalysisInput): Ctx` (in `seat.ts`; `analyse` uses it);
  - `classOver(ctx, elections: ElectionIn[], constNo: number): SeatClass | null`: the class over the given elections,
    holder = the last one's winner party (carried);
  - `baselineOf(input: AnalysisInput): Baseline`;
  - the types below.

- [ ] **Step 1: Types (append to `types.ts`)**

```ts
export interface SeatBaseline {
  const_id: string;
  const_no: number;
  /** The previous comparable election's result in this seat; null after a redraw or for a first election. */
  prev: {
    year: number;
    date: string;
    party_raw: string | null;
    /** party_raw carried to this election's ids (JVM → BJP); IND stays IND. */
    holder: string | null;
    alliance: string | null;
    candidate: string;
    person_id: string | null;
    margin: number | null;
    margin_pct: number | null;
    /** Vote share % per party carried to this election's ids; null when the seat had no votes. */
    shares: Record<string, number> | null;
    turnout: number | null;
  } | null;
  /** The class before this election (comparable history only). */
  class_before: SeatClass | null;
  /** The previous winner and whether / where / for whom they contest now (`won` omitted: not known before counting). */
  sitting: Omit<Incumbency, 'won'> | null;
  /** The previous top two, both contesting this seat again. */
  rematch: [string, string] | null;
  switchers: Extract<SeatNote, { kind: 'switcher' }>[];
  heavyweights: Extract<SeatNote, { kind: 'heavyweight' }>[];
  close_last: boolean;
  narrowing_last: boolean;
  electors: number | null;
  history: HistoryEntry[];
}
export interface Baseline {
  schema_version: number;
  election_id: string;
  date: string;
  state_id: number | null;
  lineage: LineageEventLike[];
  /** This election's alliances (normalised ids via ALLIANCE_ALIASES when compared). */
  alliances: AllianceIn[];
  seats: SeatBaseline[];
}
```

- [ ] **Step 2: Failing tests `baseline.spec.ts`**

```ts
import { baselineOf } from './baseline';
import { analyse } from './index';
import { el, input, seat, JVM_MERGER, SHS_SPLIT } from './fixtures';

const zero = (no: number, names: [string, string][]) => seat(no, names.map(([n, p]) => [n, p, 0, 'PENDING']));

describe('baselineOf', () => {
  it('previous holder carried through lineage, class before, prev shares, before any votes', () => {
    const h = [el(2009, [seat(1, [['A', 'JVM', 50], ['B', 'JMM', 40], ['C', 'Z', 10]])]), el(2014, [seat(1, [['A', 'JVM', 55], ['B', 'JMM', 45]])])];
    const b = baselineOf(input(el(2024, [zero(1, [['A', 'BJP'], ['B', 'JMM']])]), h, { lineage: [JVM_MERGER] }));
    expect(b.seats[0].prev).toMatchObject({ year: 2014, party_raw: 'JVM', holder: 'BJP', candidate: 'A', margin: 10, shares: { BJP: 55, JMM: 45 } });
    expect(b.seats[0].class_before).toEqual({ kind: 'loyal', holder: 'BJP', streak: 2, since: 2009, wins: 2, total: 2 });
    expect(b.seats[0].sitting).toMatchObject({ name: 'A', recontested: true, same_seat: true, party_now: 'BJP', switched: false });
    expect(b.seats[0].sitting).not.toHaveProperty('won');
    expect(b.seats[0].rematch).toEqual(['A', 'B']);
  });
  it('a redraw has no prev; switchers and heavyweights come from the candidate list', () => {
    const before = el(2014, [seat(9, [['Unique Person', 'PDP', 50], ['Z', 'Y', 40]])]);
    const b = baselineOf(input(el(2024, [zero(1, [['Unique Person', 'APNI'], ['Q', 'NC']])]), [], {
      previousAny: before, heavyweights: [{ person_id: null, name: 'Q', party_id: 'NC', reason: 'state_president' }] }));
    expect(b.seats[0].prev).toBeNull();
    expect(b.seats[0].switchers).toEqual([{ kind: 'switcher', name: 'Unique Person', from: 'PDP', to: 'APNI', year: 2014, match: 'name' }]);
    expect(b.seats[0].heavyweights).toEqual([{ kind: 'heavyweight', name: 'Q', party: 'NC', reasons: ['state_president'] }]);
  });
  it('close / narrowing last time; the sitting MLA following a split is not a switch', () => {
    const s = (m: number, p = 'SHS') => seat(1, [['A', p, 50 + m], ['B', 'INC', 50 - m]]);
    const b = baselineOf(input(el(2024, [zero(1, [['A', 'SHSUBT'], ['B', 'INC']])]), [el(2009, [s(10)]), el(2014, [s(5)]), el(2019, [s(1)])], { lineage: [SHS_SPLIT] }));
    expect([b.seats[0].close_last, b.seats[0].narrowing_last]).toEqual([true, true]);
    expect(b.seats[0].sitting).toMatchObject({ switched: false, followed_split: true });
  });
  it('class_before equals the previous election\'s own final class', () => {
    const s = (p: string) => seat(1, [['A', p, 50], ['B', 'Z', 40]]);
    const h = [el(2010, [s('X')]), el(2015, [s('X')]), el(2020, [s('Y')])];
    expect(baselineOf(input(el(2025, [zero(1, [['A', 'X'], ['B', 'Z']])]), h)).seats[0].class_before).toEqual(analyse(input(h[2], h.slice(0, 2))).seats[0].class);
  });
});
```
Run: `cd backend && npx jest src/common/seat-analysis/baseline.spec.ts` → FAIL (module missing).

- [ ] **Step 3: Refactor for reuse**

- **`seat.ts`:**
  - Move the index building from `index.ts` into
    `export function makeCtx(input: AnalysisInput): Ctx { const idx = new Map<string, Map<number, Ranked>>(); const add = (e: ElectionIn | null) => { if (e && !idx.has(e.id)) idx.set(e.id, new Map(e.seats.map(s => [s.const_no, rank(s)]))); }; [...input.history, input.previousAny, input.current].forEach(add); return { input, idx }; }`.
  - Export `incumbencyOf` and `historyOf`.
  - Replace `classOf` by `classOver`:
    ```ts
    /** The class over `elections` (oldest → newest); holder = the last one's winner party; null if the last has no winner. */
    export function classOver(ctx: Ctx, elections: ElectionIn[], constNo: number): SeatClass | null {
      const runs = elections
        .map(e => ({ e, w: seatOf(ctx, e, constNo)?.winner ?? null }))
        .filter((x): x is { e: ElectionIn; w: CandidateIn } => x.w != null)
        .map(x => ({ e: x.e, w: x.w, key: holderKey(ctx, x.w, x.e) }));
      const last = runs[runs.length - 1];
      if (!last || last.e.id !== elections[elections.length - 1]?.id) return null;
      const holder = last.w.party_id ? (last.w.party_id === INDEPENDENT ? INDEPENDENT : carry(ctx, last.w.party_id, last.e)) : '';
      let streak = 0;
      for (let i = runs.length - 1; i >= 0 && runs[i].key === last.key; i--) streak++;
      const wins = runs.filter(r => r.key === last.key).length;
      const total = runs.length;
      const kind = total === 1 ? 'new' : wins === total && total >= 3 ? 'stronghold' : streak >= 2 ? 'loyal' : 'swing';
      return { kind, holder, streak, since: runs[runs.length - streak].e.year, wins, total };
    }
    ```
    In `analyseSeat`, use `class: w ? classOver(ctx, elections, seat.const_no) : null`. For the current election
    `carry(holder, current)` is the identity, so the stored `holder` stays the winner's own party.
  - Run the Task 2 class tests; they must stay green.
- **`index.ts`:** `analyse` calls `makeCtx(input)` after the order check; re-export `baselineOf` and `analyseLive`
  (Task 6) once they exist.
- **`notes.ts`:**
  - extract `export function switcherOf(ctx: Ctx, c: CandidateIn, constNo: number): Extract<SeatNote, { kind: 'switcher' }> | null`
    (the loop body for one candidate);
  - extract `export function heavyweightsOf(ctx: Ctx, cands: CandidateIn[]): Extract<SeatNote, { kind: 'heavyweight' }>[]`;
  - `seatNotes` calls both.
- **`election.ts`:** `export` the existing `allianceOf`.

- [ ] **Step 4: Implement `baseline.ts`**

```ts
import { allianceOf } from './election';
import { samePerson } from './match';
import { heavyweightsOf, switcherOf } from './notes';
import { share } from './rank';
import { carry, classOver, historyOf, incumbencyOf, makeCtx, seatOf, type Ctx } from './seat';
import { INDEPENDENT, NOTA, SCHEMA_VERSION, type AnalysisInput, type Baseline, type SeatBaseline, type SeatIn } from './types';

function prevOf(ctx: Ctx, seat: SeatIn): SeatBaseline['prev'] {
  const prevE = ctx.input.history[ctx.input.history.length - 1];
  const rk = prevE ? seatOf(ctx, prevE, seat.const_no) : undefined;
  const w = rk?.winner;
  if (!prevE || !rk || !w) return null;
  let shares: Record<string, number> | null = null;
  if (rk.total > 0) {
    const votes = new Map<string, number>();
    for (const c of rk.ranked) if (c.party_id && c.party_id !== INDEPENDENT) { const k = carry(ctx, c.party_id, prevE); votes.set(k, (votes.get(k) ?? 0) + c.votes); }
    shares = Object.fromEntries([...votes].map(([k, v]) => [k, share(v, rk.total)!]));
  }
  return {
    year: prevE.year, date: prevE.date, party_raw: w.party_id, holder: w.party_id ? carry(ctx, w.party_id, prevE) : null,
    alliance: w.party_id ? allianceOf(prevE, w.party_id) : null, candidate: w.name, person_id: w.person_id,
    margin: rk.margin, margin_pct: rk.margin != null ? share(rk.margin, rk.total) : null, shares, turnout: rk.seat.turnout,
  };
}

function marginsPct(ctx: Ctx, constNo: number): number[] {
  return ctx.input.history.map(e => seatOf(ctx, e, constNo)).filter(r => !!r && r.margin != null && r.total > 0).map(r => (r!.margin! / r!.total) * 100);
}

/** What is known about each seat of `input.current` before a vote is counted (spec §5.1). Pure. */
export function baselineOf(input: AnalysisInput): Baseline {
  const ctx = makeCtx(input);
  const { history, current } = input;
  const prevE = history[history.length - 1];
  const seats = current.seats.map((seat): SeatBaseline => {
    const prev = prevOf(ctx, seat);
    const inc = incumbencyOf(ctx, prevE, prevE ? seatOf(ctx, prevE, seat.const_no) : undefined, seat);
    const cands = seat.candidates.filter(c => c.party_id !== NOTA);
    const prk = prevE ? seatOf(ctx, prevE, seat.const_no) : undefined;
    const rematch = prk?.winner && prk.runnerUp && cands.some(c => samePerson(c, prk.winner!)) && cands.some(c => samePerson(c, prk.runnerUp!))
      ? [prk.winner.name, prk.runnerUp.name] as [string, string] : null;
    const m = marginsPct(ctx, seat.const_no).slice(-3);
    let sitting: SeatBaseline['sitting'] = null;
    if (inc) { const { won: _won, ...rest } = inc; sitting = rest; }
    return {
      const_id: seat.const_id, const_no: seat.const_no, prev,
      class_before: history.length ? classOver(ctx, history, seat.const_no) : null,
      sitting, rematch,
      switchers: cands.map(c => switcherOf(ctx, c, seat.const_no)).filter((n): n is NonNullable<typeof n> => !!n),
      heavyweights: heavyweightsOf(ctx, cands),
      close_last: prev?.margin_pct != null && prev.margin_pct < 3,
      narrowing_last: m.length === 3 && m[0] > m[1] && m[1] > m[2],
      electors: seat.electors,
      history: historyOf(ctx, history, seat.const_no),
    };
  });
  return { schema_version: SCHEMA_VERSION, election_id: current.id, date: current.date, state_id: input.stateId, lineage: input.lineage, alliances: current.alliances, seats };
}
```
(`classOver` over `history` alone: its holder is the last history winner carried to the current ids, through `carry`.)

- [ ] **Step 5: Run**

Run: `cd backend && npx jest src/common/seat-analysis && npx tsc --noEmit`
Expected: all PASS, including the earlier 39+ tests (the refactor must not change `analyse`).

- [ ] **Step 6: Commit** (backend files only; the frontend copy happens in Task 6)

```bash
git add backend/src/common/seat-analysis
git commit -m "feat(analysis): baselineOf: pre-counting facts per seat (previous holder, class before, sitting MLA, rematch, switchers, heavyweights)"
```

---

### Task 6: Shared module: `analyseLive` + frontend copy

**Files:**
- Create: `backend/src/common/seat-analysis/live.ts`, `backend/src/common/seat-analysis/live.spec.ts`
- Modify: `types.ts`, `index.ts`; both `SHARED` lists (`identical.spec.ts`, frontend `seatAnalysis.test.ts`): add
  `'baseline', 'live'`
- Copy all shared files to `frontend/src/model/derive/seatAnalysis/`

**Interfaces:**
- Produces:
  - `analyseLive(b: Baseline, seats: SeatLiveIn[]): { seats: SeatLive[]; tally: LiveTally }`;
  - `CALL_THRESHOLDS = { tooClose: 0.05, likely: 0.2 }`, `MOMENTUM = { window: 3, minFrac: 0.1, minVotes: 200, comebackFrac: 0.05 }`;
  - the types below.

- [ ] **Step 1: Types (append to `types.ts`)**

```ts
export interface TrailPoint { r: number | null; lp: string | null; m: number | null; v: number }
export interface SeatTrail { points: TrailPoint[]; lc: number; pk: number | null }
export interface SeatLiveIn {
  const_id: string;
  candidates: CandidateIn[];
  round: { current: number; total: number } | null;
  trail: SeatTrail | null;
}
export type Call = 'declared' | 'safe' | 'likely' | 'too_close' | 'counting' | 'not_started';
export type Momentum = 'switched' | 'narrowing' | 'widening' | 'stable';
export type SittingStatus = 'won' | 'lost' | 'leading' | 'trailing' | 'not_started' | 'not_contesting';
export type Upset = 'stronghold_trailing' | 'heavyweight_trailing' | 'sitting_trailing';
export interface SeatLive {
  const_id: string;
  leader: Placed | null;
  runner_up: Placed | null;
  margin: number | null;
  provisional: boolean;
  votes_counted: number;
  remaining: number | null;
  outcome: Outcome | null;
  swing: { winner_party: number | null; prev_holder: number | null } | null;
  call: Call;
  momentum: Momentum | null;
  comeback: boolean;
  lead_changes: number;
  sitting: SittingStatus | null;
  upsets: Upset[];
}
export interface LiveTally {
  parties: { party_id: string; won: number; leading: number; held: number; gained: number; lost: number; split_gained: number; split_lost: number }[];
  flow: FlowRow[];
  alliance_moves: { from: string; to: string; seats: number }[];
}
```

- [ ] **Step 2: Failing tests `live.spec.ts`**

```ts
import { analyseLive } from './live';
import { baselineOf } from './baseline';
import { analyse } from './index';
import { el, input, seat, JVM_MERGER } from './fixtures';
import type { CandidateIn, SeatLiveIn, SeatTrail } from './types';

const c = (name: string, party: string, votes: number, status = 'TRAILING'): CandidateIn => ({ person_id: null, name, party_id: party, votes, status });
const live = (cands: CandidateIn[], round: { current: number; total: number } | null = null, trail: SeatTrail | null = null): SeatLiveIn => ({ const_id: 'T_1', candidates: cands, round, trail });
const prev = el(2019, [seat(1, [['A', 'JVM', 55], ['B', 'JMM', 45]])]);
const base = (cur = el(2024, [seat(1, [['A', 'BJP', 0, 'PENDING'], ['B', 'JMM', 0, 'PENDING']])]), extra = {}) =>
  baselineOf(input(cur, [el(2014, [seat(1, [['A', 'JVM', 50], ['B', 'JMM', 40]])]), prev], { lineage: [JVM_MERGER], ...extra }));

describe('analyseLive', () => {
  it('before any votes: not_started, no outcome, sitting MLA not_started (never lost)', () => {
    const s = analyseLive(base(), [live([c('A', 'BJP', 0), c('B', 'JMM', 0)])]).seats[0];
    expect(s).toMatchObject({ call: 'not_started', outcome: null, sitting: 'not_started', upsets: [] });
  });
  it('a lead is a provisional outcome; remaining from rounds; call by lead / remaining', () => {
    const s = analyseLive(base(), [live([c('B', 'JMM', 5200, 'LEADING'), c('A', 'BJP', 5000)], { current: 5, total: 20 })]).seats[0];
    expect(s.outcome).toEqual({ kind: 'gained', from: 'BJP', from_raw: 'JVM' });
    expect(s.provisional).toBe(true);
    expect(s.remaining).toBe(30600);            // 10200 / 5 * 15
    expect(s.call).toBe('too_close');           // 200 / 30600 < 0.05
    expect(s.sitting).toBe('trailing');
    expect(s.upsets).toEqual(['sitting_trailing']);
  });
  it('safe / likely / declared / counting without rounds or electors', () => {
    const run = (a: number, b: number, round: { current: number; total: number } | null, st = 'LEADING') => analyseLive(base(), [live([c('A', 'BJP', a, st), c('B', 'JMM', b)], round)]).seats[0].call;
    expect(run(9000, 5000, { current: 10, total: 12 })).toBe('safe');       // 4000 / 2800
    expect(run(6000, 5000, { current: 8, total: 12 })).toBe('likely');      // 1000 / 5500 ≈ 0.18
    expect(run(9000, 5000, { current: 12, total: 12 }, 'WON')).toBe('declared');
    expect(run(6000, 5000, null)).toBe('counting');
  });
  it('momentum and comeback from the trail; lead changes from the server', () => {
    const trail = (pts: [string, number, number][], lc = 0): SeatTrail => ({ points: pts.map(([lp, m, v], i) => ({ r: i + 1, lp, m, v })), lc, pk: null });
    const at = (t: SeatTrail, cands: CandidateIn[]) => analyseLive(base(), [live(cands, { current: 6, total: 20 }, t)]).seats[0];
    const lead = [c('A', 'BJP', 6000, 'LEADING'), c('B', 'JMM', 5000)];
    expect(at(trail([['BJP', 3000, 9000], ['BJP', 2000, 12000], ['BJP', 1000, 15000]]), lead).momentum).toBe('narrowing');
    expect(at(trail([['BJP', 500, 9000], ['BJP', 900, 12000], ['BJP', 1000, 15000]]), lead).momentum).toBe('widening');
    expect(at(trail([['JMM', 300, 9000], ['BJP', 600, 12000], ['BJP', 1000, 15000]], 1), lead)).toMatchObject({ momentum: 'switched', lead_changes: 1 });
    expect(at(trail([['JMM', 1200, 10000], ['BJP', 1000, 15000]], 1), lead).comeback).toBe(true);   // trailed by 12% of counted
    expect(analyseLive(base(), [live(lead, null, null)]).seats[0].momentum).toBeNull();
  });
  it('a seat missing from the baseline is still analysed without history', () => {
    const s = analyseLive(base(), [{ const_id: 'NOPE', candidates: [c('X', 'P', 10, 'LEADING'), c('Y', 'Q', 5)], round: null, trail: null }]).seats[0];
    expect(s).toMatchObject({ const_id: 'NOPE', outcome: { kind: 'new' }, call: 'counting', sitting: null });
  });
  it('live on final results equals analyse() (outcome, swing, held/gained/lost, flow)', () => {
    const cur = el(2024, [seat(1, [['B', 'JMM', 60], ['A', 'BJP', 40]])]);
    const inp = input(cur, [el(2014, [seat(1, [['A', 'JVM', 50], ['B', 'JMM', 40]])]), prev], { lineage: [JVM_MERGER] });
    const fin = analyse(inp);
    const l = analyseLive(baselineOf(inp), [{ const_id: 'T_1', candidates: cur.seats[0].candidates, round: null, trail: null }]);
    expect(l.seats[0].outcome).toEqual(fin.seats[0].outcome);
    expect(l.seats[0].swing).toEqual(fin.seats[0].swing);
    expect(l.tally.flow).toEqual(fin.election.flow);
    const pick = (p: { party_id: string; held: number; gained: number; lost: number }) => [p.party_id, p.held, p.gained, p.lost];
    expect(l.tally.parties.filter(p => p.won).map(pick)).toEqual(fin.election.parties.filter(p => p.won).map(pick));
  });
});
```
Run: `cd backend && npx jest src/common/seat-analysis/live.spec.ts` → FAIL.

- [ ] **Step 3: Implement `live.ts`**

```ts
import { allianceOf } from './election';
import { relation } from './lineage';
import { samePerson } from './match';
import { rank, r1, share } from './rank';
import {
  INDEPENDENT, type Baseline, type Call, type CandidateIn, type FlowRow, type LiveTally, type Momentum, type Outcome,
  type Placed, type SeatBaseline, type SeatLive, type SeatLiveIn, type SittingStatus, type Upset,
} from './types';

/** Provisional (tuned on synthetic simulation rounds, not real mid-count data): lead ÷ remaining votes. */
export const CALL_THRESHOLDS = { tooClose: 0.05, likely: 0.2 };
/** Provisional: momentum over the last `window` trail points. */
export const MOMENTUM = { window: 3, minFrac: 0.1, minVotes: 200, comebackFrac: 0.05 };

const placed = (c: CandidateIn | null, total: number): Placed | null =>
  c ? { name: c.name, person_id: c.person_id, party_id: c.party_id, votes: c.votes, share: share(c.votes, total) } : null;

function outcomeOf(b: Baseline, base: SeatBaseline | undefined, w: CandidateIn): Outcome {
  const p = base?.prev;
  if (!p) return { kind: 'new', from: null, from_raw: null };
  if (p.party_raw === INDEPENDENT || w.party_id === INDEPENDENT) {
    const same = p.party_raw === w.party_id && samePerson({ person_id: p.person_id, name: p.candidate }, w);
    return { kind: same ? 'retained' : 'gained', from: p.holder, from_raw: p.party_raw };
  }
  const rel = relation(b.lineage, p.party_raw ?? '', w.party_id ?? '', { fromDate: p.date, toDate: b.date, stateId: b.state_id });
  return { kind: rel === 'same' ? 'retained' : rel === 'split' ? 'split' : 'gained', from: p.holder, from_raw: p.party_raw };
}

function swingOf(base: SeatBaseline | undefined, rk: ReturnType<typeof rank>): SeatLive['swing'] {
  const p = base?.prev;
  if (!p) return null;
  const sw = (party: string | null) => {
    if (!party || party === INDEPENDENT || !p.shares || rk.total <= 0) return null;
    const now = r1((rk.ranked.filter(c => c.party_id === party).reduce((s, c) => s + c.votes, 0) / rk.total) * 100);
    return r1(now - (p.shares[party] ?? 0));
  };
  return { winner_party: sw(rk.winner!.party_id), prev_holder: sw(p.holder) };
}

function remainingOf(counted: number, round: SeatLiveIn['round'], base: SeatBaseline | undefined): number | null {
  if (round && round.current > 0 && round.total >= round.current) return Math.round((counted / round.current) * (round.total - round.current));
  if (base?.electors && base.prev?.turnout) return Math.max(0, Math.round((base.electors * base.prev.turnout) / 100) - counted);
  return null;
}

function callOf(rk: ReturnType<typeof rank>, counted: number, remaining: number | null): Call {
  if (rk.winner?.status === 'WON') return 'declared';
  if (counted <= 0 || !rk.winner) return 'not_started';
  if (remaining == null) return 'counting';
  if (remaining <= 0) return 'safe';
  const f = (rk.margin ?? 0) / remaining;
  return f < CALL_THRESHOLDS.tooClose ? 'too_close' : f < CALL_THRESHOLDS.likely ? 'likely' : 'safe';
}

function momentumOf(trail: SeatLiveIn['trail']): Momentum | null {
  const pts = trail?.points.slice(-MOMENTUM.window) ?? [];
  if (pts.length < 2) return null;
  if (new Set(pts.map(p => p.lp)).size > 1) return 'switched';
  const first = pts[0].m ?? 0, last = pts[pts.length - 1].m ?? 0;
  const thr = Math.max(MOMENTUM.minFrac * first, MOMENTUM.minVotes);
  return last - first <= -thr ? 'narrowing' : last - first >= thr ? 'widening' : 'stable';
}

function comebackOf(trail: SeatLiveIn['trail'], leaderParty: string | null): boolean {
  return !!trail?.points.some(p => p.lp !== leaderParty && p.v > 0 && (p.m ?? 0) / p.v > MOMENTUM.comebackFrac);
}

function sittingOf(base: SeatBaseline | undefined, byId: Map<string, ReturnType<typeof rank>>): SittingStatus | null {
  const s = base?.sitting;
  if (!s) return null;
  if (!s.recontested || !s.const_id) return 'not_contesting';
  const rk = byId.get(s.const_id);
  if (!rk) return null;
  const counted = rk.total;
  const me = rk.ranked.find(c => samePerson(c, s));
  if (!me) return null;
  if (rk.winner === me) return rk.winner.status === 'WON' ? 'won' : 'leading';
  if (rk.winner?.status === 'WON') return 'lost';
  return counted > 0 && rk.winner ? 'trailing' : 'not_started';
}

/** Live state of every seat from the baseline and the current results (spec §5.3). Pure; same rules as analyse(). */
export function analyseLive(b: Baseline, seats: SeatLiveIn[]): { seats: SeatLive[]; tally: LiveTally } {
  const bases = new Map(b.seats.map(s => [s.const_id, s]));
  const byId = new Map(seats.map(s => [s.const_id, rank({ const_id: s.const_id, const_no: 0, reserved: 'GEN', region_id: null, turnout: null, electors: null, candidates: s.candidates })]));
  const out = seats.map((s): SeatLive => {
    const base = bases.get(s.const_id);
    const rk = byId.get(s.const_id)!;
    const counted = rk.total;
    const remaining = remainingOf(counted, s.round, base);
    const call = callOf(rk, counted, remaining);
    const w = counted > 0 ? rk.winner : null;
    const sitting = sittingOf(base, byId);
    const upsets: Upset[] = [];
    if (w && base?.class_before?.kind === 'stronghold' && w.party_id !== base.class_before.holder) upsets.push('stronghold_trailing');
    if (w && base?.heavyweights.some(h => !samePerson({ person_id: null, name: h.name }, w))) upsets.push('heavyweight_trailing');
    if (w && base?.sitting?.const_id === s.const_id && (sitting === 'trailing' || sitting === 'lost')) upsets.push('sitting_trailing');
    return {
      const_id: s.const_id, leader: placed(w, counted), runner_up: w ? placed(rk.runnerUp, counted) : null, margin: w ? rk.margin : null,
      provisional: w?.status === 'LEADING', votes_counted: counted, remaining,
      outcome: w ? outcomeOf(b, base, w) : null, swing: w ? swingOf(base, rk) : null,
      call, momentum: momentumOf(s.trail), comeback: w ? comebackOf(s.trail, w.party_id) : false, lead_changes: s.trail?.lc ?? 0,
      sitting, upsets,
    };
  });
  return { seats: out, tally: tallyOf(b, bases, out) };
}

function tallyOf(b: Baseline, bases: Map<string, SeatBaseline>, seats: SeatLive[]): LiveTally {
  const rows = new Map<string, LiveTally['parties'][number]>();
  const row = (p: string) => rows.get(p) ?? rows.set(p, { party_id: p, won: 0, leading: 0, held: 0, gained: 0, lost: 0, split_gained: 0, split_lost: 0 }).get(p)!;
  const flow = new Map<string, FlowRow>(), moves = new Map<string, number>();
  const cur = { alliances: b.alliances } as Parameters<typeof allianceOf>[0];
  for (const s of seats) {
    const to = s.leader?.party_id;
    if (!to) continue;
    if (s.provisional) row(to).leading++; else row(to).won++;
    const o = s.outcome, from = o?.from;
    if (!o || o.kind === 'new' || !from) continue;
    if (o.kind === 'retained') row(to).held++;
    else if (o.kind === 'gained') { row(to).gained++; row(from).lost++; }
    else { row(to).split_gained++; row(from).split_lost++; }
    const split = o.kind === 'split', k = `${from}>${to}>${split}`;
    const f = flow.get(k) ?? { from, to, seats: 0, split }; f.seats++; flow.set(k, f);
    const pa = bases.get(s.const_id)?.prev?.alliance;
    if (pa && b.alliances.length) { const ta = allianceOf(cur, to); if (pa !== ta) moves.set(`${pa}>${ta}`, (moves.get(`${pa}>${ta}`) ?? 0) + 1); }
  }
  return {
    parties: [...rows.values()].sort((a, c) => c.won + c.leading - (a.won + a.leading) || a.party_id.localeCompare(c.party_id)),
    flow: [...flow.values()].sort((a, c) => c.seats - a.seats),
    alliance_moves: [...moves].map(([k, n]) => { const [from, to] = k.split('>'); return { from, to, seats: n }; }).sort((a, c) => c.seats - a.seats),
  };
}
```
**Check while implementing:** `allianceOf` takes an `ElectionIn`. If its signature reads more than `.alliances`,
change it to `allianceOf(alliances: AllianceIn[], party)` and update its callers, rather than casting. Also make sure
the heavyweight-trailing check flags only a heavyweight who is **not** the leader.

- [ ] **Step 4: Run, re-export, copy, identical tests**

- `index.ts`:
  ```ts
  export { baselineOf } from './baseline';
  export { analyseLive, CALL_THRESHOLDS, MOMENTUM } from './live';
  ```
- Add `'baseline', 'live'` to `SHARED` in `backend/src/common/seat-analysis/identical.spec.ts` and in
  `frontend/src/model/derive/__tests__/seatAnalysis.test.ts`.
- Run:
  ```bash
  cd backend && npx jest src/common/seat-analysis && npx tsc --noEmit
  for f in types rank match seat notes election index baseline live; do cp src/common/seat-analysis/$f.ts ../frontend/src/model/derive/seatAnalysis/$f.ts; done
  cd ../frontend && npx vitest run src/model/derive/__tests__/seatAnalysis.test.ts && npx tsc --noEmit -p tsconfig.json && npm run lint
  ```
  Expected: all PASS. If `_won` trips lint as unused, use the prefix the lint config allows (check
  `frontend/eslint.config.*` for `argsIgnorePattern` / `varsIgnorePattern`), fix it in the backend file, and re-copy.

- [ ] **Step 5: Commit**

```bash
git add backend/src/common/seat-analysis frontend/src/model/derive
git commit -m "feat(analysis): analyseLive: per-seat live state (outcome, call, momentum, comeback, sitting MLA, upsets) and live tallies; frontend copy"
```

---

### Task 7: Backend baseline: compute, store, serve, triggers, readiness; live = final over all elections

**Files:**
- Modify:
  - `backend/src/modules/constituencies/seat-analysis.service.ts`
  - `backend/src/modules/elections/elections.controller.ts`
  - `backend/src/modules/admin/controllers/admin-constituencies.controller.ts`
  - `backend/src/modules/admin/controllers/admin-elections.controller.ts`
  - `backend/src/modules/ingest/ingest.service.ts` (roster)
  - `scraper/src/live/types.ts`, `scraper/src/live/check.ts`
- Test:
  - `seat-analysis.db.spec.ts` (baseline + live = final)
  - `admin-elections.controller.spec.ts`
  - `elections.http.spec.ts`
  - `ingest.service.spec.ts` or the roster spec
  - `scraper/src/live/__tests__/check.test.ts` (new, for the readiness rule)

**Interfaces:**
- Produces:
  - `SeatAnalysisService.computeBaseline(electionId): Promise<{ seats: number }>`
  - `SeatAnalysisService.baseline(electionId): Promise<(Baseline & { computed_at: string }) | null>` (cached key
    `election:<id>:baseline`)
  - `SeatAnalysisService.computeFor(electionId)`: Finalized → `compute`, else → `computeBaseline`
  - `GET /elections/:id/baseline` (`CACHE_CONTROL.PUBLIC`)
  - roster `baseline: { computed_at: string | null; stale: boolean }`
  - `baselineReady(r: Roster): string | null` in `scraper/src/live/check.ts` (exported; null = ready, else the reason)

- [ ] **Step 1: Failing tests**

1. **`seat-analysis.db.spec.ts`:**
   - `computeBaseline` on Bihar 2025 writes `election_analysis.baseline` with 243 seats and sets
     `baseline_computed_at`; a second call keeps `data` untouched.
   - The live = final test over **every** local VS election:
     ```ts
     it('live on final results equals the stored final analysis for every VS election', () => run('live=final', async (_svc, tx) => {
       const loader = new SeatAnalysisLoader(tx);
       let seats = 0; const bad: string[] = [];
       for (const e of await tx.elections.findMany({ where: { type: 'VS' }, select: { id: true } })) {
         const inp = await loader.load(e.id);
         const fin = analyse(inp);
         const l = analyseLive(baselineOf(inp), inp.current.seats.map(s => ({ const_id: s.const_id, candidates: s.candidates, round: null, trail: null })));
         const finBy = new Map(fin.seats.map(s => [s.const_id, s]));
         for (const s of l.seats) {
           seats++; const f = finBy.get(s.const_id)!;
           if (!isDeepStrictEqual([s.leader?.name ?? null, s.margin, s.outcome, s.swing], [f.winner?.name ?? null, f.margin, f.outcome, f.swing])) bad.push(s.const_id);
         }
         if (!isDeepStrictEqual(l.tally.flow, fin.election.flow)) bad.push(`${e.id} flow`);
         const hg = (rows: any[]) => rows.filter(p => p.held + p.gained + p.lost + p.split_gained + p.split_lost > 0).map(p => [p.party_id, p.held, p.gained, p.lost, p.split_gained, p.split_lost]).sort();
         if (!isDeepStrictEqual(hg(l.tally.parties), hg(fin.election.parties))) bad.push(`${e.id} parties`);
       }
       expect(seats).toBeGreaterThan(10_000);
       expect(bad.slice(0, 20)).toEqual([]);
     }));
     ```
     Import `isDeepStrictEqual` from `util` and `analyse`, `analyseLive`, `baselineOf` from
     `../../common/seat-analysis`.
2. **`admin-elections.controller.spec.ts`:** an update to `Live` (from Upcoming) calls `computeBaseline` once, and a
   failure doesn't fail the update. Mock `seatAnalysis = { compute, computeBaseline }`.
3. **`elections.http.spec.ts`:** `GET /elections/<EID>/baseline` → 200, the mocked baseline, `cache-control`
   `CACHE_CONTROL.PUBLIC`; a null baseline → 200 with `data: null`.
4. **`scraper/src/live/__tests__/check.test.ts`:**
   ```ts
   import { describe, it, expect } from 'vitest';
   import { baselineReady } from '../check';
   const r = (b: { computed_at: string | null; stale: boolean } | undefined) => ({ election: { id: 'e', type: 'VS', state_id: 1, year: 2027, status: 'Live' }, parties: [], seats: [], baseline: b }) as never;
   describe('baselineReady', () => {
     it('missing, stale, or an older server', () => {
       expect(baselineReady(r({ computed_at: null, stale: true }))).toMatch(/no baseline/);
       expect(baselineReady(r({ computed_at: '2027-02-26T10:00:00Z', stale: true }))).toMatch(/older than/);
       expect(baselineReady(r({ computed_at: '2027-02-26T10:00:00Z', stale: false }))).toBeNull();
       expect(baselineReady(r(undefined))).toMatch(/server/);
     });
   });
   ```
   `check.ts` calls `main()` at import. Move the `main().catch(…)` call under `if (require.main === module)` so the
   test can import `baselineReady`.

Run each and see them fail.

- [ ] **Step 2: Implement**

- **`SeatAnalysisService`:**
  ```ts
  export const baselineKey = (id: string) => `election:${id}:baseline`;

  async computeBaseline(electionId: string): Promise<{ seats: number }> {
    const b = baselineOf(await this.loader.load(electionId));
    await this.prisma.election_analysis.upsert({
      where: { election_id: electionId },
      create: { election_id: electionId, data: Prisma.DbNull, baseline: b as unknown as Prisma.InputJsonValue, schema_version: SCHEMA_VERSION, baseline_computed_at: new Date() },
      update: { baseline: b as unknown as Prisma.InputJsonValue, baseline_computed_at: new Date() },
    });
    await this.cache.del(baselineKey(electionId));
    return { seats: b.seats.length };
  }

  baseline(electionId: string): Promise<(Baseline & { computed_at: string }) | null> {
    return this.cache.getOrSet(baselineKey(electionId), CACHE_TTL.PUBLIC_ANALYSIS, async () => {
      const row = await this.prisma.election_analysis.findUnique({ where: { election_id: electionId }, select: { baseline: true, baseline_computed_at: true } });
      return row?.baseline ? { ...(row.baseline as unknown as Baseline), computed_at: row.baseline_computed_at!.toISOString() } : null;
    });
  }

  /** The admin button / compute endpoint / CLI: a Finalized election gets its final analysis, any other its baseline. */
  async computeFor(electionId: string): Promise<{ computed: number; kind: 'final' | 'baseline' }> {
    const e = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { status: true } });
    if (e?.status === 'Finalized') return { ...(await this.compute(electionId)), kind: 'final' };
    return { computed: (await this.computeBaseline(electionId)).seats, kind: 'baseline' };
  }
  ```
- **The compute endpoint** (`admin-constituencies.controller.ts`) calls `computeFor`.
- **`elections.controller.ts`:**
  ```ts
  /** Pre-counting facts per seat (spec §5.1); the browser runs the live analysis on it. */
  @Get(':id/baseline')
  async getBaseline(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    applyCacheControl(req, res, CACHE_CONTROL.PUBLIC);
    return this.seatAnalysis.baseline(id);
  }
  ```
- **`admin-elections.controller.ts`:** next to `computeIfFinalized`, add `computeIfLive(id, before, after)`, which
  runs when `after === 'Live' && before !== 'Live'` and calls `seatAnalysis.computeBaseline(id)` (logged on failure).
  Call it in `updateElection` and `reopenElection`.
- **Roster** (`IngestService.roster`): add
  ```ts
  const ea = await this.prisma.election_analysis.findUnique({ where: { election_id: electionId }, select: { baseline_computed_at: true } });
  const lastCand = await this.prisma.candidates.aggregate({ where: { election_id: electionId }, _max: { updated_at: true } });
  const at = ea?.baseline_computed_at ?? null;
  const baseline = { computed_at: at?.toISOString() ?? null, stale: !at || (!!lastCand._max.updated_at && lastCand._max.updated_at > at) };
  ```
  and return it in the roster (add `baseline: { computed_at: string | null; stale: boolean }` to the backend `Roster`
  type and as an optional field to `scraper/src/live/types.ts` `Roster`).
- **`check.ts`:**
  ```ts
  /** The baseline must exist and be newer than the last candidate change (spec §5.1; decided 2026-10-07). */
  export function baselineReady(r: Roster): string | null {
    if (!r.baseline) return 'server too old: no baseline field in the roster';
    if (!r.baseline.computed_at) return 'no baseline: compute it (admin "Compute all analysis" or the compute endpoint)';
    if (r.baseline.stale) return `baseline older than the latest candidate change (${r.baseline.computed_at}): recompute it`;
    return null;
  }
  ```
  In `main`, after the roster: `const notReady = baselineReady(roster); if (notReady) console.log(`  baseline: ${notReady}`);`,
  and treat `notReady` as NOT READY (exit 1) along with the existing conditions. Fetch the roster once, into a
  `roster` variable, and reuse it for `adapter.prepare`.

- [ ] **Step 3: Run**

Run: `cd backend && npx tsc --noEmit && npm run test:unit 2>&1 | grep -E "^Tests:|✕" && REQUIRE_DB_TESTS=1 npm run test:db 2>&1 | grep -E "^Tests:|✕"; cd ../scraper && npx vitest run 2>&1 | grep -E "Tests |×"`
Expected: all PASS, including live = final over all VS elections. **If live = final fails, fix the module** (a
reproducing fixture test first) until it passes. Never weaken the comparison.

- [ ] **Step 4: Commit**

```bash
git add backend/src scraper/src/live
git commit -m "feat(live): baseline computed, stored and served; compute endpoint does final vs baseline; baseline on going Live; live:check checks baseline freshness; live = final over every VS election"
```

---

### Task 8: Frontend: baseline + live analysis feed the dashboard; second engine retired

**Files:**
- Create:
  - `frontend/src/viewmodels/data/useBaseline.ts`
  - `frontend/src/model/derive/liveMaps.ts` + `__tests__/liveMaps.test.ts`
  - `frontend/src/viewmodels/data/useLiveAnalysis.ts` + `viewmodels/__tests__/useLiveAnalysis.test.ts`
- Modify:
  - `frontend/src/model/types/index.ts` (`ResultsSnapshot.trail?`)
  - `frontend/src/model/api/api.ts` (`getBaseline`)
  - `frontend/src/viewmodels/data/useDashboardData.ts` (expose `trails`)
  - `frontend/src/viewmodels/sources/useDashboardSources.ts`
  - `frontend/src/viewmodels/data/useHistoryAnalysis.ts`, `frontend/src/model/derive/intelligence.ts` (drop
    dominance / incumbency / switches / swing; keep marginTrend / partyTrend), their tests

**Interfaces:**
- Consumes: `analyseLive`, `Baseline`, `SeatLive`, `LiveTally`, `SeatTrail` from `model/derive/seatAnalysis`.
- Produces:
  - `getBaseline(id): Promise<(Baseline & { computed_at: string }) | null>`;
  - `useBaseline(id, enabled): Baseline | null`;
  - `liveMaps(b: Baseline, live: SeatLive[], year: number): { swing; dominance; incumbency; partySwitches }`, in the
    existing dashboard types;
  - `useLiveAnalysis(baseline, results, seats, trails): { seats: Map<string, SeatLive>; tally: LiveTally } | null`;
  - `DashboardSources.liveAnalysis` (that value), unused by views until the map brainstorm.

- [ ] **Step 1: Failing pure tests `liveMaps.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { liveMaps } from '../liveMaps';
import type { Baseline, SeatLive } from '../seatAnalysis';

const b = { schema_version: 1, election_id: 'e', date: '2027-02-27', state_id: 1, lineage: [], alliances: [], seats: [{
  const_id: 'S1', const_no: 1, electors: null, close_last: false, narrowing_last: false, rematch: null, heavyweights: [],
  prev: { year: 2022, date: '2022-03-10', party_raw: 'SP', holder: 'SP', alliance: null, candidate: 'R', person_id: null, margin: 900, margin_pct: 1, shares: { SP: 45 }, turnout: 60 },
  class_before: { kind: 'loyal', holder: 'SP', streak: 2, since: 2017, wins: 2, total: 3 },
  sitting: { name: 'R', person_id: null, party: 'SP', match: 'name', recontested: true, const_id: 'S1', same_seat: true, party_now: 'SP', switched: false, followed_split: false },
  switchers: [{ kind: 'switcher', name: 'Q', from: 'BSP', to: 'BJP', year: 2022, match: 'person' }],
  history: [{ year: 2017, party: 'BJP', family: 'BJP', candidate: 'X', person_id: null, margin: 1, vote_share: 40, runner_up: null, runner_up_party: null }, { year: 2022, party: 'SP', family: 'SP', candidate: 'R', person_id: null, margin: 900, vote_share: 45, runner_up: null, runner_up_party: null }],
}] } as unknown as Baseline;
const live = [{ const_id: 'S1', leader: { name: 'Q', party_id: 'BJP', person_id: null, votes: 5000, share: 50 }, margin: 300, provisional: true,
  outcome: { kind: 'gained', from: 'SP', from_raw: 'SP' }, sitting: 'trailing' }] as unknown as SeatLive[];

describe('liveMaps', () => {
  it('maps baseline + live into the dashboard maps', () => {
    const m = liveMaps(b, live, 2027);
    expect(m.dominance.get('S1')).toEqual({ constId: 'S1', winners: [{ party: 'BJP' }, { party: 'SP' }], classification: 'loyal', dominantParty: 'SP', streak: 2 });
    expect(m.swing.get('S1')).toEqual({ constId: 'S1', currentParty: 'BJP', prevParty: 'SP', currentMargin: 300, prevMargin: 900, flipped: true, split: false });
    expect(m.incumbency).toEqual([{ constId: 'S1', incumbentName: 'R', incumbentParty: 'SP', won: false, currentMargin: 300 }]);
    expect(m.partySwitches).toEqual([{ constId: 'S1', candidateName: 'Q', fromParty: 'BSP', toParty: 'BJP', fromYear: 2022, toYear: 2027, wonInNewParty: false, margin: 300 }]);
  });
  it('before counting: dominance and switchers from the baseline, no swing, no incumbency results', () => {
    const m = liveMaps(b, [], 2027);
    expect(m.dominance.size).toBe(1);
    expect(m.swing.size).toBe(0);
    expect(m.incumbency).toEqual([]);
    expect(m.partySwitches).toHaveLength(1);
  });
});
```
Run: `cd frontend && npx vitest run src/model/derive/__tests__/liveMaps.test.ts` → FAIL.

- [ ] **Step 2: Implement `liveMaps.ts`**

```ts
import type { Baseline, SeatLive } from './seatAnalysis';
import type { DominanceEntry, IncumbencyEntry, PartySwitchEntry, SwingEntry } from '../types';

/**
 * Live / upcoming election: the dashboard's seat maps from the baseline (history, class before, switchers) and the
 * live analysis (outcome, sitting MLA). The Finalized path reads the stored analysis instead (mapAnalysis).
 */
export function liveMaps(b: Baseline, live: SeatLive[], year: number) {
  const byId = new Map(live.map(s => [s.const_id, s]));
  const dominance = new Map<string, DominanceEntry>();
  const swing = new Map<string, SwingEntry>();
  const incumbency: IncumbencyEntry[] = [];
  const partySwitches: PartySwitchEntry[] = [];
  for (const s of b.seats) {
    const l = byId.get(s.const_id);
    if (s.class_before) dominance.set(s.const_id, { constId: s.const_id, winners: s.history.map(h => ({ party: h.party ?? '' })), classification: s.class_before.kind, dominantParty: s.class_before.holder, streak: s.class_before.streak });
    if (l?.outcome && l.outcome.kind !== 'new' && l.leader?.party_id && l.outcome.from_raw) {
      swing.set(s.const_id, { constId: s.const_id, currentParty: l.leader.party_id, prevParty: l.outcome.from_raw, currentMargin: l.margin ?? 0, prevMargin: s.prev?.margin ?? 0, flipped: l.outcome.kind === 'gained', split: l.outcome.kind === 'split' });
    }
    if (s.sitting && l?.sitting && l.sitting !== 'not_started') {
      incumbency.push({ constId: s.const_id, incumbentName: s.sitting.name, incumbentParty: s.sitting.party ?? '', won: l.sitting === 'won' || l.sitting === 'leading', currentMargin: l.margin ?? 0 });
    }
    for (const n of s.switchers) partySwitches.push({ constId: s.const_id, candidateName: n.name, fromParty: n.from, toParty: n.to, fromYear: n.year, toYear: year, wonInNewParty: l?.leader?.name === n.name, margin: l?.margin ?? 0 });
  }
  return { dominance, swing, incumbency, partySwitches };
}
```

- [ ] **Step 3: Snapshot type, API, hooks**

- **`model/types/index.ts`:** `ResultsSnapshot.trail?: Record<string, SeatTrail>` (import `SeatTrail` from
  `../derive/seatAnalysis`).
- **`model/api/api.ts`:** add `getBaseline`. A 404 or network error gives `null` (degrade, Review Focus 5). Follow the
  existing `getAnalysis` pattern for the fetch helper and URL.
  ```ts
  export async function getBaseline(electionId: string): Promise<(Baseline & { computed_at: string }) | null> {
    try { return await apiGet<(Baseline & { computed_at: string }) | null>(`/elections/${electionId}/baseline`); } catch { return null; }
  }
  ```
  Use the real helper name that `api.ts` uses for GETs.
- **`viewmodels/data/useBaseline.ts`:**
  ```ts
  import { useApi } from './useApi';
  import { getBaseline } from '../../model/api/api';
  import type { Baseline } from '../../model/derive/seatAnalysis';

  /** The election's pre-counting baseline (Upcoming / Live only); null when missing or not wanted. */
  export function useBaseline(electionId: string | undefined, enabled: boolean): Baseline | null {
    const { data } = useApi(() => (electionId && enabled ? getBaseline(electionId) : Promise.resolve(null)), [electionId, enabled]);
    return data ?? null;
  }
  ```
- **`useDashboardData.ts`:** expose `trails: snap?.trail ?? NO_TRAILS` next to `seats` (with
  `const NO_TRAILS: Record<string, SeatTrail> = {}`).
- **`viewmodels/data/useLiveAnalysis.ts`:**
  ```ts
  import { useMemo } from 'react';
  import { analyseLive, type Baseline, type SeatLive, type LiveTally, type SeatTrail } from '../../model/derive/seatAnalysis';
  import type { ResultRow, SeatLiveState } from '../../model/types';

  /** analyseLive on the current snapshot: one entry per seat with result rows. Null without a baseline. */
  export function useLiveAnalysis(baseline: Baseline | null, results: ResultRow[] | null, seats: Record<string, SeatLiveState>, trails: Record<string, SeatTrail>): { seats: Map<string, SeatLive>; tally: LiveTally } | null {
    return useMemo(() => {
      if (!baseline || !results) return null;
      const byConst = new Map<string, ResultRow[]>();
      for (const r of results) (byConst.get(r.const_id) ?? byConst.set(r.const_id, []).get(r.const_id)!).push(r);
      const input = [...byConst].map(([const_id, rows]) => {
        const st = seats[const_id];
        return { const_id, candidates: rows.map(r => ({ person_id: null, name: r.candidate_name, party_id: r.party_id || null, votes: Number(r.votes) || 0, status: r.status })),
          round: st?.cr && st.tr ? { current: st.cr, total: st.tr } : null, trail: trails[const_id] ?? null };
      });
      const out = analyseLive(baseline, input);
      return { seats: new Map(out.seats.map(s => [s.const_id, s])), tally: out.tally };
    }, [baseline, results, seats, trails]);
  }
  ```
  Write `useLiveAnalysis.test.ts` with `renderHook`. It covers:
  - a baseline plus two result rows in one seat gives one `SeatLive` with the expected leader;
  - a null baseline gives null;
  - a missing `trail` gives momentum null.

- [ ] **Step 4: The swap in `useDashboardSources.ts`**

- Before `useHistoryAnalysis`:
  ```ts
  const notFinal = election.status !== 'Finalized';
  const baseline = useBaseline(election.id, notFinal);
  const liveAnalysis = useLiveAnalysis(baseline, results, data.seats, data.trails);
  const lm = useMemo(() => (baseline ? liveMaps(baseline, liveAnalysis ? [...liveAnalysis.seats.values()] : [], election.year) : null), [baseline, liveAnalysis, election.year]);
  ```
- Replace the four `ba … : ha …` lines with: the stored analysis when Finalized, else the live maps, else empty:
  ```ts
  const EMPTY = { swing: new Map(), dominance: new Map(), incumbency: [], partySwitches: [] };
  const src = !notFinal ? { swing: ba.swingMap, dominance: ba.dominanceMap, incumbency: ba.incumbencyData, partySwitches: ba.partySwitchData } : lm ?? EMPTY;
  const { swing, dominance, incumbency, partySwitches } = src;
  ```
  Hoist `EMPTY` to a module constant typed with the dashboard types, so its identity is stable.
- `useHistoryAnalysis` now returns only `marginTrend` and `partyTrend`. Remove `calculateSwing` and the
  dominance / incumbency / switch calls, and delete `calculateDominance`, `calculateIncumbency` and
  `calculatePartySwitches` from `intelligence.ts` with their tests. Keep the trend functions and their tests. Grep for
  other importers first (`grep -rn "calculateDominance\|calculateIncumbency\|calculatePartySwitches\|calculateSwing" src`)
  and update them.
- Add `liveAnalysis` to `DashboardSources` (type
  `{ seats: Map<string, SeatLive>; tally: LiveTally } | null`) and return it.
- Delete the legacy `viewmodels/data/useHistoryAnalysis.ts` duplicate in `src/hooks/` only if nothing imports it.

- [ ] **Step 5: Run everything**

Run: `cd frontend && npx vitest run 2>&1 | grep -E "Tests |×" && npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: all PASS. Update viewmodel test fixtures that build `useHistoryAnalysis` results
(`viewmodels/__tests__/fixtures.ts` etc.) to the reduced shape.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src
git commit -m "feat(live): dashboard live/upcoming seat maps from baseline + analyseLive; second engine retired (trends kept); live analysis exposed for the map work"
```

---

### Task 9: Tune the call thresholds on a simulation run (provisional)

**Files:**
- Create: `scraper/src/simulation/tune-calls.ts`
- Modify: `backend/src/common/seat-analysis/live.ts` (constants only, if the numbers say so) + the frontend copy;
  `docs/LIVE_RUNBOOK.md` (simulation section: how to run the tuning)

- [ ] **Step 1: Write `tune-calls.ts`**

It reads the simulation election's `seat_rounds` and the final winners, and computes the call each timeline point
would have had:
- `remaining` from that point's round fields, as `analyseLive` does;
- the leader from `leader_candidate_id`;
- the final winner = the WON row.

It reports, per label (safe / likely / too_close):
- the number of points;
- the share whose leader was **not** the final winner ("flip rate");
- the share of all leader flips that happened after a point labelled safe.

```ts
/**
 * Tune CALL_THRESHOLDS on a simulation run (provisional: synthetic rounds). Usage, after sim:replay finished:
 *   npx ts-node src/simulation/tune-calls.ts [--election <id>]   (default: the election named "… (Simulation)")
 * Prints per label: points, flip rate (leader at that point ≠ final winner). Target: safe flip rate ≤ 1%.
 */
import { Client } from 'pg';
import { CALL_THRESHOLDS } from '../../../backend/src/common/seat-analysis/live';

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
  const arg = process.argv.indexOf('--election');
  const id = arg > 0 ? process.argv[arg + 1] : (await db.query(`SELECT id FROM elections WHERE name LIKE '%(Simulation)%' ORDER BY year DESC LIMIT 1`)).rows[0]?.id;
  if (!id) throw new Error('no simulation election; run sim:setup + sim:replay first');
  const { rows } = await db.query(`
    SELECT s.const_id, s.round_no, s.round_total, s.leader_candidate_id AS leader, s.margin, s.votes_counted AS v, s.declared,
           (SELECT r.candidate_id FROM results r WHERE r.election_id = s.election_id AND r.const_id = s.const_id AND r.status = 'WON' LIMIT 1) AS winner
    FROM seat_rounds s WHERE s.election_id = $1 AND NOT s.declared`, [id]);
  const tally: Record<string, { n: number; flips: number }> = {};
  for (const r of rows) {
    if (!r.round_no || !r.round_total || !r.winner) continue;
    const remaining = Math.round((r.v / r.round_no) * (r.round_total - r.round_no));
    const f = remaining > 0 ? (r.margin ?? 0) / remaining : Infinity;
    const label = f < CALL_THRESHOLDS.tooClose ? 'too_close' : f < CALL_THRESHOLDS.likely ? 'likely' : 'safe';
    const t = (tally[label] ??= { n: 0, flips: 0 }); t.n++; if (r.leader !== r.winner) t.flips++;
  }
  for (const [k, t] of Object.entries(tally)) console.log(`${k.padEnd(10)} ${String(t.n).padStart(6)} points, flip rate ${(100 * t.flips / Math.max(t.n, 1)).toFixed(2)}%`);
  await db.end();
})();
```
If importing from `../../../backend/...` fails under the scraper's ts-node config, copy the two constants into the
script with a comment pointing at `live.ts`, and keep them in sync by hand. Record that as a ruling.

- [ ] **Step 2: Run a simulation and tune**

Follow `docs/LIVE_RUNBOOK.md` → Simulation (mock ECI on :4444, `sim:setup`, `sim:live` / `sim:replay` with a short
`ROUND_DELAY_MS`, until counting ends). Then run `npx ts-node src/simulation/tune-calls.ts`.
- **Target:** `safe` flip rate ≤ 1%, and `too_close` holds most flips.
- If `safe` is above 1%, raise `likely` (e.g. 0.2 → 0.3) and re-run the script. It replays stored rows, so no new
  simulation is needed.
- Record the final numbers and constants in the ledger, and in `docs/LIVE_RUNBOOK.md` under a "Call thresholds
  (provisional)" note: tuned on synthetic rounds, to be re-checked against real mid-count data.
- If the constants changed, copy `live.ts` to the frontend, run both identical tests, and commit.
- Then `npm run sim:cleanup`.

- [ ] **Step 3: Commit**

```bash
git add scraper/src/simulation/tune-calls.ts docs/LIVE_RUNBOOK.md backend/src/common/seat-analysis/live.ts frontend/src/model/derive/seatAnalysis/live.ts
git commit -m "feat(live): tune-calls script; provisional call thresholds from a simulation run"
```

---

### Task 10: Local end-to-end check, docs

**Files:** `docs/FEATURES.md`, `docs/LIVE_RUNBOOK.md`, `docs/DEPLOYMENT.md`, `CLAUDE.md`,
`docs/superpowers/specs/2026-10-07-seat-analysis-design.md`

- [ ] **Step 1: Live dashboard check on the simulation**

- Start a simulation again (as in Task 9) with a slower `ROUND_DELAY_MS`.
- Compute its baseline:
  `curl -X POST -H "Authorization: Bearer <local admin token>" localhost:3082/api/v1/admin/constituencies/analysis/compute/<sim id>`
  must return `kind: "baseline"`.
- Open the simulation's dashboard on :3080 while rounds arrive. Check that:
  - the Swing and History layers fill from the baseline + live analysis;
  - the browser console shows no errors;
  - `GET /elections/<sim id>/results?v=…` has `trail` entries with at most 6 points.
- Run `npm run live:check -- --election <sim id> --source mock-eci` and confirm the baseline line is clean (READY).
  Then edit a candidate's name in admin and run it again: it reports the baseline as stale (NOT READY).
- Clean up: `npm run sim:cleanup`.

- [ ] **Step 2: Full suites + e2e**

Run all suites (backend unit + DB, frontend, admin, scraper) and `cd frontend && npm run e2e`.
- **Expected:** the same 42 pass. The 9 known pre-existing failures may still fail (Lok Sabha hidden, :3086 baseline
  server); anything else failing is a regression to fix.
- The live correction test ("an admin seat correction reaches an open dashboard within 20 s") must pass.

- [ ] **Step 3: Docs**

- **`docs/FEATURES.md`:** a "Seat analysis rework (Phase B)" section covering:
  - baseline (what it holds, when it is computed, `GET /elections/:id/baseline`);
  - `seat_rounds` (written by ingest and corrections, set-based, under the seat lock);
  - the snapshot `trail` (≤6 points, `lc`, `pk`) and `GET …/rounds`;
  - `analyseLive` (calls, momentum, comeback, sitting MLA status, upsets, live tallies), with the provisional
    thresholds;
  - the dashboard swap (no second engine; trends kept);
  - the live = final test.
- **`docs/LIVE_RUNBOOK.md`:**
  - T-1 day: compute the baseline after the final candidate list, then `live:check` must be READY, including the
    baseline line;
  - going Live recomputes it;
  - the simulation section: the `delimitation` copy and the tuning script.
- **`docs/DEPLOYMENT.md`:**
  - §5.0c rollout for 025: `setup.sh` on Neon → Render CLI deploy → push for Vercel;
  - fix the stale "auto-deploy on `main`" claim in the "Current deployment" paragraph: Render deploys by CLI only.
- **`CLAUDE.md`:** migration 025 (seat_rounds, baseline columns); the shared module now also has `baselineOf` /
  `analyseLive`.
- **Spec:** record decisions (a) and (c) in §5.1 / §5.2.

- [ ] **Step 4: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs: seat analysis Phase B (baseline, timeline, trail, live analysis, runbook, deployment)"
```

---

### Task 11: Production rollout (each step needs the user's go-ahead)

1. **Backup:** a Neon branch of production (`backup-pre-025-<date>`, no compute).
2. **Schema first:** `setup.sh` against Neon with the direct URL (migration 025). Check that `seat_rounds` exists and
   that `election_analysis.data` is nullable.
3. **Merge:** `feat/seat-analysis-b` into `main` and push. Vercel deploys the frontend and admin. The old backend
   still serves until step 4; the frontend tolerates a missing `trail` / baseline.
4. **Backend:** `render deploys create srv-dav07gl9fdbs73aluc2g --commit <merge sha> --wait`. Then check
   `/health/ready`, `GET /elections/<any>/baseline` (200, null), and that a snapshot has `trail: {}`.
5. **Recompute the final analysis** for all VS elections (Phase B's `won` / heavyweight fixes change a few rows), with
   an admin token as before.
6. **Spot-check:** no VS row has null `data`; Bihar 2025 is unchanged except for the expected few rows.
7. **Wrap up:** update memory. The 2027 elections' baselines are computed in the T-1 runbook step once their candidate
   lists are final.
