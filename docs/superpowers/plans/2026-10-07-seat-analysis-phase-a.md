# Seat Analysis Rework, Phase A: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared, pure seat-analysis module replaces the backend strategies. A single server path stores a richer
final analysis per seat and per election, and production is recomputed once.

**Architecture:** A pure TypeScript module (`seat-analysis/`) is byte-identical in backend and frontend. A backend
loader turns the DB into the module's plain input, and `SeatAnalysisService` upserts the output into
`constituency_analysis.data` and a new `election_analysis` table. The public API serves it (plus a one-release legacy
adapter), and the frontend reads `data` through its existing viewmodels.

**Tech Stack:** NestJS + Prisma + PostgreSQL 15 (raw SQL migrations), Jest (backend), React + Vitest (frontend),
ts-node scripts (scraper).

**Spec:** `docs/superpowers/specs/2026-10-07-seat-analysis-design.md` (Phase A = §§3–4). Party page context:
`docs/superpowers/specs/2026-10-06-party-page-notes.md` §8.

## Global Constraints

- Migrations: idempotent (`IF NOT EXISTS` / `DO` blocks), no dependency on seed data, numbered `024_…`.
- Seeds: `ON CONFLICT DO NOTHING` / fill-only, never `TRUNCATE`; run on every deploy by `database/setup.sh`.
- `backend/prisma/schema.prisma` matches the SQL. Check with `prisma migrate diff` (needs `DIRECT_URL`). Never
  apply `ALTER COLUMN person_id SET NOT NULL` on `candidates` or a drop of `metadata`, and never run `prisma db push`.
- Shared module files are byte-identical in `backend/src/common/seat-analysis/` and
  `frontend/src/model/derive/seatAnalysis/`, except each side's one-line `lineage.ts`. A test on each side enforces
  this.
- Party comparison goes only through `comparable-parties` (`relation`, `carryForward`, `familyOf`).
- Seats link across elections by `const_no`, and only within one delimitation (`comparable-elections.ts`).
- NOTA = a candidate with `party_id = 'NOTA'`; never a winner / runner-up / third, always counted in vote totals.
- Independents = `party_id = 'IND'`. Two independents are the same "party" only if they are the same person.
- Frontend: `npm run lint` must pass (MVVM import direction). `model/` imports no React.
- Commit after every task, ending the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Nothing in this plan touches production. Task 11 lists the production steps; each needs the user's go-ahead.

## Review Focus

1. **History order.** The module must throw if `history` is not oldest → newest. The loader must reverse
   `earlierComparableElectionIds` (newest first). Pinned in Task 2 (throws) and Task 6 (Bihar 2025's previous =
   2020).
2. **Admin `notes` survive a recompute.** The upsert never writes `notes`, and the delete-and-reinsert is gone.
   Pinned in Task 6's DB spec.
3. **Common names.** A name-only match anywhere in the state only counts if the name is unique in that election, and
   heavyweights also need a matching party. Pinned in Tasks 3 (non-unique name → no match; heavyweight party guard).
4. **Seats with no result** (no WON/LEADING row, e.g. countermanded or adjourned): the seat gets `winner: null` and
   `outcome`/`class` = null, with no crash and no "new". Pinned in Task 2.
5. **A manifest save keeps `government`.** The admin manifest editor must not drop unknown keys on save. Pinned in
   Task 9 (admin test).

---

## File structure

**Shared module** (identical on both sides):

| File | Responsibility |
|---|---|
| `types.ts` | Input / output types, constants (`SCHEMA_VERSION`, `NOTA`, `INDEPENDENT`, `ALLIANCE_ALIASES`) |
| `match.ts` | `normName`, `samePerson`, `findPerson` (person_id → same-seat name → unique name) |
| `rank.ts` | `rank(seat)`: ordering, winner, runner-up, margin, totals; `share`, `r1` |
| `seat.ts` | `analyseSeat`: outcome, swing, class, incumbency, history, seat type |
| `notes.ts` | `seatNotes`: spoiler, NOTA, rematch, revenge, switcher, heavyweight |
| `election.ts` | `analyseElection`: party rows, families, flow, alliance change, close/narrowing, bellwethers, breakdowns |
| `index.ts` | `analyse(input)`: builds the indexes, checks the order, runs all of the above |
| `lineage.ts` | **Per side, not identical.** Re-exports `comparable-parties` / `comparableParties` |

**Backend:**
- `backend/src/modules/constituencies/seat-analysis.loader.ts`: DB → `AnalysisInput`.
- `backend/src/modules/constituencies/seat-analysis.service.ts`: compute + upsert + cache purge; read helpers.
- `backend/src/modules/constituencies/legacy-analysis.ts`: `SeatAnalysis` → the old `incumbency` JSON (one release).
- Strategies folder and `ConstituenciesService.computeAnalysis`: deleted.

**Database:**
- `database/migrations/024_seat_analysis.sql`;
- `database/seed_election_government.sql` (generated);
- `scraper/data/government.json` + `scraper/src/government-cli.ts`.

**Frontend:** `model/types/index.ts`, `viewmodels/data/useAnalysis.ts`, `model/derive/seatView.ts`,
`viewmodels/pages/useConstituencyPageVM.ts`.

**Admin:** `src/types/index.ts`, `ConstituencyAnalysisCard.tsx`, `hooks/useConstituencyManager.ts`.

---

### Task 1: Migration 024 + Prisma

**Files:**
- Create: `database/migrations/024_seat_analysis.sql`
- Modify: `backend/prisma/schema.prisma` (model `constituency_analysis`, new model `election_analysis`, relation on
  `elections`)

**Interfaces:**
- Produces: columns `constituency_analysis.data JSONB`, `.schema_version SMALLINT`, `.computed_at TIMESTAMPTZ`; table
  `election_analysis(election_id PK, data, baseline, schema_version, computed_at)`. Prisma model `election_analysis`.

- [ ] **Step 1: Write the migration**

```sql
-- 024: seat analysis rework (spec docs/superpowers/specs/2026-10-07-seat-analysis-design.md §4.4).
-- constituency_analysis.data holds the shared module's SeatAnalysis; `incumbency` is no longer written (dropped by a
-- later migration). election_analysis holds the per-election ElectionAnalysis, and `baseline` (Phase B) the
-- pre-counting baseline.
ALTER TABLE constituency_analysis ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE constituency_analysis ADD COLUMN IF NOT EXISTS schema_version SMALLINT;
ALTER TABLE constituency_analysis ADD COLUMN IF NOT EXISTS computed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS election_analysis (
  election_id    UUID PRIMARY KEY REFERENCES elections(id) ON DELETE CASCADE,
  data           JSONB NOT NULL,
  baseline       JSONB,
  schema_version SMALLINT NOT NULL,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Apply it locally twice (idempotency)**

Run: `cd database && for i in 1 2; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/024_seat_analysis.sql; done`
(`DATABASE_URL` from the root `.env`, without `?schema=public`).
Expected: both runs succeed (NOTICEs about existing columns are fine).

- [ ] **Step 3: Update Prisma**

In `model constituency_analysis`, add the fields below and mark `incumbency` ignored:
```prisma
  incumbency      Json?          @default("{}") @ignore
  data            Json?
  schema_version  Int?           @db.SmallInt
  computed_at     DateTime?      @db.Timestamptz(6)
```
Add the model:
```prisma
/// Per-election seat analysis (migration 024): ElectionAnalysis in `data`; `baseline` is Phase B.
model election_analysis {
  election_id    String    @id @db.Uuid
  data           Json
  baseline       Json?
  schema_version Int       @db.SmallInt
  computed_at    DateTime  @default(now()) @db.Timestamptz(6)
  elections      elections @relation(fields: [election_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
}
```
and in `model elections` add `election_analysis election_analysis?`.

- [ ] **Step 4: Generate and check drift**

Run: `cd backend && npx prisma generate && DIRECT_URL=$DATABASE_URL npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`
Expected: only the known drift (`ALTER COLUMN "person_id" SET NOT NULL` on candidates, `metadata` drops). Nothing
about `constituency_analysis` or `election_analysis`.

- [ ] **Step 5: Fix compile errors from `@ignore`**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: errors only where `incumbency` is read or written (`constituencies.service.ts` `updateAnalysis` /
`getPublicAnalysis`, the admin DTOs). Leave them failing for now: Task 7 rewrites those call sites. If anything else
fails, fix it here.

- [ ] **Step 6: Commit**

```bash
git add database/migrations/024_seat_analysis.sql backend/prisma/schema.prisma
git commit -m "feat(db): migration 024: constituency_analysis.data + election_analysis (seat analysis rework)"
```

---

### Task 2: Shared module core: types, ranking, matching, per-seat analysis

**Files:**
- Create: `backend/src/common/seat-analysis/{types,rank,match,seat,index,lineage}.ts` and a stub `notes.ts` and
  `election.ts` (filled by Tasks 3–4)
- Test: `backend/src/common/seat-analysis/seat-analysis.spec.ts`, `backend/src/common/seat-analysis/fixtures.ts`

**Interfaces:**
- Consumes: `relation`, `carryForward`, `familyOf`, `LineageEventLike` from `../comparable-parties`.
- Produces (later tasks use these exact names):
  - `analyse(input: AnalysisInput): { seats: SeatAnalysis[]; election: ElectionAnalysis }`;
  - `rank(seat: SeatIn): Ranked`;
  - `findPerson(who: Who, e: ElectionIn, constNo: number): Match | null`;
  - `samePerson(a: Who, b: Who): boolean`;
  - `normName(n: string): string`;
  - `Ctx` (the analysis context);
  - all types in `types.ts`.

- [ ] **Step 1: Write `types.ts`**

```ts
import type { LineageEventLike } from './lineage';

/** Bumped when the stored shape changes (constituency_analysis.schema_version, election_analysis.schema_version). */
export const SCHEMA_VERSION = 1;
export const NOTA = 'NOTA';
export const INDEPENDENT = 'IND';
/** Alliance ids that are the same bloc across elections (Congress-led UPA before 2023 counts as INDIA). */
export const ALLIANCE_ALIASES: Record<string, string> = { UPA: 'INDIA' };

export interface CandidateIn { person_id: string | null; name: string; party_id: string | null; votes: number; status: string }
export interface SeatIn {
  const_id: string;
  const_no: number;
  reserved: 'GEN' | 'SC' | 'ST';
  region_id: number | null;
  /** Turnout %, when known. */
  turnout: number | null;
  candidates: CandidateIn[];
}
export interface AllianceIn { id: string; parties: string[] }
export interface ElectionIn {
  id: string;
  year: number;
  /** Counting date YYYY-MM-DD (else `${year}-07-01`): the lineage comparison window. */
  date: string;
  seats: SeatIn[];
  alliances: AllianceIn[];
  /** Parties of the government formed after these results (manifest `government.parties`); null = unknown. */
  government: string[] | null;
}
export interface VoteSplitIn { spoiler: string; hurts: string; label?: string }
export type HeavyweightReason = 'leader' | 'cabinet' | 'state_president' | 'legislature_leader';
export interface HeavyweightIn { person_id: string | null; name: string; party_id: string | null; reason: HeavyweightReason }
export interface AnalysisInput {
  stateId: number | null;
  current: ElectionIn;
  voteSplits: VoteSplitIn[];
  heavyweights: HeavyweightIn[];
  /** Comparable earlier elections (same type, state, delimitation), oldest → newest. */
  history: ElectionIn[];
  /** The previous election of the same type and state, any delimitation (party totals compare across a redraw). */
  previousAny: ElectionIn | null;
  lineage: LineageEventLike[];
}

export interface Placed { name: string; person_id: string | null; party_id: string | null; votes: number; share: number | null }
export type OutcomeKind = 'retained' | 'gained' | 'split' | 'new';
/** `from` = the previous holder carried to this election's party ids (JVM → BJP); `from_raw` = as it was. */
export interface Outcome { kind: OutcomeKind; from: string | null; from_raw: string | null }
export type ClassKind = 'stronghold' | 'loyal' | 'swing' | 'new';
export interface SeatClass { kind: ClassKind; holder: string; streak: number; since: number; wins: number; total: number }
export interface Incumbency {
  name: string;
  person_id: string | null;
  party: string | null;
  match: 'person' | 'name' | null;
  recontested: boolean;
  /** Where they contest now (null: not a candidate). */
  const_id: string | null;
  same_seat: boolean;
  party_now: string | null;
  switched: boolean;
  followed_split: boolean;
  /** null when not re-contesting. */
  won: boolean | null;
}
export interface HistoryEntry {
  year: number;
  party: string | null;
  /** The party carried to the current election's ids (lineage family); IND stays IND. */
  family: string | null;
  candidate: string;
  person_id: string | null;
  margin: number | null;
  vote_share: number | null;
  runner_up: string | null;
  runner_up_party: string | null;
}
export type SeatType = 'two-way' | 'three-way' | 'multi-cornered';
export type SeatNote =
  | { kind: 'spoiler'; name: string; party: string | null; votes: number; margin: number; hurts?: string; label?: string }
  | { kind: 'nota'; votes: number; margin: number }
  | { kind: 'rematch'; names: [string, string] }
  | { kind: 'revenge'; name: string; beat: string }
  | { kind: 'switcher'; name: string; from: string; to: string; year: number; match: 'person' | 'name' }
  | { kind: 'heavyweight'; name: string; party: string | null; reasons: HeavyweightReason[] }
  | { kind: 'bellwether'; elections: number };
export interface SeatAnalysis {
  schema_version: number;
  const_id: string;
  const_no: number;
  winner: Placed | null;
  runner_up: Placed | null;
  margin: number | null;
  margin_pct: number | null;
  total_votes: number;
  /** The winner is only LEADING. */
  provisional: boolean;
  outcome: Outcome | null;
  swing: { winner_party: number | null; prev_holder: number | null } | null;
  class: SeatClass | null;
  incumbent: Incumbency | null;
  /** Comparable elections with a winner, this one included, oldest → newest. */
  history: HistoryEntry[];
  seat_type: SeatType | null;
  notes: SeatNote[];
}

export interface PartyRow {
  party_id: string;
  contested: number;
  won: number;
  votes: number;
  share: number;
  /** Against `previousAny` (carried through lineage); null when there is none. */
  prev: { won: number; share: number } | null;
  held: number;
  gained: number;
  lost: number;
  split_gained: number;
  split_lost: number;
}
export interface FamilyRow { root: string; members: string[]; won: number; share: number }
export interface FlowRow { from: string; to: string; seats: number; split: boolean }
export interface AllianceChange {
  moves: { from: string; to: string; seats: number }[];
  within: { alliance: string; seats: number }[];
  shares: { alliance: string; share: number; prev_share: number | null }[];
}
export interface BreakdownRow { group: string; seats: number; parties: { party_id: string; won: number; share: number }[] }
export interface ElectionAnalysis {
  schema_version: number;
  election_id: string;
  prev_election_id: string | null;
  prev_any_election_id: string | null;
  total_votes: number;
  parties: PartyRow[];
  families: FamilyRow[];
  flow: FlowRow[];
  alliance: AllianceChange | null;
  close_seats: string[];
  narrowing_seats: string[];
  bellwethers: string[];
  breakdowns: { reserved: BreakdownRow[]; region: BreakdownRow[]; turnout: BreakdownRow[] };
}
```

- [ ] **Step 2: Write `lineage.ts` (backend copy; NOT part of the identical set)**

```ts
// The one per-side file of the shared seat-analysis module: the rest import the lineage rule from here.
export { carryForward, relation, familyOf } from '../comparable-parties';
export type { LineageEventLike, CompareContext } from '../comparable-parties';
```

- [ ] **Step 3: Write `rank.ts` and `match.ts`**

```ts
// rank.ts
import { NOTA, type CandidateIn, type SeatIn } from './types';

export const r1 = (x: number) => Math.round(x * 10) / 10;
export const share = (votes: number, total: number): number | null => (total > 0 ? r1((votes / total) * 100) : null);

export interface Ranked {
  seat: SeatIn;
  /** Real candidates (no NOTA), most votes first. */
  ranked: CandidateIn[];
  /** Every vote polled, NOTA included. */
  total: number;
  nota: number;
  winner: CandidateIn | null;
  runnerUp: CandidateIn | null;
  /** null without a winner or a runner-up (unopposed). */
  margin: number | null;
}

export function rank(seat: SeatIn): Ranked {
  const total = seat.candidates.reduce((s, c) => s + c.votes, 0);
  const nota = seat.candidates.filter(c => c.party_id === NOTA).reduce((s, c) => s + c.votes, 0);
  const ranked = seat.candidates.filter(c => c.party_id !== NOTA).sort((a, b) => b.votes - a.votes);
  const winner = ranked.find(c => c.status === 'WON' || c.status === 'LEADING') ?? null;
  const runnerUp = winner ? ranked.find(c => c !== winner) ?? null : null;
  const margin = winner && runnerUp ? winner.votes - runnerUp.votes : null;
  return { seat, ranked, total, nota, winner, runnerUp, margin };
}
```

```ts
// match.ts
import { NOTA, type CandidateIn, type ElectionIn, type SeatIn } from './types';

export interface Who { person_id: string | null; name: string }
export interface Match { seat: SeatIn; cand: CandidateIn; match: 'person' | 'name' }

/** Upper-case letters only, "X alias Y" → X (today's incumbency rule). */
export function normName(n: string): string {
  return n.toUpperCase().trim().replace(/\s+ALIAS\s+.*/i, '').replace(/[^A-Z\s]/g, '').replace(/\s+/g, ' ').trim();
}

/** The same person: same person_id, else the same normalised name (older elections are only partly person-linked). */
export function samePerson(a: Who, b: Who): boolean {
  if (a.person_id && b.person_id && a.person_id === b.person_id) return true;
  const n = normName(a.name);
  return n !== '' && n === normName(b.name);
}

/**
 * `who` among an election's candidates (spec §3.1): by person_id anywhere; else by name in the seat `constNo`; else by
 * name anywhere in the election only when that name is unique there.
 */
export function findPerson(who: Who, e: ElectionIn, constNo: number): Match | null {
  const real = (c: CandidateIn) => c.party_id !== NOTA;
  if (who.person_id) {
    for (const seat of e.seats) {
      const cand = seat.candidates.find(c => real(c) && c.person_id === who.person_id);
      if (cand) return { seat, cand, match: 'person' };
    }
  }
  const n = normName(who.name);
  if (!n) return null;
  const home = e.seats.find(s => s.const_no === constNo);
  const here = home?.candidates.find(c => real(c) && normName(c.name) === n);
  if (home && here) return { seat: home, cand: here, match: 'name' };
  const all = e.seats.flatMap(seat => seat.candidates.filter(c => real(c) && normName(c.name) === n).map(cand => ({ seat, cand })));
  return all.length === 1 ? { ...all[0], match: 'name' } : null;
}
```

- [ ] **Step 4: Write `seat.ts`**

```ts
import { carryForward, relation } from './lineage';
import { findPerson, normName, samePerson } from './match';
import { rank, share, r1, type Ranked } from './rank';
import {
  INDEPENDENT, SCHEMA_VERSION, type AnalysisInput, type CandidateIn, type ElectionIn, type HistoryEntry, type Incumbency,
  type Outcome, type Placed, type SeatAnalysis, type SeatClass, type SeatIn, type SeatType,
} from './types';

/** Everything a seat analysis needs: the input plus each election's seats ranked, by const_no. */
export interface Ctx {
  input: AnalysisInput;
  /** election id → const_no → ranked seat. */
  idx: Map<string, Map<number, Ranked>>;
}

export const seatOf = (ctx: Ctx, e: ElectionIn, constNo: number): Ranked | undefined => ctx.idx.get(e.id)?.get(constNo);
const win = (ctx: Ctx, from: ElectionIn) => ({ fromDate: from.date, toDate: ctx.input.current.date, stateId: ctx.input.stateId });

/** A party of election `from` as this election's id (IND stays IND). */
export function carry(ctx: Ctx, party: string, from: ElectionIn): string {
  if (party === INDEPENDENT) return party;
  return carryForward(ctx.input.lineage, party, from.date, ctx.input.current.date, ctx.input.stateId);
}

/** Holder identity for streaks: the carried party, or the person for an independent (two independents differ). */
function holderKey(ctx: Ctx, c: CandidateIn, from: ElectionIn): string {
  return c.party_id === INDEPENDENT ? `IND:${normName(c.name)}` : carry(ctx, c.party_id ?? '', from);
}

const placed = (c: CandidateIn | null, total: number): Placed | null =>
  c ? { name: c.name, person_id: c.person_id, party_id: c.party_id, votes: c.votes, share: share(c.votes, total) } : null;

/** Sum of the vote share in `rk` of every candidate whose party satisfies `keep`. */
function partyShare(rk: Ranked, keep: (party: string) => boolean): number | null {
  if (rk.total <= 0) return null;
  const v = rk.ranked.filter(c => c.party_id && keep(c.party_id)).reduce((s, c) => s + c.votes, 0);
  return r1((v / rk.total) * 100);
}

function outcomeOf(ctx: Ctx, prevE: ElectionIn | undefined, prev: Ranked | undefined, cur: Ranked): Outcome {
  const w = cur.winner!;
  if (!prevE || !prev?.winner) return { kind: 'new', from: null, from_raw: null };
  const p = prev.winner;
  const fromRaw = p.party_id;
  const from = fromRaw ? carry(ctx, fromRaw, prevE) : null;
  if (fromRaw === INDEPENDENT || w.party_id === INDEPENDENT) {
    const same = fromRaw === w.party_id && samePerson(p, w);
    return { kind: same ? 'retained' : 'gained', from, from_raw: fromRaw };
  }
  const rel = relation(ctx.input.lineage, fromRaw ?? '', w.party_id ?? '', win(ctx, prevE));
  return { kind: rel === 'same' ? 'retained' : rel === 'split' ? 'split' : 'gained', from, from_raw: fromRaw };
}

function swingOf(ctx: Ctx, prevE: ElectionIn | undefined, prev: Ranked | undefined, cur: Ranked) {
  if (!prevE || !prev?.winner) return null;
  const sw = (party: string | null) => {
    if (!party || party === INDEPENDENT) return null;
    const now = partyShare(cur, q => q === party);
    const before = partyShare(prev, q => carry(ctx, q, prevE) === party);
    return now == null || before == null ? null : r1(now - before);
  };
  const holder = prev.winner.party_id ? carry(ctx, prev.winner.party_id, prevE) : null;
  return { winner_party: sw(cur.winner!.party_id), prev_holder: sw(holder) };
}

function classOf(ctx: Ctx, elections: ElectionIn[], constNo: number): SeatClass | null {
  const runs = elections
    .map(e => ({ e, w: seatOf(ctx, e, constNo)?.winner ?? null }))
    .filter((x): x is { e: ElectionIn; w: CandidateIn } => x.w != null)
    .map(x => ({ year: x.e.year, key: holderKey(ctx, x.w, x.e) }));
  const last = runs[runs.length - 1];
  if (!last || last.year !== ctx.input.current.year) return null;
  const holder = seatOf(ctx, ctx.input.current, constNo)?.winner?.party_id ?? '';
  let streak = 0;
  for (let i = runs.length - 1; i >= 0 && runs[i].key === last.key; i--) streak++;
  const wins = runs.filter(r => r.key === last.key).length;
  const total = runs.length;
  const since = runs[runs.length - streak].year;
  const kind = total === 1 ? 'new' : wins === total && total >= 3 ? 'stronghold' : streak >= 2 ? 'loyal' : 'swing';
  return { kind, holder, streak, since, wins, total };
}

function incumbencyOf(ctx: Ctx, prevE: ElectionIn | undefined, prev: Ranked | undefined, seat: SeatIn): Incumbency | null {
  if (!prevE || !prev?.winner) return null;
  const w = prev.winner;
  const m = findPerson(w, ctx.input.current, seat.const_no);
  const base = { name: w.name, person_id: w.person_id, party: w.party_id };
  if (!m) return { ...base, match: null, recontested: false, const_id: null, same_seat: false, party_now: null, switched: false, followed_split: false, won: null };
  const now = m.cand.party_id;
  let switched = false, followed = false;
  if (w.party_id === INDEPENDENT || now === INDEPENDENT) switched = w.party_id !== now;
  else {
    const rel = relation(ctx.input.lineage, w.party_id ?? '', now ?? '', win(ctx, prevE));
    switched = rel === 'different';
    followed = rel === 'split';
  }
  const there = seatOf(ctx, ctx.input.current, m.seat.const_no);
  return {
    ...base, match: m.match, recontested: true, const_id: m.seat.const_id, same_seat: m.seat.const_no === seat.const_no,
    party_now: now, switched, followed_split: followed, won: there?.winner === m.cand,
  };
}

function historyOf(ctx: Ctx, elections: ElectionIn[], constNo: number): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const e of elections) {
    const rk = seatOf(ctx, e, constNo);
    const w = rk?.winner;
    if (!rk || !w) continue;
    out.push({
      year: e.year, party: w.party_id, family: w.party_id ? carry(ctx, w.party_id, e) : null, candidate: w.name,
      person_id: w.person_id, margin: rk.margin, vote_share: share(w.votes, rk.total),
      runner_up: rk.runnerUp?.name ?? null, runner_up_party: rk.runnerUp?.party_id ?? null,
    });
  }
  return out;
}

/** Today's definition: three or more candidates at 10%+ → three-way (third ≥ 15%) or multi-cornered; else two-way. */
function seatTypeOf(rk: Ranked): SeatType | null {
  if (rk.ranked.length < 2 || rk.total <= 0) return null;
  const shares = rk.ranked.map(c => (c.votes / rk.total) * 100);
  if (shares.filter(s => s >= 10).length >= 3) return (shares[2] ?? 0) >= 15 ? 'three-way' : 'multi-cornered';
  return 'two-way';
}

export function analyseSeat(ctx: Ctx, seat: SeatIn): SeatAnalysis {
  const { current, history } = ctx.input;
  const cur = seatOf(ctx, current, seat.const_no) ?? rank(seat);
  const prevE = history[history.length - 1];
  const prev = prevE ? seatOf(ctx, prevE, seat.const_no) : undefined;
  const elections = [...history, current];
  const w = cur.winner;
  return {
    schema_version: SCHEMA_VERSION,
    const_id: seat.const_id,
    const_no: seat.const_no,
    winner: placed(w, cur.total),
    runner_up: placed(cur.runnerUp, cur.total),
    margin: cur.margin,
    margin_pct: cur.margin != null ? share(cur.margin, cur.total) : null,
    total_votes: cur.total,
    provisional: w?.status === 'LEADING',
    outcome: w ? outcomeOf(ctx, prevE, prev, cur) : null,
    swing: w ? swingOf(ctx, prevE, prev, cur) : null,
    class: w ? classOf(ctx, elections, seat.const_no) : null,
    incumbent: incumbencyOf(ctx, prevE, prev, seat),
    history: historyOf(ctx, elections, seat.const_no),
    seat_type: seatTypeOf(cur),
    notes: [],
  };
}
```

- [ ] **Step 5: Write `index.ts` with stubs for Tasks 3–4**

```ts
import { seatNotes } from './notes';
import { analyseElection } from './election';
import { rank, type Ranked } from './rank';
import { analyseSeat, type Ctx } from './seat';
import type { AnalysisInput, ElectionAnalysis, ElectionIn, SeatAnalysis } from './types';

export * from './types';
export { normName, samePerson, findPerson } from './match';

/** The whole analysis of one election (spec §§3–4). Pure; throws when `history` is not oldest → newest. */
export function analyse(input: AnalysisInput): { seats: SeatAnalysis[]; election: ElectionAnalysis } {
  const years = [...input.history.map(e => e.year), input.current.year];
  for (let i = 1; i < years.length; i++) {
    if (years[i] <= years[i - 1]) throw new Error(`seat analysis: history must be oldest → newest and before ${input.current.year} (got ${years.join(', ')})`);
  }
  const idx = new Map<string, Map<number, Ranked>>();
  const add = (e: ElectionIn | null) => { if (e && !idx.has(e.id)) idx.set(e.id, new Map(e.seats.map(s => [s.const_no, rank(s)]))); };
  [...input.history, input.previousAny, input.current].forEach(add);
  const ctx: Ctx = { input, idx };
  const seats = input.current.seats.map(s => {
    const a = analyseSeat(ctx, s);
    a.notes = seatNotes(ctx, s, a);
    return a;
  });
  const election = analyseElection(ctx, seats);
  const bell = new Set(election.bellwethers);
  for (const a of seats) if (bell.has(a.const_id)) a.notes.push({ kind: 'bellwether', elections: a.history.length });
  return { seats, election };
}
```

Stub `notes.ts` (Task 3 replaces it):
```ts
import type { Ctx } from './seat';
import type { SeatAnalysis, SeatIn, SeatNote } from './types';
export function seatNotes(_ctx: Ctx, _seat: SeatIn, _a: SeatAnalysis): SeatNote[] { return []; }
```
Stub `election.ts` (Task 4 replaces it):
```ts
import type { Ctx } from './seat';
import { SCHEMA_VERSION, type ElectionAnalysis, type SeatAnalysis } from './types';
export function analyseElection(ctx: Ctx, _seats: SeatAnalysis[]): ElectionAnalysis {
  return { schema_version: SCHEMA_VERSION, election_id: ctx.input.current.id, prev_election_id: null, prev_any_election_id: null, total_votes: 0,
    parties: [], families: [], flow: [], alliance: null, close_seats: [], narrowing_seats: [], bellwethers: [], breakdowns: { reserved: [], region: [], turnout: [] } };
}
```

- [ ] **Step 6: Write the fixtures helper `fixtures.ts`**

```ts
import type { AnalysisInput, CandidateIn, ElectionIn, SeatIn } from './types';

/** [name, party, votes, status?, person_id?]: the most-voted real candidate is WON unless a status is given. */
export type C = [string, string | null, number, string?, string?];
export function seat(no: number, cands: C[], extra: Partial<SeatIn> = {}): SeatIn {
  const top = Math.max(...cands.filter(c => c[1] !== 'NOTA').map(c => c[2]));
  const candidates: CandidateIn[] = cands.map(([name, party_id, votes, status, person_id]) => ({
    name, party_id, votes, person_id: person_id ?? null,
    status: status ?? (party_id !== 'NOTA' && votes === top ? 'WON' : 'LOST'),
  }));
  return { const_id: `T_${no}`, const_no: no, reserved: 'GEN', region_id: null, turnout: null, candidates, ...extra };
}
export const el = (year: number, seats: SeatIn[], extra: Partial<ElectionIn> = {}): ElectionIn =>
  ({ id: `E${year}`, year, date: `${year}-07-01`, seats, alliances: [], government: null, ...extra });
export const input = (current: ElectionIn, history: ElectionIn[] = [], extra: Partial<AnalysisInput> = {}): AnalysisInput =>
  ({ stateId: 1, current, voteSplits: [], heavyweights: [], history, previousAny: history[history.length - 1] ?? null, lineage: [], ...extra });

export const JVM_MERGER = { party_id: 'BJP', predecessor_id: 'JVM', kind: 'merger', effective_date: '2020-02-17', state_id: null, is_successor: true };
export const SHS_SPLIT = { party_id: 'SHSUBT', predecessor_id: 'SHS', kind: 'split', effective_date: '2022-10-10', state_id: null, is_successor: false };
```

- [ ] **Step 7: Write the failing tests `seat-analysis.spec.ts` (core)**

```ts
import { analyse } from './index';
import { findPerson } from './match';
import { el, input, seat, JVM_MERGER, SHS_SPLIT } from './fixtures';

const one = (inp: Parameters<typeof analyse>[0]) => analyse(inp).seats[0];

describe('seat analysis: order and outcome', () => {
  it('throws when history is newest first', () => {
    const a = el(2010, [seat(1, [['A', 'X', 10]])]), b = el(2015, [seat(1, [['A', 'X', 10]])]);
    expect(() => analyse(input(el(2020, [seat(1, [['A', 'X', 10]])]), [b, a]))).toThrow(/oldest → newest/);
  });
  it('compares with the newest earlier election, not the oldest', () => {
    const h = [el(2010, [seat(1, [['P', 'RJD', 50], ['Q', 'JDU', 40]])]), el(2020, [seat(1, [['R', 'BJP', 50], ['S', 'RJD', 40]])])];
    const s = one(input(el(2025, [seat(1, [['R', 'BJP', 60], ['S', 'RJD', 30]])]), h));
    expect(s.outcome).toEqual({ kind: 'retained', from: 'BJP', from_raw: 'BJP' });
    expect(s.incumbent?.name).toBe('R');
  });
  it('gained / split / new', () => {
    const prev = el(2019, [seat(1, [['A', 'SHS', 50], ['B', 'INC', 40]]), seat(2, [['C', 'SHS', 50], ['D', 'INC', 40]])]);
    const cur = el(2024, [seat(1, [['E', 'SHSUBT', 50], ['A', 'SHS', 40]]), seat(2, [['D', 'INC', 50], ['C', 'SHS', 40]]), seat(3, [['F', 'BJP', 9]])]);
    const r = analyse(input(cur, [prev], { lineage: [SHS_SPLIT] })).seats;
    expect(r[0].outcome?.kind).toBe('split');
    expect(r[1].outcome).toEqual({ kind: 'gained', from: 'SHS', from_raw: 'SHS' });
    expect(r[2].outcome?.kind).toBe('new');
  });
  it('a merger carries the old holder (JVM 2014 → BJP 2024 is retained; history family = BJP)', () => {
    const s = one(input(el(2024, [seat(1, [['A', 'BJP', 50], ['B', 'JMM', 40]])]), [el(2014, [seat(1, [['A', 'JVM', 50], ['B', 'JMM', 40]])])], { lineage: [JVM_MERGER] }));
    expect(s.outcome).toEqual({ kind: 'retained', from: 'BJP', from_raw: 'JVM' });
    expect(s.history.map(h => [h.year, h.party, h.family])).toEqual([[2014, 'JVM', 'BJP'], [2024, 'BJP', 'BJP']]);
  });
  it('two different independents are a gain; the same independent is retained', () => {
    const prev = el(2015, [seat(1, [['Ram Lal', 'IND', 50], ['B', 'INC', 40]]), seat(2, [['Ram Lal', 'IND', 50], ['B', 'INC', 40]])]);
    const r = analyse(input(el(2020, [seat(1, [['Shyam', 'IND', 50], ['B', 'INC', 40]]), seat(2, [['RAM LAL', 'IND', 50], ['B', 'INC', 40]])]), [prev])).seats;
    expect(r[0].outcome?.kind).toBe('gained');
    expect(r[1].outcome?.kind).toBe('retained');
  });
  it('a seat with no WON/LEADING row has no winner, outcome or class (and does not crash)', () => {
    const s = one(input(el(2020, [seat(1, [['A', 'X', 10, 'TRAILING'], ['B', 'Y', 5, 'TRAILING']])]), [el(2015, [seat(1, [['A', 'X', 10]])])]));
    expect([s.winner, s.outcome, s.class, s.swing]).toEqual([null, null, null, null]);
  });
  it('NOTA is never runner-up but counts in the total', () => {
    const s = one(input(el(2020, [seat(1, [['A', 'X', 50], ['NOTA', 'NOTA', 45], ['B', 'Y', 5]])])));
    expect(s.runner_up?.name).toBe('B');
    expect(s.total_votes).toBe(100);
    expect(s.margin).toBe(45);
  });
  it('LEADING is provisional', () => {
    expect(one(input(el(2020, [seat(1, [['A', 'X', 50, 'LEADING'], ['B', 'Y', 40, 'TRAILING']])]))).provisional).toBe(true);
  });
});

describe('seat analysis: class', () => {
  const s = (p: string) => seat(1, [['A', p, 50], ['B', 'Z', 40]]);
  it('stronghold: same party every time, at least 3', () => {
    expect(one(input(el(2020, [s('X')]), [el(2010, [s('X')]), el(2015, [s('X')])])).class).toEqual({ kind: 'stronghold', holder: 'X', streak: 3, since: 2010, wins: 3, total: 3 });
  });
  it('loyal: streak 2 but not every time; and 2 of 2 is loyal, not stronghold', () => {
    expect(one(input(el(2020, [s('X')]), [el(2010, [s('Y')]), el(2015, [s('X')])])).class?.kind).toBe('loyal');
    expect(one(input(el(2020, [s('X')]), [el(2015, [s('X')])])).class?.kind).toBe('loyal');
  });
  it('swing: changed hands now (even after a long run of another party)', () => {
    expect(one(input(el(2020, [s('X')]), [el(2005, [s('Y')]), el(2010, [s('Y')]), el(2015, [s('Y')])])).class).toMatchObject({ kind: 'swing', holder: 'X', streak: 1, wins: 1, total: 4 });
  });
  it('new: no comparable history', () => {
    expect(one(input(el(2020, [s('X')]))).class?.kind).toBe('new');
  });
});

describe('seat analysis: swing, incumbency, seat type', () => {
  it('vote swing of the winner party and of the previous holder, through lineage', () => {
    const prev = el(2014, [seat(1, [['A', 'JVM', 40], ['B', 'JMM', 50], ['C', 'Z', 10]])]);
    const s = one(input(el(2024, [seat(1, [['A', 'BJP', 55], ['B', 'JMM', 45]])]), [prev], { lineage: [JVM_MERGER] }));
    expect(s.swing).toEqual({ winner_party: 15, prev_holder: -5 });
  });
  it('incumbent found by person_id in another seat, with a party switch', () => {
    const prev = el(2015, [seat(1, [['Old Name', 'RJD', 50, undefined, 'p1'], ['B', 'JDU', 40]])]);
    const cur = el(2020, [seat(1, [['C', 'RJD', 50], ['B', 'JDU', 40]]), seat(2, [['New Spelling', 'BJP', 60, undefined, 'p1'], ['D', 'INC', 30]])]);
    expect(one(input(cur, [prev])).incumbent).toEqual({
      name: 'Old Name', person_id: 'p1', party: 'RJD', match: 'person', recontested: true, const_id: 'T_2', same_seat: false,
      party_now: 'BJP', switched: true, followed_split: false, won: true,
    });
  });
  it('incumbent by name in the same seat; following a split faction is not a switch', () => {
    const prev = el(2019, [seat(1, [['Aaditya', 'SHS', 50], ['B', 'INC', 40]])]);
    const inc = one(input(el(2024, [seat(1, [['AADITYA', 'SHSUBT', 50], ['B', 'INC', 40]])]), [prev], { lineage: [SHS_SPLIT] })).incumbent;
    expect(inc).toMatchObject({ match: 'name', same_seat: true, switched: false, followed_split: true, won: true });
  });
  it('not re-contesting', () => {
    const inc = one(input(el(2020, [seat(1, [['C', 'X', 50], ['D', 'Y', 40]])]), [el(2015, [seat(1, [['A', 'X', 50], ['B', 'Y', 40]])])])).incumbent;
    expect(inc).toMatchObject({ recontested: false, const_id: null, won: null });
  });
  it('a name found elsewhere counts only if unique in the election', () => {
    const e = el(2020, [seat(1, [['Q', 'X', 1]]), seat(2, [['Ram Kumar', 'X', 5]]), seat(3, [['Ram Kumar', 'Y', 5]]), seat(4, [['Sita Devi', 'Z', 5]])]);
    expect(findPerson({ person_id: null, name: 'Ram Kumar' }, e, 1)).toBeNull();
    expect(findPerson({ person_id: null, name: 'Sita Devi' }, e, 1)?.seat.const_no).toBe(4);
  });
  it('seat type', () => {
    const t = (c: Parameters<typeof seat>[1]) => one(input(el(2020, [seat(1, c)]))).seat_type;
    expect(t([['A', 'X', 50], ['B', 'Y', 45], ['C', 'Z', 5]])).toBe('two-way');
    expect(t([['A', 'X', 40], ['B', 'Y', 35], ['C', 'Z', 25]])).toBe('three-way');
    expect(t([['A', 'X', 40], ['B', 'Y', 35], ['C', 'Z', 12], ['D', 'W', 13]])).toBe('multi-cornered');
  });
});
```

- [ ] **Step 8: Run tests to verify they fail, then pass**

Run: `cd backend && npx jest src/common/seat-analysis -t "seat analysis"`
Before Steps 1–5 exist: FAIL (module not found). After writing them: all tests PASS. If a test fails, fix the module,
not the test, unless the test contradicts the spec.

- [ ] **Step 9: Commit**

```bash
git add backend/src/common/seat-analysis
git commit -m "feat(analysis): shared seat-analysis module core (order, outcome, swing, class, incumbency, history, seat type)"
```

---

### Task 3: Shared module: seat notes

**Files:**
- Modify: `backend/src/common/seat-analysis/notes.ts` (replace the stub)
- Test: `backend/src/common/seat-analysis/seat-analysis.spec.ts` (append)

**Interfaces:**
- Consumes: `Ctx`, `seatOf`, `carry` from `./seat`; `findPerson`, `samePerson` from `./match`; `relation` from
  `./lineage`.
- Produces: `seatNotes(ctx: Ctx, seat: SeatIn, a: SeatAnalysis): SeatNote[]`. Note order: spoiler, nota, rematch,
  revenge, switcher…, heavyweight…

- [ ] **Step 1: Write the failing tests (append)**

```ts
describe('seat analysis: notes', () => {
  const kinds = (s: ReturnType<typeof one>) => s.notes.map(n => n.kind);
  it('generic spoiler: third candidate above the margin; NOTA above the margin', () => {
    const s = one(input(el(2020, [seat(1, [['A', 'X', 40], ['B', 'Y', 35], ['C', 'Z', 10], ['NOTA', 'NOTA', 8]])])));
    expect(s.notes).toEqual([{ kind: 'spoiler', name: 'C', party: 'Z', votes: 10, margin: 5 }, { kind: 'nota', votes: 8, margin: 5 }]);
  });
  it('alliance spoiler replaces the generic one', () => {
    const cur = el(2025, [seat(1, [['A', 'BJP', 40], ['B', 'RJD', 35], ['C', 'AIMIM', 10]])], { alliances: [{ id: 'MGB', parties: ['RJD', 'INC'] }, { id: 'NDA', parties: ['BJP'] }] });
    const s = one(input(cur, [], { voteSplits: [{ spoiler: 'AIMIM', hurts: 'MGB', label: 'AIMIM split' }] }));
    expect(s.notes.filter(n => n.kind === 'spoiler')).toEqual([{ kind: 'spoiler', name: 'C', party: 'AIMIM', votes: 10, margin: 5, hurts: 'MGB', label: 'AIMIM split' }]);
  });
  it('rematch and revenge', () => {
    const prev = el(2015, [seat(1, [['A', 'X', 50], ['B', 'Y', 40]])]);
    const s = one(input(el(2020, [seat(1, [['B', 'Y', 50], ['A', 'X', 45]])]), [prev]));
    expect(s.notes).toEqual(expect.arrayContaining([{ kind: 'rematch', names: ['B', 'A'] }, { kind: 'revenge', name: 'B', beat: 'A' }]));
  });
  it('switcher: a top-two candidate whose last candidacy was for a non-comparable party (a split faction is not one)', () => {
    const prev = el(2019, [seat(1, [['A', 'INC', 50], ['B', 'SHS', 40]]), seat(2, [['Q', 'Y', 9]])]);
    const cur = el(2024, [seat(1, [['A', 'BJP', 50], ['B', 'SHSUBT', 40]])]);
    const s = one(input(cur, [prev], { lineage: [SHS_SPLIT] }));
    expect(s.notes.filter(n => n.kind === 'switcher')).toEqual([{ kind: 'switcher', name: 'A', from: 'INC', to: 'BJP', year: 2019, match: 'name' }]);
  });
  it('switcher looks across a redraw via previousAny', () => {
    const before = el(2014, [seat(9, [['Unique Person', 'PDP', 50], ['Z', 'Y', 40]])]);
    const s = one(input(el(2024, [seat(1, [['Unique Person', 'APNI', 50], ['B', 'NC', 40]])]), [], { previousAny: before }));
    expect(s.notes).toContainEqual({ kind: 'switcher', name: 'Unique Person', from: 'PDP', to: 'APNI', year: 2014, match: 'name' });
  });
  it('heavyweight needs the same person and the same party', () => {
    const cur = el(2020, [seat(1, [['Ram Kumar', 'BJP', 50], ['Ram Kumar', 'INC', 40]])]);
    const s = one(input(cur, [], { heavyweights: [{ person_id: null, name: 'Ram Kumar', party_id: 'BJP', reason: 'state_president' }, { person_id: null, name: 'Ram Kumar', party_id: 'BJP', reason: 'leader' }] }));
    expect(s.notes.filter(n => n.kind === 'heavyweight')).toEqual([{ kind: 'heavyweight', name: 'Ram Kumar', party: 'BJP', reasons: ['state_president', 'leader'] }]);
    expect(kinds(s)).not.toContain('switcher');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && npx jest src/common/seat-analysis -t "notes"`
Expected: FAIL (notes are `[]`).

- [ ] **Step 3: Implement `notes.ts`**

```ts
import { relation } from './lineage';
import { findPerson, samePerson } from './match';
import { seatOf, type Ctx } from './seat';
import { INDEPENDENT, NOTA, type CandidateIn, type ElectionIn, type HeavyweightReason, type SeatAnalysis, type SeatIn, type SeatNote } from './types';

const isParty = (p: string | null): p is string => !!p && p !== INDEPENDENT && p !== NOTA;

function spoiler(ctx: Ctx, rk: NonNullable<ReturnType<typeof seatOf>>): SeatNote | null {
  const { winner, margin, ranked } = rk;
  if (!winner || margin == null) return null;
  const { current, voteSplits } = ctx.input;
  for (const vs of voteSplits) {
    const hurt = current.alliances.find(a => a.id === vs.hurts);
    const cand = ranked.find(c => c !== winner && c.party_id === vs.spoiler);
    if (cand && hurt && !hurt.parties.includes(winner.party_id ?? '') && cand.votes > margin) {
      return { kind: 'spoiler', name: cand.name, party: cand.party_id, votes: cand.votes, margin, hurts: vs.hurts, ...(vs.label ? { label: vs.label } : {}) };
    }
  }
  const third = ranked[2];
  return third && third.votes > margin ? { kind: 'spoiler', name: third.name, party: third.party_id, votes: third.votes, margin } : null;
}

/** The previous candidacy of `c` (newest first: comparable history, then previousAny across a redraw). */
function lastCandidacy(ctx: Ctx, c: CandidateIn, constNo: number) {
  const { history, previousAny } = ctx.input;
  const list: ElectionIn[] = [...history].reverse();
  if (previousAny && !list.some(e => e.id === previousAny.id)) list.push(previousAny);
  for (const e of list) {
    const m = findPerson(c, e, constNo);
    if (m) return { e, m };
  }
  return null;
}

export function seatNotes(ctx: Ctx, seat: SeatIn, _a: SeatAnalysis): SeatNote[] {
  const rk = seatOf(ctx, ctx.input.current, seat.const_no);
  if (!rk?.winner) return [];
  const notes: SeatNote[] = [];
  const sp = spoiler(ctx, rk);
  if (sp) notes.push(sp);
  if (rk.margin != null && rk.nota > rk.margin) notes.push({ kind: 'nota', votes: rk.nota, margin: rk.margin });

  const { history } = ctx.input;
  const prevE = history[history.length - 1];
  const prev = prevE ? seatOf(ctx, prevE, seat.const_no) : undefined;
  const top = [rk.winner, rk.runnerUp].filter((c): c is CandidateIn => !!c);
  if (prev?.winner && prev.runnerUp && top.length === 2) {
    const was = [prev.winner, prev.runnerUp];
    if (top.every(c => was.some(w => samePerson(w, c)))) notes.push({ kind: 'rematch', names: [top[0].name, top[1].name] });
    const beaten = rk.ranked.find(c => c !== rk.winner && samePerson(c, prev.winner!));
    if (samePerson(rk.winner, prev.runnerUp) && beaten) notes.push({ kind: 'revenge', name: rk.winner.name, beat: beaten.name });
  }

  for (const c of top) {
    if (!isParty(c.party_id)) continue;
    const last = lastCandidacy(ctx, c, seat.const_no);
    const old = last?.m.cand.party_id ?? null;
    if (!last || !isParty(old)) continue;
    const rel = relation(ctx.input.lineage, old, c.party_id, { fromDate: last.e.date, toDate: ctx.input.current.date, stateId: ctx.input.stateId });
    if (rel === 'different') notes.push({ kind: 'switcher', name: c.name, from: old, to: c.party_id, year: last.e.year, match: last.m.match });
  }

  for (const c of rk.ranked) {
    const reasons: HeavyweightReason[] = [];
    for (const h of ctx.input.heavyweights) {
      const party = !h.party_id || !c.party_id || h.party_id === c.party_id || (h.person_id != null && h.person_id === c.person_id);
      if (party && samePerson(h, c) && !reasons.includes(h.reason)) reasons.push(h.reason);
    }
    if (reasons.length) notes.push({ kind: 'heavyweight', name: c.name, party: c.party_id, reasons });
  }
  return notes;
}
```
(`_a` is unused for now: notes read the ranked seat directly. It stays in the signature so a note can use the computed analysis later.)

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest src/common/seat-analysis`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/common/seat-analysis
git commit -m "feat(analysis): seat notes (spoiler, NOTA, rematch, revenge, switcher, heavyweight)"
```

---

### Task 4: Shared module: per-election analysis

**Files:**
- Modify: `backend/src/common/seat-analysis/election.ts` (replace the stub)
- Test: `backend/src/common/seat-analysis/seat-analysis.spec.ts` (append)

**Interfaces:**
- Consumes: `Ctx`, `seatOf`, `carry` (`./seat`); `familyOf` (`./lineage`); `share`, `r1` (`./rank`).
- Produces: `analyseElection(ctx: Ctx, seats: SeatAnalysis[]): ElectionAnalysis` (shape in `types.ts`).

- [ ] **Step 1: Write the failing tests (append)**

```ts
describe('election analysis', () => {
  const e = (inp: Parameters<typeof analyse>[0]) => analyse(inp).election;
  it('party rows: contested, won, share; held/gained/lost; prev across a redraw via previousAny', () => {
    const prev = el(2015, [seat(1, [['A', 'X', 60], ['B', 'Y', 40]]), seat(2, [['C', 'X', 60], ['D', 'Y', 40]])]);
    const cur = el(2020, [seat(1, [['A', 'X', 55], ['B', 'Y', 45]]), seat(2, [['D', 'Y', 70], ['C', 'X', 30]])]);
    const x = e(input(cur, [prev])).parties.find(p => p.party_id === 'X')!;
    expect(x).toEqual({ party_id: 'X', contested: 2, won: 1, votes: 85, share: 42.5, prev: { won: 2, share: 60 }, held: 1, gained: 0, lost: 1, split_gained: 0, split_lost: 0 });
    const redraw = e(input(cur, [], { previousAny: prev }));
    expect(redraw.parties.find(p => p.party_id === 'X')).toMatchObject({ prev: { won: 2, share: 60 }, held: 0, lost: 0 });
    expect(redraw.flow).toEqual([]);
    expect(redraw.prev_election_id).toBeNull();
    expect(redraw.prev_any_election_id).toBe('E2015');
  });
  it('flow carries the old holder; split moves are flagged; family totals', () => {
    const prev = el(2019, [seat(1, [['A', 'SHS', 50], ['B', 'INC', 40]]), seat(2, [['C', 'JVM', 50], ['D', 'INC', 40]])]);
    const cur = el(2024, [seat(1, [['E', 'SHSUBT', 50], ['A', 'SHS', 40]]), seat(2, [['C', 'BJP', 50], ['D', 'INC', 40]])]);
    const r = e(input(cur, [prev], { lineage: [SHS_SPLIT, { ...JVM_MERGER, effective_date: '2020-02-17' }] }));
    expect(r.flow).toEqual(expect.arrayContaining([{ from: 'SHS', to: 'SHSUBT', seats: 1, split: true }, { from: 'BJP', to: 'BJP', seats: 1, split: false }]));
    expect(r.families).toEqual([{ root: 'SHS', members: ['SHS', 'SHSUBT'], won: 1, share: 50 }]);
  });
  it('alliance change: moves between alliances, moves inside one, UPA = INDIA, shares', () => {
    const prev = el(2019, [seat(1, [['A', 'INC', 50], ['B', 'BJP', 40]]), seat(2, [['C', 'JDU', 50], ['D', 'INC', 40]])], { alliances: [{ id: 'UPA', parties: ['INC'] }, { id: 'NDA', parties: ['BJP', 'JDU'] }] });
    const cur = el(2024, [seat(1, [['B', 'BJP', 50], ['A', 'INC', 40]]), seat(2, [['E', 'BJP', 50], ['D', 'INC', 40]])], { alliances: [{ id: 'INDIA', parties: ['INC'] }, { id: 'NDA', parties: ['BJP', 'JDU'] }] });
    const a = e(input(cur, [prev])).alliance!;
    expect(a.moves).toEqual([{ from: 'INDIA', to: 'NDA', seats: 1 }]);
    expect(a.within).toEqual([{ alliance: 'NDA', seats: 1 }]);
    expect(a.shares.find(s => s.alliance === 'NDA')).toEqual({ alliance: 'NDA', share: 55.6, prev_share: 50 });
  });
  it('close and narrowing seats', () => {
    const s = (m: number) => seat(1, [['A', 'X', 50 + m], ['B', 'Y', 50 - m]]);
    const r = e(input(el(2020, [s(1)]), [el(2010, [s(10)]), el(2015, [s(5)])]));
    expect(r.close_seats).toEqual(['T_1']);
    expect(r.narrowing_seats).toEqual(['T_1']);
  });
  it('bellwether: winner in government every time, 3+ elections, all known; a missing government gives none', () => {
    const s = (p: string) => seat(1, [['A', p, 50], ['B', 'Z', 40]]);
    const h = [el(2010, [s('X')], { government: ['X'] }), el(2015, [s('Y')], { government: ['Y', 'W'] })];
    const r = analyse(input(el(2020, [s('X')], { government: ['X'] }), h));
    expect(r.election.bellwethers).toEqual(['T_1']);
    expect(r.seats[0].notes).toContainEqual({ kind: 'bellwether', elections: 3 });
    expect(e(input(el(2020, [s('X')]), h)).bellwethers).toEqual([]);
  });
  it('breakdowns: reserved, region, turnout band', () => {
    const prev = el(2015, [seat(1, [['A', 'X', 50], ['B', 'Y', 40]], { turnout: 60 })]);
    const cur = el(2020, [seat(1, [['A', 'X', 50], ['B', 'Y', 40]], { turnout: 67, reserved: 'SC', region_id: 7 })]);
    const b = e(input(cur, [prev])).breakdowns;
    expect(b.reserved).toEqual([{ group: 'SC', seats: 1, parties: [{ party_id: 'X', won: 1, share: 55.6 }, { party_id: 'Y', won: 0, share: 44.4 }] }]);
    expect(b.region.map(g => g.group)).toEqual(['7']);
    expect(b.turnout.map(g => g.group)).toEqual(['≥5']);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && npx jest src/common/seat-analysis -t "election analysis"`
Expected: FAIL (stub returns empty).

- [ ] **Step 3: Implement `election.ts`**

```ts
import { familyOf } from './lineage';
import { r1, type Ranked } from './rank';
import { carry, seatOf, type Ctx } from './seat';
import {
  ALLIANCE_ALIASES, INDEPENDENT, SCHEMA_VERSION, type AllianceChange, type BreakdownRow, type ElectionAnalysis, type ElectionIn,
  type FamilyRow, type FlowRow, type PartyRow, type SeatAnalysis,
} from './types';

const pct = (v: number, t: number) => (t > 0 ? r1((v / t) * 100) : 0);
const bump = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

function ranks(ctx: Ctx, e: ElectionIn): Ranked[] {
  return e.seats.map(s => seatOf(ctx, e, s.const_no)).filter((r): r is Ranked => !!r);
}

/** Seats won and votes per party (as `key` maps it) over an election. */
function tally(rs: Ranked[], key: (party: string) => string) {
  const won = new Map<string, number>(), votes = new Map<string, number>(), contested = new Map<string, number>();
  let total = 0;
  for (const r of rs) {
    total += r.total;
    for (const c of r.ranked) {
      if (!c.party_id) continue;
      const k = key(c.party_id);
      bump(votes, k, c.votes);
      bump(contested, k);
    }
    if (r.winner?.party_id) bump(won, key(r.winner.party_id));
  }
  return { won, votes, contested, total };
}

function parties(ctx: Ctx, seats: SeatAnalysis[]): { rows: PartyRow[]; total: number } {
  const { current, previousAny } = ctx.input;
  const now = tally(ranks(ctx, current), p => p);
  const before = previousAny ? tally(ranks(ctx, previousAny), p => carry(ctx, p, previousAny)) : null;
  const o = { held: new Map<string, number>(), gained: new Map<string, number>(), lost: new Map<string, number>(), sg: new Map<string, number>(), sl: new Map<string, number>() };
  for (const s of seats) {
    const to = s.winner?.party_id, from = s.outcome?.from;
    if (!to || !s.outcome || s.outcome.kind === 'new' || !from) continue;
    if (s.outcome.kind === 'retained') bump(o.held, to);
    else if (s.outcome.kind === 'gained') { bump(o.gained, to); bump(o.lost, from); }
    else { bump(o.sg, to); bump(o.sl, from); }
  }
  const ids = new Set([...now.contested.keys(), ...(before ? [...before.won.keys()] : [])]);
  const rows = [...ids].map((p): PartyRow => ({
    party_id: p, contested: now.contested.get(p) ?? 0, won: now.won.get(p) ?? 0, votes: now.votes.get(p) ?? 0,
    share: pct(now.votes.get(p) ?? 0, now.total),
    prev: before ? { won: before.won.get(p) ?? 0, share: pct(before.votes.get(p) ?? 0, before.total) } : null,
    held: o.held.get(p) ?? 0, gained: o.gained.get(p) ?? 0, lost: o.lost.get(p) ?? 0, split_gained: o.sg.get(p) ?? 0, split_lost: o.sl.get(p) ?? 0,
  }));
  rows.sort((a, b) => b.won - a.won || b.votes - a.votes || a.party_id.localeCompare(b.party_id));
  return { rows, total: now.total };
}

function families(ctx: Ctx, rows: PartyRow[], total: number): FamilyRow[] {
  const byRoot = new Map<string, FamilyRow>();
  for (const r of rows) {
    if (r.party_id === INDEPENDENT) continue;
    const f = familyOf(ctx.input.lineage, r.party_id, ctx.input.current.date, ctx.input.stateId);
    if (f.members.length < 2) continue;
    const row = byRoot.get(f.root) ?? { root: f.root, members: [...f.members].sort(), won: 0, share: 0 };
    row.won += r.won;
    row.share = r1(row.share + (total > 0 ? (r.votes / total) * 100 : 0));
    byRoot.set(f.root, row);
  }
  return [...byRoot.values()];
}

function flow(seats: SeatAnalysis[]): FlowRow[] {
  const m = new Map<string, FlowRow>();
  for (const s of seats) {
    const to = s.winner?.party_id, from = s.outcome?.from;
    if (!to || !from || !s.outcome || s.outcome.kind === 'new') continue;
    const split = s.outcome.kind === 'split';
    const k = `${from}>${to}>${split}`;
    const row = m.get(k) ?? { from, to, seats: 0, split };
    row.seats++;
    m.set(k, row);
  }
  return [...m.values()].sort((a, b) => b.seats - a.seats);
}

const allianceOf = (e: ElectionIn, party: string | null) => {
  const a = party ? e.alliances.find(x => x.parties.includes(party)) : undefined;
  return a ? ALLIANCE_ALIASES[a.id] ?? a.id : 'OTHERS';
};

function allianceShares(ctx: Ctx, e: ElectionIn): Map<string, number> {
  const t = tally(ranks(ctx, e), p => allianceOf(e, p));
  return new Map([...t.votes].map(([k, v]) => [k, pct(v, t.total)]));
}

function alliance(ctx: Ctx, seats: SeatAnalysis[]): AllianceChange | null {
  const { current, history, previousAny } = ctx.input;
  const prevE = history[history.length - 1];
  if (!current.alliances.length || !prevE?.alliances.length) return null;
  const moves = new Map<string, number>(), within = new Map<string, number>();
  for (const s of seats) {
    const prev = seatOf(ctx, prevE, s.const_no)?.winner;
    if (!s.winner || !prev || !s.outcome || s.outcome.kind === 'new') continue;
    const from = allianceOf(prevE, prev.party_id), to = allianceOf(current, s.winner.party_id);
    if (from !== to) bump(moves, `${from}>${to}`);
    else if (s.outcome.kind !== 'retained') bump(within, to);
  }
  const now = allianceShares(ctx, current);
  const before = previousAny?.alliances.length ? allianceShares(ctx, previousAny) : null;
  return {
    moves: [...moves].map(([k, n]) => { const [from, to] = k.split('>'); return { from, to, seats: n }; }).sort((a, b) => b.seats - a.seats),
    within: [...within].map(([a, n]) => ({ alliance: a, seats: n })).sort((a, b) => b.seats - a.seats),
    shares: [...now].map(([a, v]) => ({ alliance: a, share: v, prev_share: before ? before.get(a) ?? 0 : null })).sort((a, b) => b.share - a.share),
  };
}

/** margin % per comparable election (this one last) for a seat. */
function margins(ctx: Ctx, constNo: number): number[] {
  return [...ctx.input.history, ctx.input.current]
    .map(e => seatOf(ctx, e, constNo))
    .filter((r): r is Ranked => !!r && r.margin != null && r.total > 0)
    .map(r => (r.margin! / r.total) * 100);
}

function bellwether(ctx: Ctx, s: SeatAnalysis): boolean {
  const all = [...ctx.input.history, ctx.input.current];
  if (all.length < 3) return false;
  return all.every(e => {
    const w = seatOf(ctx, e, s.const_no)?.winner;
    return !!w?.party_id && !!e.government?.length && e.government.includes(w.party_id);
  });
}

function breakdown(ctx: Ctx, groupOf: (r: Ranked) => string | null): BreakdownRow[] {
  const groups = new Map<string, Ranked[]>();
  for (const r of ranks(ctx, ctx.input.current)) {
    const g = groupOf(r);
    if (g != null) groups.set(g, [...(groups.get(g) ?? []), r]);
  }
  return [...groups].map(([group, rs]) => {
    const t = tally(rs, p => p);
    const parties = [...t.votes.keys()]
      .map(p => ({ party_id: p, won: t.won.get(p) ?? 0, share: pct(t.votes.get(p) ?? 0, t.total) }))
      .filter(p => p.won > 0 || p.share >= 1)
      .sort((a, b) => b.won - a.won || b.share - a.share);
    return { group, seats: rs.length, parties };
  }).sort((a, b) => a.group.localeCompare(b.group));
}

function turnoutBand(ctx: Ctx, r: Ranked): string | null {
  const prevE = ctx.input.history[ctx.input.history.length - 1];
  const before = prevE ? seatOf(ctx, prevE, r.seat.const_no)?.seat.turnout : null;
  if (r.seat.turnout == null || before == null) return null;
  const d = r.seat.turnout - before;
  return d < -5 ? '<-5' : d < 0 ? '-5–0' : d < 5 ? '0–5' : '≥5';
}

export function analyseElection(ctx: Ctx, seats: SeatAnalysis[]): ElectionAnalysis {
  const { current, history, previousAny } = ctx.input;
  const { rows, total } = parties(ctx, seats);
  return {
    schema_version: SCHEMA_VERSION,
    election_id: current.id,
    prev_election_id: history[history.length - 1]?.id ?? null,
    prev_any_election_id: previousAny?.id ?? null,
    total_votes: total,
    parties: rows,
    families: families(ctx, rows, total),
    flow: flow(seats),
    alliance: alliance(ctx, seats),
    close_seats: seats.filter(s => s.margin_pct != null && s.margin_pct < 3).map(s => s.const_id),
    narrowing_seats: seats.filter(s => { const m = margins(ctx, s.const_no).slice(-3); return m.length === 3 && m[0] > m[1] && m[1] > m[2]; }).map(s => s.const_id),
    bellwethers: seats.filter(s => bellwether(ctx, s)).map(s => s.const_id),
    breakdowns: {
      reserved: breakdown(ctx, r => r.seat.reserved),
      region: breakdown(ctx, r => (r.seat.region_id != null ? String(r.seat.region_id) : null)),
      turnout: breakdown(ctx, r => turnoutBand(ctx, r)),
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest src/common/seat-analysis`
Expected: all PASS. (In the alliance test, NDA share = (50 + 50) / 180 = 55.6 and prev = (40 + 50) / 180 = 50.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/common/seat-analysis
git commit -m "feat(analysis): per-election analysis (party rows, families, flow, alliance change, close/narrowing, bellwethers, breakdowns)"
```

---

### Task 5: Frontend copy + identical-file tests

**Files:**
- Create: `frontend/src/model/derive/seatAnalysis/{types,rank,match,seat,notes,election,index}.ts` (byte copies) and
  `frontend/src/model/derive/seatAnalysis/lineage.ts`
- Test: `frontend/src/model/derive/__tests__/seatAnalysis.test.ts`; `backend/src/common/seat-analysis/identical.spec.ts`

**Interfaces:**
- Produces: `import { analyse, type SeatAnalysis, type ElectionAnalysis } from '../../model/derive/seatAnalysis'` for
  frontend code (Task 8).

- [ ] **Step 1: Write the failing identical tests**

`frontend/src/model/derive/__tests__/seatAnalysis.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { analyse } from '../seatAnalysis';

const SHARED = ['types', 'rank', 'match', 'seat', 'notes', 'election', 'index'];

describe('seatAnalysis stays identical to the backend copy', () => {
  it.each(SHARED)('%s.ts', f => {
    const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');
    expect(read(`../seatAnalysis/${f}.ts`)).toBe(read(`../../../../../backend/src/common/seat-analysis/${f}.ts`));
  });
});

describe('seatAnalysis (smoke)', () => {
  it('runs on the frontend lineage copy', () => {
    const seat = { const_id: 'T_1', const_no: 1, reserved: 'GEN' as const, region_id: null, turnout: null,
      candidates: [{ person_id: null, name: 'A', party_id: 'BJP', votes: 50, status: 'WON' }, { person_id: null, name: 'B', party_id: 'JMM', votes: 40, status: 'LOST' }] };
    const prev = { ...seat, candidates: [{ ...seat.candidates[0], party_id: 'JVM' }, seat.candidates[1]] };
    const e = (year: number, s: typeof seat) => ({ id: `E${year}`, year, date: `${year}-07-01`, seats: [s], alliances: [], government: null });
    const lineage = [{ party_id: 'BJP', predecessor_id: 'JVM', kind: 'merger', effective_date: '2020-02-17', state_id: null, is_successor: true }];
    const r = analyse({ stateId: 1, current: e(2024, seat), history: [e(2014, prev)], previousAny: e(2014, prev), voteSplits: [], heavyweights: [], lineage });
    expect(r.seats[0].outcome).toEqual({ kind: 'retained', from: 'BJP', from_raw: 'JVM' });
  });
});
```

`backend/src/common/seat-analysis/identical.spec.ts`:
```ts
import * as fs from 'fs';
import * as path from 'path';

// The shared seat-analysis module is byte-identical in backend and frontend (only lineage.ts differs per side).
const SHARED = ['types', 'rank', 'match', 'seat', 'notes', 'election', 'index'];
describe('seat-analysis stays identical to the frontend copy', () => {
  it.each(SHARED)('%s.ts', f => {
    const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');
    expect(read(`${f}.ts`)).toBe(read(`../../../../frontend/src/model/derive/seatAnalysis/${f}.ts`));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npx vitest run src/model/derive/__tests__/seatAnalysis.test.ts`
Expected: FAIL (no such files).

- [ ] **Step 3: Copy the files and write the frontend `lineage.ts`**

```bash
mkdir -p frontend/src/model/derive/seatAnalysis
for f in types rank match seat notes election index; do cp backend/src/common/seat-analysis/$f.ts frontend/src/model/derive/seatAnalysis/$f.ts; done
```
`frontend/src/model/derive/seatAnalysis/lineage.ts`:
```ts
// The one per-side file of the shared seat-analysis module: the rest import the lineage rule from here.
export { carryForward, relation, familyOf } from '../comparableParties';
export type { LineageEventLike, CompareContext } from '../comparableParties';
```

- [ ] **Step 4: Run both sides, plus type check and lint**

Run: `cd frontend && npx vitest run src/model/derive/__tests__/seatAnalysis.test.ts && npx tsc --noEmit -p tsconfig.app.json && npm run lint`
Then: `cd ../backend && npx jest src/common/seat-analysis`
Expected: all PASS. If the frontend `tsc` complains under stricter options (e.g. `noUnusedParameters`, `verbatimModuleSyntax`), fix the
**backend** file so it satisfies both configs, then re-copy. The files must stay identical. (Use the tsconfig the
frontend build uses; check `frontend/package.json` `build` if `tsconfig.app.json` does not exist.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/model/derive/seatAnalysis frontend/src/model/derive/__tests__/seatAnalysis.test.ts backend/src/common/seat-analysis
git commit -m "feat(analysis): frontend copy of the shared seat-analysis module, kept identical by tests"
```

---

### Task 6: Backend loader + SeatAnalysisService (one compute path, upsert, notes kept)

**Files:**
- Create: `backend/src/modules/constituencies/seat-analysis.loader.ts`, `backend/src/modules/constituencies/seat-analysis.service.ts`
- Modify: `backend/src/modules/constituencies/constituencies.module.ts` (provide + export `SeatAnalysisService`,
  `SeatAnalysisLoader`; remove `ANALYSIS_STRATEGIES`)
- Delete: `backend/src/modules/constituencies/strategies/` (all files, specs included), `ConstituenciesService.computeAnalysis`,
  `extractConstNo` if unused, their imports and the `strategies` constructor injection
- Test: `backend/src/modules/constituencies/seat-analysis.db.spec.ts`, `backend/src/modules/constituencies/seat-analysis.loader.spec.ts`

**Interfaces:**
- Consumes: `analyse`, `AnalysisInput`, `ElectionIn`, `SCHEMA_VERSION` from `../../common/seat-analysis`;
  `earlierComparableElectionIds` from `../../common/comparable-elections`; `PrismaService`; `CacheService`.
- Produces:
  - `SeatAnalysisLoader.load(electionId: string): Promise<AnalysisInput>`;
  - `SeatAnalysisService.compute(electionId: string): Promise<{ computed: number }>`;
  - `SeatAnalysisService.summary(electionId: string): Promise<ElectionAnalysis | null>`;
  - cache keys `election:<id>:public-analysis` (existing) and `election:<id>:analysis-summary`.

- [ ] **Step 1: Write the loader unit test (manifest parsing, heavyweight roles window)**

`seat-analysis.loader.spec.ts`:
```ts
import { manifestBits, rolesAt } from './seat-analysis.loader';

describe('seat analysis loader helpers', () => {
  it('reads alliances, government, vote splits and leaders from manifest text; bad JSON = empty', () => {
    const m = manifestBits(JSON.stringify({ alliances: [{ id: 'NDA', parties: ['BJP'] }], government: { parties: ['BJP'], source: 'x' },
      vote_splits: [{ spoiler: 'BSP', hurts: 'MGB' }], leaders: [{ name: 'L', party_id: 'BJP' }], cabinet: [{ name: 'C', party_id: 'BJP', person_id: 'p9' }] }));
    expect(m.alliances).toEqual([{ id: 'NDA', parties: ['BJP'] }]);
    expect(m.government).toEqual(['BJP']);
    expect(m.voteSplits).toEqual([{ spoiler: 'BSP', hurts: 'MGB' }]);
    expect(m.heavyweights).toEqual([{ person_id: null, name: 'L', party_id: 'BJP', reason: 'leader' }, { person_id: 'p9', name: 'C', party_id: 'BJP', reason: 'cabinet' }]);
    expect(manifestBits('{oops')).toEqual({ alliances: [], government: null, voteSplits: [], heavyweights: [] });
    expect(manifestBits(null).government).toBeNull();
  });
  it('keeps unit roles active on the election date', () => {
    const d = (s: string | null) => (s ? new Date(s) : null);
    const roles = [
      { party_id: 'BJP', role: 'state_president', person_id: 'a', person_name: 'A', from_date: d('2019-01-01'), to_date: d('2021-01-01') },
      { party_id: 'BJP', role: 'state_president', person_id: 'b', person_name: 'B', from_date: d('2021-01-02'), to_date: null },
      { party_id: 'INC', role: 'legislature_leader', person_id: null, person_name: 'C', from_date: null, to_date: null },
    ];
    expect(rolesAt(roles, '2020-11-10').map(r => r.name)).toEqual(['A', 'C']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx jest src/modules/constituencies/seat-analysis.loader.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the loader**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { earlierComparableElectionIds } from '../../common/comparable-elections';
import type { AllianceIn, AnalysisInput, ElectionIn, HeavyweightIn, HeavyweightReason, SeatIn, VoteSplitIn } from '../../common/seat-analysis';
import { ElectionNotFoundException } from '../../common/exceptions';

type Json = Record<string, unknown>;
const arr = (v: unknown): Json[] => (Array.isArray(v) ? v.filter((x): x is Json => !!x && typeof x === 'object') : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** What the analysis reads from a manifest (`elections.manifest_url` holds JSON text). Bad / missing JSON = empty. */
export function manifestBits(raw: string | null) {
  let m: Json = {};
  try { const v = raw ? JSON.parse(raw) : {}; if (v && typeof v === 'object' && !Array.isArray(v)) m = v; } catch { /* empty */ }
  const alliances: AllianceIn[] = arr(m.alliances).map(a => ({ id: String(a.id ?? ''), parties: Array.isArray(a.parties) ? a.parties.map(String) : [] })).filter(a => a.id);
  const g = m.government as Json | undefined;
  const government = g && Array.isArray(g.parties) && g.parties.length ? g.parties.map(String) : null;
  const voteSplits: VoteSplitIn[] = arr(m.vote_splits).filter(v => str(v.spoiler) && str(v.hurts))
    .map(v => ({ spoiler: String(v.spoiler), hurts: String(v.hurts), ...(str(v.label) ? { label: String(v.label) } : {}) }));
  const hw = (list: unknown, reason: HeavyweightReason): HeavyweightIn[] =>
    arr(list).filter(x => str(x.name)).map(x => ({ person_id: str(x.person_id), name: String(x.name), party_id: str(x.party_id), reason }));
  return { alliances, government, voteSplits, heavyweights: [...hw(m.leaders, 'leader'), ...hw(m.cabinet, 'cabinet')] };
}

interface RoleRow { party_id: string; role: string; person_id: string | null; person_name: string; from_date: Date | null; to_date: Date | null }
/** Party unit roles held on `date` (YYYY-MM-DD) as heavyweights. */
export function rolesAt(roles: RoleRow[], date: string): HeavyweightIn[] {
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  return roles
    .filter(r => (day(r.from_date) ?? '0000') <= date && (day(r.to_date) ?? '9999') >= date)
    .map(r => ({ person_id: r.person_id, name: r.person_name, party_id: r.party_id, reason: r.role as HeavyweightReason }));
}

@Injectable()
export class SeatAnalysisLoader {
  constructor(private readonly prisma: PrismaService) {}

  async load(electionId: string): Promise<AnalysisInput> {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId } });
    if (!election) throw new ElectionNotFoundException(electionId);
    const historyIds = (await earlierComparableElectionIds(this.prisma, election)).reverse(); // oldest → newest
    const prevAny = await this.prisma.elections.findFirst({
      where: { type: election.type, state_id: election.state_id, year: { lt: election.year } }, orderBy: { year: 'desc' }, select: { id: true },
    });
    const ids = [...new Set([...historyIds, electionId, ...(prevAny ? [prevAny.id] : [])])];
    const built = new Map((await Promise.all(ids.map(id => this.election(id)))).map(e => [e.id, e]));
    const bits = manifestBits(election.manifest_url);
    const current = built.get(electionId)!;
    const roles = election.state_id == null ? [] : await this.prisma.party_unit_roles.findMany({ where: { state_id: election.state_id } });
    const lineage = (await this.prisma.party_lineage.findMany()).map(r => ({
      party_id: r.party_id, predecessor_id: r.predecessor_id, kind: r.kind, effective_date: r.effective_date.toISOString().slice(0, 10),
      state_id: r.state_id, is_successor: r.is_successor,
    }));
    return {
      stateId: election.state_id,
      current,
      voteSplits: bits.voteSplits,
      heavyweights: [...bits.heavyweights, ...rolesAt(roles, current.date)],
      history: historyIds.map(id => built.get(id)!),
      previousAny: prevAny ? built.get(prevAny.id)! : null,
      lineage,
    };
  }

  private async election(id: string): Promise<ElectionIn> {
    const e = await this.prisma.elections.findUniqueOrThrow({ where: { id }, select: { id: true, year: true, tentative_next_date: true, manifest_url: true } });
    const consts = await this.prisma.constituencies.findMany({
      where: { election_id: id }, select: { id: true, const_no: true, type: true, region_id: true, voter_turnout: true },
    });
    const results = await this.prisma.results.findMany({
      where: { election_id: id },
      select: { const_id: true, votes: true, status: true, candidates: { select: { person_id: true, name: true, party_id: true } } },
    });
    const byConst = new Map<string, SeatIn['candidates']>();
    for (const r of results) {
      const list = byConst.get(r.const_id) ?? [];
      list.push({ person_id: r.candidates.person_id, name: r.candidates.name, party_id: r.candidates.party_id, votes: r.votes ?? 0, status: String(r.status) });
      byConst.set(r.const_id, list);
    }
    const bits = manifestBits(e.manifest_url);
    return {
      id: e.id, year: e.year, date: e.tentative_next_date ? e.tentative_next_date.toISOString().slice(0, 10) : `${e.year}-07-01`,
      seats: consts.map(c => ({
        const_id: c.id, const_no: c.const_no, reserved: String(c.type) as SeatIn['reserved'], region_id: c.region_id,
        turnout: c.voter_turnout == null ? null : Number(c.voter_turnout), candidates: byConst.get(c.id) ?? [],
      })),
      alliances: bits.alliances, government: bits.government,
    };
  }
}
```
Check the import path of `ElectionNotFoundException`: it is the one `constituencies.service.ts` already imports;
copy that import line exactly.

- [ ] **Step 4: Run the loader test**

Run: `cd backend && npx jest src/modules/constituencies/seat-analysis.loader.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the DB spec (failing)**

`seat-analysis.db.spec.ts`, following `ingest/ingest.db.spec.ts` (rolled back; skipped without a DB unless
`REQUIRE_DB_TESTS=1`):
```ts
/** SeatAnalysisService against the local DB (Bihar 2025); every write is rolled back. */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { SeatAnalysisService } from './seat-analysis.service';
import { SeatAnalysisLoader } from './seat-analysis.loader';

config({ path: join(__dirname, '../../../.env') });
class Rollback extends Error {}
const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('seat analysis compute (DB)', () => {
  let prisma: PrismaClient | null = null;
  let br25: string | null = null, br20: string | null = null;
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const c = new PrismaClient();
    try {
      await c.$queryRaw`SELECT 1 FROM election_analysis LIMIT 1`;
      const st = await c.states.findFirst({ where: { code: 'BR' }, select: { id: true } });
      br25 = (await c.elections.findFirst({ where: { state_id: st?.id, type: 'VS', year: 2025 }, select: { id: true } }))?.id ?? null;
      br20 = (await c.elections.findFirst({ where: { state_id: st?.id, type: 'VS', year: 2020 }, select: { id: true } }))?.id ?? null;
      prisma = c;
    } catch { await c.$disconnect(); }
  });
  afterAll(async () => prisma?.$disconnect());

  async function run(name: string, body: (svc: SeatAnalysisService, tx: any) => Promise<void>) {
    if (!prisma || !br25 || !br20) { if (REQUIRE_DB) throw new Error(`no DB (${name})`); console.warn(`SKIPPED (no DB): ${name}`); return; }
    await prisma.$transaction(async tx => {
      const db: any = new Proxy(tx, { get: (t: any, p) => (p === '$transaction' ? (fn: any) => fn(t) : t[p]) });
      const cache: any = { del: jest.fn(async () => undefined), getOrSet: async (_k: string, _t: number, f: () => unknown) => f() };
      await body(new SeatAnalysisService(db, new SeatAnalysisLoader(db), cache), tx);
      throw new Rollback();
    }, { timeout: 120_000 }).catch(e => { if (!(e instanceof Rollback)) throw e; });
  }

  it('Bihar 2025 compares with 2020 (not 2010), stores data + summary, purges caches', () => run('bihar', async (svc, tx) => {
    const r = await svc.compute(br25!);
    expect(r.computed).toBe(243);
    const row = await tx.constituency_analysis.findFirst({ where: { election_id: br25!, NOT: { data: { equals: null } } } });
    const data = row.data as any;
    expect(data.schema_version).toBe(1);
    expect(data.history.map((h: any) => h.year)).toEqual([...data.history.map((h: any) => h.year)].sort());
    const prevWinner = await tx.results.findFirst({ where: { election_id: br20!, status: 'WON', constituencies: { const_no: data.const_no } }, select: { candidates: { select: { name: true } } } });
    expect(data.incumbent?.name).toBe(prevWinner?.candidates.name);
    const summary = await tx.election_analysis.findUnique({ where: { election_id: br25! } });
    expect((summary!.data as any).prev_election_id).toBe(br20);
  }));

  it('a recompute keeps admin notes and gives the same rows', () => run('notes', async (svc, tx) => {
    await svc.compute(br25!);
    const row = await tx.constituency_analysis.findFirst({ where: { election_id: br25! } });
    await tx.constituency_analysis.update({ where: { id: row.id }, data: { notes: 'admin note' } });
    const before = (await tx.constituency_analysis.findUnique({ where: { id: row.id } })).data;
    await svc.compute(br25!);
    const after = await tx.constituency_analysis.findUnique({ where: { id: row.id } });
    expect(after.notes).toBe('admin note');
    expect(after.data).toEqual(before);
  }));
});
```
If the `results → constituencies` relation filter name differs in the Prisma client, query the 2020 seat by
`const_no` through `constituencies.findFirst` and then the result by `const_id`.

- [ ] **Step 6: Implement the service**

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService, CACHE_TTL } from '../redis/cache.service';
import { analyse, SCHEMA_VERSION, type ElectionAnalysis } from '../../common/seat-analysis';
import { SeatAnalysisLoader } from './seat-analysis.loader';

export const publicAnalysisKey = (id: string) => `election:${id}:public-analysis`;
export const analysisSummaryKey = (id: string) => `election:${id}:analysis-summary`;

/**
 * The one path that computes and stores the seat analysis (spec §4.5): the admin button, the compute endpoint, the CLI
 * and finalizing an election all call compute(). Upserts; never touches the admin-edited `notes`.
 */
@Injectable()
export class SeatAnalysisService {
  constructor(private readonly prisma: PrismaService, private readonly loader: SeatAnalysisLoader, private readonly cache: CacheService) {}

  async compute(electionId: string): Promise<{ computed: number }> {
    const { seats, election } = analyse(await this.loader.load(electionId));
    const rows = seats.map(s => ({ const_id: s.const_id, dominance: s.class?.kind ?? null, dominance_party: s.class?.holder ?? null, data: s }));
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`
        INSERT INTO constituency_analysis (const_id, election_id, dominance, dominance_party, data, schema_version, computed_at, updated_at)
        SELECT x->>'const_id', ${electionId}::uuid, x->>'dominance', x->>'dominance_party', x->'data', ${SCHEMA_VERSION}::smallint, now(), now()
        FROM jsonb_array_elements(${JSON.stringify(rows)}::jsonb) AS x
        ON CONFLICT (const_id, election_id) DO UPDATE SET
          dominance = EXCLUDED.dominance, dominance_party = EXCLUDED.dominance_party, data = EXCLUDED.data,
          schema_version = EXCLUDED.schema_version, computed_at = EXCLUDED.computed_at, updated_at = EXCLUDED.updated_at`;
      await tx.election_analysis.upsert({
        where: { election_id: electionId },
        create: { election_id: electionId, data: election as unknown as Prisma.InputJsonValue, schema_version: SCHEMA_VERSION },
        update: { data: election as unknown as Prisma.InputJsonValue, schema_version: SCHEMA_VERSION, computed_at: new Date() },
      });
    }, { timeout: 120_000 });
    await this.cache.del(publicAnalysisKey(electionId));
    await this.cache.del(analysisSummaryKey(electionId));
    return { computed: seats.length };
  }

  summary(electionId: string): Promise<ElectionAnalysis | null> {
    return this.cache.getOrSet(analysisSummaryKey(electionId), CACHE_TTL.PUBLIC_ANALYSIS, async () => {
      const row = await this.prisma.election_analysis.findUnique({ where: { election_id: electionId }, select: { data: true } });
      return (row?.data as unknown as ElectionAnalysis) ?? null;
    });
  }
}
```
Check `CacheService.getOrSet`'s exact signature and the export name of `CACHE_TTL` in `redis/cache.service.ts`, and
match them.

- [ ] **Step 7: Wire the module and delete the old engine**

- In `constituencies.module.ts`: add `SeatAnalysisLoader` and `SeatAnalysisService` to `providers` and `exports`, and
  remove the `ANALYSIS_STRATEGIES` provider and the strategy imports.
- In `constituencies.service.ts`: delete `computeAnalysis`, `extractConstNo` (if nothing else uses it), the strategies
  injection, and the `comparable-elections` / strategy imports that become unused.
- `git rm -r backend/src/modules/constituencies/strategies`.
- In `constituencies.service.spec.ts`: delete the `computeAnalysis` tests (the module and DB specs replace them).
  Keep the rest.
- `lineage.spec.ts` and `dominance.strategy.spec.ts` / `seat-history.strategy.spec.ts` go with the folder. Their
  cases are covered by Task 2's tests (merger carry, split, class, history).

- [ ] **Step 8: Run backend tests**

Run: `cd backend && npx tsc --noEmit && npm run test:unit && REQUIRE_DB_TESTS=1 npx jest --runInBand src/modules/constituencies/seat-analysis.db.spec.ts`
Expected: `tsc` passes except the `incumbency` call sites Task 7 rewrites (`updateAnalysis`, `getPublicAnalysis`,
admin DTOs). If those block the run, do Task 7 Step 3 first, then rerun. Unit tests pass, and the DB spec passes
(needs the local DB with migration 024).

- [ ] **Step 9: Commit**

```bash
git add -A backend/src/modules/constituencies
git commit -m "feat(analysis): SeatAnalysisService: one compute path (loader → shared module → upsert), notes kept; old strategies removed"
```

---

### Task 7: API: triggers, public endpoints, legacy adapter, admin card, CLI

**Files:**
- Create: `backend/src/modules/constituencies/legacy-analysis.ts` (+ `legacy-analysis.spec.ts`)
- Modify:
  - `backend/src/modules/constituencies/constituencies.service.ts` (`getPublicAnalysis`,
    `getConstituencyAnalysisDetail`, `updateAnalysis`)
  - `backend/src/modules/constituencies/dto/constituency-input.dto.ts` (`UpdateAnalysisDto`: `notes` only; delete the
    compute body DTO)
  - `backend/src/modules/admin/dto/admin-response.dto.ts` (`AdminAnalysisDto`: add `data`, `computed_at`; drop
    `incumbency`)
  - `backend/src/modules/admin/controllers/admin-constituencies.controller.ts` (compute calls
    `SeatAnalysisService.compute`, no body)
  - `backend/src/modules/admin/controllers/admin-elections.controller.ts` (compute on finalize / update to Finalized)
  - `backend/src/modules/elections/elections.controller.ts` (`GET :id/analysis/summary`)
  - `admin/src/types/index.ts`, `admin/src/components/entity/constituencies/ConstituencyAnalysisCard.tsx`,
    `admin/src/hooks/useConstituencyManager.ts`
  - `scraper/src/recompute-analysis-cli.ts`

**Interfaces:**
- Consumes: `SeatAnalysisService.compute`, `.summary`, `publicAnalysisKey` (Task 6); `SeatAnalysis` type.
- Produces:
  - `GET /elections/:id/analysis` → `{ id, const_id, election_id, dominance, dominance_party, data, incumbency }[]`
    (`incumbency` = legacy shape built from `data`, for one release);
  - `GET /elections/:id/constituencies/:constId/analysis` → the row with `data`, `notes`, legacy `incumbency`;
  - `GET /elections/:id/analysis/summary` → `ElectionAnalysis | null`.

- [ ] **Step 1: Write the legacy adapter test**

```ts
import { legacyIncumbency } from './legacy-analysis';

describe('legacy analysis adapter (one release)', () => {
  it('maps SeatAnalysis to the old incumbency JSON', () => {
    const data: any = {
      winner: { party_id: 'BJP', name: 'R' }, margin: 500, seat_type: 'two-way',
      outcome: { kind: 'gained', from: 'RJD', from_raw: 'RJD' },
      class: { kind: 'swing', holder: 'BJP', streak: 1, since: 2025, wins: 1, total: 4 },
      incumbent: { name: 'S', party: 'RJD', recontested: true, switched: false, followed_split: false, won: false, party_now: 'RJD' },
      history: [{ year: 2020, party: 'RJD', candidate: 'S', margin: 10, vote_share: 40, runner_up: 'R', runner_up_party: 'BJP' }],
      notes: [{ kind: 'spoiler', name: 'C', party: 'AIMIM', votes: 900, margin: 500, hurts: 'MGB', label: 'AIMIM split' }],
    };
    expect(legacyIncumbency(data)).toEqual({
      incumbent_name: 'S', incumbent_party: 'RJD', re_contesting: true, won: false,
      swing: { prev_party: 'RJD', curr_party: 'BJP', flipped: true, split: false, margin: 500 },
      seat_type: 'two-way', dominance_wins: 1, dominance_total: 4,
      seat_history: [{ year: 2020, party: 'RJD', candidate: 'S', margin: 10, vote_share: 40, runner_up: 'R', runner_up_party: 'BJP' }],
      spoiler: { spoiler_party: 'AIMIM', spoiler_votes: 900, winner_margin: 500, hurts_alliance: 'MGB', label: 'AIMIM split' },
    });
    expect(legacyIncumbency(null)).toEqual({});
  });
});
```

- [ ] **Step 2: Implement `legacy-analysis.ts` and run the test**

```ts
import type { SeatAnalysis } from '../../common/seat-analysis';

/**
 * The pre-024 `incumbency` JSON built from the new SeatAnalysis, so a frontend deployed before this backend keeps
 * working. Remove in the follow-up release (spec §4.5 "Compatibility").
 */
export function legacyIncumbency(d: SeatAnalysis | null): Record<string, unknown> {
  if (!d) return {};
  const inc = d.incumbent;
  const sp = d.notes.find(n => n.kind === 'spoiler' && n.hurts) as Extract<SeatAnalysis['notes'][number], { kind: 'spoiler' }> | undefined;
  return {
    ...(inc ? { incumbent_name: inc.name, incumbent_party: inc.party, re_contesting: inc.recontested, ...(inc.won != null ? { won: inc.won } : {}),
      ...(inc.switched ? { switched_to: inc.party_now } : {}), ...(inc.followed_split ? { followed_split: inc.party_now } : {}) } : {}),
    ...(d.outcome && d.outcome.kind !== 'new' && d.winner
      ? { swing: { prev_party: d.outcome.from_raw, curr_party: d.winner.party_id, flipped: d.outcome.kind === 'gained', split: d.outcome.kind === 'split', margin: d.margin ?? 0 } } : {}),
    seat_type: d.seat_type,
    dominance_wins: d.class?.wins ?? 0,
    dominance_total: d.class?.total ?? 0,
    seat_history: d.history.map(h => ({ year: h.year, party: h.party, candidate: h.candidate, margin: h.margin, vote_share: h.vote_share, runner_up: h.runner_up, runner_up_party: h.runner_up_party })),
    ...(sp ? { spoiler: { spoiler_party: sp.party, spoiler_votes: sp.votes, winner_margin: sp.margin, hurts_alliance: sp.hurts, label: sp.label } } : {}),
  };
}
```
Run: `cd backend && npx jest src/modules/constituencies/legacy-analysis.spec.ts`. Expected: PASS.

- [ ] **Step 3: Rewrite the read/update paths in `constituencies.service.ts`**

```ts
  async getPublicAnalysis(electionId: string) {
    return this.cache.getOrSet(publicAnalysisKey(electionId), CACHE_TTL.PUBLIC_ANALYSIS, async () => {
      const rows = await this.prisma.constituency_analysis.findMany({
        where: { election_id: electionId },
        select: { id: true, const_id: true, election_id: true, dominance: true, dominance_party: true, data: true },
      });
      return rows.map(r => ({ ...r, incumbency: legacyIncumbency(r.data as unknown as SeatAnalysis | null) }));
    });
  }

  async getConstituencyAnalysisDetail(electionId: string, constId: string) {
    const r = await this.prisma.constituency_analysis.findUnique({ where: { const_id_election_id: { const_id: constId, election_id: electionId } } });
    return r ? { ...r, incumbency: legacyIncumbency(r.data as unknown as SeatAnalysis | null) } : null;
  }
```
`updateAnalysis(id, body)` now writes only `notes` (+ `updated_at`) and purges `publicAnalysisKey`. `UpdateAnalysisDto`
becomes `{ @IsOptional() @IsString() notes?: string | null }`. Delete the compute body DTO (`history_election_ids`,
`manifest`). In `AdminAnalysisDto`, replace `incumbency` with `data` and `computed_at`.

- [ ] **Step 4: Triggers**

`admin-constituencies.controller.ts`:
```ts
  @Post('analysis/compute/:electionId')
  @Roles('SUPER_ADMIN', 'EDITOR')
  computeAnalysis(@Param('electionId', ParseUUIDPipe) electionId: string) {
    return this.seatAnalysis.compute(electionId);
  }
```
(Inject `SeatAnalysisService` in the constructor. Keep the existing decorators and route path; drop `@Body()`.)

`admin-elections.controller.ts`: compute after a transition to Finalized. A compute failure is logged and never
undoes the finalize:
```ts
  private readonly logger = new Logger(AdminElectionsController.name);

  /** Finalizing stores the final seat analysis (spec §4.5); a failure is logged, the finalize stands. */
  private async computeIfFinalized(id: string, before: string, after: string): Promise<void> {
    if (after !== 'Finalized' || before === 'Finalized') return;
    try { await this.seatAnalysis.compute(id); } catch (e) { this.logger.error(`seat analysis for ${id} failed: ${(e as Error).message}`); }
  }
```
In `finalizeElection`: read the status before (`await this.electionsService.findOne(id)`), call `finalize`, then
`await this.computeIfFinalized(id, before.status, 'Finalized')`, then `afterElectionChange`. Do the same in
`updateElection`, with `body.status ?? before.status` as `after`. Import `ConstituenciesModule` into the admin module
if `SeatAnalysisService` is not yet resolvable there.

Add a unit test in the admin elections controller spec (or create `admin-elections.controller.spec.ts` if none
exists) with mocked services:
```ts
it('finalize computes the seat analysis once; a compute failure does not fail the finalize', async () => {
  const seatAnalysis = { compute: jest.fn().mockRejectedValueOnce(new Error('boom')) };
  const electionsService = { findOne: jest.fn().mockResolvedValue({ status: 'Live' }), finalize: jest.fn().mockResolvedValue({ id: 'e', status: 'Finalized' }) };
  const ctrl = new AdminElectionsController(electionsService as any, /* other deps as mocks */ ...mocks, seatAnalysis as any);
  await expect(ctrl.finalizeElection('e')).resolves.toMatchObject({ status: 'Finalized' });
  expect(seatAnalysis.compute).toHaveBeenCalledWith('e');
});
```
(Match the real constructor's parameter order. Use `{}` mocks with the methods `afterElectionChange` calls:
`liveState.invalidate`, `resultsService.purgeElectionCache`.)

- [ ] **Step 5: Summary endpoint**

`elections.controller.ts`, next to `@Get(':id/analysis')`:
```ts
  /** Per-election seat analysis (party rows, seat flow, alliance change, close seats, bellwethers, breakdowns). */
  @Get(':id/analysis/summary')
  getAnalysisSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.seatAnalysis.summary(id);
  }
```
Declare it **before** any `:id/analysis/:x` style route if one exists, so Nest matches it. Inject `SeatAnalysisService`
(exported by `ConstituenciesModule`; check that `ElectionsModule` imports it).

- [ ] **Step 6: Admin card, button, types, CLI**

- `admin/src/types/index.ts`: in `ConstituencyAnalysis`, replace `incumbency` with
  `data: { class?: { kind: string; holder: string; streak: number; since: number } | null; incumbent?: { name: string; party: string | null; recontested: boolean; switched: boolean; party_now: string | null } | null; outcome?: { kind: string; from: string | null } | null } | null;`
  and add `computed_at?: string | null`.
- `ConstituencyAnalysisCard.tsx`:
  - rows are **Class** (`Stronghold · BJP since 2010`), **Outcome** (`Gained from RJD` / `Retained` / `Split from SHS`
    / `New`), **Incumbent** (name + party), **Re-contesting**, **Switched to**;
  - the subtitle uses `computed_at ?? updated_at`;
  - keep the notes display;
  - update `admin/src/components/entity/constituencies/*.test.tsx` fixtures that build `incumbency`.
- `admin/src/hooks/useConstituencyManager.ts`: the compute call posts with no body.
- `scraper/src/recompute-analysis-cli.ts`:
  - delete the manifest / history assembly;
  - post `/admin/constituencies/analysis/compute/${e.id}` with `{ method: 'POST' }`;
  - log `computed`;
  - filter out elections with `status === 'Upcoming'` (as today).

- [ ] **Step 7: Run everything**

Run: `cd backend && npx tsc --noEmit && npm run test:unit` then `cd ../admin && npx vitest run && npx tsc --noEmit -p tsconfig.app.json`
Expected: all PASS. Then manually, with the backend dev server running:
`curl -s localhost:3082/api/v1/elections/<BR2025 id>/analysis/summary | head -c 400` returns JSON with `parties`.

- [ ] **Step 8: Commit**

```bash
git add -A backend/src admin/src scraper/src/recompute-analysis-cli.ts
git commit -m "feat(analysis): compute on finalize, summary endpoint, legacy adapter, admin card on the new data, CLI without history"
```

---

### Task 8: Frontend reads `data`; `anti_incumbency` class removed

**Files:**
- Modify:
  - `frontend/src/model/types/index.ts` (`AnalysisEntry`, `ConstituencyAnalysisDetail`)
  - `frontend/src/viewmodels/data/useAnalysis.ts`
  - `frontend/src/model/derive/seatView.ts` (`seatHistory`, `seatNotes`)
  - `frontend/src/viewmodels/pages/useConstituencyPageVM.ts` (`SEAT_CLASSES`)
  - any view or i18n key that rendered the `anti_incumbency` seat class on the constituency page
- Test: `frontend/src/model/derive/__tests__/seatView.test.ts`, `frontend/src/viewmodels/__tests__/constituencyPageVM.test.tsx`,
  `frontend/src/viewmodels/__tests__/fixtures.ts`, new `frontend/src/viewmodels/__tests__/useAnalysis.test.ts`

**Interfaces:**
- Consumes: `SeatAnalysis` type from `model/derive/seatAnalysis`.
- Produces: the same `useAnalysis` return shape as today (`dominanceMap`, `incumbencyData`, `partySwitchData`,
  `swingMap`, `spoilerMap`, `seatTypeMap`), so tiles and layers stay unchanged.

- [ ] **Step 1: Types**

```ts
import type { SeatAnalysis } from '../derive/seatAnalysis';
export interface AnalysisEntry {
  id: string;
  const_id: string;
  election_id: string;
  dominance: string | null;
  dominance_party: string | null;
  /** Shared-module SeatAnalysis (migration 024); null until computed. Missing on an older backend. */
  data?: SeatAnalysis | null;
}
```
(`ConstituencyAnalysisDetail` keeps `notes`.) If `lint` forbids `model/types` importing from `model/derive`, move the
import so it is allowed. Both are `model/`, so it should pass; if not, re-export the type from `model/types`.

- [ ] **Step 2: Write the failing mapping test `useAnalysis.test.ts`**

Extract the mapping into a pure function so it can be tested: `export function mapAnalysis(rows: AnalysisEntry[])` in
`viewmodels/data/useAnalysis.ts`. The hook calls it inside one `useMemo`.
```ts
import { describe, it, expect } from 'vitest';
import { mapAnalysis } from '../data/useAnalysis';

const data: any = {
  winner: { party_id: 'BJP', name: 'R' }, margin: 500, seat_type: 'three-way',
  outcome: { kind: 'gained', from: 'RJD', from_raw: 'RJD' },
  class: { kind: 'swing', holder: 'BJP', streak: 1, since: 2025, wins: 1, total: 4 },
  incumbent: { name: 'S', party: 'RJD', won: false },
  history: [{ year: 2020, party: 'RJD', margin: 10 }, { year: 2025, party: 'BJP', margin: 500 }],
  notes: [{ kind: 'spoiler', name: 'C', party: 'AIMIM', votes: 900, margin: 500, hurts: 'MGB', label: 'AIMIM split' },
          { kind: 'switcher', name: 'R', from: 'JDU', to: 'BJP', year: 2020, match: 'person' }],
};
const rows: any[] = [{ id: '1', const_id: 'BR_1', election_id: 'e', dominance: 'swing', dominance_party: 'BJP', data }, { id: '2', const_id: 'BR_2', election_id: 'e', dominance: null, dominance_party: null }];

describe('mapAnalysis', () => {
  it('maps data into the dashboard maps; rows without data are skipped', () => {
    const m = mapAnalysis(rows);
    expect(m.dominanceMap.get('BR_1')).toEqual({ constId: 'BR_1', winners: [{ party: 'RJD' }, { party: 'BJP' }], classification: 'swing', dominantParty: 'BJP', streak: 1 });
    expect(m.swingMap.get('BR_1')).toEqual({ constId: 'BR_1', currentParty: 'BJP', prevParty: 'RJD', currentMargin: 500, prevMargin: 10, flipped: true, split: false });
    expect(m.incumbencyData).toEqual([{ constId: 'BR_1', incumbentName: 'S', incumbentParty: 'RJD', won: false, currentMargin: 500 }]);
    expect(m.partySwitchData).toEqual([{ constId: 'BR_1', candidateName: 'R', fromParty: 'JDU', toParty: 'BJP', fromYear: 2020, toYear: 2025, wonInNewParty: true, margin: 500 }]);
    expect(m.spoilerMap.get('BR_1')).toEqual({ spoilerParty: 'AIMIM split', spoilerVotes: 900, winnerMargin: 500, hurtsAlliance: 'MGB' });
    expect(m.seatTypeMap.get('BR_1')).toBe('three-way');
    expect(m.dominanceMap.has('BR_2')).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd frontend && npx vitest run src/viewmodels/__tests__/useAnalysis.test.ts`
Expected: FAIL (`mapAnalysis` not exported).

- [ ] **Step 4: Implement `mapAnalysis` and use it in the hook**

```ts
export function mapAnalysis(rows: AnalysisEntry[] | null) {
  const dominanceMap = new Map<string, DominanceEntry>();
  const swingMap = new Map<string, SwingEntry>();
  const spoilerMap = new Map<string, { spoilerParty: string; spoilerVotes: number; winnerMargin: number; hurtsAlliance: string }>();
  const seatTypeMap = new Map<string, 'two-way' | 'three-way' | 'multi-cornered'>();
  const incumbencyData: IncumbencyEntry[] = [];
  const partySwitchData: PartySwitchEntry[] = [];
  for (const a of rows ?? []) {
    const d = a.data;
    if (!d) continue;
    const id = a.const_id;
    const year = d.history[d.history.length - 1]?.year ?? 0;
    if (d.class) dominanceMap.set(id, { constId: id, winners: d.history.map(h => ({ party: h.party ?? '' })), classification: d.class.kind, dominantParty: d.class.holder, streak: d.class.streak });
    if (d.outcome && d.outcome.kind !== 'new' && d.winner?.party_id && d.outcome.from_raw) {
      swingMap.set(id, { constId: id, currentParty: d.winner.party_id, prevParty: d.outcome.from_raw, currentMargin: d.margin ?? 0,
        prevMargin: d.history[d.history.length - 2]?.margin ?? 0, flipped: d.outcome.kind === 'gained', split: d.outcome.kind === 'split' });
    }
    if (d.incumbent) incumbencyData.push({ constId: id, incumbentName: d.incumbent.name, incumbentParty: d.incumbent.party ?? '', won: !!d.incumbent.won, currentMargin: d.margin ?? 0 });
    for (const n of d.notes) {
      if (n.kind === 'switcher') partySwitchData.push({ constId: id, candidateName: n.name, fromParty: n.from, toParty: n.to, fromYear: n.year, toYear: year, wonInNewParty: d.winner?.name === n.name, margin: d.margin ?? 0 });
      if (n.kind === 'spoiler' && n.hurts) spoilerMap.set(id, { spoilerParty: n.label || n.party || n.name, spoilerVotes: n.votes, winnerMargin: n.margin, hurtsAlliance: n.hurts });
    }
    if (d.seat_type) seatTypeMap.set(id, d.seat_type);
  }
  return { dominanceMap, incumbencyData, partySwitchData, swingMap, spoilerMap, seatTypeMap };
}
```
`useAnalysis` becomes: `const maps = useMemo(() => mapAnalysis(analysisData), [analysisData]); return { ...maps, loading };`.
With an older backend (no `data`), every map is empty, and the dashboard's existing fallback
(`useDashboardSources.ts:73`, `ba.*.size > 0 ? ba : ha`) uses the client engine. That is the intended behaviour
during the deploy window.

- [ ] **Step 5: `seatView.ts`**

```ts
export function seatHistory(analysis: AnalysisEntry | null, currentYear: number): SeatHistoryEntry[] {
  const list = analysis?.data?.history ?? [];
  return list.filter(h => h.year !== currentYear).sort((a, b) => b.year - a.year)
    .map(h => ({ year: h.year, party: h.party ?? '', candidate: h.candidate, margin: h.margin ?? 0, vote_share: h.vote_share, runner_up: h.runner_up, runner_up_party: h.runner_up_party, unopposed: !h.runner_up && !h.margin }));
}
```
(Match `SeatHistoryEntry`'s field names and types; read its definition and keep the mapping to it.) In `seatNotes`,
the spoiler comes from
`analysis?.data?.notes.find(n => n.kind === 'spoiler' && n.hurts)` → `{ kind: 'spoiler', party: n.label || n.party || n.name, votes: n.votes, margin: n.margin }`.
The client-side `threeWay` note stays as it is.

Update `seatView.test.ts` and `viewmodels/__tests__/fixtures.ts` (+ `constituencyPageVM.test.tsx`) to build `data`
instead of `incumbency.seat_history` / `incumbency.spoiler`, keeping the same expected outputs.

- [ ] **Step 6: Remove the `anti_incumbency` seat class**

In `useConstituencyPageVM.ts`: `export const SEAT_CLASSES = ['stronghold', 'loyal', 'swing', 'new'] as const;`.
Remove its label usage from `views/constituency/ConstituencyPageView.tsx`, if any. Remove an i18n key only if nothing
else uses it: `layerInsights.ts`'s `anti_incumbency` **chip** stays (it comes from incumbency, not the class), so keep
any key the chip uses. Run `npx vitest run src/__tests__/i18n.test.ts`.

- [ ] **Step 7: Run frontend checks**

Run: `cd frontend && npx vitest run && npx tsc --noEmit -p tsconfig.app.json && npm run lint`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add -A frontend/src
git commit -m "feat(analysis): frontend reads constituency_analysis.data (dashboard maps, seat history, spoiler); anti_incumbency class removed"
```

---

### Task 9: `government` data, seed and editor check

**Files:**
- Create: `scraper/data/government.json`, `scraper/src/government-cli.ts`, `database/seed_election_government.sql` (generated)
- Modify: `database/setup.sh` (run the seed after `seed_election_delimitation.sql`)
- Test: `scraper/src/government-cli.spec.ts` (or the scraper's existing test runner; check `scraper/package.json`);
  `admin/src/components/entity/manifests/ManifestPanel.test.tsx` (or the closest existing manifest test)

**Interfaces:**
- Produces: manifest key `government: { parties: string[]; label?: string; source: string }` on every seeded VS
  election (read by `manifestBits`, Task 6).

- [ ] **Step 1: Compile `scraper/data/government.json`**

One entry for each of the 76 VS elections listed by
`psql "$DATABASE_URL" -At -c "select s.code, e.year from elections e join states s on s.id=e.state_id where e.type='VS' order by 1,2"`:
```json
[
  { "state": "BR", "year": 2025, "parties": ["BJP", "JDU", "LJPRV", "HAMS", "RLM"], "label": "NDA", "source": "https://en.wikipedia.org/wiki/2025_Bihar_Legislative_Assembly_election" }
]
```
**Rule (spec §4.3):** the parties that formed the government after these results: the first government that took
office and was not out before its floor test. Count only parties holding ministries or formally part of the ruling
coalition; outside support doesn't count. Later re-alignments don't count. Known traps:
- **MH 2019:** Fadnavis' 3-day government resigned before the floor test, so the first government is MVA (SHS, NCP,
  INC). For **MH 2024**, the ids follow lineage: SHS (Shinde) and NCP (Ajit) are the name-holders.
- **BR 2015:** MGB (JDU, RJD, INC). The 2017 switch is not recorded.
- **JK 2014:** PDP + BJP (formed after Governor's rule in 2015, but it was the first government). For **JK 2008**,
  JKNC + INC.
- **DL 2013:** AAP with outside INC support → `["AAP"]`.
- **Hung houses** (GA 2017, MN 2017, MH 2019): use whoever formed the government.

Use party ids exactly as in the `parties` table for that election (check with
`select distinct party_id from candidates where election_id = …`). Use the Wikipedia article of each election (or
of the ministry) as the `source`. Where knowledge is uncertain, use WebSearch / WebFetch to confirm before writing
the entry.

- [ ] **Step 2: Write the generator test (failing)**

```ts
import { renderGovernmentSeed, validate } from './government-cli';

describe('government seed', () => {
  const rows = [{ state: 'BR', year: 2025, parties: ['BJP', 'JDU'], label: 'NDA', source: 'https://x' }];
  it('renders a fill-only update of the published manifest and a pending draft', () => {
    const sql = renderGovernmentSeed(rows);
    expect(sql).toContain(`('BR', 2025, '{"parties":["BJP","JDU"],"label":"NDA","source":"https://x"}'::jsonb)`);
    expect(sql).toContain(`NOT (e.manifest_url::jsonb ? 'government')`);
    expect(sql).toContain(`NOT (e.manifest_draft ? 'government')`);
    expect(sql).not.toMatch(/TRUNCATE|DELETE/i);
  });
  it('rejects duplicates, empty parties and a missing source', () => {
    expect(() => validate([...rows, ...rows])).toThrow(/duplicate BR 2025/);
    expect(() => validate([{ ...rows[0], parties: [] }])).toThrow(/no parties/);
    expect(() => validate([{ ...rows[0], source: '' }])).toThrow(/no source/);
  });
});
```

- [ ] **Step 3: Implement `government-cli.ts`**

```ts
/**
 * Generates database/seed_election_government.sql from scraper/data/government.json: manifest key `government` (the
 * parties that formed the government after each VS election; spec 2026-10-07-seat-analysis-design.md §4.3).
 * Fill-only: sets the key where the published manifest (and a pending draft) has none, so admin edits win.
 * Usage: npx ts-node src/government-cli.ts
 */
import * as fs from 'fs';
import * as path from 'path';

export interface GovRow { state: string; year: number; parties: string[]; label?: string; source: string }

export function validate(rows: GovRow[]): void {
  const seen = new Set<string>();
  for (const r of rows) {
    const k = `${r.state} ${r.year}`;
    if (seen.has(k)) throw new Error(`duplicate ${k}`);
    seen.add(k);
    if (!r.parties?.length) throw new Error(`${k}: no parties`);
    if (!r.source) throw new Error(`${k}: no source`);
  }
}

const q = (s: string) => s.replace(/'/g, "''");

export function renderGovernmentSeed(rows: GovRow[]): string {
  validate(rows);
  const values = rows.map(r => `  ('${q(r.state)}', ${r.year}, '${q(JSON.stringify({ parties: r.parties, ...(r.label ? { label: r.label } : {}), source: r.source }))}'::jsonb)`).join(',\n');
  const from = `FROM (VALUES\n${values}\n) AS g(code, year, gov)\nJOIN states s ON s.code = g.code`;
  return `-- Generated by scraper/src/government-cli.ts from scraper/data/government.json. Do not edit by hand.
-- Manifest key "government": the parties that formed the government after each VS election (bellwether seats).
-- Fill-only: only where the manifest has no "government" key, so an admin's edit is never overwritten.
UPDATE elections e SET manifest_url = jsonb_set(e.manifest_url::jsonb, '{government}', g.gov)::text
${from}
WHERE e.state_id = s.id AND e.year = g.year AND e.type = 'VS' AND e.manifest_url IS NOT NULL
  AND NOT (e.manifest_url::jsonb ? 'government');

UPDATE elections e SET manifest_draft = jsonb_set(e.manifest_draft, '{government}', g.gov)
${from}
WHERE e.state_id = s.id AND e.year = g.year AND e.type = 'VS' AND e.manifest_draft IS NOT NULL
  AND NOT (e.manifest_draft ? 'government');
`;
}

if (require.main === module) {
  const rows = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/government.json'), 'utf8')) as GovRow[];
  fs.writeFileSync(path.resolve(__dirname, '../../database/seed_election_government.sql'), renderGovernmentSeed(rows));
  console.log(`${rows.length} elections`);
}
```

- [ ] **Step 4: Run the test, generate, wire into setup.sh, apply locally twice**

Run: `cd scraper && npx jest src/government-cli.spec.ts` (or the runner `scraper/package.json` defines). Expected:
PASS.
Run: `npx ts-node src/government-cli.ts`. Expected: `76 elections`.
In `database/setup.sh`, add `run seed_election_government.sql` on the line after `run seed_election_delimitation.sql`.
Apply: `for i in 1 2; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seed_election_government.sql; done`.
Check:
`psql "$DATABASE_URL" -At -c "select count(*) from elections where type='VS' and manifest_url::jsonb ? 'government'"` → `76`.
Check party ids exist:
`psql "$DATABASE_URL" -At -c "select e.year, p from elections e, jsonb_array_elements_text(e.manifest_url::jsonb->'government'->'parties') p where not exists (select 1 from parties where id = p)"` → no rows.

- [ ] **Step 5: The manifest editor keeps `government` (Review Focus 5)**

Read `admin/src/components/entity/manifests/ManifestPanel.tsx` and its save path. Add a test: render the panel with a
manifest containing `government`, edit another field (or save unchanged), and assert the payload sent to the save API
still has `government`. If the editor rebuilds the manifest from known fields only, fix it to spread the original
object (`{ ...original, ...edited }`) so unknown keys survive.

- [ ] **Step 6: Commit**

```bash
git add scraper/data/government.json scraper/src/government-cli.ts scraper/src/government-cli.spec.ts database/seed_election_government.sql database/setup.sh admin/src
git commit -m "feat(data): manifest government for every VS election (fill-only seed) for bellwether seats"
```

---

### Task 10: Local full recompute, spot checks, docs

**Files:**
- Modify: `docs/FEATURES.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-07-seat-analysis-design.md` (spec
  corrections below), `docs/superpowers/specs/2026-10-06-party-page-notes.md` (§8 note), `docs/DEPLOYMENT.md` (the
  deferred-analysis notes)

- [ ] **Step 1: Recompute every VS election locally**

Run (backend dev server on :3082, a local admin user):
`cd scraper && ADMIN_EMAIL=… ADMIN_PASSWORD=… npx ts-node src/recompute-analysis-cli.ts --type VS`
Expected: 76 lines, each with a seat count, and no error.

- [ ] **Step 2: Spot-check with SQL**

```bash
U=$DATABASE_URL
# Bihar 2025 previous = 2020
psql "$U" -At -c "select data->>'prev_election_id' = (select e.id::text from elections e join states s on s.id=e.state_id where s.code='BR' and e.type='VS' and e.year=2020) from election_analysis a join elections e on e.id=a.election_id join states s on s.id=e.state_id where s.code='BR' and e.year=2025"   # t
# Redraw: AS 2026 / JK 2024 have no seat-level history but compare party totals
psql "$U" -At -c "select s.code, e.year, data->>'prev_election_id', data->>'prev_any_election_id' is not null, jsonb_array_length(data->'flow') from election_analysis a join elections e on e.id=a.election_id join states s on s.id=e.state_id where (s.code,e.year) in (('AS',2026),('JK',2024))"   # prev null, t, 0
# MH 2024: split seats exist; JH 2024: no seat "gained" from JVM
psql "$U" -At -c "select count(*) from constituency_analysis c join elections e on e.id=c.election_id join states s on s.id=e.state_id where s.code='MH' and e.year=2024 and c.data->'outcome'->>'kind'='split'"   # > 0
psql "$U" -At -c "select count(*) from constituency_analysis c join elections e on e.id=c.election_id join states s on s.id=e.state_id where s.code='JH' and e.year=2024 and c.data->'outcome'->>'from_raw'='JVM'"   # 0 (JVM's last election was 2014; 2019's previous is 2014)
# Every row has data
psql "$U" -At -c "select count(*) from constituency_analysis c join elections e on e.id=c.election_id where e.type='VS' and c.data is null"   # 0
```
Record the outputs in the task report. If one is wrong, fix the module (with a test reproducing it), then recompute.

- [ ] **Step 3: Click through**

Run the frontend (`cd frontend && npm run dev`) and check:
- the Bihar 2025 dashboard: the Swing and History layers and Summary tabs;
- a Bihar 2025 constituency page: seat history and class;
- MH 2024: a split seat's dialog;
- admin: a constituency record's Analysis card.

Run `cd frontend && npm run e2e` (dev servers running). Expected: green.

- [ ] **Step 4: Docs**

- **`docs/FEATURES.md`:** replace the seat analysis section with:
  - the shared module (identical files, `lineage.ts` per side);
  - baseline / live / final (live and baseline in Phase B);
  - what is stored (`constituency_analysis.data`, `election_analysis`);
  - triggers (finalize, button, endpoint, CLI);
  - `GET /elections/:id/analysis/summary`;
  - person matching and its limits;
  - the `government` field.

  Delete the stale "recompute pending" / "admin button sends no history" notes (`FEATURES.md:200`, `:321`, `:729`).
- **`CLAUDE.md`:**
  - in Database Setup: "Migration 024: `constituency_analysis.data` + `election_analysis`; the seat analysis is the
    shared module `backend/src/common/seat-analysis/` = `frontend/src/model/derive/seatAnalysis/` (identical except
    `lineage.ts`; tests enforce); computed only by `SeatAnalysisService.compute` (finalize, admin button, CLI)";
  - in the seed order: `seed_election_government.sql` after `seed_election_delimitation.sql`.
- **Spec corrections** (in `2026-10-07-seat-analysis-design.md`):
  - seat type values are `'two-way' | 'three-way' | 'multi-cornered'`;
  - `government` is `{ parties: string[], label?, source }` (a post-poll coalition fits);
  - it is edited through the admin manifest editor (JSON tab), not the election dialog;
  - the browser-side engine swap (§4.6, second bullet) moves to Phase B with the baseline, and until then
    `useHistoryAnalysis` remains the fallback for non-Finalized elections;
  - the admin card shows `notes` (editable through `PATCH`; no editor UI).
  - incumbency has no separate `denied` field: `recontested: false` means not a candidate anywhere.
- **`DEPLOYMENT.md`:** replace the deferred-analysis notes with a pointer to Task 11's rollout.
- **Party page notes §8:** item 4 reads `election_analysis` (held / gained / lost, flow).

- [ ] **Step 5: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs: seat analysis rework (Phase A): features, CLAUDE.md, spec corrections, deployment notes"
```

---

### Task 11: Production rollout (each step needs the user's go-ahead)

No code. The executor stops before each production action, asks the user and reports the result.

- [ ] **Step 1:** Push `main` (Render auto-deploys the backend, Vercel the frontend and admin). Check
  `/api/v1/health/ready` and that `GET /elections/<BR2025>/analysis` still returns rows with `incumbency` (legacy
  adapter; `data` is null until recompute).
- [ ] **Step 2:** On the Neon project `matdaanpulse`, check
  `select count(*) from constituency_analysis where notes is not null and notes <> ''`. If any rows have notes, list
  them for the user. (The upsert keeps them anyway.)
- [ ] **Step 3:** Take a Neon snapshot / branch of production (backup).
- [ ] **Step 4:** Confirm the deploy ran `setup.sh` (migration 024 + `seed_election_government.sql`):
  `select count(*) from elections where type='VS' and manifest_url::jsonb ? 'government'` = 76. If the deploy does not
  run `setup.sh`, run it as `docs/DEPLOYMENT.md` describes.
- [ ] **Step 5:** Recompute once:
  `cd scraper && API_BASE_URL=https://matdaanpulse-api.onrender.com/api/v1 ADMIN_EMAIL=… ADMIN_PASSWORD=… npx ts-node src/recompute-analysis-cli.ts --type VS`.
- [ ] **Step 6:** Re-run Task 10 Step 2's SQL against production, and click through the Bihar 2025 dashboard and one
  constituency page on `matdaanpulse.vercel.app`.
- [ ] **Step 7:** Update memory (`party-model-phase` / seat analysis status) and tell the user Phase A is live. The
  legacy adapter removal is a follow-up release.
