#!/usr/bin/env bash
# MatdaanPulse — build (or upgrade) a database from scratch, in the one supported order:
#
#   1. schema.sql              base schema (idempotent)
#   2. migrations/NNN_*.sql    in numeric order (all idempotent)
#   3. seeds                   LS 2024 → state parties → VS results (Bihar: parties → corrections → years) → districts/regions
#                              → Bihar persons → party symbols → party recognition → result dates
#
# Every step is safe to re-run: schema/migrations use IF NOT EXISTS guards and every seed
# INSERT uses ON CONFLICT DO NOTHING, so a second run never wipes or duplicates data. Seeds whose
# rows admins edit later (Bihar persons and their regions, party recognition, result dates) are
# run-once: they record themselves in seed_runs (migration 018) and skip when already applied.
# Needs psql 10+ (the run-once seeds use \if / \gset).
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
    -h|--help) sed -n '2,24p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

PSQL_ARGS=(-X -q -v ON_ERROR_STOP=1)
# Seeds escape strings by doubling single quotes only; that is correct (and only correct)
# with standard_conforming_strings=on, the PostgreSQL default since 9.1. Enforce it.
# lock_timeout: a migration's ALTER TABLE waits at most 5s for its lock (then fails, and setup.sh can be
# re-run) instead of queueing every reader behind it. It comes first so a caller's PGOPTIONS overrides it.
export PGOPTIONS="-c lock_timeout=5s ${PGOPTIONS:-} -c standard_conforming_strings=on -c client_min_messages=warning"

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
# Bihar: parties first, then the run-once corrections (brings an old-seeded DB to the real ECI values and deletes the
# old rows ECI does not have, so the seat+party unique index cannot skip a new candidate), then the year files.
run seed_bihar_parties.sql
run seed_bihar_corrections_v1.sql
for y in 2025 2020 2015 2010; do run "seed_bihar_vs_${y}.sql"; done
# Other states: their ECI parties, then the run-once corrections (old rows → ECI values, before the year files).
for st in wb as kl tn py; do
  run "seed_${st}_vs_parties.sql"
  run "seed_${st}_corrections_v1.sql"
  for y in 2011 2016 2021 2026; do run "seed_${st}_vs_${y}.sql"; done
done
# Phase 3A states (Goa, Manipur, Uttarakhand, Punjab, Uttar Pradesh 2012-2022): new elections, their ECI parties first
for st in ga mn uk pb up; do
  run "seed_${st}_vs_parties.sql"
  for y in 2012 2017 2022; do run "seed_${st}_vs_${y}.sql"; done
done
# Phase 4A states (new elections since the 2008 delimitation), their ECI parties first
run seed_dl_vs_parties.sql; for y in 2008 2013 2015 2020 2025; do run "seed_dl_vs_${y}.sql"; done
for st in hr jh od; do run "seed_${st}_vs_parties.sql"; for y in 2009 2014 2019 2024; do run "seed_${st}_vs_${y}.sql"; done; done
# Phase 4B states, one at a time (Sikkim 2009-2024)
run seed_sk_vs_parties.sql; for y in 2009 2014 2019 2024; do run "seed_sk_vs_${y}.sql"; done
run seed_ar_vs_parties.sql; for y in 2009 2014 2019 2024; do run "seed_ar_vs_${y}.sql"; done
run seed_ap_vs_parties.sql; for y in 2009 2014 2019 2024; do run "seed_ap_vs_${y}.sql"; done
# Party lineage (renames, mergers, splits, breakaways; fill-only) — after every party seed
run seed_party_lineage.sql
# Run-once: old manifests' party ids → the ids the ECI data uses (published manifests are never rewritten by the year files)
for st in kl as; do run "seed_${st}_manifest_fixes_v1.sql"; done
# Run-once: parties the old manifests put in the wrong alliance (Kerala, Tamil Nadu 2011, West Bengal 2011)
run seed_manifest_alliances_v1.sql

echo "==> Seeds: districts & regions (must follow VS results — they UPDATE constituencies)"
run seed_bihar_districts_regions.sql
for st in as kl py tn wb; do run "seed_${st}_districts_regions.sql"; done
# Assam 2026 seats (2023 delimitation): tagged one by one (the seed above covers only 2008-era seats)
run seed_as_2026_districts_regions.sql
# Phase 3A states (2008 delimitation; seat → district sourced in scraper/data/<slug>/districts.json)
for st in ga mn uk pb up; do run "seed_${st}_districts_regions.sql"; done
for st in dl hr jh od; do run "seed_${st}_districts_regions.sql"; done
run seed_sk_districts_regions.sql
run seed_ar_districts_regions.sql
run seed_ap_districts_regions.sql
# Person links across 2011-2021 (run-once; must follow the VS results)
for st in as kl py tn wb; do run "seed_${st}_person_links_v1.sql"; done
for st in ga mn uk pb up; do run "seed_${st}_person_links_v1.sql"; done
for st in dl hr jh od; do run "seed_${st}_person_links_v1.sql"; done
run seed_sk_person_links_v1.sql
run seed_ar_person_links_v1.sql
run seed_ap_person_links_v1.sql
# 2026 candidates → their 2011-2021 persons (run-once; same delimitation only, so none for Assam 2026)
for st in kl py tn wb; do run "seed_${st}_person_links_v2.sql"; done
# Latest DL/HR/JH/OD candidates → their earlier persons (run-once)
for st in dl hr jh od; do run "seed_${st}_person_links_v2.sql"; done
run seed_sk_person_links_v2.sql
run seed_ar_person_links_v2.sql
run seed_ap_person_links_v2.sql
# 2026 leaders (curated, user-approved; run-once: candidacy links, fill-only profiles, manifest watchlists)
for st in as kl py tn wb; do run "seed_${st}_leaders.sql"; done
# Delhi 2025, Haryana/Jharkhand/Odisha 2024 leaders (curated, user-approved 2026-10-05; run-once)
for st in dl hr jh od; do run "seed_${st}_leaders.sql"; done
run seed_sk_leaders.sql
run seed_ar_leaders.sql
# 2026 top-4 candidate photos (S3; run-once, fill-only; after the leaders, whose photos win)
for st in as kl py tn wb; do run "seed_${st}_candidate_photos.sql"; done
for st in dl hr jh od; do run "seed_${st}_candidate_photos.sql"; done
run seed_sk_candidate_photos.sql
run seed_ar_candidate_photos.sql
# 2026 winners' affidavits (MyNeta; run-once, fill-only)
for st in as kl py tn wb; do run "seed_${st}_affidavits.sql"; done
for st in dl hr jh od; do run "seed_${st}_affidavits.sql"; done
run seed_sk_affidavits.sql
run seed_ar_affidavits.sql

echo "==> Seeds: Bihar persons (must follow Bihar VS results + regions)"
run seed_bihar_persons.sql
run seed_bihar_person_regions.sql

echo "==> Seeds: Bihar person links v2 / leaders / affidavits (run-once; must follow Bihar persons)"
run seed_bihar_person_links_v2.sql
# Run-once: a curated Bihar merge corrected (Pipra 2025: two different Rajmangal Prasads)
run seed_bihar_person_fixes_v1.sql
run seed_bihar_leaders.sql
run seed_bihar_candidate_photos.sql
run seed_bihar_affidavits.sql

echo "==> Seeds: party symbols (must follow all party inserts)"
run seed_party_symbols.sql

echo "==> Seeds: party ECI recognition (must follow all party inserts)"
run seed_party_recognition.sql

echo "==> Seeds: Bihar 2025 party profiles (run-once, fill-only; must follow party symbols and recognition)"
run seed_bihar_party_profiles.sql
# Party colours the fill-only profile seeds could not set (each only while the old colour is unchanged)
# 2026 top parties of the five states (researched, user-approved; run-once, fill-only)
for st in as kl py tn wb; do run "seed_${st}_party_profiles.sql"; done
for st in dl hr jh od; do run "seed_${st}_party_profiles.sql"; done
run seed_sk_party_profiles.sql
run seed_ar_party_profiles.sql
# Party state units and their leaders (run-once; after the leaders and person links)
run seed_party_units_v1.sql
run seed_party_units_v2.sql
run seed_party_units_v3.sql
run seed_party_colors_v1.sql
# Colours for seat-winning parties still on a grey placeholder (fill-only, sourced in scraper/data/parties/colors-v2.json)
run seed_party_colors_v2.sql
run seed_party_colors_v3.sql
# Run-once: stored Vercel Blob image URLs → the same keys on S3 (after every seed that writes photos)
run seed_media_s3_v1.sql

echo "==> Seeds: election result dates (must follow every election insert)"
run seed_election_result_dates.sql

echo "==> Seeds: election delimitations (must follow every election insert)"
run seed_election_delimitation.sql

echo "==> Seeds: display names (fill-only)"
run seed_state_names_v1.sql

echo "==> Done. Create an admin user with: cd backend && npm run create-admin"
