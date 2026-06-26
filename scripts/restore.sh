#!/bin/sh
set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/restore.sh /backups/sales_calc_YYYY-MM-DD_HH-MM-SS.dump"
  exit 1
fi

POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-sales_calc_user}"
POSTGRES_DB="${POSTGRES_DB:-sales_calc}"

pg_restore -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists "$1"
echo "Database restored from $1"
