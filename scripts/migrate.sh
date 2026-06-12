#!/bin/bash
set -euo pipefail

# Apply forward database migrations in filename order.
#
# Every file in $MIGRATIONS_DIR MUST be idempotent (guarded DDL), because this
# runs on every deploy and re-applies all of them. Each file runs in a single
# transaction; a failure stops the run and rolls that file back.
#
# Env:
#   DATABASE_URL    (required) Postgres connection string
#   MIGRATIONS_DIR  (default: sql/migrations)

: "${DATABASE_URL:?DATABASE_URL is required}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-sql/migrations}"

command -v psql >/dev/null || { echo "❌ psql not found"; exit 1; }

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "No migrations found in $MIGRATIONS_DIR"
  exit 0
fi

while IFS= read -r f; do
  echo "▶️  applying $(basename "$f")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$f"
done < <(printf '%s\n' "${files[@]}" | sort)

echo "✅ migrations complete"
