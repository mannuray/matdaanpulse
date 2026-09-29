# Election Tracker

Real-time Indian election results tracker with interactive maps, alliance tallies, and constituency-level drill-down.

## Tech Stack

- **Backend:** NestJS (TypeScript) + Prisma (PostgreSQL), JWT auth, Redis pub/sub → SSE for live updates, OpenTelemetry → SigNoz, Gemini for AI enrichment
- **Frontend:** React + TypeScript, Vite, D3.js (choropleth maps), i18next, Tailwind CSS v4 (preflight off) + Radix UI. Dashboard is MVVM: `src/model` (pure, no React) → `src/viewmodels` (hooks) → `src/views` (presentational), composed in `src/pages/StudioDashboard.tsx`; `npm run lint` enforces the import direction.
  - Tailwind only scans `src/views` plus the pages listed via `@source` in `frontend/src/theme/studio.css` — add an `@source` line when a new file outside `src/views` uses Tailwind classes.
  - Legacy CSS is loaded through `src/theme/legacy.css` in a lower cascade layer.
  - Frontend commands: `npm run lint` (MVVM import boundaries), `npm run e2e` (Playwright, needs the dev servers running).
- **Admin:** React + TypeScript (Vite) panel for managing elections, candidates, results, manifests, AI enrichment, live overrides
- **Scraper:** Node.js + ts-node — historical seed generators and the live-counting simulation (`src/simulation/`: mock ECI server + replay via admin bulk-override API). Live ECI ingestion is **not implemented** (stubs only)
- **Database:** PostgreSQL 15 — base schema + numbered migrations + seed data (LS 2024, VS for BR/WB/AS/KL/TN/PY)

## Directory Structure

```
election-tracker/
├── backend/         # NestJS API server (Prisma schema in backend/prisma/)
├── frontend/        # React SPA (Vite)
├── admin/           # Admin panel (React)
├── database/        # setup.sh, schema.sql, migrations/, seed*.sql
├── docs/            # Feature docs & tracking
├── scraper/         # Seed generators + live simulation
└── docker-compose.yml   # Postgres, Redis, SigNoz OTel collector
```

## Dev Ports

| Service  | Port |
|----------|------|
| Frontend | 3080 |
| Admin    | 3081 |
| Backend  | 3082 |
| Mock ECI (simulation) | 4444 |

## Database Setup

- **Only supported path:** `database/setup.sh` (psql, `ON_ERROR_STOP=1`, idempotent). Order: `schema.sql` → `migrations/001…NNN` → seeds. docker-compose runs it automatically on first boot of an empty volume.
- Seed order matters (enforced in `setup.sh`): `seed.sql` → `seed_*_parties.sql` → VS results (Bihar newest-first) → `seed_*_districts_regions.sql` → `seed_bihar_persons.sql` → `seed_bihar_person_regions.sql` → `seed_party_symbols.sql`.
- New migrations must be idempotent (`IF NOT EXISTS` / `DO` blocks) and must not depend on seed data. New seeds must use `ON CONFLICT DO NOTHING`, set `results.election_id`, and never `TRUNCATE`. Constituency UPDATEs keyed by `const_no` must be scoped to the election type/ID (LS and VS numbering overlap).
- Keep `backend/prisma/schema.prisma` in sync with the SQL (check with `prisma migrate diff --from-url … --to-schema-datamodel …`).
- No admin user is seeded: `cd backend && npm run create-admin` (uses `ADMIN_EMAIL` / `ADMIN_PASSWORD`).

## Key Data Files

- `frontend/public/geo/india_pc.geojson` — 543 Lok Sabha parliamentary constituencies
- `frontend/public/geo/india_states.geojson` — 36 state boundaries (merged from PCs)
- `database/setup.sh` — builds/upgrades a DB (schema → migrations → seeds)
- `database/schema.sql` + `database/migrations/*.sql` — base schema + incremental changes
- `database/seed.sql` — Real 2024 Lok Sabha election data (states, parties, results, candidates)
- `database/seed_bihar_vs_{2010,2015,2020,2025}.sql`, `database/seed_{wb,as,kl,tn,py}_vs_{2011,2016,2021}.sql` — Vidhan Sabha results
- `database/seed_{as,kl,py,tn,wb}_parties.sql`, `database/seed_*_districts_regions.sql`, `database/seed_bihar_persons.sql`, `database/seed_bihar_person_regions.sql`, `database/seed_party_symbols.sql` — supporting seeds
- `.env.example` — every env var (shared names across compose, setup.sh, backend, scraper)

## Rules

- **Document every feature** in `docs/FEATURES.md` before or during implementation
- Keep this file updated as the project evolves
