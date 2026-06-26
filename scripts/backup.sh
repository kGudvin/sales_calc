#!/bin/sh
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-sales_calc_user}"
POSTGRES_DB="${POSTGRES_DB:-sales_calc}"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
FILE="$BACKUP_DIR/sales_calc_$STAMP.dump"

mkdir -p "$BACKUP_DIR"
pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$FILE"
find "$BACKUP_DIR" -name "sales_calc_*.dump" -type f -mtime +"$RETENTION_DAYS" -delete
echo "Backup saved to $FILE"
