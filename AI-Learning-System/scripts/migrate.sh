#!/usr/bin/env bash
# Runs every .sql file in backend/src/db/migrations in lexical order.
# Tracks applied files in a _migrations table so re-runs are safe.
#
# Usage:  bash scripts/migrate.sh
#
# Requires psql on PATH and DATABASE_URL in .env or the environment.

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env ]; then
    DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set (checked env and .env)"
  exit 1
fi

MIGRATIONS_DIR="backend/src/db/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERROR: $MIGRATIONS_DIR not found"
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
  CREATE TABLE IF NOT EXISTS _migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
" > /dev/null

for file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  filename=$(basename "$file")
  already=$(psql "$DATABASE_URL" -tAc \
    "SELECT 1 FROM _migrations WHERE filename = '$filename'")

  if [ "$already" = "1" ]; then
    echo "skip   $filename (already applied)"
    continue
  fi

  echo "apply  $filename"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file" > /dev/null
  psql "$DATABASE_URL" -c \
    "INSERT INTO _migrations (filename) VALUES ('$filename')" > /dev/null
done

echo "Migrations complete."