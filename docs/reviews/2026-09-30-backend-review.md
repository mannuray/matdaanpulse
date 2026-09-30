# Backend review — 2026-09-30

Scope: `backend/` (NestJS 10 + Prisma 6 + ioredis + OTel + Gemini), branch `feat/fe-redesign`.
Read-only review. Findings already fixed by `d0f9452` (SSE interceptor bypass, Bearer auth on the enrichment stream, required `JWT_SECRET`, dummy-hash login, bulk-override validation/ownership/audit, strict admin body DTOs, Gemini key moved to a header, manifest drafts, audit FK) are **not** repeated here.

Severity counts: **Critical 2 · High 8 · Medium 13 · Low 11** (34 total).

## Summary

| Dimension | Rating | Top issue |
|---|---|---|
| 1. SOLID / design | Fair | `AiEnrichmentService` combines the Gemini HTTP client, retry policy, job runner, in-memory progress store and pub/sub. SSE sharing and cache-aside code are copy-pasted. |
| 2. Security | Fair, with one deployment blocker | No `trust proxy`, so behind Render every client shares one throttle bucket (the site-wide 100 req/min, and the login limit lets anyone lock admins out). There is also a critical `protobufjs` advisory in the OTel gRPC chain. |
| 3. Scale & performance | Fair | Strong ETag can never match because every body carries `requestId`/`timestamp`. There are no `Cache-Control` headers, and ~1 MB result blobs are cached in Redis. Sequential per-row writes in `autoLink`/`bulkTag`. |
| 4. Error handling | Poor | Redis being down takes the API down: unguarded cache reads plus ioredis offline-queue defaults. Prisma errors all come back as 500. SIGTERM calls `process.exit(0)`, so nothing shuts down gracefully. |
| 5. Logging & observability | Poor | The exception filter never logs 500s (no stack trace anywhere). `getRequestId()` is never used. OTel always exports to `localhost:4317`. `/health` returns 200 when degraded. |
| 6. Deployment readiness (Render/Neon/Upstash/Vercel) | Not deployable as-is | Redis config can't reach Upstash (no URL/password/TLS) and startup awaits the connection. Neon in us-east-2 adds ~200–250 ms per query from Singapore. The build needs devDeps plus `prisma generate`. |

---

## 1. SOLID / design

### Medium

**D-M1 — `AiEnrichmentService` is a god service; strategies get raw Prisma.**
- Evidence: `src/modules/ai/ai-enrichment.service.ts:43-87` (HTTP client, retry and backoff), `:89-108` (context and progress publishing), `:110-120` (in-memory job registry), `:122-157` (fire-and-forget job launch). Strategies are created with `new` (`:35-40`), not DI. They receive `prisma` through `EnrichmentContext` and write to the DB directly (`strategies/constituency-enrichment.strategy.ts:113-137`, `person-enrichment.strategy.ts:69-77`).
- Failure scenario: swapping Gemini for another model, adding a circuit breaker, or moving jobs to a worker means editing one class and every strategy at once. Strategies can't be unit-tested without a Prisma client.
- Fix: split the service into an `LlmClient` interface (`GeminiClient` implementation with timeout, retry and breaker), an `EnrichmentJobRunner` (job state, concurrency lock, progress), and per-entity repositories injected into DI-provided strategies.

**D-M2 — Duplicated infrastructure code.**
- SSE sharing: `live/live.service.ts:46-81` and `admin/controllers/admin-constituencies.controller.ts:22-26,131-168` are near-identical (`HEARTBEAT_MS` is defined twice). The controller also holds long-lived state (`sharedStreams`).
- Cache-aside: `results.service.ts:14-16,39-41,70-72` and `constituencies.service.ts:164-166`. Each reimplements get → parse → query → set, with TTLs as magic numbers.
- Post-commit steps: `live/result-override.service.ts:75-116` and `live/bulk-override.service.ts:132-183` (metrics → publish → purge).
- Failure scenario: a fix to one heartbeat or teardown path, such as adding the `retry:` field (see O-M3), is missed in the other copy. A Redis-failure fallback (see E-H1) has to be added in four places.
- Fix: add a `SharedChannelStream` helper (channel → shared `Observable<MessageEvent>`) used by both SSE endpoints, a `CacheService.getOrSet(key, ttl, loader)` wrapper, and a `ResultChangeNotifier.afterCommit(electionId, rows)`.

### Low

**D-L1 — Inverted dependency direction.** Domain services import input types from the admin presentation layer: `elections.service.ts:5`, `candidates.service.ts:5`, `parties.service.ts:4`, `constituencies.service.ts:7` all import from `../admin/dto/admin-input.dto`. Separately, `elections.controller.ts:39-47` and `elections.service.ts:40-43` each JSON-parse `manifest_url` (a JSON string stored in a "url" column). Failure scenario: `ElectionsModule` can't be reused or tested without the admin DTOs, and the manifest format is parsed in two places that can drift. Fix: move input types to each domain module (`elections/dto`), and parse the manifest once in the service (longer term, store it as `jsonb`).

---

## 2. Security

### Critical

**S-C1 — No `trust proxy`, so the throttler keys every user on the proxy IP.**
- Evidence: `app.module.ts:26-29,48-51` register a global `ThrottlerGuard`, whose default tracker is `req.ip` (`node_modules/@nestjs/throttler/dist/throttler.guard.js:141-142`). `main.ts` never calls `app.set('trust proxy', …)`.
- Failure scenario on Render: every request arrives from Render's proxy address.
  - The limit of 100 req/min becomes a limit for the whole site. A single page load makes several API calls (election, results, vote-share, analysis, SSE), so a handful of concurrent visitors trigger 429s for everyone.
  - `/auth/login` allows 5/min (`auth.controller.ts:11`), so one person, or a bot, sending 5 bad logins locks all admins out for a minute, over and over.
  - `EventSource` doesn't reconnect after a non-200 response, so a 429 on `/live/updates` silently ends live updates for that viewer.
  - `/health` is throttled too, so the platform health check can fail.
- Fix:
  - `app.set('trust proxy', 1)`, then check empirically that `req.ip` is the client IP (log it once; Render also sits behind Cloudflare, so confirm the hop count rather than assuming it).
  - `@SkipThrottle()` on `LiveController` and `HealthController`.
  - Separate named throttlers: generous for public GETs (e.g. 300/min, since Indian mobile CGNAT shares IPs), strict for `auth/*`.
  - Never set `trust proxy: true`: XFF spoofing would bypass the limit.

### High

**S-H1 — Vulnerable production dependencies (`npm audit --omit=dev`: 1 critical, 17 high, 30 moderate, 1 low).**
- Critical: `protobufjs` (arbitrary code execution), pulled in by `@opentelemetry/exporter-*-otlp-grpc` / `otlp-transformer`.
- High:
  - `@grpc/grpc-js` (malformed request crashes the server)
  - `@nestjs/platform-express` → `multer` (DoS) and `path-to-regexp` (ReDoS)
  - `@opentelemetry/sdk-node` / `auto-instrumentations-node` (Jaeger propagator DoS on a malformed header, which is reachable from any request header), `prisma` / `@prisma/config` (`effect`, `deepmerge-ts`), `lodash` via `@nestjs/config`, `brace-expansion`, `glob`, `defu`
- Failure scenario: the Jaeger propagator is active through auto-instrumentations, so a crafted `uber-trace-id` header can throw inside request handling. Separately, the exporter chain carries a critical advisory into a public service.
- Fix: run `npm audit fix` for the non-breaking set. Upgrade the OTel packages together to the current `sdk-node`/exporter line. Switch to `exporter-*-otlp-http` (drops grpc-js/protobufjs) or disable OTel in production (see O-M4). Plan the Nest and Prisma major upgrades.

### Medium

**S-M1 — `RolesGuard` fails open, and self-registration is public.**
- Evidence: `auth/guards/roles.guard.ts:14-16` returns `true` when a route has no `@Roles`. `/auth/register` is public and issues a VIEWER JWT (`auth.controller.ts:16-21`, `auth.service.ts:43-56`). Today every admin handler does carry `@Roles` (all 47 verified), so nothing is exposed yet. `user.service.ts:28-54` doesn't stop the last SUPER_ADMIN from demoting or deleting themselves.
- Failure scenario: a future admin route added without `@Roles` is immediately open to anyone who self-registers. VIEWER has no product use, so registration only adds attack surface and DB growth. A SUPER_ADMIN who demotes themselves leaves no admin (recovery needs `create-admin` with shell access).
- Fix: make the guard deny by default when `@Roles` is missing on `admin/*` controllers, or add a test that walks the router metadata. Disable `/auth/register` unless there is a product need (for example behind an `ALLOW_REGISTRATION` flag). Refuse to demote or delete the last SUPER_ADMIN.

**S-M2 — URLs from AI output and admin input are stored without scheme validation; prompt injection comes in through grounding.**
- Evidence: Gemini runs with `tools: [{ google_search: {} }]` (`ai-enrichment.service.ts:61`), so web content flows into the model. The model's `photo_url` / `wikipedia_url` / `website` values are saved verbatim (`person-enrichment.strategy.ts:61-76`, `party-enrichment.strategy.ts:46-55`; `asString` only trims). Admin DTOs accept them as plain `@IsString()` with no `@IsUrl` or length limit (`admin-input.dto.ts:81-87,150-151,178-180`).
- Failure scenario: a poisoned web page, or a compromised editor account, gets `javascript:alert(document.cookie)` stored as `wikipedia_url`. If any SPA renders it as `<a href>`, it becomes stored XSS in the public or admin app, where the admin JWT is reachable from JS.
- Fix: validate `@IsUrl({ protocols: ['https','http'], require_protocol: true })` plus `@MaxLength(2048)` in the DTOs, and the same check in the AI parsers (drop non-http(s) values). Treat model output as untrusted. The model id is also hard-coded as `gemini-2.0-flash` (`ai-enrichment.service.ts:21`). Make it `GEMINI_MODEL`, and check the model is still served (Google retires Flash generations; a retired id returns 404 on every enrichment).

**S-M3 — The 5 MB JSON body limit applies to every route, including unauthenticated ones.**
- Evidence: `main.ts:19` `app.useBodyParser('json', { limit: '5mb' })`.
- Failure scenario: anonymous clients POST 5 MB bodies to `/auth/login` (or any route). Parsing (roughly 10× in memory) happens before validation or the throttle guard, on a 512 MB / 0.1 CPU instance, so a few parallel requests cause GC stalls or OOM.
- Fix: keep the default 100 kb globally, and apply a 5 MB `express.json` only to `POST /api/v1/admin/results/override-bulk` (route-level middleware).

### Low

**S-L1 — JWT hardening.**
- Evidence: `auth.module.ts:17-18`. HS256 by default, 24 h expiry, no `issuer`/`audience`, no refresh or revocation, no minimum secret length (any non-empty `JWT_SECRET` is accepted). Changing a password (`user.service.ts:37-38`) doesn't invalidate existing tokens.
- Failure scenario: a leaked admin token stays valid for up to 24 h even after the password is reset.
- Fix: check at startup that `JWT_SECRET` is at least 32 bytes. Pin `algorithms: ['HS256']` in `JwtStrategy`, and add `issuer` / `audience`. Add a `token_version` column that `validate()` checks (it already loads the user, `jwt.strategy.ts:20-23`), and bump it on password or role change. Consider a 1–2 h access token with a refresh token.

**S-L2 — PII in logs; untrusted request id.**
- Evidence: `auth.service.ts:30,34,38,53` log emails on every login or failure. `logging.middleware.ts:23` and `http-exception.filter.ts:30` echo a client-supplied `X-Request-ID` of any length.
- Failure scenario: logs shipped to a third-party backend contain user emails. A client can flood logs with 8 KB request ids.
- Fix: log a user id or a hashed email. Accept an incoming request id only if it matches `^[\w-]{1,64}$`, otherwise generate one.

**S-L3 — CORS parsing.**
- Evidence: `main.ts:23-32` splits `CORS_ORIGINS` on `,` without trimming, uses `credentials: true` although auth is a Bearer header (no cookies), and has no way to allow Vercel preview URLs.
- Failure scenario: `CORS_ORIGINS="https://a.vercel.app, https://b.vercel.app"` (with a space) silently blocks the admin app.
- Fix: `.split(',').map(s => s.trim()).filter(Boolean)`, drop `credentials`, and optionally add an allow-list regex for `^https://election-tracker-[a-z0-9-]+\.vercel\.app$`.

**S-L4 — Untyped object bodies skip validation.**
- Evidence: `admin-constituencies.controller.ts:68` (`Record<string, unknown>`) and `admin-elections.controller.ts:45` (`body: object`). `ValidationPipe` doesn't validate `Object` metatypes, so `whitelist`/`forbidNonWhitelisted` don't apply. The metadata is merged verbatim (`constituencies.service.ts:96-102`).
- Failure scenario: an editor writes arbitrary or huge keys into `constituencies.metadata` (up to the 5 MB limit), which the public API then serves.
- Fix: use a small DTO (`tags`, known keys) or at least a size or key-count check.

---

## 3. Scale & performance

### High

**P-H1 — Cross-region database (Render Singapore ↔ Neon us-east-2) multiplies per-request latency.** See the deployment section for the round-trip math. Prisma issues one query per `include` level (no `relationJoins`), so:
- `GET /elections/:id/constituencies/:constId` (`results.service.ts:139-156`) makes about 6 sequential queries, so ~1.2–1.5 s of network wait.
- Every admin request adds one DB round trip for the JWT user lookup (`jwt.strategy.ts:21`).
- A single override (`result-override.service.ts:23-67`) makes about 7 round trips, so ~1.5 s.

Failure scenario: the dashboard feels slow on every uncached call, and the admin live-override loop during counting lags seconds behind. Fix: put Neon in **AWS ap-southeast-1 (Singapore)**, next to Render and Upstash. That is the single largest improvement. Also cache the JWT user briefly (e.g. an in-process LRU for 30 s).

### Medium

**P-M1 — HTTP caching defeated; Redis used as a bulk blob cache.**
- Evidence: `main.ts:34` enables strong ETags, but `transform.interceptor.ts:35,58-62` adds a fresh `requestId` and `timestamp` to every body, so the ETag changes on every response and a 304 never happens. No route sets `Cache-Control`. `results.service.ts:69-106` caches the entire election result set (LS 2024: every candidate row, ~8k rows, roughly 1 MB JSON) in Redis and reads and `JSON.parse`s it on every hit.
- Failure scenario on results day:
  - Each page load pulls about 1 MB from Upstash, which eats the free plan's bandwidth and command quota (verify current limits).
  - Each page load also spends tens of ms of `JSON.parse` + `stringify` + gzip on a 0.1-CPU Render instance.
  - Browsers re-download the full payload every time.
- Fix:
  - Move `requestId`/`timestamp` to headers only (they are already set as `X-Request-ID`).
  - Add `Cache-Control: public, max-age=15, stale-while-revalidate=60` on public election GETs (longer for finalized elections).
  - Keep a small in-process LRU of the serialized, and ideally pre-gzipped, payload keyed by election id and invalidated by the existing purge path. On a single instance this removes most Redis traffic.

**P-M2 — Sequential per-row writes on the request path.**
- Evidence: `persons.service.ts:214-270` (`autoLink`) loads every non-NOTA candidate of every election (tens of thousands of rows), then awaits one `updateMany` or transaction per group, sequentially. `constituencies.service.ts:105-119` (`bulkTag`) issues one `UPDATE` per id (up to 5,000) inside a batch transaction. `computeAnalysis` (`:189-295`) loads all results and candidates of up to 51 elections into memory synchronously.
- Failure scenario: at ~220 ms per round trip, `autoLink` with a few thousand groups runs for 10+ minutes inside an HTTP request. Proxies or clients time out, and the admin retries, creating concurrent runs and duplicate `persons`. `bulkTag` with 5,000 ids holds one connection for 5,000 statements.
- Fix: do set-based SQL (`UPDATE … FROM UNNEST(...)`, as `bulk-override.service.ts:76-91` already does, or `jsonb_set` for tags). Run long jobs as background jobs with a lock and a status endpoint.

### Low

**P-L1 — Missing indexes (small tables today).**
- No index on `candidates(party_id)`: used by `parties.service.ts:49-64` (`candidates: { some }` + `_count`).
- No index on `constituencies(district_id)`: used by `results.service.ts:108-123` and `search.service.ts:13`.
- No index on `audit_logs(user_id)`: filter at `audit-log.service.ts:11` and the `ON DELETE SET NULL` scan.
- `contains`/`insensitive` searches (`candidates.service.ts:69`, `search.service.ts:11,25`, `persons.service.ts:137,174`) become `ILIKE '%q%'` sequential scans.
- Failure scenario: none now (≤ ~50k rows), but the cost grows with every seeded election.
- Fix: add an idempotent migration `013` with those three indexes (plus `@@index` entries in Prisma), and optionally `pg_trgm` GIN indexes on `name`.

**P-L2 — Prisma logging and pool defaults.**
- Evidence: `prisma.service.ts:10-15` always enables `emit: 'event'` query logging, even in production where no listener is attached. That listener is also dead in dev: Winston's default level is `info`, so `logger.debug` is dropped. The pool size defaults to `num_cpus*2+1`, and `os.cpus()` on shared hosts reports host cores.
- Failure scenario: per-query event overhead, and 17+ connections opened from one small instance.
- Fix: enable `query` events only when `LOG_LEVEL=debug`, and set `connection_limit` explicitly in the URL (see the deployment section).

**P-L3 — Heavy admin reads.**
- Evidence: `admin-persons.controller.ts:33` allows `limit` up to 2000, with nested `candidates` + `elections` includes per person (`persons.service.ts:144-158`). `results.service.ts:185-240` (`getLiveResults`) is uncached and returns every candidate of every constituency.
- Failure scenario: multi-MB responses with 3–4 sequential queries each, on a small, far-away DB.
- Fix: cap at 200, and cache or trim fields for the live-results console.

**P-L4 — Horizontal scaling caveats.** SSE fan-out works across instances, since each instance subscribes to Redis (`redis.service.ts:108-137`). What doesn't carry across instances:
- throttler storage, which is in memory
- enrichment progress (`ai-enrichment.service.ts:26`)
- the job lock (none exists)

Render free is single-instance, so this is only a note for later: use `@nest-lab/throttler-storage-redis` and keep progress in Redis when scaling out.

---

## 4. Error handling

### High

**E-H1 — A Redis outage takes the public API down; startup depends on Redis.**
- Evidence: `results.service.ts:15,40,71` and `constituencies.service.ts:165` `await this.redis.get()` with no try/catch, and `set` likewise (`:34,65,104,173`). `redis.service.ts:25-26` uses ioredis defaults: `enableOfflineQueue: true`, `maxRetriesPerRequest: 20` (confirmed in `ioredis/built/redis/RedisOptions.js:43,52`). `onModuleInit` awaits `connect()` (`:34-38`).
- Failure scenario: an Upstash blip or quota exhaustion makes every cached endpoint hang through about 20 reconnect attempts and then return 500, even though Postgres is healthy. An unreachable Redis at boot (for example, the wrong URL) crashes startup, and Render loops restarting.
- Fix: in `CacheService`, wrap get/set in try/catch and fall back to the loader. Configure `maxRetriesPerRequest: 1`, `enableOfflineQueue: false` on the command connection, `connectTimeout: 5000`, `commandTimeout: 1000`. Don't block boot on Redis: log and continue, and let `/health/ready` report it.

**E-H2 — The global filter never logs unexpected errors.**
- Evidence: `common/filters/http-exception.filter.ts:13-63` converts every non-`HttpException` into a generic 500 without logging the exception or stack. Nest's default logging is bypassed because the filter is `@Catch()`-all.
- Failure scenario: a production 500 (Prisma error, a bug) leaves only an `HTTP … 500` access-log line. Root cause can't be found, and OTel spans record the status but not the exception.
- Fix: for `status >= 500`, call `logger.error(message, { requestId, path, stack })` and `trace.getActiveSpan()?.recordException(exception)`.

**E-H3 — Graceful shutdown is broken.**
- Evidence: `tracing.ts:42-47` registers `process.on('SIGTERM')` which calls `process.exit(0)` once the OTel SDK flushes. `main.ts` never calls `app.enableShutdownHooks()`, so `PrismaService.onModuleDestroy` / `RedisService.onModuleDestroy` never run. `bootstrap()` (`main.ts:55`) has no `.catch`.
- Failure scenario: Render sends SIGTERM on every deploy and spin-down.
  - In-flight requests are cut mid-response.
  - A bulk override interactive transaction is killed (it rolls back, but the client sees a reset and may double-apply on retry).
  - SSE clients get a TCP reset instead of a clean end.
  - Running enrichment jobs die silently.
- Fix: call `app.enableShutdownHooks()`. Remove `process.exit` from `tracing.ts` and shut the SDK down in an `OnApplicationShutdown` hook. Complete SSE subjects before closing Redis. Wrap bootstrap with `.catch(err => { logger.error(err); process.exit(1); })`.

**E-H4 — The audit write inside the override transaction uses a different connection.**
- Evidence: `result-override.service.ts:33-67` opens `prisma.$transaction(async (tx) => …)` but calls `this.audit.create(...)` (`:55-63`), which uses the global `this.prisma` (`audit-log.service.ts:32-43`), not `tx`.
- Failure scenario:
  1. The audit row is not atomic with the result update: a later failure rolls back the update but keeps the audit row, or the reverse.
  2. With a small pool (`connection_limit=1–2`, common with Neon's pooler), the transaction holds the only connection while `audit.create` waits for another. It waits `pool_timeout` (10 s) and exceeds the 5 s interactive-transaction timeout, so every single-result override fails with P2024 or P2028.
- Fix: pass `tx` into the audit write (`AuditLogService.create(data, tx = this.prisma)`), as `bulk-override.service.ts:108` already does.

### Medium

**E-M1 — Prisma and input errors surface as 500.**
- Evidence: no mapping of `PrismaClientKnownRequestError` in the filter, so all of these return 500 "Internal server error":
  - P2002 duplicate (`parties.service.ts:80-84` create with an existing id; `user.service.ts:21` duplicate email)
  - P2003 FK violation (`candidates.service.ts:84-88` with an unknown `party_id`)
  - P2025 not found
  - P2023 malformed UUID
  - `PrismaClientValidationError`
- Failure scenario: the admin UI shows "Internal server error" for a duplicate email instead of "email already exists". Public probing with `?election_id=abc` produces 500s that hide real faults in alerting.
- Fix: map P2002 → 409, P2025 → 404, P2003 / P2023 / validation → 400 in the filter (or a Prisma exception filter). Validate inputs up front (see E-M2).

**E-M2 — No query DTOs on public and admin list endpoints.**
- Evidence:
  - `constituencies.controller.ts:12`, `candidates.controller.ts:17-18,25`, `search.controller.ts:10-22`, `elections.controller.ts:19-29` (`type`/`status` passed as `any` to Prisma enums, `elections.service.ts:11-17`)
  - `parties.controller.ts:13-25` (`+page`, `+limit` with no upper bound)
  - `admin-constituencies.controller.ts:39-47`, `admin-persons.controller.ts:23-35`
  - `admin-audit-logs.controller.ts:15-19` (`new Date('garbage')`)
- Failure scenario: `?page=0` gives `skip=-100` (Prisma error, 500). `?page=abc` gives NaN (500). `?type=XYZ` fails enum validation (500). `?limit=100000` on `/parties` makes the public endpoint return the whole table.
- Fix: add query DTO classes (`@IsUUID()`, `@IsInt() @Min(1) @Max(200)`, `@IsEnum(election_type)`, `@IsISO8601()`), relying on the existing global `ValidationPipe({ transform: true })`.

**E-H5 — Background enrichment jobs are fragile (High for the Render plan).**
- Evidence: `ai-enrichment.service.ts:126-127,142-143,154-155` fire and forget the job in the web process. Progress lives in a process-local `Map` (`:26`). There is no guard against concurrent runs for the same election. Gemini calls run 5 at a time with up to 4 × 30 s timeouts each (`:47-86`).
- Failure scenario:
  - Enriching 543 LS seats takes about 15–30 min. A redeploy or Render spin-down (Render counts inbound requests; an open stream isn't guaranteed to count) kills it midway, with no resume and progress reset to zeros.
  - Double-clicking "Enrich" starts two jobs, which doubles Gemini cost and races the `metadata.tags` read-modify-write (`constituency-enrichment.strategy.ts:110-117`).
- Fix: keep a per-key lock in Redis (`SET NX EX`) and progress in Redis. Make jobs resumable using `constituency_analysis.ai_status` / `persons.metadata.ai_profile` (the person strategy already skips done rows). Longer term, run them in the scraper or a worker instead of the web dyno.

### Low

**E-L1 — Gemini retry policy.** In `ai-enrichment.service.ts:67-86`, timeouts are retried immediately with no backoff, and 5xx responses aren't retried (only 429 is). There is no circuit breaker, so a Gemini outage costs every item up to 4 × 30 s before failing. Fix: exponential backoff with jitter for 429, 5xx and timeout, and a breaker that aborts the job after N consecutive failures.

---

## 5. Logging & observability

### Medium

**O-M1 — No correlation in application logs.** `getRequestId()` (`common/logger/request-context.ts:10`) is never called, and the Winston format (`winston.config.ts:4-23`) doesn't add `requestId` or the OTel `trace_id`. Only the access line carries `requestId` (`logging.middleware.ts:33-36`). There is also no `LOG_LEVEL`, so Winston's default `info` silently drops every `logger.debug`, and `main.ts:52` / `tracing.ts:40,45-46` use `console.*`. Failure scenario: you can't join an error log to its request or trace in production. Fix: add a Winston format that injects `requestContext.getStore()?.requestId` and `trace.getActiveSpan()?.spanContext().traceId`, set `level: process.env.LOG_LEVEL ?? (prod ? 'info' : 'debug')`, and route startup messages through the Nest logger.

**O-M2 — `/health` is not a usable probe.**
- Evidence: `health/health.controller.ts:14-44` always returns HTTP 200 even when `status: 'degraded'`, returns raw DB/Redis error messages to anonymous callers (`:24,33`), is throttled (S-C1), and runs a DB query on every probe.
- Failure scenario:
  - Render's health check never sees the DB as down.
  - Error text such as hostnames or TLS details leaks publicly.
  - An external keep-awake pinger hitting `/health` keeps Neon compute from suspending, which burns the free compute-hour allowance.
- Fix: split into `GET /health/live` (no I/O, always 200, `@SkipThrottle`) for the platform check, and `GET /health/ready` (DB + Redis with a 2 s timeout, 503 when degraded, error text only in logs).

**O-M3 — SSE reconnect semantics.**
- Evidence: `live.service.ts:16,22-25` sends a heartbeat every 30 s. Its `data: ''` means Nest writes only `event:`/`id:` lines (`@nestjs/core/router/sse-stream.js:55-62`). No `retry:` field is sent. `Last-Event-ID` is ignored (ids are per-connection counters), and there is no cap on concurrent SSE connections.
- Failure scenario: after a spin-down or deploy, clients reconnect (the browser defaults to ~3 s) and silently miss every `result-update` published in the gap. Proxies with ~60–100 s idle timeouts are borderline if a heartbeat is delayed.
- Fix: a heartbeat of 20 s, `retry: 5000` on the first event, and on reconnect the client re-fetches a snapshot (the frontend reportedly already refreshes on reconnect, so keep that contract documented). Optionally keep a per-election sequence number in Redis so clients can detect gaps.

**O-M4 — OTel always on, exporting to `localhost:4317`.**
- Evidence: `tracing.ts:12-39`. The gRPC exporters and the full auto-instrumentation set load unconditionally.
- Failure scenario on Render (no collector): every 15 s metric export and every span batch fails. This is silent (no diag logger), but adds CPU, memory (roughly 40–80 MB for auto-instrumentations) and cold-start time, and ships the vulnerable grpc/protobufjs chain (S-H1).
- Fix: skip SDK start unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set, or set `OTEL_SDK_DISABLED=true` (supported by this `sdk-node`: `sdk.js:103`). If you want telemetry on a free tier, export OTLP/HTTP directly to a hosted backend using `OTEL_EXPORTER_OTLP_HEADERS`, and limit instrumentations to http, express, pg/prisma and ioredis.

---

## 6. Deployment readiness — Render (SG) / Neon (us-east-2) / Upstash (ap-southeast-1) / Vercel

### What the repo actually contains

- `backend/`: NestJS API (the only server to deploy).
- `frontend/`: React/Vite public SPA.
- `admin/`: React/Vite admin SPA.
- `scraper/`: seed generators and live-count simulation. This is a dev tool, not a service to deploy.
- `database/`: SQL schema, migrations, seeds and `setup.sh`.

The repo has **no BullMQ** (or any queue library), **no S3 / AWS SDK**, no multer or file-upload endpoints, and **no "Student" or "Landing" apps**. The only "landing" grep hits are UI components (`admin/src/components/common/AdminLandingCard.tsx`, `frontend/src/pages/Home.tsx`). Plan items for queues, S3 and extra frontends don't apply to this codebase.

### Latency estimate (Render SG ↔ Neon us-east-2)

Singapore ↔ Ohio RTT is roughly 200–250 ms (verify with `SELECT 1` timings from `/health`). Prisma runs includes as separate sequential queries:

| Request | DB round trips (from code) | Network wait |
|---|---|---|
| `GET /elections/:id` (cold cache) | findOne+states (2) + summary `$queryRaw` (1) | ~0.7 s |
| `GET /elections/:id/results` (cache miss) | results + candidates + constituencies (3) | ~0.7 s plus transfer |
| `GET /elections/:id/constituencies/:constId` | ~6 | ~1.3 s |
| Any admin request | +1 (JWT user lookup) | +0.22 s |
| `PATCH /admin/results/override` | find+include (2), BEGIN, update, [update], audit, COMMIT | ~1.5 s |
| Cold start after spin-down | Render wake 30–60 s + Neon wake (~0.5–few s) + TLS/connect (several RTT) | first request takes about a minute |

With Neon in **ap-southeast-1**, each round trip drops to about 1–3 ms and all of the above become sub-100 ms. This is the recommended change.

### Must fix before deploy (blockers)

1. **Redis config can't reach Upstash** (`redis.service.ts:23-26` reads only `REDIS_HOST`/`REDIS_PORT`, with no password, TLS or URL), and boot awaits the connection. Change it to:
   ```ts
   const url = config.getOrThrow<string>('REDIS_URL'); // rediss://default:<token>@<db>.upstash.io:6379
   const opts = { lazyConnect: true, keepAlive: 10_000, connectTimeout: 5_000, maxRetriesPerRequest: 1 };
   this.pub = new Redis(url, { ...opts, enableOfflineQueue: false, commandTimeout: 1_000 });
   this.sub = new Redis(url, opts); // autoResubscribe (default true) restores SUBSCRIBE after reconnects
   ```
   `rediss://` enables TLS in ioredis. Upstash supports SUBSCRIBE over TCP/TLS with ioredis. The subscriber holds one persistent connection, and each published message counts against the plan's command and bandwidth quotas (check current free-tier limits). Add `REDIS_URL` to `.env.example` and keep `REDIS_HOST`/`REDIS_PORT` as the local fallback.
2. **`trust proxy` and throttling** (S-C1): `app.set('trust proxy', 1)` (verify `req.ip`), `@SkipThrottle()` on `LiveController` and `HealthController`, and separate public and auth throttlers.
3. **Build and start commands.** `prisma` and `@nestjs/cli` are devDependencies, and there is no `postinstall` running `prisma generate` (`package.json:10-12,45-58`). With `NODE_ENV=production` set at build time, `npm ci` skips them and the build fails.
   - Root directory: `backend`
   - Build: `npm ci --include=dev && npx prisma generate && npm run build`
   - Start: `node dist/main`
   - Add `"engines": { "node": "20.x" }` (or 22.x) to pin the runtime.
4. **Redis-down resilience and graceful shutdown** (E-H1, E-H3). Without them, every Upstash blip or Render SIGTERM becomes user-visible 500s or resets.
5. **Audit write in `tx`** (E-H4). Otherwise the single-override endpoint fails under a small Neon pool.
6. **Disable OTel** unless a collector exists: `OTEL_SDK_DISABLED=true` (O-M4).
7. **Health check**: point Render at a no-I/O liveness route (O-M2). Until one exists, use `/api/v1/health`, which returns 200 even when degraded.
8. **Database connection strings (Neon).** Use the pooled URL for the app and the direct URL for DDL and seeding:
   ```
   # Render env (app, via PgBouncer pooler)
   DATABASE_URL=postgresql://<user>:<pw>@ep-<id>-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=5&pool_timeout=20&connect_timeout=15
   # Used only for setup.sh / prisma migrate diff (direct, non-pooler host)
   DIRECT_URL=postgresql://<user>:<pw>@ep-<id>.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")
   }
   ```
   - `pgbouncer=true` keeps Prisma safe in transaction-pooling mode.
   - `connect_timeout=15` absorbs Neon's wake from auto-suspend.
   - `connection_limit=5` stops Prisma from sizing the pool from the host's CPU count. It must be above 1 until E-H4 is fixed.
   - Interactive transactions (`bulk-override.service.ts:72-124`, 60 s timeout) work through the transaction-mode pooler.
9. **Running `database/setup.sh` against Neon.** Run it once from a laptop or CI with the **direct** URL:
   `DATABASE_URL="$DIRECT_URL" database/setup.sh`
   - Don't pass the Prisma pooled URL. `setup.sh` strips only `schema=` (`setup.sh:42`), so libpq rejects `pgbouncer=` / `connection_limit=` as invalid URI parameters.
   - The script also sets `PGOPTIONS` (`-c standard_conforming_strings=on`, `setup.sh:38`), which is sent as a startup `options` parameter that PgBouncer poolers generally reject.
   - Seeds use multi-row `INSERT … VALUES` (e.g. `seed.sql`: 34 INSERT statements over 7.4k lines), so a full seed is a few hundred statements and finishes in about a minute even cross-region.
   - Afterwards run `cd backend && DATABASE_URL="$DIRECT_URL" npm run create-admin`.
10. **CORS and API base URL.**
    - Render: `CORS_ORIGINS=https://<frontend>.vercel.app,https://<admin>.vercel.app`, exact origins with no spaces and no trailing slash. The code doesn't trim (S-L3). Add custom domains when you have them.
    - Vercel (both projects, build-time): `VITE_API_BASE_URL=https://<service>.onrender.com/api/v1` (used by `frontend/src/model/api/api-client.ts:1` and `admin/src/services/api-client.ts:3`).
    - Both SPAs need an SPA rewrite (`vercel.json`: `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`).
    - Note outside the backend: the admin dev proxy for `/symbols` → frontend (`admin/vite.config.ts:8-10`) doesn't exist on Vercel.

### Render environment (complete list)

```
NODE_ENV=production
# PORT is injected by Render; main.ts:50 already reads it
JWT_SECRET=<openssl rand -hex 32>
DATABASE_URL=<Neon pooled URL above>
DIRECT_URL=<Neon direct URL above>        # only if schema.prisma gets directUrl
REDIS_URL=rediss://default:<token>@<db>.upstash.io:6379   # after the code change
CORS_ORIGINS=https://<frontend>.vercel.app,https://<admin>.vercel.app
GEMINI_API_KEY=<key restricted to the Generative Language API>
OTEL_SDK_DISABLED=true
NODE_OPTIONS=--max-old-space-size=384
```

### Platform notes and nice-to-haves

- **Memory (512 MB).** Estimated baseline: Node + Nest ~100 MB, Prisma engine ~30–60 MB, OTel auto-instrumentations ~40–80 MB (0 if disabled), so roughly 150–250 MB. A 5 MB bulk-override body inflates to about 50 MB transiently. It fits with OTel disabled and a scoped body limit (S-M3). Cap the heap at 384 MB so the process hits a clean OOM before the container is killed.
- **CPU (0.1 on the free plan).** Synchronous `JSON.parse`/`stringify` of the ~1 MB results payload per request is noticeable. The in-process cache plus HTTP caching (P-M1) helps.
- **SSE on Render free.**
  - Spin-down after ~15 min without inbound requests drops every stream. Clients reconnect, which wakes the service (30–60 s).
  - Use a 20 s heartbeat and a `retry: 5000` field (O-M3).
  - Don't rely on SSE to keep the instance awake. An external pinger to `/health/live` (not the DB-touching route) keeps Render warm without waking Neon.
  - Free-tier monthly instance hours also limit always-on use (verify current allowance).
- **Neon free.** Compute auto-suspends after ~5 min idle (not configurable on free). The first query after that takes ~0.5–few s, and existing pooled connections may be dropped, so the first request after idle can fail once (P1017). Keep `connect_timeout=15`, and optionally retry once on P1017/P1001 in a Prisma extension. Storage: ~5.2 MB of seed SQL loads to an estimated 30–60 MB with indexes, about 10% of the 512 MB cap. `audit_logs` grows by one row per override call, so it's negligible.
- **Upstash free.** Region ap-southeast-1 matches Render SG (good). Main consumers: one GET per cached public request, plus about 1 MB payload reads (P-M1), plus a SCAN+DEL per override (`redis.service.ts:70-77`), plus pub/sub messages. Command and bandwidth caps apply (check current numbers). The in-process cache recommendation removes most of this.
- **Gemini.** Key only in the Render env (already sent as a header, not in the URL). Make the model configurable (S-M2). Search grounding has its own quotas and pricing. Long enrichment runs are unsafe on a spin-down instance (E-H5), so run them from a laptop or CI via the scraper against the API, or keep the admin tab active.
- **Observability on free tiers.** SigNoz needs a collector or SigNoz Cloud (not free). Either disable OTel, or export OTLP/HTTP directly to a hosted backend with a free tier. Render's log stream will carry the Winston JSON (`NODE_ENV=production`).

---

## Appendix — severity index

| ID | Severity | Title |
|---|---|---|
| S-C1 | Critical | No `trust proxy`, so the throttler is effectively global (login lockout, SSE 429) |
| DEP-1 (§6.1) | Critical | Redis client can't connect to Upstash (no URL/TLS/password) and boot awaits it |
| E-H1 | High | Redis outage makes the API hang or return 500 |
| E-H2 | High | 500s are never logged |
| E-H3 | High | SIGTERM → `process.exit(0)`, no shutdown hooks |
| E-H4 | High | Override audit write outside `tx` (non-atomic, pool deadlock) |
| P-H1 | High | Cross-region DB, ~6–7 sequential round trips per detail or override request |
| S-H1 | High | Critical/high dependency advisories (protobufjs, grpc-js, platform-express, OTel) |
| DEP-3 (§6.3) | High | Build needs devDeps plus `prisma generate` |
| E-H5 | High | Enrichment jobs: no lock, in-memory progress, killed on spin-down |
| D-M1, D-M2 | Medium | God AI service; duplicated SSE, cache and post-commit code |
| S-M1, S-M2, S-M3 | Medium | Fail-open roles plus open registration; unvalidated URLs (AI/XSS); global 5 MB body limit |
| P-M1, P-M2 | Medium | ETag defeated, no Cache-Control, 1 MB Redis blobs; sequential per-row writes |
| E-M1, E-M2 | Medium | Prisma errors → 500; no query DTOs |
| O-M1, O-M2, O-M3, O-M4 | Medium | No log correlation; `/health` always 200 and leaks errors; SSE reconnect gaps; OTel always on |
| D-L1, S-L1–S-L4, P-L1–P-L4, E-L1 | Low | Inverted DTO deps/manifest parsing; JWT hardening; PII logs; CORS trim; untyped bodies; indexes; Prisma logging and pool; heavy admin reads; scale-out state; Gemini retry |

Counting: Critical 2 (S-C1, DEP-1) · High 8 (E-H1–E-H5, P-H1, S-H1, DEP-3) · Medium 13 (D-M1, D-M2, S-M1–S-M3, P-M1, P-M2, E-M1, E-M2, O-M1–O-M4) · Low 11 (D-L1, S-L1–S-L4, P-L1–P-L4, E-L1, plus the Node `engines` pin in §6.3).
