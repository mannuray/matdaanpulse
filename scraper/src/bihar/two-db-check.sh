#!/usr/bin/env bash
# Fresh build vs upgraded copy of the current DB must agree on Bihar VS data (constituencies, candidates, results).
# The upgraded copy runs setup.sh twice: the second run must change nothing.
# Usage: scraper/src/bihar/two-db-check.sh   (env: PG_BASE=postgresql://admin:password123@localhost:3083, SRC_DB=election_tracker)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BASE="${PG_BASE:-postgresql://admin:password123@localhost:3083}"
SRC="${SRC_DB:-election_tracker}"
SNAP="$ROOT/scraper/src/bihar/bihar-snapshot.sql"

fresh_db() { psql -X -q "$BASE/postgres" -c "DROP DATABASE IF EXISTS $1" -c "CREATE DATABASE $1"; }
snap() { psql -X -At -F ' ' "$BASE/$1" -f "$SNAP"; }

echo "==> fresh build"
fresh_db et_fresh
DATABASE_URL="$BASE/et_fresh" "$ROOT/database/setup.sh" >/dev/null

echo "==> upgraded copy of $SRC"
fresh_db et_upgrade
pg_dump --no-owner --no-privileges "$BASE/$SRC" | psql -X -q -v ON_ERROR_STOP=1 "$BASE/et_upgrade" >/dev/null
DATABASE_URL="$BASE/et_upgrade" "$ROOT/database/setup.sh" >/dev/null
first="$(snap et_upgrade)"
DATABASE_URL="$BASE/et_upgrade" "$ROOT/database/setup.sh" >/dev/null
second="$(snap et_upgrade)"

status=0
[[ "$first" == "$second" ]] && echo "rerun: same" || { echo "rerun: DIFF (second setup.sh run changed data)"; status=1; }
paste -d ' ' <(snap et_fresh) <(echo "$second") | while read -r t1 n1 h1 t2 n2 h2; do
  if [[ "$n1 $h1" == "$n2 $h2" ]]; then echo "$t1: same ($n1 rows)"; else echo "$t1: DIFF (fresh $n1, upgraded $n2)"; fi
done | tee /dev/stderr | grep -q DIFF && status=1
exit $status
