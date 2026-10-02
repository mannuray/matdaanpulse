# Live Results Ingest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A source-neutral ingest API (machine keys, shards with leases, one active source, full-state seats, admin holds) that a separate worker (ECI adapter first) feeds on counting day, with changes reaching viewers through the existing live-version → snapshot → CDN path.

**Architecture:** New NestJS module `backend/src/modules/ingest/` holds the API, a pure rules module (`seat-rules.ts`) that decides each seat's outcome, and services for keys, shards, leases, holds and alerts; writes reuse the existing `ResultChangeNotifier.afterCommit`. A new worker in `scraper/src/live/` runs adapter loops (`mock-eci`, `eci-web`) that post to the API. The admin Live Console gains feed, holds, shards and keys controls; the public snapshot gains per-seat state.

**Tech Stack:** NestJS 10 + Prisma 6 (PostgreSQL 15), class-validator, Jest (backend); React + Vite + Tailwind v4 + Radix, Vitest (admin, frontend); Node + ts-node + cheerio, Vitest added (scraper).

**Spec:** `docs/superpowers/specs/2026-10-03-live-ingest-design.md` (read it first; section numbers below refer to it).

## Global Constraints

- Nothing writes results to the database except through the ingest API or the admin seat-correction API (spec D5).
- Full state per seat; every roster candidate must be present (spec §4.4 rule 2).
- One active source per election; a shard may override it; NULL = paused (D3).
- Holds release on a later round or after `hold_minutes` (default 10) (D4).
- Lease TTL 90 s, per shard (D7). Up to 500 seats per request. `observed_at` at most 2 min in the future.
- Statuses and margins are derived by the server, never accepted from a source (§4.4 rule 5).
- Unchanged seats write nothing that bumps the live version (§4.4 rule 6).
- Migrations idempotent (`IF NOT EXISTS` / `DO` blocks), no seed-data dependency; keep `backend/prisma/schema.prisma` in sync; never `prisma db push` (CLAUDE.md).
- Admin UI: Tailwind classes only in `src/components`, `src/pages`, `src/context`, `src/App.tsx`; dates shown in IST via `utils/time.ts`; editors call `useUnsavedGuard(dirty)` (CLAUDE.md).
- Frontend MVVM import boundaries (`npm run lint`); every i18n key in en/hi/mr/ta.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Ruling recorded while planning

- **Admin corrections use a new endpoint, not `PATCH /admin/results/override`.** The spec (§6) kept the single-row override, but the Live Console's seat editor actually saves a whole seat through `POST /admin/results/override-bulk` (`admin/src/hooks/useLiveConsole.ts:145`). The plan adds `PUT /admin/elections/:id/seats/:constId` taking the same seat shape as ingest (state, round, votes per candidate), applying the same derive rules, ignoring source/lease/freshness, and creating the hold. Both old override endpoints are then removed (Task 9). Cost if wrong: the old endpoints can be restored from git.

## Review Focus

1. A source that reorders or renames nothing but sends a seat with **one extra or missing candidate** (a late withdrawal, a parsing miss) → that seat is `rejected: roster_mismatch` with the ids listed, every other seat in the request still applies (Task 4 + Task 6 tests).
2. **Two job copies** (cloud + laptop) posting for the same shard → only the lease holder's posts are accepted; the other gets `409 no_lease`; when the holder stops renewing, the other takes over after expiry (Task 5 tests).
3. A **countermanded seat** or a **tie at the top while counting** → no leader, not counted in tallies, never a crash or a silent WON (Task 2 tests).
4. An admin correction followed by the source still reporting the **same round** with old numbers → `held`, the correction stays; the next round → applied and the hold is gone (Task 6 + Task 8 tests).
5. A request where **every seat is unchanged** → no live-version bump, so viewers don't refetch (Task 6 DB test).

---

## File structure

**Backend (new module `backend/src/modules/ingest/`)**
- `seat-rules.ts` — pure: validate a seat against its roster, check freshness, decide hold, derive statuses/margin, detect change. No I/O.
- `ingest-keys.service.ts` + `ingest-key.guard.ts` — machine keys (create/verify/revoke) and the Bearer guard.
- `shards.service.ts` — resolve a shard's seats, refuse overlap, the implicit `rest` shard.
- `lease.service.ts` — claim / renew / release a shard lease.
- `ingest.service.ts` — roster, config, seats (request checks + per-seat pipeline + one transaction + log), tally.
- `holds.service.ts` — create, list, release holds.
- `ingest-alerts.service.ts` — evaluates alerts (lag, lapsed lease, rejected seats, tally mismatch) and posts to the webhook.
- `ingest.controller.ts` — machine-key routes (`/ingest/elections/:id/...`) and `GET /health/ingest`.
- `admin-ingest.controller.ts` — admin routes (feed settings, shards, holds, keys, seat correction, reopen, status).
- `dto/ingest.dto.ts`, `dto/admin-ingest.dto.ts` — request DTOs.
- `ingest.module.ts`.
- Specs next to each file; DB specs end in `.db.spec.ts`.

**Database:** `database/migrations/020_live_ingest.sql`; `backend/prisma/schema.prisma` models.

**Backend changes elsewhere:** `results/results.service.ts` (snapshot `seats`), `elections/elections.service.ts` (reopen), `admin/controllers/admin-results.controller.ts` + `live/bulk-override.service.ts` + `live/result-override.service.ts` (removed), `candidates/candidates.service.ts` (unchanged), `common/exceptions` (ingest codes).

**Worker (`scraper/src/live/`)**: `types.ts`, `client.ts`, `loop.ts`, `run.ts`, `check.ts`, `adapters/mock-eci.ts`, `adapters/eci-web.ts`, `adapters/eci-mapping.ts`, tests in `scraper/src/live/__tests__/`, fixtures in `scraper/src/live/__tests__/fixtures/`.

**Admin (`admin/src/`)**: `services/ingest.service.ts`, `hooks/useIngestFeed.ts`, `components/live/FeedPanel.tsx`, `components/live/HoldsPanel.tsx`, `components/live/ShardsDialog.tsx`, `pages/IngestKeys.tsx`, changes to `pages/LiveConsole.tsx`, `hooks/useLiveConsole.ts`, `components/live/SeatEditor.tsx`.

**Frontend (`frontend/src/`)**: `model/types/index.ts` (snapshot `seats`), `model/derive/seatView.ts` (`liveChipState`), `views/seat/SeatDialog.tsx` (`LiveChip`), i18n.

**Docs:** `docs/LIVE_RUNBOOK.md`, `docs/FEATURES.md`, `CLAUDE.md`, `docs/DEPLOYMENT.md`.

---

## Part A — Backend ingest

### Task 1: Migration 020 and Prisma models

**Files:**
- Create: `database/migrations/020_live_ingest.sql`
- Modify: `backend/prisma/schema.prisma` (add models; add relations on `elections`, `users`)
- Test: `backend/src/modules/ingest/migration-020.db.spec.ts`

**Interfaces:**
- Produces: tables `election_ingest`, `ingest_shards`, `seat_ingest_state`, `seat_holds`, `ingest_keys`, `ingest_log`; triggers bumping the live version on `seat_ingest_state` (state, round_current, round_total) and `elections.status`. Prisma models with the same names.

- [ ] **Step 1: Write the migration**

```sql
-- Migration 020: live results ingest (spec docs/superpowers/specs/2026-10-03-live-ingest-design.md §3).
--   election_ingest     per election: active source (NULL = paused) and hold minutes
--   ingest_keys         machine keys (sha256 of the key; the key itself is shown once)
--   ingest_shards       named seat sets per election, each with a lease; the "rest" shard is implicit (no row)
--   seat_ingest_state   per seat: state, round, last source and observation time (freshness)
--   seat_holds          admin corrections holding a seat until a later round or expiry
--   ingest_log          one row per ingest request (30-day retention by the app)
--   Live version: bumped by seat_ingest_state changes (state / rounds) and elections.status changes.
BEGIN;

CREATE TABLE IF NOT EXISTS election_ingest (
    election_id   UUID PRIMARY KEY REFERENCES elections(id) ON DELETE CASCADE,
    active_source TEXT,
    hold_minutes  INT NOT NULL DEFAULT 10 CHECK (hold_minutes BETWEEN 1 AND 240),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ingest_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(80) NOT NULL UNIQUE,
    key_hash     CHAR(64) NOT NULL UNIQUE,
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ingest_shards (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id      UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    name             VARCHAR(40) NOT NULL CHECK (name ~ '^[a-z0-9][a-z0-9_-]*$' AND name <> 'rest'),
    source_override  TEXT,
    selector         JSONB NOT NULL,
    lease_holder     TEXT,
    lease_key_id     UUID REFERENCES ingest_keys(id) ON DELETE SET NULL,
    lease_expires_at TIMESTAMPTZ,
    UNIQUE (election_id, name)
);

-- The implicit "rest" shard's lease and source override live on election_ingest.
ALTER TABLE election_ingest ADD COLUMN IF NOT EXISTS rest_source_override TEXT;
ALTER TABLE election_ingest ADD COLUMN IF NOT EXISTS rest_lease_holder TEXT;
ALTER TABLE election_ingest ADD COLUMN IF NOT EXISTS rest_lease_key_id UUID REFERENCES ingest_keys(id) ON DELETE SET NULL;
ALTER TABLE election_ingest ADD COLUMN IF NOT EXISTS rest_lease_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS seat_ingest_state (
    election_id      UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    const_id         VARCHAR(100) NOT NULL REFERENCES constituencies(id) ON DELETE CASCADE,
    state            TEXT NOT NULL CHECK (state IN ('not_started','counting','declared','countermanded','adjourned')),
    round_current    INT,
    round_total      INT,
    last_source      TEXT,
    last_observed_at TIMESTAMPTZ,
    last_applied_at  TIMESTAMPTZ,
    PRIMARY KEY (election_id, const_id)
);

CREATE TABLE IF NOT EXISTS seat_holds (
    election_id   UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    const_id      VARCHAR(100) NOT NULL REFERENCES constituencies(id) ON DELETE CASCADE,
    round_at_hold INT,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (election_id, const_id)
);

CREATE TABLE IF NOT EXISTS ingest_log (
    id          BIGSERIAL PRIMARY KEY,
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    shard       VARCHAR(40) NOT NULL,
    key_id      UUID REFERENCES ingest_keys(id) ON DELETE SET NULL,
    source      TEXT NOT NULL,
    dry_run     BOOLEAN NOT NULL DEFAULT false,
    kind        TEXT NOT NULL DEFAULT 'seats' CHECK (kind IN ('seats','tally')),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    observed_at TIMESTAMPTZ,
    counts      JSONB NOT NULL DEFAULT '{}',
    rejected    JSONB NOT NULL DEFAULT '[]',
    tally_mismatch JSONB
);
CREATE INDEX IF NOT EXISTS ingest_log_election_received ON ingest_log (election_id, received_at DESC);

-- Live version: seat state / rounds and election status are part of what viewers see.
CREATE OR REPLACE FUNCTION bump_live_version_ingest() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    ids UUID[];
BEGIN
    CASE TG_ARGV[0]
    WHEN 'seat_rows' THEN
        SELECT array_agg(DISTINCT r.election_id) INTO ids FROM changed_rows r;
    WHEN 'seat_upd' THEN
        SELECT array_agg(DISTINCT n.election_id) INTO ids
        FROM new_rows n JOIN old_rows o ON o.election_id = n.election_id AND o.const_id = n.const_id
        WHERE (n.state, n.round_current, n.round_total) IS DISTINCT FROM (o.state, o.round_current, o.round_total);
    WHEN 'election_upd' THEN
        SELECT array_agg(DISTINCT n.id) INTO ids
        FROM new_rows n JOIN old_rows o ON o.id = n.id
        WHERE n.status IS DISTINCT FROM o.status;
    ELSE
        RAISE EXCEPTION 'bump_live_version_ingest: unknown mode %', TG_ARGV[0];
    END CASE;
    IF ids IS NOT NULL THEN
        PERFORM bump_election_live_versions(ids);
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS seat_ingest_state_live_ins ON seat_ingest_state;
CREATE TRIGGER seat_ingest_state_live_ins
    AFTER INSERT ON seat_ingest_state REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_live_version_ingest('seat_rows');
DROP TRIGGER IF EXISTS seat_ingest_state_live_upd ON seat_ingest_state;
CREATE TRIGGER seat_ingest_state_live_upd
    AFTER UPDATE ON seat_ingest_state REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_live_version_ingest('seat_upd');
DROP TRIGGER IF EXISTS seat_ingest_state_live_del ON seat_ingest_state;
CREATE TRIGGER seat_ingest_state_live_del
    AFTER DELETE ON seat_ingest_state REFERENCING OLD TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_live_version_ingest('seat_rows');
DROP TRIGGER IF EXISTS elections_status_live_upd ON elections;
CREATE TRIGGER elections_status_live_upd
    AFTER UPDATE ON elections REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
    FOR EACH STATEMENT EXECUTE FUNCTION bump_live_version_ingest('election_upd');

COMMIT;
```

- [ ] **Step 2: Apply it twice to the local DB (idempotency)**

Run (repo root): `URL=$(grep ^DATABASE_URL .env | cut -d= -f2- | sed 's/?schema=public//'); for i in 1 2; do psql "$URL" -v ON_ERROR_STOP=1 -q -f database/migrations/020_live_ingest.sql && echo "run $i ok"; done`
Expected: `run 1 ok`, `run 2 ok` (NOTICEs on run 2 are fine).

- [ ] **Step 3: Add the Prisma models**

Append to `backend/prisma/schema.prisma` (and add the back-relation fields Prisma asks for on `elections`, `users`, `constituencies`; let `npx prisma format` place them):

```prisma
model election_ingest {
  election_id           String       @id @db.Uuid
  active_source         String?
  hold_minutes          Int          @default(10)
  updated_at            DateTime     @default(now()) @db.Timestamptz(6)
  updated_by            String?      @db.Uuid
  rest_source_override  String?
  rest_lease_holder     String?
  rest_lease_key_id     String?      @db.Uuid
  rest_lease_expires_at DateTime?    @db.Timestamptz(6)
  elections             elections    @relation(fields: [election_id], references: [id], onDelete: Cascade)
}

model ingest_keys {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name         String    @unique @db.VarChar(80)
  key_hash     String    @unique @db.Char(64)
  created_by   String?   @db.Uuid
  created_at   DateTime  @default(now()) @db.Timestamptz(6)
  last_used_at DateTime? @db.Timestamptz(6)
  revoked_at   DateTime? @db.Timestamptz(6)
}

model ingest_shards {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  election_id      String    @db.Uuid
  name             String    @db.VarChar(40)
  source_override  String?
  selector         Json
  lease_holder     String?
  lease_key_id     String?   @db.Uuid
  lease_expires_at DateTime? @db.Timestamptz(6)
  elections        elections @relation(fields: [election_id], references: [id], onDelete: Cascade)

  @@unique([election_id, name])
}

model seat_ingest_state {
  election_id      String    @db.Uuid
  const_id         String    @db.VarChar(100)
  state            String
  round_current    Int?
  round_total      Int?
  last_source      String?
  last_observed_at DateTime? @db.Timestamptz(6)
  last_applied_at  DateTime? @db.Timestamptz(6)

  @@id([election_id, const_id])
}

model seat_holds {
  election_id   String   @db.Uuid
  const_id      String   @db.VarChar(100)
  round_at_hold Int?
  expires_at    DateTime @db.Timestamptz(6)
  created_by    String?  @db.Uuid
  created_at    DateTime @default(now()) @db.Timestamptz(6)

  @@id([election_id, const_id])
}

model ingest_log {
  id             BigInt    @id @default(autoincrement())
  election_id    String    @db.Uuid
  shard          String    @db.VarChar(40)
  key_id         String?   @db.Uuid
  source         String
  dry_run        Boolean   @default(false)
  kind           String    @default("seats")
  received_at    DateTime  @default(now()) @db.Timestamptz(6)
  observed_at    DateTime? @db.Timestamptz(6)
  counts         Json      @default("{}")
  rejected       Json      @default("[]")
  tally_mismatch Json?

  @@index([election_id, received_at(sort: Desc)], map: "ingest_log_election_received")
}
```

Keep foreign keys for `seat_ingest_state`, `seat_holds`, `ingest_log`, `ingest_keys` to `users`/`constituencies` in SQL only (no Prisma relation needed); `prisma migrate diff` reports FK-only drift as `ADD CONSTRAINT` lines — if it does, add the matching `@relation` fields instead so the diff stays at the known `person_id` line.

- [ ] **Step 4: Generate and check drift**

Run: `cd backend && npx prisma format && npx prisma generate && URL=$(grep ^DATABASE_URL ../.env | cut -d= -f2-); DIRECT_URL="$URL" npx prisma migrate diff --from-url "$URL" --to-schema-datamodel prisma/schema.prisma --script | grep -v '^--' | grep -v '^$'`
Expected: only `ALTER TABLE "candidates" ALTER COLUMN "person_id" SET NOT NULL;`

- [ ] **Step 5: Write the DB spec for the triggers**

```ts
// backend/src/modules/ingest/migration-020.db.spec.ts
/** Migration 020 triggers against the local DB; every change is rolled back. Skips (loudly) without a DB. */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: join(__dirname, '../../../.env') });
class Rollback extends Error {}
const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('migration 020 live-version triggers (DB)', () => {
  let prisma: PrismaClient | null = null;
  let seat: { election_id: string; id: string } | null = null;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const client = new PrismaClient();
    try {
      await client.$queryRaw`SELECT 1 FROM seat_ingest_state LIMIT 1`;
      prisma = client;
      seat = await client.constituencies.findFirst({ select: { election_id: true, id: true } });
    } catch {
      await client.$disconnect();
    }
  });
  afterAll(async () => prisma?.$disconnect());

  async function inRollback(name: string, body: (tx: any, version: () => Promise<bigint>) => Promise<void>) {
    if (!prisma || !seat) {
      if (REQUIRE_DB) throw new Error(`REQUIRE_DB_TESTS=1 but no database with migration 020 (${name})`);
      console.warn(`SKIPPED (no database with migration 020): ${name}`);
      return;
    }
    const eid = seat.election_id;
    await prisma.$transaction(async (tx) => {
      const version = async () => BigInt((await tx.election_live_state.findUnique({ where: { election_id: eid } }))?.version ?? 0n);
      await body(tx, version);
      throw new Rollback();
    }).catch((e) => { if (!(e instanceof Rollback)) throw e; });
  }

  it('seat state / round changes bump the version; a last_observed_at-only update does not', async () => {
    await inRollback('seat_ingest_state', async (tx, version) => {
      const v0 = await version();
      await tx.seat_ingest_state.create({ data: { election_id: seat!.election_id, const_id: seat!.id, state: 'counting', round_current: 1, round_total: 20 } });
      const v1 = await version();
      expect(v1).toBeGreaterThan(v0);
      await tx.seat_ingest_state.update({ where: { election_id_const_id: { election_id: seat!.election_id, const_id: seat!.id } }, data: { last_observed_at: new Date() } });
      expect(await version()).toBe(v1);
      await tx.seat_ingest_state.update({ where: { election_id_const_id: { election_id: seat!.election_id, const_id: seat!.id } }, data: { round_current: 2 } });
      expect(await version()).toBeGreaterThan(v1);
    });
  });

  it('an election status change bumps the version; a name change does not', async () => {
    await inRollback('elections.status', async (tx, version) => {
      const e = await tx.elections.findUnique({ where: { id: seat!.election_id }, select: { status: true, name: true } });
      const v0 = await version();
      await tx.elections.update({ where: { id: seat!.election_id }, data: { name: `${e.name} x` } });
      expect(await version()).toBe(v0);
      await tx.elections.update({ where: { id: seat!.election_id }, data: { status: e.status === 'Live' ? 'Finalized' : 'Live' } });
      expect(await version()).toBeGreaterThan(v0);
    });
  });
});
```

- [ ] **Step 6: Run it**

Run: `cd backend && npx jest src/modules/ingest/migration-020.db.spec.ts`
Expected: 2 passed (not SKIPPED — the local DB has the migration).

- [ ] **Step 7: Commit**

```bash
git add database/migrations/020_live_ingest.sql backend/prisma/schema.prisma backend/src/modules/ingest/migration-020.db.spec.ts
git commit -m "feat(db): live ingest tables and live-version triggers (migration 020)"
```

---

### Task 2: Pure seat rules

**Files:**
- Create: `backend/src/modules/ingest/seat-rules.ts`
- Test: `backend/src/modules/ingest/seat-rules.spec.ts`

**Interfaces:**
- Produces (used by Tasks 6 and 8):

```ts
export const SEAT_STATES = ['not_started', 'counting', 'declared', 'countermanded', 'adjourned'] as const;
export type SeatState = (typeof SEAT_STATES)[number];
export type ResultStatus = 'LEADING' | 'WON' | 'TRAILING' | 'LOST';
export interface RosterCandidate { candidate_id: string; party_id: string | null }
export interface IncomingSeat { const_id: string; state: SeatState; round?: { current: number; total: number } | null; votes: Record<string, number> }
export interface StoredRow { candidate_id: string; votes: number; status: ResultStatus; margin: number | null }
export interface StoredSeat { state: SeatState | null; round_current: number | null; round_total: number | null; last_source: string | null; last_observed_at: Date | null }
export interface Hold { round_at_hold: number | null; expires_at: Date }
export interface DerivedRow { candidate_id: string; votes: number; status: ResultStatus; margin: number }
export type SeatOutcome =
  | { kind: 'applied'; rows: DerivedRow[]; releaseHold: boolean }
  | { kind: 'unchanged'; releaseHold: boolean }
  | { kind: 'stale' }
  | { kind: 'held' }
  | { kind: 'rejected'; reason: string; detail?: Record<string, unknown> };
export function checkRoster(seat: IncomingSeat, roster: RosterCandidate[]): { reason: string; detail?: Record<string, unknown> } | null;
export function isStale(seat: IncomingSeat, stored: StoredSeat | null, source: string, observedAt: Date): boolean;
export function holdDecision(seat: IncomingSeat, hold: Hold | null, now: Date): 'none' | 'release' | 'keep';
export function deriveRows(seat: IncomingSeat, roster: RosterCandidate[]): DerivedRow[] | { reason: 'declared_tie' };
export function sameAsStored(rows: DerivedRow[], seat: IncomingSeat, storedRows: StoredRow[], stored: StoredSeat | null): boolean;
export function evaluateSeat(args: { seat: IncomingSeat; roster: RosterCandidate[]; stored: StoredSeat | null; storedRows: StoredRow[]; hold: Hold | null; source: string; observedAt: Date; now: Date }): SeatOutcome;
```

NOTA is the roster candidate whose `party_id === 'NOTA'`.

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/modules/ingest/seat-rules.spec.ts
import { checkRoster, deriveRows, evaluateSeat, holdDecision, isStale, sameAsStored, type IncomingSeat, type RosterCandidate, type StoredSeat } from './seat-rules';

const roster: RosterCandidate[] = [
  { candidate_id: 'a', party_id: 'BJP' }, { candidate_id: 'b', party_id: 'INC' },
  { candidate_id: 'c', party_id: 'IND' }, { candidate_id: 'n', party_id: 'NOTA' },
];
const seat = (over: Partial<IncomingSeat> = {}): IncomingSeat => ({
  const_id: 'S1', state: 'counting', round: { current: 5, total: 20 }, votes: { a: 500, b: 400, c: 100, n: 900 }, ...over,
});
const stored = (over: Partial<StoredSeat> = {}): StoredSeat => ({ state: 'counting', round_current: 4, round_total: 20, last_source: 'eci-web', last_observed_at: new Date('2027-02-27T09:00:00Z'), ...over });
const t = (s: string) => new Date(`2027-02-27T${s}Z`);

describe('checkRoster', () => {
  it('accepts exactly the roster', () => expect(checkRoster(seat(), roster)).toBeNull());
  it('rejects a missing or an unknown candidate, listing them', () => {
    expect(checkRoster(seat({ votes: { a: 1, b: 1, n: 1 } }), roster)).toEqual({ reason: 'roster_mismatch', detail: { missing: ['c'], unknown: [] } });
    expect(checkRoster(seat({ votes: { a: 1, b: 1, c: 1, n: 1, z: 1 } }), roster)).toEqual({ reason: 'roster_mismatch', detail: { missing: [], unknown: ['z'] } });
  });
  it('rejects negative or fractional votes and a round past its total', () => {
    expect(checkRoster(seat({ votes: { a: -1, b: 1, c: 1, n: 1 } }), roster)?.reason).toBe('invalid_votes');
    expect(checkRoster(seat({ votes: { a: 1.5, b: 1, c: 1, n: 1 } }), roster)?.reason).toBe('invalid_votes');
    expect(checkRoster(seat({ round: { current: 21, total: 20 } }), roster)?.reason).toBe('invalid_round');
  });
});

describe('deriveRows', () => {
  it('counting: top non-NOTA leads (NOTA never leads even with most votes); margin = top − second', () => {
    expect(deriveRows(seat(), roster)).toEqual([
      { candidate_id: 'a', votes: 500, status: 'LEADING', margin: 100 },
      { candidate_id: 'b', votes: 400, status: 'TRAILING', margin: 100 },
      { candidate_id: 'c', votes: 100, status: 'TRAILING', margin: 100 },
      { candidate_id: 'n', votes: 900, status: 'TRAILING', margin: 100 },
    ]);
  });
  it('declared: WON / LOST', () => {
    const rows = deriveRows(seat({ state: 'declared' }), roster) as any[];
    expect(rows.map(r => r.status)).toEqual(['WON', 'LOST', 'LOST', 'LOST']);
  });
  it('a tie at the top or all zero while counting: no leader', () => {
    expect((deriveRows(seat({ votes: { a: 5, b: 5, c: 1, n: 0 } }), roster) as any[]).every(r => r.status === 'TRAILING')).toBe(true);
    expect((deriveRows(seat({ votes: { a: 0, b: 0, c: 0, n: 0 } }), roster) as any[]).every(r => r.status === 'TRAILING')).toBe(true);
  });
  it('a declared tie is refused', () => expect(deriveRows(seat({ state: 'declared', votes: { a: 5, b: 5, c: 1, n: 0 } }), roster)).toEqual({ reason: 'declared_tie' }));
  it('countermanded / adjourned / not_started: no leader', () => {
    for (const state of ['countermanded', 'adjourned', 'not_started'] as const)
      expect((deriveRows(seat({ state }), roster) as any[]).every(r => r.status === 'TRAILING')).toBe(true);
  });
});

describe('isStale', () => {
  it('a lower round is stale; a higher one is not', () => {
    expect(isStale(seat({ round: { current: 3, total: 20 } }), stored(), 'eci-web', t('09:05:00'))).toBe(true);
    expect(isStale(seat(), stored(), 'eci-web', t('08:00:00'))).toBe(false);
  });
  it('same round: an older observation from the same source is stale; another source compares on round only', () => {
    const s = stored({ round_current: 5 });
    expect(isStale(seat(), s, 'eci-web', t('08:59:00'))).toBe(true);
    expect(isStale(seat(), s, 'eci-web', t('09:01:00'))).toBe(false);
    expect(isStale(seat(), s, 'news-feed', t('08:00:00'))).toBe(false);
  });
  it('after declared, only declared is accepted', () => {
    expect(isStale(seat({ state: 'counting', round: { current: 20, total: 20 } }), stored({ state: 'declared', round_current: 20 }), 'eci-web', t('10:00:00'))).toBe(true);
    expect(isStale(seat({ state: 'declared', round: { current: 20, total: 20 } }), stored({ state: 'declared', round_current: 20 }), 'eci-web', t('10:00:00'))).toBe(false);
  });
  it('nothing stored: never stale', () => expect(isStale(seat(), null, 'eci-web', t('09:00:00'))).toBe(false));
});

describe('holdDecision', () => {
  const hold = { round_at_hold: 5, expires_at: t('09:10:00') };
  it('none without a hold; keep at the same round before expiry', () => {
    expect(holdDecision(seat(), null, t('09:00:00'))).toBe('none');
    expect(holdDecision(seat(), hold, t('09:00:00'))).toBe('keep');
  });
  it('release on a later round or once expired', () => {
    expect(holdDecision(seat({ round: { current: 6, total: 20 } }), hold, t('09:00:00'))).toBe('release');
    expect(holdDecision(seat(), hold, t('09:10:00'))).toBe('release');
  });
  it('a source without rounds only releases by the timer', () => {
    expect(holdDecision(seat({ round: null }), hold, t('09:00:00'))).toBe('keep');
  });
});

describe('evaluateSeat', () => {
  const base = { roster, storedRows: [], hold: null, source: 'eci-web', observedAt: t('09:05:00'), now: t('09:05:01') };
  it('applies a new seat', () => {
    expect(evaluateSeat({ ...base, seat: seat(), stored: null })).toMatchObject({ kind: 'applied', releaseHold: false });
  });
  it('is unchanged when votes, statuses, margin, state and round match what is stored', () => {
    const rows = deriveRows(seat(), roster) as any[];
    expect(evaluateSeat({ ...base, seat: seat(), stored: stored({ round_current: 5 }), storedRows: rows })).toEqual({ kind: 'unchanged', releaseHold: false });
  });
  it('reports held, and applies with releaseHold once the hold lets go', () => {
    expect(evaluateSeat({ ...base, seat: seat(), stored: stored(), hold: { round_at_hold: 5, expires_at: t('09:10:00') } })).toEqual({ kind: 'held' });
    expect(evaluateSeat({ ...base, seat: seat({ round: { current: 6, total: 20 } }), stored: stored(), hold: { round_at_hold: 5, expires_at: t('09:10:00') } })).toMatchObject({ kind: 'applied', releaseHold: true });
  });
  it('order: roster before staleness before hold', () => {
    expect(evaluateSeat({ ...base, seat: seat({ votes: { a: 1 }, round: { current: 1, total: 20 } }), stored: stored() })).toMatchObject({ kind: 'rejected', reason: 'roster_mismatch' });
    expect(evaluateSeat({ ...base, seat: seat({ round: { current: 1, total: 20 } }), stored: stored(), hold: { round_at_hold: 5, expires_at: t('09:10:00') } })).toEqual({ kind: 'stale' });
  });
  it('sameAsStored compares state and round too', () => {
    const rows = deriveRows(seat(), roster) as any[];
    expect(sameAsStored(rows, seat(), rows, stored({ round_current: 4 }))).toBe(false);
    expect(sameAsStored(rows, seat(), rows, stored({ round_current: 5 }))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `cd backend && npx jest src/modules/ingest/seat-rules.spec.ts`
Expected: FAIL, `Cannot find module './seat-rules'`.

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/ingest/seat-rules.ts
/**
 * The ingest rules for one seat (spec §4.4), pure so every rule is unit-tested: roster check, freshness, hold,
 * derived statuses / margin, change detection. The service (ingest.service.ts) only loads state and writes.
 */
export const SEAT_STATES = ['not_started', 'counting', 'declared', 'countermanded', 'adjourned'] as const;
export type SeatState = (typeof SEAT_STATES)[number];
export type ResultStatus = 'LEADING' | 'WON' | 'TRAILING' | 'LOST';
export interface RosterCandidate { candidate_id: string; party_id: string | null }
export interface IncomingSeat { const_id: string; state: SeatState; round?: { current: number; total: number } | null; votes: Record<string, number> }
export interface StoredRow { candidate_id: string; votes: number; status: ResultStatus; margin: number | null }
export interface StoredSeat { state: SeatState | null; round_current: number | null; round_total: number | null; last_source: string | null; last_observed_at: Date | null }
export interface Hold { round_at_hold: number | null; expires_at: Date }
export interface DerivedRow { candidate_id: string; votes: number; status: ResultStatus; margin: number }
export type SeatOutcome =
  | { kind: 'applied'; rows: DerivedRow[]; releaseHold: boolean }
  | { kind: 'unchanged'; releaseHold: boolean }
  | { kind: 'stale' }
  | { kind: 'held' }
  | { kind: 'rejected'; reason: string; detail?: Record<string, unknown> };

const isNota = (c: RosterCandidate) => c.party_id === 'NOTA';

/** Rule 2: exactly the roster's candidates, whole non-negative votes, a sane round. */
export function checkRoster(seat: IncomingSeat, roster: RosterCandidate[]): { reason: string; detail?: Record<string, unknown> } | null {
  const want = new Set(roster.map(c => c.candidate_id));
  const got = Object.keys(seat.votes);
  const missing = [...want].filter(id => !(id in seat.votes));
  const unknown = got.filter(id => !want.has(id));
  if (missing.length || unknown.length) return { reason: 'roster_mismatch', detail: { missing, unknown } };
  if (got.some(id => !Number.isInteger(seat.votes[id]) || seat.votes[id] < 0)) return { reason: 'invalid_votes' };
  const r = seat.round;
  if (r && (!Number.isInteger(r.current) || !Number.isInteger(r.total) || r.current < 0 || r.total < 0 || r.current > r.total)) return { reason: 'invalid_round' };
  return null;
}

/** Rule 3. */
export function isStale(seat: IncomingSeat, stored: StoredSeat | null, source: string, observedAt: Date): boolean {
  if (!stored) return false;
  if (stored.state === 'declared' && seat.state !== 'declared') return true;
  const cur = seat.round?.current ?? null;
  if (cur !== null && stored.round_current !== null) {
    if (cur < stored.round_current) return true;
    if (cur > stored.round_current) return false;
  }
  // Same (or unknown) round: only the same source's clock is comparable.
  return stored.last_source === source && !!stored.last_observed_at && observedAt < stored.last_observed_at;
}

/** Rule 4. */
export function holdDecision(seat: IncomingSeat, hold: Hold | null, now: Date): 'none' | 'release' | 'keep' {
  if (!hold) return 'none';
  if (now >= hold.expires_at) return 'release';
  const cur = seat.round?.current;
  if (cur != null && hold.round_at_hold != null && cur > hold.round_at_hold) return 'release';
  return 'keep';
}

/** Rule 5: statuses and margin from votes; roster order kept. */
export function deriveRows(seat: IncomingSeat, roster: RosterCandidate[]): DerivedRow[] | { reason: 'declared_tie' } {
  const ranked = roster.filter(c => !isNota(c)).map(c => ({ id: c.candidate_id, v: seat.votes[c.candidate_id] })).sort((a, b) => b.v - a.v);
  const top = ranked[0], second = ranked[1];
  const margin = top ? top.v - (second?.v ?? 0) : 0;
  const hasLeader = (seat.state === 'counting' || seat.state === 'declared') && !!top && top.v > 0 && (!second || top.v > second.v);
  if (seat.state === 'declared' && !hasLeader) return { reason: 'declared_tie' };
  const won = seat.state === 'declared';
  return roster.map(c => {
    const lead = hasLeader && c.candidate_id === top.id;
    const status: ResultStatus = won ? (lead ? 'WON' : 'LOST') : lead ? 'LEADING' : 'TRAILING';
    return { candidate_id: c.candidate_id, votes: seat.votes[c.candidate_id], status, margin };
  });
}

/** Rule 6. */
export function sameAsStored(rows: DerivedRow[], seat: IncomingSeat, storedRows: StoredRow[], stored: StoredSeat | null): boolean {
  if (!stored || stored.state !== seat.state) return false;
  if ((seat.round?.current ?? null) !== stored.round_current || (seat.round?.total ?? null) !== stored.round_total) return false;
  const byId = new Map(storedRows.map(r => [r.candidate_id, r]));
  return rows.every(r => {
    const s = byId.get(r.candidate_id);
    return !!s && s.votes === r.votes && s.status === r.status && (s.margin ?? 0) === r.margin;
  });
}

/** Rules 2–6 in order for one seat (rule 1, the shard check, is the service's). */
export function evaluateSeat(a: { seat: IncomingSeat; roster: RosterCandidate[]; stored: StoredSeat | null; storedRows: StoredRow[]; hold: Hold | null; source: string; observedAt: Date; now: Date }): SeatOutcome {
  const bad = checkRoster(a.seat, a.roster);
  if (bad) return { kind: 'rejected', ...bad };
  if (isStale(a.seat, a.stored, a.source, a.observedAt)) return { kind: 'stale' };
  const hold = holdDecision(a.seat, a.hold, a.now);
  if (hold === 'keep') return { kind: 'held' };
  const rows = deriveRows(a.seat, a.roster);
  if (!Array.isArray(rows)) return { kind: 'rejected', reason: rows.reason };
  const releaseHold = hold === 'release';
  if (sameAsStored(rows, a.seat, a.storedRows, a.stored)) return { kind: 'unchanged', releaseHold };
  return { kind: 'applied', rows, releaseHold };
}
```

- [ ] **Step 4: Run to see it pass**

Run: `cd backend && npx jest src/modules/ingest/seat-rules.spec.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/ingest/seat-rules.ts backend/src/modules/ingest/seat-rules.spec.ts
git commit -m "feat(ingest): pure seat rules (roster, freshness, hold, derive, change)"
```

---

### Task 3: Machine keys and the ingest guard

**Files:**
- Create: `backend/src/modules/ingest/ingest-keys.service.ts`, `backend/src/modules/ingest/ingest-key.guard.ts`
- Modify: `backend/src/common/exceptions/error-codes.ts`, create `backend/src/common/exceptions/ingest.exception.ts`, export it from `backend/src/common/exceptions/index.ts`
- Test: `backend/src/modules/ingest/ingest-keys.service.spec.ts`, `backend/src/modules/ingest/ingest-key.guard.spec.ts`

**Interfaces:**
- Produces:

```ts
export interface IngestKeyRow { id: string; name: string; created_at: Date; last_used_at: Date | null; revoked_at: Date | null }
class IngestKeysService {
  create(name: string, userId: string | null): Promise<{ key: string; row: IngestKeyRow }>; // key = 'mpk_' + 43 base64url chars
  verify(raw: string): Promise<IngestKeyRow | null>;   // null when unknown or revoked; touches last_used_at at most once a minute
  list(): Promise<IngestKeyRow[]>;
  revoke(id: string): Promise<void>;
}
// request.ingestKey: IngestKeyRow (set by IngestKeyGuard)
class IngestKeyGuard implements CanActivate {}
// exceptions (409 unless noted): IngestNotLiveException, IngestInactiveSourceException(expected: string|null),
// IngestNoLeaseException(holder: string|null, expires_at: Date|null), IngestUnauthorizedException (401), IngestBadRequestException (400, message)
```

- [ ] **Step 1: Add error codes and exceptions**

In `error-codes.ts`, before `// Validation (9xxx)`:

```ts
  // Ingest
  INGEST_UNAUTHORIZED: 'INGEST_0001',
  INGEST_NOT_LIVE: 'INGEST_0002',
  INGEST_INACTIVE_SOURCE: 'INGEST_0003',
  INGEST_NO_LEASE: 'INGEST_0004',
  INGEST_BAD_REQUEST: 'INGEST_0005',
  INGEST_SHARD_NOT_FOUND: 'INGEST_0006',
  INGEST_SHARD_OVERLAP: 'INGEST_0007',
```

```ts
// backend/src/common/exceptions/ingest.exception.ts
import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class IngestUnauthorizedException extends BusinessException {
  constructor() { super(ErrorCodes.INGEST_UNAUTHORIZED, 'Missing, unknown or revoked ingest key', HttpStatus.UNAUTHORIZED); }
}
export class IngestNotLiveException extends BusinessException {
  constructor(status: string) { super(ErrorCodes.INGEST_NOT_LIVE, `Election is ${status}, not Live`, HttpStatus.CONFLICT, { status }); }
}
export class IngestInactiveSourceException extends BusinessException {
  constructor(expected: string | null) {
    super(ErrorCodes.INGEST_INACTIVE_SOURCE, expected ? `Active source is ${expected}` : 'Ingest is paused for this shard', HttpStatus.CONFLICT, { expected });
  }
}
export class IngestNoLeaseException extends BusinessException {
  constructor(holder: string | null, expires_at: Date | null) {
    super(ErrorCodes.INGEST_NO_LEASE, 'Another job holds this shard', HttpStatus.CONFLICT, { holder, expires_at });
  }
}
export class IngestBadRequestException extends BusinessException {
  constructor(message: string, details?: Record<string, unknown>) { super(ErrorCodes.INGEST_BAD_REQUEST, message, HttpStatus.BAD_REQUEST, details); }
}
export class IngestShardNotFoundException extends BusinessException {
  constructor(name: string) { super(ErrorCodes.INGEST_SHARD_NOT_FOUND, `Shard ${name} not found`, HttpStatus.NOT_FOUND, { name }); }
}
export class IngestShardOverlapException extends BusinessException {
  constructor(other: string, sample: string[]) { super(ErrorCodes.INGEST_SHARD_OVERLAP, `Shard overlaps ${other}`, HttpStatus.CONFLICT, { other, sample }); }
}
```

Add `export * from './ingest.exception';` to `exceptions/index.ts`.

- [ ] **Step 2: Write the failing tests**

```ts
// backend/src/modules/ingest/ingest-keys.service.spec.ts
import { createHash } from 'crypto';
import { IngestKeysService } from './ingest-keys.service';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('IngestKeysService', () => {
  const make = () => {
    const rows: any[] = [];
    const prisma: any = { ingest_keys: {
      create: jest.fn(async ({ data }) => { const r = { id: `k${rows.length}`, created_at: new Date(), last_used_at: null, revoked_at: null, ...data }; rows.push(r); return r; }),
      findUnique: jest.fn(async ({ where }) => rows.find(r => r.key_hash === where.key_hash) ?? null),
      update: jest.fn(async ({ where, data }) => Object.assign(rows.find(r => r.id === where.id), data)),
      findMany: jest.fn(async () => rows),
    } };
    return { svc: new IngestKeysService(prisma), prisma, rows };
  };

  it('create returns an mpk_ key once and stores only its sha256', async () => {
    const { svc, rows } = make();
    const { key, row } = await svc.create('laptop', 'u1');
    expect(key).toMatch(/^mpk_[A-Za-z0-9_-]{43}$/);
    expect(rows[0].key_hash).toBe(sha(key));
    expect(row).not.toHaveProperty('key_hash');
  });

  it('verify finds a live key, refuses a revoked or unknown one', async () => {
    const { svc } = make();
    const { key, row } = await svc.create('w', null);
    expect((await svc.verify(key))?.id).toBe(row.id);
    expect(await svc.verify('mpk_nope')).toBeNull();
    await svc.revoke(row.id);
    expect(await svc.verify(key)).toBeNull();
  });

  it('touches last_used_at at most once a minute', async () => {
    const { svc, prisma } = make();
    const { key } = await svc.create('w', null);
    await svc.verify(key); await svc.verify(key);
    expect(prisma.ingest_keys.update.mock.calls.filter((c: any[]) => c[0].data.last_used_at).length).toBe(1);
  });
});
```

```ts
// backend/src/modules/ingest/ingest-key.guard.spec.ts
import { IngestKeyGuard } from './ingest-key.guard';
import { IngestUnauthorizedException } from '../../common/exceptions';

const ctx = (auth?: string) => {
  const req: any = { headers: auth ? { authorization: auth } : {} };
  return { req, ctx: { switchToHttp: () => ({ getRequest: () => req }) } as any };
};

describe('IngestKeyGuard', () => {
  it('attaches the key row for a valid Bearer key', async () => {
    const keys: any = { verify: jest.fn(async () => ({ id: 'k1', name: 'w' })) };
    const { req, ctx: c } = ctx('Bearer mpk_x');
    await expect(new IngestKeyGuard(keys).canActivate(c)).resolves.toBe(true);
    expect(keys.verify).toHaveBeenCalledWith('mpk_x');
    expect(req.ingestKey).toEqual({ id: 'k1', name: 'w' });
  });
  it('401 without a header, with a non-Bearer header or an unknown key', async () => {
    const keys: any = { verify: jest.fn(async () => null) };
    for (const a of [undefined, 'Basic x', 'Bearer mpk_bad'])
      await expect(new IngestKeyGuard(keys).canActivate(ctx(a).ctx)).rejects.toBeInstanceOf(IngestUnauthorizedException);
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `cd backend && npx jest src/modules/ingest/ingest-key`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement**

```ts
// backend/src/modules/ingest/ingest-keys.service.ts
import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface IngestKeyRow { id: string; name: string; created_at: Date; last_used_at: Date | null; revoked_at: Date | null }
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const pub = ({ id, name, created_at, last_used_at, revoked_at }: any): IngestKeyRow => ({ id, name, created_at, last_used_at, revoked_at });
const TOUCH_MS = 60_000;

/** Machine keys for the ingest API: high-entropy random keys, so a sha256 (not a slow hash) is enough. */
@Injectable()
export class IngestKeysService {
  private readonly touched = new Map<string, number>();
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string, userId: string | null): Promise<{ key: string; row: IngestKeyRow }> {
    const key = `mpk_${randomBytes(32).toString('base64url')}`;
    const row = await this.prisma.ingest_keys.create({ data: { name, key_hash: sha(key), created_by: userId } });
    return { key, row: pub(row) };
  }

  async verify(raw: string): Promise<IngestKeyRow | null> {
    const row = await this.prisma.ingest_keys.findUnique({ where: { key_hash: sha(raw) } });
    if (!row || row.revoked_at) return null;
    const now = Date.now();
    if (now - (this.touched.get(row.id) ?? 0) > TOUCH_MS) {
      this.touched.set(row.id, now);
      await this.prisma.ingest_keys.update({ where: { id: row.id }, data: { last_used_at: new Date(now) } });
    }
    return pub(row);
  }

  async list(): Promise<IngestKeyRow[]> {
    return (await this.prisma.ingest_keys.findMany({ orderBy: { created_at: 'desc' } })).map(pub);
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.ingest_keys.update({ where: { id }, data: { revoked_at: new Date() } });
  }
}
```

```ts
// backend/src/modules/ingest/ingest-key.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { IngestKeysService } from './ingest-keys.service';
import { IngestUnauthorizedException } from '../../common/exceptions';

/** `Authorization: Bearer mpk_…` → `request.ingestKey`. Admin JWTs are not accepted here. */
@Injectable()
export class IngestKeyGuard implements CanActivate {
  constructor(private readonly keys: IngestKeysService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const m = /^Bearer (\S+)$/.exec(req.headers?.authorization ?? '');
    const row = m ? await this.keys.verify(m[1]) : null;
    if (!row) throw new IngestUnauthorizedException();
    req.ingestKey = row;
    return true;
  }
}
```

- [ ] **Step 5: Run to see them pass**

Run: `cd backend && npx jest src/modules/ingest/ingest-key`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/common/exceptions backend/src/modules/ingest/ingest-keys.service.ts backend/src/modules/ingest/ingest-key.guard.ts backend/src/modules/ingest/ingest-key*.spec.ts
git commit -m "feat(ingest): machine keys and the Bearer guard"
```

---

### Task 4: Shards

**Files:**
- Create: `backend/src/modules/ingest/shards.service.ts`
- Test: `backend/src/modules/ingest/shards.service.spec.ts`

**Interfaces:**
- Produces:

```ts
export interface ShardSelector { state_ids?: number[]; region_ids?: number[]; district_ids?: number[]; const_no_ranges?: [number, number][] }
export interface ShardInfo { name: string; source_override: string | null; selector: ShardSelector | null; lease_holder: string | null; lease_key_id: string | null; lease_expires_at: Date | null; seat_ids: string[] }
class ShardsService {
  list(electionId: string): Promise<ShardInfo[]>;                  // named shards + 'rest' (last), each with its resolved seat ids
  get(electionId: string, name: string): Promise<ShardInfo>;        // IngestShardNotFoundException for an unknown name
  upsert(electionId: string, name: string, input: { selector: ShardSelector; source_override: string | null }): Promise<ShardInfo>; // IngestShardOverlapException
  remove(electionId: string, name: string): Promise<void>;
}
export function matchesSelector(seat: { state_id: number | null; region_id: number | null; district_id: number | null; const_no: number }, sel: ShardSelector): boolean;
```

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/modules/ingest/shards.service.spec.ts
import { ShardsService, matchesSelector } from './shards.service';
import { IngestShardNotFoundException, IngestShardOverlapException } from '../../common/exceptions';

const seats = [
  { id: 'S1', state_id: 1, region_id: 10, district_id: 100, const_no: 1 },
  { id: 'S2', state_id: 1, region_id: 11, district_id: 101, const_no: 2 },
  { id: 'S3', state_id: 2, region_id: 20, district_id: 200, const_no: 3 },
];

function make(shards: any[] = []) {
  const prisma: any = {
    constituencies: { findMany: jest.fn(async () => seats) },
    ingest_shards: {
      findMany: jest.fn(async () => shards),
      upsert: jest.fn(async ({ create }) => { shards.push({ ...create, lease_holder: null, lease_key_id: null, lease_expires_at: null }); return create; }),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    election_ingest: { findUnique: jest.fn(async () => null) },
  };
  return { svc: new ShardsService(prisma), prisma };
}

describe('matchesSelector', () => {
  it('is a union of its clauses', () => {
    expect(matchesSelector(seats[0], { state_ids: [2], const_no_ranges: [[1, 1]] })).toBe(true);
    expect(matchesSelector(seats[1], { state_ids: [2], const_no_ranges: [[1, 1]] })).toBe(false);
    expect(matchesSelector(seats[2], { region_ids: [20] })).toBe(true);
    expect(matchesSelector(seats[0], {})).toBe(false);
  });
});

describe('ShardsService', () => {
  it('with no shards, rest is the whole election', async () => {
    const { svc } = make();
    expect(await svc.list('e')).toEqual([expect.objectContaining({ name: 'rest', seat_ids: ['S1', 'S2', 'S3'] })]);
  });
  it('rest is every seat in no named shard', async () => {
    const { svc } = make([{ name: 'north', selector: { state_ids: [1] }, source_override: null }]);
    const list = await svc.list('e');
    expect(list.map(s => [s.name, s.seat_ids])).toEqual([['north', ['S1', 'S2']], ['rest', ['S3']]]);
  });
  it('refuses a shard that overlaps another', async () => {
    const { svc } = make([{ name: 'north', selector: { state_ids: [1] }, source_override: null }]);
    await expect(svc.upsert('e', 'two', { selector: { const_no_ranges: [[2, 3]] }, source_override: null })).rejects.toBeInstanceOf(IngestShardOverlapException);
    await expect(svc.upsert('e', 'south', { selector: { state_ids: [2] }, source_override: null })).resolves.toMatchObject({ name: 'south', seat_ids: ['S3'] });
  });
  it('editing a shard does not overlap with itself; an unknown name is a 404', async () => {
    const { svc } = make([{ name: 'north', selector: { state_ids: [1] }, source_override: null }]);
    await expect(svc.upsert('e', 'north', { selector: { region_ids: [10] }, source_override: null })).resolves.toBeTruthy();
    await expect(svc.get('e', 'nope')).rejects.toBeInstanceOf(IngestShardNotFoundException);
  });
  it('refuses an empty selector and the reserved name', async () => {
    const { svc } = make();
    await expect(svc.upsert('e', 'x', { selector: {}, source_override: null })).rejects.toThrow(/empty/);
    await expect(svc.upsert('e', 'rest', { selector: { state_ids: [1] }, source_override: null })).rejects.toThrow(/reserved/);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `cd backend && npx jest src/modules/ingest/shards.service.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/ingest/shards.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestBadRequestException, IngestShardNotFoundException, IngestShardOverlapException } from '../../common/exceptions';

export interface ShardSelector { state_ids?: number[]; region_ids?: number[]; district_ids?: number[]; const_no_ranges?: [number, number][] }
export interface ShardInfo { name: string; source_override: string | null; selector: ShardSelector | null; lease_holder: string | null; lease_key_id: string | null; lease_expires_at: Date | null; seat_ids: string[] }
type SeatKey = { id: string; state_id: number | null; region_id: number | null; district_id: number | null; const_no: number };

export const REST = 'rest';

/** Union of the selector's clauses; an empty selector matches nothing. */
export function matchesSelector(seat: Omit<SeatKey, 'id'>, sel: ShardSelector): boolean {
  return (!!seat.state_id && !!sel.state_ids?.includes(seat.state_id))
    || (!!seat.region_id && !!sel.region_ids?.includes(seat.region_id))
    || (!!seat.district_id && !!sel.district_ids?.includes(seat.district_id))
    || !!sel.const_no_ranges?.some(([a, b]) => seat.const_no >= a && seat.const_no <= b);
}
const isEmpty = (s: ShardSelector) => !s.state_ids?.length && !s.region_ids?.length && !s.district_ids?.length && !s.const_no_ranges?.length;

/** Named, non-overlapping seat sets per election; "rest" (implicit, its lease on election_ingest) is every other seat. */
@Injectable()
export class ShardsService {
  constructor(private readonly prisma: PrismaService) {}

  private seats(electionId: string): Promise<SeatKey[]> {
    return this.prisma.constituencies.findMany({ where: { election_id: electionId }, select: { id: true, state_id: true, region_id: true, district_id: true, const_no: true }, orderBy: { const_no: 'asc' } });
  }

  async list(electionId: string): Promise<ShardInfo[]> {
    const [seats, rows, ingest] = await Promise.all([
      this.seats(electionId),
      this.prisma.ingest_shards.findMany({ where: { election_id: electionId }, orderBy: { name: 'asc' } }),
      this.prisma.election_ingest.findUnique({ where: { election_id: electionId } }),
    ]);
    const taken = new Set<string>();
    const named: ShardInfo[] = rows.map((r: any) => {
      const seat_ids = seats.filter(s => matchesSelector(s, r.selector as ShardSelector)).map(s => s.id);
      seat_ids.forEach(id => taken.add(id));
      return { name: r.name, source_override: r.source_override, selector: r.selector as ShardSelector, lease_holder: r.lease_holder, lease_key_id: r.lease_key_id, lease_expires_at: r.lease_expires_at, seat_ids };
    });
    const rest: ShardInfo = {
      name: REST, source_override: ingest?.rest_source_override ?? null, selector: null,
      lease_holder: ingest?.rest_lease_holder ?? null, lease_key_id: ingest?.rest_lease_key_id ?? null, lease_expires_at: ingest?.rest_lease_expires_at ?? null,
      seat_ids: seats.filter(s => !taken.has(s.id)).map(s => s.id),
    };
    return [...named, rest];
  }

  async get(electionId: string, name: string): Promise<ShardInfo> {
    const found = (await this.list(electionId)).find(s => s.name === name);
    if (!found) throw new IngestShardNotFoundException(name);
    return found;
  }

  async upsert(electionId: string, name: string, input: { selector: ShardSelector; source_override: string | null }): Promise<ShardInfo> {
    if (name === REST) throw new IngestBadRequestException('"rest" is reserved for the seats in no shard');
    if (isEmpty(input.selector)) throw new IngestBadRequestException('A shard selector cannot be empty');
    const seats = await this.seats(electionId);
    const mine = new Set(seats.filter(s => matchesSelector(s, input.selector)).map(s => s.id));
    for (const other of await this.prisma.ingest_shards.findMany({ where: { election_id: electionId } })) {
      if (other.name === name) continue;
      const clash = seats.filter(s => mine.has(s.id) && matchesSelector(s, other.selector as ShardSelector)).map(s => s.id);
      if (clash.length) throw new IngestShardOverlapException(other.name, clash.slice(0, 5));
    }
    await this.prisma.ingest_shards.upsert({
      where: { election_id_name: { election_id: electionId, name } },
      create: { election_id: electionId, name, selector: input.selector as any, source_override: input.source_override },
      update: { selector: input.selector as any, source_override: input.source_override },
    });
    return { name, source_override: input.source_override, selector: input.selector, lease_holder: null, lease_key_id: null, lease_expires_at: null, seat_ids: [...mine] };
  }

  async remove(electionId: string, name: string): Promise<void> {
    await this.prisma.ingest_shards.deleteMany({ where: { election_id: electionId, name } });
  }
}
```

(`upsert` returns lease fields as null for a new shard; the admin re-reads the list after saving, so a renamed selector on a leased shard shows its real lease there.)

- [ ] **Step 4: Run to see it pass**

Run: `cd backend && npx jest src/modules/ingest/shards.service.spec.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/ingest/shards.service.ts backend/src/modules/ingest/shards.service.spec.ts
git commit -m "feat(ingest): shards with an implicit rest shard and overlap check"
```

---

### Task 5: Leases

**Files:**
- Create: `backend/src/modules/ingest/lease.service.ts`
- Test: `backend/src/modules/ingest/lease.db.spec.ts` (atomic claim is SQL; test it against the DB)

**Interfaces:**
- Consumes: `REST` from `shards.service.ts`.
- Produces:

```ts
export const LEASE_TTL_MS = 90_000;
class LeaseService {
  claim(electionId: string, shard: string, keyId: string, holder: string, now?: Date): Promise<{ ok: true; expires_at: Date } | { ok: false; holder: string | null; expires_at: Date | null }>;
  release(electionId: string, shard: string, keyId: string, holder: string): Promise<void>;
  holds(electionId: string, shard: string, keyId: string, holder: string, now?: Date): Promise<boolean>;
  current(electionId: string, shard: string): Promise<{ holder: string | null; key: string | null; expires: Date | null } | null>;
}
```

A claim succeeds if the lease is free, expired, or already held by the same key **and** holder; it is one conditional `UPDATE … RETURNING` so two concurrent claims cannot both win. The rest shard uses the `rest_lease_*` columns of `election_ingest` (row created on first claim).

- [ ] **Step 1: Write the failing DB test**

```ts
// backend/src/modules/ingest/lease.db.spec.ts
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { LeaseService } from './lease.service';

config({ path: join(__dirname, '../../../.env') });
class Rollback extends Error {}
const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('LeaseService (DB)', () => {
  let prisma: PrismaClient | null = null;
  let eid: string | null = null;
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const c = new PrismaClient();
    try { await c.$queryRaw`SELECT 1 FROM ingest_shards LIMIT 1`; prisma = c; eid = (await c.elections.findFirst({ select: { id: true } }))?.id ?? null; }
    catch { await c.$disconnect(); }
  });
  afterAll(async () => prisma?.$disconnect());

  async function run(name: string, body: (svc: LeaseService, tx: any, keys: [string, string]) => Promise<void>) {
    if (!prisma || !eid) { if (REQUIRE_DB) throw new Error(`no DB (${name})`); console.warn(`SKIPPED (no DB): ${name}`); return; }
    await prisma.$transaction(async (tx) => {
      const k1 = await tx.ingest_keys.create({ data: { name: `t1-${Date.now()}`, key_hash: 'a'.repeat(63) + '1' } });
      const k2 = await tx.ingest_keys.create({ data: { name: `t2-${Date.now()}`, key_hash: 'a'.repeat(63) + '2' } });
      await tx.ingest_shards.create({ data: { election_id: eid!, name: 'north', selector: { state_ids: [1] } } });
      await body(new LeaseService(tx as any), tx, [k1.id, k2.id]);
      throw new Rollback();
    }, { timeout: 20_000 }).catch((e) => { if (!(e instanceof Rollback)) throw e; });
  }

  it('first claim wins; a second holder is refused until expiry, then takes over', async () => {
    await run('named shard', async (svc, _tx, [k1, k2]) => {
      const t0 = new Date('2027-02-27T09:00:00Z');
      expect(await svc.claim(eid!, 'north', k1, 'cloud', t0)).toMatchObject({ ok: true });
      expect(await svc.claim(eid!, 'north', k2, 'laptop', new Date(t0.getTime() + 30_000))).toMatchObject({ ok: false, holder: 'cloud' });
      expect(await svc.claim(eid!, 'north', k1, 'cloud', new Date(t0.getTime() + 60_000))).toMatchObject({ ok: true });
      expect(await svc.claim(eid!, 'north', k2, 'laptop', new Date(t0.getTime() + 151_000))).toMatchObject({ ok: true });
      expect(await svc.holds(eid!, 'north', k1, 'cloud', new Date(t0.getTime() + 151_000))).toBe(false);
      expect(await svc.holds(eid!, 'north', k2, 'laptop', new Date(t0.getTime() + 151_000))).toBe(true);
    });
  });

  it('the same key with another holder name is a different job; release frees the lease', async () => {
    await run('rest shard', async (svc, _tx, [k1]) => {
      const t0 = new Date('2027-02-27T09:00:00Z');
      expect(await svc.claim(eid!, 'rest', k1, 'a', t0)).toMatchObject({ ok: true });
      expect(await svc.claim(eid!, 'rest', k1, 'b', t0)).toMatchObject({ ok: false, holder: 'a' });
      await svc.release(eid!, 'rest', k1, 'a');
      expect(await svc.claim(eid!, 'rest', k1, 'b', t0)).toMatchObject({ ok: true });
    });
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `cd backend && npx jest src/modules/ingest/lease.db.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// backend/src/modules/ingest/lease.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REST } from './shards.service';

export const LEASE_TTL_MS = 90_000;
type Claim = { ok: true; expires_at: Date } | { ok: false; holder: string | null; expires_at: Date | null };

/** One writer per shard: a conditional UPDATE … RETURNING, so concurrent claims cannot both win. */
@Injectable()
export class LeaseService {
  constructor(private readonly prisma: PrismaService) {}

  async claim(electionId: string, shard: string, keyId: string, holder: string, now = new Date()): Promise<Claim> {
    const exp = new Date(now.getTime() + LEASE_TTL_MS);
    let rows: { expires: Date }[];
    if (shard === REST) {
      await this.prisma.$executeRaw`INSERT INTO election_ingest (election_id) VALUES (${electionId}::uuid) ON CONFLICT DO NOTHING`;
      rows = await this.prisma.$queryRaw`
        UPDATE election_ingest SET rest_lease_holder = ${holder}, rest_lease_key_id = ${keyId}::uuid, rest_lease_expires_at = ${exp}
        WHERE election_id = ${electionId}::uuid
          AND (rest_lease_expires_at IS NULL OR rest_lease_expires_at <= ${now}
               OR (rest_lease_key_id = ${keyId}::uuid AND rest_lease_holder = ${holder}))
        RETURNING rest_lease_expires_at AS expires`;
    } else {
      rows = await this.prisma.$queryRaw`
        UPDATE ingest_shards SET lease_holder = ${holder}, lease_key_id = ${keyId}::uuid, lease_expires_at = ${exp}
        WHERE election_id = ${electionId}::uuid AND name = ${shard}
          AND (lease_expires_at IS NULL OR lease_expires_at <= ${now}
               OR (lease_key_id = ${keyId}::uuid AND lease_holder = ${holder}))
        RETURNING lease_expires_at AS expires`;
    }
    if (rows.length) return { ok: true, expires_at: rows[0].expires };
    const cur = await this.current(electionId, shard);
    return { ok: false, holder: cur?.holder ?? null, expires_at: cur?.expires ?? null };
  }

  async release(electionId: string, shard: string, keyId: string, holder: string): Promise<void> {
    if (shard === REST) {
      await this.prisma.$executeRaw`UPDATE election_ingest SET rest_lease_expires_at = NULL
        WHERE election_id = ${electionId}::uuid AND rest_lease_key_id = ${keyId}::uuid AND rest_lease_holder = ${holder}`;
    } else {
      await this.prisma.$executeRaw`UPDATE ingest_shards SET lease_expires_at = NULL
        WHERE election_id = ${electionId}::uuid AND name = ${shard} AND lease_key_id = ${keyId}::uuid AND lease_holder = ${holder}`;
    }
  }

  async holds(electionId: string, shard: string, keyId: string, holder: string, now = new Date()): Promise<boolean> {
    const cur = await this.current(electionId, shard);
    return !!cur && cur.key === keyId && cur.holder === holder && !!cur.expires && cur.expires > now;
  }

  async current(electionId: string, shard: string): Promise<{ holder: string | null; key: string | null; expires: Date | null } | null> {
    if (shard === REST) {
      const r = await this.prisma.election_ingest.findUnique({ where: { election_id: electionId } });
      return r ? { holder: r.rest_lease_holder, key: r.rest_lease_key_id, expires: r.rest_lease_expires_at } : null;
    }
    const r = await this.prisma.ingest_shards.findUnique({ where: { election_id_name: { election_id: electionId, name: shard } } });
    return r ? { holder: r.lease_holder, key: r.lease_key_id, expires: r.lease_expires_at } : null;
  }
}
```

- [ ] **Step 4: Run to see it pass**

Run: `cd backend && npx jest src/modules/ingest/lease.db.spec.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/ingest/lease.service.ts backend/src/modules/ingest/lease.db.spec.ts
git commit -m "feat(ingest): per-shard leases with atomic claim"
```

---

### Task 6: Ingest service and machine-key API (roster, config, lease, seats)

**Files:**
- Create: `backend/src/modules/ingest/dto/ingest.dto.ts`, `backend/src/modules/ingest/ingest.service.ts`, `backend/src/modules/ingest/ingest.controller.ts`, `backend/src/modules/ingest/ingest.module.ts`
- Modify: `backend/src/app.module.ts` (import `IngestModule`), `backend/src/app.setup.ts` (5 MB body limit for `/api/v1/ingest`)
- Test: `backend/src/modules/ingest/ingest.service.spec.ts` (unit, mocked Prisma), `backend/src/modules/ingest/ingest.db.spec.ts` (DB), `backend/src/modules/ingest/ingest.dto.spec.ts`

**Interfaces:**
- Consumes: Task 2 `evaluateSeat`, `SEAT_STATES`, types; Task 3 `IngestKeysService`, `IngestKeyGuard`, exceptions; Task 4 `ShardsService.get`, `REST`; Task 5 `LeaseService.claim/holds/current/release`; existing `ResultChangeNotifier.afterCommit(electionId, rows: ChangedRow[], { kind: 'batch' })`.
- Produces:

```ts
export interface Roster {
  election: { id: string; type: string; state_id: number | null; year: number; status: string };
  parties: { id: string; name: string; abbreviation: string | null }[];
  seats: { const_id: string; const_no: number; name: string; type: string; state_id: number | null;
           candidates: { candidate_id: string; name: string; party_id: string | null }[] }[];
}
export interface IngestConfig { status: string; source: string | null; poll_hint_ms: number; shard: { name: string; seat_count: number }; lease: { holder: string | null; expires_at: Date | null } }
export type SeatOutcomeName = 'applied' | 'unchanged' | 'stale' | 'held' | 'rejected';
export interface SeatsResponse { counts: Record<SeatOutcomeName, number>; seats: { const_id: string; outcome: SeatOutcomeName; reason?: string; detail?: Record<string, unknown> }[] }
class IngestService {
  roster(electionId: string, shard?: string): Promise<Roster>;
  config(electionId: string, shard: string): Promise<IngestConfig>;
  effectiveSource(electionId: string, shard: { name: string; source_override: string | null }): Promise<string | null>;
  ingestSeats(electionId: string, key: { id: string }, body: SeatsBody, now?: Date): Promise<SeatsResponse>;
}
```

Routes (all `IngestKeyGuard`, `@SkipThrottle()`): `GET /ingest/elections/:id/roster?shard=`, `GET …/config?shard=` (default `rest`), `POST …/lease` `{ shard, holder }` → `{ expires_at }` or `409 INGEST_0004`, `DELETE …/lease?shard=&holder=`, `POST …/seats`.

**Effective source rule (resolves an ambiguity in spec §4.2):** election paused (`election_ingest.active_source` NULL or no row) → `null` for every shard; otherwise the shard's override, else the election's source. Pausing the election always pauses all shards.

**Holder in the seats body (fills a gap in spec §4.4):** the request carries `holder` (the name used to claim the lease); the lease check is `(key id, holder)`.

- [ ] **Step 1: DTOs and their test**

```ts
// backend/src/modules/ingest/dto/ingest.dto.ts
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import { SEAT_STATES, type SeatState } from '../seat-rules';

const SHARD = /^[a-z0-9][a-z0-9_-]{0,39}$/;
export const MAX_SEATS_PER_REQUEST = 500;

export class RoundDto {
  @IsInt() @Min(0) current: number;
  @IsInt() @Min(0) total: number;
}
export class SeatDto {
  @IsString() @MaxLength(100) const_id: string;
  @IsIn(SEAT_STATES as unknown as string[]) state: SeatState;
  @IsOptional() @ValidateNested() @Type(() => RoundDto) round?: RoundDto | null;
  /** candidate_id → votes; keys and values are checked by the seat rules (a bad seat is rejected, not the request). */
  @IsObject() votes: Record<string, number>;
}
export class SeatsBody {
  @Matches(SHARD) shard: string;
  @IsString() @MaxLength(40) source: string;
  @IsString() @MaxLength(80) holder: string;
  @IsISO8601({ strict: true }) observed_at: string;
  @IsOptional() @IsBoolean() dry_run?: boolean;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_SEATS_PER_REQUEST) @ValidateNested({ each: true }) @Type(() => SeatDto) seats: SeatDto[];
}
export class LeaseBody {
  @Matches(SHARD) shard: string;
  @IsString() @MaxLength(80) holder: string;
}
```

```ts
// backend/src/modules/ingest/ingest.dto.spec.ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SeatsBody } from './dto/ingest.dto';

const body = (over: Record<string, unknown> = {}) => plainToInstance(SeatsBody, {
  shard: 'rest', source: 'eci-web', holder: 'w1', observed_at: '2027-02-27T09:41:05+05:30',
  seats: [{ const_id: 'S1', state: 'counting', round: { current: 1, total: 20 }, votes: { a: 1 } }], ...over,
});

describe('SeatsBody', () => {
  it('accepts a valid body', async () => expect(await validate(body())).toEqual([]));
  it('rejects an unknown state, an empty or oversized batch, a bad shard name, a non-ISO time', async () => {
    expect((await validate(body({ seats: [{ const_id: 'S1', state: 'won', votes: {} }] }))).length).toBeGreaterThan(0);
    expect((await validate(body({ seats: [] }))).length).toBeGreaterThan(0);
    expect((await validate(body({ seats: Array.from({ length: 501 }, () => ({ const_id: 'S', state: 'counting', votes: {} })) }))).length).toBeGreaterThan(0);
    expect((await validate(body({ shard: 'Bad Name' }))).length).toBeGreaterThan(0);
    expect((await validate(body({ observed_at: 'yesterday' }))).length).toBeGreaterThan(0);
  });
});
```

Run: `cd backend && npx jest src/modules/ingest/ingest.dto.spec.ts` — Expected: pass.

- [ ] **Step 2: Write the failing service unit test (request-level checks and outcome assembly)**

```ts
// backend/src/modules/ingest/ingest.service.spec.ts
import { IngestService } from './ingest.service';
import { IngestBadRequestException, IngestInactiveSourceException, IngestNoLeaseException, IngestNotLiveException } from '../../common/exceptions';

const NOW = new Date('2027-02-27T04:12:00Z');
const roster = [
  { id: 'a', const_id: 'S1', party_id: 'BJP' }, { id: 'b', const_id: 'S1', party_id: 'INC' }, { id: 'n', const_id: 'S1', party_id: 'NOTA' },
  { id: 'c', const_id: 'S2', party_id: 'BJP' }, { id: 'd', const_id: 'S2', party_id: 'INC' },
];

function make(over: { status?: string; source?: string | null; lease?: boolean; seatIds?: string[] } = {}) {
  const prisma: any = {
    elections: { findUnique: jest.fn(async () => ({ status: over.status ?? 'Live' })) },
    election_ingest: { findUnique: jest.fn(async () => (over.source === null ? null : { active_source: over.source ?? 'eci-web' })) },
    candidates: { findMany: jest.fn(async ({ where }) => roster.filter(r => where.const_id.in.includes(r.const_id))) },
    seat_ingest_state: { findMany: jest.fn(async () => []) },
    results: { findMany: jest.fn(async () => []) },
    seat_holds: { findMany: jest.fn(async () => []) },
    ingest_log: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
    $executeRaw: jest.fn(async () => 1),
  };
  const shards: any = { get: jest.fn(async (_e: string, name: string) => ({ name, source_override: null, seat_ids: over.seatIds ?? ['S1', 'S2'] })) };
  const leases: any = { holds: jest.fn(async () => over.lease ?? true), current: jest.fn(async () => ({ holder: 'other', key: 'k9', expires: NOW })) };
  const notifier: any = { afterCommit: jest.fn(async () => undefined) };
  return { svc: new IngestService(prisma, shards, leases, notifier), prisma, notifier };
}
const body = (seats: any[], over: Record<string, unknown> = {}) => ({ shard: 'rest', source: 'eci-web', holder: 'w1', observed_at: '2027-02-27T09:41:05+05:30', seats, ...over }) as any;
const s1 = { const_id: 'S1', state: 'counting', round: { current: 3, total: 20 }, votes: { a: 50, b: 40, n: 5 } };

describe('IngestService.ingestSeats — request checks', () => {
  it('refuses a non-Live election, an inactive source, a missing lease, a future observed_at', async () => {
    await expect(make({ status: 'Finalized' }).svc.ingestSeats('e', { id: 'k' }, body([s1]), NOW)).rejects.toBeInstanceOf(IngestNotLiveException);
    await expect(make({ source: 'news' }).svc.ingestSeats('e', { id: 'k' }, body([s1]), NOW)).rejects.toBeInstanceOf(IngestInactiveSourceException);
    await expect(make({ source: null }).svc.ingestSeats('e', { id: 'k' }, body([s1]), NOW)).rejects.toBeInstanceOf(IngestInactiveSourceException);
    await expect(make({ lease: false }).svc.ingestSeats('e', { id: 'k' }, body([s1]), NOW)).rejects.toBeInstanceOf(IngestNoLeaseException);
    await expect(make().svc.ingestSeats('e', { id: 'k' }, body([s1], { observed_at: '2027-02-27T04:15:00Z' }), NOW)).rejects.toBeInstanceOf(IngestBadRequestException);
  });

  it('a dry run skips Live/source/lease checks and writes nothing but the log', async () => {
    const { svc, prisma, notifier } = make({ status: 'Upcoming', source: 'other', lease: false });
    const out = await svc.ingestSeats('e', { id: 'k' }, body([s1], { dry_run: true }), NOW);
    expect(out.counts.applied).toBe(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.ingest_log.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dry_run: true }) }));
    expect(notifier.afterCommit).not.toHaveBeenCalled();
  });
});

describe('IngestService.ingestSeats — per seat', () => {
  it('one bad seat never blocks the others; a seat outside the shard or repeated is rejected', async () => {
    const { svc, notifier } = make({ seatIds: ['S1', 'S2'] });
    const out = await svc.ingestSeats('e', { id: 'k' }, body([
      s1,
      { const_id: 'S2', state: 'counting', votes: { c: 1 } },        // missing d
      { const_id: 'S9', state: 'counting', votes: {} },              // not in shard
      { ...s1 },                                                      // repeated
    ]), NOW);
    expect(out.counts).toEqual({ applied: 1, unchanged: 0, stale: 0, held: 0, rejected: 3 });
    expect(out.seats.map(s => [s.const_id, s.outcome, s.reason])).toEqual([
      ['S1', 'applied', undefined], ['S2', 'rejected', 'roster_mismatch'], ['S9', 'rejected', 'not_in_shard'], ['S1', 'rejected', 'duplicate_seat'],
    ]);
    expect(notifier.afterCommit).toHaveBeenCalledWith('e', [{ const_id: 'S1', p: 'BJP', m: 10, s: 'LEADING', r: 3, cr: 3, tr: 20 }], { kind: 'batch' });
  });
});
```

- [ ] **Step 3: Run to see it fail**

Run: `cd backend && npx jest src/modules/ingest/ingest.service.spec.ts` — Expected: FAIL, module not found.

- [ ] **Step 4: Implement the service**

```ts
// backend/src/modules/ingest/ingest.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResultChangeNotifier, type ChangedRow } from '../live/result-change-notifier';
import { ShardsService, REST } from './shards.service';
import { LeaseService } from './lease.service';
import { evaluateSeat, type IncomingSeat, type RosterCandidate, type SeatOutcome, type SeatState, type StoredRow, type StoredSeat } from './seat-rules';
import { ElectionNotFoundException, IngestBadRequestException, IngestInactiveSourceException, IngestNoLeaseException, IngestNotLiveException } from '../../common/exceptions';
import type { SeatsBody } from './dto/ingest.dto';

export interface Roster {
  election: { id: string; type: string; state_id: number | null; year: number; status: string };
  parties: { id: string; name: string; abbreviation: string | null }[];
  seats: { const_id: string; const_no: number; name: string; type: string; state_id: number | null; candidates: { candidate_id: string; name: string; party_id: string | null }[] }[];
}
export interface IngestConfig { status: string; source: string | null; poll_hint_ms: number; shard: { name: string; seat_count: number }; lease: { holder: string | null; expires_at: Date | null } }
export type SeatOutcomeName = 'applied' | 'unchanged' | 'stale' | 'held' | 'rejected';
export interface SeatsResponse { counts: Record<SeatOutcomeName, number>; seats: { const_id: string; outcome: SeatOutcomeName; reason?: string; detail?: Record<string, unknown> }[] }

const FUTURE_SLACK_MS = 2 * 60_000;
const POLL_HINT_MS = 30_000;
const TX = { timeout: 60_000, maxWait: 10_000 };

type Evaluated = { seat: IncomingSeat; outcome: SeatOutcome | { kind: 'rejected'; reason: string; detail?: Record<string, unknown> } };

/** Spec §4: the machine-key API. Rules live in seat-rules.ts; this loads, writes and logs. */
@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly shards: ShardsService,
    private readonly leases: LeaseService,
    private readonly notifier: ResultChangeNotifier,
  ) {}

  async roster(electionId: string, shard?: string): Promise<Roster> {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { id: true, type: true, state_id: true, year: true, status: true } });
    if (!election) throw new ElectionNotFoundException(electionId);
    const only = shard ? new Set((await this.shards.get(electionId, shard)).seat_ids) : null;
    const seats = await this.prisma.constituencies.findMany({
      where: { election_id: electionId }, orderBy: { const_no: 'asc' },
      select: { id: true, const_no: true, name: true, type: true, state_id: true },
    });
    const cands = await this.prisma.candidates.findMany({ where: { election_id: electionId }, select: { id: true, const_id: true, name: true, party_id: true }, orderBy: { name: 'asc' } });
    const partyIds = [...new Set(cands.map(c => c.party_id).filter((p): p is string => !!p))];
    const parties = await this.prisma.parties.findMany({ where: { id: { in: partyIds } }, select: { id: true, name: true, abbreviation: true }, orderBy: { id: 'asc' } });
    const byConst = new Map<string, Roster['seats'][number]['candidates']>();
    for (const c of cands) (byConst.get(c.const_id) ?? byConst.set(c.const_id, []).get(c.const_id)!).push({ candidate_id: c.id, name: c.name, party_id: c.party_id });
    return {
      election: { ...election, type: String(election.type), status: String(election.status) },
      parties,
      seats: seats.filter(s => !only || only.has(s.id)).map(s => ({ const_id: s.id, const_no: s.const_no, name: s.name, type: String(s.type), state_id: s.state_id, candidates: byConst.get(s.id) ?? [] })),
    };
  }

  async effectiveSource(electionId: string, shard: { name: string; source_override: string | null }): Promise<string | null> {
    const ingest = await this.prisma.election_ingest.findUnique({ where: { election_id: electionId } });
    if (!ingest?.active_source) return null;
    return shard.source_override ?? ingest.active_source;
  }

  async config(electionId: string, shardName: string): Promise<IngestConfig> {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { status: true } });
    if (!election) throw new ElectionNotFoundException(electionId);
    const shard = await this.shards.get(electionId, shardName);
    return {
      status: String(election.status), source: await this.effectiveSource(electionId, shard), poll_hint_ms: POLL_HINT_MS,
      shard: { name: shard.name, seat_count: shard.seat_ids.length },
      lease: { holder: shard.lease_holder, expires_at: shard.lease_expires_at },
    };
  }

  async ingestSeats(electionId: string, key: { id: string }, body: SeatsBody, now = new Date()): Promise<SeatsResponse> {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { status: true } });
    if (!election) throw new ElectionNotFoundException(electionId);
    const dry = !!body.dry_run;
    const observedAt = new Date(body.observed_at);
    if (observedAt.getTime() > now.getTime() + FUTURE_SLACK_MS) throw new IngestBadRequestException('observed_at is in the future', { observed_at: body.observed_at });
    if (!dry && election.status !== 'Live') throw new IngestNotLiveException(String(election.status));
    const shard = await this.shards.get(electionId, body.shard);
    const source = await this.effectiveSource(electionId, shard);
    if (!dry && body.source !== source) throw new IngestInactiveSourceException(source);
    if (!dry && !(await this.leases.holds(electionId, shard.name, key.id, body.holder, now))) {
      const cur = await this.leases.current(electionId, shard.name);
      throw new IngestNoLeaseException(cur?.holder ?? null, cur?.expires ?? null);
    }

    const inShard = new Set(shard.seat_ids);
    const ids = [...new Set(body.seats.map(s => s.const_id).filter(id => inShard.has(id)))];
    const [cands, states, rows, holds] = await Promise.all([
      this.prisma.candidates.findMany({ where: { election_id: electionId, const_id: { in: ids } }, select: { id: true, const_id: true, party_id: true } }),
      this.prisma.seat_ingest_state.findMany({ where: { election_id: electionId, const_id: { in: ids } } }),
      this.prisma.results.findMany({ where: { election_id: electionId, const_id: { in: ids } }, select: { candidate_id: true, const_id: true, votes: true, status: true, margin: true } }),
      this.prisma.seat_holds.findMany({ where: { election_id: electionId, const_id: { in: ids } } }),
    ]);
    const rosterOf = group(cands, c => c.const_id, (c): RosterCandidate => ({ candidate_id: c.id, party_id: c.party_id }));
    const rowsOf = group(rows, r => r.const_id, (r): StoredRow => ({ candidate_id: r.candidate_id, votes: r.votes, status: r.status as StoredRow['status'], margin: r.margin }));
    const stateOf = new Map(states.map(s => [s.const_id, s]));
    const holdOf = new Map(holds.map(h => [h.const_id, h]));

    const seen = new Set<string>();
    const evaluated: Evaluated[] = body.seats.map(raw => {
      const seat: IncomingSeat = { const_id: raw.const_id, state: raw.state, round: raw.round ?? null, votes: raw.votes };
      if (!inShard.has(seat.const_id)) return { seat, outcome: { kind: 'rejected', reason: 'not_in_shard' } };
      if (seen.has(seat.const_id)) return { seat, outcome: { kind: 'rejected', reason: 'duplicate_seat' } };
      seen.add(seat.const_id);
      const st = stateOf.get(seat.const_id);
      const stored: StoredSeat | null = st ? { state: st.state as SeatState, round_current: st.round_current, round_total: st.round_total, last_source: st.last_source, last_observed_at: st.last_observed_at } : null;
      const h = holdOf.get(seat.const_id);
      return { seat, outcome: evaluateSeat({ seat, roster: rosterOf.get(seat.const_id) ?? [], stored, storedRows: rowsOf.get(seat.const_id) ?? [], hold: h ? { round_at_hold: h.round_at_hold, expires_at: h.expires_at } : null, source: body.source, observedAt, now }) };
    });

    const response = summarise(evaluated);
    const log = { election_id: electionId, shard: shard.name, key_id: key.id, source: body.source, dry_run: dry, observed_at: observedAt,
      counts: response.counts as unknown as Prisma.InputJsonValue,
      rejected: response.seats.filter(s => s.outcome === 'rejected').map(s => ({ const_id: s.const_id, reason: s.reason })) as unknown as Prisma.InputJsonValue };
    if (dry) {
      await this.prisma.ingest_log.create({ data: log });
      return response;
    }
    await this.prisma.$transaction(async tx => {
      await this.write(tx as any, electionId, evaluated, body.source, observedAt, now);
      await (tx as any).ingest_log.create({ data: log });
    }, TX);

    const changed = changedRows(evaluated, rosterOf);
    if (changed.length) await this.notifier.afterCommit(electionId, changed, { kind: 'batch' });
    return response;
  }

  /** One transaction: results rows, rounds, seat state, released holds. Unchanged seats only advance their observation. */
  async write(tx: PrismaService, electionId: string, evaluated: Evaluated[], source: string, observedAt: Date, now: Date): Promise<void> {
    const applied = evaluated.filter(e => e.outcome.kind === 'applied') as { seat: IncomingSeat; outcome: Extract<SeatOutcome, { kind: 'applied' }> }[];
    const touched = evaluated.filter(e => e.outcome.kind === 'applied' || e.outcome.kind === 'unchanged');
    const released = evaluated.filter(e => (e.outcome.kind === 'applied' || e.outcome.kind === 'unchanged') && (e.outcome as any).releaseHold).map(e => e.seat.const_id);

    const flat = applied.flatMap(a => a.outcome.rows.map(r => ({ ...r, round: a.seat.round?.current ?? null })));
    if (flat.length) {
      await tx.$executeRaw`
        UPDATE results AS r SET votes = u.votes, status = u.status::result_status, margin = u.margin,
               round_no = COALESCE(u.round_no, r.round_no), last_updated = ${now}
        FROM UNNEST(${flat.map(r => r.candidate_id)}::uuid[], ${flat.map(r => r.votes)}::int[], ${flat.map(r => r.status)}::text[],
                    ${flat.map(r => r.margin)}::int[], ${flat.map(r => r.round)}::int[]) AS u(cid, votes, status, margin, round_no)
        WHERE r.candidate_id = u.cid AND r.election_id = ${electionId}::uuid`;
    }
    const withRound = applied.filter(a => a.seat.round);
    if (withRound.length) {
      await tx.$executeRaw`
        UPDATE constituencies AS c SET current_round = u.cr, total_rounds = u.tr
        FROM UNNEST(${withRound.map(a => a.seat.const_id)}::varchar[], ${withRound.map(a => a.seat.round!.current)}::int[], ${withRound.map(a => a.seat.round!.total)}::int[]) AS u(id, cr, tr)
        WHERE c.id = u.id AND c.election_id = ${electionId}::uuid`;
    }
    if (touched.length) {
      await tx.$executeRaw`
        INSERT INTO seat_ingest_state (election_id, const_id, state, round_current, round_total, last_source, last_observed_at, last_applied_at)
        SELECT ${electionId}::uuid, u.id, u.state, u.rc, u.rt, ${source}, ${observedAt}, CASE WHEN u.applied THEN ${now}::timestamptz END
        FROM UNNEST(${touched.map(t => t.seat.const_id)}::varchar[], ${touched.map(t => t.seat.state)}::text[],
                    ${touched.map(t => t.seat.round?.current ?? null)}::int[], ${touched.map(t => t.seat.round?.total ?? null)}::int[],
                    ${touched.map(t => t.outcome.kind === 'applied')}::bool[]) AS u(id, state, rc, rt, applied)
        ON CONFLICT (election_id, const_id) DO UPDATE SET
          state = EXCLUDED.state, round_current = EXCLUDED.round_current, round_total = EXCLUDED.round_total,
          last_source = EXCLUDED.last_source, last_observed_at = EXCLUDED.last_observed_at,
          last_applied_at = COALESCE(EXCLUDED.last_applied_at, seat_ingest_state.last_applied_at)`;
    }
    if (released.length) {
      await tx.$executeRaw`DELETE FROM seat_holds WHERE election_id = ${electionId}::uuid AND const_id = ANY(${released}::varchar[])`;
    }
  }
}

function group<T, V>(items: T[], key: (t: T) => string, map: (t: T) => V): Map<string, V[]> {
  const m = new Map<string, V[]>();
  for (const it of items) { const k = key(it); (m.get(k) ?? m.set(k, []).get(k)!).push(map(it)); }
  return m;
}

function summarise(evaluated: Evaluated[]): SeatsResponse {
  const counts: Record<SeatOutcomeName, number> = { applied: 0, unchanged: 0, stale: 0, held: 0, rejected: 0 };
  const seats: SeatsResponse['seats'] = [];
  for (const { seat, outcome } of evaluated) {
    counts[outcome.kind]++;
    if (outcome.kind === 'unchanged') continue;
    seats.push({ const_id: seat.const_id, outcome: outcome.kind, ...(outcome.kind === 'rejected' ? { reason: outcome.reason, ...(outcome.detail ? { detail: outcome.detail } : {}) } : {}) });
  }
  return { counts, seats };
}

/** One Live Console row per applied seat: the leader (or the top non-NOTA row when there is none). */
function changedRows(evaluated: Evaluated[], rosterOf: Map<string, RosterCandidate[]>): ChangedRow[] {
  const out: ChangedRow[] = [];
  for (const { seat, outcome } of evaluated) {
    if (outcome.kind !== 'applied') continue;
    const party = new Map((rosterOf.get(seat.const_id) ?? []).map(c => [c.candidate_id, c.party_id]));
    const ranked = outcome.rows.filter(r => party.get(r.candidate_id) !== 'NOTA');
    const lead = ranked.find(r => r.status === 'LEADING' || r.status === 'WON') ?? [...ranked].sort((a, b) => b.votes - a.votes)[0];
    const p = lead ? party.get(lead.candidate_id) : null;
    if (!lead || !p) continue;
    out.push({ const_id: seat.const_id, p, m: lead.margin, s: lead.status, ...(seat.round ? { r: seat.round.current, cr: seat.round.current, tr: seat.round.total } : {}) });
  }
  return out;
}

export { REST };
```

- [ ] **Step 5: Controller, module, body limit**

```ts
// backend/src/modules/ingest/ingest.controller.ts
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { IngestKeyGuard } from './ingest-key.guard';
import { IngestService } from './ingest.service';
import { LeaseService } from './lease.service';
import { LeaseBody, SeatsBody } from './dto/ingest.dto';
import { REST } from './shards.service';
import { IngestNoLeaseException } from '../../common/exceptions';

/** Spec §4: machine-key routes. Not admin JWTs; every response is no-store (Authorization header). */
@Controller('ingest/elections/:electionId')
@UseGuards(IngestKeyGuard)
@SkipThrottle()
export class IngestController {
  constructor(private readonly ingest: IngestService, private readonly leases: LeaseService) {}

  @Get('roster')
  roster(@Param('electionId', ParseUUIDPipe) id: string, @Query('shard') shard?: string) {
    return this.ingest.roster(id, shard || undefined);
  }

  @Get('config')
  config(@Param('electionId', ParseUUIDPipe) id: string, @Query('shard') shard?: string) {
    return this.ingest.config(id, shard || REST);
  }

  @Post('lease')
  @HttpCode(200)
  async lease(@Param('electionId', ParseUUIDPipe) id: string, @Body() body: LeaseBody, @Req() req: any) {
    const r = await this.leases.claim(id, body.shard, req.ingestKey.id, body.holder);
    if (!r.ok) throw new IngestNoLeaseException(r.holder, r.expires_at);
    return { expires_at: r.expires_at };
  }

  @Delete('lease')
  async release(@Param('electionId', ParseUUIDPipe) id: string, @Query('shard') shard: string, @Query('holder') holder: string, @Req() req: any) {
    await this.leases.release(id, shard || REST, req.ingestKey.id, holder ?? '');
    return { released: true };
  }

  @Post('seats')
  @HttpCode(200)
  seats(@Param('electionId', ParseUUIDPipe) id: string, @Body() body: SeatsBody, @Req() req: any) {
    return this.ingest.ingestSeats(id, req.ingestKey, body);
  }
}
```

```ts
// backend/src/modules/ingest/ingest.module.ts
import { Module } from '@nestjs/common';
import { LiveModule } from '../live/live.module';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { IngestKeysService } from './ingest-keys.service';
import { IngestKeyGuard } from './ingest-key.guard';
import { ShardsService } from './shards.service';
import { LeaseService } from './lease.service';

@Module({
  imports: [LiveModule],
  controllers: [IngestController],
  providers: [IngestService, IngestKeysService, IngestKeyGuard, ShardsService, LeaseService],
  exports: [IngestService, IngestKeysService, ShardsService, LeaseService],
})
export class IngestModule {}
```

Add `IngestModule` to `imports` in `backend/src/app.module.ts` (after `LiveModule` / `AdminModule` — wherever the feature modules are listed).

In `backend/src/app.setup.ts`, next to the bulk override constants and middleware:

```ts
/** Ingest seat batches: MAX_SEATS_PER_REQUEST (500) × ~20 candidates × ~60 B ≈ 0.6 MB. */
export const INGEST_PATH = `/${API_PREFIX}/ingest`;
export const INGEST_BODY_LIMIT = '5mb';
```

and, before `app.use(json({ limit: DEFAULT_BODY_LIMIT }))`:

```ts
  app.use(INGEST_PATH, requireBearerHeader, json({ limit: INGEST_BODY_LIMIT }));
```

- [ ] **Step 6: Run the unit tests**

Run: `cd backend && npx jest src/modules/ingest && npx tsc --noEmit`
Expected: pass; no type errors.

- [ ] **Step 7: Write the DB test (real transaction, rolled back)**

```ts
// backend/src/modules/ingest/ingest.db.spec.ts
/** IngestService.write + the live-version triggers against the local DB; rolled back. */
import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { IngestService } from './ingest.service';

config({ path: join(__dirname, '../../../.env') });
class Rollback extends Error {}
const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('ingest write (DB)', () => {
  let prisma: PrismaClient | null = null;
  let seat: { election_id: string; const_id: string; cands: { id: string; party_id: string | null }[] } | null = null;
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const c = new PrismaClient();
    try {
      await c.$queryRaw`SELECT 1 FROM seat_ingest_state LIMIT 1`;
      prisma = c;
      const r = await c.results.findFirst({ select: { election_id: true, const_id: true } });
      if (r) seat = { ...r, cands: await c.candidates.findMany({ where: { election_id: r.election_id, const_id: r.const_id }, select: { id: true, party_id: true } }) };
    } catch { await c.$disconnect(); }
  });
  afterAll(async () => prisma?.$disconnect());

  async function run(name: string, body: (svc: IngestService, tx: any, notifier: any) => Promise<void>) {
    if (!prisma || !seat) { if (REQUIRE_DB) throw new Error(`no DB (${name})`); console.warn(`SKIPPED (no DB): ${name}`); return; }
    await prisma.$transaction(async (tx) => {
      await tx.elections.update({ where: { id: seat!.election_id }, data: { status: 'Live' } });
      await tx.election_ingest.upsert({ where: { election_id: seat!.election_id }, create: { election_id: seat!.election_id, active_source: 'test' }, update: { active_source: 'test' } });
      // Run the service against this transaction: $transaction(fn) runs fn on the same tx.
      const db: any = new Proxy(tx, { get: (t: any, p) => (p === '$transaction' ? (fn: any) => fn(t) : t[p]) });
      const shards: any = { get: async () => ({ name: 'rest', source_override: null, seat_ids: [seat!.const_id], lease_holder: null, lease_expires_at: null }) };
      const leases: any = { holds: async () => true, current: async () => null };
      const notifier = { afterCommit: jest.fn(async () => undefined) };
      await body(new IngestService(db, shards, leases, notifier as any), tx, notifier);
      throw new Rollback();
    }, { timeout: 30_000 }).catch((e) => { if (!(e instanceof Rollback)) throw e; });
  }
  const version = async (tx: any) => BigInt((await tx.election_live_state.findUnique({ where: { election_id: seat!.election_id } }))?.version ?? 0n);
  const votes = (base: number) => Object.fromEntries(seat!.cands.map((c, i) => [c.id, c.party_id === 'NOTA' ? 1 : base + (seat!.cands.length - i) * 10]));
  const req = (v: Record<string, number>, round: number, at: string) => ({ shard: 'rest', source: 'test', holder: 'h', observed_at: at, seats: [{ const_id: seat!.const_id, state: 'counting', round: { current: round, total: 20 }, votes: v }] }) as any;

  it('applies a seat, then an identical repeat is unchanged and bumps no version', async () => {
    await run('apply then repeat', async (svc, tx) => {
      const now = new Date('2027-02-27T04:12:00Z');
      const a = await svc.ingestSeats(seat!.election_id, { id: 'k' }, req(votes(1000), 3, '2027-02-27T04:11:00Z'), now);
      expect(a.counts.applied).toBe(1);
      const stored = await tx.results.findMany({ where: { election_id: seat!.election_id, const_id: seat!.const_id }, select: { status: true } });
      expect(stored.filter((r: any) => r.status === 'LEADING')).toHaveLength(1);
      const v1 = await version(tx);
      const b = await svc.ingestSeats(seat!.election_id, { id: 'k' }, req(votes(1000), 3, '2027-02-27T04:11:30Z'), now);
      expect(b.counts.unchanged).toBe(1);
      expect(await version(tx)).toBe(v1);
    });
  });

  it('an older round is stale and changes nothing', async () => {
    await run('stale', async (svc, tx) => {
      const now = new Date('2027-02-27T04:12:00Z');
      await svc.ingestSeats(seat!.election_id, { id: 'k' }, req(votes(1000), 5, '2027-02-27T04:11:00Z'), now);
      const out = await svc.ingestSeats(seat!.election_id, { id: 'k' }, req(votes(10), 4, '2027-02-27T04:11:30Z'), now);
      expect(out.counts.stale).toBe(1);
      const st = await tx.seat_ingest_state.findUnique({ where: { election_id_const_id: { election_id: seat!.election_id, const_id: seat!.const_id } } });
      expect(st.round_current).toBe(5);
    });
  });
});
```

Run: `cd backend && npx jest src/modules/ingest/ingest.db.spec.ts` — Expected: 2 passed (not SKIPPED).

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/ingest backend/src/app.module.ts backend/src/app.setup.ts
git commit -m "feat(ingest): roster, config, lease and seats API with one-transaction writes"
```

---

### Task 7: Tally check, ingest status, health endpoint and alerts

**Files:**
- Create: `backend/src/modules/ingest/ingest-status.service.ts`, `backend/src/modules/ingest/ingest-alerts.service.ts`, `backend/src/modules/ingest/ingest-health.controller.ts`
- Modify: `backend/src/modules/ingest/dto/ingest.dto.ts` (TallyBody), `ingest.service.ts` (`tally`), `ingest.controller.ts` (`POST tally`), `ingest.module.ts`, `.env.example` (`INGEST_ALERT_WEBHOOK_URL`)
- Test: `backend/src/modules/ingest/ingest-status.service.spec.ts`, `backend/src/modules/ingest/ingest-alerts.service.spec.ts`, add a tally case to `ingest.service.spec.ts`

**Interfaces:**
- Produces:

```ts
// IngestService
tally(electionId: string, key: { id: string }, body: TallyBody, now?: Date): Promise<{ mismatch: TallyMismatch[] }>;
export interface TallyMismatch { party_id: string; ours: { won: number; leading: number }; theirs: { won: number; leading: number } }
// IngestStatusService
export interface ShardStatus { name: string; seat_count: number; source: string | null; lease_holder: string | null; lease_expires_at: Date | null;
  last_post_at: Date | null; last_applied_at: Date | null; lag_s: number | null; recent: Record<string, number>; rejected: { const_id: string; reason: string }[]; tally_mismatch: TallyMismatch[] | null }
export interface IngestAlert { key: string; level: 'warn' | 'error'; election_id: string; shard: string; message: string }
status(electionId: string, now?: Date): Promise<{ election_id: string; status: string; active_source: string | null; hold_minutes: number; shards: ShardStatus[]; alerts: IngestAlert[] }>;
alertsFor(shard: ShardStatus, electionId: string, live: boolean, now: Date, prevTallyMismatch: boolean): IngestAlert[];  // exported pure helper
// GET /health/ingest → [{ election_id, shard, source, lease_holder, lease_expires_at, last_applied_at, lag_s, rejected_seats, tally_mismatch }] for Live elections
```

Alert thresholds (spec §5): lag > 180 s; lease expired for > 120 s with no new holder (and the shard has seats and a source); rejected seats in the latest non-dry post; tally mismatch in the last two tally posts.

- [ ] **Step 1: Tally DTO and service method (test first)**

Add to `ingest.dto.ts`:

```ts
export class TallyPartyDto {
  @IsString() @MaxLength(20) party_id: string;
  @IsInt() @Min(0) won: number;
  @IsInt() @Min(0) leading: number;
}
export class TallyBody {
  @Matches(SHARD) shard: string;
  @IsString() @MaxLength(40) source: string;
  @IsString() @MaxLength(80) holder: string;
  @IsISO8601({ strict: true }) observed_at: string;
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => TallyPartyDto) parties: TallyPartyDto[];
}
```

Add to `ingest.service.spec.ts`:

```ts
describe('IngestService.tally', () => {
  it('records the parties whose won/leading differ from ours for the shard', async () => {
    const { svc, prisma } = make();
    prisma.results.findMany = jest.fn(async () => [
      { status: 'WON', candidates: { party_id: 'BJP' } }, { status: 'LEADING', candidates: { party_id: 'INC' } },
    ]);
    const out = await svc.tally('e', { id: 'k' }, { shard: 'rest', source: 'eci-web', holder: 'w1', observed_at: '2027-02-27T09:41:05+05:30',
      parties: [{ party_id: 'BJP', won: 1, leading: 0 }, { party_id: 'INC', won: 0, leading: 2 }] } as any, NOW);
    expect(out.mismatch).toEqual([{ party_id: 'INC', ours: { won: 0, leading: 1 }, theirs: { won: 0, leading: 2 } }]);
    expect(prisma.ingest_log.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: 'tally' }) }));
  });
});
```

Implement in `IngestService` (same request checks as seats except dry run):

```ts
  async tally(electionId: string, key: { id: string }, body: TallyBody, now = new Date()): Promise<{ mismatch: TallyMismatch[] }> {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { status: true } });
    if (!election) throw new ElectionNotFoundException(electionId);
    if (election.status !== 'Live') throw new IngestNotLiveException(String(election.status));
    const shard = await this.shards.get(electionId, body.shard);
    const source = await this.effectiveSource(electionId, shard);
    if (body.source !== source) throw new IngestInactiveSourceException(source);
    if (!(await this.leases.holds(electionId, shard.name, key.id, body.holder, now))) {
      const cur = await this.leases.current(electionId, shard.name);
      throw new IngestNoLeaseException(cur?.holder ?? null, cur?.expires ?? null);
    }
    const rows = await this.prisma.results.findMany({
      where: { election_id: electionId, const_id: { in: shard.seat_ids }, status: { in: ['WON', 'LEADING'] } },
      select: { status: true, candidates: { select: { party_id: true } } },
    });
    const ours = new Map<string, { won: number; leading: number }>();
    for (const r of rows) {
      const p = r.candidates.party_id; if (!p) continue;
      const e = ours.get(p) ?? ours.set(p, { won: 0, leading: 0 }).get(p)!;
      if (r.status === 'WON') e.won++; else e.leading++;
    }
    const theirs = new Map(body.parties.map(p => [p.party_id, { won: p.won, leading: p.leading }]));
    const mismatch: TallyMismatch[] = [];
    for (const id of new Set([...ours.keys(), ...theirs.keys()])) {
      const o = ours.get(id) ?? { won: 0, leading: 0 }, t = theirs.get(id) ?? { won: 0, leading: 0 };
      if (o.won !== t.won || o.leading !== t.leading) mismatch.push({ party_id: id, ours: o, theirs: t });
    }
    await this.prisma.ingest_log.create({ data: { election_id: electionId, shard: shard.name, key_id: key.id, source: body.source, kind: 'tally', observed_at: new Date(body.observed_at), tally_mismatch: (mismatch.length ? mismatch : null) as any } });
    return { mismatch };
  }
```

Controller: `@Post('tally') @HttpCode(200) tally(@Param('electionId', ParseUUIDPipe) id, @Body() body: TallyBody, @Req() req) { return this.ingest.tally(id, req.ingestKey, body); }`

Run: `cd backend && npx jest src/modules/ingest/ingest.service.spec.ts` — Expected: pass.

- [ ] **Step 2: Status service with pure alert rules (test first)**

```ts
// backend/src/modules/ingest/ingest-status.service.spec.ts
import { alertsFor, type ShardStatus } from './ingest-status.service';

const NOW = new Date('2027-02-27T04:30:00Z');
const shard = (over: Partial<ShardStatus> = {}): ShardStatus => ({
  name: 'rest', seat_count: 126, source: 'eci-web', lease_holder: 'w1', lease_expires_at: new Date(NOW.getTime() + 60_000),
  last_post_at: NOW, last_applied_at: NOW, lag_s: 40, recent: {}, rejected: [], tally_mismatch: null, ...over,
});

describe('alertsFor', () => {
  it('a healthy shard has no alerts; a not-Live election never alerts', () => {
    expect(alertsFor(shard(), 'e', true, NOW, false)).toEqual([]);
    expect(alertsFor(shard({ lag_s: 999 }), 'e', false, NOW, false)).toEqual([]);
  });
  it('lag over 3 minutes', () => expect(alertsFor(shard({ lag_s: 181 }), 'e', true, NOW, false).map(a => a.key)).toEqual(['e:rest:lag']));
  it('a lease lapsed for over 2 minutes, only when the shard has a source', () => {
    const lapsed = shard({ lease_expires_at: new Date(NOW.getTime() - 121_000) });
    expect(alertsFor(lapsed, 'e', true, NOW, false).map(a => a.key)).toEqual(['e:rest:lease']);
    expect(alertsFor({ ...lapsed, source: null }, 'e', true, NOW, false)).toEqual([]);
  });
  it('rejected seats, and a tally mismatch twice in a row', () => {
    expect(alertsFor(shard({ rejected: [{ const_id: 'S1', reason: 'roster_mismatch' }] }), 'e', true, NOW, false).map(a => a.key)).toEqual(['e:rest:rejected']);
    const mm = shard({ tally_mismatch: [{ party_id: 'BJP', ours: { won: 1, leading: 0 }, theirs: { won: 2, leading: 0 } }] });
    expect(alertsFor(mm, 'e', true, NOW, false)).toEqual([]);
    expect(alertsFor(mm, 'e', true, NOW, true).map(a => a.key)).toEqual(['e:rest:tally']);
  });
});
```

```ts
// backend/src/modules/ingest/ingest-status.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShardsService } from './shards.service';
import { IngestService, type TallyMismatch } from './ingest.service';
import { ElectionNotFoundException } from '../../common/exceptions';

export interface ShardStatus { name: string; seat_count: number; source: string | null; lease_holder: string | null; lease_expires_at: Date | null;
  last_post_at: Date | null; last_applied_at: Date | null; lag_s: number | null; recent: Record<string, number>; rejected: { const_id: string; reason: string }[]; tally_mismatch: TallyMismatch[] | null }
export interface IngestAlert { key: string; level: 'warn' | 'error'; election_id: string; shard: string; message: string }

const LAG_S = 180;
const LEASE_GRACE_MS = 120_000;
const RECENT_POSTS = 10;

/** Spec §5 banners; pure so the thresholds are tested. */
export function alertsFor(s: ShardStatus, electionId: string, live: boolean, now: Date, prevTallyMismatch: boolean): IngestAlert[] {
  if (!live || s.seat_count === 0) return [];
  const out: IngestAlert[] = [];
  const a = (kind: string, level: IngestAlert['level'], message: string) => out.push({ key: `${electionId}:${s.name}:${kind}`, level, election_id: electionId, shard: s.name, message });
  if (s.lag_s !== null && s.lag_s > LAG_S) a('lag', 'warn', `Shard ${s.name} is ${Math.round(s.lag_s / 60)} min behind`);
  if (s.source && (!s.lease_expires_at || now.getTime() - s.lease_expires_at.getTime() > LEASE_GRACE_MS)) a('lease', 'error', `No job holds shard ${s.name}`);
  if (s.rejected.length) a('rejected', 'error', `${s.rejected.length} seat(s) rejected in shard ${s.name}`);
  if (s.tally_mismatch?.length && prevTallyMismatch) a('tally', 'warn', `Source tally differs from ours in shard ${s.name}`);
  return out;
}

@Injectable()
export class IngestStatusService {
  constructor(private readonly prisma: PrismaService, private readonly shards: ShardsService, private readonly ingest: IngestService) {}

  async status(electionId: string, now = new Date()) {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { status: true } });
    if (!election) throw new ElectionNotFoundException(electionId);
    const settings = await this.prisma.election_ingest.findUnique({ where: { election_id: electionId } });
    const live = election.status === 'Live';
    const shards: ShardStatus[] = [];
    const alerts = [];
    for (const sh of await this.shards.list(electionId)) {
      const posts = await this.prisma.ingest_log.findMany({ where: { election_id: electionId, shard: sh.name, kind: 'seats', dry_run: false }, orderBy: { received_at: 'desc' }, take: RECENT_POSTS });
      const tallies = await this.prisma.ingest_log.findMany({ where: { election_id: electionId, shard: sh.name, kind: 'tally' }, orderBy: { received_at: 'desc' }, take: 2 });
      const applied = await this.prisma.seat_ingest_state.aggregate({ where: { election_id: electionId, const_id: { in: sh.seat_ids } }, _max: { last_applied_at: true } });
      const recent: Record<string, number> = {};
      for (const p of posts) for (const [k, v] of Object.entries(p.counts as Record<string, number>)) recent[k] = (recent[k] ?? 0) + v;
      const latestObs = posts[0]?.observed_at ?? null;
      const s: ShardStatus = {
        name: sh.name, seat_count: sh.seat_ids.length, source: await this.ingest.effectiveSource(electionId, sh),
        lease_holder: sh.lease_holder, lease_expires_at: sh.lease_expires_at,
        last_post_at: posts[0]?.received_at ?? null, last_applied_at: applied._max.last_applied_at ?? null,
        lag_s: latestObs ? Math.max(0, Math.round((now.getTime() - latestObs.getTime()) / 1000)) : null,
        recent, rejected: (posts[0]?.rejected as { const_id: string; reason: string }[] | undefined) ?? [],
        tally_mismatch: (tallies[0]?.tally_mismatch as TallyMismatch[] | null) ?? null,
      };
      shards.push(s);
      alerts.push(...alertsFor(s, electionId, live, now, !!(tallies[1]?.tally_mismatch as unknown[] | null)?.length));
    }
    return { election_id: electionId, status: String(election.status), active_source: settings?.active_source ?? null, hold_minutes: settings?.hold_minutes ?? 10, shards, alerts };
  }
}
```

Run: `cd backend && npx jest src/modules/ingest/ingest-status.service.spec.ts` — Expected: pass.

- [ ] **Step 3: Health endpoint and webhook alerts (test first)**

```ts
// backend/src/modules/ingest/ingest-alerts.service.spec.ts
import { IngestAlertsService } from './ingest-alerts.service';

describe('IngestAlertsService.tick', () => {
  const alert = { key: 'e:rest:lag', level: 'warn', election_id: 'e', shard: 'rest', message: 'Shard rest is 4 min behind' };
  const make = (alerts: any[]) => {
    const prisma: any = { elections: { findMany: jest.fn(async () => [{ id: 'e', name: 'Assam 2026' }]) } };
    const status: any = { status: jest.fn(async () => ({ alerts })) };
    const post = jest.fn(async () => undefined);
    return { svc: new IngestAlertsService(prisma, status, 'https://hook', post), post };
  };
  it('posts a new alert once, not again within 15 minutes, again after', async () => {
    const { svc, post } = make([alert]);
    const t0 = new Date('2027-02-27T04:30:00Z');
    await svc.tick(t0); await svc.tick(new Date(t0.getTime() + 60_000));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toEqual({ text: '⚠️ Assam 2026 — Shard rest is 4 min behind' });
    await svc.tick(new Date(t0.getTime() + 16 * 60_000));
    expect(post).toHaveBeenCalledTimes(2);
  });
  it('without a webhook URL it does nothing', async () => {
    const prisma: any = { elections: { findMany: jest.fn() } };
    const svc = new IngestAlertsService(prisma, {} as any, undefined, jest.fn());
    await svc.tick(new Date());
    expect(prisma.elections.findMany).not.toHaveBeenCalled();
  });
});
```

```ts
// backend/src/modules/ingest/ingest-alerts.service.ts
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestStatusService } from './ingest-status.service';

export const ALERT_WEBHOOK_URL = 'INGEST_ALERT_WEBHOOK_URL';
export const ALERT_POST = 'INGEST_ALERT_POST';
const EVERY_MS = 60_000;
const REPEAT_MS = 15 * 60_000;
type Post = (url: string, body: { text: string }) => Promise<void>;

/** Spec §5: the Live Console's alerts, also posted to a webhook (Slack- and Telegram-bridge-compatible `{ text }`). */
@Injectable()
export class IngestAlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestAlertsService.name);
  private readonly sent = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly status: IngestStatusService,
    @Optional() @Inject(ALERT_WEBHOOK_URL) private readonly url: string | undefined,
    @Optional() @Inject(ALERT_POST) private readonly post: Post = async (u, b) => { await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); },
  ) {}

  onModuleInit() { if (this.url) this.timer = setInterval(() => void this.tick().catch(e => this.logger.warn(`alert tick failed: ${e.message}`)), EVERY_MS); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async tick(now = new Date()): Promise<void> {
    if (!this.url) return;
    for (const e of await this.prisma.elections.findMany({ where: { status: 'Live' }, select: { id: true, name: true } })) {
      for (const a of (await this.status.status(e.id, now)).alerts) {
        const last = this.sent.get(a.key);
        if (last && now.getTime() - last < REPEAT_MS) continue;
        this.sent.set(a.key, now.getTime());
        try { await this.post(this.url, { text: `${a.level === 'error' ? '🚨' : '⚠️'} ${e.name} — ${a.message}` }); }
        catch (err) { this.logger.warn(`alert webhook failed: ${(err as Error).message}`); }
      }
    }
  }
}
```

```ts
// backend/src/modules/ingest/ingest-health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestStatusService } from './ingest-status.service';

/** Spec §4.6: public-safe feed health for an uptime monitor (no seat names, no keys). */
@Controller('health')
export class IngestHealthController {
  constructor(private readonly prisma: PrismaService, private readonly status: IngestStatusService) {}

  @Get('ingest')
  async ingest() {
    const out = [];
    for (const e of await this.prisma.elections.findMany({ where: { status: 'Live' }, select: { id: true } })) {
      for (const s of (await this.status.status(e.id)).shards) {
        out.push({ election_id: e.id, shard: s.name, source: s.source, lease_holder: s.lease_holder, lease_expires_at: s.lease_expires_at,
          last_applied_at: s.last_applied_at, lag_s: s.lag_s, rejected_seats: s.rejected.length, tally_mismatch: !!s.tally_mismatch?.length });
      }
    }
    return out;
  }
}
```

Module: add `IngestStatusService`, `IngestAlertsService`, `{ provide: ALERT_WEBHOOK_URL, useFactory: () => process.env.INGEST_ALERT_WEBHOOK_URL || undefined }`, controller `IngestHealthController`; export `IngestStatusService`. Add to `.env.example`: `# Optional: Slack/Telegram-bridge webhook for live ingest alerts (lag, lapsed lease, rejected seats, tally mismatch)\nINGEST_ALERT_WEBHOOK_URL=`.

Check the existing health controller has no `@Get('ingest')` and that `health/*` is excluded from the cache-buster/throttle the same way (grep `health` in `app.setup.ts`); if health routes are throttle-exempt via `@SkipThrottle`, add it to `IngestHealthController` too.

Run: `cd backend && npx jest src/modules/ingest && npx tsc --noEmit` — Expected: pass.

- [ ] **Step 4: 30-day retention for `ingest_log` (spec §3)**

Add to `IngestAlertsService` a second timer that runs whether or not a webhook is set, and a tested method:

```ts
  static readonly RETENTION_DAYS = 30;
  private prune: NodeJS.Timeout | null = null;
  // in onModuleInit, before the webhook check:
  //   this.prune = setInterval(() => void this.pruneLog().catch(e => this.logger.warn(`ingest_log prune failed: ${e.message}`)), 60 * 60_000);
  // in onModuleDestroy: if (this.prune) clearInterval(this.prune);
  async pruneLog(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - IngestAlertsService.RETENTION_DAYS * 86_400_000);
    return (await this.prisma.ingest_log.deleteMany({ where: { received_at: { lt: cutoff } } })).count;
  }
```

Test in `ingest-alerts.service.spec.ts`:

```ts
it('pruneLog deletes rows older than 30 days', async () => {
  const prisma: any = { ingest_log: { deleteMany: jest.fn(async () => ({ count: 3 })) } };
  const svc = new IngestAlertsService(prisma, {} as any, undefined, jest.fn());
  expect(await svc.pruneLog(new Date('2027-03-31T00:00:00Z'))).toBe(3);
  expect(prisma.ingest_log.deleteMany).toHaveBeenCalledWith({ where: { received_at: { lt: new Date('2027-03-01T00:00:00Z') } } });
});
```

Run: `cd backend && npx jest src/modules/ingest/ingest-alerts.service.spec.ts` — Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/ingest .env.example
git commit -m "feat(ingest): tally check, feed status, health endpoint, webhook alerts, log retention"
```

---

### Task 8: Admin ingest API (feed settings, shards, holds, keys, seat correction, status)

**Files:**
- Create: `backend/src/modules/ingest/holds.service.ts`, `backend/src/modules/ingest/seat-correction.service.ts`, `backend/src/modules/ingest/dto/admin-ingest.dto.ts`, `backend/src/modules/ingest/admin-ingest.controller.ts`
- Modify: `backend/src/modules/ingest/ingest.module.ts` (import `AuthModule`, add providers/controller)
- Test: `backend/src/modules/ingest/seat-correction.service.spec.ts`, `backend/src/modules/ingest/holds.service.spec.ts`, `backend/src/modules/ingest/admin-ingest.dto.spec.ts`

**Interfaces:**
- Consumes: Task 2 `checkRoster`, `deriveRows`, `sameAsStored`; Task 6 `IngestService.write` pattern; `ResultChangeNotifier`.
- Produces (routes under `/admin/elections/:id/ingest`, `JwtAuthGuard` + `RolesGuard`):

| Route | Roles | Body / result |
|---|---|---|
| `GET /admin/elections/:id/ingest` | SUPER_ADMIN, EDITOR | `IngestStatusService.status(id)` |
| `PUT /admin/elections/:id/ingest` | SUPER_ADMIN, EDITOR | `{ active_source: string \| null, hold_minutes: number }` |
| `GET /admin/elections/:id/ingest/sources` | SUPER_ADMIN, EDITOR | distinct `source` values from `ingest_log` for the election, last 7 days |
| `PUT /admin/elections/:id/ingest/shards/:name` | SUPER_ADMIN, EDITOR | `{ selector, source_override }` → `ShardInfo` |
| `DELETE /admin/elections/:id/ingest/shards/:name` | SUPER_ADMIN, EDITOR | — |
| `GET /admin/elections/:id/holds` | SUPER_ADMIN, EDITOR | `[{ const_id, const_no, name, round_at_hold, expires_at, created_by_name }]` |
| `DELETE /admin/elections/:id/holds/:constId` | SUPER_ADMIN, EDITOR | release |
| `PUT /admin/elections/:id/seats/:constId` | SUPER_ADMIN, EDITOR | `{ state, round?, votes }` → `{ outcome: 'applied' \| 'unchanged', hold_expires_at }` |
| `GET /admin/ingest-keys` / `POST` `{ name }` / `DELETE /admin/ingest-keys/:id` | SUPER_ADMIN | list / `{ key, row }` (key shown once) / revoke |

```ts
class HoldsService { list(electionId: string): Promise<HoldRow[]>; release(electionId: string, constId: string): Promise<void>; upsert(tx, electionId: string, constId: string, roundAtHold: number | null, minutes: number, userId: string | null, now: Date): Promise<Date> }
class SeatCorrectionService { correct(electionId: string, constId: string, seat: { state: SeatState; round?: { current: number; total: number } | null; votes: Record<string, number> }, userId: string | null, now?: Date): Promise<{ outcome: 'applied' | 'unchanged'; hold_expires_at: Date }> }
```

Seat correction rules: election must be Live (else `IngestNotLiveException` — this is the Finalized lock for admin edits); roster check + derive as ingest; **no** source / lease / freshness / hold checks; writes rows (if changed), `seat_ingest_state` with `last_source = 'admin'`, the constituency rounds, an audit row `RESULT_SEAT_CORRECTION` (old and new votes per candidate), and **always** creates/refreshes the hold (`round_at_hold` = the corrected round, else the stored round; `expires_at` = now + hold minutes).

- [ ] **Step 1: Write the failing seat-correction test**

```ts
// backend/src/modules/ingest/seat-correction.service.spec.ts
import { SeatCorrectionService } from './seat-correction.service';
import { IngestBadRequestException, IngestNotLiveException } from '../../common/exceptions';

const NOW = new Date('2027-02-27T04:12:00Z');
function make(status = 'Live', stored: any[] = []) {
  const executed: string[] = [];
  const prisma: any = {
    elections: { findUnique: jest.fn(async () => ({ status })) },
    election_ingest: { findUnique: jest.fn(async () => ({ hold_minutes: 10 })) },
    candidates: { findMany: jest.fn(async () => [{ id: 'a', party_id: 'BJP' }, { id: 'b', party_id: 'INC' }]) },
    results: { findMany: jest.fn(async () => stored) },
    seat_ingest_state: { findUnique: jest.fn(async () => ({ state: 'counting', round_current: 7, round_total: 20, last_source: 'eci-web', last_observed_at: NOW })) },
    audit_logs: { create: jest.fn(async () => ({})) },
    $executeRaw: jest.fn(async (strings: TemplateStringsArray) => { executed.push(strings.join('?').trim().split(/\s+/).slice(0, 3).join(' ')); return 1; }),
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  const holds: any = { upsert: jest.fn(async () => new Date(NOW.getTime() + 600_000)) };
  const notifier: any = { afterCommit: jest.fn(async () => undefined) };
  return { svc: new SeatCorrectionService(prisma, holds, notifier), prisma, holds, notifier, executed };
}

describe('SeatCorrectionService', () => {
  it('applies the derived rows, audits, and holds the seat at the corrected round', async () => {
    const { svc, holds, prisma, notifier } = make();
    const out = await svc.correct('e', 'S1', { state: 'counting', round: { current: 8, total: 20 }, votes: { a: 900, b: 800 } }, 'u1', NOW);
    expect(out).toEqual({ outcome: 'applied', hold_expires_at: new Date(NOW.getTime() + 600_000) });
    expect(holds.upsert).toHaveBeenCalledWith(prisma, 'e', 'S1', 8, 10, 'u1', NOW);
    expect(prisma.audit_logs.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'RESULT_SEAT_CORRECTION', entity_id: 'S1' }) }));
    expect(notifier.afterCommit).toHaveBeenCalledWith('e', [expect.objectContaining({ const_id: 'S1', p: 'BJP', s: 'LEADING', m: 100 })], { kind: 'single' });
  });
  it('without a round, the hold is at the stored round', async () => {
    const { svc, holds, prisma } = make();
    await svc.correct('e', 'S1', { state: 'counting', votes: { a: 1, b: 2 } }, 'u1', NOW);
    expect(holds.upsert).toHaveBeenCalledWith(prisma, 'e', 'S1', 7, 10, 'u1', NOW);
  });
  it('refuses a Finalized election and an incomplete roster', async () => {
    await expect(make('Finalized').svc.correct('e', 'S1', { state: 'counting', votes: { a: 1, b: 2 } }, 'u1', NOW)).rejects.toBeInstanceOf(IngestNotLiveException);
    await expect(make().svc.correct('e', 'S1', { state: 'counting', votes: { a: 1 } }, 'u1', NOW)).rejects.toBeInstanceOf(IngestBadRequestException);
  });
});
```

Run: `cd backend && npx jest src/modules/ingest/seat-correction` — Expected: FAIL (module not found).

- [ ] **Step 2: Implement holds and seat correction**

```ts
// backend/src/modules/ingest/holds.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HoldRow { const_id: string; const_no: number; name: string; round_at_hold: number | null; expires_at: Date; created_by_name: string | null }

@Injectable()
export class HoldsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(electionId: string, now = new Date()): Promise<HoldRow[]> {
    return this.prisma.$queryRaw<HoldRow[]>`
      SELECT h.const_id, c.const_no, c.name, h.round_at_hold, h.expires_at, u.name AS created_by_name
      FROM seat_holds h JOIN constituencies c ON c.id = h.const_id LEFT JOIN users u ON u.id = h.created_by
      WHERE h.election_id = ${electionId}::uuid AND h.expires_at > ${now}
      ORDER BY h.expires_at`;
  }

  async release(electionId: string, constId: string): Promise<void> {
    await this.prisma.seat_holds.deleteMany({ where: { election_id: electionId, const_id: constId } });
  }

  /** Creates or refreshes the hold; returns its expiry. */
  async upsert(tx: PrismaService, electionId: string, constId: string, roundAtHold: number | null, minutes: number, userId: string | null, now: Date): Promise<Date> {
    const expires_at = new Date(now.getTime() + minutes * 60_000);
    await tx.seat_holds.upsert({
      where: { election_id_const_id: { election_id: electionId, const_id: constId } },
      create: { election_id: electionId, const_id: constId, round_at_hold: roundAtHold, expires_at, created_by: userId },
      update: { round_at_hold: roundAtHold, expires_at, created_by: userId, created_at: now },
    });
    return expires_at;
  }
}
```

```ts
// backend/src/modules/ingest/seat-correction.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResultChangeNotifier } from '../live/result-change-notifier';
import { HoldsService } from './holds.service';
import { checkRoster, deriveRows, sameAsStored, type IncomingSeat, type SeatState, type StoredRow } from './seat-rules';
import { ElectionNotFoundException, IngestBadRequestException, IngestNotLiveException } from '../../common/exceptions';

export const ADMIN_SOURCE = 'admin';

/** Spec §6: an admin's seat correction — same derive rules as ingest, no source/lease/freshness, always holds the seat. */
@Injectable()
export class SeatCorrectionService {
  constructor(private readonly prisma: PrismaService, private readonly holds: HoldsService, private readonly notifier: ResultChangeNotifier) {}

  async correct(electionId: string, constId: string, input: { state: SeatState; round?: { current: number; total: number } | null; votes: Record<string, number> }, userId: string | null, now = new Date()) {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { status: true } });
    if (!election) throw new ElectionNotFoundException(electionId);
    if (election.status !== 'Live') throw new IngestNotLiveException(String(election.status));
    const roster = (await this.prisma.candidates.findMany({ where: { election_id: electionId, const_id: constId }, select: { id: true, party_id: true } })).map(c => ({ candidate_id: c.id, party_id: c.party_id }));
    const seat: IncomingSeat = { const_id: constId, state: input.state, round: input.round ?? null, votes: input.votes };
    const bad = checkRoster(seat, roster);
    if (bad) throw new IngestBadRequestException(bad.reason, bad.detail);
    const rows = deriveRows(seat, roster);
    if (!Array.isArray(rows)) throw new IngestBadRequestException(rows.reason);
    const storedRows = (await this.prisma.results.findMany({ where: { election_id: electionId, const_id: constId }, select: { candidate_id: true, votes: true, status: true, margin: true } })) as StoredRow[];
    const st = await this.prisma.seat_ingest_state.findUnique({ where: { election_id_const_id: { election_id: electionId, const_id: constId } } });
    const stored = st ? { state: st.state as SeatState, round_current: st.round_current, round_total: st.round_total, last_source: st.last_source, last_observed_at: st.last_observed_at } : null;
    const changed = !sameAsStored(rows, seat, storedRows, stored);
    const minutes = (await this.prisma.election_ingest.findUnique({ where: { election_id: electionId } }))?.hold_minutes ?? 10;
    const roundAtHold = seat.round?.current ?? st?.round_current ?? null;

    let expires: Date = now;
    await this.prisma.$transaction(async (tx: any) => {
      if (changed) {
        await tx.$executeRaw`
          UPDATE results AS r SET votes = u.votes, status = u.status::result_status, margin = u.margin, last_updated = ${now}
          FROM UNNEST(${rows.map(r => r.candidate_id)}::uuid[], ${rows.map(r => r.votes)}::int[], ${rows.map(r => r.status)}::text[], ${rows.map(r => r.margin)}::int[]) AS u(cid, votes, status, margin)
          WHERE r.candidate_id = u.cid AND r.election_id = ${electionId}::uuid`;
        if (seat.round) {
          await tx.$executeRaw`UPDATE constituencies SET current_round = ${seat.round.current}, total_rounds = ${seat.round.total} WHERE id = ${constId} AND election_id = ${electionId}::uuid`;
        }
        await tx.$executeRaw`
          INSERT INTO seat_ingest_state (election_id, const_id, state, round_current, round_total, last_source, last_observed_at, last_applied_at)
          VALUES (${electionId}::uuid, ${constId}, ${seat.state}, ${seat.round?.current ?? null}, ${seat.round?.total ?? null}, ${ADMIN_SOURCE}, ${now}, ${now})
          ON CONFLICT (election_id, const_id) DO UPDATE SET state = EXCLUDED.state,
            round_current = COALESCE(EXCLUDED.round_current, seat_ingest_state.round_current),
            round_total = COALESCE(EXCLUDED.round_total, seat_ingest_state.round_total),
            last_source = EXCLUDED.last_source, last_observed_at = EXCLUDED.last_observed_at, last_applied_at = EXCLUDED.last_applied_at`;
        await tx.audit_logs.create({ data: { user_id: userId, action: 'RESULT_SEAT_CORRECTION', entity_type: 'constituency', entity_id: constId,
          old_value: Object.fromEntries(storedRows.map(r => [r.candidate_id, r.votes])) as Prisma.InputJsonValue,
          new_value: { state: seat.state, round: seat.round ?? null, votes: seat.votes } as Prisma.InputJsonValue } });
      }
      expires = await this.holds.upsert(tx, electionId, constId, roundAtHold, minutes, userId, now);
    });

    if (changed) {
      const party = new Map(roster.map(c => [c.candidate_id, c.party_id]));
      const lead = rows.filter(r => party.get(r.candidate_id) !== 'NOTA').sort((a, b) => b.votes - a.votes)[0];
      const p = lead ? party.get(lead.candidate_id) : null;
      if (lead && p) await this.notifier.afterCommit(electionId, [{ const_id: constId, p, m: lead.margin, s: lead.status, ...(seat.round ? { cr: seat.round.current, tr: seat.round.total } : {}) }], { kind: 'single' });
    }
    return { outcome: changed ? 'applied' as const : 'unchanged' as const, hold_expires_at: expires };
  }
}
```

Run: `cd backend && npx jest src/modules/ingest/seat-correction` — Expected: pass.

- [ ] **Step 3: Admin DTOs (test first)**

```ts
// backend/src/modules/ingest/dto/admin-ingest.dto.ts
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { SEAT_STATES, type SeatState } from '../seat-rules';
import { RoundDto } from './ingest.dto';

export class FeedSettingsBody {
  @IsOptional() @IsString() @MaxLength(40) @Matches(/^[a-z0-9][a-z0-9_-]*$/) active_source: string | null;
  @IsInt() @Min(1) @Max(240) hold_minutes: number;
}
export class ShardSelectorDto {
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) state_ids?: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsInt({ each: true }) region_ids?: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsInt({ each: true }) district_ids?: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) const_no_ranges?: [number, number][];
}
export class ShardBody {
  @ValidateNested() @Type(() => ShardSelectorDto) selector: ShardSelectorDto;
  @IsOptional() @IsString() @MaxLength(40) @Matches(/^[a-z0-9][a-z0-9_-]*$/) source_override: string | null;
}
export class SeatCorrectionBody {
  @IsIn(SEAT_STATES as unknown as string[]) state: SeatState;
  @IsOptional() @ValidateNested() @Type(() => RoundDto) round?: RoundDto | null;
  @IsObject() votes: Record<string, number>;
}
export class IngestKeyBody {
  @IsString() @Matches(/^[A-Za-z0-9 _-]{2,80}$/) name: string;
}
```

```ts
// backend/src/modules/ingest/admin-ingest.dto.spec.ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FeedSettingsBody, IngestKeyBody, ShardBody } from './dto/admin-ingest.dto';

describe('admin ingest DTOs', () => {
  it('feed: a source name or null, hold minutes 1–240', async () => {
    expect(await validate(plainToInstance(FeedSettingsBody, { active_source: 'eci-web', hold_minutes: 10 }))).toEqual([]);
    expect(await validate(plainToInstance(FeedSettingsBody, { active_source: null, hold_minutes: 10 }))).toEqual([]);
    expect((await validate(plainToInstance(FeedSettingsBody, { active_source: 'ECI Web', hold_minutes: 0 }))).length).toBe(2);
  });
  it('shard selector lists must be integers', async () => {
    expect((await validate(plainToInstance(ShardBody, { selector: { state_ids: ['x'] }, source_override: null }))).length).toBeGreaterThan(0);
  });
  it('key names', async () => {
    expect(await validate(plainToInstance(IngestKeyBody, { name: 'worker-sg-1' }))).toEqual([]);
    expect((await validate(plainToInstance(IngestKeyBody, { name: 'x' }))).length).toBe(1);
  });
});
```

Run: `cd backend && npx jest src/modules/ingest/admin-ingest.dto.spec.ts` — Expected: pass.

- [ ] **Step 4: Admin controller and module wiring**

```ts
// backend/src/modules/ingest/admin-ingest.controller.ts
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { IngestStatusService } from './ingest-status.service';
import { ShardsService } from './shards.service';
import { HoldsService } from './holds.service';
import { SeatCorrectionService } from './seat-correction.service';
import { IngestKeysService } from './ingest-keys.service';
import { FeedSettingsBody, IngestKeyBody, SeatCorrectionBody, ShardBody } from './dto/admin-ingest.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminIngestController {
  constructor(
    private readonly prisma: PrismaService, private readonly status: IngestStatusService, private readonly shards: ShardsService,
    private readonly holds: HoldsService, private readonly correction: SeatCorrectionService, private readonly keys: IngestKeysService,
  ) {}

  @Get('elections/:id/ingest') @Roles('SUPER_ADMIN', 'EDITOR')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.status.status(id); }

  @Put('elections/:id/ingest') @Roles('SUPER_ADMIN', 'EDITOR')
  async put(@Param('id', ParseUUIDPipe) id: string, @Body() b: FeedSettingsBody, @Req() req: any) {
    const data = { active_source: b.active_source ?? null, hold_minutes: b.hold_minutes, updated_at: new Date(), updated_by: req.user?.id ?? null };
    await this.prisma.election_ingest.upsert({ where: { election_id: id }, create: { election_id: id, ...data }, update: data });
    await this.prisma.audit_logs.create({ data: { user_id: req.user?.id ?? null, action: 'INGEST_FEED_UPDATE', entity_type: 'election', entity_id: id, new_value: data as any } });
    return this.status.status(id);
  }

  @Get('elections/:id/ingest/sources') @Roles('SUPER_ADMIN', 'EDITOR')
  async sources(@Param('id', ParseUUIDPipe) id: string) {
    const rows = await this.prisma.ingest_log.findMany({ where: { election_id: id, received_at: { gte: new Date(Date.now() - 7 * 86_400_000) } }, distinct: ['source'], select: { source: true } });
    return rows.map(r => r.source).sort();
  }

  @Put('elections/:id/ingest/shards/:name') @Roles('SUPER_ADMIN', 'EDITOR')
  putShard(@Param('id', ParseUUIDPipe) id: string, @Param('name') name: string, @Body() b: ShardBody) {
    return this.shards.upsert(id, name, { selector: b.selector, source_override: b.source_override ?? null });
  }

  @Delete('elections/:id/ingest/shards/:name') @Roles('SUPER_ADMIN', 'EDITOR')
  async delShard(@Param('id', ParseUUIDPipe) id: string, @Param('name') name: string) { await this.shards.remove(id, name); return { deleted: true }; }

  @Get('elections/:id/holds') @Roles('SUPER_ADMIN', 'EDITOR')
  listHolds(@Param('id', ParseUUIDPipe) id: string) { return this.holds.list(id); }

  @Delete('elections/:id/holds/:constId') @Roles('SUPER_ADMIN', 'EDITOR')
  async release(@Param('id', ParseUUIDPipe) id: string, @Param('constId') constId: string) { await this.holds.release(id, constId); return { released: true }; }

  @Put('elections/:id/seats/:constId') @Roles('SUPER_ADMIN', 'EDITOR')
  correct(@Param('id', ParseUUIDPipe) id: string, @Param('constId') constId: string, @Body() b: SeatCorrectionBody, @Req() req: any) {
    return this.correction.correct(id, constId, { state: b.state, round: b.round ?? null, votes: b.votes }, req.user?.id ?? null);
  }

  @Get('ingest-keys') @Roles('SUPER_ADMIN')
  listKeys() { return this.keys.list(); }

  @Post('ingest-keys') @HttpCode(201) @Roles('SUPER_ADMIN')
  async createKey(@Body() b: IngestKeyBody, @Req() req: any) {
    const out = await this.keys.create(b.name, req.user?.id ?? null);
    await this.prisma.audit_logs.create({ data: { user_id: req.user?.id ?? null, action: 'INGEST_KEY_CREATE', entity_type: 'ingest_key', entity_id: out.row.id, new_value: { name: b.name } } });
    return out;
  }

  @Delete('ingest-keys/:keyId') @Roles('SUPER_ADMIN')
  async revokeKey(@Param('keyId', ParseUUIDPipe) keyId: string, @Req() req: any) {
    await this.keys.revoke(keyId);
    await this.prisma.audit_logs.create({ data: { user_id: req.user?.id ?? null, action: 'INGEST_KEY_REVOKE', entity_type: 'ingest_key', entity_id: keyId } });
    return { revoked: true };
  }
}
```

Check `audit_logs.entity_type` / `action` columns accept these strings (they are varchar in `schema.prisma`; if either is an enum, add the values in migration 020 with `ALTER TYPE … ADD VALUE IF NOT EXISTS`). Module: import `AuthModule`; add `HoldsService`, `SeatCorrectionService`, `AdminIngestController`. The admin-JWT body-limit: corrections are one seat, the default 100 kb is enough.

Run: `cd backend && npx jest src/modules/ingest && npx tsc --noEmit` — Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/ingest
git commit -m "feat(ingest): admin feed settings, shards, holds, keys and seat correction"
```

---

### Task 9: Snapshot seat states, Finalized lock and reopen

**Files:**
- Modify: `backend/src/modules/results/results.service.ts` (`loadSnapshot`, `buildSnapshot`, `ResultsSnapshot`), `backend/src/modules/elections/elections.service.ts` (`reopen`), `backend/src/modules/admin/controllers/admin-elections.controller.ts` (`POST elections/:id/reopen`)
- Test: `backend/src/modules/results/live-results.spec.ts` (add a `buildSnapshot` seats case), `backend/src/modules/elections/elections.service.spec.ts` (reopen)

**Interfaces:**
- Produces: `ResultsSnapshot.seats: Record<string, { state: string; cr: number | null; tr: number | null }>` (only seats that have ingest state); `ElectionsService.reopen(id: string, userId: string | null)`: Finalized → Live, audited `ELECTION_REOPEN`; anything else → `409 ELECTION_2002`-style `ElectionNotFinalizedException` (add it next to the other election exceptions with code `ELECTION_NOT_FINALIZED: 'ELECTION_2004'`).

- [ ] **Step 1: Failing tests**

In `live-results.spec.ts` (or wherever `buildSnapshot` is tested — `grep -rn buildSnapshot backend/src`), add:

```ts
it('carries per-seat state and rounds when given', () => {
  const snap = buildSnapshot(7, [], [{ const_id: 'S1', state: 'countermanded', round_current: null, round_total: null }, { const_id: 'S2', state: 'counting', round_current: 4, round_total: 20 }]);
  expect(snap.seats).toEqual({ S1: { state: 'countermanded', cr: null, tr: null }, S2: { state: 'counting', cr: 4, tr: 20 } });
  expect(buildSnapshot(7, []).seats).toEqual({});
});
```

In `elections.service.spec.ts`:

```ts
describe('ElectionsService.reopen', () => {
  it('sets a Finalized election back to Live and audits it; refuses any other status', async () => {
    const prisma: any = {
      elections: { findUnique: jest.fn(async () => ({ id: 'e', status: 'Finalized', states: null })), update: jest.fn(async () => ({ id: 'e', status: 'Live' })) },
      audit_logs: { create: jest.fn(async () => ({})) },
    };
    const svc = new ElectionsService(prisma);
    await expect(svc.reopen('e', 'u1')).resolves.toMatchObject({ status: 'Live' });
    expect(prisma.audit_logs.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'ELECTION_REOPEN' }) }));
    prisma.elections.findUnique.mockResolvedValue({ id: 'e', status: 'Live', states: null });
    await expect(svc.reopen('e', 'u1')).rejects.toThrow(/not finalized/i);
  });
});
```

Run: `cd backend && npx jest src/modules/results src/modules/elections` — Expected: the two new tests FAIL.

- [ ] **Step 2: Implement**

`results.service.ts`: add to `ResultsSnapshot` `seats: Record<string, { state: string; cr: number | null; tr: number | null }>;`; change the signature to `buildSnapshot(version: number, rows: SnapshotSourceRow[], seatStates: { const_id: string; state: string; round_current: number | null; round_total: number | null }[] = [])` and add to the returned object:

```ts
    seats: Object.fromEntries(seatStates.map(s => [s.const_id, { state: s.state, cr: s.round_current, tr: s.round_total }])),
```

In `loadSnapshot`, inside the same REPEATABLE READ transaction after `rows`:

```ts
        const seatStates = await tx.seat_ingest_state.findMany({ where: { election_id: id }, select: { const_id: true, state: true, round_current: true, round_total: true } });
        return buildSnapshot(Number(state?.version ?? 0), rows, seatStates);
```

`elections.service.ts`:

```ts
  /** A late correction after Finalize (spec §6): SUPER_ADMIN only, audited; Live again until re-finalized. */
  async reopen(id: string, userId: string | null) {
    const election = await this.findOne(id);
    if (election.status !== 'Finalized') throw new ElectionNotFinalizedException(id);
    const updated = await this.prisma.elections.update({ where: { id }, data: { status: 'Live' } });
    await this.prisma.audit_logs.create({ data: { user_id: userId, action: 'ELECTION_REOPEN', entity_type: 'election', entity_id: id } });
    return updated;
  }
```

`admin-elections.controller.ts`, mirroring `finalize` (same interceptor/DTO, `@Roles('SUPER_ADMIN')`, same `afterElectionChange` call the finalize handler makes):

```ts
  @Post('elections/:id/reopen')
  @Roles('SUPER_ADMIN')
  async reopen(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const e = await this.electionsService.reopen(id, req.user?.id ?? null);
    await this.afterElectionChange(id);
    return e;
  }
```

(Use the exact name of the finalize handler's post-change helper — `grep -n afterElectionChange backend/src/modules/admin/controllers/admin-elections.controller.ts`.)

- [ ] **Step 3: Run**

Run: `cd backend && npx jest && npx tsc --noEmit` — Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/results backend/src/modules/elections backend/src/modules/admin backend/src/common/exceptions
git commit -m "feat: snapshot carries seat state and rounds; reopen a finalized election"
```

---

## Part B — Worker (`scraper/src/live/`)

### Task 10: Worker test setup, types and the ingest client

**Files:**
- Modify: `scraper/package.json` (devDependency `vitest`, scripts `test`, `live`, `live:check`), `scraper/tsconfig.json` (include `src/live/**`; exclude nothing new)
- Create: `scraper/vitest.config.ts`, `scraper/src/live/types.ts`, `scraper/src/live/client.ts`
- Test: `scraper/src/live/__tests__/client.test.ts`

**Interfaces:**
- Produces:

```ts
// types.ts
export type SeatStateName = 'not_started' | 'counting' | 'declared' | 'countermanded' | 'adjourned';
export interface Roster { election: { id: string; type: string; state_id: number | null; year: number; status: string };
  parties: { id: string; name: string; abbreviation: string | null }[];
  seats: { const_id: string; const_no: number; name: string; type: string; state_id: number | null; candidates: { candidate_id: string; name: string; party_id: string | null }[] }[] }
export interface SeatState { const_id: string; state: SeatStateName; round?: { current: number; total: number } | null; votes: Record<string, number> }
export interface MappingReport { seats_total: number; seats_mapped: number; unmapped: { ref: string; reason: string }[] }
export interface PartyTally { party_id: string; won: number; leading: number }
export interface SourceAdapter { id: string; intervalMs: number; prepare(roster: Roster): Promise<MappingReport>; poll(): Promise<SeatState[]>; tally?(): Promise<PartyTally[] | null> }
export type AdapterFactory = (opts: Record<string, string>) => SourceAdapter;
export interface IngestConfig { status: string; source: string | null; poll_hint_ms: number; shard: { name: string; seat_count: number }; lease: { holder: string | null; expires_at: string | null } }
export interface SeatsResponse { counts: Record<'applied' | 'unchanged' | 'stale' | 'held' | 'rejected', number>; seats: { const_id: string; outcome: string; reason?: string; detail?: unknown }[] }
// client.ts
export class IngestApiError extends Error { status: number; code: string | null; details: unknown }
export class IngestClient {
  constructor(opts: { baseUrl: string; key: string; fetch?: typeof fetch; retries?: number; sleep?: (ms: number) => Promise<void> });
  roster(electionId: string, shard?: string): Promise<Roster>;
  config(electionId: string, shard: string): Promise<IngestConfig>;
  lease(electionId: string, shard: string, holder: string): Promise<{ expires_at: string }>;   // throws IngestApiError(409, 'INGEST_0004')
  release(electionId: string, shard: string, holder: string): Promise<void>;
  seats(electionId: string, body: { shard: string; source: string; holder: string; observed_at: string; dry_run?: boolean; seats: SeatState[] }): Promise<SeatsResponse>;
  tally(electionId: string, body: { shard: string; source: string; holder: string; observed_at: string; parties: PartyTally[] }): Promise<{ mismatch: unknown[] }>;
}
```

- [ ] **Step 1: Add Vitest**

Run: `cd scraper && npm i -D vitest@^2`
Add to `package.json` scripts: `"test": "vitest run"`, `"live": "ts-node src/live/run.ts"`, `"live:check": "ts-node src/live/check.ts"`.

```ts
// scraper/vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/__tests__/**/*.test.ts'], environment: 'node' } });
```

- [ ] **Step 2: Types** — write `scraper/src/live/types.ts` exactly as in Interfaces above.

- [ ] **Step 3: Failing client test**

```ts
// scraper/src/live/__tests__/client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { IngestClient, IngestApiError } from '../client';

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const err = (status: number, code: string) => new Response(JSON.stringify({ success: false, error: { code, message: 'x', details: { holder: 'other' } } }), { status });

describe('IngestClient', () => {
  it('sends the Bearer key and unwraps data', async () => {
    const f = vi.fn(async () => ok({ status: 'Live' }));
    const c = new IngestClient({ baseUrl: 'http://api/api/v1', key: 'mpk_k', fetch: f as any });
    expect(await c.config('e', 'rest')).toEqual({ status: 'Live' });
    expect(f).toHaveBeenCalledWith('http://api/api/v1/ingest/elections/e/config?shard=rest', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer mpk_k' }) }));
  });
  it('a 409 is thrown at once with its code and details; 5xx and network errors are retried', async () => {
    const c409 = new IngestClient({ baseUrl: 'http://api', key: 'k', fetch: vi.fn(async () => err(409, 'INGEST_0004')) as any, sleep: async () => {} });
    await expect(c409.lease('e', 'rest', 'w')).rejects.toMatchObject({ status: 409, code: 'INGEST_0004', details: { holder: 'other' } });
    const f = vi.fn().mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(err(503, 'GEN_0001')).mockResolvedValueOnce(ok({ expires_at: 't' }));
    const c = new IngestClient({ baseUrl: 'http://api', key: 'k', fetch: f as any, sleep: async () => {} });
    expect(await c.lease('e', 'rest', 'w')).toEqual({ expires_at: 't' });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it('gives up after the retries with an IngestApiError', async () => {
    const c = new IngestClient({ baseUrl: 'http://api', key: 'k', retries: 2, fetch: vi.fn(async () => err(502, 'GEN_0001')) as any, sleep: async () => {} });
    await expect(c.config('e', 'rest')).rejects.toBeInstanceOf(IngestApiError);
  });
});
```

Run: `cd scraper && npx vitest run src/live/__tests__/client.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 4: Implement the client**

```ts
// scraper/src/live/client.ts
import type { IngestConfig, PartyTally, Roster, SeatState, SeatsResponse } from './types';

export class IngestApiError extends Error {
  constructor(message: string, public status: number, public code: string | null, public details: unknown) { super(message); }
}

/** Typed client for the ingest API (spec §4). Retries network errors and 5xx with backoff; 4xx are thrown at once. */
export class IngestClient {
  private readonly f: typeof fetch;
  private readonly retries: number;
  private readonly sleep: (ms: number) => Promise<void>;
  constructor(private readonly opts: { baseUrl: string; key: string; fetch?: typeof fetch; retries?: number; sleep?: (ms: number) => Promise<void> }) {
    this.f = opts.fetch ?? fetch;
    this.retries = opts.retries ?? 3;
    this.sleep = opts.sleep ?? (ms => new Promise(r => setTimeout(r, ms)));
  }

  roster(electionId: string, shard?: string): Promise<Roster> { return this.call('GET', `/ingest/elections/${electionId}/roster${shard ? `?shard=${encodeURIComponent(shard)}` : ''}`); }
  config(electionId: string, shard: string): Promise<IngestConfig> { return this.call('GET', `/ingest/elections/${electionId}/config?shard=${encodeURIComponent(shard)}`); }
  lease(electionId: string, shard: string, holder: string): Promise<{ expires_at: string }> { return this.call('POST', `/ingest/elections/${electionId}/lease`, { shard, holder }); }
  async release(electionId: string, shard: string, holder: string): Promise<void> {
    await this.call('DELETE', `/ingest/elections/${electionId}/lease?shard=${encodeURIComponent(shard)}&holder=${encodeURIComponent(holder)}`);
  }
  seats(electionId: string, body: { shard: string; source: string; holder: string; observed_at: string; dry_run?: boolean; seats: SeatState[] }): Promise<SeatsResponse> {
    return this.call('POST', `/ingest/elections/${electionId}/seats`, body);
  }
  tally(electionId: string, body: { shard: string; source: string; holder: string; observed_at: string; parties: PartyTally[] }): Promise<{ mismatch: unknown[] }> {
    return this.call('POST', `/ingest/elections/${electionId}/tally`, body);
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let last: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) await this.sleep(Math.min(30_000, 500 * 2 ** attempt) + Math.random() * 250);
      let res: Response;
      try {
        res = await this.f(`${this.opts.baseUrl}${path}`, {
          method, headers: { Authorization: `Bearer ${this.opts.key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch (e) { last = e; continue; }
      const json: any = await res.json().catch(() => null);
      if (res.ok) return json?.data as T;
      const e = new IngestApiError(json?.error?.message ?? `HTTP ${res.status}`, res.status, json?.error?.code ?? null, json?.error?.details ?? null);
      if (res.status < 500) throw e;
      last = e;
    }
    throw last instanceof IngestApiError ? last : new IngestApiError(String((last as Error)?.message ?? last), 0, null, null);
  }
}
```

Run: `cd scraper && npx vitest run src/live/__tests__/client.test.ts && npx tsc --noEmit` — Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add scraper/package.json scraper/package-lock.json scraper/vitest.config.ts scraper/src/live/types.ts scraper/src/live/client.ts scraper/src/live/__tests__/client.test.ts
git commit -m "feat(worker): ingest API client, adapter contract, vitest"
```

---

### Task 11: The worker loop, `live` and `live:check`

**Files:**
- Create: `scraper/src/live/loop.ts`, `scraper/src/live/run.ts`, `scraper/src/live/check.ts`, `scraper/src/live/registry.ts`, `scraper/live.config.example.json`
- Modify: `.gitignore` (`scraper/live.config.json`, `scraper/.sim-ingest-key`)
- Test: `scraper/src/live/__tests__/loop.test.ts`

**Interfaces:**
- Consumes: Task 10 types and client.
- Produces:

```ts
// loop.ts
export interface LoopDeps { client: Pick<IngestClient, 'config' | 'lease' | 'release' | 'roster' | 'seats' | 'tally'>; adapters: Record<string, AdapterFactory>;
  adapterOpts: Record<string, Record<string, string>>; holder: string; log: (msg: string, extra?: unknown) => void; now?: () => Date }
export interface LoopState { adapter: SourceAdapter | null; source: string | null; preparedAt: number; cycle: number; leased: boolean; failures: number }
export const POST_CHUNK = 100;
export const REPREPARE_MS = 30 * 60_000;
export const TALLY_EVERY = 5;
export function newLoopState(): LoopState;
/** One cycle; returns how long to wait before the next one (ms). Never throws. */
export async function runCycle(electionId: string, shard: string, state: LoopState, deps: LoopDeps): Promise<number>;
export async function runForever(electionId: string, shard: string, deps: LoopDeps, signal: AbortSignal): Promise<void>;
// registry.ts
export const ADAPTERS: Record<string, AdapterFactory>; // filled in Tasks 12–13 ('mock-eci', 'eci-web')
// live config file (JSON)
interface LiveConfigFile { apiBaseUrl?: string; holder?: string; tasks: { election: string; shards?: string[] }[]; adapters?: Record<string, Record<string, string>> }
```

Cycle behaviour:
1. `config`; on error → log, return backoff (`min(60s, 5s·2^failures)`).
2. Not Live, or `source` null → release the lease if held, return `poll_hint_ms`.
3. No adapter for the source in this worker → release if held, log `idle: no adapter for <source>`, return `poll_hint_ms`.
4. Claim/renew the lease; on `409` → log `held by <holder>`, return `poll_hint_ms`.
5. New source or older than `REPREPARE_MS` → `roster(electionId, shard)` + `adapter.prepare`; log the mapping report (count + first 20 unmapped).
6. `poll()`; post in chunks of `POST_CHUNK` with `observed_at` = the time the poll started; log counts and every rejected seat.
7. Every `TALLY_EVERY` cycles, if the adapter has `tally()`, post it.
8. Return `adapter.intervalMs` ± 20 % jitter.

- [ ] **Step 1: Failing loop tests**

```ts
// scraper/src/live/__tests__/loop.test.ts
import { describe, it, expect, vi } from 'vitest';
import { newLoopState, runCycle, POST_CHUNK, type LoopDeps } from '../loop';
import { IngestApiError } from '../client';

const roster = { election: { id: 'e', type: 'VS', state_id: 4, year: 2026, status: 'Live' }, parties: [], seats: [] };
function deps(over: Partial<{ status: string; source: string | null; lease: 'ok' | 'held'; seats: number }> = {}) {
  const adapter = { id: 'fake', intervalMs: 30_000, prepare: vi.fn(async () => ({ seats_total: 1, seats_mapped: 1, unmapped: [] })),
    poll: vi.fn(async () => Array.from({ length: over.seats ?? 1 }, (_, i) => ({ const_id: `S${i}`, state: 'counting' as const, votes: {} }))) };
  const client = {
    config: vi.fn(async () => ({ status: over.status ?? 'Live', source: over.source === undefined ? 'fake' : over.source, poll_hint_ms: 10_000, shard: { name: 'rest', seat_count: 1 }, lease: { holder: null, expires_at: null } })),
    lease: vi.fn(async () => { if (over.lease === 'held') throw new IngestApiError('held', 409, 'INGEST_0004', { holder: 'laptop' }); return { expires_at: 't' }; }),
    release: vi.fn(async () => undefined),
    roster: vi.fn(async () => roster),
    seats: vi.fn(async (_e: string, b: any) => ({ counts: { applied: b.seats.length, unchanged: 0, stale: 0, held: 0, rejected: 0 }, seats: [] })),
    tally: vi.fn(async () => ({ mismatch: [] })),
  };
  const log = vi.fn();
  const d: LoopDeps = { client: client as any, adapters: { fake: () => adapter }, adapterOpts: {}, holder: 'w1', log, now: () => new Date('2027-02-27T04:00:00Z') };
  return { d, client, adapter, log };
}

describe('runCycle', () => {
  it('prepares once, polls and posts in chunks with the poll start as observed_at', async () => {
    const { d, client, adapter } = deps({ seats: POST_CHUNK + 1 });
    const st = newLoopState();
    const wait = await runCycle('e', 'rest', st, d);
    expect(wait).toBeGreaterThanOrEqual(24_000); expect(wait).toBeLessThanOrEqual(36_000);
    expect(adapter.prepare).toHaveBeenCalledTimes(1);
    expect(client.seats).toHaveBeenCalledTimes(2);
    expect(client.seats.mock.calls[0][1]).toMatchObject({ shard: 'rest', source: 'fake', holder: 'w1', observed_at: '2027-02-27T04:00:00.000Z' });
    await runCycle('e', 'rest', st, d);
    expect(adapter.prepare).toHaveBeenCalledTimes(1);
  });
  it('idles (and releases a held lease) when paused, not Live, or the source has no adapter here', async () => {
    for (const over of [{ source: null }, { status: 'Upcoming' }, { source: 'other' }]) {
      const { d, client, adapter } = deps(over as any);
      const st = { ...newLoopState(), leased: true };
      expect(await runCycle('e', 'rest', st, d)).toBe(10_000);
      expect(client.release).toHaveBeenCalled();
      expect(adapter.poll).not.toHaveBeenCalled();
    }
  });
  it('another holder: logs and waits without polling', async () => {
    const { d, adapter, log } = deps({ lease: 'held' });
    expect(await runCycle('e', 'rest', newLoopState(), d)).toBe(10_000);
    expect(adapter.poll).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('laptop'), undefined);
  });
  it('a failing config call backs off and never throws', async () => {
    const { d, client } = deps();
    client.config.mockRejectedValue(new Error('down'));
    const st = newLoopState();
    expect(await runCycle('e', 'rest', st, d)).toBe(10_000);
    expect(await runCycle('e', 'rest', st, d)).toBe(20_000);
  });
});
```

Run: `cd scraper && npx vitest run src/live/__tests__/loop.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 2: Implement the loop**

```ts
// scraper/src/live/loop.ts
import { IngestApiError, type IngestClient } from './client';
import type { AdapterFactory, SourceAdapter } from './types';

export interface LoopDeps { client: Pick<IngestClient, 'config' | 'lease' | 'release' | 'roster' | 'seats' | 'tally'>; adapters: Record<string, AdapterFactory>;
  adapterOpts: Record<string, Record<string, string>>; holder: string; log: (msg: string, extra?: unknown) => void; now?: () => Date }
export interface LoopState { adapter: SourceAdapter | null; source: string | null; preparedAt: number; cycle: number; leased: boolean; failures: number }
export const POST_CHUNK = 100;
export const REPREPARE_MS = 30 * 60_000;
export const TALLY_EVERY = 5;
const BACKOFF_BASE_MS = 5_000, BACKOFF_MAX_MS = 60_000;

export function newLoopState(): LoopState { return { adapter: null, source: null, preparedAt: 0, cycle: 0, leased: false, failures: 0 }; }
const jitter = (ms: number) => Math.round(ms * (0.8 + Math.random() * 0.4));

export async function runCycle(electionId: string, shard: string, st: LoopState, d: LoopDeps): Promise<number> {
  const now = d.now ?? (() => new Date());
  const tag = `[${electionId.slice(0, 8)}:${shard}]`;
  let cfg;
  try { cfg = await d.client.config(electionId, shard); }
  catch (e) { st.failures++; d.log(`${tag} config failed: ${(e as Error).message}`); return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** st.failures); }
  st.failures = 0;
  const idle = async (why: string) => {
    if (st.leased) { await d.client.release(electionId, shard, d.holder).catch(() => undefined); st.leased = false; }
    d.log(`${tag} idle: ${why}`);
    return cfg.poll_hint_ms;
  };
  if (cfg.status !== 'Live') return idle(`election is ${cfg.status}`);
  if (!cfg.source) return idle('paused');
  const factory = d.adapters[cfg.source];
  if (!factory) return idle(`no adapter for ${cfg.source}`);

  try { await d.client.lease(electionId, shard, d.holder); st.leased = true; }
  catch (e) {
    st.leased = false;
    if (e instanceof IngestApiError && e.status === 409) { d.log(`${tag} lease held by ${(e.details as any)?.holder ?? 'another job'}`, undefined); return cfg.poll_hint_ms; }
    d.log(`${tag} lease failed: ${(e as Error).message}`); return cfg.poll_hint_ms;
  }

  try {
    if (st.source !== cfg.source || !st.adapter || Date.now() - st.preparedAt > REPREPARE_MS) {
      st.adapter = factory(d.adapterOpts[cfg.source] ?? {});
      st.source = cfg.source;
      const report = await st.adapter.prepare(await d.client.roster(electionId, shard));
      st.preparedAt = Date.now();
      d.log(`${tag} prepared ${cfg.source}: ${report.seats_mapped}/${report.seats_total} seats mapped`, report.unmapped.slice(0, 20));
    }
    const observed_at = now().toISOString();
    const seats = await st.adapter.poll();
    for (let i = 0; i < seats.length; i += POST_CHUNK) {
      const res = await d.client.seats(electionId, { shard, source: cfg.source, holder: d.holder, observed_at, seats: seats.slice(i, i + POST_CHUNK) });
      d.log(`${tag} posted ${Math.min(POST_CHUNK, seats.length - i)}: ${JSON.stringify(res.counts)}`, res.seats.filter(s => s.outcome === 'rejected'));
    }
    st.cycle++;
    if (st.adapter.tally && st.cycle % TALLY_EVERY === 0) {
      const parties = await st.adapter.tally();
      if (parties) {
        const r = await d.client.tally(electionId, { shard, source: cfg.source, holder: d.holder, observed_at, parties });
        if (r.mismatch.length) d.log(`${tag} tally mismatch`, r.mismatch);
      }
    }
    return jitter(st.adapter.intervalMs);
  } catch (e) {
    st.failures++;
    d.log(`${tag} cycle failed: ${(e as Error).message}`);
    return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** st.failures);
  }
}

export async function runForever(electionId: string, shard: string, d: LoopDeps, signal: AbortSignal): Promise<void> {
  const st = newLoopState();
  while (!signal.aborted) {
    const wait = await runCycle(electionId, shard, st, d);
    await new Promise<void>(r => { const t = setTimeout(r, wait); signal.addEventListener('abort', () => { clearTimeout(t); r(); }, { once: true }); });
  }
  if (st.leased) await d.client.release(electionId, shard, d.holder).catch(() => undefined);
}
```

Note the config-failure backoff in the test: first failure → `5000·2^1 = 10000`, second → `20000`.

- [ ] **Step 3: Registry, run and check**

```ts
// scraper/src/live/registry.ts
import type { AdapterFactory } from './types';
/** Source adapters this worker can run, by the API's `source` name. Tasks 12–13 add 'mock-eci' and 'eci-web'. */
export const ADAPTERS: Record<string, AdapterFactory> = {};
```

```ts
// scraper/src/live/run.ts
/**
 * The counting-day worker (spec §7). Usage: npm run live -- --config live.config.json
 * Env: INGEST_API_URL (default http://localhost:3082/api/v1), INGEST_KEY (required), LIVE_HOLDER (default hostname).
 */
import { readFileSync } from 'fs';
import { hostname } from 'os';
import { IngestClient } from './client';
import { runForever } from './loop';
import { ADAPTERS } from './registry';

interface LiveConfigFile { apiBaseUrl?: string; holder?: string; tasks: { election: string; shards?: string[] }[]; adapters?: Record<string, Record<string, string>> }

function arg(name: string): string | undefined { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const cfg: LiveConfigFile = JSON.parse(readFileSync(arg('config') ?? 'live.config.json', 'utf8'));
  const key = process.env.INGEST_KEY;
  if (!key) throw new Error('INGEST_KEY is required');
  const client = new IngestClient({ baseUrl: process.env.INGEST_API_URL ?? cfg.apiBaseUrl ?? 'http://localhost:3082/api/v1', key });
  const holder = process.env.LIVE_HOLDER ?? cfg.holder ?? hostname();
  const ac = new AbortController();
  for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { console.log(`${sig}: releasing leases…`); ac.abort(); });
  const log = (msg: string, extra?: unknown) => console.log(`${new Date().toISOString()} ${msg}`, ...(extra && (!Array.isArray(extra) || extra.length) ? [JSON.stringify(extra)] : []));
  const loops = cfg.tasks.flatMap(t => (t.shards?.length ? t.shards : ['rest']).map(s => runForever(t.election, s, { client, adapters: ADAPTERS, adapterOpts: cfg.adapters ?? {}, holder, log }, ac.signal)));
  console.log(`worker ${holder}: ${loops.length} loop(s), adapters: ${Object.keys(ADAPTERS).join(', ') || 'none'}`);
  await Promise.all(loops);
}
main().catch(e => { console.error(e); process.exit(1); });
```

```ts
// scraper/src/live/check.ts
/**
 * Pre-counting check (spec §7): npm run live:check -- --election <id> --source <adapter> [--shard rest] [--config live.config.json]
 * prepare + one poll + a dry-run post; prints unmapped seats/candidates and the server's per-seat outcomes. Exit 1 if anything is unmapped or rejected.
 */
import { existsSync, readFileSync } from 'fs';
import { IngestClient } from './client';
import { ADAPTERS } from './registry';

function arg(name: string): string | undefined { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const election = arg('election'), source = arg('source'), shard = arg('shard') ?? 'rest';
  if (!election || !source) throw new Error('--election and --source are required');
  const file = arg('config') ?? 'live.config.json';
  const cfg = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const factory = ADAPTERS[source];
  if (!factory) throw new Error(`no adapter "${source}" (have: ${Object.keys(ADAPTERS).join(', ')})`);
  const client = new IngestClient({ baseUrl: process.env.INGEST_API_URL ?? cfg.apiBaseUrl ?? 'http://localhost:3082/api/v1', key: process.env.INGEST_KEY ?? '' });
  const adapter = factory(cfg.adapters?.[source] ?? {});
  const report = await adapter.prepare(await client.roster(election, shard));
  console.log(`mapped ${report.seats_mapped}/${report.seats_total} seats`);
  for (const u of report.unmapped) console.log(`  unmapped ${u.ref}: ${u.reason}`);
  const seats = await adapter.poll();
  console.log(`poll returned ${seats.length} seat(s)`);
  let rejected = 0;
  for (let i = 0; i < seats.length; i += 100) {
    const res = await client.seats(election, { shard, source, holder: 'live-check', observed_at: new Date().toISOString(), dry_run: true, seats: seats.slice(i, i + 100) });
    rejected += res.counts.rejected;
    for (const s of res.seats.filter(x => x.outcome === 'rejected')) console.log(`  rejected ${s.const_id}: ${s.reason} ${s.detail ? JSON.stringify(s.detail) : ''}`);
  }
  console.log(rejected || report.unmapped.length ? 'NOT READY' : 'READY');
  process.exit(rejected || report.unmapped.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
```

```json
// scraper/live.config.example.json  (copy to live.config.json; not committed)
{
  "apiBaseUrl": "http://localhost:3082/api/v1",
  "holder": "laptop",
  "tasks": [{ "election": "<election uuid>", "shards": ["rest"] }],
  "adapters": { "eci-web": { "baseUrl": "https://results.eci.gov.in/ResultAcGenMay2026", "stateCode": "S25" } }
}
```

(JSON has no comments — write the file without the first comment line.)

- [ ] **Step 4: Run**

Run: `cd scraper && npx vitest run && npx tsc --noEmit` — Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/live scraper/live.config.example.json .gitignore
git commit -m "feat(worker): lease-aware loop, live runner and live:check"
```

---

### Task 12: ECI web adapter (and the mock ECI server on the same path)

**Files:**
- Create: `scraper/src/live/adapters/eci-mapping.ts`, `scraper/src/live/adapters/eci-web.ts`, `scraper/src/live/__tests__/eci-mapping.test.ts`, `scraper/src/live/__tests__/eci-web.test.ts`, fixtures `scraper/src/live/__tests__/fixtures/eci-list-p1.htm`, `eci-candidates-100.htm`, `eci-partywise.htm`
- Modify: `scraper/src/live/registry.ts` (register `eci-web`, `mock-eci`), `scraper/src/adapters/eci-vs-adapter.ts` (export `fetchWithRetry`; add `parsePartywisePage`), `scraper/src/simulation/mock-eci-server.ts` (real-style rounds and status columns; candidate page at the seat's own round)

**Interfaces:**
- Consumes: `parseConstituencyListPage`, `parseCandidateDetailPage` (`scraper/src/adapters/eci-vs-adapter.ts`); Task 10 types.
- Produces:

```ts
// eci-mapping.ts (pure)
export const normName: (s: string) => string;           // upper-case, strip punctuation, collapse spaces
export function mapParty(eciParty: string, parties: Roster['parties'], aliases: Record<string, string>): string | null; // NOTA / IND / name / abbr / alias
export function mapCandidates(seat: Roster['seats'][number], eci: { name: string; party: string; votes: number }[], parties: Roster['parties'], aliases: Record<string, string>):
  { votes: Record<string, number> } | { reason: string };   // complete or a reason
export function seatStateFrom(rounds: string, status: string): { state: SeatStateName; round: { current: number; total: number } | null };
// eci-web.ts
export class EciWebAdapter implements SourceAdapter { constructor(opts: { id: string; baseUrl: string; stateCode: string; intervalMs?: number; concurrency?: number; partyAliases?: Record<string, string>; fetchText?: (url: string, ifModifiedSince?: string) => Promise<{ status: number; text: string; lastModified: string | null }> }) }
```

ECI behaviour (from `docs/reviews/2026-09-30-election-day-pipeline-review.md` §4), all inside the adapter:
- List pages `statewise<STATE><n>.htm`, n = 1… until a page has 0 rows or 404 (max 60); `If-Modified-Since` per page, a 304 reuses that page's rows.
- A seat is fetched (`candidateswise-<STATE><no>.htm`, concurrency 3) only when its list signature (leader, margin, rounds, status) changed since the last poll; a declared seat is fetched once more 10 min after it was declared, then never again.
- `seatStateFrom`: status `Result Declared` → declared; /countermand/i → countermanded; /adjourn/i → adjourned; rounds `c/t` parsed when present; `0/t` (or no row) → not_started (not sent); otherwise counting.
- A seat the adapter cannot map completely is left out of `poll()` and logged once per poll.
- `tally()`: parses `partywiseresult-<STATE>.htm` (party "Full Name - ABBR", Won, Leading); 404 → `null`.

- [ ] **Step 1: Capture fixtures from the real site (one-off)**

Run (repo root; West Bengal 2026 results are archived on ECI):

```bash
mkdir -p scraper/src/live/__tests__/fixtures
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
B=https://results.eci.gov.in/ResultAcGenMay2026
curl -sfA "$UA" "$B/statewiseS251.htm" -o scraper/src/live/__tests__/fixtures/eci-list-p1.htm
sleep 2; curl -sfA "$UA" "$B/candidateswise-S25100.htm" -o scraper/src/live/__tests__/fixtures/eci-candidates-100.htm
sleep 2; curl -sfA "$UA" "$B/partywiseresult-S25.htm" -o scraper/src/live/__tests__/fixtures/eci-partywise.htm
ls -la scraper/src/live/__tests__/fixtures
```

Expected: three files of roughly 36 KB, 19 KB and 38 KB. If the site is unreachable, stop and ask for the saved pages (the pipeline review observed them on 2026-09-30); do not hand-write fixtures.

- [ ] **Step 2: Failing mapping tests**

```ts
// scraper/src/live/__tests__/eci-mapping.test.ts
import { describe, it, expect } from 'vitest';
import { mapCandidates, mapParty, normName, seatStateFrom } from '../adapters/eci-mapping';

const parties = [
  { id: 'BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP' }, { id: 'AITC', name: 'All India Trinamool Congress', abbreviation: 'AITC' },
  { id: 'IND', name: 'Independent', abbreviation: 'IND' }, { id: 'NOTA', name: 'None of the Above', abbreviation: 'NOTA' },
];
const seat = { const_id: 'WB_VS26_100_HABRA', const_no: 100, name: 'HABRA', type: 'GEN', state_id: 25, candidates: [
  { candidate_id: 'c1', name: 'DEBDAS MONDAL', party_id: 'BJP' }, { candidate_id: 'c2', name: 'Jyotipriya Mallick', party_id: 'AITC' },
  { candidate_id: 'c3', name: 'RAM DAS', party_id: 'IND' }, { candidate_id: 'c4', name: 'SHYAM DAS', party_id: 'IND' },
  { candidate_id: 'n', name: 'NOTA', party_id: 'NOTA' },
] };

describe('eci-mapping', () => {
  it('normName', () => expect(normName('  Jyoti-priya  MALLICK. ')).toBe('JYOTIPRIYA MALLICK'));
  it('mapParty: NOTA, IND, full name, abbreviation, alias, unknown', () => {
    expect(mapParty('None of the Above', parties, {})).toBe('NOTA');
    expect(mapParty('Independent', parties, {})).toBe('IND');
    expect(mapParty('Bharatiya Janata Party', parties, {})).toBe('BJP');
    expect(mapParty('All India Trinamool Congress - AITC', parties, {})).toBe('AITC');
    expect(mapParty('Trinamool', parties, { Trinamool: 'AITC' })).toBe('AITC');
    expect(mapParty('Some New Party', parties, {})).toBeNull();
  });
  it('mapCandidates: by name+party, then by unique party; independents need the name', () => {
    const eci = [
      { name: 'DEBDAS MONDOL', party: 'Bharatiya Janata Party', votes: 104645 },     // spelling differs: unique party
      { name: 'JYOTIPRIYA MALLICK', party: 'All India Trinamool Congress', votes: 73183 },
      { name: 'RAM DAS', party: 'Independent', votes: 900 }, { name: 'SHYAM DAS', party: 'Independent', votes: 800 },
      { name: 'None of the Above', party: 'None of the Above', votes: 1200 },
    ];
    expect(mapCandidates(seat, eci, parties, {})).toEqual({ votes: { c1: 104645, c2: 73183, c3: 900, c4: 800, n: 1200 } });
    const badInd = eci.map(c => c.name === 'SHYAM DAS' ? { ...c, name: 'SHYAM DASS' } : c);
    expect(mapCandidates(seat, badInd, parties, {})).toEqual({ reason: 'unmapped candidate SHYAM DASS (Independent)' });
    expect(mapCandidates(seat, eci.slice(0, 4), parties, {})).toEqual({ reason: 'missing candidates: NOTA' });
  });
  it('seatStateFrom', () => {
    expect(seatStateFrom('24/24', 'Result Declared')).toEqual({ state: 'declared', round: { current: 24, total: 24 } });
    expect(seatStateFrom('12/20', 'Counting In Progress')).toEqual({ state: 'counting', round: { current: 12, total: 20 } });
    expect(seatStateFrom('0/20', '')).toEqual({ state: 'not_started', round: { current: 0, total: 20 } });
    expect(seatStateFrom('', 'Countermanded')).toEqual({ state: 'countermanded', round: null });
    expect(seatStateFrom('3/20', 'Counting Adjourned')).toEqual({ state: 'adjourned', round: { current: 3, total: 20 } });
  });
});
```

Run: `cd scraper && npx vitest run src/live/__tests__/eci-mapping.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement the mapping**

```ts
// scraper/src/live/adapters/eci-mapping.ts
import type { Roster, SeatStateName } from '../types';

export const normName = (s: string) => s.toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

/** ECI party label → our party id: NOTA, Independent, full name, "Full Name - ABBR", abbreviation, then the per-election aliases. */
export function mapParty(eciParty: string, parties: Roster['parties'], aliases: Record<string, string>): string | null {
  const raw = eciParty.trim();
  if (/^none of the above$/i.test(raw)) return 'NOTA';
  if (/^independent$/i.test(raw)) return 'IND';
  if (aliases[raw]) return aliases[raw];
  const [full, abbr] = raw.includes(' - ') ? raw.split(/ - (?=[^-]+$)/) : [raw, null];
  const n = normName(full);
  return parties.find(p => normName(p.name) === n)?.id
    ?? (abbr ? parties.find(p => p.abbreviation && normName(p.abbreviation) === normName(abbr))?.id : undefined)
    ?? parties.find(p => p.abbreviation && normName(p.abbreviation) === n)?.id
    ?? null;
}

/** Every roster candidate must be matched (full state per seat). Name + party first, then the party when unique in the seat (never IND). */
export function mapCandidates(seat: Roster['seats'][number], eci: { name: string; party: string; votes: number }[], parties: Roster['parties'], aliases: Record<string, string>): { votes: Record<string, number> } | { reason: string } {
  const votes: Record<string, number> = {};
  const free = new Set(seat.candidates.map(c => c.candidate_id));
  for (const e of eci) {
    const pid = mapParty(e.party, parties, aliases);
    if (!pid) return { reason: `unmapped party ${e.party}` };
    const pool = seat.candidates.filter(c => free.has(c.candidate_id) && c.party_id === pid);
    const byName = pool.find(c => pid === 'NOTA' || normName(c.name) === normName(e.name));
    const pick = byName ?? (pool.length === 1 && pid !== 'IND' ? pool[0] : undefined);
    if (!pick) return { reason: `unmapped candidate ${e.name} (${e.party})` };
    votes[pick.candidate_id] = e.votes;
    free.delete(pick.candidate_id);
  }
  if (free.size) return { reason: `missing candidates: ${seat.candidates.filter(c => free.has(c.candidate_id)).map(c => c.name).join(', ')}` };
  return { votes };
}

export function seatStateFrom(rounds: string, status: string): { state: SeatStateName; round: { current: number; total: number } | null } {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(rounds);
  const round = m ? { current: Number(m[1]), total: Number(m[2]) } : null;
  if (/result declared/i.test(status)) return { state: 'declared', round };
  if (/countermand/i.test(status)) return { state: 'countermanded', round };
  if (/adjourn/i.test(status)) return { state: 'adjourned', round };
  if (!round || round.current === 0) return { state: round ? 'not_started' : 'counting', round };
  return { state: 'counting', round };
}
```

Note: `seatStateFrom('', 'Counting In Progress')` (no rounds column) → counting with no round; the test's `0/20` case → not_started.

Run: `cd scraper && npx vitest run src/live/__tests__/eci-mapping.test.ts` — Expected: pass.

- [ ] **Step 4: Failing adapter tests (fixtures + a fake fetch)**

```ts
// scraper/src/live/__tests__/eci-web.test.ts
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EciWebAdapter } from '../adapters/eci-web';
import { parseCandidateDetailPage, parseConstituencyListPage } from '../../adapters/eci-vs-adapter';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf8');
const list = fx('eci-list-p1.htm'), cand = fx('eci-candidates-100.htm');

/** Build a roster from the fixtures themselves, so the real page layout is what gets mapped. */
function rosterFromFixtures() {
  const rows = parseConstituencyListPage(list);
  const habra = rows.find(r => r.constNo === 100)!;
  const cands = parseCandidateDetailPage(cand);
  const partyNames = [...new Set(cands.map(c => c.party))];
  const parties = partyNames.map((n, i) => ({ id: /none of the above/i.test(n) ? 'NOTA' : /^independent$/i.test(n) ? 'IND' : `P${i}`, name: n, abbreviation: null }));
  const pid = (n: string) => parties.find(p => p.name === n)!.id;
  return { rows, habra, parties, roster: { election: { id: 'e', type: 'VS', state_id: 25, year: 2026, status: 'Live' }, parties,
    seats: [{ const_id: 'WB_100', const_no: 100, name: habra?.name ?? 'HABRA', type: 'GEN', state_id: 25,
      candidates: cands.map((c, i) => ({ candidate_id: `c${i}`, name: c.name, party_id: pid(c.party) })) }] } };
}

function fakeFetch() {
  const calls: string[] = [];
  const fetchText = vi.fn(async (url: string) => {
    calls.push(url);
    if (url.endsWith('statewiseS251.htm')) return { status: 200, text: list, lastModified: 'Mon, 05 May 2026 10:48:00 GMT' };
    if (url.includes('statewiseS25')) return { status: 404, text: '', lastModified: null };
    if (url.endsWith('candidateswise-S25100.htm')) return { status: 200, text: cand, lastModified: null };
    return { status: 404, text: '', lastModified: null };
  });
  return { fetchText, calls };
}

describe('EciWebAdapter on real ECI pages', () => {
  it('maps the fixture seat completely and returns its full state once', async () => {
    const { roster } = rosterFromFixtures();
    const { fetchText } = fakeFetch();
    const a = new EciWebAdapter({ id: 'eci-web', baseUrl: 'https://eci', stateCode: 'S25', fetchText });
    const report = await a.prepare(roster as any);
    expect(report.seats_mapped).toBe(1);
    const first = await a.poll();
    expect(first).toHaveLength(1);
    expect(first[0].const_id).toBe('WB_100');
    expect(Object.keys(first[0].votes)).toHaveLength(roster.seats[0].candidates.length);
    expect(first[0].state).toBe('declared');
    expect(await a.poll()).toEqual([]);   // unchanged list signature: no refetch, nothing sent
  });
  it('sends If-Modified-Since on the second poll and reuses the page on 304', async () => {
    const { roster } = rosterFromFixtures();
    const { fetchText } = fakeFetch();
    const a = new EciWebAdapter({ id: 'eci-web', baseUrl: 'https://eci', stateCode: 'S25', fetchText });
    await a.prepare(roster as any); await a.poll();
    fetchText.mockImplementationOnce(async () => ({ status: 304, text: '', lastModified: null }));
    await a.poll();
    expect(fetchText.mock.calls.some(c => c[1] === 'Mon, 05 May 2026 10:48:00 GMT')).toBe(true);
  });
  it('a seat in the roster that the source does not list yet is not sent', async () => {
    const { roster } = rosterFromFixtures();
    roster.seats.push({ const_id: 'WB_999', const_no: 999, name: 'NOWHERE', type: 'GEN', state_id: 25, candidates: [] } as any);
    const a = new EciWebAdapter({ id: 'eci-web', baseUrl: 'https://eci', stateCode: 'S25', fetchText: fakeFetch().fetchText });
    await a.prepare(roster as any);
    expect((await a.poll()).map(s => s.const_id)).toEqual(['WB_100']);
  });
});
```

(If `parseConstituencyListPage` returns no row for seat 100 on the captured page — the page lists seats alphabetically, 20 per page — capture the list page that contains Habra instead in Step 1, and update the file name here.)

Run: `cd scraper && npx vitest run src/live/__tests__/eci-web.test.ts` — Expected: FAIL.

- [ ] **Step 5: Implement the adapter**

```ts
// scraper/src/live/adapters/eci-web.ts
import { parseCandidateDetailPage, parseConstituencyListPage, type ConstituencySummary } from '../../adapters/eci-vs-adapter';
import { mapCandidates, seatStateFrom } from './eci-mapping';
import type { MappingReport, PartyTally, Roster, SeatState, SourceAdapter } from '../types';
import { parsePartywisePage } from '../../adapters/eci-vs-adapter';
import { mapParty } from './eci-mapping';

type FetchText = (url: string, ifModifiedSince?: string) => Promise<{ status: number; text: string; lastModified: string | null }>;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const MAX_PAGES = 60;
const RECHECK_DECLARED_MS = 10 * 60_000;

const defaultFetch: FetchText = async (url, ims) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...(ims ? { 'If-Modified-Since': ims } : {}) } });
  return { status: res.status, text: res.status === 200 ? await res.text() : '', lastModified: res.headers.get('last-modified') };
};

/** ECI results site ("ResultAcGen…") — spec §7, review §4. Owns fetching, caching and mapping; returns complete seats only. */
export class EciWebAdapter implements SourceAdapter {
  readonly id: string;
  readonly intervalMs: number;
  private readonly fetchText: FetchText;
  private roster: Roster | null = null;
  private pages = new Map<number, { lastModified: string | null; rows: ConstituencySummary[] }>();
  private signature = new Map<number, string>();
  private declaredAt = new Map<number, number>();
  private rechecked = new Set<number>();

  constructor(private readonly opts: { id: string; baseUrl: string; stateCode: string; intervalMs?: number; concurrency?: number; partyAliases?: Record<string, string>; fetchText?: FetchText }) {
    this.id = opts.id;
    this.intervalMs = opts.intervalMs ?? 45_000;
    this.fetchText = opts.fetchText ?? defaultFetch;
  }

  async prepare(roster: Roster): Promise<MappingReport> {
    this.roster = roster;
    this.signature.clear();
    const unmapped: MappingReport['unmapped'] = [];
    for (const p of new Set(roster.seats.flatMap(s => s.candidates.map(c => c.party_id)).filter(Boolean) as string[])) {
      if (!roster.parties.some(x => x.id === p)) unmapped.push({ ref: `party ${p}`, reason: 'not in roster parties' });
    }
    return { seats_total: roster.seats.length, seats_mapped: roster.seats.filter(s => s.candidates.length > 0).length, unmapped };
  }

  async poll(): Promise<SeatState[]> {
    if (!this.roster) throw new Error('prepare() first');
    const rows = await this.listRows();
    const byNo = new Map(this.roster.seats.map(s => [s.const_no, s]));
    const now = Date.now();
    const due = rows.filter(r => {
      if (!byNo.has(r.constNo)) return false;
      const sig = `${r.winnerName}|${r.winnerParty}|${r.margin}|${r.rounds}|${r.status}`;
      const changed = this.signature.get(r.constNo) !== sig;
      const declaredRecheck = this.declaredAt.has(r.constNo) && !this.rechecked.has(r.constNo) && now - this.declaredAt.get(r.constNo)! > RECHECK_DECLARED_MS;
      return changed || declaredRecheck;
    });
    const out: SeatState[] = [];
    await pool(due, this.opts.concurrency ?? 3, async r => {
      const seat = byNo.get(r.constNo)!;
      const { state, round } = seatStateFrom(r.rounds, r.status);
      if (state === 'not_started') { this.signature.set(r.constNo, `${r.winnerName}|${r.winnerParty}|${r.margin}|${r.rounds}|${r.status}`); return; }
      const page = await this.fetchText(`${this.opts.baseUrl}/candidateswise-${this.opts.stateCode}${r.constNo}.htm`);
      if (page.status !== 200) return;
      const mapped = mapCandidates(seat, parseCandidateDetailPage(page.text), this.roster!.parties, this.opts.partyAliases ?? {});
      if ('reason' in mapped) { console.warn(`[${this.id}] seat ${r.constNo} ${seat.name}: ${mapped.reason}`); return; }
      this.signature.set(r.constNo, `${r.winnerName}|${r.winnerParty}|${r.margin}|${r.rounds}|${r.status}`);
      if (state === 'declared') {
        if (!this.declaredAt.has(r.constNo)) this.declaredAt.set(r.constNo, now);
        else if (now - this.declaredAt.get(r.constNo)! > RECHECK_DECLARED_MS) this.rechecked.add(r.constNo);
      }
      out.push({ const_id: seat.const_id, state, round, votes: mapped.votes });
    });
    return out.sort((a, b) => a.const_id.localeCompare(b.const_id));
  }

  async tally(): Promise<PartyTally[] | null> {
    if (!this.roster) return null;
    const page = await this.fetchText(`${this.opts.baseUrl}/partywiseresult-${this.opts.stateCode}.htm`);
    if (page.status !== 200) return null;
    const out: PartyTally[] = [];
    for (const r of parsePartywisePage(page.text)) {
      const id = mapParty(r.party, this.roster.parties, this.opts.partyAliases ?? {});
      if (id) out.push({ party_id: id, won: r.won, leading: r.leading });
    }
    return out;
  }

  private async listRows(): Promise<ConstituencySummary[]> {
    const rows: ConstituencySummary[] = [];
    for (let n = 1; n <= MAX_PAGES; n++) {
      const cached = this.pages.get(n);
      const res = await this.fetchText(`${this.opts.baseUrl}/statewise${this.opts.stateCode}${n}.htm`, cached?.lastModified ?? undefined);
      if (res.status === 304 && cached) { rows.push(...cached.rows); continue; }
      if (res.status !== 200) break;
      const parsed = parseConstituencyListPage(res.text);
      if (!parsed.length) break;
      this.pages.set(n, { lastModified: res.lastModified, rows: parsed });
      rows.push(...parsed);
    }
    return rows;
  }
}

async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}
```

Add to `scraper/src/adapters/eci-vs-adapter.ts`:

```ts
/** Party-wise result page: "Full Name - ABBR", Won, Leading (review §4). */
export function parsePartywisePage(html: string): { party: string; won: number; leading: number }[] {
  const $ = cheerio.load(html);
  const out: { party: string; won: number; leading: number }[] = [];
  $('table.table tbody tr').each((_i, row) => {
    const cells = $(row).children('td');
    if (cells.length < 3) return;
    const party = $(cells[0]).text().trim();
    const won = parseInt($(cells[1]).text().trim(), 10), leading = parseInt($(cells[2]).text().trim(), 10);
    if (party && !isNaN(won) && !isNaN(leading)) out.push({ party, won, leading });
  });
  return out;
}
```

Add a fixture test for it in `eci-web.test.ts`:

```ts
import { parsePartywisePage } from '../../adapters/eci-vs-adapter';
it('parses the party-wise page', () => {
  const rows = parsePartywisePage(fx('eci-partywise.htm'));
  expect(rows.length).toBeGreaterThan(3);
  expect(rows.every(r => r.party.includes(' - ') || /independent/i.test(r.party))).toBe(true);
});
```

Register both in `registry.ts`:

```ts
import type { AdapterFactory } from './types';
import { EciWebAdapter } from './adapters/eci-web';

const aliases = (o: Record<string, string>) => (o.partyAliases ? JSON.parse(o.partyAliases) : undefined);
export const ADAPTERS: Record<string, AdapterFactory> = {
  'eci-web': o => new EciWebAdapter({ id: 'eci-web', baseUrl: o.baseUrl ?? process.env.ECI_VS_BASE_URL ?? '', stateCode: o.stateCode ?? '', intervalMs: o.intervalMs ? Number(o.intervalMs) : undefined, partyAliases: aliases(o) }),
  'mock-eci': o => new EciWebAdapter({ id: 'mock-eci', baseUrl: o.baseUrl ?? 'http://localhost:4444', stateCode: o.stateCode ?? 'S04', intervalMs: o.intervalMs ? Number(o.intervalMs) : 5_000, partyAliases: aliases(o) }),
};
```

- [ ] **Step 6: Make the mock server look like ECI**

In `scraper/src/simulation/mock-eci-server.ts`:
- List page row: replace the last two cells with `<td>${seatCurrent}/${snap.length}</td>` and `<td>${seatCurrent >= snap.length ? 'Result Declared' : 'Counting In Progress'}</td>`.
- Candidate page: compute the seat's own round exactly like the list page — `const seatCurrent = Math.min(currentRound - startRound + 1, snapshots.length); const snap = snapshots[seatCurrent - 1];` — instead of `Math.min(currentRound, snapshots.length) - 1`, so both pages show the same round.
- Use the full party name from `PARTY_NAME_TO_ID`'s keys as it does today (the adapter maps by name).

Run: `cd scraper && npx vitest run && npx tsc --noEmit` — Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add scraper/src
git commit -m "feat(worker): ECI web adapter (and mock-eci on the same path), real-page fixtures"
```

---

### Task 13: The simulation runs through ingest

**Files:**
- Modify: `scraper/src/simulation/setup.ts` (create `election_ingest` with `active_source = 'mock-eci'` and a sim ingest key), `scraper/src/simulation/replay.ts` (only advances rounds), `scraper/src/simulation/cleanup.ts` (delete the sim's ingest rows and key), `scraper/package.json` (`sim:live`)
- Create: `scraper/src/live/sim.config.json`, `scraper/src/simulation/smoke.ts` (`npm run sim:smoke`)

**Interfaces:**
- Consumes: Task 11 `runForever`, Task 12 `mock-eci`.
- Produces: `npm run sim:setup` prints `SIM_INGEST_KEY=mpk_…` and writes it to `scraper/.sim-ingest-key`; `npm run sim:live` runs the worker for the sim election with that key; `npm run sim:replay` advances the mock one round every `DEFAULT_ROUND_DELAY_MS`; `npm run sim:smoke` runs a short count end to end and asserts the public `/live` endpoint reports declared seats rising to the total.

- [ ] **Step 1: Setup creates the ingest key and feed**

Append to the setup transaction in `setup.ts` (the sim is a dev tool that already writes SQL directly; production keys come from the admin):

```ts
import { createHash, randomBytes } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
// …inside the existing client/transaction, after the election and seats are created:
const simKey = `mpk_${randomBytes(32).toString('base64url')}`;
await client.query(`DELETE FROM ingest_keys WHERE name = 'simulation'`);
await client.query(`INSERT INTO ingest_keys (name, key_hash) VALUES ('simulation', $1)`, [createHash('sha256').update(simKey).digest('hex')]);
await client.query(`INSERT INTO election_ingest (election_id, active_source) VALUES ($1, 'mock-eci')
                    ON CONFLICT (election_id) DO UPDATE SET active_source = 'mock-eci'`, [SIM_ELECTION_ID]);
writeFileSync(join(__dirname, '../../.sim-ingest-key'), simKey);
console.log(`SIM_INGEST_KEY=${simKey}  (also in scraper/.sim-ingest-key)`);
```

`cleanup.ts`: add `DELETE FROM seat_holds WHERE election_id = $1`, `DELETE FROM seat_ingest_state WHERE election_id = $1`, `DELETE FROM ingest_log WHERE election_id = $1`, `DELETE FROM ingest_shards WHERE election_id = $1`, `DELETE FROM election_ingest WHERE election_id = $1` (before the election delete) and `DELETE FROM ingest_keys WHERE name = 'simulation'`.

- [ ] **Step 2: Replay only drives the mock**

Replace the body of `replay.ts` with:

```ts
/** Advances the mock ECI server one round every ROUND_DELAY_MS until TOTAL_ROUNDS; the worker (npm run sim:live) does the ingest. */
import { DEFAULT_ROUND_DELAY_MS, MOCK_ECI_PORT, TOTAL_ROUNDS } from './config';

const delay = Number(process.env.ROUND_DELAY_MS ?? DEFAULT_ROUND_DELAY_MS);
async function main() {
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    const res = await fetch(`http://localhost:${MOCK_ECI_PORT}/advance-round`, { method: 'POST' });
    console.log(`round ${(await res.json()).round}/${TOTAL_ROUNDS}`);
    if (r < TOTAL_ROUNDS) await new Promise(x => setTimeout(x, delay));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Worker config and scripts**

```json
{ "holder": "sim", "tasks": [{ "election": "e1e1e1e1-2027-4000-a000-000000000027", "shards": ["rest"] }],
  "adapters": { "mock-eci": { "baseUrl": "http://localhost:4444", "stateCode": "S04", "intervalMs": "3000" } } }
```

saved as `scraper/src/live/sim.config.json`. `package.json` scripts: `"sim:live": "INGEST_KEY=$(cat .sim-ingest-key) ts-node src/live/run.ts --config src/live/sim.config.json"`, `"sim:smoke": "ts-node src/simulation/smoke.ts"`.

- [ ] **Step 4: Smoke script**

```ts
// scraper/src/simulation/smoke.ts
/**
 * End to end: needs the backend (3082) and mock ECI (4444) running and sim:setup done; flip the sim election to Live first.
 * Starts the worker in-process, advances 24 rounds quickly, and checks /live reports every seat declared.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { IngestClient } from '../live/client';
import { runForever } from '../live/loop';
import { ADAPTERS } from '../live/registry';
import { BACKEND_BASE, MOCK_ECI_PORT, SIM_ELECTION_ID, TOTAL_ROUNDS } from './config';

async function main() {
  const key = readFileSync(join(__dirname, '../../.sim-ingest-key'), 'utf8').trim();
  const client = new IngestClient({ baseUrl: BACKEND_BASE, key });
  const ac = new AbortController();
  const worker = runForever(SIM_ELECTION_ID, 'rest', { client, adapters: ADAPTERS, adapterOpts: { 'mock-eci': { intervalMs: '1500' } }, holder: 'smoke', log: m => console.log(m) }, ac.signal);
  await fetch(`http://localhost:${MOCK_ECI_PORT}/reset`, { method: 'POST' });
  for (let r = 1; r <= TOTAL_ROUNDS; r++) { await fetch(`http://localhost:${MOCK_ECI_PORT}/advance-round`, { method: 'POST' }); await new Promise(x => setTimeout(x, 2500)); }
  const deadline = Date.now() + 120_000;
  let live: any;
  do { await new Promise(x => setTimeout(x, 3000)); live = (await (await fetch(`${BACKEND_BASE}/elections/${SIM_ELECTION_ID}/live`)).json()).data; console.log(`declared ${live.declared}/${live.total}`); }
  while (live.declared < live.total && Date.now() < deadline);
  ac.abort(); await worker;
  if (live.declared !== live.total) { console.error('SMOKE FAILED'); process.exit(1); }
  console.log('SMOKE OK');
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Run the smoke test**

Run, each in its own terminal (repo root): `cd scraper && npm run sim:mock-eci`; backend dev server running; `cd scraper && npm run sim:setup`; set the sim election Live (`psql "$URL" -c "update elections set status='Live' where id='e1e1e1e1-2027-4000-a000-000000000027'"`); then `cd scraper && npm run sim:smoke`.
Expected: `declared 243/243` and `SMOKE OK`.

- [ ] **Step 6: Commit**

```bash
git add scraper .gitignore
git commit -m "feat(sim): the live simulation feeds results through the ingest API"
```

---

## Part C — Admin (Live Console)

### Task 14: Feed panel (source, pause, hold time, shard status, alerts)

**Files:**
- Create: `admin/src/services/ingest.service.ts`, `admin/src/hooks/useIngestFeed.ts`, `admin/src/components/live/FeedPanel.tsx`
- Modify: `admin/src/pages/LiveConsole.tsx` (render `FeedPanel` between `LiveHeader` and the split view), `admin/src/types/index.ts` (ingest types)
- Test: `admin/src/hooks/useIngestFeed.test.ts`, `admin/src/components/live/FeedPanel.test.tsx`

**Interfaces:**
- Consumes: backend routes from Task 8.
- Produces:

```ts
// types
export interface IngestShardStatus { name: string; seat_count: number; source: string | null; lease_holder: string | null; lease_expires_at: string | null; last_post_at: string | null; last_applied_at: string | null; lag_s: number | null; recent: Record<string, number>; rejected: { const_id: string; reason: string }[]; tally_mismatch: { party_id: string }[] | null }
export interface IngestAlert { key: string; level: 'warn' | 'error'; shard: string; message: string }
export interface IngestStatus { election_id: string; status: string; active_source: string | null; hold_minutes: number; shards: IngestShardStatus[]; alerts: IngestAlert[] }
// services/ingest.service.ts
getIngestStatus(electionId): Promise<IngestStatus>; putFeedSettings(electionId, { active_source, hold_minutes }): Promise<IngestStatus>; getSources(electionId): Promise<string[]>;
putShard(electionId, name, { selector, source_override }); deleteShard(electionId, name);
getHolds(electionId): Promise<HoldRow[]>; releaseHold(electionId, constId); correctSeat(electionId, constId, { state, round, votes });
getIngestKeys(); createIngestKey(name): Promise<{ key: string; row: IngestKeyRow }>; revokeIngestKey(id); reopenElection(id)
// hooks/useIngestFeed.ts
useIngestFeed(electionId: string | null): { status: IngestStatus | null; sources: string[]; error: string | null; saving: boolean; setFeed(active_source: string | null, hold_minutes: number): Promise<boolean>; reload(): Promise<void> }  // polls every 10 s
```

UI (Tailwind; existing tokens `bg-card`, `border-line`, `text-ink`, `text-ink-2`, `text-muted`, `bg-warn-soft`, `text-warn-text`, `bg-bad-soft`, `text-bad-text`; components `Button`, `Select`, `Input`, `Badge`):
- One row: **Source** `Select` (options: `Paused`, every source from `getSources`, plus the current one, plus a text option "Other…" that reveals an `Input`), **Hold** minutes `Input` (1–240), **Apply** `Button` (primary; disabled until changed). Changing the source asks for confirmation (`ConfirmDialog`: "Switch the live source to X? The current source's posts will be refused from now on.").
- A compact table per shard: name, seats, source, lease holder + "expires in Ns" (IST time via `formatIst` on hover), last post ("12 s ago" via `timeAgo`), lag, last cycles' counts (`applied / unchanged / stale / held / rejected`), rejected seats count (expandable list with reasons).
- Alerts above it: one banner per alert (`error` → `bg-bad-soft text-bad-text`, `warn` → `bg-warn-soft text-warn-text`).
- Editors call `useUnsavedGuard(dirty)` for the unsaved feed form.

- [ ] **Step 1: Failing hook test**

```ts
// admin/src/hooks/useIngestFeed.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useIngestFeed } from './useIngestFeed';

vi.mock('../services/ingest.service', () => ({
  getIngestStatus: vi.fn(async () => ({ election_id: 'e', status: 'Live', active_source: 'eci-web', hold_minutes: 10, shards: [], alerts: [] })),
  getSources: vi.fn(async () => ['eci-web', 'news']),
  putFeedSettings: vi.fn(async (_e: string, b: any) => ({ election_id: 'e', status: 'Live', ...b, shards: [], alerts: [] })),
}));
import * as svc from '../services/ingest.service';

describe('useIngestFeed', () => {
  beforeEach(() => vi.clearAllMocks());
  it('loads status and sources, and saves settings', async () => {
    const { result } = renderHook(() => useIngestFeed('e'));
    await waitFor(() => expect(result.current.status?.active_source).toBe('eci-web'));
    expect(result.current.sources).toEqual(['eci-web', 'news']);
    await act(async () => { expect(await result.current.setFeed(null, 15)).toBe(true); });
    expect(svc.putFeedSettings).toHaveBeenCalledWith('e', { active_source: null, hold_minutes: 15 });
    expect(result.current.status?.active_source).toBeNull();
  });
  it('does nothing without an election', () => {
    renderHook(() => useIngestFeed(null));
    expect(svc.getIngestStatus).not.toHaveBeenCalled();
  });
});
```

Run: `cd admin && npx vitest run src/hooks/useIngestFeed.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement service, types, hook**

```ts
// admin/src/services/ingest.service.ts
import { apiFetch } from './api-client';
import type { HoldRow, IngestKeyRow, IngestStatus, ShardSelector } from '../types';

const e = encodeURIComponent;
export const getIngestStatus = (id: string) => apiFetch<IngestStatus>(`/admin/elections/${id}/ingest`);
export const putFeedSettings = (id: string, b: { active_source: string | null; hold_minutes: number }) => apiFetch<IngestStatus>(`/admin/elections/${id}/ingest`, { method: 'PUT', body: JSON.stringify(b) });
export const getSources = async (id: string) => (await apiFetch<string[]>(`/admin/elections/${id}/ingest/sources`)) ?? [];
export const putShard = (id: string, name: string, b: { selector: ShardSelector; source_override: string | null }) => apiFetch(`/admin/elections/${id}/ingest/shards/${e(name)}`, { method: 'PUT', body: JSON.stringify(b) });
export const deleteShard = (id: string, name: string) => apiFetch(`/admin/elections/${id}/ingest/shards/${e(name)}`, { method: 'DELETE' });
export const getHolds = async (id: string) => (await apiFetch<HoldRow[]>(`/admin/elections/${id}/holds`)) ?? [];
export const releaseHold = (id: string, constId: string) => apiFetch(`/admin/elections/${id}/holds/${e(constId)}`, { method: 'DELETE' });
export const correctSeat = (id: string, constId: string, b: { state: string; round?: { current: number; total: number } | null; votes: Record<string, number> }) =>
  apiFetch<{ outcome: 'applied' | 'unchanged'; hold_expires_at: string }>(`/admin/elections/${id}/seats/${e(constId)}`, { method: 'PUT', body: JSON.stringify(b) });
export const getIngestKeys = async () => (await apiFetch<IngestKeyRow[]>('/admin/ingest-keys')) ?? [];
export const createIngestKey = (name: string) => apiFetch<{ key: string; row: IngestKeyRow }>('/admin/ingest-keys', { method: 'POST', body: JSON.stringify({ name }) });
export const revokeIngestKey = (id: string) => apiFetch(`/admin/ingest-keys/${id}`, { method: 'DELETE' });
export const reopenElection = (id: string) => apiFetch(`/admin/elections/${id}/reopen`, { method: 'POST' });
```

Add to `admin/src/types/index.ts`:

```ts
export interface ShardSelector { state_ids?: number[]; region_ids?: number[]; district_ids?: number[]; const_no_ranges?: [number, number][] }
export interface IngestShardStatus { name: string; seat_count: number; source: string | null; lease_holder: string | null; lease_expires_at: string | null; last_post_at: string | null; last_applied_at: string | null; lag_s: number | null; recent: Record<string, number>; rejected: { const_id: string; reason: string }[]; tally_mismatch: { party_id: string }[] | null }
export interface IngestAlert { key: string; level: 'warn' | 'error'; shard: string; message: string }
export interface IngestStatus { election_id: string; status: string; active_source: string | null; hold_minutes: number; shards: IngestShardStatus[]; alerts: IngestAlert[] }
export interface HoldRow { const_id: string; const_no: number; name: string; round_at_hold: number | null; expires_at: string; created_by_name: string | null }
export interface IngestKeyRow { id: string; name: string; created_at: string; last_used_at: string | null; revoked_at: string | null }
```

```ts
// admin/src/hooks/useIngestFeed.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getIngestStatus, getSources, putFeedSettings } from '../services/ingest.service';
import { useToast } from '../context/ToastContext';
import type { IngestStatus } from '../types';

const POLL_MS = 10_000;

/** CONTROLLER: the Live Console feed (spec §5) — status every 10 s, sources seen, settings save. */
export function useIngestFeed(electionId: string | null) {
  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast, toastError } = useToast();
  const toastRef = useRef({ toast, toastError });
  toastRef.current = { toast, toastError };

  const reload = useCallback(async () => {
    if (!electionId) return;
    try { setStatus(await getIngestStatus(electionId)); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, [electionId]);

  useEffect(() => {
    if (!electionId) return;
    void reload();
    getSources(electionId).then(setSources).catch(() => setSources([]));
    const t = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(t);
  }, [electionId, reload]);

  const setFeed = useCallback(async (active_source: string | null, hold_minutes: number) => {
    if (!electionId) return false;
    setSaving(true);
    try { setStatus(await putFeedSettings(electionId, { active_source, hold_minutes })); toastRef.current.toast('Feed updated'); return true; }
    catch (e) { toastRef.current.toastError(e, 'Failed to update the feed'); return false; }
    finally { setSaving(false); }
  }, [electionId]);

  return { status, sources, error, saving, setFeed, reload };
}
```

If `useToast` requires a provider in the hook test, wrap `renderHook` with `{ wrapper: ToastProvider }` (as other hook tests do — check `src/hooks/useElectionManager.test.tsx`'s wrapper and copy it).

Run: `cd admin && npx vitest run src/hooks/useIngestFeed.test.ts` — Expected: pass.

- [ ] **Step 3: FeedPanel (test first)**

```tsx
// admin/src/components/live/FeedPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedPanel } from './FeedPanel';

const status = { election_id: 'e', status: 'Live', active_source: 'eci-web', hold_minutes: 10, alerts: [{ key: 'k', level: 'error' as const, shard: 'rest', message: 'No job holds shard rest' }],
  shards: [{ name: 'rest', seat_count: 126, source: 'eci-web', lease_holder: 'worker-sg', lease_expires_at: new Date(Date.now() + 60_000).toISOString(), last_post_at: new Date().toISOString(),
    last_applied_at: null, lag_s: 42, recent: { applied: 5, unchanged: 100, stale: 0, held: 1, rejected: 2 }, rejected: [{ const_id: 'S1', reason: 'roster_mismatch' }], tally_mismatch: null }] };

describe('FeedPanel', () => {
  it('shows alerts, shard status and rejected reasons', () => {
    render(<FeedPanel status={status} sources={['eci-web', 'news']} saving={false} onApply={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toMatch(/No job holds shard rest/);
    expect(screen.getByText('worker-sg')).toBeTruthy();
    expect(screen.getByText('42 s')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /2 rejected/ }));
    expect(screen.getByText(/S1/).textContent).toMatch(/roster_mismatch/);
  });
  it('pausing applies without a confirmation; switching source asks first', () => {
    const onApply = vi.fn(async () => true);
    render(<FeedPanel status={status} sources={['eci-web', 'news']} saving={false} onApply={onApply} />);
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(null, 10);
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'news' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('dialog').textContent).toMatch(/Switch the live source to news/);
  });
});
```

```tsx
// admin/src/components/live/FeedPanel.tsx
import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { timeAgo } from '../../utils/time';
import { cn } from '../ui/cn';
import type { IngestStatus } from '../../types';

interface Props { status: IngestStatus; sources: string[]; saving: boolean; onApply(source: string | null, holdMinutes: number): Promise<boolean> | void }

/** Live Console feed controls (spec §5): source / pause, hold time, per-shard status, alerts. */
export function FeedPanel({ status, sources, saving, onApply }: Props) {
  const [source, setSource] = useState(status.active_source ?? '');
  const [hold, setHold] = useState(String(status.hold_minutes));
  const [confirm, setConfirm] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { setSource(status.active_source ?? ''); setHold(String(status.hold_minutes)); }, [status.active_source, status.hold_minutes]);
  const holdN = Number(hold);
  const holdOk = Number.isInteger(holdN) && holdN >= 1 && holdN <= 240;
  const dirty = source !== (status.active_source ?? '') || hold !== String(status.hold_minutes);
  useUnsavedGuard(dirty);
  const options = [...new Set([...sources, ...(status.active_source ? [status.active_source] : [])])].sort();
  const apply = () => {
    const next = source || null;
    if (next && next !== status.active_source) setConfirm(true);
    else void onApply(next, holdN);
  };

  return (
    <section className="mx-6 mb-4 flex flex-col gap-3 rounded-card border border-line bg-card p-4 shadow-sm" aria-label="Live feed">
      {status.alerts.map(a => (
        <p key={a.key} role="alert" className={cn('rounded-control px-3 py-2 text-sm', a.level === 'error' ? 'bg-bad-soft text-bad-text' : 'bg-warn-soft text-warn-text')}>{a.message}</p>
      ))}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">Source
          <Select aria-label="Source" value={source} onChange={e => setSource(e.target.value)} className="min-w-44">
            <option value="">Paused</option>
            {options.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">Hold (minutes)
          <Input aria-label="Hold (minutes)" inputMode="numeric" value={hold} invalid={!holdOk} onChange={e => setHold(e.target.value)} className="w-24" />
        </label>
        <Button variant="primary" disabled={!dirty || !holdOk || saving} onClick={apply}>Apply</Button>
        <span className="ml-auto text-xs text-muted">{status.active_source ? `Live from ${status.active_source}` : 'Feed paused'}</span>
      </div>
      <table className="w-full text-left text-xs">
        <thead className="text-muted"><tr><th className="py-1 font-medium">Shard</th><th>Seats</th><th>Source</th><th>Job</th><th>Last post</th><th>Lag</th><th>Recent</th><th /></tr></thead>
        <tbody>
          {status.shards.map(s => (
            <tr key={s.name} className="border-t border-line align-top text-ink">
              <td className="py-1.5 font-semibold">{s.name}</td>
              <td className="tabular-nums">{s.seat_count}</td>
              <td>{s.source ?? <span className="text-muted">paused</span>}</td>
              <td>{s.lease_holder ?? <span className="text-muted">none</span>}</td>
              <td>{s.last_post_at ? timeAgo(s.last_post_at) : '–'}</td>
              <td className={cn('tabular-nums', (s.lag_s ?? 0) > 180 && 'font-semibold text-warn-text')}>{s.lag_s == null ? '–' : `${s.lag_s} s`}</td>
              <td className="tabular-nums text-ink-2">{['applied', 'unchanged', 'stale', 'held', 'rejected'].map(k => s.recent[k] ?? 0).join(' / ')}</td>
              <td>
                {s.rejected.length > 0 && <Button size="sm" variant="ghost" onClick={() => setOpen(open === s.name ? null : s.name)}>{s.rejected.length} rejected</Button>}
                {open === s.name && <ul className="mt-1 space-y-0.5 text-bad-text">{s.rejected.map(r => <li key={r.const_id}>{r.const_id}: {r.reason}</li>)}</ul>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDialog open={confirm} title="Switch source" tone="danger" confirmLabel="Switch"
        description={`Switch the live source to ${source}? The current source's posts will be refused from now on.`}
        onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void onApply(source || null, holdN); }} />
    </section>
  );
}
```

(Check `ConfirmDialog`'s prop names and `Button`'s `size` values in `components/ui` and adjust; `cn` is `components/ui/cn.ts`.)

Wire into `LiveConsole.tsx` after `<LiveHeader … />`:

```tsx
      {feed.status && <FeedPanel status={feed.status} sources={feed.sources} saving={feed.saving} onApply={feed.setFeed} />}
```

with `const feed = useIngestFeed(lc.electionId);` near the other hooks and the imports added.

Run: `cd admin && npx vitest run && npx tsc --noEmit` — Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add admin/src
git commit -m "feat(admin): Live Console feed panel (source, pause, hold, shard status, alerts)"
```

---

### Task 15: Seat corrections and holds in the Live Console

**Files:**
- Create: `admin/src/components/live/HoldsPanel.tsx`, `admin/src/components/live/HoldsPanel.test.tsx`
- Modify: `admin/src/hooks/useSeatEditor.ts` (`build` returns the ingest seat shape), `admin/src/hooks/useLiveConsole.ts` (`SeatSave`, `saveSeat` → `correctSeat`; holds list + release), `admin/src/components/live/SeatEditor.tsx` (seat-state select instead of per-row status pickers; "On hold until hh:mm" line), `admin/src/pages/LiveConsole.tsx` (render `HoldsPanel`)
- Test: update `admin/src/hooks/useSeatEditor.test.ts`, `admin/src/hooks/useLiveConsole.test.ts`, `admin/src/pages/LiveConsole.test.tsx`

**Interfaces:**
- Consumes: Task 14 `correctSeat`, `getHolds`, `releaseHold`.
- Produces:

```ts
export type SeatStateName = 'not_started' | 'counting' | 'declared' | 'countermanded' | 'adjourned';
export interface SeatSave { state: SeatStateName; round: { current: number; total: number } | null; votes: Record<string, number> }  // replaces the overrides shape
// useSeatEditor: build(declare: boolean) → { ok: true; save: SeatSave } | { ok: false; error: string }; plus `seatState` + `setSeatState`
// useLiveConsole: holds: HoldRow[]; releaseHold(constId): Promise<void>; saveSeat(constId, SeatSave) → correctSeat; reloads holds after a save
```

Behaviour changes (all follow from the server deriving statuses, spec §4.4 rule 5):
- Per-row status pickers go away; each row shows the status the server will derive (preview with `rankSeat`/`deriveStatuses` as today) — read-only.
- A **Seat state** select: Counting, Declared, Countermanded, Adjourned, Not started. "Declare" sets Declared and saves (the existing declare-confirm flow stays).
- Rounds: both fields filled → `{ current, total }`; both empty → `null`; one empty → error "Fill both round fields or neither".
- After a save the editor shows "On hold until 10:42 (IST)" from the response's `hold_expires_at` (`clockIst`).

- [ ] **Step 1: Update `useSeatEditor` tests first**

Replace the status-related cases in `useSeatEditor.test.ts` with:

```ts
it('build returns votes by candidate id, the seat state and the rounds', () => {
  const { result } = renderHook(() => useSeatEditor(seat));   // fixture seat with two candidates (c1, c2), current_round 3, total 20
  act(() => result.current.setVotes(seat.candidates[0].result_id, '500'));
  const out = result.current.build(false);
  expect(out).toEqual({ ok: true, save: { state: 'counting', round: { current: 3, total: 20 }, votes: { [seat.candidates[0].candidate_id]: 500, [seat.candidates[1].candidate_id]: seat.candidates[1].votes } } });
  expect(result.current.build(true)).toMatchObject({ ok: true, save: { state: 'declared' } });
});
it('one round field empty is an error; both empty is no round', () => {
  const { result } = renderHook(() => useSeatEditor(seat));
  act(() => result.current.setRound('total', ''));
  expect(result.current.build(false)).toEqual({ ok: false, error: 'Fill both round fields or neither' });
  act(() => result.current.setRound('current', ''));
  expect(result.current.build(false)).toMatchObject({ ok: true, save: { round: null } });
});
it('the seat state can be set to countermanded', () => {
  const { result } = renderHook(() => useSeatEditor(seat));
  act(() => result.current.setSeatState('countermanded'));
  expect(result.current.build(false)).toMatchObject({ ok: true, save: { state: 'countermanded' } });
});
```

(Use the file's existing `seat` fixture name; give its candidates `candidate_id` values if they lack them.)

Run: `cd admin && npx vitest run src/hooks/useSeatEditor.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement in `useSeatEditor.ts`**

- Add `const [seatState, setSeatStateRaw] = useState<SeatStateName>(() => (seat?.candidates.some(c => c.status === 'WON') ? 'declared' : 'counting'));` reset in `reset()`; `setSeatState` marks dirty.
- Remove `setStatus` / `statusTouched`; statuses in `rows` are always `deriveStatuses(next, seatState === 'declared')` (preview).
- Replace `build`:

```ts
  const build = useCallback((declare: boolean): BuildResult => {
    if (view.rows.some((r) => r.error)) return { ok: false, error: 'Fix the highlighted votes' };
    const cur = round.current.trim(), tot = round.total.trim();
    if ((cur === '') !== (tot === '')) return { ok: false, error: 'Fill both round fields or neither' };
    let r: { current: number; total: number } | null = null;
    if (cur !== '') {
      const c = parseVotes(cur), t = parseVotes(tot);
      if (c === null || t === null) return { ok: false, error: 'Rounds must be whole numbers' };
      if (c > t) return { ok: false, error: 'Current round cannot exceed total rounds' };
      r = { current: c, total: t };
    }
    const votes = Object.fromEntries(rows.map((x) => [x.candidate_id, x.votes]));
    return { ok: true, save: { state: declare ? 'declared' : seatState, round: r, votes } };
  }, [view.rows, rows, round, seatState]);
```

with `type BuildResult = { ok: true; save: SeatSave } | { ok: false; error: string };` and `SeatSave`/`SeatStateName` imported from `useLiveConsole`.

Run: `cd admin && npx vitest run src/hooks/useSeatEditor.test.ts` — Expected: pass.

- [ ] **Step 3: `useLiveConsole` saves through the correction API and lists holds (test first)**

In `useLiveConsole.test.ts`, replace the `bulkOverride` mock expectation with:

```ts
it('saveSeat sends the seat to the correction API, then reloads seats and holds', async () => {
  // existing setup …
  await act(async () => { await result.current.saveSeat('S1', { state: 'counting', round: { current: 3, total: 20 }, votes: { c1: 5, c2: 4 } }); });
  expect(ingest.correctSeat).toHaveBeenCalledWith('e1', 'S1', { state: 'counting', round: { current: 3, total: 20 }, votes: { c1: 5, c2: 4 } });
  expect(ingest.getHolds).toHaveBeenCalledTimes(2);   // initial load + after save
});
```

(mock `../services/ingest.service` with `correctSeat`, `getHolds`, `releaseHold` in that test file.)

Implement: `SeatSave` as in Interfaces; `saveSeat` calls `correctSeat(electionId, constId, payload)`, stores `holdUntil[constId] = res.hold_expires_at`, then `await load(true)` and `await loadHolds()`; `holds` state loaded with the seats and every 15 s (same sweep timer as locks); `releaseHold(constId)` calls the service then `loadHolds()`. Return `holds`, `releaseHold`, `holdUntil`.

- [ ] **Step 4: `HoldsPanel` (test first) and the editor**

```tsx
// admin/src/components/live/HoldsPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HoldsPanel } from './HoldsPanel';

describe('HoldsPanel', () => {
  it('lists held seats with time left and releases one', () => {
    const onRelease = vi.fn();
    render(<HoldsPanel holds={[{ const_id: 'S1', const_no: 40, name: 'Sorbhog', round_at_hold: 8, expires_at: new Date(Date.now() + 5 * 60_000).toISOString(), created_by_name: 'Asha' }]} onRelease={onRelease} />);
    expect(screen.getByText(/#40 Sorbhog/)).toBeTruthy();
    expect(screen.getByText(/round 8/)).toBeTruthy();
    expect(screen.getByText(/[45] min left/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Release #40 Sorbhog' }));
    expect(onRelease).toHaveBeenCalledWith('S1');
  });
  it('renders nothing without holds', () => {
    const { container } = render(<HoldsPanel holds={[]} onRelease={vi.fn()} />);
    expect(container.textContent).toBe('');
  });
});
```

```tsx
// admin/src/components/live/HoldsPanel.tsx
import { Button } from '../ui/Button';
import type { HoldRow } from '../../types';

/** Seats an admin correction is holding (spec §5): released by a later round, the timer, or here. */
export function HoldsPanel({ holds, onRelease }: { holds: HoldRow[]; onRelease(constId: string): void }) {
  if (!holds.length) return null;
  return (
    <section aria-label="Seats on hold" className="mx-6 mb-4 rounded-card border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn-text">
      <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide">On hold ({holds.length})</h2>
      <ul className="flex flex-wrap gap-2">
        {holds.map(h => {
          const label = `#${h.const_no} ${h.name}`;
          const mins = Math.max(0, Math.ceil((new Date(h.expires_at).getTime() - Date.now()) / 60_000));
          return (
            <li key={h.const_id} className="flex items-center gap-2 rounded-control border border-warn/40 bg-card px-2.5 py-1 text-ink">
              <span>{label}</span>
              <span className="text-xs text-ink-2">{h.round_at_hold != null ? `round ${h.round_at_hold} · ` : ''}{mins} min left{h.created_by_name ? ` · ${h.created_by_name}` : ''}</span>
              <Button size="sm" variant="ghost" aria-label={`Release ${label}`} onClick={() => onRelease(h.const_id)}>Release</Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

`SeatEditor.tsx`: replace each row's status `<select>` with the read-only `StatusPill` of the previewed status; add above the rounds inputs:

```tsx
          <label className="flex items-center gap-2 text-xs font-medium text-ink-2">Seat state
            <Select aria-label="Seat state" value={ed.seatState} disabled={readOnly} onChange={(e) => ed.setSeatState(e.target.value as SeatStateName)}>
              <option value="counting">Counting</option><option value="declared">Declared</option>
              <option value="countermanded">Countermanded</option><option value="adjourned">Adjourned</option><option value="not_started">Not started</option>
            </Select>
          </label>
```

change `submit` to `if (await onSave(seat.const_id, out.save)) ed.markSaved();` and show `{holdUntil && <p className="text-xs text-warn-text">On hold until {clockIst(holdUntil)} (IST): the feed will not overwrite this seat until a later round or then.</p>}` (new prop `holdUntil?: string`). Render `<HoldsPanel holds={lc.holds} onRelease={lc.releaseHold} />` in `LiveConsole.tsx` under the feed panel, and pass `holdUntil={lc.holdUntil[lc.selected.const_id]}` to the editor.

Update `LiveConsole.test.tsx` mocks: replace `bulkOverride` with `correctSeat`/`getHolds`/`releaseHold` from `../services/ingest.service`, and any assertion on per-row status selects with the seat-state select.

Run: `cd admin && npx vitest run && npx tsc --noEmit` — Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add admin/src
git commit -m "feat(admin): seat corrections through the correction API, holds panel"
```

---

### Task 16: Shards dialog, machine keys page, reopen

**Files:**
- Create: `admin/src/components/live/ShardsDialog.tsx`, `admin/src/components/live/ShardsDialog.test.tsx`, `admin/src/pages/IngestKeys.tsx`, `admin/src/pages/IngestKeys.test.tsx`
- Modify: `admin/src/components/live/FeedPanel.tsx` ("Shards…" button opening the dialog), `admin/src/App.tsx` (route `ingest-keys`, SUPER_ADMIN), `admin/src/utils/navigation.config.ts` (nav item "Ingest keys", icon `KeyRound` from lucide, `roles: SUPER`), `admin/src/components/entity/elections/ElectionPanel.tsx` (SUPER_ADMIN "Reopen" button for a Finalized election, with `ConfirmDialog`)

**Interfaces:**
- Consumes: Task 14 service functions.
- Produces: `ShardsDialog({ open, electionId, shards: IngestShardStatus[], onClose, onSaved })` — list with delete; form: name (`^[a-z0-9][a-z0-9_-]*$`, not "rest"), selector by **one** of: states (multi-select from `/states`), regions or districts (multi-select from the existing geo service), or seat-number ranges (`1-100, 120-130` text parsed to `[[1,100],[120,130]]`); optional source override. Save errors (409 overlap) show the message with the clashing seats.
- `IngestKeys` page: `PageHeader` "Ingest keys", `DataTable` (name, created, last used, status), "New key" → name prompt → shows the key **once** in a read-only `Input` with a Copy button and the text "Copy it now: it will not be shown again."; Revoke with `ConfirmDialog`.

- [ ] **Step 1: Failing tests**

```tsx
// admin/src/components/live/ShardsDialog.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
vi.mock('../../services/ingest.service', () => ({ putShard: vi.fn(async () => ({})), deleteShard: vi.fn(async () => ({})) }));
import * as svc from '../../services/ingest.service';
import { ShardsDialog, parseRanges } from './ShardsDialog';

describe('parseRanges', () => {
  it('parses "1-100, 120-130, 7"', () => expect(parseRanges('1-100, 120-130, 7')).toEqual([[1, 100], [120, 130], [7, 7]]));
  it('rejects junk and reversed ranges', () => { expect(parseRanges('a-b')).toBeNull(); expect(parseRanges('10-5')).toBeNull(); });
});

describe('ShardsDialog', () => {
  it('saves a seat-range shard', async () => {
    const onSaved = vi.fn();
    render(<ShardsDialog open electionId="e" shards={[]} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'north' } });
    fireEvent.change(screen.getByLabelText('Seat numbers'), { target: { value: '1-100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save shard' }));
    await waitFor(() => expect(svc.putShard).toHaveBeenCalledWith('e', 'north', { selector: { const_no_ranges: [[1, 100]] }, source_override: null }));
    expect(onSaved).toHaveBeenCalled();
  });
  it('refuses the reserved name', () => {
    render(<ShardsDialog open electionId="e" shards={[]} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'rest' } });
    expect((screen.getByRole('button', { name: 'Save shard' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
```

```tsx
// admin/src/pages/IngestKeys.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
vi.mock('../services/ingest.service', () => ({
  getIngestKeys: vi.fn(async () => [{ id: 'k1', name: 'worker-sg', created_at: '2027-02-20T05:00:00Z', last_used_at: null, revoked_at: null }]),
  createIngestKey: vi.fn(async () => ({ key: 'mpk_secret', row: { id: 'k2', name: 'laptop', created_at: '2027-02-21T05:00:00Z', last_used_at: null, revoked_at: null } })),
  revokeIngestKey: vi.fn(async () => ({})),
}));
import IngestKeys from './IngestKeys';
// wrap in the providers other page tests use (copy from src/pages/Users.test.tsx)

describe('IngestKeys', () => {
  it('lists keys, creates one and shows it once', async () => {
    render(<IngestKeys />);
    expect(await screen.findByText('worker-sg')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'New key' }));
    fireEvent.change(screen.getByLabelText('Key name'), { target: { value: 'laptop' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect((screen.getByLabelText('New key value') as HTMLInputElement).value).toBe('mpk_secret'));
    expect(screen.getByText(/will not be shown again/)).toBeTruthy();
  });
});
```

Run: `cd admin && npx vitest run src/components/live/ShardsDialog.test.tsx src/pages/IngestKeys.test.tsx` — Expected: FAIL.

- [ ] **Step 2: Implement**

`ShardsDialog.tsx` — export `parseRanges(text: string): [number, number][] | null` (split on commas; each part `a-b` or `a`, integers, a ≤ b; empty text → null), and the dialog built on `FormDialog`: a list of existing shards (name, seat count, source override, Delete), and a form with `Field`s labelled exactly `Name`, `Selector` (a `Select`: "Seat numbers", "States", "Regions", "Districts"), `Seat numbers` (text, when that selector kind is chosen), multi-selects for the others (load options with the existing geo/state services — `grep -n "export" admin/src/services/geo.service.ts`), `Source override` (optional text), and a `Save shard` primary button disabled when the name is invalid or `rest` or the selector is empty. On save: `putShard(electionId, name, { selector, source_override: override || null })`, then `onSaved()`; on error show `err.message` and, for 409, `err.details.sample.join(', ')`.

`IngestKeys.tsx` — `PageHeader` + `DataTable` (columns: Name; Created `formatIst`; Last used `timeAgo` or "never"; Status `Badge` ok "active" / muted "revoked"; a Revoke `Button` (danger, hidden when revoked) with `ConfirmDialog` "Revoke key <name>? Jobs using it stop at their next request."). "New key" opens a `FormDialog` with an `Input` labelled `Key name` and a `Create` button; on success the dialog shows a read-only `Input` labelled `New key value` with the key, a Copy button (`navigator.clipboard.writeText`), and "Copy it now: it will not be shown again." The page scrolls itself (`h-full overflow-y-auto`).

`App.tsx`: `<Route path="ingest-keys" element={<ProtectedRoute roles={['SUPER_ADMIN']}><IngestKeys /></ProtectedRoute>} />`. `navigation.config.ts`: `{ path: '/ingest-keys', label: 'Ingest keys', icon: KeyRound, roles: SUPER }` after "System status".

`FeedPanel.tsx`: a `Shards…` ghost button next to Apply opens `ShardsDialog` (pass `status.shards.filter(s => s.name !== 'rest')`, `onSaved` → `reload` from `useIngestFeed`; add an `onShardsChanged` prop).

`ElectionPanel.tsx`: when `election.status === 'Finalized'` and the user is SUPER_ADMIN, show a `Reopen for corrections` danger button → `ConfirmDialog` ("Reopen <name>? It becomes Live again: the feed and admin corrections can change results until you finalize it again.") → `reopenElection(id)` then reload the elections list.

Run: `cd admin && npx vitest run && npx tsc --noEmit` — Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add admin/src
git commit -m "feat(admin): shards dialog, ingest keys page, reopen a finalized election"
```

---

## Part D — Public pages, cleanup, docs

### Task 17: Viewers see seat state and rounds

**Files:**
- Modify: `frontend/src/model/types/index.ts` (`ResultsSnapshot.seats`), `frontend/src/model/derive/seatView.ts` (`LiveChipState`, `liveChipState`), `frontend/src/viewmodels/tiles/useSeatDialogVM.ts` and `frontend/src/viewmodels/pages/useConstituencyPageVM.ts` (pass the snapshot's seat entry), the `LiveChip` component (`grep -rn "function LiveChip" frontend/src/views`), `frontend/src/i18n/locales/{en,hi,mr,ta}.json`
- Test: `frontend/src/model/derive/__tests__/seatView.test.ts` (or the file testing `liveChipState`), the LiveChip view test

**Interfaces:**
- Produces:

```ts
export interface SeatLiveState { state: 'not_started' | 'counting' | 'declared' | 'countermanded' | 'adjourned'; cr: number | null; tr: number | null }
// ResultsSnapshot gains: seats?: Record<string, SeatLiveState>
export type LiveChipState = { kind: 'counting'; round: { current: number; total: number } | null } | { kind: 'declared' } | { kind: 'countermanded' } | { kind: 'adjourned' } | null;
export function liveChipState(status, rows, detail, seat?: SeatLiveState | null): LiveChipState;
```

Rules: Upcoming → null; Finalized → declared; else if `seat` given: countermanded / adjourned → that kind; declared → declared; counting/not_started → counting with `seat.cr/tr` when both set (else `detail` rounds); without `seat` → today's behaviour.

- [ ] **Step 1: Failing test**

```ts
import { liveChipState } from '../seatView';
describe('liveChipState with the snapshot seat state', () => {
  const rows: any[] = [];
  it('countermanded and adjourned win over everything but Finalized', () => {
    expect(liveChipState('Live', rows, null, { state: 'countermanded', cr: null, tr: null })).toEqual({ kind: 'countermanded' });
    expect(liveChipState('Live', rows, null, { state: 'adjourned', cr: 3, tr: 20 })).toEqual({ kind: 'adjourned' });
    expect(liveChipState('Finalized', rows, null, { state: 'adjourned', cr: 3, tr: 20 })).toEqual({ kind: 'declared' });
  });
  it('rounds come from the snapshot first, then the detail', () => {
    expect(liveChipState('Live', rows, { current_round: 2, total_rounds: 20 }, { state: 'counting', cr: 5, tr: 20 })).toEqual({ kind: 'counting', round: { current: 5, total: 20 } });
    expect(liveChipState('Live', rows, { current_round: 2, total_rounds: 20 }, { state: 'counting', cr: null, tr: null })).toEqual({ kind: 'counting', round: { current: 2, total: 20 } });
  });
});
```

Run: `cd frontend && npx vitest run src/model/derive` — Expected: FAIL.

- [ ] **Step 2: Implement**

```ts
export function liveChipState(
  status: 'Upcoming' | 'Live' | 'Finalized' | null | undefined,
  rows: ResultRow[],
  detail: { current_round?: number | null; total_rounds?: number | null } | null,
  seat?: SeatLiveState | null,
): LiveChipState {
  if (!status || status === 'Upcoming') return null;
  if (status === 'Finalized') return { kind: 'declared' };
  if (seat?.state === 'countermanded' || seat?.state === 'adjourned') return { kind: seat.state };
  if (seat?.state === 'declared' || rows.some(r => r.status === 'WON')) return { kind: 'declared' };
  const round = seat?.cr && seat.tr ? { current: seat.cr, total: seat.tr }
    : detail?.current_round && detail.total_rounds ? { current: detail.current_round, total: detail.total_rounds } : null;
  return { kind: 'counting', round };
}
```

VMs: pass `live.snapshot?.seats?.[constId] ?? null` (constituency page VM: `live.snapshot`; seat dialog VM: the dashboard source's latest snapshot — find where it reads `src.data` rows and the snapshot it came from; if the snapshot object isn't kept, add `seats` to the dashboard data next to `results` in `useDashboardData`/`useLiveSnapshot`'s consumer).

`LiveChip`: add the two kinds with i18n keys `live_countermanded` ("Countermanded", hi "मतगणना रद्द") and `live_adjourned` ("Counting adjourned", hi "मतगणना स्थगित"), styled like the counting chip but `text-warn-text`; add the keys to all four locale files (mr/ta get the English text).

Run: `cd frontend && npx vitest run && npx tsc --noEmit && npm run lint` — Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src
git commit -m "feat(fe): seat state and rounds from the live snapshot (countermanded, adjourned)"
```

---

### Task 18: Remove the old override endpoints

**Files:**
- Delete: `backend/src/modules/live/bulk-override.service.ts` (+ spec), `backend/src/modules/live/result-override.service.ts` (+ spec), `backend/src/modules/live/dto/result-override.dto.ts` (+ spec), `backend/src/modules/admin/controllers/admin-results.controller.ts`
- Modify: `backend/src/modules/live/live.module.ts`, `backend/src/modules/admin/admin.module.ts`, `backend/src/app.setup.ts` (drop `BULK_OVERRIDE_PATH` / limit), `admin/src/services/election.service.ts` (drop `overrideResult`, `bulkOverride`), `admin/src/utils/seat-math.ts` (drop `buildSeatOverrides` / `BulkOverrideItem` if now unused), any test referencing them

**Interfaces:** none produced; this removes write paths so ingest + correction are the only ones (Global Constraint 1).

- [ ] **Step 1: Find every reference**

Run: `cd /Users/metallonudo/code/election/election-tracker && grep -rn "override-bulk\|BulkOverride\|ResultOverride\|overrideResult\|bulkOverride\|BULK_OVERRIDE" backend/src admin/src scraper/src frontend/src docs/*.md | grep -v node_modules`
Expected: only the files listed above (plus docs). If `scraper/src/loadtest` or anything else still posts to these routes, move it to the ingest API first (it would need a machine key) — note it in the commit.

- [ ] **Step 2: Delete and unwire**

Remove the files; remove `ResultOverrideService`, `BulkOverrideService` from `LiveModule` providers/exports and `AdminResultsController` from `AdminModule`; remove the bulk-override middleware line and its two constants from `app.setup.ts` (and from `app.setup.spec.ts` if asserted); remove the two admin service functions and dead helpers.

- [ ] **Step 3: Run everything**

Run: `cd backend && npx tsc --noEmit && npx jest && cd ../admin && npx tsc --noEmit && npx vitest run && cd ../scraper && npx tsc --noEmit && npx vitest run`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add -A backend/src admin/src scraper/src
git commit -m "refactor: remove the result override endpoints (ingest and seat correction replace them)"
```

---

### Task 19: Runbook and docs

**Files:**
- Create: `docs/LIVE_RUNBOOK.md`
- Modify: `docs/FEATURES.md` (new section "Live results ingest"), `CLAUDE.md` (Tech Stack backend line, Scraper line, Database notes), `docs/DEPLOYMENT.md` (worker deployment), `docs/SCRAPING.md` (pointer to the live worker), `scraper/package.json` description

- [ ] **Step 1: Write the runbook**

`docs/LIVE_RUNBOOK.md` with these sections, each a numbered checklist using the real commands from Tasks 11–13 and the admin screens from Tasks 14–16:

1. **T−7 days** — election records (`delimitation`, map, result date); candidates seeded from ECI's own candidate lists; Admin → Ingest keys: create `worker-<host>` and `laptop`; Live Console → Shards… (one per region if the state is large, else none); `live.config.json` from `live.config.example.json` (ECI base URL and state code for this election, e.g. `ResultAcGenMay2026` / `S25`); `INGEST_KEY=… npm run live:check -- --election <id> --source eci-web` until it prints `READY`; deploy the worker (stopped).
2. **T−1** — dry runs against the real site; drills: (a) stop the cloud worker → the laptop's loop takes the lease within 90 s; (b) switch the source to another and back; (c) correct a seat → it shows On hold → a later round releases it; (d) Pause → Resume; (e) two shards on two machines; set `INGEST_ALERT_WEBHOOK_URL` and see a test alert.
3. **Counting day** — at counting start: Elections → status Live; Live Console → Source = eci-web; start the worker; watch feed status (lag, lease, rejected seats, tally); what to do for each alert (lag → check ECI reachability, switch source if needed; lease lapsed → start the laptop worker; rejected seats → fix the mapping (`partyAliases`) or correct the seat by hand; tally mismatch → compare with ECI's party-wise page).
4. **After** — every seat declared and tally matching; Finalize; stop workers (`Ctrl-C` releases leases); revoke the keys; note any manual corrections in the audit log.
5. **Simulation** — `sim:mock-eci`, `sim:setup`, flip Live, `sim:live`, `sim:replay` (or `sim:smoke`).

- [ ] **Step 2: Update the docs**

- `docs/FEATURES.md`: a "Live results ingest (2026-10-03)" section listing: ingest API and its rules, machine keys, shards and leases, one active source with shard overrides, holds, feed panel / holds panel / shards dialog / keys page, alerts and `/health/ingest`, snapshot seat states, the worker (`npm run live`, `live:check`, adapters `eci-web`, `mock-eci`), simulation through ingest, removed override endpoints.
- `CLAUDE.md`: in Tech Stack → Backend add "live ingest API for the counting-day worker (`/ingest/…`, machine keys, shards + leases, holds; spec `docs/superpowers/specs/2026-10-03-live-ingest-design.md`, runbook `docs/LIVE_RUNBOOK.md`)"; replace the Scraper line's "Live ECI ingestion is **not implemented** (stubs only)" with "the counting-day worker `scraper/src/live/` (`npm run live`, adapters `eci-web` / `mock-eci`) posts to the ingest API; nothing writes results to the DB directly"; add migration 020 to the database notes.
- `docs/DEPLOYMENT.md`: "Live worker" — Render background worker or Fly.io machine in Singapore, command `npm run live -- --config live.config.json` in `scraper/`, env `INGEST_API_URL`, `INGEST_KEY`, `LIVE_HOLDER`; start before counting, stop after; the laptop runs the same command as backup.
- Remove the old scraper stubs (`scraper/src/index.ts`, `scheduler/`, `normalizer/`, `adapters/eci-adapter.ts`, `cache/`) if nothing imports them (`grep -rn` first) and the `start`/`dev` scripts that run them; update the `description` in `scraper/package.json`.

- [ ] **Step 3: Full check and commit**

Run: `cd backend && npx tsc --noEmit && npx jest && cd ../admin && npx tsc --noEmit && npx vitest run && cd ../frontend && npx tsc --noEmit && npx vitest run && npm run lint && cd ../scraper && npx tsc --noEmit && npx vitest run`
Expected: all pass.

```bash
git add -A docs CLAUDE.md scraper
git commit -m "docs: live ingest runbook, features, deployment; remove scraper stubs"
```
