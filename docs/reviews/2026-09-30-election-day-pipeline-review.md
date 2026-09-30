# Election-Day Live-Results Pipeline Review

Date: 2026-09-30. Branch: `fix/backend-hardening`. This was a read-only review. Another agent was editing `backend/` at the same time, so backend line numbers may shift by a few lines.

Scope: the counting-day path ECI results site → scraper job → backend ingest → Postgres/Redis → SSE → studio dashboard, plus operations and tests.

---

## 1. Summary

**Verdict: NOT READY for automated counting-day ingestion.** Only the manual path, Admin → Live Console → per-row override, can be used today. Even that path has correctness gaps (see H3 and H5).

The downstream half works and is fairly well hardened: the bulk-ingest API, the transactional set-based UPDATE, Redis pub/sub → SSE fan-out, and the dashboard overlay. The upstream half does not exist:
- No job fetches ECI on a schedule.
- Nothing maps ECI identifiers to ours for a real election.
- Nothing loads the real candidate list with zeroed result rows before counting.
- Nothing monitors the job.

The replay simulation is a demo harness built around mock-only APIs. It is not a prototype of the production job.

The most encouraging finding: I ran the existing Vidhan Sabha HTML parsers (`scraper/src/adapters/eci-vs-adapter.ts`) against real pages from `results.eci.gov.in/ResultAcGenMay2026` (West Bengal, S25), fetched today. They still parse correctly: 20 list rows from one list page, and all 14 candidates plus NOTA from one constituency page.

### What exists vs what is missing

| Piece | State | Evidence |
|---|---|---|
| Scraper entry point / daemon | **Missing**: prints a message and exits 1 | `scraper/src/index.ts:12-21` |
| Scheduler | **Stub**: a cron callback that only logs | `scraper/src/scheduler/index.ts:7-15` |
| Normalizer | **Stub**: returns `[]` | `scraper/src/normalizer/index.ts:5-8` |
| Lok Sabha ECI adapter | **Stub** | `scraper/src/adapters/eci-adapter.ts:5-23` |
| Vidhan Sabha ECI HTML parsers (list page + candidate page) | **Works**, verified on the real May-2026 markup | `eci-vs-adapter.ts:119-184` |
| VS fetch loop | Partial: retries, but no timeout, no User-Agent, hard-coded page count | `eci-vs-adapter.ts:54-66, 91-108` |
| ECI→DB identifier mapping (seat, candidate, party) | **Missing** for real elections. The simulation has a Bihar-only party map and name-based candidate keys | `simulation/config.ts:22-47`, `replay.ts:134-140` |
| Pre-count loader (candidates + zeroed result rows from ECI) | **Missing**. Only `simulation/setup.ts` clones Bihar 2025. `candidates.create` does not create a `results` row, and no API creates result rows | `simulation/setup.ts:66-132`, `candidates.service.ts:84-88` |
| Round parsing (`19/24`) | **Missing**. Replay reads rounds from a mock-only JSON endpoint | `replay.ts:102-106`, `mock-eci-server.ts:352-364` |
| Bulk ingest API `POST /admin/results/override-bulk` | **Works**: validation, ownership check, one UNNEST UPDATE, audit row, SSE, cache purge | `bulk-override.service.ts:35-186` |
| Single override API + admin Live Console | **Works** (manual fallback) | `result-override.service.ts`, `admin/src/pages/LiveConsole.tsx` |
| Machine auth (service account / API key) | **Missing**. A human EDITOR/SUPER_ADMIN JWT (24 h) must be used | `auth.module.ts:18` |
| Ordering / idempotency / correction guards | **Missing** | `bulk-override.service.ts:76-91` |
| Per-seat invariants (exactly one leader, freeze/pin) | **Missing** | — |
| Redis pub/sub → SSE fan-out | **Works**: shared stream per election, heartbeat, resubscribe on reconnect | `live.service.ts`, `shared-sse-stream.ts`, `redis.service.ts:61-79` |
| Frontend SSE consumer + overlay | **Works**, with gaps: no snapshot refetch on reconnect, and the debounce can be starved | `useSSE.ts`, `useDashboardData.ts:136, 309-330` |
| Hosting for the job | **Missing**. Scraper not deployed; Render free spins down | `docs/DEPLOYMENT.md:17, 41` |
| Monitoring / alerting on stalls, ECI vs DB reconciliation | **Missing** | — |
| Tests on the production write path | **Missing**: no spec for `bulk-override.service.ts`, no parser fixture tests, no SSE end-to-end test | see §7 |

---

## 2. End-to-end flow (intended counting-day path)

Legend: `[OK]` implemented, `[PART]` partial, `[MISSING]` not implemented, `[SIM]` exists only in the simulation.

```
 ECI results.eci.gov.in/ResultAcGen<Mon><YYYY>/
   ├─ election-json-Sxx-live.json      (leader per seat, 1 request/state)   [MISSING consumer]
   ├─ partywiseresult-Sxx.htm          (won/leading per party = ECI tally)  [MISSING consumer]
   ├─ statewiseSxx{1..N}.htm           (per-seat leader/runner-up/margin/rounds/status)
   │                                                                        [OK parser; PART fetch loop]
   └─ candidateswise-Sxx{AC}.htm       (all candidates + NOTA, votes, won/lost)
                                                                            [OK parser]
            │
            ▼
 Scraper job (always-on, IST-scheduled, 30-60 s cycle)                      [MISSING]
   ├─ fetch w/ timeout, UA, backoff, If-Modified-Since                      [MISSING]
   ├─ change detection (only re-fetch seats whose margin/rounds changed)    [MISSING]
   ├─ map ECI (state code, AC no, candidate, party) → our result_id         [MISSING; SIM = Bihar-only, name-keyed]
   ├─ derive per-seat statuses (exactly one LEADING/WON), rounds cr/tr      [SIM only; rounds from mock API]
   ├─ reconcile vs party-wise tally, alert on diff                          [MISSING]
   └─ POST /admin/results/override-bulk (one request per cycle per election)[SIM: replay.ts]
            │  Bearer JWT (human admin account, 24 h, no refresh)           [PART]
            ▼
 Backend (Render)                                                           [OK]
   ├─ requireBearerHeader + 5 MB body limit on this route                   [OK] app.setup.ts:75
   ├─ ValidationPipe (≤10k items, statuses, ints ≥0)                        [OK] result-override.dto.ts
   ├─ ownership check (all result_ids ∈ election, else 400 whole batch)     [OK] bulk-override.service.ts:49-60
   ├─ $transaction: UNNEST UPDATE results + constituencies rounds + audit   [OK, no ordering guard]
   ├─ publish 'batch-update' (1 row per seat) to Redis                      [OK]
   └─ purge election:<id>:* cache (SCAN+DEL)                                [OK, but runs after publish]
            ▼
 Redis pub/sub → LiveService shared stream → SSE /live/updates               [OK]
            ▼
 Frontend: useSSE → applyLiveRows overlay (instant map/ticker)               [OK]
           → 4 s trailing-debounce refetch of alliances, vote share, results [PART: starvation, herd]
           → reconnect with backoff                                          [PART: no gap refetch]

 Fallback: Admin Live Console → PATCH /admin/results/override (one row)      [OK, but next scraper cycle overwrites it]
```

---

## 3. Findings by area

Severity is judged for counting day: Critical = wrong or no results shown at scale, High = likely visible errors or outage, Medium = degraded or operational pain, Low = polish.

### 3.1 Scraper

**C1. No production ingestion job exists. (Critical)**
- Evidence: `scraper/src/index.ts:12-21` exits 1. `scheduler/index.ts:9-12` only logs. `normalizer/index.ts:5-8` returns `[]`. `adapters/eci-adapter.ts:10-22` is a stub.
- Counting-day failure: nothing updates the DB unless editors type results into the Live Console one row at a time. For 294 seats × ~10 candidates, that cannot keep up.

**C2. The replay orchestrator depends on mock-only APIs and cannot point at real ECI. (Critical)**
- Evidence:
  - `replay.ts:108-112` calls `POST /advance-round`.
  - `replay.ts:102-106` reads per-seat rounds from `/status/constituencies`. Neither endpoint exists on ECI (they are defined at `mock-eci-server.ts:335-364`).
  - The mock routes hard-code `S04` (`mock-eci-server.ts:375, 387`).
  - Real ECI gives rounds only as the string `24/24` in list column 7 and as `Status of EVM Round: 19/19` on the candidate page. `ConstituencySummary.rounds` holds the raw string and nothing parses it (`eci-vs-adapter.ts:138`).
- Counting-day failure: someone repurposes `replay.ts` against the real base URL. `advanceRound()` gets a 404 and throws, and the process exits (`replay.ts:300-303`).

**H1. Candidates and parties are matched by name, the party map is Bihar-only, and unmatched rows are dropped silently. (High)**
- Evidence:
  - `PARTY_NAME_TO_ID` (`simulation/config.ts:22-47`) has no AITC, AJUP, AISF, SUCI, DMK, AIADMK, AGP, IUML and so on. `resolvePartyId(...) || cand.party` (`replay.ts:242`) falls back to the full party name.
  - The candidate key is `NAME|party` (`replay.ts:134-136`). A miss only adds to a console warning set (`replay.ts:251-255`).
  - The docs list 13–35 name mismatches per state between ECI and our data (`docs/UPCOMING_2026_ELECTIONS.md`, Steps 1–2).
- Counting-day failure:
  - Every AITC candidate in West Bengal is unmatched and never updated, so their result rows stay at 0 votes / TRAILING.
  - The dashboard shows BJP leading almost everywhere.
  - The replay log shows one long "Unmatched candidates" line that nobody reads.

**H2. Result rows must exist before counting, but there is no tool to create them for a real election. (High)**
- Evidence:
  - The bulk API only UPDATEs existing rows by `result_id` (`bulk-override.service.ts:76-91`) and rejects unknown IDs.
  - `CandidatesService.create` inserts a candidate without a result row (`candidates.service.ts:84-88`).
  - No endpoint creates result rows.
  - Historical seed generators keep only the top 5 candidates plus NOTA (`generate-bihar-vs-seed.ts:209-212`), while the real Habra (S25/100) page lists 14 candidates.
  - Only `simulation/setup.ts` creates zeroed rows, and only by cloning Bihar 2025.
- Counting-day failure:
  - Candidates added late (e.g. after withdrawals) have no result row, so they cannot be updated.
  - With top-5 seeding, vote share and "others" totals are wrong. A surprise candidate who is not in the DB can lead a seat while the site shows someone else.

**H3. The fetch loop has no request timeout, no User-Agent, a fixed page count, and fails all-or-nothing. (High)**
- Evidence:
  - `fetchWithRetry` calls `fetch(url)` with no `AbortSignal` and no headers (`eci-vs-adapter.ts:54-66`). One hung socket stalls the whole cycle indefinitely.
  - `totalPages` is a constant (Bihar 13, `eci-vs-adapter.ts:41-48`). West Bengal 2026 has 15 list pages (pagination links `statewiseS251…S2515.htm`).
  - A missing page throws after 3 tries, which rejects `fetchConstituencyList()` entirely (`eci-vs-adapter.ts:98`).
  - Replay sets `pageDelayMs: 0` and walks every seat's candidate page one after another (`replay.ts:116-120, 212-215`), about 1 + N requests per cycle.
- Counting-day failure:
  - Configured for 13 pages, the job never sees 40 West Bengal seats, with no error.
  - Configured for 16, one 404 aborts every cycle.
  - One stalled TCP connection freezes updates until someone notices.

**M1. The list selector works only by accident. (Medium)**
- Evidence: `$('table.table-striped tbody tr')` (`eci-vs-adapter.ts:123`) also matches the nested tooltip tables. The real page has 40 `table table-striped` tooltip tables inside the party cells. They are skipped only because those rows have 3 `<td>`s, below the `< 9` guard (`eci-vs-adapter.ts:126`).
- Counting-day failure: a small ECI markup change, such as a 9-cell tooltip or the outer table losing `table-striped`, silently yields 0 rows or garbage rows. Nothing checks that "rows parsed == seats".

**M2. `round_no` is sent as the global loop counter, not the seat's round. (Medium)**
- Evidence: `replay.ts:264` sets `round_no: round`.
- Counting-day failure: the per-row `round_no` means nothing, so any ordering guard built on it would be wrong.

**M3. The scraper Redis client uses `REDIS_HOST/PORT` only. (Medium)**
- Evidence: `scraper/src/cache/index.ts:9-13` builds the client from host and port. The backend was moved to `REDIS_URL` with TLS (Upstash).
- Counting-day failure: if the job ever uses this client, it cannot reach Upstash (TLS/URL). Currently unused.

**L1. The mock's HTML is simpler than ECI's. (Low)**
- Evidence: the mock sorts rows by AC number with 19 per page, has no nested tooltip tables and no round string (`mock-eci-server.ts:174-214`). Real pages are sorted alphabetically, 20 per page, with tooltip tables. The simulation therefore never exercises the fragile parts of M1 and H3.

### 3.2 Backend ingest (`backend/src/modules/live/`)

**H4. No ordering or correction guard: an older batch can overwrite a newer one. (High)**
- Evidence: the UNNEST UPDATE is unconditional (`bulk-override.service.ts:76-91`). It has no `WHERE u.round_no >= r.round_no` and no source-timestamp comparison. The constituency rounds UPDATE is also unconditional (`:94-104`).
- Counting-day failure:
  - A retried request from cycle *n* (slow network, client timeout, retry) lands after cycle *n+1*. Seats flip back to older leaders, SSE toasts announce the flips, and the next cycle flips them again.
  - Two scraper instances (someone starts a second one "to be safe") interleave.
- Fix: carry the ECI "Last Updated" timestamp or the per-seat EVM round, and ignore anything older.
  - Do **not** use a "votes must not decrease" rule. ECI corrections, recounts and postal-ballot adjustments legitimately lower counts.

**H5. No per-seat invariant; stale LEADING rows double-count seats. (High)**
- Evidence:
  - Bulk and single overrides update only the rows they are sent. The backend never demotes other candidates in the seat.
  - `getElectionSummary` counts every WON/LEADING row (`results.service.ts:13-30`). The frontend winner map dedupes by highest votes instead (`useDashboardData.ts:159-168`).
- Counting-day failure:
  - A previously LEADING candidate is unmatched in the next cycle (H1), or an editor sets a new leader via the Live Console, which PATCHes one row. That seat now has two LEADING rows.
  - The scoreboard totals exceed the seat count and disagree with the map, e.g. "BJP 150 + AITC 146 = 296/294".
- Fix: server-side, derive statuses per seat from votes (or demote the others) inside the transaction, and reject a seat with more than one WON.

**H6. Machine authentication uses a human admin JWT with a 24 h lifetime and no refresh. (High)**
- Evidence:
  - `signOptions: { expiresIn: '24h' }` (`auth.module.ts:18`).
  - Replay logs in once (`replay.ts:52-65, 156`) and never re-logs in on 401. A 401 throws and exits.
  - `/auth/*` is behind the strict `auth` throttler, 5/min per IP (`throttle.config.ts:7, 44-49`).
  - The bulk route requires `SUPER_ADMIN`/`EDITOR` (`admin-results.controller.ts:26-29`). The bot therefore has full editor powers and its audit rows look like a person's.
- Counting-day failure:
  - The job is started the evening before for a dry run and keeps the token. At about 8–9 AM on counting day it gets 401 and dies.
  - A naive retry-login loop trips the 5/min limit. Human admins behind the same IP are locked out too.

**M4. All-or-nothing batch with a hard 400 on any foreign or unknown `result_id`. (Medium)**
- Evidence: `bulk-override.service.ts:53-60` rejects the whole batch.
- Counting-day failure: one stale mapping, e.g. a candidate row deleted and re-created by an admin, rejects the entire cycle's update for the whole state. Replay then exits (`replay.ts:96-99, 300`).
- This is good for integrity, but the job must treat 400 as "drop the bad IDs, resend the rest, alert", and the error body lists only the first 20 IDs.

**M5. SSE is published before the cache purge; a failed purge serves up to 300 s of stale data. (Medium)**
- Evidence: publish at `bulk-override.service.ts:167-176`, purge at `:179-183` (same order in `result-override.service.ts:93` then `:116`). `CACHE_TTL` is 300 s (`cache.service.ts:6-11`). The purge retries once after 2 s, then gives up (`cache.service.ts:66-82`).
- Race: `getOrSet` is plain cache-aside (`cache.service.ts:28-50`). A viewer request that read the DB just before commit can SET the old value after the purge.
- Counting-day failure:
  - The dashboard applies the SSE overlay, and 4 s later its refetch returns stale cached results.
  - `useEffect(() => setLiveOverlay(new Map()), [results])` (`useDashboardData.ts:136`) clears the overlay, so the map visibly reverts to old leaders for up to 5 minutes.
- Fix:
  - Purge before publish.
  - Shorten the TTL for live elections (or version keys by a per-election "generation" counter bumped in the transaction).
  - Don't clear the overlay when the refetched data is older than the overlay.

**M6. No election-status check on writes. (Medium)**
- Evidence:
  - The backend never reads `elections.status` (a grep for `'Live'` finds no match in `backend/src`).
  - The admin UI tells users that finalizing "will … disable scraping and manual overrides" (`admin/src/pages/ElectionManager.tsx:274`), but `ElectionsService.finalize` only sets the status (`elections.service.ts:71-77`).
- Counting-day failure: a scraper left running after finalization keeps rewriting final results, e.g. from a later ECI correction or a bad mapping, with no guard.

**M7. The audit trail cannot undo a bad batch. (Medium)**
- Evidence: the bulk audit row stores counts and, only for ≤50 IDs, the result IDs. It stores no old values (`bulk-override.service.ts:107-121`).
- Counting-day failure: a mis-mapped batch overwrites 3,000 rows, and there is no record of the previous values to roll back to (other than a DB backup or PITR).

**L2. Idempotent re-sends are safe but not free. (Low)**
- Evidence: re-sending the same round rewrites identical values. Each send still writes an audit row, publishes one SSE row per seat, and purges the cache (which triggers the herd in §3.3). The frontend only toasts actual leader changes (`liveUpdates.ts:54-58`), so users see no spam.
- Fix: skip unchanged rows (`WHERE (r.votes, r.status, r.margin) IS DISTINCT FROM (u.votes, …)`) and publish only changed seats.

**L3. The transaction itself is fine. (Low)**
- One set-based UPDATE with a constant parameter count, a 60 s timeout, `maxWait` 10 s, and a 10k-item cap within a 5 MB body (`bulk-override.service.ts:21, 123`; `result-override.dto.ts:105`; `app.setup.ts:18, 75`).
- A 294-seat × 15-candidate payload is about 4.4k items / ~650 KB. Size is not a risk. A full Lok Sabha (~8.4k candidates) fits under the cap.

**L4. NOTA handling. (Low)**
- Evidence: NOTA is a candidate row with party `NOTA`. Replay's leader rule ranks by votes including NOTA (`replay.ts:238-249`).
- Counting-day failure: NOTA "leads" a seat in round 1 when counts are tiny, and the scoreboard shows a NOTA seat.
- Fix: exclude `NOTA` from leader derivation.

### 3.3 Frontend live handling

**H7. Refetch storm after every batch, with no single-flight on the server. (High, operational)**
- Evidence:
  - Every connected client schedules `refreshAll()` (3 endpoints) 4 s after the last event (`useDashboardData.ts:302-330`). All clients get the same SSE event at the same moment, so their refetches arrive together.
  - This happens right after the backend purged the cache, and `getOrSet` has no lock or single-flight (`cache.service.ts:28-50`). The first wave of requests all miss and run the full-results query against Neon.
  - Redis cost per client per batch is ~3 GET + SET. Upstash free is 500K commands/month (`docs/DEPLOYMENT.md:43`).
- Counting-day failure:
  - 5,000 viewers × 3 × 1 batch/min × 10 h ≈ 9M Redis commands, which blows the Upstash cap within hours.
  - Every batch spikes Render free (0.1 CPU) and Neon, so SSE and API latency climb and health checks may fail.
- Fix:
  - Single-flight or stale-while-revalidate in `getOrSet`.
  - Add client jitter (0–10 s).
  - Send the aggregates (seat tally per party) inside the SSE event so most clients don't need to refetch.
  - Paid tiers on counting day.

**M8. The "4 s lag" is actually unbounded. (Medium)**
- Evidence: `clearTimeout` + `setTimeout(…, 4000)` on every event (`useDashboardData.ts:327-328`). It is a pure trailing debounce with no max-wait.
- Counting-day failure:
  - If events arrive less than 4 s apart, the scoreboard, vote share and candidate votes never refresh while the overlay keeps moving. This happens if the job posts per seat, or if editors plus the scraper post continuously.
  - At 50+ updates/minute (one every ~1.2 s), the standings freeze until the stream pauses.
- Fix: add `maxWait` (e.g. 15 s).

**M9. No snapshot refetch after a reconnect, and no event IDs. (Medium)**
- Evidence: `source.onopen` only sets `connected` (`useSSE.ts:52`). The server emits no `id:` and there is no replay buffer. The client closes the EventSource on error and runs its own backoff (`useSSE.ts:63-70`), so the server's `retry:` hint (`shared-sse-stream.ts:42-44`) is unused.
- Counting-day failure: during a Render restart or spin-down, or a mobile network drop, events are lost. The client reconnects and shows stale leaders until the next event triggers the debounced refetch. After the last declarations there is no next event, so the page stays wrong until reload.
- Fix: call `refreshAll()` on every `onopen` after the first.

**L5. SSE is only enabled when the election is Live at page load. (Low)**
- Evidence: `useSSE(election.status === 'Live' ? …)` (`useDashboardSources.ts:94`).
- Counting-day failure: pages opened before the admin flips the status to Live never subscribe until reloaded.

**L6. The overlay has no vote counts. (Low)**
- Evidence: SSE rows carry party, margin, status and rounds only. `mergeWinnerOverlay` takes votes and names from the last fetch (`liveUpdates.ts:67-87`), so a new leader may show the previous fetch's votes, or 0, until the refetch.

### 3.4 Operational

**C3. Nowhere to run the job and no monitoring. (Critical)**
- Evidence:
  - The scraper is not deployed (`docs/DEPLOYMENT.md:17`).
  - Render free spins down after ~15 min idle, with a 30–60 s cold start (`DEPLOYMENT.md:41`). D2 recommends Starter or a pinger on counting days (`:144`).
  - No stall alert, no "last successful cycle" metric, and no reconciliation.
- Counting-day failure: the job runs on someone's laptop. The laptop sleeps, or Wi-Fi switches, or the process exits on the first error (`replay.ts:300-303`). The dashboard silently freezes while still looking "Live", and nobody notices for 20 minutes.

**H8. ECI access risk is unquantified. (High)**
- Observed: today's fetches worked with a browser User-Agent. There was no captcha and no JS challenge, just a Tata CDN (`x-tata-request-id`, `x-cache: MISS,v50xbom1`) and a `sess_map` cookie. These pages are static and four months after counting, so they say little about counting-day load.
- Not tested:
  - Node's default UA (the adapter sends none).
  - Non-Indian cloud egress IPs (Render Singapore).
  - Behaviour under counting-day load.
- Counting-day failure: requests from a Singapore datacenter IP, or with a non-browser UA, are throttled or blocked (403/429/timeouts) at peak. The job has no fallback source and no alert.
- Fix: test from the actual host ahead of time, keep a fallback egress (a machine in India), and budget requests (§4).

**M10. Page format and URL changes between elections. (Medium)**
- Evidence:
  - The base path is `ResultAcGen<Mon><YYYY>` and state codes are `Sxx`. Page counts differ by state.
  - Lok Sabha uses a different site root, and its adapter is a stub.
  - Markup changed across years: the 2026 list page added tooltip tables inside party cells.
- Mitigation: take the base URL and state codes from config, discover pages from the pagination links, and run a smoke test at T-1 day against the ECI placeholder pages, which are usually published before counting.

**M11. Time zones. (Medium)**
- ECI shows `Last Updated at 04:18 PM On 05/05/2026` in IST, with a DD/MM date and no zone marker.
- `last_updated` in our DB is `timestamp without time zone` (`schema.prisma:191`), written from the server clock. Render runs in UTC.
- Any ordering guard or "stale for N minutes" alert must parse ECI time as Asia/Kolkata and compare in UTC.

**M12. Manual fallback conflicts with the scraper. (Medium)**
- Evidence: a Live Console PATCH (`admin/src/services/election.service.ts:47-48`) is overwritten on the scraper's next cycle, with no per-seat "pin/lock" flag. The console edits one candidate row at a time and doesn't demote the old leader (see H5).
- Counting-day failure: an editor corrects a mis-mapped seat, and 60 s later the scraper reverts it. The editor re-enters it, and the two fight all day.

**M13. Assam delimitation. (Medium, data)**
- `UPCOMING_2026_ELECTIONS.md` treats Assam as "2008 delimitation", but Assam's constituencies were re-drawn by the 2023 delimitation order.
- AC numbers and names for Assam 2026 do not line up with 2011–2021. Any mapping keyed on `const_no`, and the GeoJSON, must use the new list. Verify this before any Assam live use.

**L7. Upstash / Render headroom.** Covered in H7. On free tiers a busy counting day can exhaust the monthly Redis command cap (`DEPLOYMENT.md:43`) and the 0.1 CPU.

---

## 4. ECI source analysis (observed 2026-09-30, `ResultAcGenMay2026`, West Bengal S25)

I made 4 requests with a desktop Chrome UA, 2 s apart.

### Pages and structure

| URL | Size | Content | Stable identifiers |
|---|---|---|---|
| `partywiseresult-S25.htm` | 38 KB | Table `table.table`: `Party` ("Bharatiya Janata Party - BJP"), `Won` (link `partywisewinresult-369S25.htm`), `Leading`, `Total`; footer totals; `Last Updated at <span>04:18 PM On 05/05/2026</span>`; `<meta http-equiv=refresh content=300>` | **ECI numeric party code** in the link (`369` = BJP, `140` = AITC, `742` = INC, `547` = CPI(M), `3735` = AJUP, `3075` = AISF); "Full name - ABBR" gives the abbreviation |
| `election-json-S25-live.json` | 19 KB | `{S25:{chartData:[[ABBR,"S25",AC_NO,LEADER_NAME,COLOR],…], tableData:[[ABBR,"S25",AC_NO],…]}}`, **one row per AC (294)**; loaded by the party-wise page's map | `(state code, AC_NO)`, ECI party abbreviation. **No won/leading flag, no votes** |
| `statewiseS25{1..15}.htm` | 36 KB each | Outer `table.table-striped.table-bordered`, 20 rows/page, **sorted alphabetically by AC name** (not by number). 9 cells: name, AC no, leader, leader party (nested table + tooltip), runner-up, runner-up party, margin, rounds `24/24`, status (`Result Declared`, …) | AC no, full party name, `current/total` rounds |
| `candidateswise-S25{AC}.htm` | 19 KB | `.cand-box` per candidate (all candidates + NOTA; Habra has 14); `.status.won/.lost` + text; `<div>104645 <span>(+ 31462)</span></div>`; `.nme-prty h5` name, `h6` full party name; header `Assembly Constituency 100 - HABRA (West Bengal)`; `Status of EVM Round: <span>19</span>/19`; photo URLs `…/candprofile/E32/2026/AC/S25/<CODE>-2026-….jpg` | AC no, round status. Candidates have **no ECI candidate ID in the markup** (only the photo filename) |
| (linked, not fetched) `ConstituencywiseS25{AC}.htm`, `RoundwiseS25{AC}.htm?ac=` | — | Table view: typically EVM votes / postal votes / total / % per candidate | — |

### Parser check

The current `parseConstituencyListPage` / `parseCandidateDetailPage` on the saved pages gave correct output:
- List page: 20 rows, e.g. `ALIPURDUARS/12/PARITOSH DAS/BJP…/70420/'24/24'/Result Declared`.
- Candidate page: 14 candidates with correct votes, signed margins and won/lost.

### Response headers

- `cache-control: no-cache, no-store`.
- `last-modified` is present, so conditional GET or HEAD can detect changes.
- CDN `x-cache: MISS`, and a `sess_map` HttpOnly cookie is set (not required for later GETs).

### Anti-bot behaviour

- None observed: no captcha, no JS challenge, no Cloudflare. Plain `curl` with a browser UA worked.
- Caveats: static post-count pages, off-peak, and one Indian-region CDN edge (`bom`). Counting-day behaviour, datacenter or foreign IPs, and a missing UA are untested.

### ECI's own sources disagree

- Party-wise table: Total = 293 (BJP 207).
- Live JSON: 294 rows (BJP 208).

Four months after the count, one seat is coloured in the map JSON but not counted in the party-wise summary, probably a countermanded or held-back seat. Treat the **party-wise table as the authoritative tally**, and alert on any difference.

### Recommended strategy (per state, per cycle)

1. **Every 30–60 s:** GET `election-json-Sxx-live.json`, the cheapest source (1 request, 19 KB), to get the leader for every seat. Diff it against the last snapshot to find seats whose leader changed.
2. **Every 60–120 s:** GET the `statewiseSxx{1..N}.htm` pages. Discover N from the pagination links on page 1 and assert that rows equal the seat count. They give leader and runner-up, margin, `cr/tr` rounds and declared status for all seats in ~15 requests. Use `If-Modified-Since`.
3. **On change only:** GET `candidateswise-Sxx{AC}.htm` for seats whose margin, rounds or status changed since the last cycle, to get every candidate's votes. Cap concurrency at 2–4 and add jitter. Once a seat is `Result Declared`, fetch it once more after 10 min to catch corrections, then stop.
4. **Every 2–5 min:** GET `partywiseresult-Sxx.htm` and reconcile its Won/Leading per party against our DB (`GET /results/summary`). Alert if they differ for more than 2 cycles.
5. **Budget:** about 1 + 15/2 + (changed seats) + 1/4 requests/min per state. That is roughly 20–60 req/min in total, far below the naive "1 + 294 every cycle".

### Mapping ECI identifiers to ours

- **Seat:** `(ECI state code Sxx, AC_NO)` → `constituencies(election_id, const_no)`. Keep a table `eci_state_code → state_id`, e.g. S04 Bihar, S25 West Bengal. Never match on names; the docs list 13–35 spelling mismatches per state. Our `const_id` string (`WB_VS_12_ALIPURDUARS`) is only an internal key. Scope every lookup by `election_id`, because Lok Sabha and Vidhan Sabha numbers overlap.
- **Party:** build `eci_party_code / ECI full name / ECI abbreviation → parties.id` from the party-wise page ("Full Name - ABBR" plus the numeric code in the link) **before counting**. Persist it, e.g. in `parties.metadata.eci_code` or a mapping table. Fail loudly on unknown parties. Independents all map to `IND`. `None of the Above` maps to `NOTA`.
- **Candidate:** ECI markup has no candidate ID. Seed the real candidate list for the election from ECI's own pages, so spellings are identical: the candidate pages publish every contesting candidate with 0 votes before counting starts, or use Form 7A. Match on `(const_no, normalised name, party)`, where normalisation means upper-case, collapsed whitespace and punctuation stripped. As a fallback within the seat, use `(const_no, party)` when the party is unique there, i.e. not IND. Store the ECI photo code (`DEBDA-2026-…`) as a secondary key. Any unmatched candidate is an **error that blocks that seat's update and raises an alert**, never a silent skip.
- **Rounds:** parse `(\d+)/(\d+)` from list column 7 or from `.round-status` into `current_round/total_rounds`.
- **Status:**
  - `Result Declared` means WON for the leader and LOST for everyone else.
  - Otherwise the unique top-votes non-NOTA candidate is LEADING and everyone else is TRAILING.
  - Other status strings, e.g. countermanded or adjourned, mean no leader. Show them as such, and don't count them in tallies.

---

## 5. Build plan (ordered, with acceptance criteria)

1. **Parser fixtures and hardening** (scraper)
   - Commit the real 2026 pages as `scraper/test/fixtures/eci-2026/` (party-wise, live JSON, one statewise page, one candidate page, plus a pre-counting and a mid-counting sample when available).
   - Select the outer table by position or header rather than `table.table-striped`.
   - Parse rounds and the IST `Last Updated` time.
   - Parse the live JSON.
   - Discover page counts from pagination.
   - *Acceptance:* Jest/Vitest tests pass on the fixtures. Row count equals the seat count, and the run fails loudly otherwise. Rounds are parsed as `{cr, tr}`.
2. **Robust fetcher**
   - A browser-like UA, `AbortSignal.timeout(10s)`, exponential backoff with jitter, `If-Modified-Since`, and a concurrency limit.
   - Per-host request budget and circuit breaker (pause 2 min after 5 consecutive failures).
   - *Acceptance:* unit tests with a fake server that hangs, returns 429 or 5xx, or returns 304. A single cycle never takes more than 60 s.
3. **Pre-count loader** (`scraper/src/live/prepare.ts` plus a backend admin endpoint or SQL seed)
   - Create the election, its constituencies (keyed by const_no) and **all** candidates from ECI pages or Form 7A, each with a zeroed `results` row. Build the party map (ECI code/abbreviation → `parties.id`).
   - Report unknown parties and seats.
   - *Acceptance:* for each state, `count(results) = count(ECI candidates incl. NOTA)` and `count(constituencies) = seats`. There are 0 unmapped parties. Re-running is idempotent.
4. **Mapping layer** (`scraper/src/live/mapping.ts`)
   - Load `(const_no, name, party) → result_id` from the DB once per run.
   - Implement the rules in §4. Unmatched candidates block that seat and raise an alert.
   - *Acceptance:* 100% match on the fixture pages for the seeded election. Tests cover multiple INDs in one seat, NOTA, and name punctuation.
5. **Backend ingest invariants**
   - (a) Ordering guard: add a `source_updated_at` column or use seat `current_round`, and update only if the incoming value is newer or equal.
   - (b) Per-seat status derivation inside the transaction (exactly one LEADING/WON, others TRAILING/LOST).
   - (c) Skip unchanged rows and publish only changed seats.
   - (d) Purge before publish, and shorten the TTL for Live elections.
   - (e) Reject writes when election status ≠ `Live`, unless the request comes from a manual SUPER_ADMIN override.
   - (f) Audit old values for scraper batches (or a snapshot table per batch).
   - *Acceptance:* `bulk-override.service.spec.ts` covers an older batch ignored, a two-leader input normalised, an unchanged re-send producing 0 SSE rows, a Finalized election rejected, and purge happening before publish.
6. **Machine auth**
   - A `SCRAPER` role (or an API key hashed in the DB) with access to `override-bulk` only, and a long-lived or rotating token.
   - The job re-authenticates on 401 with backoff that respects the auth throttle.
   - *Acceptance:* the scraper token cannot call other admin routes. A test covers expiry and re-auth.
7. **Scraper daemon** (`scraper/src/live/run.ts`, replacing the `index.ts` stub)
   - A loop per configured state (§4 cadence), then map, derive, send one `override-bulk` per cycle per election.
   - On 400, drop the listed IDs, resend, and alert. Never exit on transient errors.
   - `--dry-run` prints the diff instead of POSTing.
   - A single-instance lock (Redis `SET NX` with TTL).
   - *Acceptance:* runs 12 h against the mock without exiting. Killing the network for 5 min recovers automatically. A second instance refuses to start.
8. **Reconciliation and monitoring**
   - Each cycle, compare DB tallies with the ECI party-wise table, and emit metrics: `last_success_at`, `seats_declared`, `unmatched_count`, `eci_http_errors`, `diff_seats`.
   - Alert (Telegram/Slack/email) on no successful cycle for 3 min, a diff lasting 2 cycles, unmatched > 0, or HTTP errors > 20%.
   - Add a `/health/ingest` endpoint that reports the last batch time per Live election.
   - *Acceptance:* the alerts fire in a staged test (stop the job, inject a party diff).
9. **Frontend resilience**
   - Refetch on SSE reconnect.
   - Add `maxWait` 15 s to the debounce, plus 0–10 s client jitter.
   - Keep the overlay when the refetched data is older than it.
   - Include per-party seat tallies in `batch-update` so the scoreboard updates without a refetch.
   - Re-check `election.status` periodically.
   - *Acceptance:* unit tests for `useSSE` reconnect and debounce max-wait. A Playwright test with a stubbed EventSource shows the scoreboard updating at 1 event/s.
10. **Backend load readiness**
    - Single-flight or stale-while-revalidate in `CacheService.getOrSet`, and HTTP `Cache-Control: max-age=5` on public result endpoints if they go behind a CDN.
    - Paid Render, Upstash and Neon (or a pinger plus capacity) for the counting window.
    - *Acceptance:* a k6 test with 5k SSE clients plus refetch waves every 60 s keeps p95 API latency under 1 s and the Redis command rate within plan.
11. **Simulation upgrade**
    - Make the mock serve real-format HTML generated from the committed fixtures: alphabetical order, tooltip tables, a `cr/tr` string, `Last-Modified`, injected 429s, delays and corrections.
    - Drive the **same daemon from step 7** against it, with no mock-only APIs in the job.
    - *Acceptance:* a full 24-round replay through the production daemon ends with DB tallies equal to the source election, 0 unmatched, and at least 1 injected correction applied.
12. **Rehearsals**
    - T-7 days: full dress rehearsal on the production stack with the upgraded simulation.
    - T-1 day: smoke test against ECI's pre-count pages from the production host and IP (base URL, pages and candidates at 0 votes). Verify the mapping is 100%.
    - *Acceptance:* written sign-off checklist.

---

## 6. Counting-day runbook (outline)

**Roles**
- Ingest operator: runs and monitors the daemon.
- Verifier: checks the ECI party-wise page against our scoreboard every 15 min.
- Editors (2): manual overrides for flagged seats.
- On-call dev: backend, DB, Redis.

**T-1 day**
- Freeze deploys.
- Upgrade to paid tiers or start the pinger.
- Run `prepare` for each state, then run the mapping report and confirm 0 unmapped.
- Smoke-test ECI fetches from the production host.
- Issue the scraper token (valid for 48 h+).
- Confirm the alert channel.

**T-2 h (ECI counting starts at 08:00 IST)**
- Set the elections to `Live`.
- Start the daemon in `--dry-run` mode and check that the diffs are empty (all 0).
- Open the dashboard on 2 devices (one on mobile data).

**08:00–end of count**
- Start the daemon for real.
- Monitor `last_success_at`, the diff count, unmatched seats, ECI error rate, Render CPU, SSE connections and Upstash usage.

**Fallbacks**
- ECI blocks us: switch to the backup egress (a machine in India). Slow the cadence (JSON only, every 60 s). Editors update leaders for the top seats manually.
- Mapping error on a seat: pin the seat (new flag) so the scraper skips it. The editor fixes it via the Live Console, entering all candidates or using a new "set leader" action that demotes the others.
- Backend down: the daemon buffers only the latest snapshot and resends when the backend is back. Newest wins, so there is no replay of old batches.
- Wrong batch applied: stop the daemon, restore from the batch audit snapshot or Neon PITR, then restart.

**After declarations**
- Keep the daemon running for 2 h to catch ECI corrections.
- Reconcile final tallies with the party-wise page and investigate the known "293 vs 294"-type gaps.
- Finalize the election, which must then block writes (5e).
- Export an audit report.

---

## 7. Tests: what covers the pipeline today

| Area | Tests | Gap |
|---|---|---|
| Bulk DTO validation | `backend/src/modules/live/dto/result-override.dto.spec.ts` (replay payload shape, rounds Map, bad status) | — |
| Body limit / Bearer gate on override-bulk | `backend/src/app.setup.spec.ts:138-150` | — |
| Single override audit + publish-failure tolerance | `result-override.service.spec.ts` | — |
| **Bulk override service** (the production write path) | **none** | ownership 400, UNNEST correctness, rounds, publish rows, purge |
| SSE shared stream | `common/sse/shared-sse-stream.spec.ts` | no end-to-end Redis→SSE→browser test |
| Frontend overlay / SSE retry | `frontend/src/__tests__/liveUpdates.test.ts`, `sseRetry.test.ts`, `model/live/__tests__/ticker.test.ts` | reconnect refetch, debounce max-wait, overlay vs stale refetch |
| ECI parsers | **none** (no fixtures) | real-markup fixture tests |
| Scraper job / mapping | **none** (job doesn't exist) | everything in §5 steps 2–8 |
| E2E | `frontend/e2e/dashboard.spec.ts` covers layout only | no live-update scenario |

**Does the simulation exercise the production code path?**
- **Partly.** It runs the real `EciVsAdapter` parsers and the real `override-bulk` API, so it validates backend ingest, SSE and the dashboard under realistic volume (243 seats × 24 rounds).
- It does **not** exercise:
  - real ECI markup (M1, L1);
  - page discovery or the page count (H3);
  - rounds parsing (C2): mock-only `/status/constituencies`;
  - orchestration: mock-only `/advance-round`;
  - identifier mapping for anything but a byte-identical clone of our own DB names (H1). The mock renders names from our DB, so names always match;
  - network failure modes, auth expiry (H6), ordering (H4), or corrections.
