#!/usr/bin/env bash
# Runs once, on first boot of an empty Postgres volume (mounted into
# /docker-entrypoint-initdb.d by docker-compose.yml). Builds the full database via setup.sh.
# During init the server only listens on the unix socket, so connect through it.
set -euo pipefail
unset DATABASE_URL
PGHOST=/var/run/postgresql \
PGUSER="$POSTGRES_USER" \
PGDATABASE="$POSTGRES_DB" \
  bash /database/setup.sh ${ET_DB_INIT_ARGS:-}
