#!/bin/sh
set -e
umask 077

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-sales_calc_user}"
POSTGRES_DB="${POSTGRES_DB:-sales_calc}"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
FILE="$BACKUP_DIR/sales_calc_$STAMP.dump"
TEMP_FILE="$FILE.tmp"

mkdir -p "$BACKUP_DIR"
trap 'rm -f "$TEMP_FILE"' EXIT
pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$TEMP_FILE"
test -s "$TEMP_FILE"
mv "$TEMP_FILE" "$FILE"
trap - EXIT
find "$BACKUP_DIR" -name "sales_calc_*.dump" -type f -mtime +"$RETENTION_DAYS" -delete
echo "Backup saved to $FILE"
