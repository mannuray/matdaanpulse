# Election Tracker

A reusable, metadata-driven platform for tracking Indian Lok Sabha (Parliamentary) and Vidhan Sabha (State Assembly) elections — with real-time counting-day updates, interactive D3 choropleth maps, historical analysis, and AI-enriched constituency insights.

## Overview

The platform is built around a **split-data model**: a JSON *Manifest* holds UI configuration (alliances, VIP seats, color schemes, historical election links) while a relational database holds hard results and candidate data. This keeps the entire stack — public SPA, admin SPA, backend, scraper — reusable for any election without code changes.

Current data coverage includes Lok Sabha 2024 and Vidhan Sabha elections across Bihar (2010, 2015, 2020, 2025), West Bengal (2011, 2016, 2021), Assam, Kerala, Tamil Nadu, Puducherry, and a live-simulation environment (Bihar VS 2027).

## Architecture

```
[Public SPA (React+Vite)]  <── SSE ─┐
                                    ├─→ [NestJS API] ──→ [PostgreSQL]
[Admin SPA (React+Vite)]  ── REST ──┘          │
                                               └─→ [Redis (cache + pub/sub)]
                                                        ↑
[Scraper: simulation replay] ── admin REST API ─────────┘
```

Four independent services communicate through PostgreSQL (source of truth) and Redis (pub/sub for SSE fan-out + live cache). OpenTelemetry traces/metrics are shipped to a SigNoz collector.

## Tech Stack

| Layer       | Stack                                                                  |
|-------------|------------------------------------------------------------------------|
| Backend     | NestJS (TypeScript), Prisma, JWT auth, Helmet, Throttler, Gemini (AI)  |
| Public FE   | React + Vite (TypeScript SPA), D3.js (SVG choropleths), react-i18next  |
| Admin FE    | React + Vite (TypeScript SPA), JWT-protected                           |
| Scraper     | Node.js + ts-node: seed generators, live simulation (live ECI ingestion not implemented) |
| Database    | PostgreSQL 15                                                          |
| Cache / RT  | Redis 7 (pub/sub for SSE, live tally cache)                            |
| Observability | OpenTelemetry → SigNoz                                               |

## Directory Layout

```
election-tracker/
├── backend/         # NestJS API server (port 3082)
├── frontend/        # Public React SPA (port 3080)
├── admin/           # Admin React SPA (port 3081)
├── scraper/         # Seed generators + live-counting simulation (no live ECI ingestion yet)
├── database/        # setup.sh, schema.sql, migrations/, seed*.sql
├── docs/            # PRD, HLD, LLD, API spec, feature tracker
└── docker-compose.yml
```

## Dev Ports

| Service   | Port |
|-----------|------|
| Frontend  | 3080 |
| Admin     | 3081 |
| Backend   | 3082 |
| Postgres  | 5432 |
| Redis     | 6379 |

## Getting Started

### Prerequisites
- Node.js 20+, npm
- Docker + Docker Compose (for PostgreSQL, Redis, OTEL collector)

### 1. Configure
```bash
cp .env.example .env
# edit .env: set JWT_SECRET (required — the backend refuses to start without it),
# ADMIN_EMAIL / ADMIN_PASSWORD, and optionally GEMINI_API_KEY, SIGNOZ_INGESTION_KEY
```

### 2. Start infrastructure + build the database
```bash
docker compose up -d db redis
```
On **first boot of an empty volume**, the `db` container runs `database/setup.sh`, which applies
everything in the one supported order — `schema.sql` → `migrations/001…011` → seeds (LS 2024,
state parties, all VS results, districts/regions, Bihar persons, party symbols). Set
`ET_DB_INIT_ARGS=--schema-only` in `.env` to skip seed data.

For an existing volume, or a Postgres you run yourself, run the same script directly (needs `psql`).
It is idempotent — re-running it never wipes or duplicates data:
```bash
set -a; source .env; set +a      # exports DB_* / DATABASE_URL
database/setup.sh                # or: database/setup.sh --schema-only
```
Do not apply individual seed files by hand: several depend on each other (see the order in `setup.sh`).

### 3. Create an admin user
No admin account is seeded. Create (or update) a `SUPER_ADMIN` from `ADMIN_EMAIL` / `ADMIN_PASSWORD`:
```bash
cd backend && npm install && npm run create-admin
```

### 4. Install & run each service
```bash
# Backend (NestJS API)
cd backend && npm install && npm run start:dev

# Public frontend
cd frontend && npm install && npm run dev

# Admin panel
cd admin && npm install && npm run dev
```

### 5. (Optional) Live-counting simulation
Live ECI ingestion is **not implemented** — `scraper/src/index.ts` only prints a notice. To exercise
the counting-day pipeline (admin bulk overrides → Redis pub/sub → SSE → frontend), use the simulation,
which replays Bihar 2025 results round by round as a fictional "Bihar 2027" live election:
```bash
cd scraper && npm install
set -a; source ../.env; set +a   # DB_*, API_BASE_URL, SIM_ADMIN_EMAIL / SIM_ADMIN_PASSWORD
npm run sim:setup                # clone Bihar 2025 → Bihar 2027 (Live)
npm run sim:mock-eci             # mock ECI server on :4444 (leave running)
npm run sim:replay               # in another shell; pushes each round via the admin API
npm run sim:reset                # zero results to replay again; sim:cleanup removes it
```

Open `http://localhost:3080` for the public tracker, `http://localhost:3081` for admin.

## Key Features

### Public Experience
- **Election switcher** — one dropdown re-renders the entire UI from the election's manifest
- **Interactive D3 choropleth** with margin-based intensity, zoom/pan, hover tooltips, drill-down
- **Map tabs** — Overview, Battle (alliance/party filter + margin shading), SC/ST demographics, Swing (flips vs. prior), Insights (spoiler/vote-split), History (dominance + anti-incumbency + party switchers + margin trend)
- **Alliance tallies** with majority mark, vulnerability shading, head-to-head comparator
- **Live SSE updates** with toast notifications when leads change, pulse animation on the map
- **Constituency modal + detail page** — candidates, voter turnout, vote share, historical context, AI-enriched narrative
- **i18n** (English, Hindi, +2 regional) and dark mode

### Admin Panel
- Election lifecycle (`Upcoming → Live → Finalized`) with draft/published manifest versioning
- Master-data management (parties, candidates, constituencies, persons) with CSV bulk import
- **AI enrichment pipeline** — pre-poll (historical context + web search) and post-poll (with results) via a streaming SSE job runner
- Person linking across elections, photo/bio management, duplicate merge
- Scraper control center, manual result overrides, audit logs
- **Live simulation mode** — clone an election, mock the ECI endpoint, replay rounds to test SSE flows

### Data & Analysis
- Historical dominance classification (stronghold / loyal / swing) over 3+ elections
- Anti-incumbency detection via candidate-name matching
- Party-switcher tracking across consecutive elections
- Spoiler / vote-split analysis driven by manifest config
- Margin trend over time (average + median, per-party breakdowns)

## Documentation

Deeper docs live in [`docs/`](./docs):

| Doc                        | What's inside                                                  |
|----------------------------|----------------------------------------------------------------|
| `REQUIREMENTS.md`          | Product requirements (PRD)                                     |
| `HLD.md`                   | High-level design, architecture, scaling strategy              |
| `LLD.md`                   | Low-level design — DB schema, module layout, DI boundaries     |
| `API_SPEC.md`              | REST endpoints (public + admin) with auth/RBAC notes           |
| `IMPLEMENTATION_GUIDE.md`  | SOLID principles, error handling, logging, testing standards   |
| `FEATURES.md`              | Feature tracker (all shipped features)                         |
| `FEATURE_GUIDE.md`         | How to use each feature end-to-end                             |
| `SCRAPING.md`              | ECI scraping patterns (live + historical)                      |
| `VS_DATA_PIPELINE.md`      | Building a VS election from scratch                            |
| `UPCOMING_2026_ELECTIONS.md` | Roadmap for 2026 state elections                             |

## Environment Variables

See `.env.example` — one set of names is shared by docker-compose, `database/setup.sh`, the backend and the scraper:

| Variable | Used by | Notes |
|---|---|---|
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASS` `DB_NAME` | compose, setup.sh, scraper | Postgres connection |
| `DATABASE_URL` | backend (Prisma); also honoured by setup.sh / scraper | same DB as `DB_*` |
| `REDIS_HOST` `REDIS_PORT` | backend | pub/sub + cache |
| `JWT_SECRET` | backend | **required** — backend fails fast without it |
| `PORT` `CORS_ORIGINS` | backend | defaults 3082 / localhost:3080,3081 |
| `GEMINI_API_KEY` | backend | AI enrichment |
| `ADMIN_EMAIL` `ADMIN_PASSWORD` | `npm run create-admin` | initial SUPER_ADMIN |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | backend | OTLP collector (default `http://localhost:4317`) |
| `SIGNOZ_ENDPOINT` `SIGNOZ_INGESTION_KEY` | otel-collector | SigNoz Cloud export |
| `API_BASE_URL` `SIM_ADMIN_EMAIL` `SIM_ADMIN_PASSWORD` | scraper simulation | replay login falls back to `ADMIN_*` |

The `docker-compose.yml` has dev credentials hardcoded — **do not use in production**. Remove host port bindings, add `requirepass` to Redis, and put services behind a private network.

## License

Private / unpublished — no license granted.
