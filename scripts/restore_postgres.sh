#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/restore_postgres.sh /path/to/backup.sql.gz
# Optional env:
#   COMPOSE_FILE=docker-compose.prod.yml
#   SERVICE=postgres
#   DB_NAME=gemadb
#   DB_USER=postgres

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/backup.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[restore] backup file not found: $BACKUP_FILE"
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
SERVICE="${SERVICE:-postgres}"
DB_NAME="${DB_NAME:-gemadb}"
DB_USER="${DB_USER:-postgres}"

echo "[restore] restoring ${BACKUP_FILE} into ${DB_NAME}"
gunzip -c "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" \
  psql -U "$DB_USER" -d "$DB_NAME"

echo "[restore] done"
