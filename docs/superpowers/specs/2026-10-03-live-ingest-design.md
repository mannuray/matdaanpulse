# Live results ingest — design

Date: 2026-10-03 · Status: agreed in conversation, awaiting written-spec review
Counting days this targets: the 2026 state elections (Assam, Kerala, Tamil Nadu, West Bengal, Puducherry), then 27 Feb 2027.

## 1. Goal

On counting day a running **job** reads results from a **source** (ECI first, any other source the operator chooses) and
updates the results **only through a defined ingest API**: nothing writes results to the database directly. Accepted
changes reach the public pages through the existing live path (version bump → `/live` → immutable snapshot behind the CDN)
and the admin Live Console (Redis → SSE).

Agreed decisions:

| # | Decision |
|---|---|
| D1 | The API takes the **full current state of a seat** (every candidate's votes, round, seat state), never deltas. Re-sending is harmless; a missed cycle is caught up by the next. |
| D2 | The API is **source-neutral**. Fetching (HTML, JSON, SSE, any API), parsing and mapping a source's names to our records is the **job's** work. The server knows nothing about ECI. |
| D3 | **One active source** at a time per election (no merging). The admin switches or pauses it at any time. A **shard may override** the election's source. |
| D4 | An **admin correction** applies at once and puts the seat **on hold**. The hold releases itself when a source reports a **later round** than at the correction, or after a **time limit** (default 10 min, per election); the admin can release it early. A forgotten correction never freezes a seat. |
| D5 | The **job, any external script and admin edits** all go through APIs. |
| D6 | The job is a **separate always-on worker** (Render or Fly.io, Singapore, near the API), run around counting days. The same code runs on a laptop as the backup. Not inside the API process. |
| D7 | Work is split into **shards**: named, non-overlapping seat sets within an election. One job may run many shards; shards may run on different machines. A **lease per shard** ensures one writer per seat. |

## 2. Existing pieces this builds on (and what changes)

- Kept: `election_live_state` version + statement-level triggers (migration 015), `/elections/:id/live`, `results?v=`
  immutable snapshots (CDN), frontend poller, `ResultChangeNotifier.afterCommit` (live-state invalidate, cache purge,
  Redis publish for the Live Console).
- Kept: single-seat admin override (`PATCH /admin/results/override`); it now also creates a hold (§6) and is refused on
  Finalized elections.
- Retired: `POST /admin/results/override-bulk` (only the simulation used it). The simulation becomes the `mock-eci`
  adapter on the ingest path.
- Replaced: the scraper stubs (`scraper/src/index.ts`, `scheduler/`, `normalizer/`, `adapters/eci-adapter.ts`) by the
  live worker (§7). The cheerio parsers (`scraper/src/live/adapters/eci-parse.ts`, formerly in `adapters/eci-vs-adapter.ts`) are reused inside the `eci-web`
  adapter.

## 3. Data model (one new migration)

```
election_ingest          election_id PK → elections, active_source TEXT NULL (NULL = paused),
                         hold_minutes INT NOT NULL DEFAULT 10, updated_at, updated_by
ingest_shards            id, election_id, name (unique per election), source_override TEXT NULL,
                         selector JSONB  -- { state_ids?: int[], region_ids?: int[], district_ids?: int[],
                                         --   const_no_ranges?: [[from,to],...] }  (any one or more; union)
                         lease_holder TEXT NULL, lease_key_id → ingest_keys NULL, lease_expires_at TIMESTAMPTZ NULL
                         -- a default shard "rest" (selector NULL) exists per election: all seats in no other shard
seat_ingest_state        (election_id, const_id) PK, state TEXT  -- not_started|counting|declared|countermanded|adjourned
                         round_current INT NULL, round_total INT NULL,
                         last_source TEXT NULL, last_observed_at TIMESTAMPTZ NULL, last_applied_at TIMESTAMPTZ NULL
seat_holds               (election_id, const_id) PK, round_at_hold INT NULL, expires_at TIMESTAMPTZ, created_by → users
ingest_keys              id, name UNIQUE, key_hash, created_by, created_at, last_used_at, revoked_at,
                         election_id → elections NULL (CASCADE), expires_at NULL   -- migration 026; NULL = legacy key
ingest_log               id, election_id, shard_id, key_id, source, dry_run BOOL, received_at,
                         counts JSONB {applied, unchanged, stale, held, rejected}, rejected JSONB [{const_id, reason}]
                         -- kept 30 days
```

- Shards may not overlap: saving a shard whose resolved seat set intersects another's is refused (409).
- `constituencies.current_round/total_rounds` stay (read by the seat detail); ingest writes them together with
  `seat_ingest_state`.
- The live-version triggers gain: `seat_ingest_state` (state, round_current, round_total) and `elections.status`.

## 4. Ingest API (machine key: `Authorization: Bearer <key>`)

All under `/api/v1/ingest/elections/:electionId`. Keys are not admin JWTs; they can call only these routes.
Before the 5 MB body parser a gate refuses anything but `Bearer mpk_<43 base64url chars>` (401) and IPs with 10+ failed key
checks in the last minute (429, in memory per instance); successful key lookups are cached 30 s (2026-10-08 security review).
Every route is `no-store`.

### 4.1 `GET …/roster`
Our identifiers for the election, for the job to build its mapping:
```json
{ "election": { "id": "…", "type": "VS", "state_id": 4, "year": 2026, "status": "Live" },
  "parties": [{ "id": "BJP", "name": "Bharatiya Janata Party", "abbreviation": "BJP" }],
  "seats": [{ "const_id": "AS_VS26_40_X", "const_no": 40, "name": "X", "type": "GEN", "state_id": 4,
              "candidates": [{ "candidate_id": "uuid", "name": "RAMESH KUMAR", "party_id": "BJP" },
                             { "candidate_id": "uuid", "name": "NOTA", "party_id": "NOTA" }] }] }
```
`?shard=<name>` limits `seats` to the shard.

### 4.2 `GET …/config?shard=<name>`
`{ status, source (shard override or election source; null = paused), poll_hint_ms, shard: { name, seat_count },
lease: { expires_at } }` (no holder name). The job reads it every cycle; a source switch takes effect on the next cycle.

### 4.3 `POST …/lease`
Body `{ shard, holder }` (`holder` = free text naming the instance, e.g. `worker-sg-1`, `laptop`). Claims the shard's
lease if free or expired, or renews it if the caller holds it; 90 s TTL. `409 lease_held { expires_at }` otherwise (the current holder's name is not returned; 2026-10-08 security review).
`DELETE …/lease?shard=` releases it (clean shutdown).

### 4.4 `POST …/seats`
```json
{ "shard": "rest", "source": "eci-web", "observed_at": "2027-02-27T09:41:05+05:30", "dry_run": false,
  "seats": [{ "const_id": "AS_VS26_40_X", "state": "counting",
              "round": { "current": 12, "total": 20 },
              "votes": { "<candidate_id>": 41230, "<candidate_id>": 39114, "<nota candidate_id>": 812 } }] }
```
Up to 500 seats per request.

**Request-level checks** (whole request refused, nothing written; dry runs skip the starred ones):
1. Key valid, not revoked, not expired (401), and created for this election (403; migration 026).
2. Election exists and is `Live` (`409 not_live`).*
3. `source` equals the shard's effective source (`409 inactive_source`).*
4. Caller (key + holder from the lease) holds the shard's lease (`409 no_lease`).*
5. `observed_at` not more than 2 min in the future.

**Per-seat rules**, in order; each seat gets an outcome:
1. **Shard:** `const_id` belongs to this election and to the shard → else `rejected: not_in_shard`.
2. **Complete roster:** the keys of `votes` are exactly the seat's candidate ids → else `rejected: roster_mismatch`
   (lists missing / unknown ids). Votes are integers ≥ 0. `round.current ≤ round.total`, both ≥ 0.
3. **Freshness** against `seat_ingest_state`:
   - `stale` if `round.current` < stored round, or rounds are equal (or absent) and `observed_at` <
     `last_observed_at` **from the same source**;
   - after a source switch the first report from the new source is compared on round only;
   - a `declared` seat may only be followed by `declared` (a correction) or by an admin reopen; a later
     `counting` for it is `stale`.
4. **Hold:** if `seat_holds` has the seat: release it when `round.current > round_at_hold` or `now ≥ expires_at`,
   then continue; otherwise `held`. A source that sends no rounds can only release a hold by the timer.
5. **Derive** (sources never send statuses or margins):
   - `counting`: the non-NOTA candidate with the most votes is `LEADING`, all others `TRAILING`; a tie at the top, or
     all zero, → no leader (all `TRAILING`).
   - `declared`: the same candidate `WON`, all others `LOST`; a tie at the top → `rejected: declared_tie`.
   - `not_started`, `countermanded`, `adjourned`: no leader (all `TRAILING`), not counted in tallies.
   - margin = top votes − second votes (non-NOTA), stored on every row of the seat as today.
6. **Change detection:** if votes, statuses, margin, state and round all equal what is stored → `unchanged` (no write,
   no version bump; `seat_ingest_state.last_observed_at` is still advanced). Otherwise `applied`.

All `applied` seats of a request are written in **one transaction** (results rows: votes, status, margin, last_updated;
`seat_ingest_state`; `constituencies.current_round/total_rounds`), then `afterCommit` runs once. Dry runs execute every
rule and return outcomes but write nothing (not even `seat_ingest_state`). Every request (dry run included) adds one
`ingest_log` row.

**Response:** `{ counts: { applied, unchanged, stale, held, rejected }, seats: [{ const_id, outcome, reason? }] }`
(`seats` lists every non-`unchanged` seat).

### 4.5 `POST …/tally` (optional)
`{ shard?, source, observed_at, parties: [{ party_id, won, leading }] }` — the source's own party totals (ECI's
party-wise page). The server compares them with our tally for the same scope and records a mismatch for the Live
Console / alerts; nothing is written to results.

### 4.6 `GET /api/v1/health/ingest`
Public-safe summary per Live election and shard: `{ election_id, shard, paused, lease_expires_at,
last_applied_at, lag_s (now − latest observed_at), rejected_seats, refused_5m, tally_mismatch }`. For an uptime monitor.
No lease holder (final review) and no source name (2026-10-08: a forged post needs it; `paused` = the shard has no source); memoised 10 s in-process since the route is unthrottled.

## 5. Admin (Live Console, per election)

- **Feed:** effective source per shard (dropdown of sources seen in `ingest_log` for the election, plus free text)
  or **Paused**; hold time; shards list (create / edit selector / delete, overlap refused, seat count shown) with per
  shard: lease holder, last post, lag, last cycles' counts, rejected seats with reasons, tally mismatch.
- **Holds:** seats on hold with countdown and **Release**. An edit in the existing seat editor creates/refreshes the
  hold (`round_at_hold` = the seat's stored round; `expires_at` = now + hold minutes).
- **Machine keys** (SUPER_ADMIN): create for one election with an expiry (key shown once), list with election, expiry and last use, revoke.
- **Banners:** shard lag > 3 min, lease lapsed with no new holder for > 2 min, rejected seats > 0, tally mismatch for
  2+ checks, a lease that changed hands in the last 10 min (warn; audit `INGEST_LEASE_TAKEOVER`, 2026-10-08). The same alerts go to an optional webhook (`INGEST_ALERT_WEBHOOK_URL`, Telegram or Slack format).
- Roles: SUPER_ADMIN and EDITOR operate feed and holds; SUPER_ADMIN manages keys and reopens a Finalized election.

## 6. Admin corrections and Finalized elections

- `PATCH /admin/results/override` keeps its body; it now (a) refuses a Finalized election, (b) writes through the same
  derive rules for the seat (the admin sets votes / state / round; statuses and margin are derived), (c) creates the
  hold (§5). Audit row as today.
- **Finalized is locked:** ingest refuses with `not_live`; admin edits refuse with 409. `POST
  /admin/elections/:id/reopen` (SUPER_ADMIN, audited) sets the election back to Live for a late correction.
- Going Live and Finalizing stay manual (runbook steps).

## 7. The live worker (`scraper/src/live/`)

```
scraper/src/live/
  run.ts          entry: npm run live -- --election <id>[:<shard>] ... ; env INGEST_API_URL, INGEST_KEY, LIVE_HOLDER
  check.ts        npm run live:check -- --election <id> --source <adapter> [--shard] : prepare + one poll, dry run,
                  prints unmapped seats/candidates and the dry-run outcomes
  client.ts       typed ingest API client (roster, config, lease, seats, tally), retries with backoff + jitter
  loop.ts         per (election, shard): lease → config → poll → post in chunks → log; idle when paused, not Live,
                  lease held elsewhere, or no adapter for the effective source
  adapters/
    types.ts      SourceAdapter contract
    eci-web.ts    ECI results site (parsers in eci-parse.ts)
    mock-eci.ts   the simulation's mock server (scraper/src/simulation/mock-eci-server.ts)
```

```ts
interface SourceAdapter {
  id: string;                                        // the API's `source` value, e.g. "eci-web"
  prepare(roster: Roster, opts: AdapterOptions): Promise<MappingReport>;  // build source → roster mapping
  poll(): Promise<SeatState[]>;                      // complete state of seats changed since the last poll
  tally?(): Promise<PartyTally | null>;              // the source's own party totals, if it has them
  intervalMs: number;
}
```

- The adapter owns fetching, parsing, caching and mapping. It must only return **complete** seats (every roster
  candidate); a seat it cannot map completely is left out and reported in its log (the server would reject it anyway).
- **eci-web** (first adapter): state → ECI state code table; party mapping from the party-wise page (code + "Full name
  - ABBR"); candidates matched on (seat, normalised name, party), then (seat, party) when unique; poll strategy from
  the 2026-09-30 pipeline review §4 (list pages every cycle with `If-Modified-Since`, candidate pages only for seats
  whose margin/round/status changed, concurrency 2–4 with jitter, browser User-Agent, declared seats re-read once after
  10 min); party-wise page for `tally()`.
- One process runs any number of (election, shard) loops; several processes/hosts can split them (the lease prevents
  overlap). Clean shutdown releases its leases.
- Deploy: a Render background worker or Fly.io machine (Singapore) started before counting and stopped after; the
  laptop runs the same command as backup.

## 8. Delivery changes (public pages)

- Snapshot rows carry the seat's `state` and `round` (`current/total`); `/live` unchanged. A change to either bumps the
  version (trigger on `seat_ingest_state`).
- Seat dialog / constituency page / map show "Round 12/20", "Countermanded", "Adjourned"; a countermanded or adjourned
  seat is not counted as declared and shows no leader.
- `elections.status` changes bump the version, so Upcoming → Live → Finalized reach pages on the next poll.

## 9. Testing

- **Backend (jest, DB specs where the rule is SQL):** every request-level check and per-seat rule in §4.4 — complete
  roster, unknown/missing ids, negative votes, round > total, stale by round and by time, source-switch freshness,
  declared then counting, hold release by round and by timer, held outcome, not_in_shard, lease (claim, renew, expiry,
  takeover, wrong holder), inactive source, not_live, dry run writes nothing, derived statuses (lead, tie, all zero,
  declared tie, countermanded), unchanged seats bump no version, one transaction per request, admin override creates a
  hold and is refused when Finalized, reopen, shard overlap refused, tally mismatch recorded, key revoke.
- **Worker:** adapter contract tests; `eci-web` parsers on **saved real ECI pages** (fixtures), not only the mock's
  layout; loop tests with a fake client (paused, not Live, lease lost, source switched, chunking, retry).
- **End to end:** the simulation drives a full count `mock-eci` → worker → ingest → snapshot → public page (extends the
  existing Playwright e2e).
- **Drills (runbook):** kill the cloud worker → laptop takes the lease within 90 s; switch source mid-count; admin
  correction then hold release; pause and resume; two shards on two machines.

## 10. Runbook (`docs/LIVE_RUNBOOK.md`, written with the build)

- **T−7 days:** election records, candidates seeded from ECI's own lists, `delimitation` and map set, machine keys,
  shards, `live:check` clean (0 unmapped), worker deployed (stopped).
- **T−1:** dry runs against the real site, drills, alert webhook test.
- **Counting day:** flip to Live, start workers, watch feed status; switch / pause / hold as needed.
- **After:** all seats declared, tally matches, Finalize, stop workers, revoke keys.

## 11. Out of scope

Merging several sources at once; notional results; automatic Live / Finalize; Lok Sabha-specific adapters beyond ECI's;
per-seat source selection (shards are the unit).
