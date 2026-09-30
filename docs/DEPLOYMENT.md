# Deployment plan

Status: **draft.** The backend blockers in [§4](#4-blockers-before-first-deploy) are fixed on branch `fix/backend-hardening` (2026-09-30). Hosting decisions are made (§6); the domain name is still to be chosen. The pre-deploy task **CDN-ready live** (§2.2) is implemented on the same branch. Source reviews: [`docs/reviews/2026-09-30-backend-review.md`](reviews/2026-09-30-backend-review.md), [`docs/reviews/2026-09-30-election-day-pipeline-review.md`](reviews/2026-09-30-election-day-pipeline-review.md).

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

Not deployed: `scraper/` (seed generators and the live-count simulation; run locally or in CI against the API). The earlier plan's BullMQ queues, S3, and "Landing"/"Student" frontends belong to another app — none exist here.

### What Redis is used for

- **Cache:** results / constituency lists, 5–10 min TTL, and versioned live snapshots (`results.service.ts`, `constituencies.service.ts`). Identical concurrent misses share one load (single-flight in `CacheService.getOrSet`).
- **Pub/sub:** admin result overrides are published and fanned out to the admin Live Console's SSE clients (`live.service.ts`, `GET /admin/live/updates` with a 5-min SSE token, ≤ `SSE_MAX_CONNECTIONS` per process). Public viewers poll (§2.2) and hold no connection.
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

Keep the API, database and Redis in the **same region**: every uncached request makes several sequential DB round trips. Render Singapore ↔ Neon us-east-2 adds ~200–250 ms per round trip (a constituency page ≈ 1.3 s, a single override ≈ 1.5 s); with Neon in Singapore it is ~1–3 ms.

### 2.1 Traffic shape

Very few users off-season → a ramp as an election nears → a sharp peak on counting day → a cliff within a day or two. Design goal: **origin load must not grow with the number of viewers.** Everyone looks at the same results, so the CDN serves them and the origin answers the CDN a few times per second at most.

### 2.2 Live results for viewers: polling a CDN-cached version (pre-deploy task "CDN-ready live")

Per-viewer SSE does not scale behind a CDN (every open tab holds an origin connection; a Render restart makes all of them reconnect at once). Viewers poll instead; the admin live console keeps SSE (few editors).

| Endpoint | Returns | Cache-Control |
|---|---|---|
| `GET /api/v1/elections/:id/live` | `{ version, updatedAt, declared, total }` (a few hundred bytes) | `public, max-age=0, s-maxage=5, stale-while-revalidate=10` |
| `GET /api/v1/elections/:id/results?v=<version>` | full snapshot for that version | `public, max-age=31536000, immutable` (a version never changes) |
| Other public GETs (elections, constituencies, …) | as today | `public, max-age=0, s-maxage=60, stale-while-revalidate=300` (longer for finished elections) |
| Admin, auth, SSE, health | — | `no-store` / not cached |

- The backend bumps `version` on every committed results batch (single or bulk override, later the scraper).
- Browser: poll `/live` every 10 s + random 0–3 s; pause while the tab is hidden; on a version change wait random 0–2 s, then fetch `results?v=<new>`; exponential backoff with jitter on errors and honour `Retry-After`.
- Herd protection: the CDN answers polls (each upper-tier PoP asks origin at most once per 5 s; **Smart Tiered Cache** is on the free plan); versioned snapshot URLs are identical for everyone; `stale-while-revalidate` serves the old copy during a refresh; the backend single-flights identical in-flight requests (one DB query per key). Polling holds no connections, so there is no reconnect storm after a deploy.
- Trade-off: viewers see changes 10–20 s late (ECI itself updates every few minutes); snapshots are atomic per version.
- Prerequisite: response bodies must not contain per-request values (`requestId`, `timestamp`) — they move to headers.

Expected origin load on counting day: roughly (upper-tier PoPs × 1 request / 5 s) for `/live` + one fetch per new version per PoP — independent of viewer count.

**Implementation (branch `fix/backend-hardening`):**
- Version: table `election_live_state` (migration 015). Statement-level DB triggers on `results` (insert/update/delete), `candidates` and `parties` (update) bump it inside the writing transaction, so every writer — API overrides, the simulation's direct SQL, seeds, admin edits — moves it, and a committed change and its version become visible together. Value: `GREATEST(version + 1, now in epoch ms)` — never decreases, and a rebuilt database never reuses a version a CDN may still hold as immutable.
- UPDATE triggers bump only when a snapshot column changes (results votes/status/margin/ids, candidate name/party, constituency type, party name/colour); the migration runs in one transaction with `CREATE OR REPLACE TRIGGER`, so re-running it never leaves a moment without triggers. After a DB restore / PITR run `UPDATE election_live_state SET version = GREATEST(version + 1, (extract(epoch FROM clock_timestamp()) * 1000)::bigint);` so no version number is reused.
- `/live` returns `{ version, status, updatedAt, declared, total }` through a 1 s in-process memo with single-flight (`s-maxage=5` while `Live`, `30` otherwise); override services forget the memo after commit, purge the Redis caches, and only then publish the admin SSE event (pipeline review M5). Admin election PATCH/finalize also forget the memo, so a status flip shows at once.
- `results?v=<current>` returns `{ version, results, summary, voteShare }` — results rows, seat tally and vote share computed from **one** query, read together with the version in one `REPEATABLE READ` transaction, so a snapshot labelled V holds exactly version V's data and map, scoreboard and standings update atomically. It is cached in Redis under `election:<id>:snapshot:v<version>` only when the version read equals V (otherwise served `no-store`). `v` older than current → `302` to the current URL (`s-maxage=5`); `v` newer (a poll raced ahead of this instance) → current data with `no-store`. Without `v` the endpoint is unchanged (rows array, `s-maxage=10, stale-while-revalidate=30`).
- The unversioned results-derived Redis caches (`summary`, `vote-share`, `full-results`) are keyed by the live version too (`…:v<version>`), so a direct-SQL write (simulation, manual fix) moves readers to fresh keys without a purge; the CDN's 60 s + swr remains. `CacheService` invalidations only detach in-flight loads of the keys they match (per election), and `:v<version>` keys are never detached.
- Headers: `@CacheControl()` opt-in per public controller; everything else (admin, auth, health), **every error**, and every request carrying `Authorization` (the admin panel, which also appends `_=` to its GETs) is `no-store`, so the CDN never caches a 4xx/5xx or an admin read. Publicly cacheable responses drop the per-client `X-RateLimit-*` headers. SSE keeps Nest's `private, no-cache`. Success bodies have no `requestId`/`timestamp` (`X-Request-ID` and `Date` headers instead).
- CORS: Cloudflare does not vary its cache on `Origin`, so public GET/HEAD responses send `Access-Control-Allow-Origin: *` (no cookies are used; the data is public). Admin/auth and writes keep the exact allowlist. `Retry-After` and `X-Request-ID` are exposed; 429s carry a standard `Retry-After`.
- Browser: `frontend/src/model/live/poller.ts` runs for elections that are `Live`, or `Upcoming` within 3 days before to 60 days after `tentative_next_date`. Cadence follows the `/live` status: Upcoming 60 s + 0–15 s (`/live` only), Live 10 s + 0–3 s with snapshots, Finalized → final snapshot then stop — so a page opened before counting picks up Live without a reload. It only moves forward (never fetches or shows an older version from a stale CDN colo). After 3 consecutive failures with no snapshot the dashboard shows an error with Retry (polls at once). Its GETs send no custom headers, so they are CORS "simple" requests with no preflight (OPTIONS is never CDN-cached). The live ticker and map pulses are diffs between consecutive snapshots.

## 3. Free-tier limits to plan around

| Service | Limit | Effect on this app |
|---|---|---|
| Render free | Spins down after ~15 min without inbound requests; cold start 30–60 s; 512 MB RAM, 0.1 CPU; monthly instance-hour cap | First visitor after idle waits ~1 min (off-season only — Starter during election windows, §3.1). |
| Neon free | 512 MB storage; compute auto-suspends after ~5 min idle; monthly compute-hour cap | First query after idle takes ~0.5–few s; a pooled connection may be dropped once (retry). Seed data ≈ 30–60 MB, fits. |
| Upstash free | 256 MB; monthly command and bandwidth caps (500K commands/month at the time of writing) | Every cache read, publish and delivered message counts. A busy counting day can hit the cap — see decision D6. |
| Cloudflare free | Pages: 500 builds/month, 20k files, 25 MiB/file; CDN caching of API GETs; Tiered Cache | No bandwidth cap published for static assets. |

Verify current limits on each provider's pricing page before launch.

### 3.1 Seasonal scaling

| Period | Render | Neon | Upstash | Cost |
|---|---|---|---|---|
| Off-season | **Free** (sleeps after ~15 min idle) | Free | Free | $0 |
| ~2 weeks before counting → ~3 days after | **Starter** (always on, no cold starts) | Free (pay-as-you-go only if compute hours run out) | Free (pay-as-you-go costs cents if the cap is hit) | ~$7–10 for the month |
| Counting day | Starter; one instance is enough behind the CDN (Standard optional) | same | same | same |
| After the cliff | back to **Free** | | | $0 |

Window runbook: calendar reminders (or a scheduled job) to switch the Render instance type up two weeks before counting and down three days after; run the load test (§5.6) after switching up.

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
| B9 | Build needs devDeps + `prisma generate`; Node version unpinned | DEP-3 | Build command below; `"engines": { "node": "20.x" }` | Done — build verified with `npm ci --include=dev && npx prisma generate && npm run build` |
| B10 | Neon needs pooled vs direct URLs; `setup.sh` can't take the pooled Prisma URL | §6 | `directUrl` in `schema.prisma`; run `setup.sh` with the direct URL | Done — `DIRECT_URL` (only Prisma CLI commands need it; may equal `DATABASE_URL` locally) |
| B11 | CORS origins not trimmed | S-L3 | Trim/filter the list; exact Vercel origins | Done — plus optional `CORS_ORIGIN_REGEX`; `credentials` dropped |

Recommended alongside (not strictly blocking): 5 MB body limit only on the bulk-override route (S-M3) — **done**; query DTOs on list endpoints (E-M2) — **done**; SSE heartbeat 20 s + `retry:` (O-M3) — **done**; stop public self-registration (S-M1) — **done** (`ALLOW_REGISTRATION`, plus last-SUPER_ADMIN guard); URL validation (S-M2; the `GEMINI_MODEL` part became moot when the built-in AI was removed), request-id validation (S-L2), log correlation + `LOG_LEVEL` (O-M1) — **done**. `Cache-Control` + drop per-response `requestId`/`timestamp` from bodies so ETags work (P-M1) — **done** (§2.2). Still open: in-process cache in front of Redis (D6; optional now that the CDN absorbs viewer traffic).

## 5. Setup steps (once blockers are fixed)

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
- Health check path: `/api/v1/health/live` (no I/O; the only route exempt from the origin shield, §5.4). Readiness (DB + Redis, 503 when degraded): `/api/v1/health/ready` — monitor it through Cloudflare (`https://api.<domain>/…`), since the shield rejects direct calls.
- Environment:
  ```
  NODE_ENV=production
  JWT_SECRET=<openssl rand -hex 32>
  DATABASE_URL=<Neon pooled URL>
  DIRECT_URL=<Neon direct URL>
  REDIS_URL=<Upstash rediss:// URL>
  CORS_ORIGINS=https://app.<domain>,https://admin.<domain>
  OTEL_SDK_DISABLED=true
  NODE_OPTIONS=--max-old-space-size=384
  # Defaults, set only to change them:
  ORIGIN_SHARED_SECRETS=<openssl rand -hex 32>   # same value as the Cloudflare Transform Rule (§5.4)
  TRUST_CF_CONNECTING_IP=true                     # only with ORIGIN_SHARED_SECRETS (the backend refuses to start otherwise)
  # TRUST_PROXY_HOPS=1  THROTTLE_PUBLIC_PER_MIN=600  THROTTLE_AUTH_PER_MIN=5  SSE_MAX_CONNECTIONS=200
  # LOG_LEVEL=info  ALLOW_REGISTRATION=false  CORS_ORIGIN_REGEX=
  ```
  (`PORT` is injected by Render.) Full list with comments: `.env.example`.
- First deploy — verify `TRUST_PROXY_HOPS` (it decides the IP every rate limit is keyed on):
  1. Set `LOG_LEVEL=debug`, redeploy, and open the dashboard from a browser. Health-check requests are ignored; the first other request logs `Client IP check: req.ip=… x-forwarded-for="…" TRUST_PROXY_HOPS=N`.
  2. Compare `req.ip` with your own public IP (e.g. from a "what is my IP" page). If they match, the setting is right.
  3. With N hops, `req.ip` is the N-th entry from the right of `x-forwarded-for`. Raise `TRUST_PROXY_HOPS` by one **only** if `req.ip` is a Render/Cloudflare proxy address **and** your real IP appears as an earlier (more-left) entry in `x-forwarded-for`.
  4. Never set it higher than that: every extra hop trusts one more client-supplied entry, so anyone could send `X-Forwarded-For: <random>` and get a fresh bucket per request — bypassing the 5/min login limit and the public limit.
  5. Set `LOG_LEVEL` back to `info`.

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

   SPA fallback: add `public/_redirects` with `/* /index.html 200` to each app (Pages serves `index.html` for unknown paths when no 404.html exists, but make it explicit). The admin dev proxy for `/symbols` (`admin/vite.config.ts`) does not exist in production — serve party symbols from `https://app.<domain>/symbols/…` or copy them into the admin build.
3. **API hostname:** DNS `CNAME api → <service>.onrender.com`, **proxied** (orange cloud); add `api.<domain>` as a custom domain in Render so TLS validates. SSL mode **Full (strict)**.
4. **Caching:** Cloudflare caches only what the origin marks cacheable once a Cache Rule enables it: add a Cache Rule for `api.<domain>/api/v1/*` → "Eligible for cache", **respect origin Cache-Control**, keep the **query string in the cache key** (`?v=` selects the snapshot); enable **Smart Tiered Cache** (Caching → Tiered Cache). Admin/auth responses and all errors send `no-store` and are never cached. Check after the first deploy: `curl -sI https://api.<domain>/api/v1/elections/<id>/live` twice → `cf-cache-status: HIT` (or `REVALIDATED`) on the second call within 5 s.
5. **Origin shield + client IP:** Render has no inbound IP allowlist, so anyone could call `<service>.onrender.com` directly — bypassing the CDN and forging `X-Forwarded-For` / `CF-Connecting-IP` to pick their own rate-limit bucket. Close it:
   1. `openssl rand -hex 32` → Cloudflare → Rules → **Transform Rules → Modify Request Header** (free plan): expression `http.host eq "api.<domain>"`, action **Set static** `X-Origin-Secret` = `<secret>` ("Set" overwrites anything a client sends; the header only travels edge → origin).
   2. Render env `ORIGIN_SHARED_SECRETS=<secret>` (comma list for rotation: add the new value at origin, switch the Transform Rule, then remove the old one). Every request without a matching header gets `403 no-store` before any other work; only `GET/HEAD /api/v1/health/live` is exempt (Render's health checker). The header is stripped before logging.
   3. Then set `TRUST_CF_CONNECTING_IP=true` (req.ip = Cloudflare's `CF-Connecting-IP`, exact, no hop counting — a wrong `TRUST_PROXY_HOPS` would key buckets on Cloudflare egress IPs and 429 whole regions). The backend refuses to start with `TRUST_CF_CONNECTING_IP=true` and no `ORIGIN_SHARED_SECRETS`.
   4. Check: `curl -si https://<service>.onrender.com/api/v1/elections` → 403; through `api.<domain>` → 200. The boot log says `Origin shield on (1 secret)`.
   `CORS_ORIGINS=https://app.<domain>,https://admin.<domain>` as before.
   Cache-busting: `?_=<anything>` (the admin panel's cache-buster) and random `?v=` values miss the CDN by design; per-IP throttling bounds them — optionally add a Cloudflare rate-limiting rule on requests with `_=` in the query.
   Snapshot size: an LS snapshot is ~490 KB raw (~80 KB gzipped); check it fits the Upstash plan's max request/value size (a failed SET only means one DB load per version per instance, bounded by single-flight).
6. **Security (free):** Cloudflare rate-limiting rule on `api.<domain>/api/v1/auth/*`; "Bot Fight Mode" optional.

### 5.5 Smoke test

1. `GET /api/v1/health/ready` → 200 with DB + Redis ok.
2. Open the dashboard → Bihar 2025 loads; map, scoreboard, summary render.
3. Set an election to `Live`, open its dashboard, then in the admin Live Console apply one override → the Live Console updates at once (SSE) and the dashboard updates within ~20 s without reload (polling). Set the status back afterwards.
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

- **Uptime:** UptimeRobot / Better Stack free monitor on `https://api.<domain>/api/v1/health/ready` every 5 min → email/phone alert. The keep-awake pinger (if used off-season) must hit `/health/live`, not `/ready`, so Neon can still suspend.
- **Counting-day view:** admin → System status (in-memory counters since restart: traffic, 4xx/5xx/429, slowest routes, cache hit rate, Redis state, live connections, overrides/min, DB latency).

## 6. Decisions

| ID | Decision | Outcome |
|---|---|---|
| D1 | Neon region | **Singapore `ap-southeast-1`** (same region as Render and Upstash) |
| D2 | Render spin-down on counting days | **Free off-season; Starter from ~2 weeks before to ~3 days after counting** (§3.1). Counting-day runbook: watch 429s; raise `THROTTLE_PUBLIC_PER_MIN` (default 600/min per IP) if shared mobile CGNAT addresses hit it |
| D3 | Custom domain | **Own domain on Cloudflare** (name TBD): `app.`, `admin.`, `api.<domain>` |
| D4 | Observability | **Uptime monitor + admin System status** at launch; hosted OTLP / log drain later if needed |
| D5 | Public self-registration | **Disabled** (`ALLOW_REGISTRATION=false`) |
| D6 | Counting-day load / Upstash quota | **CDN-ready live** (§2.2): CDN caching + polling + versioned snapshots + single-flight; in-process cache optional after that |
| D7 | ~~AI enrichment runs~~ | **Removed (2026-09-30):** no AI inside the app; AI-assisted data is produced offline (Claude Code playbooks) and loaded like scraped data |
| D8 | Preview deployments | Cloudflare Pages preview URLs: allow via `CORS_ORIGIN_REGEX` anchored to the project's `*.pages.dev` previews, or keep exact origins only — decide when setting up Pages |
| D9 | Deploy flow | Auto-deploy both Pages projects on push to `main`; manual backend deploy + migrations (`setup.sh` with `DIRECT_URL`) until CI exists; deploy migration 014 together with the backend that no longer uses the AI columns; apply migration 015 (`setup.sh`) **before** deploying the backend that reads `election_live_state` |
| D10 | Backups | Scheduled `pg_dump` (GitHub Action) before counting days, plus Neon's point-in-time window |
| D11 | Node version | 20.x (pinned in `engines`) |
| D12 | Secrets ownership | Name an owner for the Cloudflare/Render/Neon/Upstash accounts and `JWT_SECRET` rotation |
| D13 | Static hosting | **Cloudflare Pages** (unlimited static bandwidth, commercial use, same account as DNS/CDN) instead of Vercel |
| D14 | Viewer live updates | **Polling a CDN-cached version + versioned snapshots** (10–20 s delay); SSE kept for the admin live console |
| D15 | Election-window spend | **Accepted:** ~$7–10 in an election month, $0 otherwise |

## 7. Later (not needed for launch)

- Scaling beyond one instance: Redis-backed throttler storage (review P-L4).
- Design clean-ups from the review: `ResultChangeNotifier` (D-M2; D-M1 `AiEnrichmentService` is gone with the built-in AI). (The shared SSE stream helper and `CacheService.getOrSet` are done.)
- Dependency majors (Nest, Prisma), indexes (P-L1), set-based bulk writes (P-M2), JWT hardening (S-L1).
