#!/usr/bin/env bash
# MatdaanPulse — build (or upgrade) a database from scratch, in the one supported order:
#
#   1. schema.sql              base schema (idempotent)
#   2. migrations/NNN_*.sql    in numeric order (all idempotent)
#   3. seeds                   LS 2024 → state parties → VS results → districts/regions
#                              → Bihar persons → party symbols
#
# Every step is safe to re-run: schema/migrations use IF NOT EXISTS guards and every seed
# INSERT uses ON CONFLICT DO NOTHING, so a second run never wipes or duplicates data.
#
# Usage:
#   database/setup.sh                 # schema + migrations + all seeds
#   database/setup.sh --schema-only   # schema + migrations, no seed data
#
# Connection (first match wins):
#   DATABASE_URL                       e.g. postgresql://admin:password123@localhost:5432/election_tracker
#   PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE (standard libpq vars)
#   DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME    (names from .env.example)
#
# No admin user is seeded. Afterwards run:  cd backend && npm run create-admin
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SCHEMA_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --schema-only) SCHEMA_ONLY=1 ;;
    -h|--help) sed -n '2,23p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

PSQL_ARGS=(-X -q -v ON_ERROR_STOP=1)
# Seeds escape strings by doubling single quotes only; that is correct (and only correct)
# with standard_conforming_strings=on, the PostgreSQL default since 9.1. Enforce it.
export PGOPTIONS="${PGOPTIONS:-} -c standard_conforming_strings=on -c client_min_messages=warning"

if [[ -n "${DATABASE_URL:-}" ]]; then
  # Prisma-style URLs may carry ?schema=public, which libpq rejects — strip that param.
  CONN="$(printf '%s' "$DATABASE_URL" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//')"
  PSQL_ARGS+=(-d "$CONN")
else
  export PGHOST="${PGHOST:-${DB_HOST:-localhost}}"
  export PGPORT="${PGPORT:-${DB_PORT:-5432}}"
  export PGUSER="${PGUSER:-${DB_USER:-admin}}"
  export PGDATABASE="${PGDATABASE:-${DB_NAME:-election_tracker}}"
  if [[ -z "${PGPASSWORD:-}" && -n "${DB_PASS:-}" ]]; then export PGPASSWORD="$DB_PASS"; fi
fi

run() {
  local f="$DIR/$1"
  if [[ ! -f "$f" ]]; then echo "Missing file: $f" >&2; exit 1; fi
  echo "  -> $1"
  psql "${PSQL_ARGS[@]}" -f "$f"
}

echo "==> Schema"
run schema.sql

echo "==> Migrations"
for f in "$DIR"/migrations/[0-9][0-9][0-9]_*.sql; do
  run "migrations/$(basename "$f")"
done

if [[ "$SCHEMA_ONLY" -eq 1 ]]; then
  echo "==> Done (schema only)"
  exit 0
fi

echo "==> Seeds: Lok Sabha 2024 (states, parties, elections, results)"
run seed.sql

echo "==> Seeds: state parties"
for st in as kl py tn wb; do run "seed_${st}_parties.sql"; done

echo "==> Seeds: Vidhan Sabha results"
# Newest first: older Bihar files reference parties (LJP, HAMS) first defined in newer ones.
for y in 2025 2020 2015 2010; do run "seed_bihar_vs_${y}.sql"; done
for st in wb as kl tn py; do
  for y in 2011 2016 2021; do run "seed_${st}_vs_${y}.sql"; done
done

echo "==> Seeds: districts & regions (must follow VS results — they UPDATE constituencies)"
run seed_bihar_districts_regions.sql
for st in as kl py tn wb; do run "seed_${st}_districts_regions.sql"; done

echo "==> Seeds: Bihar persons (must follow Bihar VS results + regions)"
run seed_bihar_persons.sql
run seed_bihar_person_regions.sql

echo "==> Seeds: party symbols (must follow all party inserts)"
run seed_party_symbols.sql

echo "==> Done. Create an admin user with: cd backend && npm run create-admin"
