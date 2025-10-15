#!/bin/sh
set -e

run_migrations() {
  if [ "${RUN_DB_MIGRATIONS:-true}" = "true" ]; then
    if [ -z "${DATABASE_URL:-}" ]; then
      echo "DATABASE_URL is not set; skipping Prisma migrations." >&2
      return
    fi

    echo "Running Prisma migrations..."
    npx prisma migrate deploy
    echo "Prisma migrations completed."
  else
    echo "RUN_DB_MIGRATIONS set to '${RUN_DB_MIGRATIONS}'; skipping Prisma migrations."
  fi
}

run_migrations

exec "$@"
