#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/backup_postgres.sh
# Optional env:
#   COMPOSE_FILE=docker-compose.prod.yml
#   SERVICE=postgres
#   DB_NAME=gemadb
#   DB_USER=postgres
#   OUT_DIR=./backups

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
SERVICE="${SERVICE:-postgres}"
DB_NAME="${DB_NAME:-gemadb}"
DB_USER="${DB_USER:-postgres}"
OUT_DIR="${OUT_DIR:-./backups}"

mkdir -p "$OUT_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="${OUT_DIR}/gemadb_backup_${TS}.sql.gz"

echo "[backup] creating ${OUT_FILE}"
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$OUT_FILE"

echo "[backup] done: ${OUT_FILE}"
