# Deployment plan

Status: **draft.** The backend blockers in [§4](#4-blockers-before-first-deploy) are fixed on branch `fix/backend-hardening` (2026-09-30). Hosting decisions are made (§6); the domain name is still to be chosen. The pre-deploy task **CDN-ready live** (§2.2) is implemented on the same branch. Source reviews: [`docs/reviews/2026-09-30-backend-review.md`](reviews/2026-09-30-backend-review.md), [`docs/reviews/2026-09-30-election-day-pipeline-review.md`](reviews/2026-09-30-election-day-pipeline-review.md).

**Current deployment (2026-10-01, interim, no domain yet):** API on Render `matdaanpulse-api` (Singapore, Free, auto-deploy on `main` since 2026-10-05; no backend pushes during counting — LIVE_RUNBOOK) → `https://matdaanpulse-api.onrender.com`, origin shield off, Redis via `REDIS_URL`; Neon project `matdaanpulse` (ap-southeast-1, built with `setup.sh`); Upstash Redis "Matdaan Pulse" (ap-southeast-1). Frontend and admin on **Vercel** projects `matdaanpulse` → `https://matdaanpulse.vercel.app` and `matdaanpulse-admin` → `https://matdaanpulse-admin.vercel.app` (Git-connected to `mannuray/matdaanpulse`, root `frontend` / `admin`, auto-deploy on push to `main`, build env `VITE_API_BASE_URL=https://matdaanpulse-api.onrender.com/api/v1`; `vercel.json` gives the SPA fallback). Render `CORS_ORIGINS` = both Vercel URLs. Vercel is for testing only — move to Cloudflare Pages (§5.4) once the domain (`matdaanpulse.in`) is bought, before any real traffic (D13).

Roadmap: fix code → **deploy** → data (2026 results backfill, curation) → live pipeline. Next live counting day: **27 Feb 2027**.

Target cost: **$0/month off-season**; about **$7–10** in an election month (§3.1).

## 1. What gets deployed

| Piece | Repo path | Host | Notes |
|---|---|---|---|
| Public dashboard | `frontend/` | **Cloudflare Pages** (project 1) → `app.<domain>` | Static Vite build, SPA fallback |
| Admin panel | `admin/` | **Cloudflare Pages** (project 2) → `admin.<domain>` | Static Vite build, SPA fallback |
| API | `backend/` | Render web service, **Singapore**, behind **Cloudflare** (proxied DNS) → `api.<domain>` | NestJS, single instance. Free off-season, Starter in election windows |
| Postgres | `database/` | Neon free, **ap-southeast-1 Singapore** | Same region as Render |
| Redis | — | Upstash free, **ap-southeast-1** | Response cache + pub/sub (admin live console) |
| Domain + DNS + CDN | — | Cloudflare (free plan) | Domain to be bought (name TBD); all three hostnames proxied through Cloudflare |

Why Cloudflare Pages rather than Vercel: Vercel Hobby includes 100 GB/month of transfer, cannot buy more, and is for personal, non-commercial use only. One counting day (~100k visits × 1.5–2 MB per visit: JS ~200 KB gz, fonts ~200 KB, map GeoJSON 0.3–0.9 MB gz, results ~150 KB gz) is ~200 GB. Cloudflare Pages publishes no bandwidth/request cap for static assets on the free plan (limits: 500 builds/month, 20,000 files/site, 25 MiB/file — our largest file is 3.7 MB), allows commercial use, and the same account caches the API and holds the DNS.

Deployed only for counting windows: the live worker (see §5.8). Not deployed: the rest of `scraper/` (seed generators and the simulation; run locally or in CI against the API). The earlier plan's BullMQ queues, S3, and "Landing"/"Student" frontends belong to another app — none exist here.

### What Redis is used for

- **Cache:** results / constituency lists, 5–10 min TTL, and versioned live snapshots (`results.service.ts`, `constituencies.service.ts`). Identical concurrent misses share one load (single-flight in `CacheService.getOrSet`).
- **Pub/sub:** ingest and seat-correction result changes are published and fanned out to the admin Live Console's SSE clients (`live.service.ts`, `GET /admin/live/updates` with a 5-min SSE token, ≤ `SSE_MAX_CONNECTIONS` per process). Public viewers poll (§2.2) and hold no connection.
- Nothing needs persistence: the cache refills itself and live messages only matter to connected viewers. On a single instance Redis is optional; it becomes required for pub/sub once there is more than one backend instance.

## 2. Architecture

```
Browser (India)
  ├── app.<domain> / admin.<domain> ──► Cloudflare Pages (static, unlimited bandwidth)
  └── api.<domain> ──► Cloudflare CDN (Tiered Cache)
                         ├── public GETs: cached (s-maxage) ──┐ only cache misses reach origin
                         └── admin / auth / SSE: pass-through ┤
                                                              ▼
                                         Render web service (Singapore)
                                           ├── Neon Postgres (pooled URL)     ← same region
                                           └── Upstash Redis (rediss://, TLS) ← ap-southeast-1
```

Keep the API, database and Redis in the **same region**: every uncached request makes several sequential DB round trips. Render Singapore ↔ Neon us-east-2 adds ~200–250 ms per round trip (a constituency page ≈ 1.3 s, a seat correction ≈ 1.5 s); with Neon in Singapore it is ~1–3 ms.

### 2.1 Traffic shape

Very few users off-season → a ramp as an election nears → a sharp peak on counting day → a cliff within a day or two. Design goal: **origin load must not grow with the number of viewers.** Everyone looks at the same results, so the CDN serves them and the origin answers the CDN a few times per second at most.

### 2.2 Live results for viewers: polling a CDN-cached version (pre-deploy task "CDN-ready live")

Per-viewer SSE does not scale behind a CDN (every open tab holds an origin connection; a Render restart makes all of them reconnect at once). Viewers poll instead; the admin live console keeps SSE (few editors).

| Endpoint | Returns | Cache-Control |
|---|---|---|
| `GET /api/v1/elections/:id/live` | `{ version, status, updatedAt, declared, total }` (a few hundred bytes) | `public, max-age=0, s-maxage=5, stale-while-revalidate=10` while `Live`; `s-maxage=30` otherwise |
| `GET /api/v1/elections/:id/results?v=<version>` | full snapshot for that version | `public, max-age=31536000, immutable` (a version never changes) |
| Other public GETs (elections, constituencies, …) | as today | `public, max-age=0, s-maxage=60, stale-while-revalidate=300` (longer for finished elections) |
| Admin, auth, SSE, health | — | `no-store` / not cached |

- The backend bumps `version` on every committed results batch (an ingest post or a seat correction).
- Browser: poll `/live` every 10 s + random 0–3 s; pause while the tab is hidden; on a version change wait random 0–2 s, then fetch `results?v=<new>`; exponential backoff with jitter on errors and honour `Retry-After`.
- Herd protection: the CDN answers polls (each upper-tier PoP asks origin at most once per 5 s; **Smart Tiered Cache** is on the free plan); versioned snapshot URLs are identical for everyone; `stale-while-revalidate` serves the old copy during a refresh; the backend single-flights identical in-flight requests (one DB query per key). Polling holds no connections, so there is no reconnect storm after a deploy.
- Trade-off: viewers see changes 10–20 s late (ECI itself updates every few minutes); snapshots are atomic per version.
- Prerequisite: response bodies must not contain per-request values (`requestId`, `timestamp`) — they move to headers.

Expected origin load on counting day: roughly (upper-tier PoPs × 1 request / 5 s) for `/live` + one fetch per new version per PoP — independent of viewer count.

**Implementation (branch `fix/backend-hardening`):**
- Version: table `election_live_state` (migration 015). Statement-level DB triggers on `results` (insert/update/delete), `candidates` and `parties` (update) bump it inside the writing transaction, so every writer — ingest posts, seat corrections, the simulation's direct SQL, seeds, admin edits — moves it, and a committed change and its version become visible together. Value: `GREATEST(version + 1, now in epoch ms)` — never decreases, and a rebuilt database never reuses a version a CDN may still hold as immutable.
- UPDATE triggers bump only when a snapshot column changes (results votes/status/margin/ids, candidate name/party, constituency type, party name/colour); the migration runs in one transaction with `CREATE OR REPLACE TRIGGER`, so re-running it never leaves a moment without triggers. After a DB restore / PITR run `UPDATE election_live_state SET version = GREATEST(version + 1, (extract(epoch FROM clock_timestamp()) * 1000)::bigint);` so no version number is reused.
- `/live` returns `{ version, status, updatedAt, declared, total }` through a 1 s in-process memo with single-flight (`s-maxage=5` while `Live`, `30` otherwise); the ingest and seat-correction services forget the memo after commit, purge the Redis caches, and only then publish the admin SSE event (pipeline review M5). Admin election PATCH/finalize also forget the memo, so a status flip shows at once.
- `results?v=<current>` returns `{ version, results, summary, voteShare }` — results rows, seat tally and vote share computed from **one** query, read together with the version in one `REPEATABLE READ` transaction, so a snapshot labelled V holds exactly version V's data and map, scoreboard and standings update atomically. It is cached in Redis under `election:<id>:snapshot:v<version>` only when the version read equals V (otherwise served `no-store`). `v` older than current → `302` to the current URL (`s-maxage=5`); `v` newer (a poll raced ahead of this instance) → current data with `no-store`. Without `v` the endpoint is unchanged (rows array, `s-maxage=10, stale-while-revalidate=30`).
- The unversioned results-derived Redis caches (`summary`, `vote-share`, `full-results`) are keyed by the live version too (`…:v<version>`), so a direct-SQL write (simulation, manual fix) moves readers to fresh keys without a purge; the CDN's 60 s + swr remains. `CacheService` invalidations only detach in-flight loads of the keys they match (per election), and `:v<version>` keys are never detached.
- Headers: `@CacheControl()` opt-in per public controller; everything else (admin, auth, health), **every error**, and every request carrying `Authorization` (the admin panel, which also appends `_=` to its GETs) is `no-store`, so the CDN never caches a 4xx/5xx or an admin read. Publicly cacheable responses drop the per-client `X-RateLimit-*` headers. SSE keeps Nest's `private, no-cache`. Success bodies have no `requestId`/`timestamp` (`X-Request-ID` and `Date` headers instead).
- CORS: Cloudflare does not vary its cache on `Origin`, so public GET/HEAD responses send `Access-Control-Allow-Origin: *` (no cookies are used; the data is public). Admin/auth and writes keep the exact allowlist. `Retry-After` and `X-Request-ID` are exposed; 429s carry a standard `Retry-After`.
- Browser: `frontend/src/model/live/poller.ts` runs for elections that are `Live`, or `Upcoming` within 3 days before to 60 days after `tentative_next_date`. Cadence follows the `/live` status: Upcoming 60 s + 0–15 s (`/live` only), Live 10 s + 0–3 s with snapshots, Finalized → final snapshot then stop — so a page opened before counting picks up Live without a reload. It only moves forward (never fetches or shows an older version from a stale CDN colo). After 3 consecutive failures with no snapshot the dashboard shows an error with Retry (polls at once). Its GETs send no custom headers, so they are CORS "simple" requests with no preflight (OPTIONS is never CDN-cached). The live ticker and map pulses are diffs between consecutive snapshots.

## 3. Free-tier limits to plan around

| Service | Limit | Effect on this app |
|---|---|---|
| Render free | Spins down after ~15 min without inbound requests; cold start 30–60 s; 512 MB RAM, 0.1 CPU; a monthly instance-hour allowance: one free service running (or pinged awake) all month fits, a second free service on the same account may not — check Render's current terms | First visitor after idle waits ~1 min (off-season only — Starter during election windows, §3.1). |
| Neon free | 512 MB storage; compute auto-suspends after ~5 min idle; monthly compute-hour allowance (check the current number on Neon's pricing page; on the Free plan running out suspends compute until the next cycle, it does not bill overage) | First query after idle takes ~0.5–few s; a pooled connection may be dropped once (retry). Seed data ≈ 30–60 MB, fits. |
| Upstash free | 256 MB; monthly command and bandwidth caps (500K commands/month at the time of writing) | Every cache read, publish and delivered message counts. A busy counting day can hit the cap — see decision D6. |
| Cloudflare free | Pages: 500 builds/month, 20k files, 25 MiB/file; CDN caching of API GETs; Tiered Cache | No bandwidth cap published for static assets. |

Verify current limits on each provider's pricing page before launch.

### 3.1 Seasonal scaling

| Period | Render | Neon | Upstash | Cost |
|---|---|---|---|---|
| Off-season | **Free** (kept awake by the `/health/live` monitor, §5.7) | Free | Free | $0 |
| ~2 weeks before counting → ~3 days after | **Starter** (always on, no cold starts) | Free if the compute allowance covers an always-awake database for the window, else the paid plan for that month (see below) | Free (pay-as-you-go costs cents if the cap is hit) | ~$7–10 for the month |
| Counting day | Starter; one instance is enough behind the CDN (Standard optional) | same | same | same |
| After the cliff | back to **Free** | | | $0 |

Window runbook: calendar reminders (or a scheduled job) for both switches, two weeks before counting and three days after:

| | Off-season | Election window |
|---|---|---|
| Render instance | Free | Starter |
| Uptime monitor target (§5.7) | `/health/live` (no DB, so Neon can suspend) | `/health/ready` every 5 min (DB + Redis, real alerting) |

Run the load test (§5.6) after switching up. During the window the database is effectively awake around the clock (origin traffic at least every 5 s while counting, plus the `/ready` monitor), so compute hours are consumed continuously: before the window compare the Neon allowance with ~24 h × days-in-window of compute at the minimum size, and upgrade the Neon plan for that month if it does not fit (an exhausted Free allowance suspends the database and every uncached request fails). Record the decision under D2.

**Off-season expectations:** nothing should keep the **database** awake. Upcoming elections with a far-off `tentative_next_date` make the dashboard stop polling (the public API exposes the field), and the uptime monitor hits only `/health/live`, which does no I/O — so Neon suspends after ~5 min idle. The `/live` monitor does keep the Render free instance awake all month (no cold starts); that fits the free instance-hour allowance for one service but not for two. If you'd rather let Render sleep too, pause the monitor off-season and accept ~1 min cold starts.

**Deploys and counting:** an ingest post applies its seats in one transaction (spec §4). A Render deploy or instance swap gives the old instance only a short shutdown grace; if it is cut mid-batch the connection drops, Postgres rolls the batch back and the worker retries on its next poll (nothing is half-applied). Runbook: no backend deploys during counting; set the feed to Paused (Live Console) before an unavoidable one.

## 4. Blockers before first deploy

From the backend review (IDs refer to it). All are code/config changes in `backend/` unless noted.

| # | Blocker | Review ID | Fix | Status |
|---|---|---|---|---|
| B1 | Rate limiter sees Render's proxy IP → one bucket for the whole site (5 bad logins lock out every admin; a 429 kills a viewer's live updates) | S-C1 | `app.set('trust proxy', 1)` (verify `req.ip`); `@SkipThrottle()` on live + health; separate public (generous) and auth (strict) limits | Done — `TRUST_PROXY_HOPS` (default 1); throttlers `public` 600/min + `auth` 5/min per IP (`THROTTLE_*`); `Client IP check` log at `LOG_LEVEL=debug` — verify once on Render (§5.3) |
| B2 | Redis client only reads host/port — cannot reach Upstash (needs password + TLS) and boot waits for it | DEP-1 | `REDIS_URL` (`rediss://…`) with timeouts; keep host/port as local fallback | Done — `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` |
| B3 | Redis outage = API outage (no fallback to DB; ioredis retries ~20× then 500) | E-H1 | Cache wrapper with try/catch → load from DB; `maxRetriesPerRequest: 1`, no offline queue, command timeout; don't block boot on Redis | Done — `CacheService.getOrSet`; boot and publish never fail on Redis |
| B4 | No graceful shutdown (`process.exit` in tracing on SIGTERM; shutdown hooks off) | E-H3 | `enableShutdownHooks()`, remove `process.exit`, close SSE → Redis → Prisma, bootstrap `.catch` | Done — `GracefulShutdownService` |
| B5 | Single override writes its audit row outside the transaction — not atomic, and deadlocks with a small Neon pool | E-H4 | Pass `tx` to the audit write | Done |
| B6 | 500s never logged; Prisma errors all become 500 | E-H2, E-M1 | Log 500s with stack + request id; map P2002→409, P2025→404, P2003/P2023/validation→400 | Done |
| B7 | OTel always exports to `localhost:4317`; its gRPC chain carries a critical advisory | O-M4, S-H1 | Start OTel only when an endpoint is configured (`OTEL_SDK_DISABLED=true` in prod); `npm audit fix`; move to OTLP/HTTP if kept | Done — OTLP/HTTP, starts only with an endpoint; `npm audit --omit=dev` 49 → 12 (0 critical; the rest need Nest/Prisma majors) |
| B8 | `/health` returns 200 when degraded, leaks error text, is throttled, hits the DB | O-M2 | `/health/live` (no I/O) for Render; `/health/ready` (DB + Redis, 503 when down) | Done — `/health` is an alias of ready |
| B9 | Build needs devDeps + `prisma generate`; Node version unpinned | DEP-3 | Build command below; `"engines": { "node": "24.x" }` (Node 24 LTS; 20 is end-of-life) + `NODE_VERSION=24` on Render | Done — build verified on Node 24 with `npm ci --include=dev && npx prisma generate && npm run build` |
| B10 | Neon needs pooled vs direct URLs; `setup.sh` can't take the pooled Prisma URL | §6 | `directUrl` in `schema.prisma`; run `setup.sh` with the direct URL | Done — `DIRECT_URL` (only Prisma CLI commands need it; may equal `DATABASE_URL` locally) |
| B11 | CORS origins not trimmed | S-L3 | Trim/filter the list; exact Vercel origins | Done — plus optional `CORS_ORIGIN_REGEX`; `credentials` dropped |

Recommended alongside (not strictly blocking): 5 MB body limit only on the ingest seats route (S-M3) — **done**; query DTOs on list endpoints (E-M2) — **done**; SSE heartbeat 20 s + `retry:` (O-M3) — **done**; stop public self-registration (S-M1) — **done** (`ALLOW_REGISTRATION`, plus last-SUPER_ADMIN guard); URL validation (S-M2; the `GEMINI_MODEL` part became moot when the built-in AI was removed), request-id validation (S-L2), log correlation + `LOG_LEVEL` (O-M1) — **done**. `Cache-Control` + drop per-response `requestId`/`timestamp` from bodies so ETags work (P-M1) — **done** (§2.2). Still open: in-process cache in front of Redis (D6; optional now that the CDN absorbs viewer traffic).

## 5. Setup steps (once blockers are fixed)

### 5.0 Migration 018 (every candidate has a person)

**Order** (also D9). 018 is expand-only: it adds columns and triggers and keeps `candidates.metadata` and `persons.metadata` (nullable), so the previous backend keeps working while it runs.
1. Run `setup.sh` (applies 018). The running backend keeps serving; only its "unlink person" action fails from here on (a candidate without a person is refused).
2. Deploy the backend right after.
3. Merge to `main` (the admin and public site auto-deploy) only once the new backend is live: the new admin calls `PUT /admin/candidates/:id/person`, `POST …/split` and `POST /admin/persons/merges/:id/undo`, which the old backend doesn't have.
4. **Later:** once this release is live everywhere, a new migration drops `candidates.metadata` and `persons.metadata`. 018 has archived every non-empty value into `candidate_metadata_archive` / `person_metadata_archive`, and rows the old backend writes during the deploy are archived by the next `setup.sh`. Don't apply Prisma's suggested drop before that migration exists (the columns are `@ignore` in `schema.prisma`).

**Notes:**
- **Never run `prisma db push`**, and never apply Prisma's suggested `SET NOT NULL` on `candidates.person_id`. NOT NULL is enforced by a deferred constraint trigger, and the seeds insert with NULL (an AFTER INSERT trigger fills it in).
- `setup.sh` sets `lock_timeout=5s` (in `PGOPTIONS`; a caller's `PGOPTIONS='-c lock_timeout=…'` overrides it), so an ALTER TABLE never queues readers behind it for long. If it times out, re-run `setup.sh`. Do not run it near counting day.
- **Run-once seeds:** `setup.sh` re-runs every seed on every deploy. The Bihar person seeds (`seed_bihar_persons.sql`, `seed_bihar_person_regions.sql`) would otherwise undo admin merges, splits, person changes and region edits, so they record themselves in `seed_runs` and skip when already applied. On production, where they ran long ago, they detect that from the curated persons and the merge log and only write their marker. `seed_party_recognition.sql` and `seed_election_result_dates.sql` are run-once too, by marker only, so on the first deploy with 018 they run one last time (refilling a recognition or result date that was cleared in the admin).
- Rare: if two admins move the last contest of the same person at the same moment, one request can fail with an FK error (the orphan-delete trigger races the move). Retry it.
- Before deploying, check production for `persons.metadata.affidavit_history` (`SELECT count(*) FROM persons WHERE metadata ? 'affidavit_history'`). 018 archives it but does not migrate affidavit history into columns.
- After a merge, a CDN-cached public profile or seat detail can link to the merged-away person for up to about 6 minutes (`s-maxage=60` + `stale-while-revalidate=300`); that link 404s until the cache refreshes.

### 5.0a Bihar results data (seeds of 2026-10-03)

`setup.sh` applies `seed_bihar_parties.sql` → `seed_bihar_corrections_v1.sql` (run-once) → the Bihar year seeds. On
production the corrections seed rewrites the old estimated Bihar 2010–2020 rows (and the 2025 top-5 rows) to the real
ECI values, then the year seeds insert the missing candidates (each year seed is one transaction).

**Pre-flight (built in):** the corrections seed first checks that production holds exactly the old seeds' Bihar
candidates with their seeded parties. If an admin added a Bihar candidate or changed one's party, `setup.sh` stops with
`seed_bihar_corrections_v1: N Bihar candidates are not in the old seeds and M changed party since` and nothing is
applied. Reconcile before re-running: list the rows with
`SELECT c.id, c.const_id, c.party_id, c.name FROM candidates c JOIN elections e ON e.id = c.election_id WHERE e.state_id = 5 AND e.type = 'VS' ORDER BY c.updated_at DESC LIMIT 20;`
then either undo the admin change, or add a `decisions.json` entry, delete `seed_bihar_corrections_v1.sql`, restore the
old seeds (`git show 935ea82:database/seed_bihar_vs_<year>.sql`) and re-run `generate-cli.ts` (only while v1 has not
run in production). Afterwards:
1. Recompute the seat analysis for the four Bihar elections (admin, or `POST /api/v1/admin/constituencies/analysis/compute/:electionId`
   with an admin token) for `a1b2c3d4-e5f6-7890-abcd-111111111010` (2010), `a1b2c3d4-e5f6-7890-abcd-111111111015` (2015),
   `b2c3d4e5-f6a7-8901-bcde-123456789020` (2020), `c3d4e5f6-a7b8-9012-cdef-234567890abc` (2025).
2. Spot-check Bihar 2010 on the public site: the statewide vote share must read JD(U) 22.58 %, RJD 18.84 %, BJP 16.49 % (ECI's table).

**Persons and leaders seeds (Plan 3).** After the Bihar person seeds, `setup.sh` runs three run-once seeds:
`seed_bihar_person_links_v2.sql` (links only auto-created single-candidacy persons, never curated or merged ones),
`seed_bihar_leaders.sql` (fill-only profile fields, Blob-hosted photos with `image_credits`, and the `leaders` / `cabinet`
watchlists written once into each Bihar manifest's published `manifest_url`), and `seed_bihar_affidavits.sql` (fill-only).
Publish or discard any Bihar manifest draft being edited before this deploy: the published manifest's `watchlists` is replaced once.
Migration 022 adds `image_credits`; the backend serves `GET /credits`.

**Five states' history (Phase 2A).** For each of WB, AS, KL, TN, PY, `setup.sh` runs `seed_<st>_vs_parties.sql` →
`seed_<st>_corrections_v1.sql` (run-once, with the same pre-flight as Bihar: it stops, changing nothing, if production
holds candidates the old seeds didn't have or a changed party) → the year seeds; for Kerala and Assam then
`seed_<st>_manifest_fixes_v1.sql` (run-once: points the published manifests' alliance/leader party ids at the ids the
ECI data uses, e.g. Kerala 2011 `MUL` → `IUML`, Assam 2016 `BPF` → `BOPF`); then `seed_manifest_alliances_v1.sql`
(run-once: parties the old manifests put in the wrong alliance, Kerala 2011–21, Tamil Nadu 2011, West Bengal 2011;
from `scraper/data/alliance-moves-v1.json`); then `seed_<st>_person_links_v1.sql`.
If a pre-flight stops, reconcile as for Bihar above, but restore the old seeds from the commit before Phase 2A
(`git show 5dc0553:database/seed_<st>_vs_<year>.sql`). After the deploy:
1. Recompute the seat analysis (`POST /api/v1/admin/constituencies/analysis/compute/:electionId`, admin token) for the 15 elections:
   AS `f6a7b8c9-d0e1-2345-f012-56789012{2011,2016,2021}`, KL `a7b8c9d0-e1f2-3456-0123-67890123{2011,2016,2021}`,
   PY `b1c2d3e4-f5a6-7890-1234-567890ab{2011,2016,2021}`, TN `e5f6a7b8-c9d0-1234-ef01-45678901{2011,2016,2021}`,
   WB `d4e5f6a7-b8c9-0123-def0-345678901011`, `…-345678901016`, `…-345678901021`.
2. Spot-check an alliance tally: Assam 2016 NDA must read 86 seats (BJP 60, AGP 14, BPF 12).

**Party model (migration 023).** `setup.sh` runs migration 023, `seed_party_lineage.sql` and the run-once
`seed_party_units_v1.sql`. After the deploy, recompute the stored seat analysis so flips follow the lineage:
`ADMIN_EMAIL=… ADMIN_PASSWORD=… API_BASE_URL=https://<api>/api/v1 npx ts-node scraper/src/recompute-analysis-cli.ts --type VS`.

**Jammu & Kashmir (Phase 4B-5).** `setup.sh` now also runs `seed_jk_vs_{parties,2008,2014,2024}.sql`,
`seed_jk_districts_regions.sql`, `seed_jk_person_links_v1.sql`, the run-once `seed_jk_leaders.sql`,
`seed_jk_candidate_photos.sql`, `seed_jk_affidavits.sql`, `seed_jk_party_profiles.sql`, `seed_party_units_v6.sql` and
`seed_party_colors_v5.sql` (two colour changes, each only while the old colour is set); `seed_party_lineage.sql` gains
two breakaways. New maps `jk_ac_1995.geojson` / `jk_ac_2022.geojson` (the old `jk_ac_2008.geojson` path redirects; the
Vercel redirect is in `frontend/vercel.json`). No backend change. Run `setup.sh` after the frontend deploy (People's
Conference's wrong logo file is removed and its path cleared by the profiles seed). Back up production first.

**Maharashtra (Phase 4B-4).** `setup.sh` now also runs `seed_mh_vs_{parties,2009,2014,2019,2024}.sql`,
`seed_mh_districts_regions.sql`, person links v1/v2, the run-once `seed_mh_leaders.sql`, `seed_mh_candidate_photos.sql`,
`seed_mh_affidavits.sql`, `seed_mh_party_profiles.sql`, `seed_party_units_v5.sql`, and `seed_party_colors_v4.sql`
(three colour changes, each only while the old colour is set), `seed_party_names_v1.sql` (two misspelt party names); `seed_party_lineage.sql` gains MNS. No backend change. Run `setup.sh` soon after the frontend deploy: the new symbol files replace deleted ones, and party marks fall back to the ECI symbol or a dot until the paths are updated.
Seat analysis deferred. Back up production first.

**Andhra Pradesh (Phase 4B-3).** `setup.sh` now also runs `seed_ap_vs_{parties,2009,2014,2019,2024}.sql`,
`seed_ap_districts_regions.sql`, person links v1/v2, the run-once `seed_ap_leaders.sql`, `seed_ap_candidate_photos.sql`,
`seed_ap_affidavits.sql`, `seed_ap_party_profiles.sql`, and `seed_party_units_v4.sql`; `seed_party_lineage.sql` gains
PRP → INC and YSRCP ← INC; the Andhra map file is replaced (no earlier election used it). Frontend change only
(`no_majority`); no backend change. Seat analysis deferred. Back up production first.

**Arunachal Pradesh (Phase 4B-2).** `setup.sh` now also runs `seed_ar_vs_{parties,2009,2014,2019,2024}.sql`,
`seed_ar_districts_regions.sql`, person links v1/v2, the run-once `seed_ar_leaders.sql`, `seed_ar_candidate_photos.sql`,
`seed_ar_affidavits.sql`, `seed_ar_party_profiles.sql`, and `seed_party_units_v3.sql` (after v2). Frontend only
(unopposed seats); no backend change, no Render deploy. The seat analysis for these elections is not computed yet
(deferred recompute). Back up production (Neon branch) first.

**Sikkim (Phase 4B-1).** `setup.sh` now also runs `seed_sk_vs_{parties,2009,2014,2019,2024}.sql`,
`seed_sk_districts_regions.sql`, person links v1/v2, and the run-once `seed_sk_leaders.sql`, `seed_sk_candidate_photos.sql`,
`seed_sk_affidavits.sql`, `seed_sk_party_profiles.sql`, plus `seed_party_units_v2.sql` (run-once, after v1) and
`seed_party_colors_v3.sql` (SKM's colour, only while it is the old one); `seed_party_lineage.sql` gains SKM ← SDF.
The Sikkim map file is replaced (no earlier election used it). Run `setup.sh` against Neon's direct host (the `-pooler`
host rejects psql's startup options). Render auto-deploy has not been triggering: deploy with
`render deploys create <service> --commit <sha> --confirm` when backend files change.

**Delhi, Haryana, Jharkhand, Odisha (Phase 4A).** `setup.sh` now also runs `seed_dl_vs_{parties,2008…2025}.sql` and
`seed_{hr,jh,od}_vs_{parties,2009…2024}.sql` (new elections), their `seed_<st>_districts_regions.sql`, person links v1 and
v2 (run-once), and for the latest elections the run-once `seed_<st>_leaders.sql`, `seed_<st>_candidate_photos.sql`,
`seed_<st>_affidavits.sql` and `seed_<st>_party_profiles.sql`; `seed_party_symbols.sql` gains the new symbol files.
Back up production (Neon branch) first; Render deploys `main` automatically (auto-deploy on since 2026-10-05).

**Five more states' history (Phase 3A).** `setup.sh` now also runs, for ga, mn, uk, pb, up: `seed_<st>_vs_parties.sql` →
`seed_<st>_vs_{2012,2017,2022}.sql` (new elections, after the 2026 year seeds), `seed_<st>_districts_regions.sql` (after the
Assam 2026 districts) and the run-once `seed_<st>_person_links_v1.sql`. Checked with the two-DB check from a fresh copy of
production (2026-10-05). Back up production (Neon branch) before the first deploy. No leaders/photos/profiles yet; seat
analysis is recomputed later with all elections. The frontend change (seat-number map match, map rewinding) ships with it:
without it these five states' maps draw as a filled square.

**The five 2026 elections (Phase 2B).** `setup.sh` now also runs, per state, `seed_<st>_vs_2026.sql` (new elections:
elections row, constituencies, candidates, results, manifest); `seed_as_2026_districts_regions.sql` (the old Assam
districts seed is scoped to 2008-delimitation elections); `seed_<st>_person_links_v2.sql` (KL, PY, TN, WB); then the
run-once `seed_<st>_leaders.sql`, `seed_<st>_candidate_photos.sql`, `seed_<st>_affidavits.sql` and, after the Bihar party
profiles, `seed_<st>_party_profiles.sql`. Publish or discard any 2026 manifest draft first. Seat analysis for the 2026
elections is recomputed later together with all elections (decided 2026-10-03): ids AS `f6a7b8c9-d0e1-2345-f012-567890122026`,
KL `a7b8c9d0-e1f2-3456-0123-678901232026`, PY `b1c2d3e4-f5a6-7890-1234-567890ab2026`, TN `e5f6a7b8-c9d0-1234-ef01-456789012026`,
WB `d4e5f6a7-b8c9-0123-def0-345678901026` (Assam: no history ids, it is the first election on the 2023 boundaries).

### 5.1 Neon

1. Create project in the region chosen in D1. Note both connection strings:
   ```
   # App (PgBouncer pooler)
   DATABASE_URL=postgresql://<user>:<pw>@ep-<id>-pooler.<region>.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=5&pool_timeout=20&connect_timeout=15
   # DDL / seeding only (direct host)
   DIRECT_URL=postgresql://<user>:<pw>@ep-<id>.<region>.aws.neon.tech/neondb?sslmode=require
   ```
2. Build the database from a laptop or CI with the **direct** URL:
   ```bash
   DATABASE_URL="$DIRECT_URL" database/setup.sh
   cd backend && DATABASE_URL="$DIRECT_URL" ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin
   ```
   (`setup.sh` is idempotent: schema → migrations → seeds.)

### 5.2 Upstash

Create a Redis database in **ap-southeast-1** (TLS on). Copy the `rediss://default:<token>@<db>.upstash.io:6379` URL.

### 5.3 Render (backend)

- New web service from the repo, region **Singapore**, instance **Free**.
- Root directory: `backend`
- Build: `npm ci --include=dev && npx prisma generate && npm run build`
- Start: `node dist/main`
- Health check path: `/api/v1/health/live` (no I/O; the only route exempt from the origin shield, §5.4). Readiness (DB + Redis, 503 when degraded): `/api/v1/health/ready` — monitored through Cloudflare (`https://api.<domain>/…`, since the shield rejects direct calls) during the election window only; off-season the monitor uses `/health/live` (§5.7).
- **Order of operations (read before starting):** (1) deploy on Render **without** the origin shield (this section) and confirm it on `<service>.onrender.com`; (2) §5.4: DNS `api → onrender.com` proxied, Pages, Cache Rule, then the Cloudflare **Transform Rule** that adds `X-Origin-Secret`; (3) only then set `ORIGIN_SHARED_SECRETS`, and after that `TRUST_CF_CONNECTING_IP=true` on Render (§5.4 step 5). Setting the secret before the rule exists makes every call except `/health/live` answer 403.
- Environment for the first deploy (shield **off**, so the service is reachable on `onrender.com`):
  ```
  NODE_ENV=production
  NODE_VERSION=24
  JWT_SECRET=<openssl rand -hex 32>
  DATABASE_URL=<Neon pooled URL>
  DIRECT_URL=<Neon direct URL>
  REDIS_URL=<Upstash rediss:// URL>
  CORS_ORIGINS=https://app.<domain>,https://admin.<domain>
  FEEDBACK_IP_SALT=<openssl rand -hex 32>
  OTEL_SDK_DISABLED=true
  NODE_OPTIONS=--max-old-space-size=384
  AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=…                 # IAM user matdaan-pulse-media-user (Put/Get on the bucket's objects, List)
  S3_BUCKET=matdaanpulse-media S3_REGION=ap-south-1             # admin image uploads; unset bucket = upload returns 503
  S3_PUBLIC_BASE_URL=https://matdaanpulse-media.s3.ap-south-1.amazonaws.com
  # Defaults, set only to change them:
  # TRUST_PROXY_HOPS=1  THROTTLE_PUBLIC_PER_MIN=600  THROTTLE_AUTH_PER_MIN=5  THROTTLE_FEEDBACK_PER_MIN=5  SSE_MAX_CONNECTIONS=200
  # LOG_LEVEL=info  ALLOW_REGISTRATION=false  CORS_ORIGIN_REGEX=
  # Added later, in this order, once Cloudflare is live (§5.4 step 5) — NOT on the first deploy:
  #   ORIGIN_SHARED_SECRETS=<openssl rand -hex 32>   # same value as the Cloudflare Transform Rule
  #   TRUST_CF_CONNECTING_IP=true                    # only with ORIGIN_SHARED_SECRETS (the backend refuses to start otherwise)
  ```
  (`PORT` is injected by Render.) Full list with comments: `.env.example`. The build log should say `Using Node.js 24.x`.
- First-deploy check: `curl -s https://<service>.onrender.com/api/v1/health/ready` → `200` (DB + Redis ok). Do **not** open the dashboard against this URL yet — it is deployed in §5.4.
- Rate-limit IP, **no-Cloudflare setups only** (this is how `req.ip` is derived while `TRUST_CF_CONNECTING_IP` is off, i.e. until §5.4 step 5 is done, or if you never use Cloudflare): verify `TRUST_PROXY_HOPS`, which decides the IP every rate limit is keyed on:
  1. Set `LOG_LEVEL=debug`, redeploy, and call any non-health endpoint from your machine. The first such request logs `Client IP check: req.ip=… x-forwarded-for="…" cf-connecting-ip=… TRUST_PROXY_HOPS=N TRUST_CF_CONNECTING_IP=false`.
  2. Compare `req.ip` with your own public IP. If they match, the setting is right.
  3. With N hops, `req.ip` is the N-th entry from the right of `x-forwarded-for`. Raise `TRUST_PROXY_HOPS` by one **only** if `req.ip` is a Render/Cloudflare proxy address **and** your real IP appears as an earlier (more-left) entry.
  4. Never set it higher than that: every extra hop trusts one more client-supplied entry, so anyone could send `X-Forwarded-For: <random>` and get a fresh bucket per request.
  5. Set `LOG_LEVEL` back to `info`.
  With Cloudflare in front and `TRUST_CF_CONNECTING_IP=true` this setting no longer decides the rate-limit key (it is only the fallback when `CF-Connecting-IP` is missing/invalid); verify the Cloudflare path as in §5.4 step 5 instead.

### 5.4 Cloudflare: domain, Pages, API proxy

1. **Domain:** buy the domain (name TBD) and add it to Cloudflare (nameservers → Cloudflare).
2. **Pages (two projects)** from the Git repo:

   | | Public dashboard | Admin |
   |---|---|---|
   | Root directory | `frontend` | `admin` |
   | Build | `npm run build` | `npm run build` |
   | Output | `dist` | `dist` |
   | Env (build time) | `VITE_API_BASE_URL=https://api.<domain>/api/v1` | same |
   | Custom domain | `app.<domain>` | `admin.<domain>` |

   **Admin extra build env (mandatory):** `VITE_PUBLIC_SITE_URL=<public site origin>` (currently `https://www.matdaanpulse.in`; later `https://app.<domain>`). Seeded party symbols are site-relative `/symbols/...` paths; `assetUrl()` resolves them against this. The default (`localhost:3080`) would break every symbol image in production. Deploy step: set it on the Vercel admin project (`matdaanpulse-admin`, later the Cloudflare Pages admin project) to the public site origin, then redeploy — Vite bakes it in at build time, so changing it has no effect until the next build.

   **Image storage:** S3 bucket `matdaanpulse-media` (ap-south-1): Block Public Access allows bucket policies, ACLs off; bucket policy grants public `s3:GetObject` on `arn:aws:s3:::matdaanpulse-media/*`; the IAM user has `s3:PutObject`/`s3:GetObject` on the objects and `s3:ListBucket` on the bucket. Seed photos and admin uploads (party symbols, person photos) live there; the DB stores the S3 URL. Moved from Vercel Blob on 2026-10-05 (that store was suspended at its free-plan limit): `seed_media_s3_v1.sql` (run-once) rewrites stored Blob URLs to the same keys on S3. Orphaned objects are not cleaned up.

   SPA fallback: each app ships `public/_redirects` (`/*  /index.html  200`), already committed in `frontend/` and `admin/`. The admin needs no copy of the seeded `/symbols/…` files: `assetUrl()` loads them from the public site via `VITE_PUBLIC_SITE_URL` (above).
3. **API hostname:** DNS `CNAME api → <service>.onrender.com`, **proxied** (orange cloud); add `api.<domain>` as a custom domain in Render so TLS validates. SSL mode **Full (strict)**.
4. **Caching:** Cloudflare caches only what the origin marks cacheable once a Cache Rule enables it: add a Cache Rule for `api.<domain>/api/v1/*` → "Eligible for cache", **respect origin Cache-Control**, keep the **query string in the cache key** (`?v=` selects the snapshot); enable **Smart Tiered Cache** (Caching → Tiered Cache). Admin/auth responses and all errors send `no-store` and are never cached. Check after the first deploy (Cloudflare Free must honour the origin's short `s-maxage` and `stale-while-revalidate`; verify, do not assume):
   - `curl -sI https://api.<domain>/api/v1/elections/<id>/live` twice → `cf-cache-status: HIT` (or `REVALIDATED`) on the second call within 5 s while the election is `Live` (30 s otherwise); `Age` counts up to ≤ the `s-maxage`, then the next call refreshes it.
   - `curl -sI "https://api.<domain>/api/v1/elections/<id>/results?v=<current version from /live>"` twice → second is `HIT` and carries `Cache-Control: public, max-age=31536000, immutable`.
   - `curl -sI "https://api.<domain>/api/v1/elections/<id>/results?v=1"` (an old version) → `302` to `?v=<current>`, and a repeat within 5 s is `HIT`.
   - `/elections` → `HIT` on repeat, `Cache-Control: public, max-age=0, s-maxage=60, …`.
   If any of these is `DYNAMIC`/`MISS` every time, the Cache Rule is not matching (check the expression and "respect origin") or the plan ignores the origin TTL — fix before counting day; it is the whole scaling plan.
   `X-Request-ID` on a CDN-cached public response is the id of the request that filled the cache and is replayed to every viewer: use it to correlate origin logs, not to identify a viewer's request.
5. **Origin shield + client IP** (do this after DNS, Pages and the Cache Rule work). Render has no inbound IP allowlist, so anyone could call `<service>.onrender.com` directly — bypassing the CDN and forging `X-Forwarded-For` / `CF-Connecting-IP` to pick their own rate-limit bucket. Close it, **in this order**:
   1. Cloudflare first: `openssl rand -hex 32` → Rules → **Transform Rules → Modify Request Header** (free plan): expression `http.host eq "api.<domain>"`, action **Set static** `X-Origin-Secret` = `<secret>` ("Set" overwrites anything a client sends; the header only travels edge → origin). `api.<domain>` must already be proxied (orange cloud) and serving the API (step 3).
   2. Render env `ORIGIN_SHARED_SECRETS=<secret>` (comma list for rotation: add the new value at origin, switch the Transform Rule, then remove the old one), redeploy. Every request without a matching header now gets `403 no-store` before any other work; only `GET/HEAD /api/v1/health/live` is exempt (Render's health checker). The header is stripped before logging. Check: `curl -si https://<service>.onrender.com/api/v1/elections` → 403; `curl -si https://api.<domain>/api/v1/elections` → 200; the boot log says `Origin shield on (1 secret)`. If the second call is 403 the Transform Rule is not matching (host expression, or the record is not proxied).
   3. Then set `TRUST_CF_CONNECTING_IP=true` and redeploy (req.ip = Cloudflare's `CF-Connecting-IP`, exact, no hop counting — a wrong `TRUST_PROXY_HOPS` would key buckets on Cloudflare egress IPs and 429 whole regions). The backend refuses to start with it set and no `ORIGIN_SHARED_SECRETS`.
   4. Verify the client IP on this path: set `LOG_LEVEL=debug`, redeploy, call any non-health endpoint through `https://api.<domain>` from your machine (use `?_=<random>` so the CDN does not answer). The one-time `Client IP check` line must show **`req.ip` = your public IP** and a populated **`cf-connecting-ip`** equal to it (`x-forwarded-for` will list Cloudflare/Render hops; ignore it). If `cf-connecting-ip=null`, the request did not come through Cloudflare (or the record is not proxied). `TRUST_PROXY_HOPS` only matters when `TRUST_CF_CONNECTING_IP` is off or the header is invalid. Set `LOG_LEVEL` back to `info`.
   `CORS_ORIGINS=https://app.<domain>,https://admin.<domain>` as before.
   Cache-busting: `?_=<anything>` (the admin panel's cache-buster) and random `?v=` values miss the CDN by design; per-IP throttling bounds them — optionally add a Cloudflare rate-limiting rule on requests with `_=` in the query.
   Snapshot size: an LS snapshot is ~490 KB raw (~80 KB gzipped); check it fits the Upstash plan's max request/value size (a failed SET only means one DB load per version per instance, bounded by single-flight).
6. **Security (free):** Cloudflare rate-limiting rule on `api.<domain>/api/v1/auth/*`; "Bot Fight Mode" optional.

### 5.5 Smoke test

1. `GET https://api.<domain>/api/v1/health/ready` → 200 with DB + Redis ok (through Cloudflare once the shield is on).
2. Open the dashboard → Bihar 2025 loads; map, scoreboard, summary render.
3. Set an election to `Live`, open its dashboard, then in the admin Live Console save one seat correction → the Live Console updates at once (SSE) and the dashboard updates within ~20 s without reload (polling). Set the status back afterwards.
4. Wait > 15 min idle → reload: cold start works; polling resumes on its own (no connection to re-establish).

5. Admin → System status (SUPER_ADMIN): uptime, non-zero requests, DB latency and both Redis connections show as ok. Counters are in memory and reset on every restart/cold start.

Counting-day runbook note: set the election's `tentative_next_date` to the counting day so open Upcoming pages poll (`/live` every ~60 s from 3 days before) and switch to Live by themselves when the status flips; flipping to `Live` early is then nice-to-have. Without a date, pages only poll when the election is `Live` at page load (and `/elections` is CDN-cached ~60 s + swr).

Uptime monitoring: see §5.7.

### 5.6 Load test (before each election window)

Against `https://api.<domain>` (through the CDN), with the scraper replaying a past counting day (`npm run sim:replay`) so versions change:

```bash
cd scraper
LOADTEST_ADMIN_TOKEN=<SUPER_ADMIN JWT> \
  npm run loadtest:viewers -- --base https://api.<domain>/api/v1 --election <live election id> --viewers 500 --duration 180
# repeat with --viewers 2000, 5000 (several machines if needed)
```

`scraper/src/loadtest/viewers.ts` runs N simulated viewers with the browser's algorithm (poll `/live` every 10–13 s, 0–2 s wait then `results?v=` on a version change, backoff with `Retry-After`) and prints client-side counts, statuses, `/live` p50/p95, and the origin's own request delta from `/admin/status` (credentials: `LOADTEST_ADMIN_TOKEN`, or `SIM_ADMIN_EMAIL`/`ADMIN_EMAIL` + password env). Pass criteria: the origin request rate stays roughly flat as simulated viewers increase (origin/client ratio falls well below 1); p95 `/live` < 300 ms from India; no 5xx; Upstash commands per minute well under quota.

Without a CDN (e.g. against `localhost` or `<service>.onrender.com`) every simulated request reaches the origin — the ratio is ≈1.00 by design; that run only checks correctness and single-flight (Redis misses ≈ one per version). All viewers of one machine share an IP: keep viewers × ~5 polls/min under `THROTTLE_PUBLIC_PER_MIN` when hitting the origin directly.

### 5.7 Monitoring

- **Uptime (split by season, §3.1):** UptimeRobot / Better Stack free monitor through Cloudflare (`https://api.<domain>/…`; the shield rejects direct calls).
  - **Off-season:** `https://api.<domain>/api/v1/health/live` (no DB, no Redis). `/ready` does `SELECT 1` and a Redis PING; probing it every 5 min would keep Neon from ever suspending (it suspends after ~5 min idle) and burn its monthly compute allowance.
  - **Election window** (same calendar reminders as the Render Starter switch): `https://api.<domain>/api/v1/health/ready` every 5 min → email/phone alert. Switch back afterwards.
  - Either monitor keeps the Render free instance awake; one always-pinged free service is what the monthly free instance-hour allowance is sized for (verify against Render's current terms, and do not put a second free service on the account).
  - Health probes are excluded from the System status traffic counters and logged at `debug`.
- **Counting-day view:** admin → System status (in-memory counters since restart: traffic, 4xx/5xx/429, origin-shield 403s, slowest routes, cache hit rate, Redis state, live connections, result changes/min, DB latency). Shield 403s are counted separately and are not part of the request total.
- **Logs and the SSE token:** the Live Console's stream URL carries its short-lived (5 min, single-election) token as `?token=`. The app redacts it in its own logs, but Render's and Cloudflare's platform access logs record the URL, so treat those logs as able to see a token that is valid for at most 5 minutes and cannot be used as a session credential.

- **Database time zone:** `audit_logs.timestamp` and `constituency_analysis.updated_at` are `TIMESTAMP` (without a time zone) and the API reads them as UTC. Keep the database session time zone at UTC (Neon's default; do not set `TimeZone` on the role, database or connection URL), or the admin shows audit and analysis times shifted. The newer `updated_at` columns (migration 017) are `TIMESTAMPTZ` and unaffected.

### 5.8 Live worker

The counting-day worker posts ECI results to the ingest API (`docs/LIVE_RUNBOOK.md`).

1. Host: a Render background worker or a Fly.io machine in Singapore (same region as the API), root `scraper/`.
2. Command: `npm run live -- --config live.config.json`.
3. Env: `INGEST_API_URL` (the API base, `.../api/v1`), `INGEST_KEY` (a `worker-<host>` key from Admin -> Ingest keys), `LIVE_HOLDER` (a name for this worker, unique per host, e.g. `cloud`; always set it — two hosts with the same holder and key would share one lease).
4. Start it before counting begins and stop it after finalizing (`Ctrl-C`/SIGTERM releases its leases); it can stay suspended off-season.
5. The laptop runs the same command (`holder` `laptop`, key `laptop`) as backup; it takes over a shard within 90 s of the cloud worker stopping.
6. Optional on the API: `INGEST_ALERT_WEBHOOK_URL` for alerts.

## 6. Decisions

| ID | Decision | Outcome |
|---|---|---|
| D1 | Neon region | **Singapore `ap-southeast-1`** (same region as Render and Upstash) |
| D2 | Render spin-down on counting days | **Free off-season; Starter from ~2 weeks before to ~3 days after counting** (§3.1). Counting-day runbook: watch 429s; raise `THROTTLE_PUBLIC_PER_MIN` (default 600/min per IP) if shared mobile CGNAT addresses hit it; no backend deploys during counting (§3.1, bulk transaction vs Render's shutdown grace); Neon plan for the window decided in advance (§3.1) |
| D3 | Custom domain | **Own domain on Cloudflare** (name TBD): `app.`, `admin.`, `api.<domain>` |
| D4 | Observability | **Uptime monitor + admin System status** at launch; hosted OTLP / log drain later if needed |
| D5 | Public self-registration | **Disabled** (`ALLOW_REGISTRATION=false`) |
| D6 | Counting-day load / Upstash quota | **CDN-ready live** (§2.2): CDN caching + polling + versioned snapshots + single-flight; in-process cache optional after that |
| D7 | ~~AI enrichment runs~~ | **Removed (2026-09-30):** no AI inside the app; AI-assisted data is produced offline (Claude Code playbooks) and loaded like scraped data |
| D8 | Preview deployments | Cloudflare Pages preview URLs: allow via `CORS_ORIGIN_REGEX` anchored to the project's `*.pages.dev` previews, or keep exact origins only — decide when setting up Pages |
| D9 | Deploy flow | Auto-deploy both Pages projects on push to `main`; manual backend deploy + migrations (`setup.sh` with `DIRECT_URL`) until CI exists; deploy migration 014 together with the backend that no longer uses the AI columns; apply migration 015 (`setup.sh`) **before** deploying the backend that reads `election_live_state`; migration 018: `setup.sh`, then the backend, then merge to `main` (§5.0), and drop the `metadata` columns in a later migration |
| D10 | Backups | Scheduled `pg_dump` (GitHub Action) before counting days, plus Neon's point-in-time window |
| D11 | Node version | **24.x** (LTS; pinned in `engines`, `NODE_VERSION=24` on Render; Node 20 reached end-of-life in April 2026) |
| D12 | Secrets ownership | Name an owner for the Cloudflare/Render/Neon/Upstash accounts and `JWT_SECRET` rotation |
| D13 | Static hosting | **Cloudflare Pages** (unlimited static bandwidth, commercial use, same account as DNS/CDN) instead of Vercel |
| D14 | Viewer live updates | **Polling a CDN-cached version + versioned snapshots** (10–20 s delay); SSE kept for the admin live console |
| D15 | Election-window spend | **Accepted:** ~$7–10 in an election month, $0 otherwise |

## 7. Later (not needed for launch)

- Scaling beyond one instance: Redis-backed throttler storage (review P-L4).
- Design clean-ups from the review: D-M1 (`AiEnrichmentService`) is gone with the built-in AI; D-M2 (`ResultChangeNotifier`, shared SSE stream helper, `CacheService.getOrSet`) and D-L1 (domain-owned input DTOs, single `parseManifest()`) are done.
- Rename the `elections.manifest_url` column (it holds JSON text, not a URL) with a migration and Prisma/DTO/frontend follow-through.
- Dependency majors (Nest, Prisma), indexes (P-L1), set-based bulk writes (P-M2), JWT hardening (S-L1).
