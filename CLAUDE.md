# MatdaanPulse

Real-time Indian election results tracker with interactive maps, alliance tallies, and constituency-level drill-down.

## Tech Stack

- **Backend:** NestJS (TypeScript) + Prisma (PostgreSQL), JWT auth, live results for viewers by polling a per-election version + immutable versioned snapshots behind a CDN (`/elections/:id/live`, `results?v=`; version bumped by DB triggers, migration 015), Redis cache + pub/sub → SSE for the admin Live Console only (Redis is optional at runtime: cache falls back to the DB), OpenTelemetry → SigNoz (OTLP/HTTP, only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set). Admin image uploads → Vercel Blob (`POST /admin/media`, `BLOB_READ_WRITE_TOKEN`; unset = 503 MEDIA_0001). No built-in AI (removed 2026-09-30). Live ingest API for the counting-day worker (`/ingest/…`, machine keys, shards + leases, holds; spec `docs/superpowers/specs/2026-10-03-live-ingest-design.md`, runbook `docs/LIVE_RUNBOOK.md`). Health: `/api/v1/health/live` (liveness), `/api/v1/health/ready` (DB + Redis). Deployment plan: `docs/DEPLOYMENT.md`
- **Frontend:** React + TypeScript, Vite, D3.js (choropleth maps), i18next, Tailwind CSS v4 (preflight off) + Radix UI. Dashboard is MVVM: `src/model` (pure, no React) → `src/viewmodels` (hooks) → `src/views` (presentational), composed in `src/pages/StudioDashboard.tsx`; `npm run lint` enforces the import direction.
  - Constituency (`/election/:id/constituency/:constId`) and person (`/person/:id`) pages are studio MVVM pages (`src/viewmodels/pages`, `src/views/constituency`, `src/views/person`); party marks render through `views/ui/PartyMark` (logo → ECI symbol → dot).
  - Tailwind only scans `src/views` plus the pages listed via `@source` in `frontend/src/theme/studio.css` — add an `@source` line when a new file outside `src/views` uses Tailwind classes.
  - Legacy CSS is loaded through `src/theme/legacy.css` in a lower cascade layer.
  - Frontend commands: `npm run lint` (MVVM import boundaries), `npm run e2e` (Playwright, needs the dev servers running).
- **Admin:** React + TypeScript (Vite) panel for managing elections, candidates, results, manifests, the Live Console (feed, shards, holds, seat corrections) (design spec `docs/superpowers/specs/2026-10-01-admin-redesign-design.md`). Tailwind v4 **with preflight** + Radix; there is no legacy CSS (`src/theme/legacy-free.test.ts` guards it). Tailwind scans `src/components`, `src/pages`, `src/context` and `src/App.tsx` (`@source` in `admin/src/theme/tailwind.css`) — files with classes go there. Global election selection via `ElectionContext`. Entity lists = `components/entity/EntityPage` + `components/ui/DataTable`; records open at `/x/:id` via `useEntityRoute`, and every editor calls `useUnsavedGuard(dirty)`. Party, Person, Candidate and Constituency records are full pages built on `components/record/RecordPage`; Elections edits in `components/ui/FormDialog`; side panels (`components/ui/Sheet`) remain only for Feedback, Users, Audit logs and Manifests. Images: `components/ui/ImageUpload` (party symbols) / `components/record/PhotoButton` (person + candidate header photo); upload on pick, record changes on Save; render every image URL through `utils/asset-url.ts` (`assetUrl`, needs `VITE_PUBLIC_SITE_URL` in the production build). Dates are shown in IST (`utils/time.ts`). Every page scrolls itself (`h-full overflow-y-auto` or `EntityPage`).
- **Scraper:** Node.js + ts-node — historical seed generators and the live-counting simulation (`src/simulation/`: mock ECI server + replay through the ingest API); the counting-day worker `scraper/src/live/` (`npm run live`, adapters `eci-web` / `mock-eci`) posts to the ingest API; nothing writes results to the DB directly
- **Database:** PostgreSQL 15 — base schema + numbered migrations + seed data (LS 2024, VS for BR/WB/AS/KL/TN/PY)

## Directory Structure

```
matdaanpulse/
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
- Seed order matters (enforced in `setup.sh`): `seed.sql` → `seed_*_parties.sql` → VS results (Bihar: `seed_bihar_parties.sql` → `seed_bihar_corrections_v1.sql` (run-once, frozen) → years newest-first) → `seed_*_districts_regions.sql` → `seed_bihar_persons.sql` → `seed_bihar_person_regions.sql` → `seed_bihar_person_links_v2.sql` → `seed_bihar_leaders.sql` → `seed_bihar_affidavits.sql` → `seed_party_symbols.sql` → `seed_party_recognition.sql` → `seed_election_result_dates.sql` → `seed_election_delimitation.sql`.
- New migrations must be idempotent (`IF NOT EXISTS` / `DO` blocks) and must not depend on seed data. New seeds must use `ON CONFLICT DO NOTHING`, set `results.election_id`, and never `TRUNCATE`. Constituency UPDATEs keyed by `const_no` must be scoped to the election type/ID (LS and VS numbering overlap). A seed whose rows admins edit later must be run-once: guard it with a `seed_runs` marker (migration 018; see `scraper/src/seed-run-once.ts` and the Bihar person seeds), because `setup.sh` re-runs every seed on every deploy.
- `elections.delimitation` (migration 019) is the boundary set the seats follow ("2008"; Assam "2023" from its 2026 election). Seat history, the seat analysis and the public manifest's `history` / `compare_with` compare only elections of the same type, state and delimitation (`backend/src/common/comparable-elections.ts`); NULL compares with nothing. The first election after a redraw has no history (its seats are `new`).
- Migration 022: `image_credits` (source, author, licence per hosted image; public `GET /credits`, `photo_credit` on person profiles). Hosted photos live in Vercel Blob, never hotlinked.
- Migration 020 (live ingest): `ingest_keys`, feed/shard/lease/hold tables, seat state and rounds on results, and `reopen` support; see the spec. Results are written only through the ingest API (worker) or the admin seat correction.
- Every candidate has a person: an insert without one gets an auto-created person (trigger, migration 018), and a person left with no candidates is deleted by trigger. candidates/persons have no `metadata` column.
- Keep `backend/prisma/schema.prisma` in sync with the SQL (check with `prisma migrate diff --from-url … --to-schema-datamodel …`). Prisma CLI commands that read the schema config need `DIRECT_URL` set (it may equal `DATABASE_URL` locally); the app and `prisma generate` do not. Expected drift: the diff always proposes `ALTER COLUMN person_id SET NOT NULL` on `candidates`; never apply it (NOT NULL is a deferred trigger, and seeds insert with NULL). Never apply a drop of `candidates.metadata` / `persons.metadata` either (kept, `@ignore`, until a later migration drops them), and never run `prisma db push`.
- **Seeding an election's data: follow `docs/SEEDING_PLAYBOOK.md`** (sources, pipeline, checks, traps; Bihar is the worked example).
- Several seeds are partly estimated (see `docs/FEATURES.md` → Known Limitations). The public `/about` page lists each dataset's quality from `frontend/src/model/about/about.ts`: update that file in the same change whenever a seed is added or corrected.
- No admin user is seeded: `cd backend && npm run create-admin` (uses `ADMIN_EMAIL` / `ADMIN_PASSWORD`).

## Key Data Files

- `frontend/public/geo/india_pc_2008.geojson` — 543 Lok Sabha parliamentary constituencies. Map files are named per delimitation (`<code>_ac_<era>.geojson`, `india_pc_<era>.geojson`); each election's manifest `geo.map_url` names its own, and a redraw adds a new file (never edit one in place). Old unversioned paths redirect (`frontend/public/_redirects`, `frontend/vercel.json`)
- `frontend/public/geo/india_states.geojson` — 36 state boundaries (merged from PCs)
- `database/setup.sh` — builds/upgrades a DB (schema → migrations → seeds)
- `database/schema.sql` + `database/migrations/*.sql` — base schema + incremental changes
- `database/seed.sql` — Real 2024 Lok Sabha election data (states, parties, results, candidates)
- `database/seed_bihar_vs_{2010,2015,2020,2025}.sql`, `database/seed_{wb,as,kl,tn,py}_vs_{2011,2016,2021}.sql` — Vidhan Sabha results
- `scraper/data/bihar/` — committed ECI-derived Bihar data (`vs-<year>.json`, party map, supplement, decisions); the Bihar VS seeds are generated from it (`cd scraper && npx ts-node src/bihar/generate-cli.ts`; pipeline in `docs/FEATURES.md` → "Bihar results data")
- `database/seed_{as,kl,py,tn,wb}_parties.sql`, `database/seed_*_districts_regions.sql`, `database/seed_bihar_persons.sql`, `database/seed_bihar_person_regions.sql`, `database/seed_party_symbols.sql`, `database/seed_party_recognition.sql` (ECI national parties, fills only NULLs), `database/seed_election_result_dates.sql` (counting dates, fills only empty ones), `database/seed_election_delimitation.sql` (each election's delimitation, fills only empty ones) — supporting seeds
- `.env.example` — every env var (shared names across compose, setup.sh, backend, scraper)

## Rules

- **Document every feature** in `docs/FEATURES.md` before or during implementation
- Keep this file updated as the project evolves
