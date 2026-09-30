# Deployment plan

Status: **draft — not deployable yet.** The backend blockers in [§4](#4-blockers-before-first-deploy) must be fixed first, and the open decisions in [§6](#6-open-decisions) must be made. Source review: [`docs/reviews/2026-09-30-backend-review.md`](reviews/2026-09-30-backend-review.md).

Target cost: **$0/month** (all free tiers).

## 1. What gets deployed

| Piece | Repo path | Host | Notes |
|---|---|---|---|
| Public dashboard | `frontend/` | Vercel (project 1) | Static Vite build, SPA rewrite |
| Admin panel | `admin/` | Vercel (project 2) | Static Vite build, SPA rewrite |
| API | `backend/` | Render free web service, **Singapore** | NestJS, single instance |
| Postgres | `database/` | Neon free | Region: see decision D1 (recommended **ap-southeast-1 Singapore**) |
| Redis | — | Upstash free, **ap-southeast-1** | Response cache + pub/sub for live updates (SSE) |

Not deployed: `scraper/` (seed generators and the live-count simulation; run locally or in CI against the API). The earlier plan's BullMQ queues, S3, and "Landing"/"Student" frontends belong to another app — none exist here.

### What Redis is used for

- **Cache:** results / constituency lists, 5–10 min TTL (`results.service.ts`, `constituencies.service.ts`).
- **Pub/sub:** admin overrides and AI-enrichment progress are published and fanned out to SSE clients (`live.service.ts`, `ai-enrichment.service.ts`).
- Nothing needs persistence: the cache refills itself and live messages only matter to connected viewers. On a single instance Redis is optional; it becomes required for pub/sub once there is more than one backend instance.

## 2. Architecture

```
Browser (India) ──► Vercel CDN (frontend / admin static files)
      │
      └── API + SSE ──► Render web service (Singapore)
                          ├── Neon Postgres (pooled URL)       ← same region (D1)
                          └── Upstash Redis (rediss://, TLS)   ← ap-southeast-1
```

Keep the API, database and Redis in the **same region**: every uncached request makes several sequential DB round trips. Render Singapore ↔ Neon us-east-2 adds ~200–250 ms per round trip (a constituency page ≈ 1.3 s, a single override ≈ 1.5 s); with Neon in Singapore it is ~1–3 ms.

## 3. Free-tier limits to plan around

| Service | Limit | Effect on this app |
|---|---|---|
| Render free | Spins down after ~15 min without inbound requests; cold start 30–60 s; 512 MB RAM, 0.1 CPU; monthly instance-hour cap | Live (SSE) streams drop on spin-down and reconnect on wake; first visitor after idle waits ~1 min. Long AI-enrichment jobs can be killed mid-run. |
| Neon free | 512 MB storage; compute auto-suspends after ~5 min idle; monthly compute-hour cap | First query after idle takes ~0.5–few s; a pooled connection may be dropped once (retry). Seed data ≈ 30–60 MB, fits. |
| Upstash free | 256 MB; monthly command and bandwidth caps (500K commands/month at the time of writing) | Every cache read, publish and delivered message counts. A busy counting day can hit the cap — see decision D6. |
| Vercel hobby | Non-commercial use; bandwidth caps | Fine for static SPAs. |

Verify current limits on each provider's pricing page before launch.

## 4. Blockers before first deploy

From the backend review (IDs refer to it). All are code/config changes in `backend/` unless noted.

| # | Blocker | Review ID | Fix |
|---|---|---|---|
| B1 | Rate limiter sees Render's proxy IP → one bucket for the whole site (5 bad logins lock out every admin; a 429 kills a viewer's live updates) | S-C1 | `app.set('trust proxy', 1)` (verify `req.ip`); `@SkipThrottle()` on live + health; separate public (generous) and auth (strict) limits |
| B2 | Redis client only reads host/port — cannot reach Upstash (needs password + TLS) and boot waits for it | DEP-1 | `REDIS_URL` (`rediss://…`) with timeouts; keep host/port as local fallback |
| B3 | Redis outage = API outage (no fallback to DB; ioredis retries ~20× then 500) | E-H1 | Cache wrapper with try/catch → load from DB; `maxRetriesPerRequest: 1`, no offline queue, command timeout; don't block boot on Redis |
| B4 | No graceful shutdown (`process.exit` in tracing on SIGTERM; shutdown hooks off) | E-H3 | `enableShutdownHooks()`, remove `process.exit`, close SSE → Redis → Prisma, bootstrap `.catch` |
| B5 | Single override writes its audit row outside the transaction — not atomic, and deadlocks with a small Neon pool | E-H4 | Pass `tx` to the audit write |
| B6 | 500s never logged; Prisma errors all become 500 | E-H2, E-M1 | Log 500s with stack + request id; map P2002→409, P2025→404, P2003/P2023/validation→400 |
| B7 | OTel always exports to `localhost:4317`; its gRPC chain carries a critical advisory | O-M4, S-H1 | Start OTel only when an endpoint is configured (`OTEL_SDK_DISABLED=true` in prod); `npm audit fix`; move to OTLP/HTTP if kept |
| B8 | `/health` returns 200 when degraded, leaks error text, is throttled, hits the DB | O-M2 | `/health/live` (no I/O) for Render; `/health/ready` (DB + Redis, 503 when down) |
| B9 | Build needs devDeps + `prisma generate`; Node version unpinned | DEP-3 | Build command below; `"engines": { "node": "20.x" }` |
| B10 | Neon needs pooled vs direct URLs; `setup.sh` can't take the pooled Prisma URL | §6 | `directUrl` in `schema.prisma`; run `setup.sh` with the direct URL |
| B11 | CORS origins not trimmed | S-L3 | Trim/filter the list; exact Vercel origins |

Recommended alongside (not strictly blocking): 5 MB body limit only on the bulk-override route (S-M3), query DTOs on list endpoints (E-M2), SSE heartbeat 20 s + `retry:` (O-M3), stop public self-registration (S-M1), `Cache-Control` + drop per-response `requestId`/`timestamp` from bodies so ETags work (P-M1).

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
- Health check path: `/api/v1/health/live` (after B8)
- Environment:
  ```
  NODE_ENV=production
  JWT_SECRET=<openssl rand -hex 32>
  DATABASE_URL=<Neon pooled URL>
  DIRECT_URL=<Neon direct URL>
  REDIS_URL=<Upstash rediss:// URL>
  CORS_ORIGINS=https://<frontend>.vercel.app,https://<admin>.vercel.app
  GEMINI_API_KEY=<key restricted to the Generative Language API>
  OTEL_SDK_DISABLED=true
  NODE_OPTIONS=--max-old-space-size=384
  ```
  (`PORT` is injected by Render.)

### 5.4 Vercel (two projects)

| | Public dashboard | Admin |
|---|---|---|
| Root directory | `frontend` | `admin` |
| Build | `npm run build` | `npm run build` |
| Output | `dist` | `dist` |
| Env (build time) | `VITE_API_BASE_URL=https://<service>.onrender.com/api/v1` | same |

Both need an SPA rewrite (`vercel.json`): `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`. The admin dev proxy for `/symbols` (`admin/vite.config.ts`) does not exist on Vercel — serve party symbols from the frontend's public URL or copy them into the admin build.

### 5.5 Smoke test

1. `GET /api/v1/health/ready` → 200 with DB + Redis ok.
2. Open the dashboard → Bihar 2025 loads; map, scoreboard, summary render.
3. Admin login → apply one override → the dashboard updates live (SSE) without reload.
4. Wait > 15 min idle → reload: cold start works; live stream reconnects.

## 6. Open decisions

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Neon region | Singapore `ap-southeast-1` / us-east-2 (as in the original plan) | **Singapore** — same region as Render and Upstash; removes ~200 ms per query |
| D2 | Render spin-down on counting days | Free + accept cold starts / Free + external pinger on `/health/live` every 10 min / **Starter ($7/mo)** during counting | Free for demo; Starter (or pinger) for live counting days |
| D3 | Custom domains | Vercel/Render default domains / own domain (e.g. `results.<domain>`, `admin.<domain>`, `api.<domain>`) | Decide before launch — CORS origins and the API base URL depend on it |
| D4 | Observability | Off (Render logs only) / OTLP/HTTP to a hosted backend with a free tier / SigNoz Cloud (paid) | Off at launch; revisit |
| D5 | Public self-registration (`/auth/register`) | Keep / disable / behind a flag | Disable (no product use; attack surface) |
| D6 | Upstash quota on counting day | Rely on Upstash cache / add an in-process cache in front of Redis (single instance) | Add the in-process cache (removes most Redis reads) |
| D7 | AI enrichment runs | From the admin panel on Render / from a laptop or CI via the API | Laptop/CI — Render free can kill long jobs |
| D8 | Vercel preview deployments | Block (exact origins only) / allow via an origin regex | Decide with D3 |
| D9 | Deploy flow | Auto-deploy on push to `main` / manual; who runs migrations (`setup.sh` with `DIRECT_URL`) and when | Auto-deploy frontends; manual backend deploy + migrations until CI exists |
| D10 | Backups | Neon free point-in-time window only / scheduled `pg_dump` (GitHub Action) | Scheduled `pg_dump` before counting days |
| D11 | Node version | 20.x / 22.x | 20.x (pin in `engines`) |
| D12 | Secrets ownership | Who holds the Render/Neon/Upstash/Vercel/Gemini accounts and rotates `JWT_SECRET` / API keys | Name an owner |

## 7. Later (not needed for launch)

- Scaling beyond one instance: Redis-backed throttler storage, enrichment progress and job locks in Redis (review P-L4, E-H5).
- Design clean-ups from the review: split `AiEnrichmentService`, shared SSE stream helper, `CacheService.getOrSet`, `ResultChangeNotifier` (D-M1, D-M2).
- Dependency majors (Nest, Prisma), indexes (P-L1), set-based bulk writes (P-M2), JWT hardening (S-L1).
