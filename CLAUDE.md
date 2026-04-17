# Election Tracker

Real-time Indian election results tracker with interactive maps, alliance tallies, and constituency-level drill-down.

## Tech Stack

- **Backend:** Node.js + Express, PostgreSQL
- **Frontend:** React + TypeScript, Vite, D3.js (choropleth maps), i18next
- **Admin:** React admin panel for managing elections, candidates, results
- **Database:** PostgreSQL with seed data from 2024 Lok Sabha elections

## Directory Structure

```
election-tracker/
├── backend/         # Express API server
├── frontend/        # React SPA (Vite)
├── admin/           # Admin panel (React)
├── database/        # Migrations + seed data
├── docs/            # Feature docs & tracking
├── scraper/         # Data scrapers
└── docker-compose.yml
```

## Dev Ports

| Service  | Port |
|----------|------|
| Frontend | 3080 |
| Admin    | 3081 |
| Backend  | 3082 |

## Key Data Files

- `frontend/public/geo/india_pc.geojson` — 543 Lok Sabha parliamentary constituencies
- `frontend/public/geo/india_states.geojson` — 36 state boundaries (merged from PCs)
- `database/seed.sql` — Real 2024 Lok Sabha election data (results, candidates, parties)

## Rules

- **Document every feature** in `docs/FEATURES.md` before or during implementation
- Keep this file updated as the project evolves
